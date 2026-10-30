# Living presence operations

Source: active integrated Node app, not the historical Sites frontend. Preserve the private deployment described in [integrated deployment](integrated-deployment.md).

## Build and checks

Install with the configured Node 24 toolchain in each physical directory: `packages/living-silk`, `apps/rally-api`, `apps/rally-web`, `experiments/teams-presence`. Run `npm ci` using the committed lockfiles. The local silk dependency is linked to its source package; install its Three.js/types dependencies before frontend build/typecheck.

Run both application typechecks and test suites, then frontend build. `apps/rally-web/tests/browser.mjs` uses an isolated API/LiveKit and injected reasoning/ASR. Set `RALLY_TEST_LIVEKIT_BINARY` to the installed binary, `PLAYWRIGHT_BROWSERS_PATH` and `LD_LIBRARY_PATH` to this host's existing browser locations. `RALLY_TEST_REAL_MMS=1 RALLY_MMS_ENABLED=1` verifies the pinned offline voice.

For video checks, serve the frontend locally and set `RALLY_PRESENCE_TEST_ORIGIN`; run `experiments/teams-presence/video-check.mjs`. It takes exclusive ownership of `/dev/video42`, creates disposable displays/browsers, sends the real camera through a local WebRTC pair and records decoded versus distinct image frames. Never run it during a user call. `audio-check.mjs` uses disposable private PulseAudio and actual pinned MMS; no paid model request.

Paid calibration is separate: `apps/rally-api/scripts/presence-muse.ts`, explicit `RALLY_PRESENCE_CALIBRATION_APPROVED=1`, one case by default. It preserves a usage database and stops on unknown costs. The authorized total experiment ceiling is $3. Record every batch in the [ledger](research/muse-cost-ledger.md). Do not silently rerun completed scenarios.

## Service configuration

1. Load a tested v4l2loopback module with `devices=1 video_nr=42 card_label=Rally_Presence exclusive_caps=1`. This host requires upstream v0.15.4 through DKMS; the older package failed repeated opens. Preserve source pin and rebuild when the kernel changes. Install the module/udev examples under `ops/integrated`; the device must be readable/writable by `hack`.
2. Give API and runner the same random secret (at least 32 characters) in protected environment files. Never put it in Markdown, browser URLs or client bundles. `RALLY_PRESENCE_RUNNER_SECRET` enables the queue. Set `RALLY_COOLDOWN_MS=45000` in existing runtime configuration if it previously overrides the default.
3. Set `RALLY_PRESENCE_ORIGIN` to the private HTTPS frontend origin accepted by API CORS. The loopback origin is valid only if explicitly included in the API's allowed origins. The renderer has no application session cookie and obtains its scoped access through one-use bootstrap.
4. Install the user service `experiments/teams-presence/rally-teams-presence.service` for `hack`. It conflicts with the legacy Teams runner and shares its process lock. Use the same `RALLY_TEAMS_LOCK` path for both if overriding the default. Preserve `KillMode=control-group` and the bounded stop timeout.
5. Start the producer before the Teams browser enumerates cameras; the runner handles this. The camera page is a separate foreground display. Do not put the Teams window over the captured display.

Before updating the API, check for live meetings and processing reports, back up SQLite, then activate an immutable built release and restart only the integrated API/web services. Do not restart media unnecessarily. Verify the renderer, app authentication and runner health after restart. Keep the prior release for rollback.

## Host workflow

Create and review a meeting agenda. Open **Have Rally join this Teams meeting**, paste a fresh work/school Teams invitation and confirm participants' consent. Choose **Join with voice and video**, then admit Rally if required. The existing room-microphone/tab workflow remains available separately. Do not start host capture for the same Teams-guided meeting. Host observers receive the shared visual and live state without publishing another input or playing duplicate speech.

Pause/dismiss/Stop controls cancel approved playback. **Leave and end meeting** requests departure, stops capture and starts the existing final-report flow. A lost runner lease or transport interrupts without an automatic paid report/rejoin. Retry only after checking the Teams roster and saved record. Logout withdraws queued work and interrupts active capture.

## Rollback

Stop `rally-teams-presence` first and verify its process group has exited. Restore the previous immutable app release and restart API/web only after the idle check and backup. Keep persistent SQLite, usage records and secrets. Re-enable the legacy runner only when explicitly using that test flow, with the shared lock installed. Kernel driver installation is independent of app releases; no camera module unload/reload while any process is using the device.
