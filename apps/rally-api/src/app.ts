import express from "express";
import { retainLegacyNotes } from "./report-notes.ts";
import { SpeechOutput, configuredSpeech, type SpeechEngine } from "./speech.ts";
import {
  TeamsBridge,
  configuredTeamsRequest,
  type TeamsRequest,
} from "./teams-bridge.ts";
import { z } from "zod";
import { defaults } from "./config.ts";
import type { Configuration } from "./config.ts";
import { createMuse } from "./muse.ts";
import { LiveKitMedia } from "./media.ts";
import { Store } from "./store.ts";
import { Meetings } from "./meetings.ts";
import { Engine } from "./engine.ts";
import type { Media, Providers } from "./contracts.ts";
import {
  createUser,
  authenticate,
  issueSession,
  revokeSession,
  userForRequest,
  HttpError,
} from "./auth.ts";

export function createApplication(
  options: Partial<Configuration> & {
    providers?: Partial<Providers>;
    media?: Media;
    teamsRequest?: TeamsRequest;
    speechEngine?: SpeechEngine;
  } = {},
) {
  const config = { ...defaults, ...options };
  const store = new Store(config.dbPath);
  const providers: Providers = {
    ...createMuse(store, config),
    ...options.providers,
  };
  const meetings = new Meetings(store, providers);
  const media: Media = options.media || new LiveKitMedia(config);
  const speech = new SpeechOutput(
    options.speechEngine || configuredSpeech(),
    (id) => meetings.get(id),
    (id, shield) => meetings.recordAudioExclusion(id, shield),
  );
  const engine = new Engine(meetings, media, config, speech);
  const teams = new TeamsBridge(
    store,
    meetings,
    options.teamsRequest || configuredTeamsRequest(),
  );
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = req.headers.origin;
    if (origin && !config.origins.includes(origin))
      return next(new HttpError("Origin not allowed", 403));
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS",
      );
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.sendStatus(204);
      return;
    }
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return next(new HttpError("Cross-site writes are disabled", 403));
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  const credentials = z.object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_-]{3,40}$/),
    password: z.string().min(10).max(200),
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/auth/signup", async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await createUser(store, input.username, input.password);
    issueSession(store, res, user, config.secureCookies);
    res.status(201).json(user);
  });
  app.post("/api/auth/login", async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await authenticate(store, input.username, input.password);
    issueSession(store, res, user, config.secureCookies);
    res.json(user);
  });
  app.post("/api/auth/logout", async (req, res) => {
    await engine.disconnectUser(userForRequest(store, req).id);
    revokeSession(store, req, res, config.secureCookies);
    res.sendStatus(204);
  });
  app.get("/api/auth/me", (req, res) => res.json(userForRequest(store, req)));
  app.get("/api/teams/status", async (req, res) =>
    res.json(await teams.status(userForRequest(store, req).id)),
  );
  app.post("/api/teams/join", async (req, res) =>
    res
      .status(201)
      .json(await teams.join(userForRequest(store, req).id, req.body)),
  );
  app.post("/api/teams/leave", async (req, res) =>
    res.json(
      await teams.leave(
        userForRequest(store, req).id,
        z.string().uuid().parse(req.body?.id),
      ),
    ),
  );
  app.post("/api/teams/save", async (req, res) =>
    res.json(
      await teams.save(
        userForRequest(store, req).id,
        z.string().uuid().parse(req.body?.id),
      ),
    ),
  );
  app.get("/api/usage", (req, res) => {
    const user = userForRequest(store, req);
    const rows = store.db
      .prepare("SELECT status,cost,estimate,body FROM usage WHERE user_id=?")
      .all(user.id);
    res.json(
      rows.map((r) => ({
        ...JSON.parse(String(r.body)),
        status: r.status,
        cost: r.cost,
        reserved: r.estimate,
      })),
    );
  });
  app.get("/api/meetings", (req, res) =>
    res.json(meetings.list(userForRequest(store, req).id)),
  );
  app.post("/api/meetings", async (req, res) =>
    res
      .status(201)
      .json(await meetings.create(userForRequest(store, req).id, req.body)),
  );
  app.get("/api/meetings/:id", (req, res) => {
    const m = meetings.get(
      String(req.params.id),
      userForRequest(store, req).id,
    );
    res.json({ ...m, turns: meetings.turns(m.id) });
  });
  app.delete("/api/meetings/:id", (req, res, next) => {
    const m = meetings.get(
      String(req.params.id),
      userForRequest(store, req).id,
    );
    void engine
      .remove(m)
      .then(() => res.sendStatus(204))
      .catch(next);
  });
  const owned = (req: express.Request) =>
    meetings.get(String(req.params.id), userForRequest(store, req).id);
  app.get("/api/speech/status", (req, res) => {
    userForRequest(store, req);
    res.json(speech.status());
  });
  const diagnosticOwner = (req: express.Request) =>
    "diagnostic:" + userForRequest(store, req).id;
  app.post("/api/speech/test", (req, res) => {
    const user = userForRequest(store, req);
    if (meetings.list(user.id).some((m) => m.phase === "live"))
      throw new HttpError(
        "End your live meeting before testing the voice.",
        409,
      );
    res.status(202).json(speech.test(user.id));
  });
  app.get("/api/speech/test/:job", (req, res) =>
    res.json(speech.get(diagnosticOwner(req), String(req.params.job))),
  );
  app.get("/api/speech/test/:job/audio", (req, res) =>
    res
      .type("audio/wav")
      .send(speech.audio(diagnosticOwner(req), String(req.params.job))),
  );
  app.post("/api/speech/test/:job/playback", (req, res) => {
    const data = z
      .object({ state: z.enum(["playing", "completed", "canceled"]) })
      .parse(req.body);
    res.json(
      speech.playback(diagnosticOwner(req), String(req.params.job), data.state),
    );
  });
  app.post("/api/meetings/:id/speech", (req, res) => {
    const m = owned(req);
    const data = z
      .object({
        interventionId: z.string().uuid(),
        epoch: z.number().int().nonnegative(),
      })
      .parse(req.body);
    res.status(202).json(speech.create(m.id, data.interventionId, data.epoch));
  });
  app.get("/api/meetings/:id/speech/:job", (req, res) =>
    res.json(speech.get(owned(req).id, String(req.params.job))),
  );
  app.get("/api/meetings/:id/speech/:job/audio", (req, res) => {
    const audio = speech.audio(owned(req).id, String(req.params.job));
    res.type("audio/wav").send(audio);
  });
  app.post("/api/meetings/:id/speech/:job/playback", (req, res) => {
    const data = z
      .object({ state: z.enum(["playing", "completed", "canceled"]) })
      .parse(req.body);
    res.json(
      speech.playback(owned(req).id, String(req.params.job), data.state),
    );
  });
  app.post("/api/meetings/:id/prepare", async (req, res) => {
    const m = owned(req);
    await meetings.prepare(m);
    res.json(meetings.get(m.id));
  });
  app.patch("/api/meetings/:id/plan", (req, res) =>
    res.json(engine.editPlan(owned(req), req.body)),
  );
  app.patch("/api/meetings/:id/speakers", (req, res) =>
    res.json(engine.speaker(owned(req), req.body)),
  );
  app.post("/api/meetings/:id/start", async (req, res) =>
    res.json(await engine.start(owned(req), req.body?.consented === true)),
  );
  app.post("/api/meetings/:id/reconnect", async (req, res) => {
    let m = owned(req);
    if (req.body?.consented !== true)
      throw new HttpError("Recording consent required");
    await engine.interrupt(m);
    m = meetings.get(m.id);
    res.json(await engine.start(m, true));
  });
  app.post("/api/meetings/:id/connection", async (req, res) =>
    res.json(await engine.connection(owned(req))),
  );
  app.post("/api/meetings/:id/commands", async (req, res) =>
    res.json(await engine.command(owned(req), req.body)),
  );
  app.post("/api/meetings/:id/end", async (req, res) =>
    res.status(202).json(await engine.end(owned(req))),
  );
  app.get("/api/meetings/:id/report", (req, res) => {
    const m = owned(req);
    res.json({
      status: m.reportStatus,
      report: m.report,
      stale: !!m.reportStale,
      error: m.error,
    });
  });
  app.post("/api/meetings/:id/report/retry", (req, res) => {
    const m = owned(req);
    engine.launchReport(m);
    res.status(202).json({ status: "processing" });
  });
  app.patch("/api/meetings/:id/report", (req, res) => {
    const m = owned(req);
    if (m.reportStatus !== "ready")
      throw new HttpError("No completed report", 409);
    const { note } = z
      .object({ note: z.string().trim().min(1).max(4000) })
      .parse(req.body);
    retainLegacyNotes(m);
    if ((m.reportNotes?.length || 0) >= 50)
      throw new HttpError(
        "This meeting has reached its correction note limit.",
        409,
      );
    (m.reportNotes ??= []).push({ at: Date.now(), text: note });
    m.report!.summary += "\nHost correction: " + note;
    meetings.save(m);
    res.json(m.report);
  });
  app.get("/api/meetings/:id/export", (req, res) => {
    const m = owned(req);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rally-${m.id}.json"`,
    );
    res.json({ ...m, turns: meetings.turns(m.id) });
  });
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        err instanceof HttpError
          ? err.status
          : err instanceof z.ZodError
            ? 400
            : 500;
      res.status(status).json({
        error:
          err instanceof z.ZodError
            ? "Invalid request or model output"
            : err instanceof HttpError
              ? err.message
              : "Internal error",
      });
    },
  );
  return {
    app,
    async close() {
      await engine.close();
      speech.close();
      store.close();
    },
  };
}
