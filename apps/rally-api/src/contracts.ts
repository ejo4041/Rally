import { z } from "zod";

const text = z.string().min(1).max(2000);
export const planSchema = z.object({
  objective: text,
  topics: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        title: text,
        outcome: text,
        minutes: z.number().positive().max(240),
        status: z.enum(["pending", "active", "done", "parked"]),
      }),
    )
    .min(1)
    .max(20),
  durationMinutes: z.number().positive().max(480),
  wrapMinutes: z.number().nonnegative().max(30),
});
export type Plan = z.infer<typeof planSchema> & { retiredMinutes?: number };
const evidence = z.array(z.string()).max(200);
export const issues = [
  "drift",
  "pacing",
  "overtime",
  "participation",
  "unclear_outcome",
  "missing_action_details",
] as const;
export const assessmentSchema = z.object({
  health: z.number().int().min(0).max(5).nullable(),
  reason: text,
  issues: z.array(z.enum(issues)),
  evidence,
  progress: z.string().max(4000),
  intervention: z
    .object({
      text: z.string().min(1).max(500),
      kind: z.enum(["redirect", "clarify", "checkpoint", "wrapup"]),
      evidence,
    })
    .nullable(),
  plan: planSchema.nullable(),
  planReason: z.string().max(1000),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export const categories = [
  "goal_progress",
  "focus",
  "pacing",
  "actionable_outcomes",
  "participation",
] as const;
const outcome = z.object({
  text,
  owner: z.string().max(100).nullable(),
  dueDate: z.string().max(100).nullable(),
  status: z.enum(["reported_agreement", "proposal", "unresolved"]),
  evidence: evidence.min(1),
  followup: z.enum(["none", "ticket", "meeting"]),
  followupPrompt: z.string().max(2000).nullable(),
});
export const reportSchema = z.object({
  summary: z.string().min(1).max(8000),
  decisions: z.array(outcome).max(100),
  actions: z.array(outcome).max(100),
  unresolved: z.array(text).max(100),
  scores: z
    .array(
      z.object({
        category: z.enum(categories),
        score: z.number().int().min(0).max(5).nullable(),
        reason: text,
        evidence,
      }),
    )
    .length(5),
  speakerTips: z
    .array(
      z.object({
        speakerId: z.string(),
        tips: z
          .array(z.object({ text, evidence: evidence.min(1) }))
          .min(1)
          .max(2),
      }),
    )
    .max(100),
  focusTime: z.object({
    onTopicSeconds: z.number().nonnegative().nullable(),
    offTopicSeconds: z.number().nonnegative().nullable(),
    unknownSeconds: z.number().nonnegative().nullable(),
    note: text,
  }),
});
export type Report = z.infer<typeof reportSchema> & {
  overall: number | null;
  coverage: number;
};
export type Turn = {
  id: string;
  sessionId: string;
  turnId: number;
  sourceOrder?: number;
  revision: number;
  text: string;
  speaker: string | null;
  startMs: number | null;
  endMs: number | null;
};
export type Meeting = {
  topicSpentSeconds?: Record<string, number>;
  extension?: import("./live-agenda.ts").ExtensionProposal;
  monitor?: import("./realtime.ts").LiveCheck;
  id: string;
  userId: string;
  title: string;
  agenda: string;
  participants: string[];
  durationMinutes: number;
  createdAt: number;
  phase: "draft" | "ready" | "live" | "ended" | "interrupted";
  plan: Plan | null;
  originalPlan: Plan | null;
  revisions: { at: number; reason: string; plan: Plan }[];
  startedAt: number | null;
  endedAt: number | null;
  paused: boolean;
  epoch: number;
  progress: string;
  speakerNames: Record<string, string>;
  assessment: Assessment | null;
  assessmentAt?: number;
  captureSource?: "browser" | "teams";
  callState?: string;
  speechEnabled?: boolean;
  speechTransport?: "livekit" | "wav";
  liveStatus?: {
    at: number;
    assessmentState: string;
    destination: string;
    callState: string;
  };
  speechStatus?: import("./live-speech.ts").SpeechState | null;
  interventions: { id: string; at: number; text: string; kind: string }[];
  reportStatus: "none" | "processing" | "ready" | "failed";
  reportStale?: boolean;
  reportNotes?: { at: number | null; text: string; legacy?: true }[];
  report: Report | null;
  error: string | null;
  gaps: { at: number; reason: string }[];
  audioExclusions?: {
    id: string;
    startMs: number;
    maxEndMs: number;
    reason: "moderator_speech";
  }[];
};
export type Snapshot = {
  meeting: Meeting;
  turns: Turn[];
  elapsedSeconds: number;
};
export type TranscriptEvent =
  | { type: "partial"; text: string; sessionId?: string; turnId?: number }
  | {
      type: "final";
      sessionId: string;
      turnId: number;
      sourceOrder?: number;
      text: string;
      speaker: string | null;
      startMs?: number | null;
      endMs?: number | null;
    }
  | { type: "progress"; processedMs: number };
export interface ASRSession {
  sessionId: string;
  send(bytes: Uint8Array): void;
  end(): Promise<void>;
  close(): void;
  sentSeconds: number;
  processedMs: number;
}
export interface Providers {
  prepare(meeting: Meeting): Promise<Plan>;
  assess(snapshot: Snapshot): Promise<Assessment>;
  forecastLive?(
    context: import("./realtime.ts").LiveContext,
    meeting: Meeting,
  ): import("./realtime.ts").LiveForecast;
  checkLive?(
    context: import("./realtime.ts").LiveContext,
    meeting: Meeting,
    signal: AbortSignal,
  ): Promise<import("./realtime.ts").LiveDecision>;
  report(snapshot: Snapshot): Promise<z.infer<typeof reportSchema>>;
  openASR(
    meeting: Meeting,
    callbacks: {
      onEvent: (event: TranscriptEvent) => void;
      onError: (error: Error) => void;
      onClose: () => void;
    },
  ): Promise<ASRSession>;
}
export type LiveEvent = {
  version: 1;
  id: string;
  meetingId: string;
  type: string;
  data: unknown;
};
export interface MediaSession {
  play?(
    job: import("./live-speech.ts").SpeechState,
    chunks: AsyncIterable<Buffer>,
    signal: AbortSignal,
    beforeAudio: () => void,
    onProgress?: (playedMs: number) => void,
  ): Promise<void>;
  connection(): Promise<{ url: string; token: string; room: string }>;
  send(event: LiveEvent): Promise<void>;
  close(): Promise<void>;
}
export interface Media {
  open(
    meeting: Meeting,
    onAudio: (bytes: Uint8Array) => void,
    onGap: (reason: string) => void,
  ): Promise<MediaSession>;
}
