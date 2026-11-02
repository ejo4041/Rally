# TTS evaluation: naturalness, pronunciation and latency

Research checked November 1, 2026. This is an evaluation design, not a measured TTS score. Existing waveform-generation, dictionary-coverage and regression tests do not establish acoustic correctness or naturalness. No new model calls, evaluation-model downloads, platform joins or final submission occurred.

## Standards and evidence

[ITU-T P.800](https://www.itu.int/rec/T-REC-P.800/en) defines subjective speech-quality assessment methods. [P.808](https://www.itu.int/rec/T-REC-P.808/en) addresses crowdsourced subjective speech-quality assessment. TTS naturalness commonly uses listener mean opinion scores (MOS), typically on a1–5scale, with test instructions specifying the property being rated. These transmission-quality standards inform a listening protocol; an informal Rally test is not automatically a standards-conformant study. [P.800.1 terminology](https://www.itu.int/ITU-T/recommendations/rec.aspx?lang=en&rec=12972) distinguishes subjective listening, objective-model and other MOS values.

The [SOMOS TTS research](https://arxiv.org/abs/2204.03040) collects naturalness MOS and documents limitations of automatic MOS predictors on synthesized speech. [Evaluating Speech Synthesis by Training Recognizers on Synthetic Speech](https://arxiv.org/abs/2310.00706) distinguishes recognizer-based word error rate as primarily an intelligibility metric from broader naturalness. An ASR model can recover intended words despite a mispronunciation; zero WER is not proof that agenda sounds natural.

[ViSQOL](https://github.com/google/visqol) is a full-reference spectro-temporal quality metric, giving MOS-LQO, and supports16kHz speech evaluation. Engineering inference from that design: scoring an independently synthesized voice against a human speaker can confound different timbre, pitch, timing and rendering with degradation. Such a score is not an appropriate primary naturalness verdict for Rally. It is more applicable to a matched source before/after transport, codec or noise damage. Do not rank different TTS voices solely by raw waveform/spectral similarity to the original video.

## Comparing a video with synthesized transcription

Use a clean, single-speaker extract, ideally30–60seconds without music or effects. Manually verify its transcript first. Split into matched sentences, preserve the original speech, and synthesize the exact same canonical text through local MMS and hosted Seamless independently. Track internal pronunciation cues separately; compare ASR output to canonical text, not phonetic spellings. A new speaker identity need not match the human reference. Do not imply that the speaker was cloned.

Normalize listening loudness without changing pitch or time, randomize unlabeled clips, and include natural speech as a hidden control. Test both a representative fixed corpus and previously unheard sentences, including Meta/evidence/agenda, names, numbers, corrected dates, questions and conditional decisions. Corrections must improve more than a memorized demo line. Keep at least a small held-out set for confirming improvements.

Report independent dimensions:

| Dimension | Measurement | Interpretation |
| --- | --- | --- |
| Naturalness | Blind human1–5ratings, mean plus95%confidence interval and listener/clip counts | Primary perceived naturalness result; no invented automatic equivalent |
| Preference | Randomized A/B comparison of old/new speech | Whether listeners actually prefer the change; ties allowed |
| Intelligibility | Same ASR on natural and TTS audio versus verified text, WER plus word errors | Recognizer-dependent clarity proxy, not proof of correct pronunciation |
| Target pronunciation | Listener-labelled errors and optional validated phone-level alignment/assessment | Flag exact problem words; aligner success alone is not a pronunciation verdict |
| Prosody | Sentence durations, pause placement/duration, speaking rate and pitch-contour summaries | Diagnostics versus the reference; different natural readings need not match exactly |
| Audio defects | Clipping, dropouts, abrupt joins and loudness | Technical sound quality rather than linguistic naturalness |
| Live responsiveness | Request-to-first-PCM, request-to-first-audible output and completion at p50/p95 | Keep processing and actual delivered-audio latency separate |

Word/phone alignment must be validated on these voices before use as an automated gate. Dictionary matches only establish a target pronunciation. A generic learned quality estimator is a proxy that needs calibration against our listeners and voices; it is not a ground-truth human score. Evaluate any additional model/tool against project constraints before installing it. Muse can supply ASR with bounded accounting; no additional runtime intelligence provider is implied by this plan.

## Practical initial Rally study

Start with20–30short utterances and a small blind pilot, for example5–10listeners if available. Those are engineering starting points, not an ITU-mandated sample size or sufficient evidence for universal claims. Record accent/language, playback environment, rater count, clip count, failures and uncertainty. Report MOS and A/B preference separately from the automatic diagnostics. Reserve a held-out subset. Separate demo narration, local meeting MMS and actual hosted Seamless results.

Store source/derived recordings privately and publish only consented excerpts and sanitized aggregate results. Use the source video as a natural-speech baseline and prosody guide; no identity similarity target is required. Await a selected clip or source before generating a real comparison. No score has yet been computed for a video comparison.

## First selected-source pilot

The user authorized selecting a public Steve Jobs video. [November2 pilot](jobs-tts-pilot.md) uses an explicitly identified podcast copy of the same Stanford address because YouTube blocked extraction. The short original/MMS comparison has actual WER/timing/audio measurements and a private randomized listening sheet. Human naturalness ratings remain uncollected; the attempted hosted speech request failed without retry. This is an initial21-word pilot, not the proposed full listening study.
