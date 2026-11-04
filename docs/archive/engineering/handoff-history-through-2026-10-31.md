**Current UI: Teams invite required before Join, deployed `a9f0004`.** Empty or invalid work/school Teams invitations disable joining; valid link plus consent enables it. Switching to mic/tab remains available; existing live Teams reconnect needs no replacement link. [Details and test coverage](participant-setup.md), [public deployment checks](../../research/teams-invite-required-deployed.json). Frontend typecheck/build and full synthetic-provider workflow pass; main merged. Static-only release, API/media not restarted, SQLite backed up. No paid calls. Workspace `/srv/hackathon/rally-feedback`, branch `fix/require-teams-invite-20261030`.

**Current UI: simplified and aligned meeting setup, deployed `7af2a98`.** [Changes and validation](participant-setup.md); [public evidence](../../research/participant-setup-deployed.json). Advance participant names and roster counts removed; speaker identification retained. Compact approach/connection selectors align on desktop and stack on mobile. Optional developer sharing sits directly below consent during setup and remains available for withdrawal during/reviewing a meeting. Main merged; API `8054fb5` unchanged. Droplet workspace `/srv/hackathon/rally-feedback`, branch `polish/remove-participant-setup-20261030`; existing Omnigent checkpoint remains usable. No paid calls.

**Current UI: roomier hero, merged and deployed `49fa5e3`.** [Sizing, validation and recovered browser-test incident](../../hero-balance.md); [public verification](../../research/hero-balance-deployed.json). Both themes retain the complete Meta section at 100% zoom. API `8054fb5` stayed running. SSH/services recovered without reboot; browser checks now have enforced resource limits. Workspace `/srv/hackathon/rally-feedback`, branch `polish/hero-balance-20261030`. Existing droplet Omnigent checkpoint remains usable; read these notes on resume. No paid calls.

**Current layoutc42429d: complete hero + Meta section above the desktop fold at100% zoom.** [Scope/viewports](first-screen-fit.md), [public verification](../../research/first-screen-deployed.json). Both themes,13px Meta descriptions, home-scroll reset and real mascot verified. Main merged. Static assetsc42429d; API8054fb5 unchanged. Workspace `/srv/hackathon/rally-feedback`, branch polish/first-screen-fit-20261030.

**First-screen fit:** [Hero and full Meta section at100% zoom](first-screen-fit.md), both themes checked through1024×550 viewport. Home returns to top after sign-in;13px Meta copy preserved.

**Current UI69720b3: illustrated Meta cards + larger type, merged/deployed.** [Scope and checks](meta-capability-cards.md), [public evidence](../../research/meta-cards-deployed.json). Actual Living Silk mascot retained; both themes/mobile/reduced motion verified. Static update only; API8054fb5 unchanged. Workspace `/srv/hackathon/rally-feedback`, branch polish/meta-cards-20261030.

**Meta card polish:** [Illustrated capability cards and larger type](meta-capability-cards.md), branch polish/meta-cards-20261030 in the existing droplet workspace. Checks pass in both themes/mobile, with mascot unchanged.

**Current home mascot: same Living Silk as meetings, deployed/merged9c57bfe.** [Implementation and checks](rally-mascot.md), [public actual-WebGL evidence](../../research/rally-mascot-deployed.json). Main includes all previous work. Static assets9c57bfe; running API8054fb5 unchanged. Workspace `/srv/hackathon/rally-feedback`, branch polish/rally-mascot-20261030; resume phone session here and read these notes.

**Rally mascot follow-up:** [Same meeting visualization in the home hero](rally-mascot.md), real GPU/reduced-motion/lifecycle checks pass. Worktree unchanged, branch polish/rally-mascot-20261030.

**Current UI: Light/Dark/System + Meta showcase, merged and deployed.** [Scope and verification](appearance-and-meta-showcase.md), [public evidence](../../research/appearance-deployed.json). Main includes all prior feedback through2c8c0f5 and UI37d5740. Static assets37d5740; API8054fb5 unchanged/no restart. Droplet workspace `/srv/hackathon/rally-feedback`, branch `polish/meta-showcase-20261030`. Appearance selector is top-right; browser choice persists.

**Appearance/UI follow-up:** [Light/Dark/System and richer Meta showcase](appearance-and-meta-showcase.md). Prior feedback branch merged to main2c8c0f5; visual work isolated on polish/meta-showcase-20261030 in the same droplet workspace.

**Phone continuation:** Omnigent droplet session **Rally · Teams wrap-up handoff** (`bc8e5295591d4b4ba6e18164f8c7fd49`), workspace `/srv/hackathon/rally-feedback`. History-only checkpoint; no second runner. Current application8054fb5.

**Current application release8054fb5:** Graceful Teams wrap-up with13second minimum, verified rich summary hyperlink and confirmed Leave before camera teardown. [Implementation, live evidence, model costs and remaining user access confirmation](../../teams-wrapup.md). Branch `feedback/demo-polish-20261030`; no main merge.

**Latest Teams follow-up:** [Graceful wrap-up, chat link,13-second hold and validation limits](../../teams-wrapup.md). Native Insert link path passes local browser tests; final remote admission/check pending. Earlier local-close-only success was rejected by the user and corrected with Teams leave acknowledgement.

**Teams wrap-up follow-up:** [Animation, authenticated chat summary link and graceful leave](../../teams-wrapup.md). Branch/worktree unchanged; read this before further call lifecycle changes.

**Current UI asset release `7f2a634`:** Loading spinners, contextual Meta model labels and separate Rally response history deployed. [Public validation passes](../../research/loading-replies-deployed.json);17 frontend tests and browser/security checks pass. Static publication only: running API/media were not restarted, API source unchanged (`d5d2399`). Read [scope and limits](../../loading-and-rally-responses.md). Existing phone checkpoint remains valid; resume in this worktree.

**Latest UI follow-up:** [Loading indicators, Meta model attribution and Rally response history](../../loading-and-rally-responses.md). Same droplet worktree/branch; no new paid calls. See deployment evidence for current asset release.

**Phone continuation:** Open the droplet host in Omnigent and select **Rally feedback · ready for review** (session `ece55172f6a44ce385a6ee3b35d8759b`). History-only handoff, no duplicate runner; workspace `/srv/hackathon/rally-feedback`. The older “in progress” checkpoint remains historical. Final source/operator/docs branch checkpoint `03d2de7` (subsequent commit adds this pointer only); runtime application `d5d2399`.

**Current feedback release: `d5d2399` deployed from `feedback/demo-polish-20261030`; main remains `28df66f`.** [Deployed MFA/PDF/sharing/favicon checks pass](../../research/feedback-deployed-smoke.json), synthetic records removed. [Scope, model costs, tests and remaining manual checks](../../feedback-2026-10-30.md). Three-minute draft stays at `/srv/hackathon/rally-feedback/artifacts/feedback/rally-three-minute-narrated-draft.mp4`; no upload/submission. Server workspace `/srv/hackathon/rally-feedback`.

**Feedback polish branch:** `feedback/demo-polish-20261030`, server worktree `/srv/hackathon/rally-feedback`. [Completed scope, checks, costs and remaining acceptance](../../feedback-2026-10-30.md); [three-minute review draft](../../demo-feedback-draft.md). Runtime deployment status follows in the final checkpoint.

**Active feedback branch:** [October 30 feedback, priorities and progress](../../feedback-2026-10-30.md), worktree `/srv/hackathon/rally-feedback`. Existing deployment is unchanged while this work is in progress.

## Main integration — October 30

The reviewed living-presence branch was fast-forwarded from remote main `1d988d0` to `b0d7e87` and pushed to `origin/main`. There were no merge conflicts or additional code changes. Integration used `/srv/hackathon/rally-main-integration` on `integrate/presence-main` because the original `/srv/hackathon/repo` workspace has an unborn local main with untracked files; those files and its branch/index were left untouched. Use the clean integration worktree or fetch remote main for subsequent development.

Git access uses the existing `hack` account SSH configuration for `github-hackathon`; the earlier root-account hostname failure did not indicate a repository outage. Deployed application remains `d0a5364`. Validation and remaining remote/elapsed-hour acceptance limits below are unchanged by this merge. This documentation update accompanies the main integration.

## Living presence follow-up — deployed `d0a5364`

Source follow-up fixes page-only Teams video, cumulative partial coordinates, live output allowance (2,048tokens), cache-friendly requests and dynamic report reserves. **125backend tests,14frontend tests, both typechecks, frontend build and full HTTP/SQLite/LiveKit browser workflow pass.** Accelerated30/60minute dense replays preserve complete reports, bounded concern memory (8active+8resolved), emotion bounds, replay protection, correction/agenda history and55-minute ASRhandoff. Camera decoded-frame verification passes1920×1080 at29.10distinctfps with no browser shell/cursor. The earlier real Teams call succeeded overall and negotiated720p30; remote acceptance of the framing correction remains untested.

Actual synthetic caching measurement: third request reused3,313/4,002inputtokens (82.78%); first two were misses. All valid in1.708–2.559seconds. Batch$0.01526095; cumulative tracked Muse$1.80496175; conditional unverified-$150 remainder$148.19503825. [Caching evidence and limits](../../research/living-presence-caching.md), [review](../../research/living-presence-followup-review.md), [implementation](../../living-presence-implementation.md).

Release`d0a5364` is active after an idle check and SQLite backup (`rally-before-d0a5364-20261030T192811Z.sqlite`). Existing MFA session, closed signup, authenticated UI, renderer and public-DNS login ingress pass. The running API environment confirms user-approved$6/meeting,$20total caps. Persistent records/media/security configuration were preserved. [Deployment evidence](../../research/living-presence-followup-deployed.json). Remaining acceptance: elapsed-hour real-media/model endurance, updated remote Teams framing, and unusually long single finalized utterance (>8,000characters) currently causes an explicit skipped livecheck while complete content remains in report. Full benchmark output population under the increased token allowance is not guaranteed by the cache probe.

## Living presence integration — current checkpoint

The living-presence branch is merging deployed `40c5739` into the silk work. Read [the current implementation](../../living-presence-implementation.md) and [operations](../../living-presence-operations.md); they supersede the earlier foundation/standalone-runner paragraphs below. Canonical TeamsLive now owns camera plus existing streaming audio; no competing native queue. MFA/closed registration and production realtime decision deadlines are preserved. Latest combined checks: **118 backend tests, 14 frontend tests, both typechecks**, full synthetic-provider HTTP/SQLite/LiveKit browser workflow. Three merged-schema real Muse calls passed in 2.503–4.901 seconds for $0.01735250; combined tracked total $1.45503685, conditional unverified-$150 remainder $148.54496315, unknown0. Full-pixel repeat measured26distinctfps; final silk-only1280px rendering measured29.29distinctfps with30fpsrenderer, while text/video remain1920×1080. Remote Teams acceptance remains pending. Merged release `a686843` is now active after idle backup, MFA enrollment and closed-registration checks. A consented Teams rehearsal is in progress; actual outbound negotiation measured1280×720 at30fps. Remote recipient smoothness/audibility and final cost reconciliation remain pending. Never deploy foundationee8d7fe independently of the merged security work.

**Live Teams rehearsal:** The user reports a successful call test; saved records confirm connected capture and completed cached TTS to Teams. [Guidance outputs and latency analysis](../../teams-live-rehearsal-2026-10-30.md) explain why the first intervention followed an 89-second speaking turn: assessment currently consumes finalized turns only.

**Teams startup correction, October 30:** Integrated API runtime now includes the Chromium library path used by the original Sites runner. Actual headed-browser launch passes in an equivalent production sandbox. See [incident and validation](../../teams-startup-incident.md). The subsequent user trial succeeded; see the rehearsal record above.

# Rally MFA/admin security release — October 30

**Current app: https://rally.tail703f9e.ts.net/**, deployed application `ca539a5`. Source: `/srv/hackathon/rally-security`, branch `security/mfa-admin-20261030`, based on streaming checkpoint `e779d8d`. This supersedes earlier signup/login access instructions below. Public signup is closed. Existing accounts keep their passwords but must enroll MFA; password-only sessions were revoked on migration.

Owner administrator username: `rally_admin`. Choose Activate or reset account using the one-time code delivered privately in the owner’s local `Downloads/Rally Admin Activation.txt`, choose a password, enroll an authenticator, save recovery codes. No credentials are recorded here. Activation expires in 24 hours. Server plaintext activation file was deleted after private delivery.

Admin includes invitations, recent-MFA protected account enable/disable/role/reset controls, usage/activity and explicitly shared read-only transcripts/reports. Sharing is off per meeting by default; owners can withdraw future access. No replayable audio recording was added. [Operations, threat boundaries and recovery](../../mfa-admin-judge-audit.md). [Actual public HTTPS and synthetic bidirectional media evidence](../../research/mfa-public-deployment-smoke-2026-10-30.json).

71 backend tests, nine frontend tests, both type checks/build and three browser workflows pass with synthetic providers. Public enrollment/refresh, secure cookies, closed signup, owner isolation and bidirectional media pass; temporary test account removed. No paid model calls or real meeting joins in this security change. Backup before migration is recorded in the linked operations document. Prior streaming improvements/cached opening are retained; separate dirty worktrees remain preserved.

## Previous streaming checkpoint (historical)

# Rally handoff — streaming speech release, October 30

The integrated Node app is deployed from `c20261d` at **https://rally.tail703f9e.ts.net/**. It is public HTTPS with backend signup/login. Work is committed on the isolated `rally-streaming-speech` branch based on main `1d988d0`; it has not been merged or pushed. The separate private Sites release is unchanged.

Shared AWS TTS now supports complete WAV and streamed PCM, approved meeting interventions stream to browser speakers or the integrated Teams virtual microphone, and ten-second status updates expose meeting health and assessment freshness. Teams mode uses one moderation engine, survives dashboard closure, and ends on explicit End/Leave. See [implementation decisions](../../streaming-speech-plan.md), [API contract](../../backend-api.md), and [release validation/deployment](../../streaming-speech-validation.md).

64 backend tests, nine frontend tests, both type checks, frontend build and two actual browser/LiveKit regression paths pass. Final Astra Standards review found no actionable issues; both Spec findings were fixed and verified. Public UI signup/login, owner isolation and bidirectional synthetic audio pass through the public relay. [Evidence and limitations](../../streaming-speech-validation.md).

Remaining: fresh consented Teams admission/audibility rehearsal and independent external-device playback. The exact opening is now `Let's get back on track.` (ASCII apostrophe). A real AWS probe confirms **cache hit**, with first audio in 855 ms. No new Muse calls occurred; three AWS probe costs are unknown. Runtime credentials remain private. Public SSH443 was preserved; Funnel supplies the public web endpoint. Submission remains draft-only.

## Prior checkpoint (historical; superseded where different)

# Rally handoff — October 30 current checkpoint

The integrated Node app is deployed from `9202d1f` at [Rally](https://rally.tail703f9e.ts.net:8445). It requires Tailscale and its own app login. Source is pushed to `main`. The older restricted Sites app remains a separate release; do not mix its presenter, confirmation or demo-clock controls with the Node workflow.

## Working now

The host prepares an agenda, captures their microphone or a selected meeting tab, and receives Muse-finalized transcripts and approved guidance through self-hosted LiveKit. Muse Voice Transcribe supplies the transcript; native Teams/Zoom/WhatsApp transcripts are not used. Reports analyze the complete final transcript and distinguish reported agreement, proposal and unresolved outcomes. Source links, correction notes, saved history, export, nullable scores and explicit paid retries are implemented.

New overnight work:

- [Meta MMS speech](../../integrated-speech.md): approved prompt IDs/epochs, offline pinned local voice, optional host-browser playback, free fixed-phrase voice test, Stop/pause/dismiss/end cancellation, bounded input shielding and text fallback. Compatible MMS checkpoint configuration is validated against adapter provenance and actual local model files.
- [Speaker correction](../../speaker-attribution.md): anonymous session numbers, reversible host labels, no-op saves, processing conflict protection, stale-report warning and explicit reanalysis. Host annotations survive regeneration separately from model evidence; older correction segments retain a legacy marker.
- [WhatsApp follow-up drafts](../../integrated-whatsapp-follow-up.md): host-selected report rows, preserved uncertainty, editable text, Copy and manual WhatsApp handoff. No recipient is preselected and no message was sent by tests.
- The WhatsApp guest prototype closes late browser launches after cancellation and applies its deadline during startup; four local tests and isolated audio routing pass. Actual guest admission is still pending.
- Voice playback coverage windows are saved as upper bounds and shown as a report caveat; they are not evidence of participant silence.
- Delayed moderator controls/prompts from older epochs cannot undo Resume or replace current guidance.
- Scoped live captions survive older asynchronous completions; late partials cannot resurrect finalized words. Legacy unscoped adapters retain their existing clear-on-final behavior.
- [Updated demo script](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/demo-script.md), [longer show-and-tell/pitch](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/show-and-tell-script.md), [human rehearsal packet](../../integrated-rehearsal.md) and [submission/access observations](../../research/submission-access-check-2026-10-30.md).

## Validation and running check

50 backend tests, nine frontend tests, both TypeScript checks and the frontend build pass. Fifteen separate MMS adapter/output/queue tests pass; [real cancellation/recovery](../../research/mms-cancellation-recovery-check.json) and the [real-MMS browser workflow after the ownership fix](../../research/mms-ownership-browser-check.json) pass. The full local HTTP/SQLite/LiveKit browser workflow passed with synthetic ASR/reasoning providers and actual pinned MMS speech. [Real speech/browser evidence](../../research/integrated-speech-browser-check.json) and [follow-up workflow evidence](../../research/integrated-follow-up-browser-check.json) identify test boundaries.

[Deployed HTTPS verification](../../research/mms-ownership-release-deployed.json) passes real MMS playback/Stop, distinct anonymous sessions, host name correction, stale warning, draft construction and annotation export. The setup used a temporary account and synthetic records, which were removed. No WhatsApp link was opened and no paid model call was made by these checks. Existing provider spending/Billing observations are separate; use the runtime usage view and [cost ledger](../../research/muse-cost-ledger.md).

An eight-hour local MMS reliability process started October 30 at 04:09 UTC, with a synthetic phrase every 30 minutes and periodic worker reloads. It is **running**, not an eight-hour pass, at this checkpoint. It reached a successful three-hour sample at 07:09 UTC. This process loaded the adapter before the later stale-worker ownership correction; that correction is validated separately and is not covered by the eight-hour claim. Its ignored local report is `experiments/meta-mms/test-results/overnight-check.json`; command and limits are in [integrated speech](../../integrated-speech.md). Do not terminate it as an abandoned browser fixture.

The refreshed local archive from `5e3da10` contains 404 filtered source files. Its [source draft/privacy manifest](../../research/latest-source-draft-archive-check.json) and [clean-archive reproduction](../../research/latest-source-draft-reproduction-check.json) pass: 50 backend, nine frontend and four WhatsApp prototype checks, type checks, build and the complete synthetic-provider browser workflow. The archive is local only; source is not claimed public. Earlier `3317f1f` archive evidence is retained as historical.

[ASR handoff work and bounded capture experiments](../../asr-session-handoff.md) correct planned session continuation, pause, failure and ownership. The [two-hour MMS checkpoint](../../research/mms-soak-two-hour-checkpoint.json) remains a running eight-hour test, not a final pass.

## Next work and boundaries

1. Read the running soak result; investigate a failure before claiming reliability. Record its final state when it completes around 12:09 UTC.
2. Rehearse with actual people/devices. Verify microphone/remote input, physical voice, cancellation, transcription quality and the complete report. Speech plays to the host; remote callers hearing it is not established.
3. Supply a fresh consented WhatsApp guest link for admission/audio validation. The [prototype](../../whatsapp-guest-prototype.md) passes isolated local routing but is not an enabled deployed invite connector. The existing [Teams invite](../../teams-integrated-ui.md) remains a bounded transcription-only guest test and needs a fresh pacing/live retry.
4. Resolve anonymous repository access (currently 404), source-license choice and usable judge access. The private Tailscale deployment is not public judge access. Keep real records protected.
5. Record the three-minute demonstration after rehearsal. The ending can explain the future meeting-platform vision; that platform is not implemented. Final submission and external publication remain on hold.

## Engineering entry points

[Backend team handoff](../../backend-team-handoff.md), [API/streaming contract](../../backend-api.md), [AI processing](../../ai-processing.md), [actual AI examples](../../backend-ai-examples.md), [model interfaces](../../model-interfaces.md), [frontend setup](../../../apps/rally-web/README.md) and [deployment/rollback](../../integrated-deployment.md).

Work this checkpoint used `/srv/hackathon/rally-whatsapp-guest` on `rally-spoken-guidance`, fast-forward pushed to remote `main`. Runtime services are `rally-integrated-api`, `rally-integrated-web` and `rally-integrated-media`. Persistent SQLite and secret configuration stay outside immutable releases under `/srv/hackathon/rally-deployed`. Check for live meetings/report processing and back up SQLite before an API restart. Never expose credentials or replace the tailnet-only media setup without an explicit access decision.

## Historical records

Earlier Sites release: [version 12](../../releases/2026-10-29-v12.md), [October 29 morning reliability](../../morning-reliability-2026-10-29.md), [October 28 incident/handoff](../../tonight-handoff-2026-10-28.md), [remote access](../../remote-access.md). Backend initial delivery/review: [implementation status](../../backend-implementation-status.md), [Astra validation](../../backend-astra-review.md). Historical status and cost figures in those records are dated observations, not the current deployment or verified Billing balance.

## Teams MMS output preparation

[Teams MMS output](../../teams-mms-output.md) is installed in the idle normal Teams runner from source `22c3671`, with the diagnostic disabled. Nine offline checks and a real-MMS disposable virtual-microphone measurement pass, including Stop/silence and incoming-audio isolation. No meeting was joined. A fixed diagnostic can be explicitly enabled for the next live trial; automatic agenda-based spoken replies still need a live moderation connection.

## Living Silk implementation checkpoint

[Local foundation and remaining implementation](../../living-presence-implementation.md): bounded controller, additive Muse affect contract and browser surface are implemented locally;60 backend/9 frontend tests, both typechecks and frontend build pass. No deployment, paid call or Teams video validation. Full reviewed plan remains unfinished; read explicit gaps before continuing. Existing capture-lease work was preserved.

## Living presence completion and remote acceptance

[Implementation](../../living-presence-implementation.md) and [operations](../../living-presence-operations.md) now cover continuous emotional actuation, adaptive Muse assessment, speech articulation, shared browser/camera scene, captions/topics/progress, and the owned native Teams runner. Final local regression: 71 backend tests, 10 frontend tests, both typechecks and frontend build pass. Actual MMS browser/audio and 1080p WebRTC camera checks pass; measured distinct-frame rate is approximately 29 fps. Targeted independent spec and standards reviews checked caption ownership, capture epochs, observer reconnect, native Stop, renderer failure and process locking; identified fixes were applied. The existing capture-lease dependency is preserved. Live remote Teams acceptance remains pending; do not equate local transport checks with a remote call pass. Calibration costs and runtime reconciliation are in the central ledger.
