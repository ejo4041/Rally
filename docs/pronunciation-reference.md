# Local pronunciation references — November 1, 2026

The user accepted the revised sentence flow but reported wrong pronunciations, including Meta and evidence. Rally now checks ordinary words against a preloaded English pronunciation reference before either speech adapter sends text to its model. The dictionary is local and pinned; there is no online word lookup, model call or downloaded speech on the reply path.

## Reference and correction are different operations

The bundled CMU Pronouncing Dictionary provides126,052 lexical entries with stress-marked ARPABET references and variants. It is loaded once at process startup, checked against its SHA-256, and retained as a static in-memory map. [Pinned source manifest](../packages/rally-speech/vendor/cmudict-manifest.json), [full license](../packages/rally-speech/vendor/CMUDICT-LICENSE), [upstream](https://github.com/cmusphinx/cmudict). The project's own README warns that dictionary entries may be imperfect; it is a reference dataset, not an additional TTS model/service.

A dictionary match alone cannot force the current models to pronounce that word correctly. The pinned MMS tokenizer has phonemization disabled and accepts graphemes. The existing hosted Seamless request contract has text/voice/format/chunking fields, with no verified direct phoneme or SSML control. Sending ARPABET or IPA as ordinary text would risk speaking the notation itself. We do not do that.

Instead, ordinary words are referenced, while explicit per-adapter corrective spellings supply the model input for known troublesome terms. Most correctly pronounced words retain their original spelling. Unknown names and context-dependent variants such as read are kept unchanged rather than guessing a person or tense. URLs, email addresses, dates, negation and conditions retain their wording. Approved interventions, source transcript, response history and captions use canonical original spelling; no pronunciation tokens become meeting evidence.

## Initial targeted corrections

The generic CMU entry for meta is `M IY1 T AH0`, corresponding to a long-ee vowel. That entry is not the intended Meta brand pronunciation. Rally supplies `M EH1 T AH0` for the capitalized brand and retains lowercase generic meta separately. Evidence is referenced as `EH1 V AH0 D AH0 N S`.

[Correction records](../packages/rally-speech/corrections.json) carry their targets and listener-review status. Initial model-facing candidates use Metta for the brand and evidense for MMS evidence; hosted evidence retains its ordinary spelling. These are grapheme cues, not guaranteed phoneme controls. They are deployed candidates pending listener acceptance. The spaced-syllable alternative is retained as a separate sample because it can sound more segmented; it is not the default.

The existing operator `RALLY_SPEECH_PRONUNCIATIONS` dictionary takes precedence over built-in corrections for exact supplied terms. Confirm personal-name pronunciations before adding entries. Both adapters compile one preparer per configuration; they do not rebuild the pattern, load files, request services or retain meeting-text caches on every reply. Unsupported adapters/invalid overrides fail configuration validation. Acoustic word-by-word synthesis is avoided, retaining whole-sentence intonation and the existing sentence pauses.

## Measured delay and artifacts

[Measurement record](research/pronunciation-reference-2026-11-01.json). A warmed synthetic1,200-character preparation benchmark over3,000iterations measured median0.037ms and95th-percentile0.087ms; the maximum observed was2.976ms. Cold reference loading was145ms once at startup. These are server-local preparation measurements, excluding model inference/network/playback and not a guarantee on other hardware.

The revised demo's177 unique word tokens have references from CMU or the explicit technical-term table. This establishes reference coverage, not correct acoustic pronunciation of every word. The new local artifact is `artifacts/feedback/voice-lexicon-v2/rally-three-minute-narrated-draft.mp4`, exactly180seconds, fully decoded, without narration acceleration. Prior versions remain preserved. Original on-screen spelling/captions stay intact.

Listening samples in that directory:

- `original.wav`: ordinary Meta/evidence spelling through the previous text preparation.
- `candidate-a.wav`: Metta/evidense grapheme cue, used by the new local demo.
- `candidate-b.wav`: spaced-syllable comparison; not the default.
- `hosted-after.wav`: actual hosted Seamless with the reference-aware preparation, authored synthetic text and no meeting join. One uncached request, first PCM1.505seconds, total3.228seconds, generated8.48seconds. This is not a paired hosted before/after comparison.

No new Muse call. One separately recorded AWS speech request has unknown infrastructure cost; no retry. Tracked Muse remains$5.33846965; conditional unverified-$150 remainder$144.66153035, excluding unverified unrelated activity. No video upload, external message or final submission occurred.

## Acceptance

Tests cover whole-word/brand-case matching, explicit override priority, immutable original text, unchanged unknown names/homographs/URLs, checked reference variants, dictionary checksum startup, prototype-safe lookup and both adapter boundaries. The measured pipeline remains bounded and cancellable. Regression and deployment results are in the [current handoff](handoff.md).

Listen to the new candidate in full sentences, particularly Meta and evidence. Additional incorrect words need a model-specific correction checked in context. A general-purpose dictionary lookup does not provide a universal acoustic-correctness guarantee. If extensive ordinary-word errors remain, the appropriate next step is an eligible Meta voice/backend with explicit phoneme support or better base pronunciation, evaluated separately for quality and first-audio latency. No unverified backend/model has been substituted by this work.

One browser regression initially timed out waiting for one transient status string after a refused renewal. The assertion now observes the actual409heartbeat response and stopped tracks, preserving the no-automatic-restart/report checks; a simultaneous gap notice cannot hide the underlying behavior. This changes test synchronization, not production capture logic.
