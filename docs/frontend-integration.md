# Node backend frontend integration

**Deployment update:** The integrated app is now running at its [private HTTPS endpoint](integrated-deployment.md). The local-only deployment paragraphs below describe the original integration checkpoint; use the deployment report for current runtime/access and validation.

Implemented October 29, 2026 from backend main `f080a5f8b6ce6e28a99c3fa45bc054777a58da4b`, following the [frontend API contract](backend-api.md), [AI processing rules](ai-processing.md) and [backend team handoff](backend-team-handoff.md). New frontend: `apps/rally-web`; one-command local launcher: `node scripts/dev-rally.mjs` from the repository root. [Setup](../apps/rally-web/README.md).

## Delivered

A responsive Rally workspace with real cookie authentication, history, Muse agenda preparation and editable plans; LiveKit audio input; finalized transcript and transient captions; session-scoped name corrections; approved guidance, concerns, health, progress and plan-revision announcements; mute/pause/dismiss/end controls; asynchronous report status, explicit retry, evidence-linked due-outs/scores/tips, correction notes, export, deletion and usage inspection.

Room microphone or browser-tab audio can be selected, with optional host microphone mixing. Audio permissions complete before the API is asked to start ASR. Selection failure/cancellation closes all acquired tracks. Stop sharing stops audio and finalizes the meeting. A capture gap stops local capture and requires explicit reconnection. A reload can attach to the existing room; restarting transcription is a separate deliberate action with new speaker-session keys.

HTTP snapshots remain authoritative. Final events upsert by ID and revision; older snapshots cannot overwrite newer local finals or control epochs. LiveKit data is accepted only from the backend participant on the `rally` topic. Only approved `intervention` events appear as prompts; an assessment's recommendation does not bypass server cooldown/host policy. Transient captions are not evidence.

The UI preserves the new backend's model-interpretation semantics rather than porting the old Site's confirmation workflow. Null scores display Unknown; the overall score shows assessed coverage. Owners/dates can remain unresolved. Follow-up tickets/meetings remain drafts. Session expiry/logout removes prior meeting content from the UI.

## Validation

- TypeScript checking and production frontend bundle build pass.
- All 25 unchanged backend tests were rerun and pass.
- Four frontend state tests pass: partial/final separation, deduplication/revisions, approved interventions and control invalidation, session-scoped mappings, and late-snapshot protection.
- Browser integration uses actual Express, SQLite cookie authentication and LiveKit media with synthetic audio and injected model providers. It exercises account isolation, agenda edits/failures, media arrival, live revision/name correction, host controls, normal reload without duplicate ASR, final drain, report failure/retry, background report navigation, saved history/correction/export, tab selection/cancellation/sharing end, explicit gap restart, session expiry and mobile layout. [Recorded result](research/frontend-browser-check.json).
- The production dependency audit reports zero known vulnerabilities. Desktop and mobile screenshots were visually checked; screenshots remain in ignored test artifacts.
- The combined local launcher was exercised on isolated ports/database. HTML, browser bundle, API health and cookie sign-up worked through the proxy. Paid processing stayed off: meeting preparation returned a saved draft with a visible error and zero usage rows. Owned processes were stopped afterward.

These checks establish frontend integration behavior, not real model accuracy, physical microphone behavior or external meeting compatibility. Test providers intentionally return fixtures, including one failed report. The browser test exposes test-control endpoints only in its isolated fixture server; those routes are absent from the production backend.

## Runtime and deployment boundary

The local frontend development server proxies `/api` and preserves HttpOnly cookies. It exposes no provider key. The launcher explicitly defaults `RALLY_PAID_ENABLED` to zero; real processing requires deliberate opt-in plus the existing backend budget/accounting rules. New Muse spend for this integration is $0. The preceding backend ledger remains $0.47338150 tracked total, with actual Billing/grant application unverified.

The existing restricted Sites application remains version 12 and has not been redeployed or migrated. This frontend needs the Node API/SQLite/LiveKit runtime. A remote deployment needs TLS, an API origin/proxy, reachable media ports and preserved access/data boundaries. The local setup is not proof of remote connectivity.

Next: deploy the integrated path, run consenting device and three-person checks, then connect approved Meta MMS speech through the backend media boundary with cancellation/echo validation. Voice generation, platform participant joining and automatic meeting-display-name attribution are not implemented by this frontend. Existing Site-only presenter/audio-check/WhatsApp-sharing features remain available in the older app; they have not been silently claimed as new frontend features. Final hackathon submission stays on hold.
