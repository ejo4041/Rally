# Rally overnight results

Status: research/design deliverables and bounded experiments complete in the active session on October 28, 2026. See [work queue](overnight-plan.md) for priorities, boundaries and completion criteria. No persistent scheduler is configured and no paid batch remains running. Physical-device/account-dependent work is explicitly deferred, not silently completed.

## Deliverables

| Work item | State | Deliverable |
| --- | --- | --- |
| Connected audio → moderation | Complete, one easy real pipeline trial | [Connected benchmark](research/connected-loop-benchmark.md): 1.3208s from policy-qualifying estimated speech end to validated redirect; audio continued concurrently. No audible playback measured. |
| Browser audio/TTS | Research complete; device checks unrun | [Implementation notes](research/browser-audio-implementation.md): capture/resampling, speech adapter, actual start/cancel, echo and manual checks. |
| Teams participant route | Research complete; account/meeting spike unrun | [Integration plan](research/teams-implementation-plan.md): Recall first, one alternative, pricing, retention, admission and one-day gate. |
| Moderator/evidence policy | Build-ready recommendation complete | [Architecture](rally-architecture.md): deterministic authority, cancellation epochs, explicit confirmation, revision-bound evidence, unknown speakers. |
| Harder conversational audio | Fixture and two real ASR passes complete | [AMI results](research/ami-benchmark.md): 4 annotated speakers, 113 reference tokens; diagnostic WER 27.43% ENDPOINTING and 21.24% DIARIZATION. Overlap/tokenization caveats; no speaker-accuracy claim. |
| Demonstration and related-product research | Research complete | [Related products and integrations](research/meta-integration-options.md): related functionality, product scope and demonstration outline. |
| Extra Meta models | Research/gates complete; no extra model calls | Same research document: asynchronous Wonder audit only after core works; open-weight eligibility/prerequisites; defer SAM/camera scope. |
| Architecture/backlog | Recommendations complete | [Architecture](rally-architecture.md), [ordered tickets](implementation-backlog.md), [roadmap](rally-roadmap.md). |
| Reliability/cost controls | Recommendations complete | [Failure behavior and cost model](reliability-and-cost-model.md). |
| Index/roadmap/handoff | Updated | [Index](README.md), [handoff](handoff.md). |

## Main decisions supported by evidence

1. Begin implementation with the browser vertical slice and a real-device audio diagnostic, not more model research. Muse access and the connected reasoning stage now work.
2. Start with ENDPOINTING plus Spark minimal. Keep speaker identity correctable/unknown and benchmark real meeting overlap separately.
3. Put immediate host stop and stale-response rejection in the first spoken loop. Do not let Rally confirm its own voice as a participant action.
4. Keep Teams outside the critical path. Existing Teams hosting helps, but a managed bot still needs account access, reachable page, lobby admission, tested speech output and retention configuration. Recall Output Media includes a video tile; use it for agenda/status.
5. Pitch a measurable closed-loop experience, not “first talking meeting assistant.” Reviewed competitors already offer live/active assistance. No source establishes they lack Rally-like confirmation or evidence features.
6. Treat optional Wonder as an asynchronous audit, not another model in every live turn. Prioritize reliability over service count.
7. Clean audio is not representative of meetings. The AMI excerpt had material omissions/substitutions, so confirmation and evidence integrity are core product work. DIARIZATION's lower diagnostic WER here is useful evidence, but one excerpt does not select a universal mode or prove correct speaker attribution.

## What is not completed

- No browser app/product has been built or deployed. Diagnostic scripts are not the product.
- Actual audible response/cancel latency, room mic/echo, phone compatibility, named-speaker introductions, real commitment confirmation, Teams joins and provider retention have not been tested.
- No new provider accounts, signups, paid non-Muse calls, calendar writes, external messages or public deployment occurred.
- Proposed technical architecture, host choice and optional integration admission remain reversible; product scope follows the agreed interview.

## Costs

Starting tracked estimate: $0.04429085. Connected-loop batch: $0.00225075. AMI batch: $0.00520000. **Additional estimated spend for this work: $0.00745075**, below the $0.50 ceiling. **Cumulative tracked estimate: $0.05174160. Conditional remainder: $149.94825840**, assuming a full applied $150 grant and no other usage. No costs are unknown in the tracked ledger. Actual Billing balance remains unverified. [Current ledger](research/muse-cost-ledger.md).

## Morning review order

Read this page, inspect the harder-audio result when complete, then review R01–R07 in [build tickets](implementation-backlog.md). The next useful work is capture → actual speech playback → override on a real browser/device. Missing external access can be handled later; it does not block the browser baseline.
