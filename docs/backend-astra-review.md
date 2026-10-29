# Backend Astra review and expanded validation

October 29, 2026. User requested several Astra agents to review, test and refine the whole backend. Three `gpt-6-astra` agents independently handled [correctness](backend-astra-correctness.md), [media](backend-astra-media.md), and [AI quality](backend-astra-ai-quality.md). Backend scope only; no frontend/deployment changes or external meeting joins.

## What was actually exercised

| Layer | Evidence | Boundary |
| --- | --- | --- |
| HTTP / state / SQLite / accounting | 25 full-suite tests pass, including 17 added checks covering races, every owner-protected meeting route, capacity, usage retention, unknown-cost gates, paced audio, final drain and quality fixtures | Providers are injected in deterministic tests; these are not paid-model accuracy results |
| Browser ↔ LiveKit ↔ Node | Real Chromium and local media server, actual audio signal in both directions and JSON event; mute/unmute, browser reconnect, backend rejoin while microphone remains published all pass | Synthetic oscillator, no physical microphone or impaired network |
| Real agenda model | Both user-style terse agendas and detailed review generate usable plans; corrected duplicate wrap-up behavior verified by targeted real retest | Three input shapes, not broad coverage |
| Real reasoning over realistic text | 19 authored turns, three named speakers plus an unattributed offer; actual agenda, drift assessment, full final report; evidence validation and manual Astra review | Injected transcript and synthetic timeline, not ASR output |
| Real complete audio pipeline | 60.336-second original single-voice Meta MMS fixture → LiveKit → real Muse ASR → six scheduled/explicit assessments → one eligible intervention → full stored report | Six real turns; ASR name errors and voice over-segmentation remain visible; no multi-person accuracy claim |
| Maximum-effort report failure/recovery | Initial 16,384 completion-token report failed visibly; explicit report-only retry at 32,768 completed with correct extraction | Retry was deliberate and billed; no automatic retry or hidden partial result |

The audio run made six assessments total: the normal 10-second loop plus a final explicit guidance request. It did not merely call the guidance function once after feeding all speech. The final report retained the complete finalized transcript.

## Fixed defects

1. Backend reconnect did not subscribe to existing microphone publications, silently losing incoming audio. Reproduced in an actual browser/media server test; fixed and retested with signal-energy assertions.
2. Ended meetings with running reports consumed capture capacity and blocked the host's next meeting. Count only live capture; retain ended room only for report events.
3. Failed audio startup overwrote accepted concurrent agenda edits. Reload current state before restoring lifecycle fields.
4. Missing timestamps sorted transcript IDs lexically. Preserve source session and numeric turn order, including reverse finalization arrival.
5. Delete raced with final ASR drain. Reject deletion while ending and include drained speech in the report.
6. Maximum-effort final reporting could exhaust the original completion allowance. Increased to 32,768; actual effort/token allowance and finish reason are recorded in usage metadata.
7. Detailed agenda prompt duplicated an existing closing allocation. Reuse supplied closing time as wrap allocation; real retest preserves original topic budgets.

All changes are small extensions of the existing single-process design. No queue, ORM or extra application service was added.

## AI examples and interpretation

[Actual AI examples](backend-ai-examples.md) show terse/detailed agenda inputs, generated structures, live guidance, due-outs, scores with quoted evidence, and speaker tips. [Full JSON](research/backend-ai-examples.json) preserves exact outputs, including weaknesses.

Manual review accepts the realistic text report's conditional decision, three assigned tasks, corrected Thursday deadline, late accessibility condition and unresolved email/accessibility/support-checklist ownership. It does not establish calibrated scoring or universally helpful coaching. Prompt clarifications now avoid blaming useful self-corrections, penalizing future agreed work merely for being future, assuming early completion means good pacing, or attributing transcript errors to a person's behavior. Those last clarifications were added after the captured paid outputs and have not been independently re-evaluated with another paid call.

The audio test's single synthetic voice became two speaker labels; “Alice” became “Ellis”/“Alyssa.” The report conservatively left that owner unresolved. Name correction and review remain important. No backend test establishes physical-device behavior, constrained network performance, human multi-speaker diarization accuracy, or production recovery.

## Costs and delivery

This pass made 17 paid operations totaling **$0.28876035**, including the failed report. Cumulative tracked estimate: **$0.47338150**; conditional $150 remainder: **$149.52661850**. Unknown charges: **0**. The actual grant and Billing balance remain unverified. [Usage ledger](research/muse-cost-ledger.md).

Typechecking and the full suite pass. Test processes were stopped after their checks. Shared ignored secrets and existing private Sites access remain unchanged. Implementation and review fixes were committed as `50bfab1` and pushed to remote `main`. See the [team handoff](backend-team-handoff.md) for the current documentation entry point.
