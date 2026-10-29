# First live Teams transcription stop — investigation and server fix

Investigated 2026-10-28 after the user reported that the first UI-initiated meeting worked, then left unexpectedly. User suggested it might have been the three-minute POC limit.

## Evidence

The job was created at 20:11:28.970 UTC with an absolute deadline of 20:14:28.970 UTC. The browser stopped at 20:14:02.362 UTC and the failed job update was saved at 20:14:02.437 UTC: approximately 26.5 seconds before the configured deadline, after about 153 seconds total. Leave was not requested by the host. The usage event records 128.62 seconds sent, 128.64 seconds reported processed, and `teams_asr_failed`. Two finalized transcript turns remain saved. The service exited successfully; the long-running queue runner remained active with zero restarts and ample available RAM. There is no evidence of a droplet or runner-process crash.

The previous code did not retain the particular ASR/provider/queue exit reason. Consequently the exact historical trigger is **not proven**, and this should not be described as a confirmed normal three-minute timeout or a confirmed provider outage.

## Reproduced defect and fix

The audio capture produces a fixed 16 kHz stream, while the sender originally sent exactly one 20 ms frame per timer callback. Normal timer delays accumulate, so the sender can gradually fall behind and exceed its two-second pending-audio guard. A deterministic offline simulation with 20.35 ms timer callbacks reproduces the old overflow within 150 seconds. This is consistent with the observed early failure, but the original logs are insufficient to establish it as the sole cause.

Added `experiments/teams-web-client/audio-pacing.mjs`: frame scheduling follows elapsed monotonic time, catches up in bounded batches of at most 200 ms, and never exceeds wall-clock capture time or the audio duration cap. Buffer and socket backpressure limits remain intact. In the same simulation the corrected scheduler stays within two frames of capture time.

Updated the adapter to retain sanitized stop reasons, WebSocket close code, provider error code when safe, maximum pending bytes, and sent/processed duration. Updated the queue runner to log job lifecycle/termination reason and those metrics. It does not log meeting URLs, tokens or transcript content. Provider failure, source backlog, socket backpressure, host leave and normal deadline are now distinguishable in server logs.

## Deployment and verification

Verified no active meeting before changing the server. Backed up prior adapter/runner/tests under ignored `experiments/teams-web-client/test-results/incident-20261028-pacing/`. Installed only the server adapter, pacing helper, tests and runner diagnostics; the published Site, access policy and three-minute cap are unchanged. Stopped the idle queue consumer, allowed its lease to expire and restarted it. Production reports the normal Teams runner online and transcription ready. Meeting browser remains inactive until a fresh host invitation.

All four offline adapter/pacing tests pass, including final drain, cancellation, handshake accounting and the reproduced timing-drift regression. Syntax checks pass. No meeting was rejoined and no new model call was made. A fresh consented live test is still needed to validate the fix against real audio.

The first user test's estimated charge is **$0.00640000**. It has been reconciled once by stable usage ID into the ledger: tracked cumulative **$0.15263115**, unknown entries **0**, conditional $150 remainder **$149.84736885**. Actual grant/Billing balance remains unverified. Investigation/fix testing cost **$0**.
