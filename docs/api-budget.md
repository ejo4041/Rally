# Muse API budget and reporting

User instruction: conserve the $150 hackathon grant across the whole week, including final tests and demos. Whenever Muse API calls are made, report their cost and remaining credits. Never equate an estimated remainder with an actual Billing balance.

## Working limits

- Assume a $150 starting grant only for conditional projections; grant application and any prior/shared usage are unverified until checked in Billing.
- Proposed operating allocation: preserve at least $60 for final testing/rehearsals/demos; no more than $90 before that stage. These are maximums, not spending targets or permission to consume the allocation.
- Normal development target: at most $10/day and substantially less when short tests suffice. Review scope before enlarging a test rather than silently scaling up.
- Current latency reasoning spike: at most $0.15 per run, including output-token caps and conservative input allowance. No automatic retries.
- Run only the smallest experiment that answers the current question. Reuse deterministic fixtures; repeat live tests after meaningful changes or failures, not continuously.
- Use Standard mode for meeting content. Do not switch to discounted Contributor mode without an explicit user decision about training-data sharing.

## Reporting and ledger

- [Cost ledger](research/muse-cost-ledger.md) records each call/session estimate and cumulative tracked usage. [Sanitized usage log](research/muse-call-log.jsonl) retains response usage and request/session IDs.
- Text cost = uncached input × input rate + cached input × cached rate + completion tokens × output rate. Completion tokens already include reasoning tokens; do not double-count them.
- Voice Transcribe is charged by processed whole seconds. If only sent duration is available, identify that as an estimate rather than metered usage.
- Errors, timeouts, and missing usage can leave cost unknown. Include this uncertainty rather than claiming failed calls cost nothing.
- After each batch report: purpose/sample count, batch estimate, tracked cumulative estimate, conditional $150 remainder, and any unknown costs.
- Check Billing to reconcile grant and spending before final rehearsals. No account Billing integration is configured yet. Rates are verified from [official pricing](https://dev.meta.ai/docs/pricing-rate-limits); actual charges can differ from these estimates.

## Keep runtime costs bounded during implementation

Only call the moderator on relevant finalized turns or explicit requests, apply cooldown and bounded context, keep speech concise, enforce finite sessions/timeouts, and leave optional Wonder audits out of the live loop. Local fixtures do not replace actual integration validation, but they can cover deterministic application behavior without paid model calls.
