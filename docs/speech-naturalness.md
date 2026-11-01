# Speech pronunciation and sentence pacing — November 1, 2026

The user reported unnatural demo narration, mispronounced words and poor pauses. The current local Meta MMS tokenizer produces identical token IDs for “We can release. Only after verification.” and the same text without the sentence punctuation. The previous worker sent an entire chapter through that tokenizer. The old video renderer also accelerated any narration that exceeded its chapter. These are reproducible contributors to rushed phrasing; they are not a complete explanation of every perceived pronunciation error.

## Changes

MMS now synthesizes complete sentences separately, trims only quiet audio edges with35ms handles, applies5ms boundary fades and inserts300ms silence between sentences. It does not splice individual words or stretch audio. Decimals, times and common titles/initials remain within sentences. The total30-second output, one-request concurrency, cancellation/worker termination and pinned model checks remain enforced. Sentence timestamps are returned for caption timing. A spoken-rate setting changes VITS inference duration, bounded0.85–1.15; default1.0. Sentence silence is configurable120–650ms, default300ms. Neither setting claims to make the underlying single-speaker voice human-equivalent.

The shared presentation-only text preparation at `packages/rally-speech/text.mjs` spells technical initialisms for each adapter. Examples: AI, API, MMS, TTS, PDF and UI; SeamlessM4T is expanded into its spoken model name. The local grapheme model receives pronunciation-oriented letter spellings, while hosted speech receives ordinary separated initials. Original approved interventions, canonical transcript/evidence and displayed captions remain unchanged. There is no model-authored rewrite, invented agreement, date conversion or third-party voice fallback. URLs/email addresses are preserved, and replacements match whole terms once.

An operator dictionary can supply phonetic spellings for names/domain terms after a speaker confirms them. Do not guess a person's pronunciation from their meeting display name. Configuration uses the same dictionary in local MMS and the hosted Seamless adapter; local entry points outside the integrated API can pass `pronunciations` to `MMSSpeech`. No custom name spellings are enabled by default.

```dotenv
# Server-side JSON; sample only, confirm an individual's pronunciation first.
RALLY_SPEECH_PRONUNCIATIONS={"Priya":"Pree yah"}
RALLY_MMS_SPEAKING_RATE=1
RALLY_MMS_SENTENCE_PAUSE_MS=300
```

Malformed dictionaries and out-of-range pacing fail startup/configuration. Dictionary expansions must fit each adapter's input limit. The public API does not accept arbitrary per-request dictionaries. Model capability interfaces remain the same.

## Demo candidate

New draft: `artifacts/feedback/voice-natural-v1/rally-three-minute-narrated-draft.mp4`. Original draft is preserved. The seven revised narration chapters fit their actual time allocations without acceleration. The renderer now fails an overlong chapter so the script must be shortened instead of rushed. Captions follow measured sentence positions and use original spellings; word positions within a sentence remain estimates, not forced alignment.

Same-text local listening samples: `voice-natural-v1/before.wav` and `after.wav`. The before sample uses the previous worker; the after sample uses the same pinned MMS model with the new pipeline. It changes from11.936seconds to13.552375seconds, including four measured300ms sentence pauses. This is a timing measurement, not a listening preference result. A separate `hosted-after.wav` uses the real production Seamless adapter with authored synthetic text. It is not a paired before/after comparison.

The final video remains a synthetic walkthrough. It reuses the previously attributed Seamless sample in its original short voice slot; the new7.58-second hosted sample does not fit that slot and was not silently truncated. No footage, voice clone, external message, upload or final submission was produced by this change.

## Hosted meeting speech boundary

The deployed production voice is SeamlessM4T, not local MMS. Its text preparation now shares the pronunciation rules. Its existing single-request sentence-streaming protocol and cancellation/accounting remain intact. The current endpoint does not expose verified voice-selection, speaking-rate, pause or SSML controls in the client contract. We did not invent those options or fan each reply into multiple charged provider calls. Its acoustic sentence timing still belongs to the hosted model/service; further changes require that service's implementation or a separately evaluated eligible Meta voice. Local MMS sentence timing is under our control now.

## Validation and costs

[Measurements and artifact provenance](research/voice-quality-2026-11-01.json). Tests cover technical terms, confirmed spelling overrides, untouched conditions/names/dates/URLs, worker pacing, sentence boundaries, cancellation and adapter request contracts. The actual local sample verifies zero-valued300ms gaps. Both the seven-chapter narration and the180-second output were generated with pinned local MMS and no new Muse call. New hosted sample: one uncached request, first PCM1.539seconds, total3.340seconds, generated7.58seconds. AWS infrastructure cost remains unknown; no automatic retry or meeting join.

The initial broad suite had one pre-existing wall-clock-sensitive MFA replay assertion: it generated a fresh code after crossing a30-second step and expected rejection as replay. The test now pins Date within the same step; production authentication is unchanged. Final test/deployment evidence is recorded in the handoff.

Subjective acceptance is pending: listen to the same-text samples and the new narration at ordinary volume, then identify any remaining words or phrases by timestamp. Check names, voiced versus unvoiced consonants, sentence-end contours and whether300ms pauses feel appropriate. Remote call audibility/echo and the Monday human rehearsal remain separate acceptance tests. Meta's [MMS model card](https://huggingface.co/facebook/mms-tts-eng) documents stochastic duration prediction; [VITS documentation](https://huggingface.co/docs/transformers/model_doc/vits) describes its inference controls. These do not guarantee a listener's preferred voice.

## Follow-up: local pronunciation reference

The user accepted sentence flow but reported Meta/evidence pronunciation errors. [Reference-aware speech preparation](pronunciation-reference.md) now loads a pinned local CMU dictionary, references ordinary words, applies model-specific corrective spellings for known terms and keeps ambiguous/unknown names unchanged. The new candidate is under `artifacts/feedback/voice-lexicon-v2/`; listener acceptance remains pending. This supersedes the acronym-only pronunciation preparation described above.
