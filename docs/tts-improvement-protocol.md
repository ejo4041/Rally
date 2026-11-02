# TTS improvement protocol — November 2, 2026

Recommendation requested by the user after the Jobs pilot. This is a proposed engineering protocol, not new quality results or a standards-conformant study. No paid experiments, model changes, deployment, listening recruitment or submissions were performed in this planning step.

## Decision

Freeze the current baseline, measure specific audible errors, change one component, and compare the change blindly on unseen meeting sentences. Keep naturalness, pronunciation, preservation of meaning and delivery latency as separate outcomes. A dictionary lookup establishes a reference; it does not correct the waveform unless the model successfully renders a validated cue. Stop deploying spelling candidates solely because generation/tests succeed.

The Jobs pilot is useful as a debugging example, not the primary benchmark: one21-word passage omits our problem words, has a long rhetorical pause and comes from an archival recording. Its0%WER on both clips already shows why recognizer success alone cannot select the more natural voice. A different voice can sound natural without imitating Jobs or matching his timing.

## 1. Prespecify the task and freeze data

Create40authored English utterances representative of Rally. Include short interventions, direct answers, longer recaps, names, dates/times, initials, questions, negation and release conditions. Include Meta/evidence/agenda in several contexts, with both singular/plural and different sentence positions. Cover word stress, vowel errors, numbers, word joins and sentence contours. Do not replace difficult wording with easier wording in the evaluation to conceal a failure.

Assign20utterances to development and20to held-out validation before synthesis. Freeze their canonical text, target pronunciation/meaning and split. Use development examples to select cues/settings. Do not inspect/tune against held-out outputs during development. Once validation is opened for tuning, it becomes development data and a fresh held-out set is needed. Additional known-error examples may form a diagnostic set, reported separately from representative validation.

Use clean consenting human recordings of some identical sentences as natural controls where available; keep Jobs as an ancillary reference. Record accent/pronunciation preferences explicitly. There is no single universally correct personal-name pronunciation; confirm it with the individual. Keep human source rights and recordings outside the public source export unless publication is approved.

## 2. Establish current quality and classify errors

Generate a bounded baseline batch using exact model/checkpoint/configuration, canonical text and actual postprocessing. Log generated spoken text separately. Keep the original audio immutable. Have listeners annotate an exact word/time and error type: vowel/consonant, syllable stress, omission/repetition, unintended pause, rushing, unnatural sentence contour, click/clipping or slow response. Also record severity: distracting, hard to understand, or meaning-changing.

Blind-listen first without transcript to assess comprehension; then show canonical text for pronunciation/error annotation. Recognizer WER, clipping and energy/timing diagnostics help triage, but do not replace the listener error labels. A forced alignment locating the intended word is not proof that it was pronounced correctly.

## 3. Run controlled interventions

Use two comparisons with distinct purposes:

- Within MMS: current baseline versus a single change, such as one grapheme cue, speaking rate or sentence-pause policy. Hold voice, text, seed, level and all other settings fixed. Test corrected words in multiple surrounding sentences rather than isolated word concatenation.
- Between eligible engines: best validated MMS configuration versus hosted Seamless on the same canonical text. This evaluates the model ceiling and deployment tradeoff; it cannot isolate the cause of improvement because voice/model differ.

Maximum three configurations per pilot avoids spreading listener attention and paid requests across many weak candidates. Run a small technical feasibility check first; the last Seamless request failed, so do not assume service availability. Record failed requests, missing audio and retries explicitly. Do not silently repeat paid failures or drop them from reliability statistics. Evaluate any new backend against the existing Meta-model constraint before adoption; no third-party inference model is authorized by this protocol.

Do not convert every dictionary phone string into guessed orthography. The present models have no verified direct phoneme/SSML input in these adapters. Escalate to a separately evaluated eligible Meta model/backend when several cue/pacing experiments fail on development examples or gains do not generalize. An engine with better native pronunciation may outperform an expanding exception list.

## 4. Blind evaluation

Start with approximately10listeners as a feasibility pilot; recruit more if confidence intervals remain too wide for a decision. This number and the40sentence count are proposed starting points, not a standard requirement or a guarantee of power. Use pilot variance/effect estimates for later sample-size planning.

Match loudness with constant gain, preserve pitch/time, randomize identities and playback order independently per listener, and balance sentence/configuration exposure. Use the same canonical sentence in paired comparisons, allow ties, and keep the listening session practical through balanced subsets if needed. Include clean human controls and an occasional repeated sample to inspect consistency; define any exclusion rules before examining preference results.

Rate naturalness with an explicitly anchored1–5scale. Separately mark pronunciation errors and answer a short comprehension question on meaning-sensitive items. Collect A/Bpreference for the changed configuration. Do not tell listeners which cue/voice is expected to win. Archive exact instructions, anonymized ratings, configuration/clip hashes, environment, language/accent and listener/utterance counts.

## 5. Analysis and proposed release gates

Report per-configuration pronunciation-error counts/rates, critical meaning errors, naturalness mean and paired changes, A/Bwin/tie/loss counts, recognition WER, and reliability/latency distributions. Show95%confidence intervals. Repeated ratings from the same people or sentences are not independent observations: preserve pairing and account for both listener and utterance effects, using an appropriate crossed-effects analysis or paired bootstrap over listeners and utterances. Avoid claiming significance from treating every rating as an independent sample. Report known-error and representative held-out sets separately.

Suggested engineering thresholds to agree before looking at validation results:

| Outcome | Proposed initial gate |
| --- | --- |
| Preservation of meaning | No observed meaning-changing omission/substitution on the fixed critical test set; this is finite coverage, not a universal guarantee |
| Reported problem words | Fewer audible errors across unseen contexts, without a new systematic error elsewhere; count uncertainty and disagreements |
| Naturalness | Aim for at least+0.3on the same1–5scale, paired confidence interval above zero; otherwise collect more data or label inconclusive |
| Preference | Report wins/ties/losses and uncertainty; use it alongside naturalness/error labels, not as another independently selected success criterion |
| Live latency | Additional p95request-to-first-PCM delay at most150ms relative to that same engine's baseline; report absolute latency and cancellation behavior separately |
| Reliability | No hidden failures; investigate any deterioration in success rate before promotion |

These are product targets, not ITU-defined pass marks or a claim that the current system meets them. Use a fixed stopping/sample plan; repeatedly testing until a favorable result appears invalidates ordinary confidence claims. If multiple candidates are screened, select on development data and confirm the one chosen candidate on held-out data.

Measure live latency over at least30short utterances as an initial diagnostic, log input length/load/cache, distinguish cold/warm behavior, and report sample count with p50/p95rather than a single fast call. A30sample tail percentile is preliminary. Request-to-first-PCM is not request-to-remote-audible speech. The latter needs the actual meeting route. Reuse generated audio for listening rather than paying for repeated synthesis merely to play it again.

## 6. Separate demo and live acceptance

Demo narration can be generated ahead of time and reviewed/selected in full sentences, with no need for runtime speed fitting. Include final mixed-video audio in acceptance, not only raw WAVs. Live replies need broad pronunciation generalization, quick first audio, complete conditions/dates and immediate cancellation. A manually selected demo take must not be presented as evidence that every live response has that quality.

Promote a confirmed change to a candidate release, record its evidence, then verify through the actual meeting path. Preserve rollback configuration and keep provider accounting. Do not claim standards conformity, a naturalness MOS or success on untested words without supporting measurements.

## Evidence behind the design

- [ITU-T P.808](https://www.itu.int/rec/T-REC-P.808-202106-I/en) provides a standardized framework for crowdsourced subjective speech-quality assessment; this lightweight plan borrows principles but is not automatically conformant.
- [Kirkland et al., Stuck in the MOS pit (2023)](https://www.isca-archive.org/ssw_2023/kirkland23_ssw.html) shows that rating instructions and scale choices affect MOS. Preserve identical instructions within comparisons; do not compare an isolated score to unrelated papers as a universal ranking.
- [Pine et al., Practical & Contextual Speech Synthesis Evaluation (2025)](https://www.isca-archive.org/ssw_2025/pine25_ssw.html) motivates contextual, timed error annotations to identify what should be improved beyond a global MOS.
- [Rosenberg and Ramabhadran (2017)](https://www.isca-archive.org/interspeech_2017/rosenberg17_interspeech.html) documents listener/text bias and cautions against significance tests that ignore it.

[Current evaluation tools](jobs-tts-pilot.md), [model limitations](pronunciation-reference.md) and [general evaluation background](tts-evaluation.md) supply the starting point. The next execution step is freezing the authored corpus and baseline batch; no new provider batch has run under this plan yet.
