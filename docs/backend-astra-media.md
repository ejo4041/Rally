# Astra review: backend audio and media

October 29, 2026. Scope: `apps/rally-api` browser → LiveKit → PCM capture, Muse streaming adapter pacing/final drain, disconnect/reconnect, and speaker parsing. Tests use local LiveKit and a local WebSocket fixture; no paid provider calls were made by this review. Physical microphones, actual Muse multi-speaker behavior, and deployed-network behavior are outside this evidence.

Authoritative requirements: [backend plan](backend-plan.md), [model capability contracts](model-interfaces.md), and [frontend API contract](backend-api.md).

## Confirmed finding and fix

**P1 — backend reconnect silently stops receiving an already-published microphone.** `LiveKitMedia.open()` originally subscribed only in its `TrackPublished` handler. The installed rtc-node SDK initializes pre-existing publications in `room.remoteParticipants` during `connect()` without emitting that event. The explicit reconnect route creates a new backend room connection while a browser may remain connected and publishing. In that state the backend joins successfully but never subscribes, leaving the ASR session running without real microphone audio.

A real Chromium/LiveKit reproduction captured **219,520 bytes** before closing and reopening the backend media session. After reopening and waiting another **1.8 seconds**, the count remained **219,520 bytes**, with no new gap/error notification. The preceding browser disconnect/reconnect test recovered normally, distinguishing this defect from basic room connectivity.

The parent agent applied the recommended minimal fix: one eligibility/subscription helper handles both `TrackPublished` and existing `remoteParticipants`/`trackPublications` immediately after `room.connect()`. The browser regression in [astra-media-browser.ts](../apps/rally-api/scripts/astra-media-browser.ts) asserts resumed nonzero audio after both kinds of reconnect. The strengthened regression passed after the fix at **13:43:53 UTC**: backend-reconnect audio rose from **219,520 to 271,360 bytes** in 1.8 seconds; total incoming audio reached **350,720 bytes**. All three recovery assertions also required increasing PCM signal energy, so silent frame delivery alone could not pass. Outgoing RMS was **0.174073** and one JSON event arrived. The only gap was the expected browser-disconnect notice. The script exited **0**; a subsequent process check found no remaining test process or LiveKit server on its port 17890.

## Executed checks

| Check | Evidence and result |
| --- | --- |
| Existing `npm run test:media` | Passed, exit 0. Incoming 131,200 bytes with signal; outgoing RMS 0.174075; one JSON event. |
| New browser mute/unmute | Passed after 1.8 seconds muted and 1.8 seconds resumed. No unexpected gap. Final run asserted increasing signal energy after unmute, not just silent PCM frames. |
| Browser disconnect/reconnect | Passed with the same room credentials. Input count rose from 167,680 to 219,520 bytes after rejoin; a browser-disconnect gap was recorded. |
| Backend disconnect/reconnect with existing browser publication | Failed before fix; passed after fix with 51,840 additional bytes and increasing signal energy during the 1.8-second observation. |
| New `tests/astra-media.test.ts` | Seven local tests passed, approximately 6.3 seconds total. |
| `npm run typecheck` | Passed with the new test and browser script. |

The existing smoke printed success well before exiting. Instrumented cleanup reached browser, publisher, media, native RTC, and HTTP cleanup; it was not a blocked media close. The new browser script explicitly closes HTTP connections during cleanup. The parent agent applied the same small cleanup improvement to the original smoke. This removes HTTP keepalive as an avoidable cleanup dependency; native/browser teardown can still take additional time after result output.

### Local ASR regressions

[astra-media.test.ts](../apps/rally-api/tests/astra-media.test.ts) opens real local WebSockets through `createMuse` with an injected loopback URL and fixture key. It covers:

1. Byte-for-byte preservation of ten PCM frames plus a partial final frame, zero-padding only the final remainder, elapsed-time pacing, delayed final speech, and idempotent final drain.
2. Rejection of more than one second of queued PCM, with no stale payload transmitted.
3. Rejection of an incomplete PCM16 sample before transmission.
4. A deliberately blocked 620 ms Node event loop: the session reports the pacing stall and closes without replaying queued microphone audio.
5. Proper 640-byte silence frames while capture temporarily supplies nothing.
6. Ambiguous multi-label attribution remains unknown; a single label and session identity survive normalization.
7. A provider that never closes after `endStream` triggers the five-second final-drain error and releases the session exactly once.

Existing provider tests additionally cover out-of-order finalized turns, timestamp normalization, and a successful final-drain response. Tests operate through the normalized provider boundary; no new source hooks were added.

## Evidence limits and next useful validation

The browser check uses an oscillator and real WebRTC, proving media transport and normal microphone publication controls. It does not prove physical device acquisition, real user frontend wiring, browser suspension behavior, or speech-recognition quality. Local WebSocket tests prove adapter behavior under controlled messages, not undocumented Muse guarantees. The browser and ASR tests are separate boundary checks; they are not a single browser-speech → real Muse transcript run.

The WebSocket `bufferedAmount` backlog threshold was inspected but not forced by a real constrained network in this review. Automatic LiveKit ICE recovery, packet loss/jitter, browser device switching, speaker-label quality on overlapping real speech, and prolonged multi-host load remain untested. These are limitations of this evidence, not claims of observed failures.

A practical next integration check is a consented browser microphone session through the actual frontend with an explicit reconnect while the microphone remains enabled, followed by End and verification that its final sentence is present in the saved report input. Coordinate any paid part through the shared budget ledger.

## Reproduction

From `apps/rally-api/`, with Node 24 available:

```sh
PATH=/srv/hackathon/tools/node/bin:$PATH npm run test:media
PATH=/srv/hackathon/tools/node/bin:$PATH node --test tests/astra-media.test.ts
PATH=/srv/hackathon/tools/node/bin:$PATH node scripts/astra-media-browser.ts
PATH=/srv/hackathon/tools/node/bin:$PATH npm run typecheck
```

The browser script uses the existing local LiveKit binary and Chromium paths from the original smoke and defaults to port 17890. `RALLY_TEST_MEDIA_PORT` can override its port. Its ignored local artifact is `apps/rally-api/test-results/astra-media-browser.json`; the relevant pre-fix evidence is retained in this document.
