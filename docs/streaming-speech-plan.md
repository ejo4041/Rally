# Streaming speech and public access — implementation record

## Scope and decisions

Work is isolated on `rally-streaming-speech`, created from freshly fetched main `1d988d0`. The user approved internal and authenticated generic TTS, automatic immediate interventions, ten-second meeting health updates, live Teams moderation until End/Leave even if the dashboard closes, and call-only output when Teams is selected. Every intervention starts exactly **Let’s get back on track.** (U+2019). Generic synthesis preserves caller text.

The user subsequently authorized public HTTPS on port 443 with backend login. This supersedes the earlier private-only scope for the integrated Node app, not the separate Sites release. Final hackathon submission remains pending.

## Implemented architecture

- `TextToSpeech` and `SpeechService` provide bounded complete WAV and incremental PCM through the supplied AWS Seamless endpoint. Adapter identity identifies the requested model; the API supplies no checkpoint revision, so revision stays null. Stream sample alignment, deadlines, backpressure, abort, validation, concurrency and no automatic retries are enforced.
- Authenticated `/api/speech/generate`, `/api/speech/stream` and `/api/speech/usage` keep provider credentials server-side. Requests require paid processing enabled; rate limits cover accounts and global request counts. AWS request records persist cache-hit information, first-byte timing where measured, output duration for PCM and unknown infrastructure cost, separately from Muse accounting. They retain no input text or audio. Interrupted requests are marked on restart.
- `LiveSpeech` consumes only server-approved, current intervention IDs/epochs. Approval is saved before synthesis. It records and publishes preparing/playing/completed/canceled/failed, preserves input shielding through the bounded task and echo tail, and cancels on host controls, invalidation and transport loss.
- Browser speech uses LiveKit audio publication. Subscription requires a current authorized job/epoch, rejects delayed canceled tracks, and does not replay on reconnect. Stop acts locally before the server round trip. Voice on/off is server-controlled for streamed meetings.
- Ten-second notifications include health, rationale, concerns, progress, assessment freshness, speech destination and call state, even when moderation is paused or an assessment remains in flight. HTTP snapshots remain authoritative.
- Browser capture leases renew every twenty seconds and expire after ninety seconds. Teams has an independent connected-runner lease and browser-process watchdog. Dashboard logout does not stop Teams.
- Teams connects a prepared owner-scoped meeting to the same ASR/assessment/report engine. An isolated Chromium/PulseAudio transport carries incoming audio and streamed output. **Implementation refinement:** the Teams sink consumes normalized PCM directly through its private virtual microphone instead of creating an extra LiveKit participant/codec round trip. The dashboard still receives LiveKit status events, and browser capture/playback still uses LiveKit. There is only one ASR/model loop; Teams mode never publishes speech to dashboard speakers.
- Teams startup/cancellation holds exclusive runner ownership until late startup and cleanup settle. No automatic rejoin. End/Leave drains transcription and invokes the existing final report flow. The legacy Sites Teams queue and integrated mode must not run simultaneously.
- Backend login uses the existing scrypt/session/owner isolation. New throttles limit concurrent hashing, login attempts and public registrations. Public registration remains available as requested; shared model budgets still apply.

## Configuration

Use server secrets for `RALLY_TTS_TOKEN`, select `RALLY_SPEECH_ADAPTER=seamless-aws`, and enable `RALLY_PAID_ENABLED=1`. Concurrency defaults to one. MMS remains an explicitly selected legacy adapter and is not an automatic fallback. Default provider input/output limits are unchanged from the supplied quickstart: English/default voice, 1,200 characters, PCM16 mono 16 kHz; upstream validates its phrase-token limit. Generic audio is bounded to 120 seconds, meeting utterances to 30 seconds of samples and forty seconds elapsed.

`LIVEKIT_URL` is backend signaling; `LIVEKIT_PUBLIC_URL` is the browser WSS endpoint. Public ingress proxies `/livekit/` to local signaling. Public ICE TCP/UDP ports must also be reachable. HTTPS UI access alone is not proof of media connectivity.

## Validation and boundaries

Red/green tests reproduced pre-aborted provider requests, invalid WAV encoding, Teams retry during canceled startup, and browser capture expiry. Actual browser/Express/SQLite/LiveKit streaming playback, local Stop, prefix presentation and persisted coverage pass using synthetic model/audio fixtures. Two fresh-context Astra reviews identified and prompted fixes for Teams cleanup races, pending browser track authorization, shielding lifetime and canceled-status persistence. Final regression/review/deployment results are recorded in the final handoff when complete.

No new Muse call has been made during implementation. Actual AWS cache/latency validation and a fresh consented Teams admission/audibility rehearsal remain distinct live checks. A real meeting invite has been requested; synthetic tests do not establish Teams tenant admission or remote audibility.

## Public ingress evidence

Tailscale Funnel accepted HTTPS 443 on `rally.tail703f9e.ts.net`. A request forced through its public DNS relay returned the temporary setup text. Both pre-existing public SSH443 sessions remained established; no SSH listener configuration was changed. Direct server-local hostname resolution uses the Tailscale address and reaches the SSH wildcard listener, so public-route probes must use public DNS resolution. Public UI publication follows verified release installation; a setup page is not the application deployment.
