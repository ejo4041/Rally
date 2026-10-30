# Spoken guidance in integrated Rally

The Node app can synthesize approved moderator prompts with self-hosted Meta `facebook/mms-tts-eng`, revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`. Muse remains responsible for transcription and reasoning. The voice adapter uses the existing offline Python worker; no third-party speech service or paid speech request is involved. Model weights use CC BY-NC 4.0; review that license before commercial use. See [model interfaces](model-interfaces.md) and the [MMS prototype](../experiments/meta-mms/README.md).

In a prepared meeting, **Test voice · free** plays a fixed introduction without starting transcription or analysis. It requires sign-in, is limited to once per 30 seconds per account, and is unavailable while that account has a live meeting. For meeting guidance, enable **Spoken prompts · Meta MMS**. Text remains visible when generation, networking or browser autoplay fails. Output is an AI-generated voice played in the host's browser. Participants in a remote call do not automatically receive it; Teams and WhatsApp guest speech injection remains unverified.

## Lifecycle and audio

Only the backend's latest approved intervention ID and epoch can request speech. The client cannot supply spoken text. Jobs expire in 75 seconds, accept prompts at most 30 seconds old, retain at most one in-memory waveform per meeting, and allow one synthesis globally. Pause, dismiss, plan/name changes, revised transcript evidence, interruption and ending revoke eligibility. Navigation, logout, turning voice off and Stop speaking stop local playback synchronously. Browser errors fall back to text without automatic regeneration.

Before playback, the browser acknowledges the job and the server arms a bounded input shield. The browser disables its outgoing capture track; the server sends silence to Muse instead of received audio for the playback window. ASR cadence is preserved and its normal processing charges still apply. Stop/completion shortens the server tail to at most 800 milliseconds. A disconnected browser cannot leave the shield active indefinitely. Human speech during the shielded interval will not be transcribed; use Stop speaking to return the floor. This prevents the local prompt being treated as meeting evidence, but physical multi-device echo behavior still needs rehearsal.

The `SpeechEngine` interface separates process management from approved-prompt lifecycle and HTTP/browser playback. Deployment selects the local implementation with `RALLY_MMS_ENABLED=1`, `RALLY_MMS_PYTHON` and `RALLY_MMS_MODEL_DIR`. The current adapter verifies the pinned model/revision, mono 16 kHz PCM16 and a maximum 30-second output. Future model adapters must define their provenance and validated audio capabilities explicitly.

`RALLY_MODEL_CONFIG.speech` selects `{adapter, model, revision, sampleRate}`. Compatible `facebook/mms-tts-*` checkpoints can be selected with `adapter: "mms-local"`, their own 40-character revision and `sampleRate: 16000`; provision matching weights/hash manifest in the configured directory first. Changed models cannot silently retain the English model's revision. Unsupported adapters, formats, unpinned revisions and unknown speech settings fail validation. The worker checks the actual local manifest and hashes; configuration alone does not establish model compatibility or grant a license. The default English checkpoint is the only one exercised with real weights so far. Other checkpoints are covered only by adapter/configuration fixtures.

## API

All routes require the existing cookie authentication and origin checks. Meeting routes also enforce meeting ownership. Audio responses are private and `no-store`.

| Route | Purpose |
| --- | --- |
| `GET /api/speech/status` | Enabled/ready state and model provenance |
| `POST /api/speech/test` | Fixed diagnostic phrase; ignores client text |
| `POST /api/meetings/:id/speech` | Request `{interventionId, epoch}`; returns job with HTTP 202 |
| `GET /api/meetings/:id/speech/:job` | Poll preparing/ready/playing/completed/canceled/failed |
| `GET /api/meetings/:id/speech/:job/audio` | Bounded WAV response |
| `POST /api/meetings/:id/speech/:job/playback` | Acknowledge playing/completed/canceled |

Diagnostic jobs use the same status/audio/playback suffixes under `/api/speech/test/:job`, scoped to the authenticated account. Waveforms are never saved to the meeting database or exported.

## Validation

Backend tests cover approved text, duplicate requests, cancellation before a late result, epoch changes, canceled-job expiration/replacement timer isolation, global synthesis contention, provenance validation, bounded shields, account isolation, fixed diagnostics, rate limits and pause/end behavior. Browser tests use real Express/SQLite/LiveKit with injected reasoning/ASR; speech can use either synthetic WAV or the actual pinned local MMS process. They exercise actual browser playback, Stop, pause, completion, autoplay rejection and restored capture. These tests do not establish remote participant audibility or human speaker accuracy.

The eight-hour local reliability check runs `node experiments/meta-mms/overnight-check.mjs`, synthesizes a fixed synthetic phrase every 30 minutes and periodically restarts the worker. Its ignored local report is `experiments/meta-mms/test-results/overnight-check.json`. A running report is not an eight-hour pass. No platform meeting, saved waveform or paid model request is used.

## Deployed checkpoint

The initial speech deployment used release `ebf308d` at the [private integrated app](https://rally.tail703f9e.ts.net:8445); see the [current handoff](handoff.md) for the active release. A temporary account and synthetic ready meeting verified authenticated model readiness, real browser WAV playback, Stop and unchanged empty paid usage through the deployed HTTPS endpoint. Test records were removed. [Measurement](research/integrated-speech-deployed.json). The eight-hour soak is still running as of this deployment checkpoint.

## Local worker reload check

A separate four-minute schedule completed five real-model requests, including the periodic worker close/cold reload. [Measurement](research/mms-worker-restart-check.json). The controller remained about 61–63 MB RSS and sampled Python worker RSS was 591–617 MB. Warm requests took 615–691 ms; startup/reload requests took about 3.5–3.6 seconds. These are local synthetic generation/IPC measurements, not physical audible latency or peak memory. No waveforms were saved and no paid requests were made. The eight-hour process remains separate and running.

For a shorter independent run use `RALLY_SPEECH_SOAK_MINUTES=4 RALLY_SPEECH_SOAK_INTERVAL=1 RALLY_SPEECH_SOAK_REPORT_NAME=restart-check.json node experiments/meta-mms/overnight-check.mjs`. Distinct validated report basenames prevent overwriting the overnight result. The current helper uses a monotonic duration, samples Linux worker RSS when available, and records operator-requested stops separately from failures.

## Capture coverage during voice

Before acknowledging a meeting playback, the server records an `audioExclusions` entry keyed by the speech job. `startMs` and `maxEndMs` are relative to meeting start; the maximum endpoint includes the bounded server shield deadline, not an exact measure of lost speech. Early stop, failed autoplay or ending can make the actual interval shorter. Diagnostic voice checks do not create meeting coverage records. Repeated playing acknowledgements do not duplicate a window. If storing coverage fails, playback is not acknowledged and the shield is not armed.

These records are preserved in snapshots, report input and export. The report UI always notes that participant speech may be absent from playback windows, and the reasoning instructions treat them as coverage gaps rather than evidence of silence/disengagement. Bounds must be clipped to actual meeting duration when interpreted. This improves transparency; it does not reconstruct excluded speech or validate a participation score. Older records without this field have no inferred/backfilled windows.

HTTP tests verify diagnostic isolation, one window per acknowledgement, known bounds, server-side suppression, cancellation and coverage reaching the complete-report input. A real-MMS browser workflow also verifies the visible report caveat. No paid model request was used to test the revised prompt.

## Real-worker cancellation and replacement ownership

`node experiments/meta-mms/cancellation-check.mjs` exercises the pinned local worker directly with synthetic text. [Measurement](research/mms-cancellation-recovery-check.json) records cancellation while startup is pending, cancellation of a warm pending request, process exit and a successful fresh-worker waveform. It records the adapter source hash and saves no waveform. The pending-request observation does not establish the exact point reached inside Python inference, and the timings are not physical audible latency.

A separate deterministic adapter test reproduced buffered output from a canceled child closing its replacement. The reader now ignores every event from a child that no longer owns the adapter; startup timeout cleanup also checks ownership. Five adapter tests and ten output/queue tests pass. The existing eight-hour process loaded its adapter before this correction and continues separately; its eventual result must not be presented as an eight-hour test of the new ownership guard.
