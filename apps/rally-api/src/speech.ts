import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { HttpError } from "./auth.ts";
import type { Meeting } from "./contracts.ts";
import {
  defaultSpeech,
  speechSettingsSchema,
  type SpeechIdentity,
} from "./speech-config.ts";
export interface SpeechEngine {
  readonly identity?: SpeechIdentity;
  start(): Promise<unknown>;
  synthesize(
    text: string,
    options: { signal: AbortSignal },
  ): Promise<{
    pcm: Buffer;
    wav: Buffer;
    sampleRate: number;
    seconds: number;
    model: string;
    revision: string;
  }>;
  close(): void;
}
export type SpeechShield = { id: string; start: number; end: number };
export function configuredSpeech(): SpeechEngine | undefined {
  if (process.env.RALLY_MMS_ENABLED !== "1") return;
  const identity = speechSettingsSchema.parse(
    JSON.parse(process.env.RALLY_MODEL_CONFIG || "{}").speech || {},
  );
  const { MMSSpeech } = createRequire(import.meta.url)(
    "../../../experiments/meta-mms/speech.mjs",
  ) as {
    MMSSpeech: new (options: {
      python: string;
      modelDirectory: string;
      model: string;
      revision: string;
    }) => SpeechEngine;
  };
  const engine = new MMSSpeech({
    model: identity.model,
    revision: identity.revision,
    python:
      process.env.RALLY_MMS_PYTHON ||
      "/srv/hackathon/tools/mms-venv/bin/python",
    modelDirectory:
      process.env.RALLY_MMS_MODEL_DIR || "/srv/hackathon/models/mms-tts-eng",
  });
  return Object.assign(engine, { identity });
}
type Offer = { id: string; text: string; epoch: number; at: number };
type Job = {
  id: string;
  meetingId: string;
  offer: Offer;
  state:
    "preparing" | "ready" | "playing" | "completed" | "canceled" | "failed";
  abort: AbortController;
  audio?: Buffer;
  seconds?: number;
  shieldUntil: number;
  timer: ReturnType<typeof setTimeout>;
};
// Only Engine-approved interventions enter this bounded in-memory output queue.
// There is no client-supplied text, retry loop, persisted waveform or external TTS.
export class SpeechOutput {
  private engine: SpeechEngine | undefined;
  private identity: SpeechIdentity;
  private current: (id: string) => Meeting;
  private jobs = new Map<string, Job>();
  private offers = new Map<string, Offer>();
  private diagnostics = new Map<
    string,
    Pick<Meeting, "id" | "phase" | "paused" | "epoch" | "interventions">
  >();
  private generating = false;
  private ready = false;
  private closed = false;
  private onShield: (meetingId: string, shield: SpeechShield) => void;
  constructor(
    engine: SpeechEngine | undefined,
    current: (id: string) => Meeting,
    onShield: (meetingId: string, shield: SpeechShield) => void = () => {},
  ) {
    this.engine = engine;
    this.identity = engine?.identity || defaultSpeech;
    this.current = current;
    this.onShield = onShield;
    if (engine)
      void engine
        .start()
        .then(() => {
          if (!this.closed) this.ready = true;
        })
        .catch(() => {
          this.ready = false;
        });
  }
  status() {
    return {
      enabled: !!this.engine,
      ready: this.ready,
      model: this.identity.model,
      revision: this.identity.revision,
      execution: "self-hosted",
      sampleRate: this.identity.sampleRate,
    };
  }
  offer(meetingId: string, offer: Offer) {
    this.cancel(meetingId);
    this.offers.set(meetingId, offer);
  }
  test(userId: string) {
    const id = "diagnostic:" + userId,
      previous = this.jobs.get(id);
    if (previous && Date.now() - previous.offer.at < 30000)
      throw new HttpError(
        "Wait a few seconds before another voice check.",
        429,
      );
    const offer = {
      id: randomUUID(),
      text: "Hi, I am Rally. Let us make this meeting count.",
      epoch: 0,
      at: Date.now(),
    };
    this.diagnostics.set(id, {
      id,
      phase: "live",
      paused: false,
      epoch: 0,
      interventions: [{ ...offer, kind: "diagnostic" }],
    });
    this.offer(id, offer);
    try {
      return this.create(id, offer.id, 0);
    } catch (error) {
      this.forget(id);
      throw error;
    }
  }
  private valid(meetingId: string, offer: Offer) {
    const m = this.diagnostics.get(meetingId) || this.current(meetingId);
    return (
      m.phase === "live" &&
      !m.paused &&
      m.epoch === offer.epoch &&
      this.offers.get(meetingId) === offer &&
      m.interventions.at(-1)?.id === offer.id
    );
  }
  private view(job: Job) {
    return {
      id: job.id,
      interventionId: job.offer.id,
      epoch: job.offer.epoch,
      state: job.state,
      seconds: job.seconds ?? null,
    };
  }
  create(meetingId: string, interventionId: string, epoch: number) {
    const offer = this.offers.get(meetingId);
    if (
      !offer ||
      offer.id !== interventionId ||
      offer.epoch !== epoch ||
      !this.valid(meetingId, offer)
    )
      throw new HttpError("This prompt is no longer eligible for speech.", 409);
    const previous = this.jobs.get(meetingId);
    if (previous?.offer === offer) return this.view(previous);
    if (Date.now() - offer.at > 30000)
      throw new HttpError(
        "This prompt is too old to speak. Its text remains visible.",
        409,
      );
    if (!this.engine || !this.ready)
      throw new HttpError(
        "Meta MMS voice is unavailable or warming. The prompt remains visible.",
        503,
      );
    if (this.generating)
      throw new HttpError(
        "Voice generation is busy. The prompt remains visible.",
        409,
      );
    if (previous) clearTimeout(previous.timer);
    const job: Job = {
      id: randomUUID(),
      meetingId,
      offer,
      state: "preparing",
      abort: new AbortController(),
      shieldUntil: 0,
      timer: setTimeout(() => {
        this.forget(meetingId);
      }, 75000),
    };
    job.timer.unref();
    this.jobs.set(meetingId, job);
    this.generating = true;
    void this.engine
      .synthesize(offer.text, { signal: job.abort.signal })
      .then((audio) => {
        if (job.abort.signal.aborted || !this.valid(meetingId, offer)) return;
        if (
          audio.model !== this.identity.model ||
          audio.revision !== this.identity.revision ||
          audio.sampleRate !== this.identity.sampleRate ||
          !Buffer.isBuffer(audio.pcm) ||
          !audio.pcm.length ||
          audio.pcm.length % 2 ||
          audio.pcm.length > 960000 ||
          !Number.isFinite(audio.seconds) ||
          Math.abs(audio.seconds - audio.pcm.length / 32000) > 0.001 ||
          !Buffer.isBuffer(audio.wav) ||
          audio.wav.length !== 44 + audio.pcm.length ||
          audio.wav.toString("ascii", 0, 4) !== "RIFF"
        )
          throw new Error("Invalid speech result");
        job.audio = audio.wav;
        job.seconds = audio.seconds;
        job.state = "ready";
      })
      .catch(() => {
        if (!job.abort.signal.aborted) {
          job.state = "failed";
          job.audio = undefined;
        }
      })
      .finally(() => {
        this.generating = false;
      });
    return this.view(job);
  }
  private find(meetingId: string, id: string) {
    const job = this.jobs.get(meetingId);
    if (!job || job.id !== id)
      throw new HttpError("Speech job not found.", 404);
    if (!job.abort.signal.aborted && !this.valid(meetingId, job.offer))
      this.cancel(meetingId);
    return job;
  }
  get(meetingId: string, id: string) {
    return this.view(this.find(meetingId, id));
  }
  audio(meetingId: string, id: string) {
    const job = this.find(meetingId, id);
    if (!["ready", "playing"].includes(job.state) || !job.audio)
      throw new HttpError("Speech is no longer available.", 409);
    return job.audio;
  }
  playback(
    meetingId: string,
    id: string,
    state: "playing" | "completed" | "canceled",
  ) {
    const job = this.find(meetingId, id);
    if (state === "playing") {
      if (job.state === "playing") return this.view(job);
      if (job.state !== "ready")
        throw new HttpError("Speech is not ready.", 409);
      const start = Date.now(),
        end = start + (job.seconds ?? 30) * 1000 + 2000;
      if (!this.diagnostics.has(meetingId))
        this.onShield(meetingId, { id: job.id, start, end });
      job.state = "playing";
      job.shieldUntil = end;
    } else {
      if (job.state === "playing")
        job.shieldUntil = Math.min(job.shieldUntil, Date.now() + 800);
      job.state = state;
      job.audio = undefined;
      job.abort.abort();
    }
    return this.view(job);
  }
  shielded(meetingId: string) {
    const job = this.jobs.get(meetingId);
    return !!job && job.shieldUntil > Date.now();
  }
  cancel(meetingId: string) {
    this.offers.delete(meetingId);
    const job = this.jobs.get(meetingId);
    if (!job) return;
    job.abort.abort();
    if (job.state === "playing")
      job.shieldUntil = Math.min(job.shieldUntil, Date.now() + 800);
    job.state = "canceled";
    job.audio = undefined;
  }
  forget(meetingId: string) {
    const job = this.jobs.get(meetingId);
    if (job) clearTimeout(job.timer);
    this.cancel(meetingId);
    this.jobs.delete(meetingId);
    this.diagnostics.delete(meetingId);
  }
  close() {
    this.closed = true;
    for (const id of this.jobs.keys()) this.forget(id);
    this.offers.clear();
    this.diagnostics.clear();
    this.engine?.close();
  }
}
