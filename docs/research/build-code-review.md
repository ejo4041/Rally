# Rally v0.1 code review

Applied the code-review skill to the new app. Because the user requested no further prompts and this was a new empty repository, review baseline was the empty Git tree rather than asking for a prior branch. Initial snapshot: `9eaa60f` in `apps/rally`. Subsequent fixes are included in later Site source commits. Spec sources: planning interview, roadmap, architecture and backlog. Standards sources: root AGENTS.md, API budget, and architecture rules.

## Standards

The independent review found four concrete lifecycle/accounting problems:

- Concurrent finals could all pass asynchronous budget checks before `modelBusy` was reserved. Fixed by reserving synchronously and coalescing later work; regression checks one concurrent request.
- Speaker correction advanced the decision epoch but did not cancel active playback. Fixed by canceling/invalidation consistently across speaker and agenda changes.
- Audio accounting was marked complete before persistence and a storage error could prevent cleanup. Fixed successful-write ordering and shutdown `finally` to release ownership, stop timers and close the client.
- A lost reasoning-usage write only blocked the current session. Fixed distinct accounting-failure propagation and persistent warnings in evaluation and finalization. Cost queries retain unknown usage; deleting a meeting preserves an unknown-cost sentinel.

The reviewer rechecked the fixes and found no new P1 in the reviewed changes. These were functional findings, not style-only smell judgments. No paid calls or edits were made by the reviewer.

## Spec

The independent review found four concrete spec gaps:

- Final turns arriving inside the four-second reasoning throttle could remain unprocessed. Fixed a signature-guarded trailing evaluation and busy-request coalescing.
- An empty new meeting retained the preceding transcript in the DOM. Fixed explicit empty-state reset and added populated → empty browser coverage.
- End could skip flushed final commitments and discard pending extraction. Fixed bounded ASR drain and non-speaking final proposal extraction before saving.
- Finals received during playback could remain unprocessed afterward. Fixed evaluation scheduling on terminal playback states, with regression coverage.

The reviewer rechecked the changes and found no new material P1. Frontend local override also blocks newly arrived old-epoch speech before the server acknowledgment; a browser regression exercises that case.

## Verification

Core/API/accounting/lifecycle suite: 16 tests passing at the latest checkpoint, including a final targeted agenda-checkpoint regression. The rendered browser flow tests setup, consent/start, walkthrough, proposals, confirmation, pause/resume, demo clock, persistence/reload, export, deletion, mobile-width layout, empty-transcript isolation, synthetic speech-adapter cancellation and stale-prompt suppression. No paid calls occur in these default tests.

Physical speaker output/room acoustics/phones/Teams remain outside this review's verified evidence. Real Muse tests are logged separately, including failed attempts and costs.

Summary: 4 Standards findings fixed; 4 Spec findings fixed. Follow-up reviews found no new P1 in the reviewed changes. This is a bounded review, not proof that all possible defects are absent.
