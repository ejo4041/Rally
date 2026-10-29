# Rally backend MVP — agreed implementation plan

Source: the user-approved planning conversation, October 29, 2026. Backend only; another session owns frontend implementation. Preserve feature scope while keeping implementation appropriate for a hackathon.

## Delivery and repository

Implement in `apps/rally-api/` on branch `rally-backend-mvp`, based on remote main `510bb07e0c8da794c92eb2a9c489d026de5a04d6`. Existing Site and frontend files remain untouched. Merge after verification and reconciliation with concurrent work. Shared secrets remain in the ignored primary checkout `.env.local`, discoverable via the common Git directory with `RALLY_ENV_FILE` override. Separate databases and configurable ports per worktree.

## Stack and boundaries

Node 24, TypeScript, Express, direct SQLite, local LiveKit server. One development command starts API and media server. Use `livekit-client` in the frontend contract, `@livekit/rtc-node` for backend audio, and `livekit-server-sdk` for scoped room access. One room per meeting. Incoming audio is mono PCM16 at 16 kHz. LiveKit carries small status/transcript/guidance events; HTTP supplies authoritative snapshots and history. No Socket.IO, ORM, Redis, distributed queue, or general agent orchestration framework.

Preserve the capability contracts in [model interfaces](model-interfaces.md). Adapt existing model/accounting/evidence code where useful. A narrow Muse adapter handles diarization and timestamps; the official LiveKit Meta plugin lacks those required capabilities. Keep partial captions distinct from finalized evidence. Bound buffers, report gaps, and never replay stale microphone audio after reconnect.

## Required behavior

- Username/password signup/login/logout, hashed passwords, opaque cookie sessions, seeded demo accounts, and owner-isolated history. One active meeting per host, configurable five-meeting server capacity.
- Agenda/objective and duration produce an editable plan with topics, intended outcomes, pacing, and wrap-up allocation. Host review precedes recording consent/start.
- Live transcription persists finalized turns, timestamps, anonymous speaker labels, and optional name corrections. Raw audio is transient.
- Every approximately ten seconds, when transcript or pacing changes warrant it, Spark minimal assesses health 0–5, concerns, evidence, progress, optional intervention and plan revision. One assessment in flight per meeting. Ordinary interventions have a sixty-second cooldown; host requests and wrap-up can bypass it. Both settings are environment configurable.
- Rally autonomously reorders, parks, rebudgets, and extends topics, announcing changes. Preserve original and revised schedules. Scheduled end triggers active winding down rather than cutting off recording.
- Host pause/resume, dismiss, override and end controls invalidate stale interventions. Pausing moderation leaves transcription running.
- End saves the full transcript, then starts an in-process background maximum-effort Spark report. Persist processing/ready/failed status and notify connected users. A failed/interrupted report can be explicitly retried after accounting reconciliation; no durable job infrastructure.
- Reports contain summary, decisions, due-outs, unresolved questions, stated owners/deadlines, evidence, optional ticket/follow-up-meeting suggestions, five category scores and speaker tips. No external actions or mandatory confirmation workflow. Model interpretations must not be labeled as host confirmations.
- Score goal progress, focus, pacing, actionable outcomes, and participation from 0–5 with evidence. Average assessable categories; unknown is not zero. Give at most two concrete behavioral tips per attributable speaker, including anonymous labels. No personality judgments or equal-airtime requirement.
- History, retrieval, correction, export and deletion. Preserve usage records after content deletion.

## Simplicity and essential checks

Active meetings use an in-memory map and timers. Store transcript and usage as rows; plans, assessments and reports may use JSON. Use explicit retry after failures rather than transparent crash recovery. Retain ownership checks, consent, bounded audio, output/evidence validation, host cancellation, and cost tracking.

Paid calls default off. Configurable estimated caps: $2 per meeting, $5 cumulative backend usage, $0.15 initial real-service smoke batch. Follow [budget policy](api-budget.md), reserve/reconcile actual model settings and costs, and preserve unknown charges. Never claim a conditional grant remainder is verified Billing balance.

## Accepted testing seams

Public HTTP authentication/meeting/history/report APIs; LiveKit room/audio boundary; normalized model adapter boundary. Focus on ownership isolation, persistence, concurrent hosts, transcript/speaker events, pause/end cancellation, scheduling, complete-transcript reporting, and accounting. Use red/green vertical slices and injected provider adapters, not internal implementation tests. Run focused tests and typecheck during development, full suite at the end, then Standards and Spec reviews against this baseline and document findings/fixes.

## Documentation and later scope

Save the AI processing overview/diagram, frontend API contract, streaming research and test evidence in docs; maintain index, glossary and handoff. Spoken agenda entry, generated TTS, Teams integration, outgoing video, frontend implementation and deployment remain later work. Existing Teams audio evidence is relevant but does not establish full spoken moderation. Future speech must respect current model/event requirements, not outdated provider assumptions.

## Acceptance

A user logs in, prepares a meeting, streams speech, receives useful autonomous guidance, ends it, and retrieves the persisted scored report later. Real-service evidence must be distinguished from fixtures and untested device behavior.
