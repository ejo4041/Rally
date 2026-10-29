# Rally — offline work, October 29

User cannot run further live Teams tests tonight. No Teams join, model call, runner restart or hosted deployment was performed for this batch. No new model spend; last reconciled tracked total remains $0.15263115, with conditional grant remainder $149.84736885 and no unknown entries in that recorded ledger. Provider Billing has not been verified.

## Implemented locally

Completed Teams transcription jobs can now be saved to normal meeting history using **Save to meeting history**. The endpoint requires a terminal connection and finished/failed transcription, retaining drained finals before allowing import. It creates a standard ended record using the original job ID, so existing costs remain attributable without copying usage events. Repeated saves preserve the original record and any later host edits. No schema migration is required.

The record reloads through the existing meeting API/UI, exports Markdown, and can be deleted. Deletion clears the source job's transcript/partial text as well as the saved record while retaining usage records, including unknown charges. Active Teams jobs cannot be deleted through this flow. No model processing occurs on save, load, export or delete.

Failure states are preserved, speaker identities remain unknown unless supplied by ASR, no outcomes are invented, and the UI/export explicitly say moderation was not performed. The original POC did not retain speech timestamps: the record discloses job-window timing and labels turn times as unavailable. Invite URLs and access tokens are excluded from the saved record.

The original inline transcript/download remains available. Save a completed test before starting another so it is easy to find in history. Earlier source jobs are retained in D1; this batch does not bulk-import real user transcripts.

## Verification

- 20 backend/core/accounting/lifecycle tests pass, including a new D1/Worker integration test for save gating, duplicate saves, canonical source ordering, failed-session provenance, retained final words, unknown speaker, invite exclusion, export, prevention of reconnect, and deletion with unknown-cost preservation.
- Mocked Teams browser test passes: consent, transcript XSS handling, download, mobile layout, Leave, save button gating, history navigation and honest saved-record rendering.
- Existing full browser walkthrough regression passes: setup, consent, confirmation, pause/resume, wrap-up clock, reload, export and deletion, zero paid use.
- Worker build and ESM validation pass.
- Existing four adapter/pacing regressions pass (run separately against server experiment).

These checks are offline proof of application behavior, not proof of live Teams reliability or speech output. The deployed Site is still version 7; the new history UI/API is local and requires the owning Sites session to publish.

## Documentation and Git state

Substantial documentation already existed under docs/: roadmap, interviews, architecture, build checks, live incident/fix, cost ledger, deployment evidence and remote access. Root README had stale pre-live-test status and costs; those are corrected in this batch.

Read-only `git ls-remote origin` succeeded with no refs for `git@github-hackathon:ejo4041/Rally.git`. The outer working repository has no commits. The nested Sites checkout under apps/rally has its own local deployment commits; those are not GitHub publication.

A separate sanitized source checkout is prepared at `/srv/hackathon/rally-source-checkpoint`, using `scripts/export_submission.py`. It contains source/docs/experiments plus these changes, without nested Git, local databases, dependencies, test recordings or credentials. The hosting manifest omits the owning Site identity; historical deployment IDs remain in the documentation. Its local commit is a reviewable checkpoint; **nothing was pushed to GitHub**. The snapshot is for this checkpoint, not an automatically synchronized working repository. The live development directory remains `/srv/hackathon/repo`.

## Next work

1. Publish/review the locally tested history patch through the existing owner account when desired; retain restricted audience and runner cap. Use the Sites skill/workflow before deployment.
2. Fresh consented live retry to validate pacing beyond the old failure window, explicit Leave and timeout departure/final drain, transcript correctness, then reconcile exactly one usage record.
3. Feed finalized Teams speech to the existing evidence-backed moderator. Begin with visible suggestions and host confirmation; configure agenda/roster and preserve source revisions, cancellation and cost guards.
4. Add spoken Teams interventions with echo rejection, host override, cooldown and reliable cancellation. This is not implemented by the history patch.
5. Run three-person/device rehearsals and failure/repeated-join tests. Rebuild submission snapshot after later changes; prepare public source, demo video and judge access before the recorded November 4 deadline.
