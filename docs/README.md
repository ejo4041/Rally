# Rally documentation

**Morning update:** [Speech reliability fixes and isolated audio measurement](morning-reliability-2026-10-29.md) · [rehearsal checklist](morning-rehearsal.md). The app remains version 9; live Teams speech validation is pending.

**Current release:** [Version 9 — model interfaces and self-hosted Meta MMS browser playback](releases/2026-10-29-v9.md) is live on the existing restricted Site. Earlier version-7/local-only entries below are historical. Teams spoken output and fresh live pacing retry remain pending; final submission is on hold.

**Earlier October 29 build:** [Retrospective Teams review, measured Meta MMS speech, and submission audit](overnight-build-2026-10-29.md). Source changes are tested locally; deployed Site is still version 7. Live Teams/MMS playback validation remains pending.

**October 29 offline checkpoint:** [Teams saved-history implementation, tests, documentation and Git state](offline-progress-2026-10-29.md). New history code is local, not deployed. Live pacing-fix retry remains pending; no live test or paid call was run tonight.

**Earlier remote-access handoff:** [October 28 tonight handoff](tonight-handoff-2026-10-28.md) — personal/work account distinction, current deployment, live-test incident and fix, service commands, costs and next test. Consult the current release and morning update above first.

## First live transcription stop — investigation

The first user test ended ~26.5 seconds before its deadline with an ASR failure; the runner did not crash. A timer-drift/backlog defect was reproduced offline and fixed on the server, with sanitized termination diagnostics added. Exact original trigger was not retained and remains unproven. The idle runner was restarted and is ready; a fresh consented live retry is pending. [Evidence, fix and costs](research/teams-transcription-first-live-incident.md). Tracked spend $0.15263115; conditional grant remainder $149.84736885.

## Teams transcription POC — publication completed

Version 7 was published through the personal Codex session on the droplet and uses the normal Teams runner. [Deployment result](research/teams-transcription-deployment-result.md). The earlier [staging notes](research/teams-transcription-poc.md) describe a resolved workspace publishing blocker; consult the tonight handoff for post-deployment live-test findings and current costs.

Start with [current handoff](handoff.md) for status and next actions.

Current release: [Teams transcription POC deployment result](research/teams-transcription-deployment-result.md). Existing Site version 7 is live with the normal guest-browser queue runner; no ACS/app registration needed for this POC. The first live test worked initially and ended early; a server pacing fix is now installed, awaiting a consented retry.

Current conversation: [recovered session context and ACS transport clarification](session-continuation.md).

Current independent work: [overnight review list](overnight-plan.md) and [results checkpoint](overnight-results.md).

First implementation is built and privately deployed: [build verification](build-progress.md). App source: `apps/rally/`. Start morning review with [the current handoff](handoff.md), then open the private preview linked in the build report.

## Scope and rules

- [Hackathon participant guide](hackathon-participant-guide.md): supplied rules, dates, and rubric.
- [Brainstorm notes](brainstorm-notes.md): original ideas; not all are committed scope.
- [Planning interview](planning-interview.md): user decisions and follow-ups.
- [One-week roadmap](rally-roadmap.md): committed scope, daily gates, and deferred features.
- [Architecture recommendation](rally-architecture.md): module boundaries, meeting/utterance state, confirmation/evidence contract and persistence.
- [Ordered build backlog](implementation-backlog.md): small implementation tasks, dependencies, acceptance criteria and estimates.
- [Reliability and cost model](reliability-and-cost-model.md): failure/recovery behavior and transparent per-meeting forecasts.
- [Latency test plan](latency-test-plan.md): performance acceptance spike; no measured results yet.
- [Demo script draft](demo-script.md): three-minute presenter/participant script, future-platform closing and longer show-and-tell outline. Final submission remains on hold.
- [Demonstration walkthrough](demo-walkthrough.md): three-minute walkthrough and validation checklist.
- [API budget](api-budget.md) and [cost ledger](research/muse-cost-ledger.md): conservative limits, tracked costs, and conditional credit remainder.

## Research

Latest live Teams evidence: [normal Teams web client with working two-way server audio](research/teams-web-client-spike.md). This guest route needs no custom app registration or ACS resource; hosted Invite controls still use the separate ACS runner until adapted.

Local setup: [credentials instructions](credentials-setup.md). Store actual keys only in ignored `.env.local`, never in these documents.

Teams participant setup: [Azure calling credential instructions](teams-setup.md) and [deployed Site/runner integration](research/teams-site-integration.md). The phone-on-table browser mode remains the fallback; Teams participant work is the priority.

For discussions with a Microsoft/Azure administrator, use [the connection explanation and shareable admin brief](teams-admin-brief.md), including app-registration alternatives and actual implementation limits.

For the separate ACS runner: [app registration setup](teams-app-registration-setup.md), with [Microsoft-source fit and RBAC research](research/teams-app-registration-fit.md). App-registration authentication is implemented and retains its ACS resource requirement. The normal-client guest experiment above has neither prerequisite.

- [Initial feasibility](research/rally-feasibility.md).
- [Speech and Teams](research/rally-speech-and-teams.md), including the subsequent acceptance of existing GPT models.
- [Latency technical notes](research/rally-latency-technical-notes.md).
- [Measured latency results](research/latency-results.md): real reasoning tests and limited transcription access checks, with remaining gaps explicit.
- [Public reference-audio benchmark](research/public-audio-benchmark.md): real-time transcription accuracy and finalization delay against licensed LibriSpeech reference text; single-speaker baseline.
- [Connected ASR → moderator benchmark](research/connected-loop-benchmark.md): actual pipeline timing while audio continues; audible speech still untested.
- [Browser implementation research](research/browser-audio-implementation.md): capture/resampling, TTS, host controls and unrun device checks.
- [Teams implementation research](research/teams-implementation-plan.md): managed transport choice, cost, constraints and go/no-go spike.
- [Teams SDK local spike](research/teams-sdk-local-spike.md): installed Microsoft Calling SDK, successful server virtual-audio test and prepared meeting harness; real Teams join pending.
- [Teams SDK platform verification](research/teams-sdk-platform-verification.md): Linux/Windows requirements, ACS interoperability and current lifecycle guidance.
- [Related products and Meta integrations](research/meta-integration-options.md): related-product sources, integration requirements and multi-speaker audio fixtures.
- [AMI four-speaker diagnostic](research/ami-benchmark.md): licensed 50-second meeting excerpt, reference comparison, overlap/scoring caveats and actual costs.
- [Build code review](research/build-code-review.md): independent Standards/Spec findings and fixes.

Research documentation is not proof of actual account access or runtime performance. Record completed experiments and measurements separately.

## Model boundaries

- [Model interfaces and configuration](model-interfaces.md): Muse audio transcription, normalized adapter ports, configurable models and pricing.
- [MMS speech queue and browser playback](mms-playback.md): approved text, cancellation, local measurement and deployment requirements.

## Repository tooling

- [AI Hero skills installation](aihero-skills.md): requested workflows, supporting skills, pinned source, and verification.

- [Remote access and home preflight](remote-access.md) — local SSH, Omnigent setup, and pending phone/test steps.
