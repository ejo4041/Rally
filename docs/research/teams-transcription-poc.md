# Teams transcription POC — staged implementation and deployment handoff

Updated 2026-10-28. User requested transcription and pasting a Teams invite into the existing Rally Sites UI. This work extends the previously demonstrated normal Teams browser guest route. No ACS resource or custom app registration is required for that route.

**Publication completed by the owning session:** [Version 7 deployment result](teams-transcription-deployment-result.md) supersedes the staged/publication-blocked status below. The normal queue runner is now active; protected production status and UI verified. No integrated real meeting/transcription test was initiated by deployment.

## Current outcome and evidence

- Real Meta streaming ASR passed using one offline synthetic sentence: “Rally transcription test. Andrew will send the project proposal by Friday.” No meeting audio was sent in this batch.
- Adapter sends real-time PCM16 mono 16 kHz in 20 ms frames; no automatic model retry; hard three-minute ceiling; cancellation kills capture, drains final text and closes the socket.
- Candidate backend and UI support a link-only guest join, explicit transcription consent, lobby/connection state, live partial/final text, persisted transcript and text download, and Leave.
- ASR starts only after Teams WebRTC and an in-meeting Leave control indicate admission. It never starts in the lobby. The three-minute job deadline includes preparation and lobby time.
- Paid reservation is durable before opening ASR. Unknown/in-progress usage blocks additional paid sessions. Final usage is idempotent and uses conservative whole seconds from the larger of sent duration and provider progress. Transcript turns are deduplicated and rendered as text.
- Backend suite: 19/19 tests pass. Adapter suite: 3/3 offline tests pass. Mocked Teams browser UI passes link/consent/text/XSS-safe rendering/download/mobile/Leave/retention checks. Existing full browser walkthrough regression also passed without paid calls.
- The candidate queue runner has not been exercised end-to-end against a published Site and a real Teams meeting. A fresh consented live test is required after deployment. The earlier standalone browser test established actual two-way meeting audio, not this new queue integration.

## Exact staged locations

- Candidate app source: `/srv/hackathon/repo/experiments/teams-web-poc-site/`.
- Reviewable patch: `/srv/hackathon/repo/experiments/teams-web-client/site-transcription.patch`.
- Server adapter/runner: `/srv/hackathon/repo/experiments/teams-web-client/{runner,transcribe}.mjs`.
- New inactive user unit: `/home/hack/.config/systemd/user/rally-teams-web-runner.service`.
- Existing service `rally-teams-runner.service` remains the active ACS implementation until the compatible Site is published. Do not run both queue consumers together.
- Production app checkout `apps/rally/` has not been modified. Candidate dependencies are a symlink to its existing installation; do not archive that symlink as a deployment artifact.
- No npm packages were downloaded. Any future downloads must use the configured Nexus registry.

## Publication blocker and account boundary

The work account's Sites connection lists a different workspace and returns NOT_FOUND for Rally's project. User confirmed the accounts are members of different workspaces. Cross-workspace viewer sharing does not grant Site editing; supported editor collaboration requires same-workspace membership. Continue publication from the owning account/workspace, or use a real member of that same workspace with editor access. Do not create a replacement Site or reuse/extract another session's account tokens.

Existing URL: https://rally-meeting-moderator.excavator3496.chatgpt.site
Preserve its custom/restricted audience and existing runtime secrets.

## Owning-workspace deployment procedure

1. Use the Sites skill: get the existing Site and write credential, then open the supported source helper before editing. Reconcile the latest opened source with the staged patch; do not replace the checkout wholesale. The patch passes `git apply --check` against the retained server source snapshot.
2. Apply the patch in that opened checkout. Append migration 0002 and its journal entry; never edit already-applied migrations. Build, run `node --test tests/*.test.js`, validate/package the artifact using the installed Sites helpers, push the exact source, save a version and deploy it while preserving the custom audience. Do not use owner-private publishing for this shared Site.
3. Verify protected production endpoints and migration success before switching runners. Ensure `RALLY_PAID_ENABLED=1`, existing MODEL_API_KEY and bridge secret remain set. Existing server `.env.local` already holds the runner origin, Sites service token, bridge secret and model key; do not print them or put them in source.
4. Stop the old ACS user unit, allow its 30-second lease to expire, run `systemctl --user daemon-reload`, then start the new `rally-teams-web-runner.service` as hack with `XDG_RUNTIME_DIR=/run/user/1000`. Initially keep this a manually started POC service; enable it only when appropriate. Rollback is stop new runner, wait lease expiry, restart old unit, and deploy the prior saved Site version if necessary.
5. Test host-only first: paste the link, confirm participant consent and select transcription, admit “Rally audio test”, speak a short known sentence, verify partial/final text and level, select Leave, verify Rally disappears from the roster and the final words remain downloadable. Confirm D1 usage matches one bounded ASR session. Then exercise automatic three-minute departure and network-loss cleanup before longer use.
6. Reconcile all new `/api/usage` records into the sanitized cost log by stable usage/request/session IDs. Do not double count hosted usage already included there. ASR reservation left unknown after a crash must be reconciled before new paid work.

## Costs and limits

One synthetic ASR session sent 7.78 seconds, provider reported 7.84 seconds. Estimated batch cost **$0.00035000**. Reconciliation added 16 earlier hosted usage events totaling **$0.07126505**; those were prior activity, not new calls in this batch. Tracked cumulative estimate is **$0.14623115**, with zero unknown entries in the reconciled ledger. Conditional remainder of the assumed $150 grant is **$149.85376885**; actual grant and Billing balance remain unverified.

At $0.18/hour, a full three-minute transcript is estimated at $0.009. Pricing reference: https://dev.meta.ai/docs/pricing-rate-limits . A suitable baseline for the current hosted cost display is **0.07486610** (= previous external baseline 0.07451610 + this external synthetic probe 0.00035000); hosted D1 currently accounts for the other 0.07136505. Recheck runtime usage before changing this number. Do not set the baseline to the full ledger total, which would double count hosted calls.

The UI displays the latest Teams job's stored transcript; it is not yet merged into the main Your meetings history. Download it before starting another test. Raw meeting audio is streamed and not saved. Moderation, spoken interventions, echo suppression, and speaker identity are separate next steps, not verified by this transcription work.

## Recommended next POC increments

1. Publish and validate one consented live Teams transcript through the UI.
2. Feed finalized Teams turns into Rally's existing evidence-backed moderator; begin with text suggestions and explicit host confirmation of outcomes.
3. Reuse the proven virtual microphone for short spoken interventions, with echo rejection, host mute/override and a clear speaking cooldown.
4. Add Teams sessions to the shared meeting history and establish reliable repeated joins across meetings and tenant policies.
