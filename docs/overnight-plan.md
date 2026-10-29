# Rally overnight work queue

Prepared October 28, 2026 at the user's request. The user authorizes working through this list without further input and wants reviewable Markdown results and a morning handoff. Execute while the current session runs; no persistent scheduler has been configured and work after session shutdown is not guaranteed. Do not keep a session alive merely to wait for morning: complete useful work and leave a checkpoint.

## Review list

| Priority | Work item | Deliverable and completion condition | Limit |
| --- | --- | --- | --- |
| 1 | Connected streaming audio → moderation | Run the known licensed speech input through ASR and invoke minimal Spark on finalized evidence while audio continues. Measure true speech-end-to-validated-decision timing; distinguish this from audible playback. Save results and cost. | One brief pass initially; no repetitive benchmark |
| 2 | Browser microphone, speech and host controls | Official-source implementation notes for capture/resampling, streaming, phone/browser constraints, TTS voices/start/cancel, echo and barge-in. Concrete minimum diagnostic and manual device checks. | Research; no claim that physical devices were tested |
| 3 | Teams participant integration | Shortest managed-bot path in existing Teams environment; service choice, current documented pricing, live input/output and cancellation, permissions/lobby, retention, blocker checklist and go/no-go spike. | No account creation, joins, purchases, or admin changes |
| 4 | Moderator policy and evidence integrity | Build-ready state transitions, transcript turn revisions/order, intervention eligibility, confirmation rules, missing details, stale-result cancellation, timer/cooldown behavior and acceptance cases. | Preserve agreed scope; recommendations labeled |
| 5 | Harder audio validation | Locate a licensed short multi-speaker/conversational source with independent transcript; document access, attribution and scoring strategy. Test a small excerpt only if preparation is straightforward and budget permits. | Avoid large corpus downloads and uncertain rights; mark unrun work |
| 6 | Demonstration and related-product research | First-party related-product references, a product walkthrough, a three-minute recording outline and a validation checklist. | Distinguish vendor descriptions from hands-on comparison |
| 7 | Meaningful Meta model use | Identify a useful optional Wonder audit and open-weight path, including actual eligibility/prerequisites. Admit extras only after core-loop value is clear. | Docs first; no model-count-driven scope expansion |
| 8 | Minimal architecture and build tickets | Recommend reversible stack, module boundaries, persistence/schema, audio/provider adapters and deployment needs, with ordered small tasks and acceptance criteria. | Architecture/task planning; no full product build or deployment |
| 9 | Reliability and cost controls | Failure/reconnect/timeout plan, session limits, token limits, account-key handling, deletion/retention checklist and expected per-meeting cost model. | Distinguish forecasts from measured or invoiced cost |
| 10 | Roadmap and morning handoff | Update daily milestones, dependencies, feature cuts, documented findings and unresolved access/device checks; summarize decisions needed only if unavoidable. | All substantive outputs in Markdown, index and handoff current |

## Work boundaries

- Research and small reversible local experiments are authorized. Continue independent work if one item is blocked; record its reason and next step.
- Overnight Muse experiment ceiling: **$0.50 estimated in additional tracked spend**, much lower than the development ceiling. Per-run limits remain in force; stop paid work if costs become unknown or access/rate errors occur. Do not spend merely to use the allowance.
- Starting tracked estimate: **$0.04429085**, conditional $150 remainder **$149.95570915**. Actual applied grant and Billing balance are unverified. Report cost after paid batches and in the final handoff.
- No external messages, new service signups, charges for other providers, tenant/admin changes, or public deployment. Document prerequisites rather than guessing credentials or requiring input overnight.
- Muse stays the intelligence backend. Browser speech first; existing OpenAI voice options are acceptable for future comparison, but no OpenAI credential is configured or assumed.
- Keep confirmed user choices in [planning interview](planning-interview.md). Research recommendations may refine implementation without silently changing scope.

## Running status

- Queue executed in the active session. All ten areas have research/design deliverables, with the connected loop and a harder AMI reference-audio test completed. Physical device checks, account-dependent Teams joining, and full product implementation remain explicit follow-ups. Review [overnight results](overnight-results.md) and [current handoff](handoff.md). No persistent scheduler is configured; no additional paid batches are running at this checkpoint.
