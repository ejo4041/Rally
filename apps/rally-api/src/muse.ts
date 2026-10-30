import { prompts } from "./prompts.ts";
import { speechSettingsSchema } from "./speech-config.ts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import WebSocket from "ws";
import { HttpError } from "./auth.ts";
import { planSchema, assessmentSchema, reportSchema } from "./contracts.ts";
import type {
  Providers,
  Meeting,
  TranscriptEvent,
  ASRSession,
} from "./contracts.ts";
import type { Store } from "./store.ts";
import type { Configuration } from "./config.ts";

const prices = z.object({
  input: z.number().nonnegative(),
  cachedInput: z.number().nonnegative(),
  output: z.number().nonnegative(),
});
const effort = z.enum(["minimal", "low", "medium", "high", "xhigh", "max"]);
const settingsSchema = z
  .object({
    reasoning: z
      .object({
        adapter: z.literal("meta-chat-json").default("meta-chat-json"),
        model: z
          .string()
          .regex(/^muse-[a-z0-9.-]+$/)
          .default("muse-spark-1.3"),
        reasoningEffort: effort.default("minimal"),
        maxOutputTokens: z.number().int().min(128).max(32768).default(2048),
        rates: prices.default({ input: 1.25, cachedInput: 0.15, output: 4.25 }),
      })
      .default({
        adapter: "meta-chat-json",
        model: "muse-spark-1.3",
        reasoningEffort: "minimal",
        maxOutputTokens: 2048,
        rates: { input: 1.25, cachedInput: 0.15, output: 4.25 },
      }),
    transcription: z
      .object({
        adapter: z.literal("meta-realtime-asr").default("meta-realtime-asr"),
        model: z.string().default("muse-voice-transcribe-1.0"),
        usdPerAudioHour: z.number().nonnegative().default(0.18),
      })
      .default({
        adapter: "meta-realtime-asr",
        model: "muse-voice-transcribe-1.0",
        usdPerAudioHour: 0.18,
      }),
    speech: speechSettingsSchema.optional(),
    report: z
      .object({
        reasoningEffort: effort.default("max"),
        maxOutputTokens: z.number().int().min(1024).max(32768).default(32768),
      })
      .default({ reasoningEffort: "max", maxOutputTokens: 32768 }),
  })
  .strict();
export function modelSettings(raw = process.env.RALLY_MODEL_CONFIG || "{}") {
  const input = JSON.parse(raw);
  const result = settingsSchema.parse(input);
  if (result.reasoning.model !== "muse-spark-1.3" && !input.reasoning?.rates)
    throw new Error("Changed reasoning models require explicit pricing");
  if (
    result.transcription.model !== "muse-voice-transcribe-1.0" &&
    input.transcription?.usdPerAudioHour === undefined
  )
    throw new Error("Changed transcription models require explicit pricing");
  if (result.reasoning.model.includes("contributor"))
    throw new Error(
      "Contributor data-sharing mode is outside this demo configuration",
    );
  return result;
}
export class UsageLedger {
  store: Store;
  config: Configuration;
  constructor(store: Store, config: Configuration) {
    this.store = store;
    this.config = config;
  }
  check(meetingId: string, additional: number, exclude?: string) {
    const rows = this.store.db
      .prepare("SELECT id,meeting_id,status,cost,estimate FROM usage")
      .all() as {
      id: string;
      meeting_id: string;
      status: string;
      cost: number | null;
      estimate: number;
    }[];
    if (rows.some((r) => r.status === "unknown"))
      throw new HttpError(
        "Unknown provider costs must be reconciled before further paid work",
        409,
      );
    const other = rows.filter((r) => r.id !== exclude);
    const total = other.reduce((s, r) => s + (r.cost ?? r.estimate), 0),
      own = other
        .filter((r) => r.meeting_id === meetingId)
        .reduce((s, r) => s + (r.cost ?? r.estimate), 0);
    if (
      total + additional > this.config.buildBudget ||
      own + additional > this.config.meetingBudget
    )
      throw new HttpError("Configured API budget exceeded", 409);
  }
  reserve(m: Meeting, estimate: number, metadata: unknown) {
    this.check(m.id, estimate);
    const id = randomUUID();
    this.store.db
      .prepare("INSERT INTO usage VALUES(?,?,?,?,?,?,?)")
      .run(
        id,
        m.id,
        m.userId,
        estimate,
        "running",
        null,
        JSON.stringify({ id, at: Date.now(), ...(metadata as object) }),
      );
    return id;
  }
  update(id: string, meetingId: string, estimate: number) {
    this.check(meetingId, estimate, id);
    this.store.db
      .prepare("UPDATE usage SET estimate=? WHERE id=?")
      .run(estimate, id);
  }
  finish(id: string, cost: number | null, details: unknown) {
    const row = this.store.db
      .prepare("SELECT body FROM usage WHERE id=?")
      .get(id) as { body: string };
    this.store.db
      .prepare("UPDATE usage SET status=?,cost=?,body=? WHERE id=?")
      .run(
        cost === null ? "unknown" : "known",
        cost,
        JSON.stringify({
          ...JSON.parse(row.body),
          ...(details as object),
          cost,
          status: cost === null ? "unknown" : "known",
        }),
        id,
      );
  }
}
export function createMuse(
  store: Store,
  config: Configuration,
  options: {
    key?: string;
    fetch?: typeof fetch;
    asrUrl?: string;
    settings?: ReturnType<typeof modelSettings>;
  } = {},
): Providers {
  const settings = options.settings || modelSettings();
  const ledger = new UsageLedger(store, config);
  const http = options.fetch || fetch;
  const key = options.key || process.env.MODEL_API_KEY;
  const enabled = () => {
    if (!config.paidEnabled || !key)
      throw new HttpError(
        "Paid Muse processing is disabled or MODEL_API_KEY is missing",
        503,
      );
  };
  async function json<T>(
    m: Meeting,
    kind: keyof typeof prompts,
    input: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    enabled();
    const r = settings.reasoning;
    const max =
      kind === "report"
        ? settings.report.maxOutputTokens
        : kind === "prepare"
          ? 4096
          : r.maxOutputTokens;
    const body = {
      model: r.model,
      reasoning_effort:
        kind === "report"
          ? settings.report.reasoningEffort
          : kind === "prepare"
            ? "low"
            : r.reasoningEffort,
      max_tokens: max,
      messages: [
        { role: "system", content: prompts[kind] },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: `rally_${kind}`,
          strict: true,
          schema: z.toJSONSchema(schema, { target: "draft-7" }),
        },
      },
    };
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded) > 2000000)
      throw new HttpError(
        "Transcript exceeds the supported report size; no content was silently truncated",
        413,
      );
    const projected =
      (Buffer.byteLength(encoded) * r.rates.input + max * r.rates.output) / 1e6;
    const id = ledger.reserve(m, projected, {
      kind,
      reasoningEffort: body.reasoning_effort,
      maxOutputTokens: body.max_tokens,
      model: r.model,
      adapter: r.adapter,
      pricing: r.rates,
    });
    let cost: number | null = null;
    let details: Record<string, unknown> = {};
    try {
      const response = await http("https://api.meta.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: encoded,
        signal: AbortSignal.timeout(
          kind === "report" ? 180000 : kind === "prepare" ? 60000 : 15000,
        ),
      });
      details = {
        requestId: response.headers.get("x-request-id"),
        httpStatus: response.status,
      };
      if (!response.ok)
        throw new HttpError(
          `Muse ${kind} request failed (${response.status})`,
          502,
        );
      const data = (await response.json()) as {
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          prompt_tokens_details?: { cached_tokens: number };
        };
        choices?: { finish_reason: string; message: { content: string } }[];
      };
      details.finishReason = data.choices?.[0]?.finish_reason ?? null;
      const u = data.usage;
      if (
        u &&
        Number.isFinite(u.prompt_tokens) &&
        u.prompt_tokens >= 0 &&
        Number.isFinite(u.completion_tokens) &&
        u.completion_tokens >= 0
      ) {
        const cached = u.prompt_tokens_details?.cached_tokens || 0;
        if (cached >= 0 && cached <= u.prompt_tokens) {
          cost =
            ((u.prompt_tokens - cached) * r.rates.input +
              cached * r.rates.cachedInput +
              u.completion_tokens * r.rates.output) /
            1e6;
          details.usage = u;
        }
      }
      if (data.choices?.[0]?.finish_reason !== "stop")
        throw new HttpError(
          "Model output did not finish; retry explicitly",
          502,
        );
      return schema.parse(JSON.parse(data.choices[0].message.content));
    } finally {
      ledger.finish(id, cost, details);
    }
  }
  return {
    prepare: (m) =>
      json(
        m,
        "prepare",
        {
          agenda: m.agenda,
          durationMinutes: m.durationMinutes,
          participants: m.participants,
        },
        planSchema,
      ),
    assess: (s) => json(s.meeting, "assess", s, assessmentSchema),
    report: (s) => json(s.meeting, "report", s, reportSchema),
    async openASR(m, callbacks) {
      enabled();
      return openMuseASR({
        m,
        key: key!,
        settings,
        ledger,
        callbacks,
        url: options.asrUrl,
      });
    },
  };
}

// Provider-only event parsing stays here, not in browser or meeting policy code.
type DecodedTurn = {
  start: number | null;
  end: number | null;
  labels: Set<string>;
  started: boolean;
  ended: boolean;
  uncertain: boolean;
  pendingSpan: boolean;
  partial?: string;
  sourceOrder?: number;
  text?: string;
  emitted?: string;
};
export class TranscriptDecoder {
  sessionId: string;
  emit: (event: TranscriptEvent) => void;
  turns = new Map<number, DecodedTurn>();
  private spanOwner?: number;
  private openTurns = new Set<number>();
  private nextOrder = 0;
  constructor(sessionId: string, emit: (event: TranscriptEvent) => void) {
    this.sessionId = sessionId;
    this.emit = emit;
  }
  private turn(id: number) {
    let turn = this.turns.get(id);
    if (!turn) {
      turn = {
        start: null,
        end: null,
        labels: new Set(),
        started: false,
        ended: false,
        uncertain: false,
        pendingSpan: true,
      };
      this.turns.set(id, turn);
    }
    return turn;
  }
  private doubt(...ids: (number | undefined)[]) {
    for (const id of ids) {
      const turn = id === undefined ? undefined : this.turns.get(id);
      if (turn) {
        turn.uncertain = true;
        this.publish(id!, turn);
      }
    }
  }
  private publish(turnId: number, turn: DecodedTurn) {
    if (typeof turn.text !== "string" || !turn.text.trim()) return;
    const event: Extract<TranscriptEvent, { type: "final" }> = {
      type: "final",
      sessionId: this.sessionId,
      turnId,
      sourceOrder: turn.sourceOrder,
      text: turn.text,
      speaker:
        !turn.uncertain && !turn.pendingSpan && turn.labels.size === 1
          ? [...turn.labels][0]
          : null,
      startMs: turn.start,
      endMs: turn.end,
    };
    const signature = JSON.stringify(event);
    if (turn.emitted === signature) return;
    turn.emitted = signature;
    this.emit(event);
  }
  accept(v: Record<string, unknown>) {
    const time =
      typeof v.audioProcessedMs === "number" &&
      Number.isSafeInteger(v.audioProcessedMs) &&
      v.audioProcessedMs >= 0
        ? v.audioProcessedMs
        : null;
    const validId =
      typeof v.turnId === "number" &&
      Number.isInteger(v.turnId) &&
      v.turnId >= -2147483648 &&
      v.turnId <= 2147483647;
    if (v.type === "transcript" && typeof v.transcript === "string") {
      const turn =
        this.spanOwner === undefined
          ? undefined
          : this.turns.get(this.spanOwner);
      if (turn) {
        if (v.transcript.trim() && v.transcript !== turn.partial)
          turn.pendingSpan = true;
        turn.partial = v.transcript;
        this.publish(this.spanOwner!, turn);
      }
      this.emit({ type: "partial", text: v.transcript });
    }
    if (v.type === "speaker") {
      const turn =
        this.spanOwner === undefined
          ? undefined
          : this.turns.get(this.spanOwner);
      if (
        !turn ||
        typeof v.label !== "string" ||
        !v.label.trim() ||
        time === null
      ) {
        this.doubt(this.spanOwner, ...this.openTurns);
      } else {
        // A speaker labels the preceding transcript span in event order. Its
        // processing timestamp is not an interval key or an acoustic boundary.
        if (
          this.openTurns.size > 1 ||
          (turn.text !== undefined && !turn.labels.has(v.label))
        )
          turn.uncertain = true;
        turn.labels.add(v.label);
        turn.pendingSpan = false;
        this.publish(this.spanOwner!, turn);
      }
    }
    if (
      ["speechStart", "speechEnd", "speechComplete"].includes(String(v.type))
    ) {
      if (!validId) {
        this.doubt(this.spanOwner, ...this.openTurns);
        if (v.type === "speechStart") this.spanOwner = undefined;
      } else {
        const id = v.turnId as number,
          turn = this.turn(id);
        if (v.type === "speechStart") {
          if (!turn.started) {
            if (turn.text === undefined && !turn.ended)
              turn.sourceOrder = this.nextOrder++;
            else turn.uncertain = true;
            if (this.openTurns.size) {
              this.doubt(...this.openTurns);
              turn.uncertain = true;
            }
            turn.started = true;
            if (!turn.ended && turn.text === undefined) this.openTurns.add(id);
            this.spanOwner = id;
          } else if (
            time !== null &&
            turn.start !== null &&
            time !== turn.start
          )
            turn.uncertain = true;
          if (time !== null) turn.start = time;
          else turn.uncertain = true;
        }
        if (v.type === "speechEnd") {
          if (time !== null && turn.end !== null && time !== turn.end)
            turn.uncertain = true;
          if (time !== null) turn.end = time;
          turn.ended = true;
          this.openTurns.delete(id);
        }
        if (v.type === "speechComplete" && typeof v.transcript === "string") {
          turn.text = v.transcript;
          turn.ended = true;
          this.openTurns.delete(id);
          // Completion is asynchronous post-processing, not a speech boundary.
          if (!turn.text.trim() && this.spanOwner === id)
            this.emit({ type: "partial", text: "" });
        }
        this.publish(id, turn);
      }
    }
    if (time !== null) this.emit({ type: "progress", processedMs: time });
  }
}

async function openMuseASR({
  m,
  key,
  settings,
  ledger,
  callbacks,
  url,
}: {
  m: Meeting;
  key: string;
  settings: ReturnType<typeof modelSettings>;
  ledger: UsageLedger;
  callbacks: Parameters<Providers["openASR"]>[1];
  url?: string;
}): Promise<ASRSession> {
  const rate = settings.transcription.usdPerAudioHour;
  const id = ledger.reserve(m, (30 * rate) / 3600, {
    kind: "transcription",
    model: settings.transcription.model,
    adapter: settings.transcription.adapter,
    pricing: { usdPerAudioHour: rate },
  });
  const socket = new WebSocket(url || "wss://api.meta.ai/v1/asr/realtime", {
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
  });
  let sessionId = "",
    sentBytes = 0,
    processedMs = 0,
    pending = Buffer.alloc(0),
    ending = false,
    finished = false,
    tick: NodeJS.Timeout | undefined,
    drain: Promise<void> | undefined;
  let resolveClose: () => void;
  const closed = new Promise<void>((r) => (resolveClose = r));
  let resolveReady: () => void, rejectReady: (e: Error) => void;
  const ready = new Promise<void>((r, j) => {
    resolveReady = r;
    rejectReady = j;
  });
  const fail = (message: string) => {
    callbacks.onError(new Error(message));
    rejectReady(new HttpError(message, 502));
    socket.terminate();
  };
  const decoder = new TranscriptDecoder("", (e) => callbacks.onEvent(e));
  const finalize = () => {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    clearTimeout(timeout);
    ledger.finish(
      id,
      sessionId
        ? (Math.floor(Math.max(sentBytes / 32000, processedMs / 1000)) * rate) /
            3600
        : null,
      {
        sessionId: sessionId || null,
        sentSeconds: sentBytes / 32000,
        processedMs,
        costBasis: "conservative_sent_or_processed_seconds",
      },
    );
    resolveClose();
    callbacks.onClose();
  };
  const timeout = setTimeout(
    () => fail("Muse transcription handshake timed out"),
    12000,
  );
  socket.on("open", () =>
    socket.send(
      JSON.stringify({
        authorization: { accessToken: `Bearer ${key}` },
        model: settings.transcription.model,
        audioEncoding: "PCM_16KHZ",
        mode: "DIARIZATION",
        partialMode: "CUMULATIVE",
        emitAudioProgress: true,
      }),
    ),
  );
  socket.on("message", (raw) => {
    try {
      const v = JSON.parse(raw.toString());
      if (v.type === "error") {
        fail("Muse rejected transcription");
        return;
      }
      if (!sessionId && typeof v.sessionId === "string") {
        sessionId = v.sessionId;
        decoder.sessionId = sessionId;
        clearTimeout(timeout);
        resolveReady();
        return;
      }
      if (Number.isFinite(v.audioProcessedMs))
        processedMs = Math.max(processedMs, v.audioProcessedMs);
      if (sessionId) decoder.accept(v);
    } catch {
      fail("Invalid Muse transcription event");
    }
  });
  socket.on("error", () => fail("Muse transcription connection failed"));
  socket.on("close", () => {
    rejectReady(new HttpError("Muse closed before handshake", 502));
    finalize();
  });
  try {
    await ready;
  } catch (error) {
    socket.terminate();
    await closed;
    throw error;
  }
  let clock = performance.now(),
    frames = 0;
  tick = setInterval(() => {
    if (finished) return;
    const due = Math.floor((performance.now() - clock) / 20) - frames;
    if (due > 25) {
      fail("Audio pacing stalled; reconnect rather than replay stale audio");
      return;
    }
    for (let i = 0; i < Math.min(due, 5); i++) {
      if (ending && pending.length === 0) return;
      if (
        socket.readyState !== WebSocket.OPEN ||
        socket.bufferedAmount > 32000
      ) {
        fail("Audio transport backlog; reconnect explicitly");
        return;
      }
      const frame = Buffer.alloc(640);
      const n = Math.min(pending.length, 640);
      pending.copy(frame, 0, 0, n);
      pending = pending.subarray(n);
      try {
        if (frames % 50 === 0)
          ledger.update(id, m.id, ((sentBytes / 32000 + 30) * rate) / 3600);
      } catch {
        fail("Transcription stopped at the configured budget");
        return;
      }
      socket.send(frame);
      sentBytes += 640;
      frames++;
    }
  }, 20);
  return {
    sessionId,
    get sentSeconds() {
      return sentBytes / 32000;
    },
    get processedMs() {
      return processedMs;
    },
    send(bytes) {
      if (ending || finished)
        throw new HttpError("Transcription is not accepting audio", 409);
      if (
        bytes.byteLength % 2 ||
        bytes.byteLength > 32000 ||
        pending.length + bytes.byteLength > 32000
      ) {
        fail("Audio buffer exceeded one second; capture gap recorded");
        return;
      }
      pending = Buffer.concat([pending, bytes]);
    },
    end() {
      if (drain) return drain;
      ending = true;
      drain = (async () => {
        const limit = Date.now() + 1200;
        while (pending.length && Date.now() < limit && !finished)
          await new Promise((r) => setTimeout(r, 20));
        clearInterval(tick);
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: "endStream" }));
        let timer: NodeJS.Timeout | undefined;
        await Promise.race([
          closed,
          new Promise<void>((r) => {
            timer = setTimeout(r, 5000);
          }),
        ]);
        clearTimeout(timer);
        if (!finished) {
          callbacks.onError(new Error("Final transcript drain timed out"));
          socket.terminate();
          await closed;
        }
      })();
      return drain;
    },
    close() {
      ending = true;
      socket.terminate();
    },
  };
}
