import { installSecurity, audit } from './security.ts';
import { TeamsLive, type TeamsConnector } from "./teams-live.ts";
import { connectTeamsBrowser } from "./teams-browser.ts";
import { SpeechService, configuredTTS, type TextToSpeech } from "./speech-service.ts";
import { LiveSpeech } from "./live-speech.ts";
import { SpeechError } from "./seamless.ts";
import { once } from "node:events";
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
    tts?: TextToSpeech;
    teamsConnector?: TeamsConnector;
  } = {},
) {
  const config = { ...defaults, ...options };
  if(!/^[a-f0-9]{64}$/i.test(config.mfaKey)) throw new Error("Set a persistent random RALLY_MFA_KEY (32 bytes, hex) before starting Rally");
  const store = new Store(config.dbPath);
  const providers: Providers = {
    ...createMuse(store, config),
    ...options.providers,
  };
  const meetings = new Meetings(store, providers);
  const transport: Media = options.media || new LiveKitMedia(config);
  let liveTeams: TeamsLive;
  const media: Media = {open: async (meeting,onAudio,onGap) => {
    const call=meeting.captureSource==='teams';
    const session=await transport.open(meeting,call?()=>{}:onAudio,onGap);
    if(!call)return session;
    try {
      const detach=liveTeams.attach(meeting.id,onAudio,onGap);
      return {...session,play:async (_job,chunks,signal,beforeAudio)=>liveTeams.play(meeting.id,chunks,signal,beforeAudio),close:async()=>{detach();await session.close();}};
    }catch(error){await session.close();throw error;}
  }};
  const streamingSelected=!!options.tts || process.env.RALLY_SPEECH_ADAPTER==='seamless-aws';
  const speech = new SpeechOutput(
    options.speechEngine || (streamingSelected ? undefined : configuredSpeech()),
    (id) => meetings.get(id),
    (id, shield) => meetings.recordAudioExclusion(id, shield),
  );
  const engine = new Engine(meetings, media, config, speech);
  liveTeams = new TeamsLive({current:id=>meetings.get(id),save:m=>meetings.save(m),start:m=>engine.start(m,true),end:m=>engine.end(m),interrupt:m=>engine.interrupt(m),renew:id=>engine.renewCall(id),connect:options.teamsConnector||connectTeamsBrowser});
  engine.onCaptureStop=id=>liveTeams.stop(id);
  const teams = new TeamsBridge(
    store,
    meetings,
    options.teamsRequest || configuredTeamsRequest(),
  );
  const tts = new SpeechService(store, options.tts || configuredTTS(), config.paidEnabled);
  if (config.paidEnabled && streamingSelected && (options.tts || process.env.RALLY_TTS_TOKEN)) {
    speech.live = new LiveSpeech({
      current: id => meetings.get(id),
      stream: (text,signal,id) => tts.stream(meetings.get(id).userId,{input:text},signal,id),
      play: async (id,job,chunks,signal,beforeAudio) => {
        const session=engine.active.get(id)?.media;
        if (!session?.play) throw new HttpError('Streaming playback unavailable',503);
        await session.play(job,chunks,signal,beforeAudio);
      },
      event: (id,status) => {
        const m=meetings.get(id);m.speechStatus=status;meetings.save(m);
        engine.emit(id,'speech.status',status);
      },
      shield: (id,window) => meetings.recordAudioExclusion(id,window),
    });
  }
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
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  installSecurity(app,store,meetings,{secure:config.secureCookies,key:config.mfaKey,disconnect:async(id)=>{
    for(const m of meetings.list(id))await liveTeams.stop(m.id);
    await engine.revokeUser(id);
    if(process.env.RALLY_TEAMS_LIVE_ENABLED!=='1') {
      const status=await teams.status(id);
      if(status.job?.id && !["left","failed"].includes(status.job.state)) await teams.leave(id,status.job.id);
    }
  }});
  // Record operational events without meeting content or invite URLs.
  app.use('/api', (req,res,next)=>{
    let actor:string|null=null;
    try {actor=userForRequest(store,req).id;}catch {}
    const match=req.path.match(/^\/meetings\/([a-f0-9-]+)\/(start|end|reconnect|commands|report\/retry|teams\/connect|teams\/leave)$/);
    const feature=req.path.match(/^\/(teams\/(join|leave|save)|speech\/test)$/);
    if(actor && (match || feature)) res.on('finish',()=>audit(store,actor!,match?'meeting.'+match[2]:'feature.'+feature![1],match?.[1]||null,{status:res.statusCode,mode:match?.[2]==='teams/connect'?'teams':match?.[2]==='start'?'browser':undefined}));
    next();
  });
  app.post("/api/auth/logout", async (req, res) => {
    await engine.disconnectUser(userForRequest(store, req).id);
    audit(store,userForRequest(store,req).id,"logout");
    revokeSession(store, req, res, config.secureCookies);
    res.sendStatus(204);
  });
  app.get("/api/auth/me", (req, res) => res.json(userForRequest(store, req)));
  app.get("/api/teams/status", async (req, res) => {
    const user=userForRequest(store,req);
    res.json(process.env.RALLY_TEAMS_LIVE_ENABLED==='1'?{enabled:false,online:false,busy:false,uncertain:false,job:null}:await teams.status(user.id));
  });
  app.post("/api/teams/join", async (req, res) => {
    userForRequest(store,req);
    if(process.env.RALLY_TEAMS_LIVE_ENABLED==='1')throw new HttpError('Join live Teams from a prepared meeting',409);
    return res
      .status(201)
      .json(await teams.join(userForRequest(store, req).id, req.body));
  });
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
    res.json(speech.live ? tts.status() : speech.status());
  });
  app.get('/api/speech/usage',(req,res)=>res.json(tts.usage(userForRequest(store,req).id)));
  const speechAccounts = new Map<string, number>();
  for (const mode of ['generate', 'stream'] as const) {
    app.post('/api/speech/' + mode, async (req, res, next) => {
      const user = userForRequest(store, req);
      if (!config.paidEnabled) throw new HttpError('Provider speech is disabled',403);
      const now = Date.now();
      for (const [id, expires] of speechAccounts) if (expires <= now) speechAccounts.delete(id);
      if (speechAccounts.has(user.id)) {
        res.setHeader('Retry-After', '30');
        throw new HttpError('Wait before requesting more speech',429);
      }
      const input = z.object({input:z.string().refine(value=>!!value.trim()&&[...value].length<=1200),voice:z.literal('default').optional()}).strict().parse(req.body);
      speechAccounts.set(user.id, now + 30000);
      const controller = new AbortController();
      const close = () => controller.abort();
      res.once('close', close);
      try {
        if (mode === 'generate') {
          res.type('audio/wav').send(await tts.synthesize(user.id, input, controller.signal));
        } else {
          res.setHeader('Content-Type','application/octet-stream');
          res.setHeader('X-Audio-Format','pcm_s16le');
          res.setHeader('X-Audio-Sample-Rate','16000');
          res.setHeader('X-Audio-Channels','1');
          for await (const bytes of tts.stream(user.id, input, controller.signal)) {
            if (!res.write(bytes)) await once(res, 'drain', {signal:controller.signal});
          }
          res.end();
        }
      } catch (error) {
        if (res.headersSent) res.destroy();
        else {
          res.removeHeader('Content-Type');
          if (error instanceof SpeechError && error.retryAfter) res.setHeader('Retry-After',error.retryAfter);
          next(error);
        }
      } finally { res.removeListener('close',close); }
    });
  }
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
    if(m.captureSource==='teams')throw new HttpError('Teams speech is delivered only into the call',409);
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
  app.post('/api/meetings/:id/teams/connect',(req,res)=>{
    if(!speech.live)throw new HttpError('Live Teams requires the streaming speech adapter',503);
    if(!config.paidEnabled || (!options.teamsConnector && process.env.RALLY_TEAMS_LIVE_ENABLED!=='1'))throw new HttpError('Live Teams is disabled',503);
    const m=owned(req);
    if(meetings.list(m.userId).some(other=>other.id!==m.id&&other.phase==='live'))throw new HttpError('This host already has an active meeting',409);
    const input=z.object({meetingUrl:z.string().max(4000),consented:z.literal(true)}).parse(req.body);
    res.status(202).json(liveTeams.join(m,input.meetingUrl,input.consented));
  });
  app.get('/api/meetings/:id/teams/status',(req,res)=>res.json(liveTeams.status(owned(req).id)));
  app.post('/api/meetings/:id/teams/leave',async(req,res)=>res.json(await liveTeams.leave(owned(req).id)));
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
  app.post("/api/meetings/:id/start", async (req, res) => {
    const m=owned(req);
    if(['joining','lobby','connected'].includes(liveTeams.status(m.id).state))throw new HttpError('Teams owns this meeting capture',409);
    m.captureSource='browser';meetings.save(m);
    res.json(await engine.start(m,req.body?.consented===true));
  });
  app.post("/api/meetings/:id/reconnect", async (req, res) => {
    let m = owned(req);
    if (req.body?.consented !== true)
      throw new HttpError("Recording consent required");
    if(m.captureSource==='teams')throw new HttpError('Reconnect Teams through its invitation controls',409);
    await engine.interrupt(m);
    m = meetings.get(m.id);
    res.json(await engine.start(m, true));
  });
  app.post("/api/meetings/:id/connection", async (req, res) =>
    res.json(await engine.connection(owned(req))),
  );
  app.post("/api/meetings/:id/heartbeat",(req,res)=>res.json(engine.heartbeat(owned(req),req.body?.captureToken)));
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
      try {audit(store,userForRequest(store,_req).id,"request.failed",null,{route:_req.route?.path||"unknown",status});}catch {}
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
      await liveTeams.close();
      await engine.close();
      await speech.live?.close();
      speech.close();
      store.close();
    },
  };
}
