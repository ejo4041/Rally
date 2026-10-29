// Reuse the existing bounded Teams runner through its protected queue. Never
// expose the shared queue's other users, meeting links or service credential.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "./auth.ts";
import type { Store } from "./store.ts";
import type { Meetings } from "./meetings.ts";
import type { Meeting, Turn } from "./contracts.ts";
const active = new Set(["queued", "joining", "lobby", "connected", "leaving"]);
const jobSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deadline: z.number(),
  state: z.enum([
    "queued",
    "joining",
    "lobby",
    "connected",
    "leaving",
    "left",
    "failed",
  ]),
  message: z.string().max(1000),
  inputLevel: z.number().optional(),
  transcribe: z.boolean().optional(),
  transcriptionState: z.string().optional(),
  partial: z.string().max(4000).optional(),
  transcript: z
    .array(
      z.object({
        id: z.string().max(250),
        text: z.string().max(4000),
        speaker: z.string().max(40).nullable(),
      }),
    )
    .max(200)
    .optional(),
});
export type TeamsJob = z.infer<typeof jobSchema>;
type Row = {
  id: string;
  user_id: string;
  remote_id: string | null;
  body: string;
  meeting_id: string | null;
  uncertain: number;
};
export type TeamsRequest = (action: string, body?: unknown) => Promise<any>;
export function configuredTeamsRequest(): TeamsRequest | undefined {
  const token = process.env.RALLY_SITES_SERVICE_TOKEN,
    origin = process.env.RALLY_TEAMS_SITE_URL;
  if (!token || !origin) return;
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".chatgpt.site") ||
    url.username ||
    url.password
  )
    throw new Error("Invalid Teams bridge origin");
  return async (action, body) => {
    const response = await fetch(new URL("/api/teams/" + action, url.origin), {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        "OAI-Sites-Authorization": "Bearer " + token,
        Origin: url.origin,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      if (response.status === 409)
        throw new HttpError(
          "The Teams runner is busy or its budget needs reconciliation. Check status before retrying.",
          409,
        );
      throw new HttpError(
        "Teams service unavailable. Check status before trying again.",
        503,
      );
    }
    return response.json();
  };
}
export class TeamsBridge {
  private store: Store;
  private meetings: Meetings;
  private request?: TeamsRequest;
  constructor(store: Store, meetings: Meetings, request?: TeamsRequest) {
    this.store = store;
    this.meetings = meetings;
    this.request = request;
    store.db.exec(
      `CREATE TABLE IF NOT EXISTS teams_connections(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),remote_id TEXT UNIQUE,body TEXT NOT NULL,meeting_id TEXT,uncertain INTEGER NOT NULL DEFAULT 0)`,
    );
  }
  private row(userId: string, id: string) {
    const row = this.store.db
      .prepare("SELECT * FROM teams_connections WHERE id=? AND user_id=?")
      .get(id, userId) as Row | undefined;
    if (!row) throw new HttpError("Teams connection not found", 404);
    return row;
  }
  private async upstream(action: string, body?: unknown) {
    if (!this.request)
      throw new HttpError(
        "Teams joining is not configured. Use meeting-tab capture instead.",
        503,
      );
    return this.request(action, body);
  }
  async status(userId: string) {
    if (!this.request)
      return {
        enabled: false,
        online: false,
        busy: false,
        job: null,
        uncertain: false,
        testMinutes: 3,
      };
    const status = await this.upstream("status");
    // Cache the remote terminal snapshot for its mapped owner before a later
    // connection replaces the queue's latest-job view. Never return it to others.
    if (
      status.job?.id &&
      this.store.db
        .prepare("SELECT id FROM teams_connections WHERE remote_id=?")
        .get(status.job.id)
    ) {
      const remote = jobSchema.parse(status.job);
      this.store.db
        .prepare("UPDATE teams_connections SET body=? WHERE remote_id=?")
        .run(JSON.stringify(remote), remote.id);
    }
    const row = this.store.db
      .prepare(
        "SELECT * FROM teams_connections WHERE user_id=? ORDER BY rowid DESC LIMIT 1",
      )
      .get(userId) as Row | undefined;
    let job: TeamsJob | null = row?.remote_id ? JSON.parse(row.body) : null;
    if (row?.remote_id && status.job?.id === row.remote_id) {
      job = jobSchema.parse(status.job);
      this.store.db
        .prepare("UPDATE teams_connections SET body=? WHERE id=?")
        .run(JSON.stringify(job), row.id);
    }
    return {
      enabled: true,
      online: status.online === true && status.transport === "teams-web",
      transcriptionReady: status.transcriptionReady === true,
      busy: active.has(status.job?.state),
      job: job && { ...job, id: row!.id },
      uncertain: !!row?.uncertain,
      testMinutes: 3,
    };
  }
  async join(userId: string, input: unknown) {
    const data = z
      .object({
        meetingUrl: z.string().max(4000),
        consented: z.literal(true),
        transcribe: z.boolean().default(false),
        transcriptionConsented: z.boolean().default(false),
      })
      .parse(input);
    let url: URL;
    try {
      url = new URL(data.meetingUrl.trim());
    } catch {
      throw new HttpError("Paste a valid Teams meeting link.");
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "teams.microsoft.com" ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/(l\/meetup-join\/|meet\/)\S+/.test(url.pathname)
    )
      throw new HttpError(
        "Use a work/school Teams HTTPS meeting link from teams.microsoft.com.",
      );
    if (data.transcribe && !data.transcriptionConsented)
      throw new HttpError(
        "Consent to Meta transcription and saved text is required.",
      );
    if (!this.request)
      throw new HttpError("Teams joining is not configured.", 503);
    const availability = await this.status(userId);
    if (!availability.online)
      throw new HttpError(
        "The Teams runner is offline. No join was attempted.",
        503,
      );
    if (availability.busy)
      throw new HttpError(
        "The shared Teams runner is busy. Wait for departure before another invitation.",
        409,
      );
    if (data.transcribe && !availability.transcriptionReady)
      throw new HttpError("The Teams transcription runner is not ready.", 503);
    // Reserve before an asynchronous request. A timeout can mean a remote job was
    // created; preserve uncertainty and block blind duplicate joins.
    const pending = this.store.db
      .prepare("SELECT id FROM teams_connections WHERE uncertain=1")
      .get();
    if (pending)
      throw new HttpError(
        "A Teams invitation needs reconciliation. Check the Teams roster; no automatic retry is allowed.",
        409,
      );
    const id = randomUUID();
    this.store.db
      .prepare(
        "INSERT INTO teams_connections(id,user_id,body,uncertain) VALUES(?,?,?,1)",
      )
      .run(id, userId, "{}");
    try {
      url.hash = "";
      const response = await this.upstream("join", {
        ...data,
        meetingUrl: url.href,
      });
      const job = jobSchema.parse(response.job);
      this.store.db
        .prepare(
          "UPDATE teams_connections SET remote_id=?,body=?,uncertain=0 WHERE id=?",
        )
        .run(job.id, JSON.stringify(job), id);
      return { job: { ...job, id } };
    } catch (error) {
      if (error instanceof HttpError && [400, 409].includes(error.status)) {
        this.store.db
          .prepare("DELETE FROM teams_connections WHERE id=?")
          .run(id);
        throw error;
      }
      throw new HttpError(
        "Invitation result is uncertain. Check the Teams roster and status before another attempt.",
        503,
      );
    }
  }
  async leave(userId: string, id: string) {
    const row = this.row(userId, id);
    if (!row.remote_id)
      throw new HttpError(
        "Invitation status is uncertain. Verify departure in Teams.",
        409,
      );
    await this.upstream("leave", { id: row.remote_id });
    return { ok: true };
  }
  async save(userId: string, id: string) {
    let row = this.row(userId, id);
    await this.status(userId);
    row = this.row(userId, id);
    if (row.meeting_id) {
      try {
        return { meetingId: this.meetings.get(row.meeting_id, userId).id };
      } catch {
        throw new HttpError(
          "This transcript was saved and later deleted.",
          409,
        );
      }
    }
    const job = jobSchema.parse(JSON.parse(row.body));
    if (
      !["left", "failed"].includes(job.state) ||
      !["stopped", "failed"].includes(job.transcriptionState || "") ||
      !job.transcript?.length
    )
      throw new HttpError(
        "Wait for departure and finalized transcription before saving.",
        409,
      );
    const meetingId = randomUUID(),
      m: Meeting = {
        id: meetingId,
        userId,
        title: "Teams transcript",
        agenda:
          "Saved Teams discussion. Edit a plan before requesting retrospective analysis.",
        participants: [],
        durationMinutes: 3,
        createdAt: job.createdAt,
        phase: "ended",
        plan: null,
        originalPlan: null,
        revisions: [],
        startedAt: job.createdAt,
        endedAt: job.updatedAt,
        paused: false,
        epoch: 0,
        progress:
          "Imported Teams transcription test; no live moderation was run.",
        speakerNames: {},
        assessment: null,
        interventions: [],
        reportStatus: "none",
        report: null,
        error:
          job.state === "failed" || job.transcriptionState === "failed"
            ? "Teams test ended with a failure. Review captured text before analysis."
            : null,
        gaps: [
          {
            at: job.createdAt,
            reason:
              "Imported transcript: individual speech times and verified identities are unavailable; job times include lobby.",
          },
        ],
      };
    this.store.db.exec("BEGIN IMMEDIATE");
    try {
      this.meetings.save(m);
      for (const [index, t] of job.transcript.entries()) {
        const turn: Turn = {
          id: row.remote_id + ":" + index,
          sessionId: row.remote_id!,
          turnId: index,
          revision: 1,
          text: t.text,
          speaker: t.speaker ? row.remote_id + ":" + t.speaker : null,
          startMs: null,
          endMs: null,
        };
        this.store.db
          .prepare("INSERT INTO turns VALUES(?,?,?)")
          .run(meetingId, turn.id, JSON.stringify(turn));
      }
      this.store.db
        .prepare("UPDATE teams_connections SET meeting_id=? WHERE id=?")
        .run(meetingId, id);
      this.store.db.exec("COMMIT");
    } catch (error) {
      this.store.db.exec("ROLLBACK");
      throw error;
    }
    return { meetingId };
  }
}
