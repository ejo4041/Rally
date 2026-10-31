**Meta card polish:** [Illustrated capability cards and larger type](meta-capability-cards.md), branch polish/meta-cards-20261030 in the existing droplet workspace. Checks pass in both themes/mobile, with mascot unchanged.

**Current home mascot: same Living Silk as meetings, deployed/merged9c57bfe.** [Implementation and checks](rally-mascot.md), [public actual-WebGL evidence](research/rally-mascot-deployed.json). Main includes all previous work. Static assets9c57bfe; running API8054fb5 unchanged. Workspace `/srv/hackathon/rally-feedback`, branch polish/rally-mascot-20261030; resume phone session here and read these notes.

**Rally mascot follow-up:** [Same meeting visualization in the home hero](rally-mascot.md), real GPU/reduced-motion/lifecycle checks pass. Worktree unchanged, branch polish/rally-mascot-20261030.

**Current UI: Light/Dark/System + Meta showcase, merged and deployed.** [Scope and verification](appearance-and-meta-showcase.md), [public evidence](research/appearance-deployed.json). Main includes all prior feedback through2c8c0f5 and UI37d5740. Static assets37d5740; API8054fb5 unchanged/no restart. Droplet workspace `/srv/hackathon/rally-feedback`, branch `polish/meta-showcase-20261030`. Appearance selector is top-right; browser choice persists.

**Appearance/UI follow-up:** [Light/Dark/System and richer Meta showcase](appearance-and-meta-showcase.md). Prior feedback branch merged to main2c8c0f5; visual work isolated on polish/meta-showcase-20261030 in the same droplet workspace.

**Current application release8054fb5:** Graceful Teams wrap-up with13second minimum, verified rich summary hyperlink and confirmed Leave before camera teardown. [Implementation, live evidence, model costs and remaining user access confirmation](teams-wrapup.md). Branch `feedback/demo-polish-20261030`; no main merge.

**Latest Teams follow-up:** [Graceful wrap-up, chat link,13-second hold and validation limits](teams-wrapup.md). Native Insert link path passes local browser tests; final remote admission/check pending. Earlier local-close-only success was rejected by the user and corrected with Teams leave acknowledgement.

**Teams wrap-up follow-up:** [Animation, authenticated chat summary link and graceful leave](teams-wrapup.md). Branch/worktree unchanged; read this before further call lifecycle changes.

**Current UI asset release `7f2a634`:** Loading spinners, contextual Meta model labels and separate Rally response history deployed. [Public validation passes](research/loading-replies-deployed.json);17 frontend tests and browser/security checks pass. Static publication only: running API/media were not restarted, API source unchanged (`d5d2399`). Read [scope and limits](loading-and-rally-responses.md). Existing phone checkpoint remains valid; resume in this worktree.

**Latest UI follow-up:** [Loading indicators, Meta model attribution and Rally response history](loading-and-rally-responses.md). Same droplet worktree/branch; no new paid calls. See deployment evidence for current asset release.

**Current feedback release: `d5d2399` deployed from `feedback/demo-polish-20261030`; main remains `28df66f`.** [Deployed MFA/PDF/sharing/favicon checks pass](research/feedback-deployed-smoke.json), synthetic records removed. [Scope, model costs, tests and remaining manual checks](feedback-2026-10-30.md). Three-minute draft stays at `/srv/hackathon/rally-feedback/artifacts/feedback/rally-three-minute-narrated-draft.mp4`; no upload/submission. Server workspace `/srv/hackathon/rally-feedback`.

**Feedback polish branch:** `feedback/demo-polish-20261030`, server worktree `/srv/hackathon/rally-feedback`. [Completed scope, checks, costs and remaining acceptance](feedback-2026-10-30.md); [three-minute review draft](demo-feedback-draft.md). Runtime deployment status follows in the final checkpoint.

**Active feedback branch:** [October 30 feedback, priorities and progress](feedback-2026-10-30.md), worktree `/srv/hackathon/rally-feedback`. Existing deployment is unchanged while this work is in progress.

**Living presence:** [Merged implementation and validation](living-presence-implementation.md), [camera operations](living-presence-operations.md).

**Continuous monitoring:** [Accepted design](realtime-monitoring-plan.md), [backend/API behavior](realtime-backend-notes.md), [review and validation](realtime-monitoring-validation.md), [Rally display](realtime-ui-notes.md).

**MFA and judge access:** [Closed registration, enrollment, admin controls and opt-in transcript review](mfa-admin-judge-audit.md).

# Rally documentation

Start with the [current handoff](handoff.md). The integrated Node app and the older Sites preview are separate releases. Historical records preserve their original checkpoints; their old “current” status and cost figures do not describe today's deployment or verified Billing.

## Current integrated product

[Streaming speech implementation](streaming-speech-plan.md) · [Current public deployment, final review and tests](streaming-speech-validation.md) · [Public login/audio evidence](research/public-deployment-smoke-2026-10-30.json).


| Topic | Documents |
| --- | --- |
| Open/run/operate | [Deployment, access and rollback](integrated-deployment.md), [frontend setup](../apps/rally-web/README.md), [API setup](../apps/rally-api/README.md) |
| Latest validation | [Latest deployed HTTPS measurement](research/mms-ownership-release-deployed.json), [real MMS/browser workflow](research/integrated-speech-browser-check.json), [follow-up browser workflow](research/integrated-follow-up-browser-check.json) |
| Speech | [Meta MMS integration, configuration, lifecycle and eight-hour check](integrated-speech.md), [model/runtime provisioning](../experiments/meta-mms/README.md) |
| Speaker identity | [Anonymous sessions, reversible labels, stale reports and durable host notes](speaker-attribution.md) |
| Input checks | [Free local tab/microphone preflight](audio-preflight.md) |
| Follow-through | [Reviewed manual WhatsApp drafts](integrated-whatsapp-follow-up.md), [official-source check and device limits](research/whatsapp-manual-draft-check-2026-10-30.md) |
| Meeting connectors | [Teams invitation UI and bounds](teams-integrated-ui.md), [WhatsApp guest prototype](whatsapp-guest-prototype.md), [Meta call integration research](research/meta-call-integration-options-2026-10-30.md) |
| Demonstration | [Rehearsal packet](integrated-rehearsal.md), [three-minute script and future-platform close](demo-script.md), [longer show-and-tell/pitch](show-and-tell-script.md), [current access observations](research/submission-access-check-2026-10-30.md) |

[Local draft archive/privacy check](research/source-draft-archive-check.json) · [clean source reproduction](research/source-draft-reproduction-check.json). These are local preparation evidence, not a submitted entry.

[Transcription handoff and capture endurance](asr-session-handoff.md) · [two-hour MMS checkpoint, still running](research/mms-soak-two-hour-checkpoint.json).

## Backend and AI contracts

- [Backend team handoff](backend-team-handoff.md), [frontend API/streaming contract](backend-api.md), [AI processing diagram/rules](ai-processing.md), [actual agenda/outcome/score/tip examples](backend-ai-examples.md).
- [Model interfaces and configuration](model-interfaces.md): Muse transcription, reasoning, local MMS and normalized capability boundaries.
- [Backend implementation checkpoint](backend-implementation-status.md), [Astra review/fixes](backend-astra-review.md), [backend streaming research](research/backend-streaming.md), [initial implementation plan](backend-plan.md).
- [API budget](api-budget.md), [cost ledger](research/muse-cost-ledger.md), [credentials setup](credentials-setup.md). Credentials remain in ignored local/runtime configuration.

## Product and submission drafts

- [Participant guide](hackathon-participant-guide.md), [requirements/model-eligibility review](research/submission-requirements-meta-audit-2026-10-29.md), [submission draft](submission-package.md). Final submission is on hold.
- [Planning interview](planning-interview.md), [roadmap](rally-roadmap.md), [implementation backlog](implementation-backlog.md), [initial architecture](rally-architecture.md), [reliability/cost model](reliability-and-cost-model.md).
- [Original walkthrough](demo-walkthrough.md) includes earlier product controls; use the updated [integrated script](demo-script.md) for today's app. No complete human/device rehearsal or published video is established by automated tests.

## Earlier Sites release and checkpoints

- [Version 12](releases/2026-10-29-v12.md), [build progress](build-progress.md), [platform handoff](platform-progress-2026-10-29.md).
- [Sites browser-call instructions](browser-meetings.md), [presenter view](presenter-view.md), [MMS hosted playback](mms-playback.md), [capture verification](research/browser-capture-reliability.md).
- [October 29 morning reliability](morning-reliability-2026-10-29.md), [earlier morning rehearsal](morning-rehearsal.md), [overnight build](overnight-build-2026-10-29.md), [offline progress](offline-progress-2026-10-29.md), [October 28 handoff/incident](tonight-handoff-2026-10-28.md).
- [Teams transcription deployment result](research/teams-transcription-deployment-result.md), [first live incident](research/teams-transcription-first-live-incident.md), [normal web-client audio spike](research/teams-web-client-spike.md).

## Research and evaluation records

These distinguish documented capability, access experiments, actual model measurements and synthetic tests. A research proposal is not proof of deployed functionality.

- [Initial feasibility](research/rally-feasibility.md), [speech/Teams options](research/rally-speech-and-teams.md), [related products/Meta integrations](research/meta-integration-options.md), [free platform options](research/free-platform-options-2026-10-29.md).
- [Latency test plan](latency-test-plan.md), [technical notes](research/rally-latency-technical-notes.md), [actual latency results](research/latency-results.md), [connected ASR/moderation benchmark](research/connected-loop-benchmark.md).
- [Licensed single-speaker audio benchmark](research/public-audio-benchmark.md), [AMI four-speaker diagnostic](research/ami-benchmark.md), [independent build review](research/build-code-review.md).
- [Browser implementation](research/browser-audio-implementation.md), [Teams implementation plan](research/teams-implementation-plan.md), [Teams SDK local spike](research/teams-sdk-local-spike.md), [platform verification](research/teams-sdk-platform-verification.md).
- [Earlier ACS setup](teams-setup.md), [Teams admin brief](teams-admin-brief.md), [app-registration setup](teams-app-registration-setup.md), [RBAC research](research/teams-app-registration-fit.md), [earlier Site integration](research/teams-site-integration.md). The normal guest runner has different prerequisites from ACS.
- [Remote access](remote-access.md), [repository skills/tooling](aihero-skills.md).

Teams voice preparation: [Meta MMS output and remaining live moderation connection](teams-mms-output.md).

[Integrated Teams startup configuration incident](teams-startup-incident.md): missing Chromium library path, production-sandbox reproduction and correction.

[Successful live Teams trial: saved guidance and pause-to-intervention timing](teams-live-rehearsal-2026-10-30.md).

- [Live presence prompt caching: measured baseline, implementation and pending verification](research/living-presence-caching.md)

- [Living presence follow-up review and acceptance limits](research/living-presence-followup-review.md)

- [Deployed living-presence follow-up verification](research/living-presence-followup-deployed.json)
