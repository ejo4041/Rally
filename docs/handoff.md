# Rally current handoff — October 31, 2026

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
