# Capture lease and abandoned browsers

The host browser renews an active capture while it is publishing an audio track. If the browser closes, loses its authenticated session or stops local capture, that renewal stops. The server expires the capture instead of leaving Muse receiving padded silence and continuing live assessments indefinitely. This does not infer presence from microphone volume: quiet audio, host mute, moderator pause and MMS input shielding remain valid while the publishing browser renews.

## Protocol and lifecycle

Start/reconnect/connection responses include an ephemeral `captureToken` alongside room credentials. It belongs to the current capture, is not a provider key, and is not saved in the meeting/export. The browser submits `{captureToken}` to authenticated owner-only `POST /api/meetings/:id/heartbeat` immediately after publication and every 20 seconds. The response contains `expiresAt`. Requests have a five-second client timeout and do not overlap. The browser cancels its timer and pending request when capture stops.

A valid heartbeat extends the deadline by `RALLY_CAPTURE_LEASE_MS`, default **90 seconds**. Use an interval comfortably above browser renewal/network delays when configuring it; this is milliseconds, not seconds. Reading snapshots, polling reports or requesting room credentials does not extend the deadline. Missing, wrong, expired or superseded tokens cannot renew it. Normal 55-minute ASR handoff preserves the capture token; explicit reconnect creates a new one and rejects the old token. Authentication and meeting ownership are always required independently of the token.

Expiry is checked before pause/busy reasoning suppression on the next assessment scheduler pass. With the default 10-second scheduler, shutdown begins within approximately 90–100 seconds after the last accepted renewal, plus the adapter's bounded final drain. This is an application scheduling bound under normal event-loop progress, not a hard real-time or provider-billing guarantee. Configure the scheduler interval with this cleanup policy in mind.

The engine records a fatal capture gap, cancels speech and drains/closes transcription and media. Finalized drain results remain saved, the meeting becomes `interrupted`, and no report or new model session is requested automatically. An outstanding replacement source that arrives afterward loses ownership and is closed. Reconnect is explicit and uses the existing usage/unknown-cost gates. The saved transcript can be reviewed or explicitly analyzed later.

A heartbeat refusal closes the browser's real published tracks and requires explicit recovery. Temporary HTTP failures do not immediately create another session. If renewal remains unavailable, the server expires the existing capture. The lease reduces unattended processing; it does not make normal capture or its grace period free.

## Validation and limits

Six HTTP/clock-controlled lease scenarios cover abandoned capture/final drain, invalid/expired renewal, passive reads, valid extension, paused expiry, the actual scheduler path, explicit token replacement and expiry during a pending handoff. The existing cross-owner route checks include heartbeat denial. These tests use injected providers and no paid calls.

The browser regression observes immediate and actual periodic renewal. It injects a renewal refusal and checks that real media tracks stop without an automatic restart or report. Its reasoning/transcription use deterministic fixtures. The longer capture experiment must identify its source revision; a run started before this feature does not validate the lease.

A real device/browser rehearsal must still check background-tab behavior, device sleep and the chosen meeting surface. A suspended browser may lose its lease and require reconnecting. No heartbeat changes the anonymous nature of speaker labels or proves physical/remote audio quality.
