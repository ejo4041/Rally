# Human voice listening feedback — November 2

The user listened to the five offline matched-loudness pairs and supplied these preferences in chat. Identities were resolved from the actual per-page hidden keys on the server, rather than assuming A/B labels stayed fixed.

| Sentence | Preferred clip | Voice |
| --- | --- | --- |
| Meta supports this meeting. | B | Direct-phone Meta FastSpeech2 |
| Follow the agenda. | A | Meta MMS |
| The evidence supports that decision. | A | Direct-phone Meta FastSpeech2 |
| The agenda still includes accessibility. | A | Meta MMS |
| The team agreed to postpone the decision. | B | Direct-phone Meta FastSpeech2 |

The user explicitly reports **postpone was mispronounced in both clips**. No numerical naturalness scores were supplied. Do not infer pronunciation correctness for other words merely from preference.

The candidate was preferred on three pairs and MMS on two; these five preferences from one listener do not establish overall superiority or production acceptance. Both agenda sentences favored MMS. Distinct voices/models also prevent isolating the phoneme frontend as the cause of preference.

Next evaluation: investigate the actual pronunciation/stress and model realization of postpone in both adapters, prepare a small same-text candidate comparison, and obtain listener feedback before choosing a production voice. Preserve canonical wording and original captions. Production remains release6fa6e2f with its existing voice; no synthesis, paid calls or deployment were performed while recording this feedback.

[Structured feedback and actual voice keys](research/phoneme-human-listening-2026-11-02.json) · [Prototype boundaries](phoneme-speech-prototype.md).
