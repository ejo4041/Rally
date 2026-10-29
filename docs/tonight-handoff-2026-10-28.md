# Rally — tonight handoff, October 28, 2026

**Latest October 29 build:** [Retrospective Teams review, measured Meta MMS speech, and submission audit](overnight-build-2026-10-29.md). Source changes are tested locally; deployed Site is still version 7. Live Teams/MMS playback validation remains pending.

**October 29 offline checkpoint:** [Teams saved-history implementation, tests, documentation and Git state](offline-progress-2026-10-29.md). New history code is local, not deployed. Live pacing-fix retry remains pending; no live test or paid call was run tonight.

Start here when resuming from home. This note supersedes earlier “morning”, ACS-required, publication-blocked, and “first integrated live test still pending” descriptions where they conflict. Keep the detailed research reports as history.

## Resume prompt

> Read AGENTS.md, docs/tonight-handoff-2026-10-28.md and docs/handoff.md. Resume Rally from this checkpoint. First help me run a fresh consented Teams transcription test to validate the server pacing fix, without removing the three-minute cap. Do not reuse a stored meeting invite or start paid processing automatically.

## Account and session context

Eric confirmed that the daytime/local conversation is on his **work account**, while the Codex session on this DigitalOcean droplet uses his **personal account**, which owns Rally's Sites project. The local connection could see only AI Operations in Veilant and could not publish Rally across the workspace boundary. Viewer sharing did not solve editing access. At the user's explicit request, we submitted the staged deployment to the existing idle personal Codex session on the droplet; it successfully published version 7 using its own supported Sites tools. No account authentication was extracted or transferred. Use the personal session for future Sites changes; no replacement Site is needed.

The existing session is `hack` user's tmux session **team**, pane **team:0.0**, working directory `/srv/hackathon/repo`. It is idle after its deployment turn; its last chat answer predates the subsequent live test, pacing fix and updated costs. **Read these files rather than relying on that last answer.** No further task has been submitted to it by this handoff.

Droplet: `165.245.162.212`. From a root console: `sudo -iu hack`, then `tmux attach -t team`. From an existing hack shell, use the tmux command directly. A key-only SSH listener exists on port 443 because port 22 was blocked from the work network. Port 443 firewall rules were restricted to the known work/VPN egress addresses; a different home address may require the DigitalOcean console or an explicit firewall allowance. Existing SSH access and passwordless hack sudo are already configured; no credentials belong in this document.

## Current product and deployment

**Live URL:** https://rally-meeting-moderator.excavator3496.chatgpt.site

Published app: `apps/rally/`, Worker ESM + D1. Do not create another Python product backend. Existing local-microphone Rally moderation/walkthrough functionality remains separate from the Teams transcription-only POC.

- Sites project: `appgprj_6ae17976c3c88191a5b2627b0187e484`.
- Current native version **7**, source commit **376089c7587b1c0857f67909bb813493ee7cd5bc**.
- Saved version: `appgprj_6ae17976c3c88191a5b2627b0187e484~appgver_939072c114508191910e95820aaf15dd`.
- Deployment: `appgdep_6ae255d0ac74819195c3f137011414be`, succeeded; environment revision **6**.
- Existing custom/restricted shared audience is preserved. Use the Sites skill and supported source-helper/save/deploy workflow from the owning account for future hosted edits.
- Additive migration **0002_teams_transcription** is applied. Do not rewrite already-applied migrations.

The normal Teams browser guest on Ubuntu has proved real meeting join and two-way audio. The host explicitly admitted it and confirmed hearing offline diagnostic speech; incoming speech was measured through both browser and virtual speaker. **No ACS resource, custom app registration or Graph app permission is needed for this normal guest route.** The old ACS implementation is an optional alternative, not a prerequisite. Teams tenant guest policies and lobby admission still apply.

The WebUI now accepts a Teams invite under **Invite Rally to Teams**, with participant consent and a separate **Transcribe this test** checkbox. It shows partial/final text and incoming level, offers **Leave meeting** and transcript download. A hard **three-minute job deadline includes preparation and lobby time**. Closing the page does not stop the participant. The latest Teams transcript is separate from the main meeting-history UI; download it before starting another test. Raw audio is streamed, not saved by this POC.

## Latest live result and apparent crash

After deployment Eric tried it through the Site and said it was working great, then seemed to crash within a few minutes. He suggested it might have been the three-minute limit. Investigation established:

- Job created **20:11:28.970 UTC**, deadline **20:14:28.970 UTC**.
- Browser stopped **20:14:02.362 UTC**; failed job update **20:14:02.437 UTC** — about **26.5 seconds early**, after ~153 seconds total.
- Host Leave was not requested. ASR usage: **128.62 seconds sent**, **128.64 seconds reported processed**, `teams_asr_failed`. Two finalized turns remained saved.
- Queue runner did not crash: active with zero restarts; browser unit stopped successfully; RAM was ample.
- Previous logs lacked the specific ASR/provider/buffer exit reason. The exact historical cause is **not proven**; do not relabel this as a confirmed normal timeout or confirmed Meta outage.

We found a real sender defect: exactly one 20 ms audio frame was sent per timer callback. Slight timer delays accumulate against fixed-rate Pulse capture and can fill the two-second audio buffer. An offline 20.35 ms timer simulation reproduces the old overflow within 150 seconds. This fits the symptoms but does not prove the original trigger.

**Fix applied directly to the server experiment:** scheduling now follows elapsed monotonic time, catches up in bounded batches, and never outruns real time or the session cap. The same simulation stays within two frames. Added sanitized lifecycle/termination reasons, WebSocket close code, safe provider error code, maximum pending bytes and sent/processed duration. Meeting links, tokens and transcript text are not logged.

Changed files under `experiments/teams-web-client/`: `audio-pacing.mjs` (new), `transcribe.mjs`, `transcribe.test.mjs`, `runner.mjs`. These server changes are **later than** the version-7 hosted app commit; publishing the old app artifact is not how to deploy or restore this runner fix. Previous server files were backed up under ignored `test-results/incident-20261028-pacing/`. The pacing fix is loaded in the running service. One final browser-startup diagnostic-label correction was written after its restart and takes effect at the next normal restart; it does not change audio behavior.

Four offline adapter/pacing tests pass: frame cap/final drain, cancellation, handshake accounting and timing-drift regression. Earlier app validation passed 19 backend tests, mocked Teams UI including safe rendering/mobile/download/Leave, and the full walkthrough browser regression. No live meeting or paid call was started to test the fix. **A fresh integrated live retry after the pacing fix remains the immediate next step.**

## Service state and operation

Verified at **20:32:51 UTC / 4:32:51 PM Eastern, October 28**:

- `rally-teams-web-runner.service`: **active**, zero restarts; queue consumer for normal browser + optional ASR.
- `rally-teams-web-client.service`: **inactive**; browser/private audio only starts for a fresh UI request.
- `rally-teams-runner.service`: **inactive**; old ACS consumer.
- Protected production status: **online=true, transport=teams-web, transcriptionReady=true**, no active job. Last job still says failed, as expected for the historical test; this does not mean the current runner is offline.
- Both queue units are **disabled for boot**. New runner is manually active. A reboot will require starting the chosen normal runner manually.

Run these as hack, with `XDG_RUNTIME_DIR=/run/user/1000` if needed:

```bash
systemctl --user status rally-teams-web-runner.service
journalctl --user -u rally-teams-web-runner.service -u rally-teams-web-client.service --since '20 minutes ago' --no-pager
```

If stopped, start the normal queue unit with `systemctl --user start rally-teams-web-runner.service`. Never run the old ACS queue consumer at the same time. If restarting or switching runner identity, first verify no active job and allow the 30-second lease to expire (we waited 32 seconds). Do not restart over an active meeting. The browser has its own absolute departure guard in addition to runner cleanup.

Adapter tests, no network/model calls:

```bash
cd /srv/hackathon/repo/experiments/teams-web-client
/srv/hackathon/tools/node/bin/node --test transcribe.test.mjs
```

Private Pulse sink/source and Chromium debug port are loopback/private; do not expose them for this workflow. Ignored `.env.local` at the repo root already contains the model key, runner origin, bridge secret and Sites runtime service token. Keep values out of chat, source and Markdown. No npm packages were downloaded for this work; any future downloads must use **nexus.rinet.io**, preserving existing auth/config, never public npm fallback.

## Next session: smallest useful test

1. Open the Site, refresh, paste a fresh Teams invite, confirm both consent choices, invite Rally and admit **Rally audio test**. Do not reuse the old stored link automatically.
2. Speak a short known sentence and verify partial/final text and level. Keep the session alive long enough to exercise the previous failure window, then check deliberate Leave/final drain or the expected absolute three-minute departure.
3. Watch the new termination log and confirm the participant disappears from the Teams roster. If it fails, retain the new specific reason/metrics before changing anything. Download the transcript and reconcile the single ASR usage record by stable ID.
4. Only after this is reliable, feed finalized Teams turns to the existing evidence-backed moderator. Begin with text suggestions/host confirmation, then add short spoken interventions using the proved virtual microphone, echo rejection, host mute/override and cooldown.
5. Add Teams sessions to main history and test repeated joins/tenant policies. Increasing the POC duration is a separate deliberate change to backend, UI, browser/runner guards and cost caps, not a fix for the early failure.

Spoken moderation, echo handling and named-speaker verification are **not implemented for this Teams POC**. Existing local-microphone moderation must not be mistaken for a tested Teams moderation loop. Rebuild the submission export later so it includes the latest normal-client work; older export snapshots predate these changes.

## Costs and accounting

Read `docs/api-budget.md` before paid work. Conserve the $150 hackathon grant for the week and final demos; no automatic retries or Contributor-mode switch.

- First user Teams test: **$0.00640000 estimated**, reconciled once by stable usage ID.
- Prior standalone synthetic ASR proof: **$0.00035000**, already included.
- Deployment, incident investigation, offline fix tests and this handoff: **$0 additional model cost**.
- Tracked cumulative: **$0.15263115**, unknown entries **0**.
- Conditional remainder: **$149.84736885**, assuming the full $150 grant and no untracked/shared usage. Actual Billing/grant is still unverified.
- Current hosted D1 spend **$0.07776505** plus external baseline **$0.07486610** equals the tracked total. Do not put the full ledger total into the external baseline or count hosted usage twice.
- A full three-minute ASR test is estimated at **$0.009**. Durable reservations and idempotent finish records are implemented; unresolved charges block further paid sessions until reconciled.

The user expects cost reporting after paid batches. Reconcile new protected `/api/usage` records into `docs/research/muse-call-log.jsonl` by stable usage/request/session IDs, update the cost ledger, report batch + tracked total + conditional remainder and any unknowns.

## Authoritative supporting notes

- [First live incident, evidence and fix](research/teams-transcription-first-live-incident.md).
- [Published version 7, verification, identity and rollback](research/teams-transcription-deployment-result.md) — its pre-live-test cost/status is historical.
- [Normal-client real two-way audio evidence](research/teams-web-client-spike.md).
- [Staged implementation design](research/teams-transcription-poc.md) — publication blocker is resolved.
- [Latest read-only runtime snapshot](research/teams-transcription-tonight-handoff-check.json).
- [Cost ledger](research/muse-cost-ledger.md), [sanitized usage](research/muse-call-log.jsonl), [budget](api-budget.md).
- Scope before new features: [roadmap](rally-roadmap.md), [interview decisions](planning-interview.md), [participant guide](hackathon-participant-guide.md).
