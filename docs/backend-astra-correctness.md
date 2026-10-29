# Backend correctness review — October 29, 2026

Scope: the Node backend in `apps/rally-api/`, against the [approved backend plan](backend-plan.md), [frontend contract](backend-api.md), [model capability contracts](model-interfaces.md), and [previous review](backend-review.md). Reviewed implementation through `76e66b8`, descended from main `510bb07e0c8da794c92eb2a9c489d026de5a04d6`, then independently inspected and retested the coordinating agent's fixes. Focus was demonstrable MVP lifecycle, concurrency, ownership, persistence and accounting behavior. Media-device behavior and AI output quality are separate reviews.

## Reproduced findings and disposition

All four findings were reproduced through HTTP with controlled asynchronous provider boundaries, then fixed with small state-management changes. No additional infrastructure was needed.

| Priority | Original failure | Impact and fix | Verification |
| --- | --- | --- | --- |
| P2 | Ended meetings remained in `Engine.active` while their report ran, and `start()` counted those entries for both host exclusivity and server capacity. | A host could not begin the next meeting until a background report completed; enough ended reports blocked every host. Count only live capture entries, retaining the ended meeting's media session for report notifications. Starting still reserves live capacity before any await. | With capacity one, end meeting A, hold its report in flight, and start meeting B as the same host. Originally HTTP 409 `Server meeting capacity reached`; now HTTP 200. A separate concurrent-start regression still rejects competing and duplicate starts. |
| P2 | The `start()` failure handler saved the original meeting snapshot after awaiting media setup. | An accepted host plan edit during slow connection setup was silently lost if setup failed. Reload the current row, restore only lifecycle fields, and restore the previous `startedAt`. | Defer media setup, successfully PATCH the objective, then reject setup. Originally the old objective returned; now the edit/revision survives and a failed first start leaves `startedAt` null. |
| P2 | Missing-timestamp turns were sorted lexically by their composite IDs. | History and report input read `1,10,11,12,2,...9`; the live recent-turn selection could also omit genuinely recent speech. Order sessions by first stored appearance and turns by numeric source sequence. | Twelve turns with unavailable timestamps, including reverse finalization arrival, produce source order 1–12 in both history and report input. |
| P2 | DELETE checked preparation/report/start activity but not a pending ASR drain from End. | DELETE could initiate a second drain, then remove content while End launched its report. Originally overlapping End and DELETE returned 202 and 204. Reject deletion while the capture state is ending. | The same overlap now returns DELETE 409 and End 202. The final turn arriving during drain reaches the report, and the meeting remains retrievable. |

## Additional boundary checks

- All 14 meeting retrieval/mutation routes return 404 for another authenticated owner, including report retry/correction, reconnect, export and deletion.
- Concurrent starts reserve capacity before media setup resolves; the competing host and duplicate start receive 409 and only one media open occurs.
- HTTP usage rows remain owner-isolated. A known usage row and its cost survive content deletion.
- A simulated network failure retains `status: unknown` and `cost: null`, including after deleting the failed meeting. The unknown charge prevents another host's subsequent provider request, consistent with the shared backend budget rule.
- Final transcript drain is included in report input; an unsuccessful initial audio connection does not leave a running meeting clock.

## Validation evidence and limits

New focused file: [astra-correctness.test.ts](../apps/rally-api/tests/astra-correctness.test.ts). Before fixes, three initial regressions failed and the two ownership/capacity checks passed; the added End/Delete reproduction also failed. After the fixes and the HTTP accounting addition: **7/7 passed**. Latest isolated run completed in approximately 1.22 seconds. TypeScript checking passed.

Reproduce from `apps/rally-api/`:

```sh
PATH=/srv/hackathon/tools/node/bin:$PATH node --test tests/astra-correctness.test.ts
PATH=/srv/hackathon/tools/node/bin:$PATH npm run typecheck
```

These tests use real local HTTP, SQLite persistence operations and the real usage ledger, with injected media/ASR and a fake text-provider HTTP response. The accounting fixture's synthetic costs are assertions inside a temporary database, not real spend. This review made **zero paid provider calls**. It does not establish physical microphone performance, Muse interpretation quality, deployment readiness or production-scale recovery. Full-suite and other-agent results belong in the consolidated review/handoff.

No remaining blocker was found within this reviewed scope after the four fixes. Routine production hardening was intentionally outside this hackathon review. The coordinating agent owns the consolidated index/handoff update and final integration verification.
