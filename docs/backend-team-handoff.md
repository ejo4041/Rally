# Rally backend — team handoff

Start with the [current integrated handoff](handoff.md) for the deployed source revision, private app link and running endurance checks. The Node app combines `apps/rally-api/` and `apps/rally-web/`; the earlier `apps/rally/` Sites release is a separate implementation with different controls.

## Start here

- [Setup and commands](../apps/rally-api/README.md): Node 24, dependencies, local services, account setup and server-side secrets.
- [Frontend API and streaming contract](backend-api.md): authenticated HTTP endpoints, LiveKit connection, transcript/guidance events and report retrieval.
- [AI processing diagram and rules](ai-processing.md): agenda preparation, live checks, evidence validation and complete final analysis.
- [Actual AI examples](backend-ai-examples.md): earlier real-provider agendas, due-outs, scores and speaker suggestions. These are recorded examples, not deterministic demo responses.
- [Model interfaces](model-interfaces.md): capability injection, configuration, pricing, normalized audio events and local speech.
- [Frontend setup](../apps/rally-web/README.md) and [deployment/rollback](integrated-deployment.md).

## Current behavior

The API uses TypeScript/Node, Express, SQLite and self-hosted LiveKit. Browser microphone or selected call-tab audio reaches Muse Voice Transcribe through the backend. It does not read platform captions or native meeting transcripts. Muse Spark prepares agendas, evaluates progress and generates the final report. Provider credentials stay server-side.

Accounts isolate meetings, history, transcripts, usage and speech jobs. A meeting retains its original and revised agenda, finalized transcript revisions, session-scoped anonymous speakers, eligible guidance and host overrides. Final analysis runs asynchronously over the complete supported transcript and exposes processing/ready/failed state. It distinguishes reported agreement, proposal and unresolved items; missing owner/date and timing stay unknown.

Local pinned Meta MMS can speak approved prompts in the host browser. Stop, pause/dismiss/end and stale evidence revoke playback eligibility. Its bounded input shield is disclosed in saved coverage records. This is not verified remote-call speech injection.

Host speaker labels can be assigned or cleared. They do not identify a room's individual occupants automatically. Label changes after analysis mark the report stale; explicit reanalysis uses the existing usage gates. Host annotations survive regeneration separately from source evidence. Saved reports support source links, history, export and reviewed manual WhatsApp drafts. No ticket, calendar event or message is sent automatically.

[Planned ASR handoff](asr-session-handoff.md) defaults to 55 minutes: drain the old session, discard frames while opening the replacement, keep the existing browser publication and restart anonymous speaker scope. A recorded continuity notice differs from a fatal capture error. Failed replacement requires explicit recovery. Paused moderation does not pause transcription or session maintenance.

## Validation

The current source passes 50 backend tests, nine frontend tests, both TypeScript checks and frontend build. The real HTTP/cookie/SQLite/LiveKit browser workflow passes with synthetic audio and injected transcription/reasoning. Separate checks use the actual local MMS checkpoint and deployed HTTPS playback/Stop. Read the [current handoff measurements](handoff.md#validation-and-running-check) for versions and exact scope.

Four separate WhatsApp prototype checks cover call-link validation, cancellation during startup, startup deadlines and real local browser cleanup. Isolated synthetic audio routing also passes. This does not prove a WhatsApp call was joined. The 65-minute capture experiment and eight-hour MMS experiment require their own terminal results; a running report is not a completed reliability pass.

Earlier real Muse calls exercised preparation, transcription, scheduled guidance and complete final reports. Those observations are in [backend review](backend-astra-review.md), [actual examples](backend-ai-examples.md) and the [cost ledger](research/muse-cost-ledger.md). New lifecycle/metadata tests do not establish real-room diarization accuracy or current cloud response latency.

## Local development and ownership

Follow the API/frontend READMEs. API development starts local API and media processes; the frontend proxies authenticated HTTP and uses LiveKit for media/events. Each worktree has its own local database. Secrets come from the primary checkout's ignored `.env.local`, an explicit `RALLY_ENV_FILE` or process environment. Paid calls default off. Do not copy runtime databases, model weights, credentials or real meeting records into source archives.

`createApplication()` accepts capability overrides for deterministic tests. Adapters own provider parsing, pacing and accounting. The meeting engine owns lifecycle, evidence and intervention policy. The frontend keeps partial captions transient and refreshes canonical snapshots after relevant events. Delayed completions cannot erase another scoped turn's caption; late partials cannot resurrect finalized words.

Before restarting production, check for live capture/report processing and back up SQLite. Persistent state and secret configuration stay outside immutable releases. Preserve private access while a deliberate judge-access decision remains pending.

## Next human checks

Run the [three-person/device rehearsal](integrated-rehearsal.md) before recording the [demo](demo-script.md). Verify actual capture surfaces, physical voice, cancellation, name corrections, conditional due-outs and report review. Speaker labels are anonymous and scores are model judgments, not calibrated identity or participation measurements.

Teams invitation is a bounded transcription test; WhatsApp guest calling still needs a fresh consented host link, admission and audio validation. Neither is a verified general meeting bot or remote spoken moderator. A usable judge-access path, source visibility/license, contributor verification and finished video remain open. Final submission is on hold.

## Historical implementation and accounting

The initial backend delivery was [`50bfab1`](https://github.com/ejo4041/Rally/commit/50bfab15716e1e5125ac653b4b55d1a95b187e74), with 25 tests and Astra review. Its backend-only deployment/speech follow-ups are superseded by the integrated state above; the dated review remains useful evidence.

Use the [cost ledger](research/muse-cost-ledger.md) and runtime usage view rather than an old balance copied into this document. Recorded estimates do not verify grant application, shared usage or actual Billing balance. Unknown charges block further paid work until reconciled. This documentation update made no model call.
