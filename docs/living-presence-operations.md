# Living presence operations

Use the existing integrated deployment and authentication policy. Preserve closed registration, MFA, owner isolation, current HTTPS/signaling origins and secrets. The canonical call path is `TeamsLive`, not the removed standalone native queue service.

## Build and verify

Install locked dependencies in physical directories `packages/living-silk`, `apps/rally-api`, `apps/rally-web`, and `experiments/teams-presence`, using the configured Node24 toolchain. The camera experiment package supplies Playwright to the shared native camera helper. Run both application typechecks/tests, frontend build, and the browser/HTTP/SQLite/LiveKit regression. Record whether providers are synthetic or real.

The isolated `video-check.mjs` opens the actual virtual camera through WebRTC and measures distinct frames. It requires an unused `/dev/video42` and must never run during a call. `audio-check.mjs` measures actual pinned local MMS routing; production calls use the existing configured streaming speech adapter. Neither local check establishes remote Teams quality.

`presence-live-benchmark.ts` is an explicitly authorized, non-retrying three-scenario production-schema experiment, capped at $0.15. It refuses to overwrite completed usage. Record every call in the ledger; the overall presence experiment ceiling remains $3.

## Native camera configuration

- Tested host driver: upstream v4l2loopback v0.15.4, pinned source `0f9ee86760b7f2bea174b7e3e7a1d38845da0ab4`, installed through DKMS for the current kernel. Older distro module failed repeated producer opens. Preserve the pin and verify after kernel changes.
- Device options: `devices=1 video_nr=42 card_label=Rally_Presence exclusive_caps=1`. Install the module/udev examples under `ops/integrated`; `hack` must have read/write access. Never unload/reload during use.
- Enable `RALLY_PRESENCE_VIDEO_ENABLED=1` on the integrated API only after verifying its camera dependencies. Set `RALLY_PRESENCE_ORIGIN` to the existing HTTPS frontend serving `/renderer.html`. No renderer service credential/bootstrap token is needed; the owned process supplies bounded scenes directly.
- Use `RALLY_TEAMS_LOCK=/srv/hackathon/rally-deployed/state/teams.lock` for all canonical/legacy processes. The shared helper defaults there when deployed state exists. This avoids the API's `PrivateTmp` namespace and remains inside its existing writable state directory.
- Preserve `RALLY_TEAMS_LIVE_ENABLED`, `RALLY_REALTIME_ENABLED`, streaming adapter credentials and existing budget gates. Duplex remains subject to its separate measured-echo acceptance flag; camera activation does not silently enable it.
- Keep the retired `rally-teams-presence` service disabled. Do not start a legacy guest runner concurrently with the integrated connector.

## Host and release workflow

Create/review the agenda, choose **Rally joins Teams · voice and video**, paste a fresh consented invitation, then **Join with voice and video**. Admit Rally if Teams requires it. The existing host-microphone/tab choices remain. A connected call has one capture owner and one approved speech transport.

Stop/Pause/End and security revocation cancel output. Leave ends the call through the existing final-report flow. Pending lobby joins are canceled on logout; a connected independently hosted call continues until explicit End/Leave, as in the deployed contract. Failed connections require explicit retry.

Before activating any release, compare its ancestry with the actual `current` release; merge newer security/product changes first. Check for live meetings and processing reports, back up SQLite, build an immutable release, then switch `current` and restart API/web only. Preserve media and all persistent state. Verify closed signup/MFA and normal app access before joining a call.

Rollback stops native ownership, restores the prior release and restarts API/web after the idle check. Never deploy `ee8d7fe` alone: it predates the merged MFA/streaming/realtime contracts. Retain backups, cost records and user data. Document actual remote feedback separately from local camera measurements.
