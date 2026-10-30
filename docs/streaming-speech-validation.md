# Streaming speech release — validation and deployment

Checkpoint: October 30, 2026. Application release `c20261d`, built on branch `rally-streaming-speech` from freshly fetched main `1d988d0`. See [implementation and decisions](streaming-speech-plan.md) and [API contract](backend-api.md).

## Automated evidence

- 64 backend tests pass, including provider sample alignment, cancellation, malformed WAV rejection, HTTP authentication/origin checks, immediate streaming, capture lease expiry, Teams startup cleanup, interrupted Leave, call-only output and ten-second status.
- Nine frontend tests pass; both TypeScript checks and the production frontend build pass.
- The full browser/Express/SQLite/LiveKit regression passes with synthetic ASR/reasoning and the MMS waveform fixture.
- `apps/rally-web/tests/streaming-browser.mjs` passes actual LiveKit streamed playback, exact opening presentation, persisted coverage and immediate Stop using synthetic providers. This does not claim physical speaker audibility.
- Real isolated Teams browser startup cancellation completed in 2,082 ms and left no CDP listener. No meeting was joined.
- Two real AWS calls validate PCM streaming and complete WAV. [Measurements](research/seamless-streaming-smoke-2026-10-30.json): first PCM byte 1,556 ms; WAV complete 983 ms. Both report cache miss for `Let’s get back on track.`. The user subsequently supplied the provider's exact ASCII-apostrophe spelling. Release `c20261d` uses `Let's get back on track.`; a [third probe](research/seamless-cache-smoke-2026-10-30.json) confirms cache hit, first bytes in 855 ms and a following live-generated sentence (nine chunks, 2.72 seconds audio). The backend suite and streaming-browser check were rerun successfully after the correction.

## Independent Astra review

| Axis | Result |
| --- | --- |
| Standards | Final review against `1d988d0` through `32def64`: no actionable violations. |
| Spec | Two findings: legacy browser voice could conflict with Teams output; Leave did not finalize an interrupted started call. Both corrected in `93eaaa8`; follow-up review reports both resolved with no remaining findings. |

A final fresh-context Astra check of the public smoke script found that teardown errors could skip temporary-account deletion. Independent teardown attempts now preserve failure status while still cleaning the account. The follow-up review verified the cleanup correction and ASCII-prefix commit `c20261d`, with no remaining actionable findings. No other contract or secret-output findings were reported.

Earlier streaming/security and hosting reviews prompted fixes to pending-track authorization, cancellation persistence, shielding duration, exclusive Teams startup ownership and idempotent browser cleanup. The subsequent regression checks include these paths.

## Public deployment

The integrated application is publicly available at **https://rally.tail703f9e.ts.net/** with backend signup/login. The user explicitly authorized this access change; the separate private Sites product is unchanged. Public source publication and final hackathon submission are not part of this deployment.

Tailscale Funnel terminates public HTTPS 443 and proxies to Caddy on `127.0.0.1:6772`. Caddy routes `/api/*` to the API on 3301 and `/livekit/*` to LiveKit signaling on 17890. The backend uses loopback signaling; browsers use `wss://rally.tail703f9e.ts.net/livekit`. LiveKit advertises `165.245.162.212` with public ICE TCP 17891 and UDP 17892. No TURN service is configured; restrictive networks require further validation.

Existing public SSH on port 443 was preserved, including its active sessions. Private Tailscale application endpoints remain configured. Server-local DNS resolves the public hostname to its Tailscale address, where wildcard SSH intercepts 443; the operator check deliberately resolves the hostname to the public Funnel relay. This is a public-route check from the server, not an independent external-device test.

`rally-integrated-api`, `rally-integrated-web` and `rally-integrated-media` are active. Current release is `/srv/hackathon/rally-deployed/releases/c20261d`. Configuration and persistent data remain outside immutable releases. The idle legacy Teams runner was stopped so it cannot compete with integrated live Teams. The deployed API release includes its required Playwright runtime packages.

Before the initial public deployment, SQLite and configuration were backed up under `/srv/hackathon/rally-deployed/state/backups/streaming-3c79644/`. Rollback requires restoring the previous release/configuration together and restarting the three services after checking that no active meeting/report would be interrupted. A further SQLite backup, `before-cache-prefix.sqlite`, precedes the `c20261d` API-only restart; the previous `3c79644` release remains available. Remove the public Funnel route if reverting to private access; never replace the SSH listener to accomplish this.

## Public smoke check

[Sanitized public validation](research/public-deployment-smoke-2026-10-30.json) passes real UI signup, logout/login, secure HttpOnly cookies, cross-owner meeting denial, public WSS signaling and bidirectional synthetic audio. Incoming audio reached the backend; outgoing RMS was measurable in the browser. The temporary account and sessions were removed. Anonymous meeting access separately returns 401. No production meeting was created and no model call or platform join occurred.

Reproduce on the deployment host with Node 24, the installed browser paths, and `RALLY_PUBLIC_SMOKE=1 node apps/rally-api/scripts/public-smoke.ts`. It reads secrets from runtime configuration, never prints them, and removes its temporary account. `RALLY_PUBLIC_RELAY_IP` can override the public DNS relay address if it changes.

## Remaining live validation and spending

A fresh, consented Teams invitation and someone to admit Rally are still needed to prove tenant admission, incoming real speech, automatic intervention audibility to participants, Stop and End/Leave. The user offered to rehearse after approximately twenty minutes; no invitation was available at this checkpoint. Independent external-device browser playback is also pending. These boundaries must remain explicit in demonstrations.

No new Muse call occurred during this work. The three AWS probes have unknown infrastructure cost, recorded separately from Muse. Last recorded Muse ledger estimate is $0.47338150; $149.52661850 remains conditional on the unverified $150 grant/balance. No failed or unpriced request is asserted free.
