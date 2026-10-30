// Local integration fixture only. Providers are injected; no model API is used.
import {
  configuredSpeech,
  type SpeechEngine,
} from "../../rally-api/src/speech.ts";
import { createApplication } from "../../rally-api/src/app.ts";
import { LiveKitMedia } from "../../rally-api/src/media.ts";
import { defaults } from "../../rally-api/src/config.ts";
import type {
  TranscriptEvent,
  Providers,
  MediaSession,
  Meeting,
  Snapshot,
} from "../../rally-api/src/contracts.ts";
import { categories } from "../../rally-api/src/contracts.ts";
import { HttpError } from "../../rally-api/src/auth.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const { dispose } = createRequire(
  new URL("../../rally-api/package.json", import.meta.url),
)("@livekit/rtc-node");
const folder = await mkdtemp(join(tmpdir(), "rally-web-test-"));
const config = {
  ...defaults,
  dbPath: join(folder, "fixture.sqlite"),
  origins: [`http://127.0.0.1:${process.env.RALLY_WEB_PORT || 5174}`],
  assessmentMs: Number(process.env.RALLY_TEST_ASSESSMENT_MS || 60000),
  asrRotationMs: Number(
    process.env.RALLY_TEST_ASR_ROTATION_MS || defaults.asrRotationMs,
  ),
  livekitUrl: `ws://127.0.0.1:${process.env.RALLY_TEST_MEDIA_PORT || 18890}`,
};
const livekit = new LiveKitMedia(config),
  sessions = new Map<string, MediaSession>(),
  callbacks = new Map<string, (event: TranscriptEvent) => void>();
let totalBytes = 0,
  energy = 0,
  reportAttempts = 0,
  failPrepare = false,
  speechSessions = 0,
  reportedTurns = 0;
const providers: Providers = {
  prepare: async (m) => {
    if (failPrepare) throw new HttpError("Fixture agenda failure");
    return {
      objective: m.agenda,
      topics: [
        {
          id: "launch",
          title: "Release readiness",
          outcome: "Decide scope and owners",
          minutes: m.durationMinutes - 1,
          status: "pending",
        },
      ],
      durationMinutes: m.durationMinutes,
      wrapMinutes: 1,
    };
  },
  openASR: async (m, c) => {
    const sessionId = "fixture-" + ++speechSessions;
    callbacks.set(m.id, c.onEvent);
    let bytes = 0,
      emitted = false;
    return {
      sessionId,
      get sentSeconds() {
        return bytes / 32000;
      },
      get processedMs() {
        return bytes / 32;
      },
      send(data) {
        bytes += data.byteLength;
        totalBytes += data.byteLength;
        const pcm = new Int16Array(
          data.buffer,
          data.byteOffset,
          data.byteLength / 2,
        );
        for (const v of pcm) energy += v * v;
        if (!emitted && bytes >= 16000) {
          emitted = true;
          c.onEvent({ type: "partial", text: "Unfinished caption" });
          c.onEvent({
            type: "final",
            sessionId,
            turnId: 0,
            text: "Priya will verify rollback by Thursday at three.",
            speaker: "A",
            startMs: 0,
            endMs: 500,
          });
        }
      },
      async end() {
        c.onEvent({
          type: "final",
          sessionId,
          turnId: 1,
          text: "Keep the accessibility condition in the release decision.",
          speaker: null,
          startMs: 500,
          endMs: 1000,
        });
      },
      close() {},
    };
  },
  assess: async (s) => ({
    health: 3,
    reason: "Ownership needs clarification",
    issues: ["missing_action_details"],
    evidence: s.turns.map((t) => t.id),
    progress: "Reviewing the release",
    intervention: {
      text: "Who owns the accessibility check?",
      kind: "clarify",
      evidence: [s.turns[0].id],
    },
    plan: null,
    planReason: "",
  }),
  report: async (s) => {
    reportAttempts++;
    reportedTurns = s.turns.length;
    await new Promise((r) => setTimeout(r, 1200));
    if (reportAttempts === 1)
      throw new HttpError("Fixture report failure; explicit retry required");
    return report(s);
  },
};
function report(s: Snapshot) {
  return {
    summary:
      "Release discussion saved. Host-reviewed attribution still matters.",
    decisions: [],
    actions: [
      {
        text: "Verify rollback.",
        owner: "Priya",
        dueDate: "Friday at noon",
        status: "reported_agreement" as const,
        evidence: [s.turns[0].id],
        followup: "ticket" as const,
        followupPrompt: "Draft a rollback check ticket",
      },
    ],
    unresolved: ["Accessibility owner"],
    scores: categories.map((category, i) => ({
      category,
      score: i === 4 ? null : 4,
      reason:
        i === 4
          ? "Speaker identities are not verified."
          : "Evidence supports the discussion.",
      evidence: i === 4 ? [] : [s.turns[0].id],
    })),
    speakerTips: [],
    focusTime: {
      onTopicSeconds: null,
      offTopicSeconds: null,
      unknownSeconds: null,
      note: "Insufficient timing evidence",
    },
  };
}
let speechGenerations = 0;
let teamsJob: any = null;
const syntheticSpeech: SpeechEngine = {
  async start() {},
  async synthesize() {
    speechGenerations++;
    const pcm = Buffer.alloc(32000 * 3);
    for (let i = 0; i < pcm.length / 2; i++)
      pcm.writeInt16LE(
        Math.round(3000 * Math.sin((2 * Math.PI * 440 * i) / 16000)),
        i * 2,
      );
    const wav = Buffer.alloc(44 + pcm.length);
    wav.write("RIFF");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24);
    wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(pcm.length, 40);
    pcm.copy(wav, 44);
    return {
      pcm,
      wav,
      sampleRate: 16000,
      seconds: 3,
      model: "facebook/mms-tts-eng",
      revision: "c71de0fe7204c83f1c10820a7d696d0b450048ba",
    };
  },
  close() {},
};
const localSpeech =
  process.env.RALLY_TEST_REAL_MMS === "1" ? configuredSpeech() : undefined;
if (process.env.RALLY_TEST_REAL_MMS === "1" && !localSpeech)
  throw Error("Enable the pinned local MMS engine for the real speech test.");
const api = createApplication({
  speechEngine: localSpeech
    ? {
        start: () => localSpeech.start(),
        async synthesize(text, options) {
          speechGenerations++;
          return localSpeech.synthesize(text, options);
        },
        close: () => localSpeech.close(),
      }
    : syntheticSpeech,

  teamsRequest: async (action, data: any) => {
    if (action === "status")
      return {
        online: true,
        transport: "teams-web",
        transcriptionReady: true,
        job: teamsJob,
      };
    if (action === "join") {
      teamsJob = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deadline: Date.now() + 180000,
        state: "lobby",
        message: "Admit Rally from the lobby.",
        transcriptionState: "waiting",
        transcribe: true,
        transcript: [],
      };
      return { job: teamsJob };
    }
    if (action === "leave") {
      teamsJob = {
        ...teamsJob,
        state: "left",
        message: "Rally has left.",
        transcriptionState: "stopped",
        partial: "Do not save partial",
        transcript: [
          {
            id: "fixture:0",
            speaker: null,
            text: "Teams fixture finalized text.",
          },
        ],
      };
      return { ok: true };
    }
    throw Error("Unexpected Teams operation");
  },
  ...config,
  providers,
  media: {
    async open(m, onAudio, onGap) {
      const session = await livekit.open(m, onAudio, onGap);
      sessions.set(m.id, session);
      return session;
    },
  },
});
api.app.get("/api/test/state", (_req, res) =>
  res.json({
    totalBytes,
    energy,
    speechGenerations,
    reportAttempts,
    reportedTurns,
    speechSessions,
  }),
);
api.app.post("/api/test/prepare-failure", (req, res) => {
  failPrepare = req.body.enabled === true;
  res.json({ ok: true });
});
api.app.post("/api/test/event", async (req, res) => {
  const { meetingId, type, data } = req.body;
  await sessions
    .get(meetingId)
    ?.send({ version: 1, id: crypto.randomUUID(), meetingId, type, data });
  res.json({ ok: true });
});
api.app.post("/api/test/revision", (req, res) => {
  const { meetingId, sessionId } = req.body;
  callbacks.get(meetingId)?.({
    type: "final",
    sessionId,
    turnId: 0,
    text: "Priya will verify rollback by Friday at noon.",
    speaker: "A",
    startMs: 0,
    endMs: 500,
  });
  res.json({ ok: true });
});
const server = api.app.listen(
  Number(process.env.RALLY_TEST_API_PORT || 3101),
  "127.0.0.1",
  () => console.log("Fixture API ready; paid providers are replaced."),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    server.close();
    void api.close().then(async () => {
      await dispose();
      await rm(folder, { recursive: true, force: true });
      process.exit(0);
    });
  });
