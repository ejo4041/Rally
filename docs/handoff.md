**Streaming speech work in progress:** [implementation checkpoint and remaining work](streaming-speech-plan.md). Isolated worktree; implementation and public ingress checks in progress.

# Rally handoff — October 30 current checkpoint

The integrated Node app is deployed from `9202d1f` at [Rally](https://rally.tail703f9e.ts.net:8445). It requires Tailscale and its own app login. Source is pushed to `main`. The older restricted Sites app remains a separate release; do not mix its presenter, confirmation or demo-clock controls with the Node workflow.

## Working now

The host prepares an agenda, captures their microphone or a selected meeting tab, and receives Muse-finalized transcripts and approved guidance through self-hosted LiveKit. Muse Voice Transcribe supplies the transcript; native Teams/Zoom/WhatsApp transcripts are not used. Reports analyze the complete final transcript and distinguish reported agreement, proposal and unresolved outcomes. Source links, correction notes, saved history, export, nullable scores and explicit paid retries are implemented.

New overnight work:

- [Meta MMS speech](integrated-speech.md): approved prompt IDs/epochs, offline pinned local voice, optional host-browser playback, free fixed-phrase voice test, Stop/pause/dismiss/end cancellation, bounded input shielding and text fallback. Compatible MMS checkpoint configuration is validated against adapter provenance and actual local model files.
- [Speaker correction](speaker-attribution.md): anonymous session numbers, reversible host labels, no-op saves, processing conflict protection, stale-report warning and explicit reanalysis. Host annotations survive regeneration separately from model evidence; older correction segments retain a legacy marker.
- [WhatsApp follow-up drafts](integrated-whatsapp-follow-up.md): host-selected report rows, preserved uncertainty, editable text, Copy and manual WhatsApp handoff. No recipient is preselected and no message was sent by tests.
- The WhatsApp guest prototype closes late browser launches after cancellation and applies its deadline during startup; four local tests and isolated audio routing pass. Actual guest admission is still pending.
- Voice playback coverage windows are saved as upper bounds and shown as a report caveat; they are not evidence of participant silence.
- Delayed moderator controls/prompts from older epochs cannot undo Resume or replace current guidance.
- Scoped live captions survive older asynchronous completions; late partials cannot resurrect finalized words. Legacy unscoped adapters retain their existing clear-on-final behavior.
- [Updated demo script](demo-script.md), [longer show-and-tell/pitch](show-and-tell-script.md), [human rehearsal packet](integrated-rehearsal.md) and [submission/access observations](research/submission-access-check-2026-10-30.md).

## Validation and running check

50 backend tests, nine frontend tests, both TypeScript checks and the frontend build pass. Fifteen separate MMS adapter/output/queue tests pass; [real cancellation/recovery](research/mms-cancellation-recovery-check.json) and the [real-MMS browser workflow after the ownership fix](research/mms-ownership-browser-check.json) pass. The full local HTTP/SQLite/LiveKit browser workflow passed with synthetic ASR/reasoning providers and actual pinned MMS speech. [Real speech/browser evidence](research/integrated-speech-browser-check.json) and [follow-up workflow evidence](research/integrated-follow-up-browser-check.json) identify test boundaries.

[Deployed HTTPS verification](research/mms-ownership-release-deployed.json) passes real MMS playback/Stop, distinct anonymous sessions, host name correction, stale warning, draft construction and annotation export. The setup used a temporary account and synthetic records, which were removed. No WhatsApp link was opened and no paid model call was made by these checks. Existing provider spending/Billing observations are separate; use the runtime usage view and [cost ledger](research/muse-cost-ledger.md).

An eight-hour local MMS reliability process started October 30 at 04:09 UTC, with a synthetic phrase every 30 minutes and periodic worker reloads. It is **running**, not an eight-hour pass, at this checkpoint. It reached a successful three-hour sample at 07:09 UTC. This process loaded the adapter before the later stale-worker ownership correction; that correction is validated separately and is not covered by the eight-hour claim. Its ignored local report is `experiments/meta-mms/test-results/overnight-check.json`; command and limits are in [integrated speech](integrated-speech.md). Do not terminate it as an abandoned browser fixture.

The refreshed local archive from `5e3da10` contains 404 filtered source files. Its [source draft/privacy manifest](research/latest-source-draft-archive-check.json) and [clean-archive reproduction](research/latest-source-draft-reproduction-check.json) pass: 50 backend, nine frontend and four WhatsApp prototype checks, type checks, build and the complete synthetic-provider browser workflow. The archive is local only; source is not claimed public. Earlier `3317f1f` archive evidence is retained as historical.

[ASR handoff work and bounded capture experiments](asr-session-handoff.md) correct planned session continuation, pause, failure and ownership. The [two-hour MMS checkpoint](research/mms-soak-two-hour-checkpoint.json) remains a running eight-hour test, not a final pass.

## Next work and boundaries

1. Read the running soak result; investigate a failure before claiming reliability. Record its final state when it completes around 12:09 UTC.
2. Rehearse with actual people/devices. Verify microphone/remote input, physical voice, cancellation, transcription quality and the complete report. Speech plays to the host; remote callers hearing it is not established.
3. Supply a fresh consented WhatsApp guest link for admission/audio validation. The [prototype](whatsapp-guest-prototype.md) passes isolated local routing but is not an enabled deployed invite connector. The existing [Teams invite](teams-integrated-ui.md) remains a bounded transcription-only guest test and needs a fresh pacing/live retry.
4. Resolve anonymous repository access (currently 404), source-license choice and usable judge access. The private Tailscale deployment is not public judge access. Keep real records protected.
5. Record the three-minute demonstration after rehearsal. The ending can explain the future meeting-platform vision; that platform is not implemented. Final submission and external publication remain on hold.

## Engineering entry points

[Backend team handoff](backend-team-handoff.md), [API/streaming contract](backend-api.md), [AI processing](ai-processing.md), [actual AI examples](backend-ai-examples.md), [model interfaces](model-interfaces.md), [frontend setup](../apps/rally-web/README.md) and [deployment/rollback](integrated-deployment.md).

Work this checkpoint used `/srv/hackathon/rally-whatsapp-guest` on `rally-spoken-guidance`, fast-forward pushed to remote `main`. Runtime services are `rally-integrated-api`, `rally-integrated-web` and `rally-integrated-media`. Persistent SQLite and secret configuration stay outside immutable releases under `/srv/hackathon/rally-deployed`. Check for live meetings/report processing and back up SQLite before an API restart. Never expose credentials or replace the tailnet-only media setup without an explicit access decision.

## Historical records

Earlier Sites release: [version 12](releases/2026-10-29-v12.md), [October 29 morning reliability](morning-reliability-2026-10-29.md), [October 28 incident/handoff](tonight-handoff-2026-10-28.md), [remote access](remote-access.md). Backend initial delivery/review: [implementation status](backend-implementation-status.md), [Astra validation](backend-astra-review.md). Historical status and cost figures in those records are dated observations, not the current deployment or verified Billing balance.

## Teams MMS output preparation

[Teams MMS output](teams-mms-output.md) is installed in the idle normal Teams runner from source `22c3671`, with the diagnostic disabled. Nine offline checks and a real-MMS disposable virtual-microphone measurement pass, including Stop/silence and incoming-audio isolation. No meeting was joined. A fixed diagnostic can be explicitly enabled for the next live trial; automatic agenda-based spoken replies still need a live moderation connection.
