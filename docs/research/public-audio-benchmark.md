# Public reference-audio transcription benchmark

Run October 28, 2026. Actual Muse API calls; no generated transcripts or accelerated uploads. This is a clean audiobook baseline, not a public-video or meeting benchmark.

## Source and license

Three consecutive clips (rows 0–2) from [Hugging Face’s small LibriSpeech validation fixture](https://huggingface.co/datasets/hf-internal-testing/librispeech_asr_dummy), revision `5be91486e11a2d616f4ec5db8d3fd248585ac07a`. These are dev-clean excerpts, not a new held-out test corpus. Original corpus: [LibriSpeech / OpenSLR 12](https://www.openslr.org/12), prepared by Vassil Panayotov with Daniel Povey; corpus paper authors Vassil Panayotov, Guoguo Chen, Daniel Povey, and Sanjeev Khudanpur. License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Audio and reference text are supplied together by the dataset; reference text was never sent as an ASR prompt or keyword hint.

We used paired reference audio rather than extracting a random video: source transcript alignment and license are documented, and only three tiny assets were needed. This does not establish performance on spontaneous video discussions.

Transformation: decode FLAC to 16 kHz mono PCM16; concatenate clips in source order and insert two seconds of silence after each. Original speech speed unchanged. Raw source/PCM cached in `/tmp/rally-public-audio`, not committed. [Manifest](public-audio-manifest.json) records sample IDs, hashes, source revision, reference text, durations, and transformations.

## Method

One WebSocket session per mode, streamed in 80 ms chunks at real-time pace. Same audio and settings except mode. Model `muse-voice-transcribe-1.0`, `PCM_16KHZ`, cumulative partials and progress enabled; no retries. Each session contains 29.155 seconds including added silence. Source clips total 23.155 seconds, including their original natural pauses. All samples are one known speaker, not three speakers.

WER = word-level Levenshtein edits / reference words, after lowercasing and removing punctuation while preserving internal apostrophes. No special substitution for names, abbreviations, or numbers. Aggregate word sequence checked against the full concatenated reference.

Finalization delay is final transcript receive time minus an estimated acoustic end: last 20 ms source frame with RMS above 200 PCM units. One local perf_counter clock tracks real-time input and received events. Chunk pacing gives about 80 ms granularity and the RMS boundary is a proxy, not human-annotated timing. Each final transcript matched one whole reference clip in this run; cumulative word-count alignment was checked against the saved transcripts. Delay includes buffering and network as well as provider processing. It is not a pure model inference number.

## Results

| Mode | Reference words | Word errors | WER | Median finalization delay | Maximum delay | Estimated cost |
| --- | --- | --- | --- | --- | --- | --- |
| ENDPOINTING | 59 | 0 | 0.00% | 0.516s | 0.535s | $0.00145 |
| DIARIZATION | 59 | 0 | 0.00% | 0.694s | 0.918s | $0.00145 |

| Clip | Duration | ENDPOINTING delay | DIARIZATION delay |
| --- | --- | --- | --- |
| 1272-128104-0000 | 5.855s | 0.535s | 0.534s |
| 1272-128104-0001 | 4.815s | 0.516s | 0.918s |
| 1272-128104-0002 | 12.485s | 0.431s | 0.694s |

Full transcript/events and receipt timestamps: [results JSON](public-audio-results.json). All observed speechComplete events arrived before endStream on this successful run, demonstrating incremental finalization rather than waiting for the entire recording to end.

## Interpretation and limits

Clean-speech transcription is fast enough to justify the next live-loop experiment. ENDPOINTING had the lower finalization delays on this tiny sample. This is not a reliable distribution estimate, proof of meeting readiness, or evidence that diarization is universally slower.

These are only 59 words from one known speaker, drawn from a widely used benchmark that could have appeared in model training/evaluation. No overlap, microphones, room echo, named-speaker introductions, topic drift, reasoning, TTS, host cancellation, or Teams transport was tested. The two-second inserted gaps help endpoint detection; natural conversational gaps can be shorter. Aggregate WER ignores capitalization and punctuation.

The earlier Spark fixture timings cannot simply be added to this run and described as measured end-to-end latency. Next test the connected speech → finalized evidence → live moderator → audible response path, then a licensed conversational/video segment with independent transcript and multiple speakers.

## Cost and reproduction

This batch: **$0.00290000 estimated**. Cumulative tracked spend: **$0.04429085**. Conditional remainder from a full applied $150 grant with no other usage: **$149.95570915**. Actual Billing balance remains unverified. See [cost ledger](muse-cost-ledger.md).

Pricing: [Meta official rates](https://dev.meta.ai/docs/pricing-rate-limits), $0.18 per processed audio hour with whole-second metering; both completed sessions reported 29.155 seconds processed, giving 29 billed whole seconds each under the documented rounding rule. No Spark/TTS calls in this batch.

Harness: `scripts/muse_audio_benchmark.py`; uses existing `websockets` temporary dependency and libsndfile to decode the reference audio. For this run, the SHA256-verified PyPI soundfile 0.14.0 Linux wheel was unpacked to `/tmp/rally-audio-decode`; only its bundled libsndfile was loaded via ctypes. No global package installation. WER sanity checks passed (case/punctuation normalization and single insertion/deletion).

Command used:

```bash
PYTHONPATH=/tmp/rally-benchmark-deps python3 scripts/muse_audio_benchmark.py --sndfile /tmp/rally-audio-decode/_soundfile_data/libsndfile_x86_64.so
```

The script explicitly loads the ignored credentials file; do not print it. Default run estimate cap $0.02, existing daily/development budget checks, no automatic retries. Raw audio is fetched again on a rerun; do not rerun without an unanswered question.
