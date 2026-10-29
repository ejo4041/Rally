# Rally measured latency results

Real API calls from this server on October 28, 2026. Inputs are purpose-written text fixtures, not microphone/transcription output. Sequential requests, no automatic retries. Timings include HTTP connection/network, complete response, JSON parsing and basic validation; they exclude ASR and speech playback.

Model: `muse-spark-1.3`, Standard mode, max_tokens 1024. Compact agenda and recent turns, JSON schema output. Timing clock: Python perf_counter. Fresh urllib request per sample; no explicit persistent connection. These are short-context smoke tests, not a production latency guarantee.

| Effort | Completed | Valid | Expected behavior | Median seconds | Max seconds | Within 5 sec |
| --- | --- | --- | --- | --- | --- | --- |
| minimal | 10/10 | 10 | 10/10 | 1.382 | 2.324 | 10/10 |
| low | 10/10 | 9 | 9/10 | 1.93 | 2.877 | 9/10 |

Expected-behavior checks test intervene-versus-silent only, plus basic field/evidence validity. They do not establish full wording quality, robust commitment correctness, realistic long-context performance, speaker identity, or live interruption quality.

The low-effort failure consumed the entire 1,024 completion-token budget, including 1,022 reasoning tokens, without usable visible JSON. The parser encountered a TypeError; this is counted as a failed decision, not a successful fast response. That request took 4.165 seconds and is excluded from the valid-response median/max above. Across all ten low-effort attempts, median time was 2.013 seconds and maximum was 4.165 seconds. Do not raise output caps or repeat the experiment merely to improve the table; start the next live loop with minimal effort.

## Transcription access checks

Two real live WebSocket sessions completed successfully using two seconds of real-time-paced zero PCM input each. These tested authentication, mode acceptance, audio transport, processing progress, and clean completion only. Silence is not speech; these sessions provide no transcription accuracy, name-attribution, or speech-finalization measurements.

| Mode | Handshake seconds | Audio processed | Session wall seconds |
| --- | --- | --- | --- |
| ENDPOINTING | 0.631 | 2 seconds | 2.683 |
| DIARIZATION | 0.335 | 2 seconds | 2.494 |

Session wall duration includes deliberately sending audio at real-time pace; it is not ASR response latency. The two sessions cost an estimated $0.0002 together at the documented processed-audio rate.

## Current decision and next evidence

Subsequent test: [public reference-audio benchmark](public-audio-benchmark.md) now measures real-speech finalization and accuracy on clean, single-speaker audio. It supersedes the earlier lack-of-audio-fixture blocker below. Connected reasoning/playback and meeting conditions are still untested. Costs below describe the initial spike only; consult the live ledger for current cumulative totals.

Use Spark minimal for the next audio-loop spike. Reasoning appears compatible with a seconds-scale response on these small inputs, but actual end-to-end meeting readiness is still unproven. No microphone device, audio fixture, or browser speech runtime is available in the current headless environment. Next, capture a consented short meeting recording or run a browser microphone diagnostic, then measure finalized speech → validated decision → actual playback. Do not substitute silence or fixture-text latency for that measurement.

## Reproduction and cost

Harness: `scripts/muse_latency_spike.py`. The reasoning path uses Python's standard library; `--asr-check` requires `websockets`. In this environment pip was unavailable, so a PyPI universal wheel (websockets 17.3) was SHA256-verified and unpacked only under `/tmp/rally-benchmark-deps`; ASR was run with `PYTHONPATH` pointing there. No global dependency changes were made.

The harness parses `.env.local` as data, records sanitized usage after each request, makes no automatic retries, and now checks a $0.15 per-run estimate limit, $10 daily target, $90 development ceiling, and unknown prior costs before new calls. These are local safeguards, not a provider-enforced hard spending cap.

This turn's 21 text calls (one initial smoke check plus 20 decision tests) and two ASR checks cost an estimated **$0.04139085**. Conditional remainder: **$149.95860915**, assuming a full applied $150 grant and no other usage. Actual Billing balance remains unverified. See the live ledger for any later updates.

ASR finalization, actual audible playback, host cancel, real room acoustics, overlap, and Teams transport remain unmeasured. The end-to-end ≤5-second acceptance gate has NOT passed on reasoning results alone.

See [per-call log](muse-call-log.jsonl) for timings, decisions and usage; [cost ledger](muse-cost-ledger.md) for estimates and conditional credit remainder.
