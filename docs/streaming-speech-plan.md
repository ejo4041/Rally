# Streaming speech implementation — October 30

## Agreed design

Implement on a fresh worktree from fetched main. Extend the Node API, not the older Sites application. Shared AWS Seamless synthesis accepts caller text through internal and authenticated HTTP APIs, with complete WAV and streamed PCM. Muse retains transcription and reasoning. Approved meeting interventions must begin exactly `Let’s get back on track.` (U+2019). Speak immediately after server approval; preserve the sixty-second cooldown and cancellation/evidence rules.

Publish meeting health/status every ten seconds, even without another model call. Use LiveKit audio tracks for browser/Teams speech. When call mode is enabled, output only to the call; otherwise use browser playback. Teams must feed the same live engine, remain until End/Leave even if the dashboard closes, and own its capture lease. Keep WhatsApp and hosting changes outside scope. Preserve private access and no automatic replay after partial delivery.

## Implementation checkpoint

Fresh branch `rally-streaming-speech`, worktree `/srv/hackathon/rally-streaming-speech`, based on fetched remote main `1d988d0`. Fetch required running Git as the existing repository owner; no SSH configuration was changed. Other worktrees were left intact.

Implemented shared Seamless adapter and authenticated `/api/speech/generate` and `/api/speech/stream`, WAV signature validation, incremental aligned PCM, bounded output, cancellation, deadlines, global concurrency limit, upstream error mapping and Retry-After propagation. Added exact-prefix normalization helper. Ten-second status notification remains outstanding; the earlier attempted edit did not match the committed engine baseline.

Configuration reads `RALLY_TTS_TOKEN` from backend environment; no credential was saved or provider request made. The adapter is not yet connected to meeting speech. Existing MMS remains the meeting speech implementation.

## Remaining required work

- Add account rate limits, cache-header/usage telemetry, richer WAV validation and HTTP streaming tests.
- Wire automatic approved intervention streaming, speech lifecycle/snapshot state and the prefix helper into the engine.
- Extend LiveKit publication permissions and cancellable frame streaming; integrate browser playback, controls and input shielding.
- Implement integrated Teams live transport, owner-scoped connection lifecycle, exclusive capture source, runner lease and watchdog, and final drain/report handling.
- Complete status freshness and speech/destination fields in canonical snapshots and frontend rendering.
- Run full regression and synthetic media tests, then bounded AWS and consented Teams validation. No live access/latency claim is established.

## Validation

Initial validation: TypeScript passed and 54 backend tests passed (50 existing, four new adapter/prefix tests). No paid calls, deployment, service restart or meeting join occurred. Dependencies are reused through a local-only node_modules symlink to the existing installed checkout.

## Review checkpoint

The implement skill's code-review step reviewed foundation commit af62962 against 1d988d0 using independent Standards and Spec agents. Standards: three hard findings (capability metadata, accounting/enablement, missing HTTP tests) and two heuristic findings (inconsistent character counting, meeting policy location). Spec: seven findings; the full live meeting/Teams feature remains unimplemented. Review does not approve this as a completed feature.

Follow-up fixes validate WAV chunks/PCM encoding and lengths, reject pre-aborted requests before fetching, enforce the PCM duration ceiling, normalize upstream timeouts/network failures, and gate HTTP calls on paidEnabled with a thirty-second per-account limit. Capability metadata, actual AWS accounting, HTTP tests and all live integration remain outstanding. Do not enable this foundation in production.

Latest completed verification before the enablement/rate-limit follow-up: 56 backend tests and TypeScript pass. No provider calls or deployment occurred.
