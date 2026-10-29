# Connected real-time audio → ASR → moderator benchmark

Run October 28, 2026. Actual Muse calls while the known [licensed reference audio](public-audio-benchmark.md) was streamed at normal speed. One connected trial, not a statistical latency distribution or a physical microphone/meeting demo.

## Scenario and result

Use the three LibriSpeech excerpts under an **artificial software-release agenda**. After two finalized audiobook turns, Spark is asked to decide whether this sustained literary discussion is off agenda. This deliberately obvious mismatch proves the pipeline and timing; it is not a realistic agenda-drift accuracy evaluation.

Spark returned `intervene: true`, cited actual finalized turn IDs 0 and 1, and proposed: “Could we return to deciding the Friday release scope?” The response passed basic schema/evidence checks. The application continued forwarding audio while the request ran; the third finalized turn also arrived normally.

| Milestone | Seconds from first streamed audio |
| --- | --- |
| Estimated acoustic end of second clip | 12.2150 |
| Second final transcript received / trigger eligible | 12.5600 |
| Spark request started | 12.5607 |
| Complete decision parsed and validated | 13.5358 |
| Third final transcript received | 26.9674 |
| Input stream ended | 29.1552 |

Measured relevant-speech-end → validated decision: **1.3208 seconds**. ASR finalization component: **0.3450 seconds**. Reasoning request plus validation: **0.9750 seconds**. This is the connected measurement, not a sum of medians from different runs. Monotonic clock and acoustic-end proxy follow the [source benchmark](public-audio-benchmark.md), with about 80 ms input framing and an RMS-derived boundary rather than human-annotated physical speech offset.

Intentional observation matters: the first clip's estimated speech end was 5.4 seconds. Waiting for two finalized turns meant the decision was ready 8.1358 seconds after that first clip ended. The 1.32-second figure begins after the second, policy-qualifying turn; it does not hide the observation window. The inserted two-second gaps are part of this fixture, not natural meeting behavior.

## Settings and evidence

- ASR: `muse-voice-transcribe-1.0`, ENDPOINTING, PCM16 mono 16 kHz, 80 ms chunks, partial/progress enabled.
- Reasoning: `muse-spark-1.3` Standard, minimal reasoning, 1,024 completion-token cap, compact JSON-schema response, real finalized text only.
- Concurrent I/O: one async audio stream and separate blocking HTTP request in a worker thread; one moderation call, no automatic retries.
- [Saved results](connected-loop-results.json) include request/session IDs, stage timestamps, transcript and decision.
- Harness: `scripts/muse_connected_spike.py`; uses the `/tmp/rally-public-audio/input.pcm` fixture whose hash must match the saved manifest.

No TTS, audible playback, human host cancellation, real participant confirmations, room acoustics, uncertain identity or Teams transport was exercised. The time to **audible** intervention remains unmeasured. One easy sample does not prove intervention relevance in nuanced conversations. Do not advertise this as meeting-wide response latency.

## Cost

Spark: 219 uncached input tokens and 124 output tokens (including 82 reasoning tokens), estimated **$0.00080075**. ASR reported 29.2 seconds processed, metered as 29 whole seconds under the documented rule: **$0.00145000**.

Batch estimate: **$0.00225075**. Cumulative tracked estimate at this checkpoint: **$0.04654160**. Conditional remainder from an applied full $150 grant with no other usage: **$149.95345840**. Actual Billing balance remains unverified. [Official pricing](https://dev.meta.ai/docs/pricing-rate-limits), [current cost ledger](muse-cost-ledger.md).

## Decision

Proceed with the browser vertical slice using ENDPOINTING and Spark minimal; measure the remaining audible-output stage and host override rather than repeating this same easy test. A harder conversational fixture can expose ASR/turn-policy issues separately before broadening product scope.
