# Teams live-transcription POC — deployed

Completed October 28, 2026 using this session's existing signed-in Sites owner account/workspace. No other agents were spawned. The existing restricted shared audience is preserved exactly. No substitute Site, account credential transfer or owner-private publication was used.

## Ready-to-use result

Open **https://rally-meeting-moderator.excavator3496.chatgpt.site**. In **Invite Rally to Teams**, paste a fresh work/school Teams meeting invite URL, confirm participant consent, check **Transcribe this test** to consent to sending audio to Meta and storing the transcript, and select **Invite Rally**. Admit **Rally audio test** from the lobby. Live text appears after admission. Select **Leave meeting**, then download the transcript before starting another test.

The participant uses the normal Teams browser guest route on the existing Ubuntu host. **No ACS resource or app registration is required for this POC.** Teams guest policies and host admission still apply. A hard three-minute job deadline includes preparation and lobby time. This preview is transcript-only: it does not provide spoken moderation, named-speaker verification or integration into the main meeting history.

## Exact deployed identity

| Item | Value |
| --- | --- |
| Site/project | `appgprj_6ae17976c3c88191a5b2627b0187e484` |
| Source checkout | `/srv/hackathon/repo/apps/rally` |
| Source commit | `376089c7587b1c0857f67909bb813493ee7cd5bc` |
| Native saved version | **7** |
| Saved version ID | `appgprj_6ae17976c3c88191a5b2627b0187e484~appgver_939072c114508191910e95820aaf15dd` |
| Deployment | `appgdep_6ae255d0ac74819195c3f137011414be` |
| Native status | `succeeded` |
| Environment revision | **6** |
| Audience | Existing `custom` policy, revision 1; exact before/after policy comparison unchanged |
| Archive | `/tmp/rally-teams-transcription.tar.gz` |
| Archive hash | `sha256:d70eff7c09c59bc281012c228c015ad835729e9ff59ea3303fbcc8c6c25a18bd` |

Opened the latest hosted source with the supported Sites source helper before editing. It matched retained version-6 commit `07c06a1150655d245ca25b77e99b1b0441167cbf`. The staged `experiments/teams-web-client/site-transcription.patch` applied cleanly; the candidate directory was not copied wholesale. The helper committed/pushed and packaged that exact source. Publication used **save_site_version → deploy_site_version**, appropriate for the restricted shared Site.

No npm installation/download was needed. Existing Nexus registry configuration/authentication was not changed. The artifact contains the Worker, hosting manifest and migration files only; no candidate `node_modules` symlink, dependency tree or configured secret was included. Source checkout is clean at the recorded commit.

## Migration and hosted checks

- Added `0002_teams_transcription.sql` and appended its journal entry. Applied migrations `0000_rally` and `0001_teams` are unchanged.
- Native deployment succeeded. Supported live D1 inspection confirms new `teams_runner.transport`, `teams_runner.transcription_ready` and `teams_jobs.transcribe`, `transcript`, `partial`, `transcription_state`, `usage_id` columns.
- Protected production API responded successfully before changing runners; no active Teams job existed.
- Protected production `/api/teams/status` after switching reports **online=true, transport=teams-web, transcriptionReady=true**. `credentialsConfigured=true` represents the normal-client transport readiness, not configured ACS credentials.
- Actual rendered production UI verifies the runner is online, transcription option enabled, ACS setup hidden, fresh meeting-link input blank and both consent checkboxes unchecked. QA blocked all POSTs and external-origin requests. It did not join or transcribe anything. An initial UI assertion expected a different copy string; that QA assertion was corrected to the actual published lobby guidance, then passed. No product change was needed.
- Read-only before/after `/api/usage` checks show the same **17 usage IDs**, unchanged hosted cost and no unknown entries.

Evidence: [preflight](teams-transcription-preflight-check.json), [migrated API](teams-transcription-migrated-check.json), [pre-switch check](teams-transcription-preswitch-check.json), [ready API](teams-transcription-ready-check.json), [hosted UI](teams-transcription-hosted-ui-check.json). Local screenshot is ignored under `apps/rally/test-results/teams-transcription-hosted.png`.

## Runner switch

No active job was present at the final pre-switch check. Stopped **rally-teams-runner.service** (old ACS consumer), verified both queue consumers inactive, waited **32 seconds** for its 30-second lease to expire, reloaded systemd user units and started **rally-teams-web-runner.service** as `hack` with `XDG_RUNTIME_DIR=/run/user/1000`.

Verified after startup:

- Normal queue runner **active**, zero restarts during verification.
- Old ACS queue runner **inactive**.
- Meeting browser unit **rally-teams-web-client.service inactive**: no meeting browser or audio capture was launched by deployment.
- New queue runner remains **disabled for automatic startup**, per the POC instruction. The old ACS unit was also disabled after successful switch to prevent automatic reversion on reboot. Neither queue consumer is enabled at boot; the new runner is manually active now.
- No two queue consumers ran together. Local QA preview was stopped; the intended normal queue runner remains active.

The browser session's old stored meeting link was not opened. The queue runner only launches after a fresh Site job is explicitly submitted; it never resumes/rejoins an old request after restart.

## Checks rerun against reconciled source

- **19 backend tests pass**, including admission/consent gates, durable usage reservation, deduplicated transcript, drained finals, idempotent finish and budget refusal.
- **3 offline adapter tests pass**: real-time 20 ms frame cap, cancellation/final drain and unknown handshake accounting.
- Mocked Teams UI test passes: consent, live text, XSS-safe rendering, transcript download, mobile layout, Leave and retained text.
- Existing full browser walkthrough regression passes with zero model usage.
- Worker artifact validates as ESM; earlier migrations unchanged; archive secret/symlink scan passes.

## Costs

**Deployment/verification batch: $0.00000000. No Muse requests, Teams joins or transcription sessions were initiated.**

Last reconciled tracked estimate remains **$0.14623115**, unknown **0**. Conditional remainder is **$149.85376885**, assuming the full $150 grant and no other usage; actual provider grant/Billing balance remains unverified.

Preflight confirmed hosted D1 cost **$0.07136505**. Updated only external baseline from **$0.07451610** to **$0.07486610**, adding the prior **$0.00035000** standalone synthetic ASR probe. Baseline plus hosted spend now equals **$0.14623115**; no hosted charge was counted twice. `RALLY_PAID_ENABLED=1`, model key and bridge secret were retained. Future user-consented tests are estimated at **$0.009 for a full three minutes** of ASR; actual usage is recorded through the durable reservation/finish flow.

## Remaining validation and limits

The normal browser route previously joined a real meeting and exchanged audio, and the transcription adapter separately passed a real synthetic Muse ASR session. **No real end-to-end Site queue → Teams meeting → Muse transcript test is claimed yet.** The user will supply a fresh invite and consent after deployment. No further paid call was needed to publish.

Next live test: admit the bot, speak a short known sentence, verify partial/final text and level, select Leave, verify disappearance from the Teams roster and download final words; reconcile exactly one ASR session afterward. Then test automatic timeout/network-loss cleanup before longer use. The latest job transcript is shown separately from main meeting history; download before another test. Raw audio is streamed rather than saved by this POC. Automatic moderation, TTS, echo handling and speaker identity are not added by this release. Teams browser UI/policy changes remain possible.

## Rollback

Do not switch consumers during an active meeting. Use Leave and verify departure first. Then:

1. Stop `rally-teams-web-runner.service` as hack with `XDG_RUNTIME_DIR=/run/user/1000` and verify the meeting browser unit stopped.
2. Wait at least 30 seconds for the queue lease to expire. Never start both consumers together.
3. If reverting the Site, deploy saved **version 6**: `appgprj_6ae17976c3c88191a5b2627b0187e484~appgver_57b82ac3d9c081918cdc28a13b4b1271` using ordinary `deploy_site_version`, preserving the custom audience. The additive migration stays applied; do not edit/delete migration history.
4. Start old `rally-teams-runner.service` manually only if restoring ACS behavior. It still needs ACS credentials for a real join. Re-enable its old boot behavior only if intentionally restoring that prior configuration.
5. Keep external baseline **0.07486610** unless new usage reconciliation requires otherwise; reverting source does not erase the already-incurred external probe cost. Preserve runtime secrets and review any unresolved ASR reservation before paid work.

If this runner is stopped/rebooted before validation, start the selected normal runner manually with `XDG_RUNTIME_DIR=/run/user/1000 systemctl --user start rally-teams-web-runner.service`; no automatic enable-on-boot was added.
