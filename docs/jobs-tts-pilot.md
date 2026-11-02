# Steve Jobs speech comparison — November 2, 2026

The user authorized selecting a YouTube video, suggesting Steve Jobs, to test TTS against natural speech. Selected: [Stanford's official YouTube upload of the 2005 commencement address](https://www.youtube.com/watch?v=UF8uR6Z6KLc). [Stanford's prepared transcript](https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says) supplies textual provenance. YouTube extraction on this host returned a sign-in/bot challenge; no account/cookie bypass was used.

## Actual source and sample

The audio used is the downloadable [Best Graduation Speeches podcast copy](https://grad-speeches.podigee.io/1-steve-jobs-stanford-university-2005) of the same address, not a verified bit-identical extraction of the YouTube stream. [Measurements](research/jobs-tts-pilot-2026-11-02.json) include the media URL, original MP3 hash and clip hashes. The full source remains an ignored private artifact, not a source-code attachment. No change to the demo's public content or application models was made.

A real Muse ASR pass over the first45seconds located the opening speaker introduction and Jobs's first remarks. The pilot then selected the21-word greeting/opening sentence, at21.2–34.6seconds in this podcast. A separate same-adapter ASR pass transcribed that selected clip exactly as the canonical reference; the main statement matches Stanford's prepared text, with the brief spoken thanks included. No human listening verification is claimed. This is a13.4-second initial pilot, smaller than the proposed30–60-second study, not a broad corpus result.

Rally's current pinned MMS synthesized the same canonical words with the existing sentence pacing, no voice cloning, extra pronunciation overrides or speed fitting. The hosted Seamless request failed with an adapter502/provider-request error. Its original upstream status was not retained, no audio was obtained, cost remains unknown, and the request was not retried. No Seamless quality score or latency result is inferred from that failure.

## Initial scorecard

| Measure | Original recording | Rally local MMS |
| --- | --- | --- |
| Reference words |21|21|
| Muse-recognized word errors |0|0|
| Word-error rate |0%|0%|
| Clip duration |13.40s|6.496s|
| Samples at clipping threshold |0%|0%|
| Longest internal low-energy interval |4.26s|0.60s|
| Listener naturalness MOS |Not collected|Not collected|

Zero WER means this recognizer recovered the intended text. It cannot prove that individual words are pronounced naturally. Duration and energy measurements expose rhythm differences without assigning a naturalness verdict. The original has a substantial pause after the brief greeting. Recorded context/audience noise and low-level speech confound energy thresholds; low energy is not validated silence or speech activity. There is no universal requirement that a TTS voice copy a public speaker's pauses.

Local MMS cold loading took3.027seconds; the complete6.496-second waveform was ready1.859seconds after warm synthesis began. MMS does not stream first audio in this path. These are single observations, not latency percentiles or remote audible latency. The production hosted voice is separate and remains unmeasured for this passage because its request failed.

## Listening comparison

Local standalone page: `artifacts/feedback/jobs-tts-pilot/listening.html`. It embeds two randomized clips, hides identities until revealed, asks for separate1–5naturalness ratings and notes about incorrect words, and exports ratings to the listener's device. Audio is matched to-24LUFS using constant gain only; measured levels are within0.15LUFS, with peak headroom checked. Pitch, timing and dynamics are preserved. No network/telemetry, production account or upload is involved.

The review page is an informal single-listener pilot, not an ITU-conformant population study. Naturalness remains null until actual listeners rate the clips; synthetic browser checks of the controls do not become listener ratings. The human reference may remain recognizable despite hidden labels, and archival recording conditions can bias judgments. A future study should use multiple passages/speakers and listeners, include held-out meeting terms, and report uncertainty.

Raw local clips: `original.wav` and `mms.wav` in the same artifact directory. The matched-loudness versions are embedded in the page. The existing Meta/evidence/agenda examples remain separate: these words do not appear in this Jobs passage, so this pilot does not validate their pronunciation corrections.

## Reusable tools and verification

- `scripts/tts_scorecard.py`: offline WER/error alignment plus duration/clipping/energy diagnostics from a manifest. Never fabricates naturalness MOS.
- `scripts/build_tts_listening.py`: self-contained randomized listening page with measured constant-gain loudness matching, notes/export and optional identity reveal.
- `apps/rally-api/scripts/tts-reference-asr.ts`: explicitly gated production Muse ASR measurement,60-second maximum, isolated$0.02per-run budget, retained output/usage, no automatic retries.
- `scripts/jobs-tts-pilot.mjs`: retained single-run MMS/one-request hosted-speech experiment with private artifacts and failed-hosted-request accounting.

Four offline metric tests pass, including detection of missing conditional words and a known400ms test pause. API typecheck passes. The standalone page passed a bounded real-browser smoke for hidden identities, both audio elements, rating export and reveal; no human ratings were collected by that test. No production deployment/restart was required.

## Cost

Three Muse transcription calls:45s discovery,$0.00225000;13.4s selected reference,$0.00065000;6.496375s synthesized clip,$0.00030000. Costs use the adapter's conservative whole sent-or-processed-second accounting, not independently verified Billing. Batch **$0.00320000**, unknown0/running0. Tracked cumulative **$5.34166965**; conditional unverified-$150 remainder **$144.65833035**. Unrelated runtime usage/grant balance remain unverified. One failed AWS-hosted speech request has **unknown infrastructure cost**, separate from Muse. No meeting joined, no final submission and no content uploaded.
