# Live assessment prompt caching — October 30

Meta documents automatic longest-prefix caching for Muse Spark and optional stable routing keys: [official cookbook](https://dev.meta.ai/docs/cookbook/prompt-caching). Stable instructions/reference content should precede volatile content. Retain default in-memory retention and Standard mode.

## Evidence and implementation

The 29 live assessments from the consented presence rehearsal reported 128,641 prompt tokens and 9,013 cached tokens (7.01%). This is a measured baseline, not a forecast for the changed layout. Existing accounting already prices reported cached tokens at the configured cached-input rate; unknown usage remains unknown.

The adapter now sends stable system instructions, then a small meeting reference (objective, original goals without changing statuses, current plan, original deadline), then the complete authoritative live snapshot. Within that snapshot, bounded finals and partials precede changing state. The reference deliberately repeats a small amount of snapshot metadata to preserve the existing complete snapshot contract without moving clocks out of its nested meeting object. No evidence, correction, state or timing field is removed. Plan changes replace the reference on the next request. The operation-version routing key is shared across meetings; it contains no meeting content or credentials.

Rolling transcript eviction and early corrections necessarily break the transcript prefix. Do not expand to the entire hour merely to increase cache percentage: recurring cached tokens still cost money, cold requests grow, and reasoning latency/scope changes. Keep full canonical transcript for reports and bounded live context plus persistent state for checks. No model-result cache is used: each check still evaluates current evidence and state.

## Validation and remaining work

Provider boundary test verifies stable reference across changing timing/state and lossless complete snapshot serialization, with transcript first. Ten provider tests and backend typecheck pass; populated plan, transcript append and correction cases preserve the authoritative payload. The adapter change is not deployed yet. A subsequent three-call synthetic measurement cost $0.01526095, with all outputs valid in 1.708–2.559 seconds. First two requests reported zero cached tokens; the third reused 3,313/4,002 input tokens (82.78%). [Usage and decisions](living-presence-cache-benchmark.json). This establishes actual cache reuse but does not guarantee a steady-state production hit rate. Next consented run should continue comparing cached/prompt ratio, actual cost, latency and truncation against the baseline. Budget reservations remain conservative and assume no cache discount.

User approved $6 per meeting and $20 total application caps. Protected deployment configuration now contains these values; the running API keeps its old limits until a safe restart after active meetings end. These caps are not provider billing limits or an hour-long completion guarantee. The actual grant balance remains unverified.

Camera framing, output-cap increase, long-partial correction and hour-meeting validation are tracked in [implementation](../living-presence-implementation.md); this record does not mark that broader work complete.

Forecast and admission now share the exact request serializer, including the reference message. Final-report reserve grows with the complete current stored transcript and report request, at uncached rates with the configured floor. This protects currently known report input, not future unseen conversation. Three budget boundary tests verify long input, cadence, revisions, floor and rejection before any paid request.

Accelerated engine tests cover30/60minutes,360/720finalturns,corrections,partialhistory,agenda transitions,ASRrotation,stale-source rejection,speech offers and complete report input. They do not establish an elapsed-hour media soak or real-model quality over an hour.
