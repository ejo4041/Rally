# Meta MMS speech queue and browser playback

**Deployed:** [Version 9](releases/2026-10-29-v9.md) now connects this queue to the restricted Site and the manually active MMS service. Teams voice output remains pending.

The speech bridge connects the existing Worker/D1 app to the local Meta MMS engine. It is independent of the Teams meeting transport. The English checkpoint is self-hosted on the Rally Ubuntu CPU host; [model provenance and setup](../experiments/meta-mms/README.md) and [capability configuration](model-interfaces.md) specify the model and execution location.

## Behavior

- The browser requests speech for an approved server-side moderator utterance ID and epoch. A separate Test voice action uses a fixed synthetic phrase.
- One pending job occupies the queue. The warmed MMS runner claims it once, produces bounded PCM and returns it through the authenticated bridge.
- The browser polls for readiness, then plays the same-origin WAV. It shields microphone input during actual playback, not while the model is generating audio.
- Stop immediately pauses local audio and cancels the queue job. Late create responses and audio callbacks cannot restart canceled speech. Paused/ended meetings, changed epochs and canceled utterances invalidate audio access.
- Missing/offline speech, autoplay refusal, invalid output or timeout leaves the prompt visible. No third-party TTS fallback is selected.

The queue uses the existing server bridge secret; production service access also uses the existing Sites service authorization header. Credentials remain server-side. Model checkpoint identity must match between runtime configuration and the warmed runner. Generated speech is cached as bounded WAV data, not stored as raw participant audio.

Jobs expire after 60 seconds and are pruned during speech API/runner requests. Cancellation clears stored text/audio immediately. This is access-time expiry plus request-driven cleanup, not a claim of independent scheduled deletion when all processes are stopped.

## Local reproduction

Apply the app's additive `0003_mms_speech` migration through the normal local preview. Earlier migrations remain unchanged. Use separate terminals:

```bash
cd apps/rally
RALLY_MMS_ENABLED=1 PORT=8792 npm run dev
```

```bash
RALLY_RUNNER_ORIGIN=http://127.0.0.1:8792 node experiments/meta-mms/runner.mjs
```

The runner uses the existing bridge configuration from the ignored root environment. Load the model before advertising readiness. The local preview defaults paid Muse calls off, so the labeled walkthrough can exercise moderator-output playback without transcription/reasoning charges. The test voice uses only explicitly authored synthetic text.

For production, publish the migration/Worker and enable `RALLY_MMS_ENABLED=1`, then start the configured speech runner manually against the existing Site origin. Its deployment and service state must be recorded separately; running a local test does not establish production readiness. Do not start a second runner while the existing lease is fresh. No automatic startup or meeting join is implied by this implementation.

## Measured local result

The real local engine completed the Worker/D1 queue → MMS → Chromium audio path with an HTTP 200 WAV response. In the first trial decoded playback began 2.109 seconds after clicking Test voice. Stop cleared playback and no delayed callback restarted it. This is a headless decoder/playback event measurement; browser output was muted, so physical sound, pronunciation and Teams transmission were not verified.

[Recorded initial result](research/mms-queue-browser.json). A later regression also exercises a server-approved opening from the labeled walkthrough; keep its actual result with the release report. No microphone, real meeting or paid Muse request is needed for that test.

The next live checks remain device audibility, autoplay behavior in the intended browser, host stop under real timing, echo isolation, and Teams output routing. Real Teams audio already feeds Muse transcription; this speech implementation does not use Teams' native transcript or voice generation.
