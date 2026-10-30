# Rally backend MVP — team handoff

**Current integrated checkpoint:** release `a8b9423` is deployed; source is pushed to `main`. [Current handoff](handoff.md) covers the Node frontend, local MMS voice, reversible speaker attribution, durable host notes and reviewed WhatsApp drafts. 38 backend and seven frontend tests pass. The initial backend-only status below is historical.

Backend MVP implementation and Astra review fixes are complete and pushed to `main`. Implementation checkpoint: [`50bfab1`](https://github.com/ejo4041/Rally/commit/50bfab15716e1e5125ac653b4b55d1a95b187e74). This document and the linked current docs are the backend handoff; older product release notes describe the separately hosted Sites application.

## Start here

- [Setup and commands](../apps/rally-api/README.md): Node 24, npm, shared local secrets, demo accounts and local services.
- [Frontend integration contract](backend-api.md): authenticated HTTP endpoints, LiveKit connection, transcript/guidance events and report retrieval.
- [AI processing diagram and rules](ai-processing.md): user agenda → internal agenda → live checks → final report.
- [Actual AI examples](backend-ai-examples.md): terse and detailed agendas, due-outs, scores with transcript evidence, and speaker suggestions.
- [Testing and Astra review](backend-astra-review.md): what was exercised, defects fixed, costs and remaining limitations.
- [Streaming decision](research/backend-streaming.md): why LiveKit and the boundary between media transport and Muse.

## Delivered

The backend lives in `apps/rally-api/`. It uses TypeScript/Node, Express, a local SQLite database, and LiveKit for bidirectional audio and live text/JSON events. The backend connects to Muse transcription with `ws`; provider keys stay server-side.

Implemented: signup/login/demo users; private per-user meetings/history; AI agenda preparation and edits; consented audio capture; stored finalized transcripts and speaker labels; scheduled guidance and agenda changes; host pause/resume/dismiss/end; full-transcript background reports with decisions, due-outs, scores and tips; correction notes, export, deletion and preserved usage accounting.

From `apps/rally-api/`, follow the README to run `npm ci`, `npm run setup:media`, `npm run seed` and `npm run dev`. The development command starts API and media server. Paid calls default off. Secrets are read from the primary checkout's ignored `.env.local` or `RALLY_ENV_FILE`; each worktree has its own local database. No credentials or database contents are committed.

## Verified

- **25 automated tests pass**, plus TypeScript checking.
- Real Chromium/LiveKit tests passed audio in both directions, JSON events, mute/unmute, browser reconnect and backend reconnect.
- Real Muse calls exercised agenda generation, audio transcription, scheduled guidance and complete final reports.
- Three Astra agents reviewed correctness, media behavior and AI quality. Concrete lifecycle/reconnect defects were reproduced, fixed and retested.

## Frontend integration follow-up

The [Node API frontend](frontend-integration.md) is now implemented separately in `apps/rally-web`, with authenticated HTTP/LiveKit wiring and isolated browser integration evidence. The existing Sites app remains unchanged. Deployment, generated speech and a consenting human meeting rehearsal remain open. The earlier next-work paragraph below records the backend handoff state.

## Next integration work

Frontend wiring, deployment and a consenting human meeting rehearsal remain separate tasks. The existing private Site was not changed or redeployed by this backend work. Spoken agenda entry, generated moderator speech and Teams/video integration remain agreed follow-ups.

ASR can mishear names and split speakers incorrectly; speaker labels are not verified identities. Scores and tips are evidence-linked model judgments, not calibrated objective measurements. The final coaching/scoring wording was refined after manual review but has not received another paid evaluation. Final reports run asynchronously and expose processing/failed status; the frontend must handle both. No tickets or calendar events are created automatically.

## Accounting

Cumulative tracked estimate: **$0.47338150**. Conditional remainder against an assumed $150 grant: **$149.52661850**. Unknown recorded charges: **0**. Actual grant application, shared usage and Billing balance remain unverified. See the [cost ledger](research/muse-cost-ledger.md). This documentation handoff made no additional model calls.
