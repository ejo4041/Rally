# Recovery and rehearsal preparation — November 1, 2026

The 65-minute provider result remains the [October 31 measurement](provider-endurance.md), pinned to its source. This follow-up adds deterministic failure-path tests and real-footage preparation; it is not another paid/human meeting trial.

## Recovery corrections

Seven new production-engine tests cover End during active streamed speech, full final transcript drain/exactly one report, explicit reconnect with stale ASR/media callbacks, interruption after failed ASR drain, shutdown after failed ASR drain or media cleanup, and shutdown while a report is in flight.

The initial targeted invocation passed two and failed three tests. The reconnect failure reproduced a closed room adding a gap to the replacement capture. The two drain failures reproduced exceptions skipping media cleanup and terminal state. Media callbacks now verify they still own the active capture. Interruption/shutdown drain the source and always attempt socket and media cleanup; failure remains visible and saved text survives. Reconnect is explicit; no model request is automatically retried. A sixth test additionally checks media-cleanup failure containment.

All seven recovery cases and the adjacent rotation/streaming tests pass (23 tests). The full backend suite passes151 tests; frontend passes17 tests, both type checks and frontend build pass. The first fresh browser run stopped at a stale test selector for the removed participant-roster setup field. The test now asserts that field is absent and explicitly selects microphone capture; viewport screenshots replace full-page captures under the shared-host limits. The broader browser runs progressed through preflight/capture/controls but reached the120-second test-unit limit. They are not counted as full passes. Capture and records are now separate bounded chapters. A new [focused actual browser/HTTP/MFA/SQLite/LiveKit recovery check](research/recovery-browser-2026-11-01.json) passed in29seconds: reload reattached without another ASR session, lease refusal stopped real tracks, no automatic report/restart occurred, explicit restart recovered, End drained four finalized turns and the visible report failure succeeded only after explicit retry. Browser errors0. Additional chapter and deployment checkpoints are recorded below after completion.

## Demo and owner rehearsal

[Monday's runbook](monday-live-rehearsal.md), [result template](live-test-result-template.md), [shot list/edit workflow](demo-live-edit.md) and [judge access rehearsal](judge-access-rehearsal.md) are prepared. The exact180-second local edit draft has seven visibly pending live-footage slots. The original video is preserved; full decoding and a bounded preview frame were checked. Six offline compositor guards and two source-export privacy/completeness tests pass. [Edit artifact manifest](research/live-demo-edit-2026-11-01.json).

Copy-ready [submission text](submission-field-draft.md), [component notices](../THIRD_PARTY_NOTICES.md) and [source-release decisions](source-release-readiness.md) retain current limits. [Public requirements/access recheck](research/submission-access-check-2026-11-01.md) still finds November4 at9PM ET, anonymous GitHub404 and no authenticated portal form. No final submission, video upload or invitation/message has been sent.

## Costs and remaining acceptance

Zero new Muse or speech-provider API calls. Tracked Muse remains **$5.33846965**; conditional unverified-$150 remainder **$144.66153035**, excluding unverified unrelated activity. Existing AWS infrastructure costs remain unknown. Local test/render CPU use is not a new model API charge and is not assigned a dollar estimate here.

Actual Teams/human endurance, remote framing/audio, overlap/echo, shared-room identity limits, network/device recovery, exact recipient report access and approved real footage remain Monday's acceptance. Root application license, human contributors, Living Silk artwork redistribution permission, anonymous source access and actual judge recipient identity still require owner/account evidence. These are pending items, not completed by this preparation.

## Deployment

Release `d0d4615` is pushed to main and active. An immediate read-only check confirmed no active/processing meeting or running usage, then SQLite was backed up privately before atomic release switching and API restart. Dependencies match the previous lockfiles; the unchanged frontend was rebuilt. [Public Funnel/source health evidence](research/recovery-deployed-2026-11-01.json) passes UI/API200, anonymous auth401 and active services. No model/platform call or active capture interruption occurred.

## Bounded browser chapters

The records chapter passed in97.967seconds under the unchanged120-second unit limit, with synthetic microphone/speech/providers over real local HTTP, MFA, SQLite and LiveKit. [Recorded checks](research/browser-records-2026-11-01.json) cover speech/host controls, reload, lease refusal, interrupted capture restart, final drain/report retry, corrections, evidence/export, ownership isolation/deletion, mobile layout and tab sharing cleanup. Test selectors now scope speaker names to the human transcript rather than the separate Rally response history, and accept the current visible validation notice. This is a test-harness correction, not a product workaround. The capture chapter separately exercises the15-second free-preflight timeout and actual periodic heartbeat.

A seventh regression reproduced a completed report retaining busy bookkeeping when final media close threw. Report cleanup now clears the active/report maps in a finally block, preserves the saved report and records a cleanup warning. The initial extra test failed before the correction, then all151 backend tests passed. This follow-up is included in deployed `d0d4615`; the earlier recovery checkpoint was `9b38883`.

The capture chapter also passed under the same bounds: [free-preflight/periodic-heartbeat measurements](research/browser-capture-2026-11-01.json). Together the capture and records chapters cover the split former full workflow. The historical120-second full-run attempts remain timed out, not retroactively passed. Run `test:browser:capture`, `test:browser:records` and the focused `test:recovery` one at a time in bounded units.
