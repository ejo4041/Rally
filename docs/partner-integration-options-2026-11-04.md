# Useful partner integration options — November 4, 2026

Recommendation discussion only; no partner deployment, credential changes or billable calls performed. The supplied event guide offers conditional partner credits; actual credit availability and account/model access require verification. Effort below is an engineering estimate, not a delivery guarantee.

## Best practical fit: Modal-hosted Meta speech

Move the existing pinned Meta MMS inference worker behind an authenticated Modal HTTP endpoint and adapt its PCM/WAV output to Rally's shared speech lifecycle. This addresses the observed hosted speech service's operating-hours restriction while retaining Meta voice inference. Use MMS first rather than promoting the mixed-quality experimental FastSpeech2 voice. Hosting does not itself improve pronunciation. Verify cold start, latency, cancellation, audio format and resource limits. Budget/account setup and a real authenticated probe are necessary before claiming availability; warm containers have costs and scaled-to-zero workers can cold start. Estimate a 2–4 hour initial integration after account access, with live Teams acceptance separate.

Primary sources: [Modal web functions](https://modal.com/docs/guide/webhooks), [model weight storage](https://modal.com/docs/guide/model-weights), existing local backend `experiments/meta-mms/`. Model licensing remains unchanged by hosting.

## Smallest new user feature: structured follow-up drafts

Use a Meta model through Fireworks or Baseten to turn host-selected report actions and their cited evidence into a concise follow-up draft. The host reviews/copies it; no messages sent automatically. Preserve unresolved owners/dates and validate evidence IDs. This is an extension of existing follow-up drafting, not a claim that drafting is absent today. Keep Muse transcription and existing live moderation. Estimate 1–2 hours for a small adapter/UI experiment after access, plus actual-provider/schema/uncertainty verification. Ledger integration and configured rates are needed for a production path.

[Fireworks structured output](https://docs.fireworks.ai/structured-responses/structured-response-formatting) supports schema-constrained responses; verify that the chosen Meta model is available to the account and supports the required schema. [Baseten Model APIs](https://docs.baseten.co/inference/model-apis/overview) offers hosted inference; the supplied hackathon guide specifically names `meta-models/muse-spark-open-1026` for Baseten. That identifier and access are supplied event information, not a successful call from Rally. Do not assume a matching Fireworks model ID or that every API parameter transfers unchanged.

## Choice

Prefer Modal if the current priority is reliable speech outside the existing provider's hours. Prefer a single Fireworks/Baseten follow-up draft if the priority is the smallest useful partner-powered addition. Choose whichever account already has approved access/credits; do not integrate all three merely for attribution. A partner integration should be credited only after a real tested feature uses it. Suggested partner feedback must reflect actual use.
