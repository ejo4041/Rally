Backend MVP implemented: [status and validation](backend-implementation-status.md), [frontend API contract](backend-api.md), [AI processing diagram](ai-processing.md), [setup](../apps/rally-api/README.md). Real two-way browser audio and Muse end-to-end smoke passed. Frontend wiring and deployment remain separate; existing private Site is unchanged.

# Rally handoff — current checkpoint

**Morning update:** [Speech reliability fixes and isolated audio measurement](morning-reliability-2026-10-29.md) · [rehearsal checklist](morning-rehearsal.md). The app is version 12; live browser-call and Teams speech validation are pending.

**Current release:** [Version 12 — browser meetings, a free audio check, presenter view and WhatsApp follow-up](releases/2026-10-29-v12.md) is live on the existing restricted Site. WhatsApp Web, Zoom Web, Meet and Jitsi presets use host-selected tab audio; real call compatibility remains unverified. Earlier version-7/local-only entries below are historical. Teams spoken output and fresh live pacing retry remain pending; final submission is on hold.

**Demo drafting:** [Presenter/participant script](demo-script.md) now ends with a clearly labeled future meeting-platform concept. It is a recording draft; audio/live validation gates remain open. Final submission is explicitly on hold until a separate user instruction.

**Earlier October 29 build:** [Retrospective Teams review, measured Meta MMS speech, and submission audit](overnight-build-2026-10-29.md). Source changes are tested locally; deployed Site is still version 7. Live Teams/MMS playback validation remains pending.

**October 29 offline checkpoint:** [Teams saved-history implementation, tests, documentation and Git state](offline-progress-2026-10-29.md). New history code is local, not deployed. Live pacing-fix retry remains pending; no live test or paid call was run tonight.

## Home remote access follow-up

[Remote access/setup status](remote-access.md): tonight handoff read; Teams preflight ready with no active job or new spend. Fresh invite and consent pending. Omnigent 0.20.0 installed privately; admin created and host online. Tailscale HTTPS verified at https://rally.tail703f9e.ts.net:8443; phone verification pending. Herdr 0.9.5 installed locally. Existing tmux chat unchanged.

## Start here tonight — October 28

**[Tonight handoff: account context, current state, live-test incident/fix, costs and resume steps](tonight-handoff-2026-10-28.md)** is the authoritative latest checkpoint. The work-account chat has updated these files; the personal Codex session on the droplet is idle and its last chat answer predates the live test and server pacing fix. Normal runner is online with no active meeting. A fresh consented retry after the fix is next. Tracked estimate **$0.15263115**, conditional remainder **$149.84736885**, unknown **0**. Earlier sections below are historical where they conflict.

## First live transcription stop — investigation

The first user test ended ~26.5 seconds before its deadline with an ASR failure; the runner did not crash. A timer-drift/backlog defect was reproduced offline and fixed on the server, with sanitized termination diagnostics added. Exact original trigger was not retained and remains unproven. The idle runner was restarted and is ready; a fresh consented live retry is pending. [Evidence, fix and costs](research/teams-transcription-first-live-incident.md). Tracked spend $0.15263115; conditional grant remainder $149.84736885.

## Current checkpoint — Teams transcription POC deployed

**Ready URL:** https://rally-meeting-moderator.excavator3496.chatgpt.site . Use Invite Rally to Teams, paste a fresh invite, confirm participant consent and opt into transcription. Admit Rally audio test; Leave and download the transcript before another test. Three-minute transcript-only POC, no spoken moderation or main meeting-history integration. No ACS/app registration needed for the normal guest-browser route.

Deployment completed from this session's correctly signed-in owner workspace using supported Sites source/helper/native tools. Existing custom restricted audience exactly preserved; no agents spawned or session credentials transferred. Latest source **376089c7587b1c0857f67909bb813493ee7cd5bc**, saved native **version 7**, deployment **appgdep_6ae255d0ac74819195c3f137011414be succeeded**, environment revision **6**. Appended migration **0002_teams_transcription** verified in production D1. Full [deployment result, evidence, limits and rollback](research/teams-transcription-deployment-result.md).

**Service state:** normal `rally-teams-web-runner.service` active; old ACS `rally-teams-runner.service` inactive; meeting browser `rally-teams-web-client.service` inactive. Both queue services disabled for automatic startup; new runner manually active pending live validation. Stopped old consumer and waited 32 seconds before starting new; never ran both. Protected status reports **online=true, transport=teams-web, transcriptionReady=true**. Rendered published UI passes read-only checks, ACS setup hidden, blank invite and unchecked consent. No meeting was joined and no Muse call initiated during deployment. User will supply a fresh link and consent. Do not open the old stored link.

**Costs:** tracked estimate **$0.14623115**, unknown 0; conditional $150 remainder **$149.85376885**. Hosted D1 **$0.07136505**, external baseline **$0.07486610** (includes prior external $0.00035000 synthetic probe). Do not double count D1 in baseline. Deployment cost **$0**; pre/post 17 usage IDs unchanged. Actual Billing/grant remains unverified.

**Validation:** 19 backend and 3 offline adapter tests pass; mocked Teams UI and existing full walkthrough regression pass. Exact patch applied against latest opened hosted source; no candidate wholesale copy/dependency symlink. No npm downloads/installations; existing Nexus config/auth retained. Known earlier normal-client live audio and separate real synthetic ASR proof do not establish an integrated queue-to-Teams-to-Muse live test. That is the next user-consented gate.

The entries below record earlier steps. Their ACS prerequisites, staged publication blocker and historical service state are superseded by this checkpoint.

Updated October 28, 2026. Start with [build verification](build-progress.md) and [documentation index](README.md). The user authorized independent implementation without further prompts. The research-only stopping point is superseded. No paid batches or local product preview remain running. A persistent Teams runner service is now explicitly installed as described below.

## Latest follow-up — normal Teams client and live two-way audio verified

User requested a normal Teams client on this Ubuntu server. Headed Chromium plus private PulseAudio virtual devices successfully joined the supplied test meeting as **Rally audio test** without ACS or a custom app registration. The host confirmed outgoing diagnostic speech was audible; timed measurements confirm incoming speech at the browser MediaStream and virtual speaker monitor. Automatic three-minute departure was exercised. [Actual results and boundaries](research/teams-web-client-spike.md); [source and operation](../experiments/teams-web-client/README.md).

The experiment is separate from the active ACS runner. The hosted Invite controls have not been switched, and normal Teams audio is not yet wired into the Muse moderation loop. Next work is the normal-client transport adapter and a consented end-to-end moderation/echo/Stop test. No Muse calls occurred; previous billing totals remain unreconciled. No app-registration permissions are needed for the successful guest-browser route.

## Latest follow-up — conversation continued from chat

Recovered the server session and verified the Teams runner is active, with all four Azure app-registration fields and the connection-string alternative still absent from server configuration. The user understands app registration and is questioning why ACS is needed if Rally can participate through a normal Teams client. Clarify that ACS is one transport choice, and that the existing local audio tests do not establish an actual Teams connection. See [continuation context and next decision](session-continuation.md) and [corrected administrator explanation](teams-admin-brief.md). No new Azure/Muse requests or implementation changes occurred.

## Latest follow-up — app-registration authentication implemented

User requested app registration if it meets Rally's needs. Added Entra client-secret support to the existing Linux/ACS runner; this preserves the current media approach and still needs an ACS resource/subscription. **App registration alone is not a complete meeting-audio bot.** Native Windows/Graph architecture was not substituted. An optional route-choice question was presented; no answer received at this checkpoint, so this work is a compatible auth addition, not an assumption that the user approved new Windows infrastructure or provisioned ACS.

Setup: [four fields and exact registration/resource-role steps](teams-app-registration-setup.md); [official-source RBAC/fit evidence](research/teams-app-registration-fit.md). File: root ignored `.env.local`, keys `AZURE_COMMUNICATION_ENDPOINT`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`. Resource-level Contributor is the documented prototype option, broader than minimum; exact least-privilege Identity custom role is unverified. No Graph permissions requested for this ACS route.

Changed only the Ubuntu runner/auth module/dependencies and docs; hosted app source/version 6 unchanged. Two new auth tests pass against actual ACS SDK/local HTTP transport, plus real Entra/ACS client construction without network requests. Dependency audit zero known vulnerabilities after pinning Azure Identity 4.13.0 and its MSAL UUID dependency to 11.1.1. `npm run test:auth` in `experiments/teams-audio/`. Runner service was restarted after confirming no active Teams test. No Azure auth, identity issuance, actual meeting join or Muse calls. Last tracked spend unchanged. Config completeness is not actual authorization or full Teams/Muse/TTS success.

## Latest follow-up — AI Hero skills installed

Installed the four requested skills and three direct supporting skills repo-locally under `.agents/skills/`, with pinned provenance, MIT license, and byte-for-byte verification. See [installation and usage](aihero-skills.md). Available next turn; tracker setup and actual invocation remain untested. No product/deployment changes or Muse calls; cost state unchanged.

## Latest follow-up — Teams join controls deployed

Earlier user clarification: they needed to understand the architecture and whether app registration can substitute for ACS before discussing subscription setup with an administrator. [Shareable administrator brief](teams-admin-brief.md) explains this. ACS is required by the selected implementation, not universally by all Teams bots. Entra service-principal authentication now replaces shared-key authentication when configured, while retaining ACS. Native Graph raw-media bot is a different Windows/.NET hosting path.

The existing Site now has **Invite Rally to Teams**, backed by D1 jobs and this Ubuntu server's **active systemd user service** `rally-teams-runner.service`. Hosted read-only check confirms panel/script deployed, runner online, **Azure credentials not configured**. No real Teams meeting has been joined. User needs to add `AZURE_COMMUNICATION_CONNECTION_STRING` to `/srv/hackathon/repo/.env.local`; [setup instructions](teams-setup.md). Runner reloads that file each poll; no redeploy/restart needed. An advanced temporary ACS VoIP token is available for a single test. Teams bot is the priority; phone-on-table microphone/TTS remains the fallback.

Preview is bounded to three-minute **transport connection tests**, with join/lobby/status/input level/host Leave, encrypted one-time credential transfer and singleton admission. Teams audio is not yet wired to Muse or moderator speech. See [integration evidence, operations and remaining gates](research/teams-site-integration.md). App tests now **18 passing**; existing rendered browser flow and a new UI→queue→runner→actual SDK invalid-token failure test pass, with no Azure authentication/meeting join and no Muse calls. Last tracked spend unchanged. User service lingering is enabled; Node/libraries moved to `/srv/hackathon/tools/` for stable service paths. Service intentionally remains running, idle until a user starts a test. Other owned local previews/test runners were stopped.

Current native **version 6**, source **07c06a1150655d245ca25b77e99b1b0441167cbf**, deployment **appgdep_6ae23d13fb448191b1ba2e36022bb1e7**, environment revision **5**. Current audience is the already-existing restricted shared policy, including its invited visitor; it was preserved. Earlier owner-only descriptions are historical. Saved version ID appears below and in the integration report. No access policy changed.

## Latest follow-up — Teams SDK installation

User requested investigating a server-based Teams participant with virtual microphone/speaker. Microsoft ACS Calling SDK **2.0.0** and common **2.5.0** installed in isolated `experiments/teams-audio/`, separate from hosted Rally. Successful local headless Chromium test proves SDK/custom-stream construction and simultaneous two-way WebRTC audio, channel separation and output Stop while receive continues. It is not an authenticated ACS or Teams meeting test. Browser voices are zero; captured audio clips/PCM-producing TTS are needed for the direct stream route. Native Graph raw media still requires Windows Server. See [actual evidence and blockers](research/teams-sdk-local-spike.md), [official platform research](research/teams-sdk-platform-verification.md) and [reproduction instructions](../experiments/teams-audio/README.md).

A loopback-only test page is prepared for join/incoming level/short speech clip/Stop/Leave with a three-minute limit. No server remains running. Next prerequisites: short-lived ACS user token with VoIP scope, ordinary work/school Teams meeting URL, consent, anonymous-join policy and lobby host. No Azure resource created, meeting joined or Muse call made; recorded spend unchanged. Keep the managed-provider route as an alternative rather than treating it as the only Linux option. Existing deployed Rally remains unchanged.

## Open and review

**Private product:** https://rally-meeting-moderator.excavator3496.chatgpt.site

Sign in with the workspace owner's account. Try the clearly labeled zero-cost walkthrough first; it uses no microphone or model calls. Real microphone meetings require consent and use the configured Muse backend. Review and explicitly confirm proposals; no automatic voice identity or automatic spoken commitment confirmation is claimed.

## Implemented

Browser meeting setup/history, PCM capture/resampling, Muse live ASR, Spark minimal moderation, timed agenda checkpoints and five-minute wrap-up, browser speech/host controls, pending-speech cancellation and trailing analysis, transcript-evidenced proposals, explicit host owner/date confirmation, scorecard, export/delete, cost estimates/export and protected usage caps. A disclosed demo clock and separately labeled scripted walkthrough are included.

Source is `apps/rally/`. Runtime is an ES-module Worker plus D1, adapting the proposed Python module architecture to supported Sites private HTTPS hosting. Do not reimplement a second Python product backend merely because the original recommendation mentioned it. See [architecture](rally-architecture.md) for domain boundaries and [build report](build-progress.md) for the actual implementation choice.

## Deployment/source identity

- Site: `appgprj_6ae17976c3c88191a5b2627b0187e484`.
- Latest verified successful deployment: `appgdep_6ae255d0ac74819195c3f137011414be`.
- Saved version: `appgprj_6ae17976c3c88191a5b2627b0187e484~appgver_939072c114508191910e95820aaf15dd` (native version 7, product v0.1 with normal Teams transcription POC).
- Source commit: `376089c7587b1c0857f67909bb813493ee7cd5bc` in the nested app source checkout.
- Environment revision 6, existing restricted audience retained, server-side Muse and bridge secrets configured. Never display or export credentials. D1 migrations applied; applied migrations are immutable.

Use the Sites skill/source helper for later hosted changes, preserving this identity/audience. Ephemeral source credentials expire and must be renewed through the native tool, never written into source or output. The nested app Git repository is separate from the root hackathon workspace. Root public repository publication remains unperformed; use `scripts/export_submission.py` for a sanitized standalone source archive.

## Verified evidence

- 16 core/API/accounting/lifecycle tests pass; valid ESM artifact; dependency audit reports zero known vulnerabilities.
- Rendered Chromium flow covers setup, short meetings, labeled walkthrough, proposals/confirmation, pause/resume, disclosed clock, save/reload, export/delete, mobile-width layout, empty-meeting isolation, and simulated TTS cancel/stale-event handling.
- Browser AudioWorklet processed a two-second synthetic 48 kHz signal into exactly 32,000 16 kHz PCM samples. This is not physical microphone proof.
- Real app smoke: known licensed audio passed through Worker → Muse ASR → Spark; three final turns and a real redirect reached the client. Output was visible-only in that test.
- Hosted D1/WebSocket walkthrough/export/delete passed. Hosted silent-ASR probe verified actual server-side Meta access and binary transport; it did not measure speech accuracy.
- Standards and Spec review findings were fixed and rechecked. Report: [code review](research/build-code-review.md).
- Earlier research/benchmarks remain relevant: one easy connected decision in 1.3208s; actual AMI four-speaker diagnostic WER 27.43% ENDPOINTING / 21.24% DIARIZATION on 113 tokens. These do not prove audible meeting readiness or speaker identity.

## Cost state

Current tracked estimate **$0.14623115**, unknown **0**. Conditional remainder **$149.85376885** assumes a full applied $150 grant and no other usage; actual Billing/grant remains unverified. Latest synthetic adapter probe cost **$0.00035000** was incurred before this deployment; deployment made no model calls.

Hosted D1 retains **$0.07136505** across 17 usage events. Deployed external baseline is **$0.07486610**, deliberately excluding hosted usage. Pre/post deployment usage IDs unchanged. Future browser/Teams use accrues in hosted D1; export/reconcile `/api/usage` by stable IDs before reporting a new global total or changing baseline.

Read [budget policy](api-budget.md) before paid work. App forecast defaults are $0.25/meeting and $0.50 additional hosted usage, not provider-enforced hard caps. Unknown accounting blocks further paid work and remains visible after deletion. No repeating successful paid tests without a changed condition or a new evidence need.

## Next useful work

1. The user should test an actual laptop microphone/speaker session over the private HTTPS URL: audible start, host Stop, pause versus mute, and echo. Headless QA cannot replace this.
2. Test the intended phone and audio routing/foreground behavior. Responsive screenshots are not hardware support evidence.
3. Rehearse three consenting participants using the [three-minute demo plan](demo-walkthrough.md): real tangent → redirect → explicit owned/dated action and decision → host confirmation → override → disclosed wrap-up clock → evidence/export.
4. Keep all model outcomes as proposals until explicit host confirmation. Unknown voices are correctable; physical barge-in and automatic named-speaker recognition remain unverified.
5. Teams now has a direct Microsoft ACS browser runner and Site controls. Configure ACS credentials, then test a consented real meeting join/input/output/leave before attaching Muse and rendered TTS. [Integration status](research/teams-site-integration.md). Managed transport remains an alternative; no provider signup or real join was made.
6. Wonder/open-weight/SAM extras remain gated after device and demo reliability. No mandatory breadth expansion.
7. Public repository, final three-minute video, judge access and event submission are still outstanding. Preserve original-work attribution and the November 4 deadline.

A normal page close attempts safe finalization. Hard runtime/network failure can leave a stale live record until its lease expires; it remains readable/exportable and can then be deleted. Seamless call resume/full production recovery are not implemented.

## Local reproduction

From `apps/rally`: `npm ci`, `npm run build`, `npm run dev`. Paid calls default off; explicitly set `RALLY_PAID_ENABLED=1` to use the root ignored key. Node.js 24+ required. This session used a SHA-verified temporary Node install at `/tmp/rally-node`; it may disappear. Local data is ignored `.data`, separate from hosted D1.

Tests: `npm test`, `npm run validate`; rendered browser test needs a running local preview and Playwright Chromium/platform libraries. This session's unprivileged library extraction is under `/tmp/rally-browser-libs`; it is not a normal project dependency or system install. Raw licensed fixtures and diagnostic dependencies under `/tmp` can disappear; preparation scripts/manifests provide source provenance. Optional Python diagnostics use `requirements-diagnostics.txt`.

## Suggested skills

Sites for hosted changes; diagnosing-bugs for physical audio/API failures; code-review for later material changes; OpenAI Docs if adding an OpenAI voice service; research for new feasibility gaps; writing-for-agents and handoff for persistent context.
