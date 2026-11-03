### Completed: optional join welcome deployed

Active `/srv/hackathon/rally-deployed/releases/1a33198-optional-greeting`, mergedmain from `feature/optional-join-greeting`. Teams-link setup checkbox “Play a welcome and read the agenda when Rally joins” OFF by default. Explicit opt-in only; deterministic prepared-topic intro after server-confirmed connected, persisted attempt marker prevents repeat/retry; reconnect cannot re-enable. Pause/mute respected; speech errors nonfatal. Demo also off-by-default, one prerecorded8.52s welcome for sample plan,24totalclips; no runtime demo model calls.

Staged baseline API full159tests/typecheck + staged setup browser passed. Source163suite +2newHTTPtests,26frontendunits/typecheck/build passed. Public demo opt-in greeting/control/fallback checks passed; API healthy/protectedauth401. New backend contains only4scoped file changes and new pure helper, preserving prior deployed baseline; no incidental phoneme activation. Restart only after metadata-only idle check (all0), privatebackup; API PID755639→812792. One additional AWS generation call HTTP200/costunknown;0Muse. No real Teams rehearsal performed. [Feature record](optional-join-greeting-2026-11-03.md). Private artifacts `/srv/hackathon/artifacts/optional-greeting-20261103/`. Refresh existing tabs for checkbox. No pending implementation work.

## Optional join greeting — 2026-11-03 (implementation/tested; deployment pending)

User requested a welcome/agenda, then explicitly required optional checkbox on Teams-link screen, OFF by default. `feature/optional-join-greeting`: checkbox `join-greeting`, bool `greetingEnabled` on connect; server after-connected hook calls deterministic bounded agenda welcome only for first successful join epoch. Persist attempt before speech; no duplicate on refresh/reconnect or failed speech; pause/mute respected. Nonfatal errors do not end call. Default off makes no extra speech call. Demo has one additional prerecorded8.52s welcome for fixed sample plan, optional/off; custom edited demo plans disable the fixed welcome. Existing23clips preserved,24total.

Engine/helper/Teams and real HTTP synthetic-connector/TTS tests pass; setup UI checks defaultfalse/explicittrue; demo browser actual welcome+controls passes.26frontend units,163master backend suite plus2new HTTP tests, both typechecks/build passed. One AWS generation request HTTP200, costunknown;0Muse. [Full record](optional-join-greeting-2026-11-03.md). Must stage only the new API diff on existing deployed backend baseline: main has unpromoted phoneme changes in app/speech that are outside this request. Restart API only when no live meetings/pending work; SQLite backup first. No real Teams rehearsal yet.

### Completed: public demo audio deployment

Active release `/srv/hackathon/rally-deployed/releases/bcebcb0-demo-audio`, mergedmain from `feature/demo-audio`. Public URL https://rally.tail703f9e.ts.net/demo.html . Refresh existing tabs, create/start a new simulated meeting. Alex/Sam share MMS, Priya uses FastSpeech2/HiFi-GAN, Rally uses its existing Seamless voice; prerecorded23clips, no runtime model calls. Ask Rally has spoken canned answers. Settings → Demo audio silences playback while text continues; pause, dismiss, End/navigation/reset/hidden-page cleanup tested. Existing completed sample is a report, no auto-play.

Public real-media workflow and negative autoplay/missing-asset cases passed against exact release, no unexpected API/socket/capture calls or page errors.25units/typecheck/build, full21clip proactive playback at test-only4× with17human turns/report/PDF,48strict mobile/desktop light/dark screenshots, ordinary-app feedback regression all passed. Main style.css byte-identical to polished UI. Backend byte-identical, API PID755639 unchanged, backup saved, healthy; anonymous auth401. No real meeting joined and no production voice/model config changed.

Six authorized AWS generation requests (all200),17local model clips, zeroMuse calls; hosted/infrastructure costunknown, no claimed zero total cost. [Full record](demo-audio-2026-11-03.md). Asset/license/hash manifest in `demo/demo-audio/`. Private validation `/srv/hackathon/artifacts/demo-audio-20261103/`; detailed generation receipts `artifacts/feedback/demo-audio-generation-20261103/`. Local submission working draft annotated; numbered video05 untouched. No remaining work for this request.

## Demo voice playback — 2026-11-03

Owner authorized pronunciation-test voices for the public demo, preserving UI. Branch `feature/demo-audio`.23generated static clips:17participants (Alex/Sam MMS, Priya FastSpeech2) and6Rally (existing hosted Seamless, four script +two Ask variants). Three underlying voice sources, not four unique speakers. No runtime model/ASR/meeting calls. Same UI, existing Settings checkbox becomes Demo audio. Pause/reset/navigation/End/hidden page stop media; one player, playback-clock captions, Ask interrupts stale guidance, autoplay/missing-file fallback to text.

25units/typecheck/build passed; real media controls/default-autoplay and negative cases passed; full proactive21clip/17turn run at test-only4× passed, report/PDF/reload/theme/resize tested;48strict theme/layout screens and ordinary-app feedback regression passed. Six hosted generation requests HTTP200, AWS costunknown; zeroMuse calls. Local17clips use cached pinned models with APIfee0/infrastructureunknown. [Full record](demo-audio-2026-11-03.md), [sanitized generation accounting](research/demo-audio-generation-2026-11-03.json). Private artifacts `/srv/hackathon/artifacts/demo-audio-20261103/`. No production backend/model config changes. Static deployment pending below.

### Completed: theme / spacing polish deployment

Active release `/srv/hackathon/rally-deployed/releases/a0e3c4a-theme-spacing` (UI3b9e81d, theme metadataa0e3c4a). Branch `fix/theme-and-spacing-polish` mergedmain. Final public theme/keyboard/print test passed on exact release; previous public workflow and48 strict screens passed against identical UI/CSS bundles. Backend byte-identical, API PID755639 never restarted, healthgood, private SQLite backups saved before switches. Normal public app still requires invited account/MFA. No paid calls or real meeting tests.

Final coverage: 20 frontend units/typecheck/build;288 local strict visual states plus48 public =336; complete72second/17participant-turn replay with theme/resize/history stress and stable bounded heap; actual PDF; keyboard/Escape/focus/theme sync/reduced motion; isolated feedback/security/setup/history integration suites, including dark sign-in and named-account report grants/revocation. Chromium automation; no physical Safari/iOS claim. Source, docs and validation scripts pushed to main. Refresh existing tabs to pick up static changes.

[Authoritative polish report](theme-spacing-polish-2026-11-03.md). Private before/after gallery and `validation-summary.json`: `/srv/hackathon/artifacts/theme-polish-20261103/`. Existing video05 and submission preparation remain as before. No additional UI work pending from this request.

### Theme polish deployment and final browser-color detail

Frontend release `3b9e81d-theme-spacing` deployed after private SQLite backup. Backend byte-identical to previous release; API PID755639 unchanged; API healthy. Public workflow (including protected normal site even with `?demo=1`) passed, followed by48 strict public dark/light screen states with zero page errors, API/socket requests, measured contrast warnings or layout violations. Local matrix288 + public48 =336 checked screenshots. No paid model calls.

A final theme-init patch synchronizes `meta[name=theme-color]` with resolved dark/light/system appearance, so mobile browser chrome can follow the palette. Keyboard/theme-sync/reduced-motion/print regression passed again, including metadata checks in both themes. Final patch release and verification recorded next. [Full polish report](theme-spacing-polish-2026-11-03.md).

## Theme and spacing polish — 2026-11-03

Owner requested autonomous overnight dark-mode/spacing fixes and extensive testing. Branch `fix/theme-and-spacing-polish`, worktree `/srv/hackathon/rally-public-demo`. Dark document canvas fixed, surfaces tokenized, padding/typography/Back alignment corrected, readable secondary copy in both themes, agenda decimals bounded. Mobile start controls precede full plan; live presence compact enough for guidance. Demo banner uses measured height, settings hide unavailable voice controls, short-laptop welcome fits both sections. Demo reload clears stale ephemeral deep links without an error. Ordinary app account/MFA/API policy retained.

20 frontend units/typecheck/build pass. Final strict matrix: 240 screens across10widths/both themes/12states plus48 short-laptop captures; zero checked contrast/surface/overflow/modal violations, errors or API/socket requests. Full72second natural sample replay with17 finalized participant turns, viewport/theme switching and8 history cycles passed; actual browser PDF, complete report/evidence and reload cleanup passed. Keyboard/theme sync/reduced motion/print tests pass. Existing feedback/security/setup/history suites passed against isolated synthetic fixtures, including dark sign-in. No paid model calls or real meeting access. [Full findings, tests and limits](theme-spacing-polish-2026-11-03.md). Private artifacts/gallery `/srv/hackathon/artifacts/theme-polish-20261103/`. Static deployment and public smoke pending below this entry.

Final public rehearsal passed on4f86f4e: actual workspace/create modal/start/streaming partial+final turns, pause/resume, speaker labeling, Ask Rally, empty check-history state, end/report, JSON export, browser print invocation, mock grant/revoke, evidence navigation, desktop/mobile/reset. Only static demo assets requested, no page errors or mic/screen/WebSocket calls. Fresh normal page with `?demo=1` still requires login and `/api/auth/me`401. Earlier staging guard caught that the guarded demo module changes the normal bundle bytes; normal assets were preserved and the atomic switch completed before this final successful rehearsal.

### Simulated workspace deployment

Implementation d6791bf plus adapter/history fix4f86f4e merged to main from feature/simulated-regular-demo. Active static release `/srv/hackathon/rally-deployed/releases/4f86f4e-simulated-workspace`. First regular-UI deployment and public browser rehearsal passed; protected normal app was also checked with `?demo=1` and still shows login, workspace hidden and `/api/auth/me`401. Final history fix retained d6791bf normal app/renderer bundles while updating demo assets, because esbuild includes the guarded dynamic demo import in ordinary output (build flag remains false there). Production API remains byte-identical to161fbcc-web-status, PID755639 unchanged. DB backup saved before the regular UI deployment. No service restart or paid calls. Public final rehearsal result recorded after this entry.

Portable sample and actual site use the same UI source, not a separately designed demo screen. Owner local form draft updated to describe this normal flow. Check history in demo intentionally has no live model checks; it renders an empty state. All recipient grants and replies remain simulated and are explicitly labeled. Original demo video05 unchanged.

## Regular UI simulation — 2026-11-03

Owner clarified that demo should be the normal site with simulated services, not a separate sample walkthrough. Replaced standalone plan/replay/report page with a second build of the actual main.ts workspace/home/create-modal/live-meeting/report UI. Build-time API substitution (`demo-build.mjs`, `demo-api.ts`) provides in-memory records and a coherent fictional engineering discussion (`demo-simulator.ts`). `/demo.html` remains the public URL; portable demo/ remains runnable with Python only. Ordinary build uses real API and mandatory MFA; URL/query parameters cannot opt the regular app into simulation.

Demo automatically opens a fictional workspace with one completed sample. New meeting flow streams partial/final participant turns, separate scripted Rally replies, Ask Rally, approach modes, speaker labels, replay pause/resume, and end-to-report processing. Full sample report has evidence, conditional launch, confirmed owners and explicit unknown details. Reports only cite finalized script turns; early end does not invent later decisions. JSON download, browser print/PDF, mock recipient grant/revoke and local follow-up draft use regular UI. Sharing grants nobody real access. No voice generated/played. Reset/reload discards changes; theme preference alone persists. Edited agendas remain visible, but script remains the cache scenario; creation modal explains that.

Validation: 20 frontend unit tests and typecheck passed. Bounded real-browser workflow passed on portable sample including actual Create modal, prepare/start with simulated Teams choice, partial/final turns, replay pause/resume, speaker edit/XSS-safe text, Ask Rally, end/report, JSON export, mock sharing/revoke, source navigation, reset, desktop/mobile. No API/model/WebSocket requests, no microphone/screen-capture calls or page errors. Capped browser uses WebGL fallback in this environment. Added PDF print-path assertion for final public smoke. Separate branch `feature/simulated-regular-demo`. No paid calls. Deployment confirmation follows after release.

### Deployment confirmation — public judge sample

Feature `feature/public-judge-demo`, implementation `2827dfd`, fast-forwarded to origin/main. Static deployment: `/srv/hackathon/rally-deployed/releases/2827dfd-public-demo`. API process PID755639 remained running. Backend was copied byte-for-byte from `161fbcc-web-status` (main contains undeployed phoneme experiments; those were deliberately not promoted). SQLite backup created with mode0600. No API/media restart. Initial staging comparison caught source/backend differences and aborted before switching; the old-page predeploy smoke timed out. Corrected static-only staging and final PUBLIC smoke passed. Do not mistake main's experimental API sources for the running backend.

Judge credentials remain outside Git and are superseded for judging; no MFA/account reset performed. Owner local submission draft and private credential file annotated with credential-free path. GitHub anonymous404 persists; public source release and final public video URL remain owner submission items. No video changes or paid service calls in this work.

## Public judge demo — 2026-11-03

Owner supplied organizer guidance: no approved private credential channel; public repo/setup and three-minute video required, credential-free samples/evidence acceptable. Replaced shared judge-login delivery plan with `/demo.html`, an isolated static, explicitly synthetic interaction sample. No auth bypass, API route, model call, microphone or record grant. Full app MFA remains.

Source: `apps/rally-web/src/demo*`; build/export scripts create checked-in `demo/` portable artifacts. Judge local path: `python3 -m http.server 8000 --bind 127.0.0.1 --directory demo`. README evidence table separates sample, real recorded footage and full integration. Judge runbook updated. Local submission answers remain owner-side, outside Git.

Validation: frontend typecheck, 20 unit tests, and capped Playwright static browser rehearsal passed (play/pause/step/reset, evidence, speaker edit, passive/proactive, export, escaped input, desktop/mobile, zero API/model/WebSocket requests). Headless environment shows renderer text fallback when WebGL unavailable. Public post-deploy check passed at https://rally.tail703f9e.ts.net/demo.html: identical interaction checks, only five static page/asset requests, no console errors. Protected `/api/auth/me` anonymously401; `/api/health` healthy. Rebuild portable assets after changing sample source; provenance.json contains bundle hashes. No paid processing invoked. Prior video05 preserved.

# Rally current handoff — October 31, 2026

**November 3 voice availability:** direct AWS Seamless probe returns HTTP503 with “Speech service operates daily 7:00–19:00 America/New_York”. Endpoint is reachable; voice is unavailable outside declared service hours, separate from Muse accounting. Two recent production voice failures returned zero bytes. Active meeting preserved, no model switch/restart. [Diagnosis](voice-service-hours-2026-11-03.md). One AWS probe, cost unknown; zero new Muse calls.

**November 3 saved-draft recovery:** both drafts previously blocked by the old unknown-cost policy were explicitly prepared and now have ready plans with null errors. Two real Muse calls settled at $0.00720660; the old unknown report row remains unchanged. Frontend `161fbcc` describes saved failures as previous attempts and preserves backend `35f86ed` continuation. Refresh the meeting, paste the intended invitation and confirm consent. [Recovery and evidence](blocked-draft-recovery-2026-11-03.md).

**November 3 API continuation:** user explicitly authorized continued API use after checking Meta Billing. `35f86ed-api-continuation` is active, preserving frontend `817b08b`. `RALLY_ALLOW_UNKNOWN_COST_ESTIMATES=1` counts unconfirmed estimates against unchanged $6/$20 caps without blocking every request; actual cost remains unknown. Private backup and idle check preceded API restart. 159 backend tests and API typecheck pass. Existing drafts need explicit Retry agenda preparation; failed reports are not retried automatically. [Policy and verification](api-continuation-2026-11-03.md).

**November 3 meeting-setup update:** `817b08b-web-setup` is active with backend `6fa6e2f` and the history retry fix preserved. Invitations now clear between meetings; disabled Join explains missing plan/consent/link or a preparation error. Newest real meetings remain blocked by the existing unknown provider charge, so restoring paid preparation still needs billing reconciliation. Public MFA/setup/Join-dispatch checks and bounded local setup regression pass; 17 frontend tests/typecheck/build pass. Static switch only, private backup, API PID unchanged. [Diagnosis and evidence](meeting-setup-fix-2026-11-03.md).

**November 3 frontend update:** `624d52b-web-history` is active with backend `6fa6e2f` unchanged. A failed saved-record load can now be retried by clicking the same history item; previously the unchanged hash produced no navigation event. Public MFA/history/retry/report checks, desktop/mobile browser regression and 17 frontend tests/typecheck/build pass. Private backup preceded the static release switch; API PID unchanged. [Diagnosis and deployment evidence](history-navigation-fix-2026-11-03.md). No provider analysis retry or cost reconciliation was performed.

The public app is https://rally.tail703f9e.ts.net/ . Access requires an invited account and MFA. The agenda pronunciation update is deployed as `6fa6e2f` (including recovery and long-turn fixes); it preserves the static frontend from `a9f0004`. Source is pushed to main. The prior October31 readiness snapshot matched main `a2278e0`. [Fresh live UI readiness check](readiness-2026-10-31.md).

## Implemented

- Muse Voice Transcribe supplies streaming transcript evidence and anonymous session speaker labels. Native platform transcripts are not used.
- Muse Spark 1.3 prepares agendas, evaluates provisional/finalized speech against time and goals, answers addressed questions, and generates full reports. Passive/balanced/proactive settings retain host pause/stop control.
- SeamlessM4T-v2-large through the configured speech endpoint supplies streamed production voice. Local pinned Meta MMS is a configurable local voice and demo narration tool. Remote speech checkpoint revision is unknown.
- Integrated Teams voice/video uses one meeting engine and a Living Silk visual presence. Connected calls survive dashboard closure; End performs a bounded animated wrap-up, posts an authenticated summary link when chat permits, confirms Leave, and releases resources.
- Original agenda, speaker correction, durable host notes, named-account report grants/revocation, PDF/export, response history, mobile sheets, themes and explicit developer-sharing consent are implemented.
- Closed registration, MFA/recovery, admin role controls and owner isolation protect records.

## Evidence

Latest broad recorded regression: 144 backend tests and 17 frontend tests, both type checks/build and browser workflows. The October 31 [deployed UI measurement](research/current-ui-audit-2026-10-31.json) freshly passed MFA, closed signup, theme persistence, loading recovery, PDF, named sharing/denial/revocation with disposable synthetic records and zero model calls. Actual Teams rehearsal, chat hyperlink and normal Leave evidence are in [wrap-up](teams-wrapup.md). Local camera measurements are distinct from remote recipient acceptance.

## Demo and source preparation

[Current three-minute script](demo-script.md), [narration/footage provenance](demo-feedback-draft.md) and [submission draft](submission-package.md) describe the current product and separate actual model/meeting evidence from the synthetic walkthrough. The video remains a local artifact pending review; final submission is on hold. Preserve Meta/component attribution and accurate original-work disclosure.

## Remaining acceptance

Use the ordered [readiness list](readiness-2026-10-31.md): a 30–60-minute current-code real call and settled usage; remote camera/captions/duplex/echo; normal host-to-recipient End/report access; real mobile/background/network/MFA behavior; final video, source licensing/access and judge account rehearsal. WhatsApp guest joining remains experimental.

## Operations

Workspace `/srv/hackathon/rally-feedback`. API/web/media system services are `rally-integrated-api`, `rally-integrated-web`, `rally-integrated-media`; immutable releases and persistent state/configuration are under `/srv/hackathon/rally-deployed`. Before deployment, check active capture/report/usage, compare release ancestry, build fully and back up SQLite. Preserve MFA secrets, the shared Teams camera lock and runtime data. Shared-host browser checks must use the bounded systemd settings in AGENTS.md.

[API](backend-api.md) · [Model interfaces](model-interfaces.md) · [Presence operations](living-presence-operations.md) · [MFA/admin](mfa-admin-judge-audit.md) · [Deployment](integrated-deployment.md) · [Dated prior handoffs](handoff-history-through-2026-10-31.md).

## Long-turn correction and completed provider endurance

[Long finalized turns](long-turn-handling.md) now supply labeled source-coordinate windows to live reasoning without modifying canonical/report text. Two real synthetic-text checks passed in3.312/2.999seconds; deterministic coverage includes revisions, bounded proofs, direct-question identity and Unicode. [Deployment check](research/long-turn-deployed-2026-10-31.json) passes source matching, health and anonymous-access denial. The first backup attempt lacked permissions; the prior release remained active and was briefly restarted, then privileged backup and the final switch succeeded. No live production capture was interrupted.

The [65-minute real-provider experiment](provider-endurance.md) passed on source `51677f7`: normal 55-minute ASR handoff, 19 finalized turns, largest turn25,169characters, 389 accepted checks including319using long windows, eight completed speech requests with received output, and a report receiving all56,044canonical characters. One check was rejected near shutdown; one expected ASR continuity warning was recorded. Muse settled at **$3.28526990**, unknown0/running0; AWS speech cost is separate and unknown. It uses authored synthetic speech and isolated LiveKit, not Teams. A fresh consented Teams invite/admission remains required for the actual platform endurance trial.

## November 1 recovery and rehearsal preparation

[Current preparation evidence](recovery-readiness-2026-11-01.md): seven new recovery tests expose/correct stale-room callbacks and cleanup skipped after ASR drain exceptions.151backend/17frontend tests and both type checks/build pass. [Monday runbook](monday-live-rehearsal.md), [shot list and local edit workflow](demo-live-edit.md), [judge access rehearsal](judge-access-rehearsal.md) and [prepared entry text](submission-field-draft.md) are ready for review. The separate180-second edit guide visibly leaves all seven live slots pending. Source-license/contributor/artwork/access decisions remain explicit; no final submission/upload/message was made. Deployment status is recorded in the linked evidence after validation.

The recovery release is now live as `d0d4615`. [Deployment check](research/recovery-deployed-2026-11-01.json): idle check, private SQLite backup, matching tested engine source, active services, public UI/API200 and anonymous auth401. No live capture/report was interrupted. The focused local real-browser recovery test passed; broader browser chapters retain separate results.

Both bounded browser chapters passed (capture73.103seconds, records97.967seconds), plus the29-second focused recovery browser. The local180-second edit guide is complete with pending real-footage slots; tested source-video/audio replacement uses clearly synthetic fixtures. Private source ZIP inspection passed the recorded filters. No paid provider calls, external invitations, video upload or final entry occurred. [All evidence and remaining owner inputs](recovery-readiness-2026-11-01.md).

## November 1 speech revision

[Pronunciation and sentence-pacing work](speech-naturalness.md) is deployed as `080cf83`. Local MMS now synthesizes sentences with deliberate pauses; both voice adapters share technical-term/operator pronunciation preparation while canonical/display text stays intact. The hosted Seamless service still controls its own acoustic prosody. A fresh local demo candidate under `artifacts/feedback/voice-natural-v1/` is exactly180seconds with no narration speed-up; same-text before/after WAVs are available. Listener acceptance is pending.152backend/17frontend tests,20local speech/presentation tests,3Python prosody tests, both type checks/build and focused real-browser recovery pass. The unrelated clock-sensitive MFA replay test is now pinned to one timestep; production auth is unchanged. One new non-retrying hosted synthetic speech request has unknown AWS cost; zero new Muse calls, no platform join or submission. [Samples, measured timings, cost and public deployment evidence](research/voice-quality-2026-11-01.json).

## November 1 local pronunciation reference

[Local pronunciation preparation](pronunciation-reference.md) is deployed as `9bca78a`, including the pinned126,052-entryCMU dictionary/full notice and explicit Meta brand/technical-term references. Both speech adapters compile their preparation once; warmed1,200-character checks measured0.087ms at95th percentile, with145ms one-time cold load. Corrections target Meta/evidence through model-specific spellings; uncertain names/homographs remain original and the current models still lack verified direct phoneme control. The new180-second local demo is under `artifacts/feedback/voice-lexicon-v2/`, with no narration speed-up and original captions. Listening acceptance remains pending.153backend/17frontend tests,25local speech/reference tests,3Python prosody tests, both type checks/build and the focused actual-browser recovery check pass. Public UI/API200 and anonymous auth401 pass after idle check/private backup/restart; no active capture was interrupted. One new hosted sample has unknown AWS cost, zero new Muse calls, no platform join or final submission. [Measurements, sample provenance and deployment](research/pronunciation-reference-2026-11-01.json).

## Agenda pronunciation follow-up

User reported agenda still mispronounced. The shared correction now supplies `ajenda`/`ajendas` to MMS while retaining whole-sentence flow, original captions and canonical records. Hosted Seamless retains normal spelling pending evidence of the same hosted error. Release `6fa6e2f` is deployed and pushed after idle check/private SQLite backup; public UI/API200 and anonymous auth401 pass. New exact180-second draft: `artifacts/feedback/voice-agenda-v3/rally-three-minute-narrated-draft.mp4`, plus before/candidate/alternative sentence WAVs. Listening acceptance remains pending.27local speech/reference tests,3Python tests,19targeted API speech tests and API typecheck pass. Preparation measured0.079ms at95th percentile for1,200characters. [Evidence](research/agenda-pronunciation-2026-11-01.json). No new paid provider requests, meeting joins or final submission.

## November 2 selected-source TTS pilot

[Jobs comparison](jobs-tts-pilot.md) selects Stanford's official YouTube address; actual analysis uses a documented podcast copy after YouTube extraction was blocked. The21-word original and local MMS each scored0%Muse WER, with13.4s versus6.496s duration and clear pause differences. These are intelligibility/timing diagnostics, not naturalness scores. A private standalone matched-loudness randomized listening page is ready at `artifacts/feedback/jobs-tts-pilot/listening.html`; human ratings pending. One Seamless request failed (adapter502), cost unknown, no retry. Muse batch$0.00320000; tracked$5.34166965, conditional unverified-$150 remainder$144.65833035. Four metric tests, API typecheck and bounded listening-page browser smoke pass. No deployment, meeting join, upload or submission.

## November 2 direct-phone prototype

[Opt-in Meta phoneme synthesis](phoneme-speech-prototype.md) implements a deterministic CMU/explicit ARPABET frontend, pinned Meta FastSpeech2 plus its bundled HiFi-GAN, and both shared speech interfaces. Real local HTTP and simulated browser/Teams transport tests produce actual model audio while preserving canonical wording and local cost/provenance. This is a source prototype; production voice is unchanged. Unknown/ambiguous words and unsupported numeric/symbol normalization fail explicitly. Listener naturalness/pronunciation acceptance and an actual recipient call remain pending. [Primary-source feasibility and immutable artifact details](research/meta-phoneme-backend-feasibility-2026-11-02.md). No paid model calls or final submission in this work.

Final prototype evidence: clean candidate `d620008` generated 80/80 corpus WAVs. Direct-phone validation complete-waveform median/P95 was 941/1149 ms after a 2084 ms worker cold start; phone planning P95 was 0.017 ms. Five offline matched-loudness listening pairs and their browser decode/export check are ready; human ratings remain zero.158 backend,17 frontend,46 shared/local speech and9 native-model tests pass, with both type checks/build. [Measurements](research/phoneme-prototype-results-2026-11-02.json).

[Laptop continuation handoff — November 2](laptop-handoff-2026-11-02.md): current source/deployment, listening archive transfer, test evidence, next actions and operating constraints.

## November 2 human listening feedback

[Five paired preferences](phoneme-listening-feedback-2026-11-02.md): direct-phone Meta preferred on3/5, MMS on2/5 (both agenda phrases). The user reports **postpone mispronounced in both**. No numerical ratings or overall production acceptance; production remains6fa6e2f. Next: investigate postpone and prepare targeted comparison before any voice promotion. [Structured record](research/phoneme-human-listening-2026-11-02.json). No new synthesis/paid calls.

## November 2 market scan

[Read AI and close alternatives](research/meeting-market-2026-11-02.md): vendor-documentation scan, no trial accounts or purchases. Read overlaps on live metrics/coaching; Teams Facilitator is a direct agenda/timing competitor; Otter documents Zoom voice Q&A; Fireflies/Hedy offer live suggestions. Proposed positioning centers on evidence-backed team outcomes, not unique transcription/voice claims. Production unchanged.

[November 3 presenter recording package](demo-presenter-recording-2026-11-03.md): human intro/problem/product/Meta-role script, free capture tools, B-roll cues and raw-file handoff for a three-minute review edit. Recording and new compositor work remain pending.

## November 2 demo edit and usage investigation

The laptop session is assembling the user's26portrait phone takes from Downloads/Photos-1-001(3).zip. Working files remain local in Downloads/Rally Demo Edit2026-11-02, originals preserved. A clean presenter cut and180-second assembly with explicitly marked pending live-demo slots are being prepared; source audio stays at original speed. User is locating B-roll; no video uploaded or submitted.

[Production unknown-report cost investigation](report-cost-incident-2026-11-02.md) found one failed final-report request without returned token usage, reservation$0.253929. The app-wide unknown-cost guard is blocking paid work.223transcript turns remain saved. No ledger edits, provider retries or guard bypass were performed.

## November 2 finished demo review master

[Human presenter + real-footage edit](human-demo-edit-2026-11-02.md):180second1080p30review master with four real Teams excerpts and website GIF. Private files under `artifacts/feedback/human-demo-20261102/`; laptop originals/intermediates remain in Downloads/Rally Demo Edit2026-11-02. Separate120second presenter cut retained. Full decode and duration/frame count checks pass. Completed-report/PDF close-up and final listener approval remain pending. No paid calls, production changes, public upload or submission.

## Demo video version02 — November2

Version02replaces the reviewer-name discussion with23.5seconds of actual streaming transcription from the new user-supplied Teams recording. Audio and partial-caption progression remain at original speed. The final closing card is one second shorter to preserve exactly180seconds/5400frames at1080p30. Reviewer-name references are removed from both the replaced audio and sidecar captions. Version01is preserved byte-for-byte.

Local numbered exports: Downloads/Rally Demo Edit2026-11-02/`01 - Rally - 3 Minute Demo.mp4` and `02 - Rally - 3 Minute Demo.mp4`. Private server copy and edit/verification records: `artifacts/feedback/human-demo-20261102/versions/02/`. Version02SHA256:`7d7489d75e67b815246bc9ec76008b3f5b74dade7276fe91b086ef99586086f2`. Full decode, duration/frame count and previous-version hash checks pass. The replacement runs from1:27.47to1:50.97and uses source6.0–29.5seconds of Meeting with Eric Offermann-20261102_222047-Meeting Recording.mp4. The earlier real Rally speech sample remains. No new provider calls, service changes, public uploads or submission. Completed-report/PDF close-up and final listener review remain pending.

## Demo video03 and local submission preparation

Numbered version03adds muted group-meeting footage beside the human presenter, more real website/transcription footage in place of text cards, and a full-gallery view during one live guidance excerpt. The entire version02AAC audio stream is copied unchanged, and its live-transcript section remains intact. Participant tile name badges are masked. Exactly180seconds/5400frames at1080p30; full decoding, prior-export hashes and audio-stream hash comparison pass. Version03SHA256:`19acbe6d572400ba4cd7924dc9b07c5149898ec57c62c470b603eaaf92ba4a8c`. Private server copy: `artifacts/feedback/human-demo-20261102/versions/03/`; local export: Downloads/Rally Demo Edit2026-11-02/`03 - Rally - 3 Minute Demo.mp4`.01and02are retained. No public upload/submission or provider call.

The owner supplied the exact submission questions. Their running draft is local at `C:/Users/Eoffermann/code/meta-hackathon-2026/docs/submission-form-working-draft.md`; keep that local file authoritative rather than copying unapproved survey responses into Git. It includes a judge invitation, provisional ratings, verified-model attribution, contributor/track review and pending final links. Anonymous GitHub access still returned404during preparation.

The owner explicitly requested judge username/password access. A dedicated ordinary user account was created and its password verified, without granting access to others' records, weakening MFA or changing any administrator account. Credentials are only in the owner's separate private Downloads file, outside Git. Current MFA enrollment is still required; owner choice between individual MFA access and a temporary judge-only password flow remains pending. The earlier no-shared-account sentence was an internal draft recommendation, not an event rule or an owner prohibition; it must not be presented as binding.

## Demo version04 — homepage opening

Version04changes only the post-cold-open left-side UI insert at6.10–13.03seconds. It shows the actual Rally home page from rally1.gif, holds for3.5seconds, then resumes the real pointer/New meeting click and creation dialog. Source GIF frames were decoded/composited sequentially to avoid seeking/disposal artifacts. Browser chrome/login/MFA are excluded; homepage hero, Meta cards and New meeting navigation remain visible. Presenter, version03audio, caption text and all subsequent timeline content are retained. Exactly180seconds/5400frames at1080p30; full decode, audio-stream hash match and preservation of01–03checks pass.

Local export: Downloads/Rally Demo Edit2026-11-02/`04 - Rally - 3 Minute Demo.mp4`. Private server copy: `artifacts/feedback/human-demo-20261102/versions/04/`. SHA256:`21f956a6e35602b4c6cab8b80bbfd0705391c52020f7fa5509e523a8dda301e0`. The local form working draft now points to04as latest. No provider calls, production changes, upload or submission. Earlier numbered exports remain intact.

## Demo version05 — continue the new-meeting flow

Version05extends the post-cold-open website insert through21.93seconds: homepage,3.5second hold,Create click,title and agenda entry. It replaces the return to the problem slide at13.03seconds, then transitions directly into the unchanged group-meeting shot. The version04soundtrack/caption text and subsequent timeline content are retained. Brief isolated GIF home-screen flashes during modal entry are suppressed by holding the preceding real modal frame. Exactly180seconds/5400frames at1080p30; full decode and audio-stream hash match pass.01–04are preserved.

Local export: Downloads/Rally Demo Edit2026-11-02/`05 - Rally - 3 Minute Demo.mp4`. Private server copy: `artifacts/feedback/human-demo-20261102/versions/05/`. SHA256:`f586149c984b2265252f9496e33d5cf4aaa774d1801cd8f53ca480a988953c07`. The local submission working draft points to05as latest. No provider calls, production changes, upload or submission.


## November 3 — video 06 and own-key judge setup

[Continuation handoff](video06-judge-readiness-handoff-2026-11-03.md) records the new numbered export, private droplet artifact path, merged setup changes,191passing unit tests/HTTP bootstrap, and remaining GitHub/Nexus access limits. Production UI unchanged; no paid provider calls.


## November 3 — repository presentation and welcome control

User explicitly requests keeping GitHub private, no package publication to Nexus, and no further demo-video improvements for now. [Repository presentation record](repository-showcase-2026-11-03.md) covers the product-first README,747KB fictional-data tour, starter/dev guides, issue/PR templates, read-only docs workflow and local verification. No dependency downloads or package publishing occurred. docs/assets/provenance.json records the synthetic capture and checksums. Existing maintainers' index is preserved as maintainer-notes.md; the main docs index is now user/developer oriented.

Reported welcome-control problem on the regular site: source fix23d31f4 on fix/welcome-checkbox-visibility is merged. Dedicated18px checkbox/label row remains off by default, and previously started meetings explain why the selection is unavailable. Web typecheck,26unit tests,build and bounded fixture-browser desktop/mobile label-click/checkbox-size/join-payload checks passed. Static frontend-only promotion to `/srv/hackathon/rally-deployed/releases/23d31f4-welcome-checkbox` copied the active backend unchanged; no API restart or production DB write. Local served HTML includes the new label and API health stayed OK. Physical real-Teams welcome playback was not retested by this change. Prior release1a33198-optional-greeting remains available for rollback.


## README dark-mode media — November 3

User requested the README GIF in dark mode. Recaptured the same fictional portable sample with the actual `rally:appearance` preference set to dark and asserted `data-theme=dark` before all13screenshots. Replaced docs/assets/workspace-tour.gif and the matching still; refreshed provenance hashes. Zero external capture requests or model calls. Documentation checks passed. App code/deployment, repository visibility and numbered demo videos unchanged.


## November 3 — merged branch cleanup

[Cleanup audit and recovery refs](branch-cleanup-2026-11-03.md):25fully merged GitHub branches removed atomically with expected-tip checks; only main remains. All local branches/worktrees retained. No unique work, deployment, video or visibility changed.
