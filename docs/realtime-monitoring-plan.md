# Continuous Rally monitoring — accepted specification

The user approved this plan after three fresh-context Astra reviews. The fresh `rally-realtime-monitor` worktree fetched main (`1d988d0`) and incorporated feature ancestry through `698fe63`, including deployed MFA/security and the Chromium startup correction. Other worktrees remain untouched.

## Monitoring and model behavior

Assess current provisional and finalized speech every ten seconds, anchored to the meeting clock. The model decides value and urgency using goals, remaining time, unfinished agenda, concern history and actual moderator delivery. Do not impose a fixed tangent timer or unconditional sixty-second intervention cooldown. Preserve the higher-effort final report.

Use Spark 1.3 with minimal reasoning and an initial 1,024 output-token allowance, including reasoning tokens. Bound recent conversation, agenda, memory and output; do not add another model call for summarization. Forecast six checks per minute, transcription and report headroom without automatically increasing budgets.

## Evidence, scheduling and lifecycle

Scoped cumulative partials replace prior text. Matching finals remove provisional records; late partials cannot resurrect completed turns. Append-only continuation must not starve decisions; corrections invalidate dependent pending actions. Keep finalized evidence separate from provisional concern memory. Explicit live and final-report projections prevent tentative observations, debug history and moderator words from becoming participant agreement.

Schedule every ten seconds; expire decision eligibility after eight seconds and require first audio by snapshot plus ten seconds. Drain transport for accounting until eighteen seconds. Permit at most two outstanding checks per meeting with server-wide admission bounds, no backlog and no catch-up requests. Track requests independently from decision eligibility; late successes and failures may update only accounting and their history record. Rotation, leases, controls and revocation cannot wait for inference. End/deletion/revocation immediately invalidate decisions and perform bounded transport cleanup.

Preserve unknown-cost accounting rules and expose resulting paid-transcription interruption honestly. Reserve report capacity/headroom. Unavailable or late assessments must not masquerade as fresh judgments.

## Agenda and extensions

Apply compact patches atomically against a base revision: reorder, activate, rebudget, add, park or retire topics, preserving stable IDs, original plans and reasons. Require unique IDs, at most one active topic and valid time allocation. Topic minutes remain total allocations; spent time is separate and cannot be reclaimed. Show shortfalls and retain unmet original objectives. Provisional discussion may influence reversible ordering; completion and retirement require finalized supporting evidence.

Extensions identify the exact proposal, added minutes, resulting deadline, base revision and presentation state. Confirm through the host UI or clear finalized agreement to the duration from a turn begun after presentation. Bare assent, straddling turns, uncertain ordering, quotes, suspected echo and conflicting replies remain pending. Spoken acceptance is participant-reported, not verified host identity. Consume consent once, supersede replaced proposals, and visibly dispute confirmations when evidence changes. Ordinary agenda edits cannot extend the deadline.

## Speech and Teams

Bind active playback to its accepted job, independently of the latest assessment. Continue checks while preparing/playing, without replacing or queueing utterances. Validate freshness before first audio. Once playback starts, finish despite ordinary transcript revisions and participant overlap. Explicit Stop/Pause/End, security revocation, disconnect and playback failures still cancel immediately.

Record moderator delivery separately from participant turns. Teams keeps receiving participant audio during Rally playback and records no false intentional input exclusion. Browser capture retains echo shielding. Require a real duplex/remote-echo rehearsal before claiming reliable overlap transcription; never discard all simultaneous human speech as echo.

## Display and interfaces

The Rally card shows emotional color and text state, health and freshness at the top; approximate spoken read-along centrally; one quiet current observation below. An expandable owner-only history shows check results and agenda changes. Provide pending-extension confirmation/rejection controls. Color describes Rally's assessment, not detected participant emotion. Never store hidden model reasoning.

Typed check events include sequence, snapshot time, transcript freshness, acceptance state and plan revision. Older snapshots/events cannot overwrite newer observations. Browser animation follows actual utterance-relative playback; Teams uses measured local output progress, approximate for remote listeners. Never advance from downloaded bytes alone. Freeze on stalls; use static text if progress is unavailable. Preserve reduced motion and no replay on reconnect.

Store bounded, paginated history separately and delete it with its meeting. Exclude it from administrator activity and existing shared-transcript projections by default. Preserve MFA and closed registration.

## Verification and release

Test a ninety-second continuous monologue, cumulative corrections and delayed finals, rotation, slow and out-of-order requests, late speech deadlines, finish-once-started behavior, agenda/consent invariants, duplex echo, UI progress/history/reconnect/reduced motion and ownership/revocation/deletion.

Use paired model scenarios with identical discussion under different time pressure. Benchmark production schema and bounded context, measuring valid decisions within eight seconds, truncation, deadline misses, latency and cost. Small-sample percentiles are exploratory. Follow the existing experiment budget and record all charges or unknown costs.

Roll out behind a feature flag after automated tests, independent review and a consented Teams rehearsal. Preserve the exact cached opening and final-report semantics. Check active meetings before deployment and back up persistent state. Update API contracts, documentation index and handoff with measured evidence and remaining limitations.
