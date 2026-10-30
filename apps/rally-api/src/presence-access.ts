import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request } from "express";
import { z } from "zod";
import { HttpError } from "./auth.ts";
import type { Meeting } from "./contracts.ts";
import type { Engine } from "./engine.ts";
import type { Meetings } from "./meetings.ts";
import type { SpeechOutput } from "./speech.ts";
import { sceneFor } from "../../../packages/rally-presence/scene.ts";

type Job = {
  meetingId: string;
  url: string;
  deadline: number;
  state: "queued" | "joining" | "connected" | "left" | "failed";
  lease: number;
  claim: string;
  message: string;
};
/** Node owns ASR, speech approval and accounting. The native runner only transports media. */
export function installPresenceAccess(
  app: Express,
  meetings: Meetings,
  engine: Engine,
  speech: SpeechOutput,
  owned: (req: Request) => Meeting,
) {
  let job: Job | null = null,
    onlineUntil = 0;
  const bootstraps = new Map<string, { meetingId: string; expires: number }>();
  const secret = process.env.RALLY_PRESENCE_RUNNER_SECRET;
  const authenticate = (req: Request) => {
    const provided = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    if (
      !secret ||
      secret.length < 32 ||
      Buffer.byteLength(provided) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
    )
      throw new HttpError("Runner authorization required", 401);
  };
  const currentJob = (req: Request) => {
    authenticate(req);
    if (
      !job ||
      req.body?.claim !== job.claim ||
      job.deadline <= Date.now() ||
      job.lease <= Date.now() ||
      !["joining", "connected"].includes(job.state)
    )
      throw new HttpError("Runner lease expired", 409);
    return job;
  };
  const view = (m: Meeting) => ({
    online: !!secret && onlineUntil > Date.now(),
    job:
      job?.meetingId === m.id
        ? { state: job.state, message: job.message, deadline: job.deadline }
        : null,
  });
  app.post("/api/meetings/:id/observer", async (req, res) =>
    res.json(await engine.observerConnection(owned(req))),
  );
  app.get("/api/meetings/:id/teams-presence", (req, res) =>
    res.json(view(owned(req))),
  );
  app.post("/api/meetings/:id/teams-presence", (req, res) => {
    const m = owned(req);
    const data = z
      .object({ url: z.string().url().max(4000), consented: z.literal(true) })
      .parse(req.body);
    const url = new URL(data.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "teams.microsoft.com" ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/(l\/meetup-join\/|meet\/)\S+/.test(url.pathname)
    )
      throw new HttpError("Use a work/school Teams invitation");
    if (!["ready", "interrupted"].includes(m.phase) || !m.plan)
      throw new HttpError("Review the plan first", 409);
    if (onlineUntil <= Date.now())
      throw new HttpError("The presence runner is offline", 503);
    if (job && ["queued", "joining", "connected"].includes(job.state))
      throw new HttpError("The Teams runner is busy", 409);
    job = {
      meetingId: m.id,
      url: url.href,
      deadline: Date.now() + (m.durationMinutes + 5) * 60000,
      state: "queued",
      lease: Date.now() + 15000,
      claim: "",
      message: "Waiting for Rally to join",
    };
    res.status(202).json(view(m));
  });
  app.post("/api/meetings/:id/teams-presence/leave", async (req, res) => {
    const m = owned(req);
    if (job?.meetingId === m.id) {
      job.state = "left";
      job.message = "Leaving the call";
    }
    if (m.phase === "live") await engine.end(m);
    res.json(view(meetings.get(m.id)));
  });
  app.post("/api/presence/runner/poll", (req, res) => {
    authenticate(req);
    onlineUntil = Date.now() + 10000;
    if (
      job &&
      job.deadline <= Date.now() &&
      ["queued", "joining", "connected"].includes(job.state)
    ) {
      job.state = "failed";
      job.message = "Connection deadline expired";
    }
    let claimed = false;
    if (job?.state === "queued" && job.deadline > Date.now()) {
      job.state = "joining";
      job.claim = randomBytes(32).toString("hex");
      job.lease = Date.now() + 15000;
      claimed = true;
    }
    if (job && ["joining", "connected"].includes(job.state)) {
      if (job.deadline <= Date.now() || job.lease <= Date.now()) {
        job.state = "failed";
        job.message = "Runner connection expired";
      } else if (req.body?.claim === job.claim) job.lease = Date.now() + 15000;
    }
    res.json({
      job:
        job &&
        (claimed || req.body?.claim === job.claim) &&
        ["joining", "connected"].includes(job.state)
          ? job
          : null,
    });
  });
  app.post("/api/presence/runner/connected", async (req, res) => {
    const j = currentJob(req);
    if (j.state === "connected")
      throw new HttpError("Capture already started", 409);
    const result = await engine.start(meetings.get(j.meetingId), true, "teams");
    if (
      job !== j ||
      j.lease <= Date.now() ||
      j.deadline <= Date.now() ||
      j.state !== "joining"
    ) {
      await engine.interrupt(meetings.get(j.meetingId));
      throw new HttpError("Join canceled while capture was starting", 409);
    }
    j.state = "connected";
    j.message = "Rally is guiding this call";
    const bootstrap = randomBytes(32).toString("hex");
    bootstraps.set(bootstrap, {
      meetingId: j.meetingId,
      expires: Date.now() + 30000,
    });
    res.json({ ...result, bootstrap });
  });
  app.post("/api/presence/runner/heartbeat", (req, res) => {
    const j = currentJob(req),
      m = meetings.get(j.meetingId);
    engine.heartbeat(m, req.body.captureToken);
    j.lease = Date.now() + 15000;
    const offer = m.interventions.at(-1);
    res.json({
      scene: sceneFor(m),
      offer:
        offer && Date.now() - offer.at < 30000
          ? { ...offer, epoch: m.epoch }
          : null,
    });
  });
  app.post("/api/presence/runner/speech", (req, res) => {
    const j = currentJob(req),
      m = meetings.get(j.meetingId);
    res.json(
      speech.create(
        m.id,
        String(req.body.interventionId),
        Number(req.body.epoch),
      ),
    );
  });
  app.post("/api/presence/runner/speech/:id", (req, res) => {
    const j = currentJob(req);
    if (req.body.state) {
      const state = z
        .enum(["armed", "playing", "completed", "canceled"])
        .parse(req.body.state);
      res.json(speech.playback(j.meetingId, String(req.params.id), state));
    } else res.json(speech.get(j.meetingId, String(req.params.id)));
  });
  app.post("/api/presence/runner/speech/:id/audio", (req, res) => {
    const j = currentJob(req);
    res
      .type("audio/wav")
      .send(speech.audio(j.meetingId, String(req.params.id)));
  });
  app.post("/api/presence/runner/finish", async (req, res) => {
    authenticate(req);
    if (!job || job.claim !== req.body.claim)
      throw new HttpError("Unknown claim", 409);
    const j = job;
    j.state = req.body.failed ? "failed" : "left";
    j.message = req.body.failed
      ? "Call stopped; review connection and transcript"
      : "Rally left the call";
    const m = meetings.get(j.meetingId);
    if (m.phase === "live") await engine.interrupt(m);
    res.json({ ok: true });
  });
  app.post("/api/presence/bootstrap", async (req, res) => {
    const token = z.string().length(64).parse(req.body.token),
      grant = bootstraps.get(token);
    bootstraps.delete(token);
    if (!grant || grant.expires <= Date.now())
      throw new HttpError("Renderer bootstrap expired", 401);
    const m = meetings.get(grant.meetingId);
    if (m.phase !== "live") throw new HttpError("Meeting is not live", 409);
    res.json({
      scene: sceneFor(m),
      connection: await engine.rendererConnection(m),
    });
  });
  return {
    cancelUser(userId: string) {
      if (!job || !["queued", "joining", "connected"].includes(job.state))
        return;
      if (meetings.get(job.meetingId).userId === userId) {
        job.state = "left";
        job.message = "Host signed out; Rally is leaving";
      }
    },
  };
}
