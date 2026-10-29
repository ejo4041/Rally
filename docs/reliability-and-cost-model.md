# Rally reliability and cost model

Implementation recommendations, not implemented controls. Use [architecture](rally-architecture.md), [API budget](api-budget.md), and [browser implementation notes](research/browser-audio-implementation.md). Costs below are forecasts unless explicitly linked to a measured result.

## Runtime failure behavior

| Failure | Immediate behavior | Recovery and acceptance |
| --- | --- | --- |
| Microphone denied, absent or revoked | Visible capture error; no misleading recording state | User can retry/select device; prior history remains readable |
| Capture backlog/network stalls | Bound buffered audio; stop or mark a gap instead of streaming arbitrarily old input | New session boundary and visible loss interval; avoid hidden unbounded latency |
| ASR drops/reconnects | Keep UI truthful; cancel interventions dependent on uncertain audio | Fresh session ID, deduplicated finals, explicit gap if input lost. No undocumented resume promise |
| ASR mode unsuitable | Preserve unknown-speaker fallback | Mode change is explicit new session, not an invisible live switch |
| Spark timeout, budget exhaustion or malformed/evidence-invalid JSON | No speech or confirmed actions from that response; show degraded reasoning | Keep audio flowing; one bounded later attempt only if useful. Do not loop/retry indefinitely |
| Rate-limit/access error | Surface status without revealing key; pause paid reasoning | Honor documented retry constraints only within remaining budget; failed cost can be unknown |
| Old result arrives after agenda change, host pause or end | Reject by generation/state version | No stale speech, queued restart, or historical commitment |
| TTS voice unavailable, start/error or cancel mismatch | Text prompt remains visible; show speech failure | Pick a known tested voice/device; don't claim audible completion from queue acceptance |
| Self-voice/overlapping audio | Guard evidence/confirmation; retain unknowns | Test actual audio routing. Echo cancellation is assistance, not proof of self-speech exclusion |
| Host closes/reloads page | Stop capture connection and pending speech; keep persisted finals/outcomes | Recovery must not auto-start recording without clear state/consent |
| Storage/deletion failure | Show save/delete state accurately | Transactional persistence; no success claim before operation completes |
| Teams bot stuck in lobby or after meeting | Finite join/idle/meeting limit, explicit leave | Verify provider lifecycle/usage and no orphan sessions. Teams remains optional |

Meta live ASR runs a maximum of 60 minutes, requires real-time-paced PCM, can finish turns out of order, and has no session-resume token. Design a reconnect boundary before limits rather than assuming infinite sessions. [Meta speech-to-text documentation](https://dev.meta.ai/docs/speech-to-text)

## Measurement and logs

Keep request/session IDs, turn/revision IDs, monotonic local durations, capture gaps, intervention eligibility/suppression reason, actual playback events, cost usage and errors. Keep keys, raw audio, browser access tokens and private meeting content out of generic logs. Persist intentionally retained transcript/outcomes in their own access-controlled store, with deletion rules.

Capture both service-stage and perceived latency. Use client timestamps for actual audio/host controls; don't subtract unsynchronized server/browser clocks. Report input duration, deliberate policy wait, request completion/validation, audible start and cancellation separately. Average latency cannot conceal missed/failed interventions.

## Per-meeting forecast

Published Standard prices checked October 28: Spark uncached input $1.25/M, cached input $0.15/M, output $4.25/M; Voice Transcribe $0.18/hour. [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits)

For `N` moderation calls with average uncached input `I`, cached input `C`, completion output `O` tokens and `H` audio hours:

`Muse estimate = H × 0.18 + N × (I × 1.25 + C × 0.15 + O × 4.25) / 1,000,000`

Here `I` excludes `C`; reasoning tokens are part of `O`. Real token usage must be recorded rather than inferred from transcript word count. No web-grounding tools are required for this meeting loop.

| Illustrative 30-minute scenario | Assumptions | Forecast Muse cost |
| --- | --- | --- |
| Bounded live context | 60 calls, each 1,000 uncached input + 200 completion tokens; no cache assumed | $0.216 |
| Larger context | 60 calls, each 3,000 uncached input + 300 completion tokens; no cache assumed | $0.3915 |
| High-frequency/context caution | 300 calls, each 5,000 uncached input + 500 completion tokens; no cache assumed | $2.6025 |

These are synthetic budgets, not measured product costs or a promise that the call frequency is appropriate. They include $0.09 ASR for half an hour and exclude optional audit, bot transport, OpenAI voice and hosting. A growing full-transcript prompt on every turn can inflate cost; bounded context/state is important.

One optional Wonder audit with 5,000 input and 1,000 output tokens forecasts $0.04 at $4/M input and $20/M output. Admit only when it adds useful evidence checking, not model count. [Optional-model research](research/meta-integration-options.md)

Teams transport is billed separately from Meta credits. The documented Recall forecast is $0.25 per half-hour at Standard $0.50/hour, or $0.30 at $0.60/hour four-core, before free-hour eligibility and other services. Lobby/active time can extend beyond meeting audio duration. [Teams cost/source details](research/teams-implementation-plan.md)

## Operational caps to implement

- Preflight experiment estimate and per-run bound; track actual usage after each call. Unknown billing is a blocker for more paid tests until understood.
- Meeting duration/session deadline, input-buffer bound, one active moderation request and one current utterance, finite output-token cap, optional-audit count cap.
- No automatic repeat model calls on unchanged transcript or caption partials. Coalesce useful finalized turns; separate timer events from semantic analysis.
- Throttle ordinary interventions with the agreed cooldown, without dropping critical host-control events.
- Preserve the planned final-testing reserve; daily targets are maximums, not targets to spend toward. Reconcile actual grant/Billing before submission rehearsals.

## Definition of reliable enough for demo

One three-person meeting lifecycle repeatedly succeeds on the recording setup, with measured audible intervention timing, explicit confirmation/evidence, immediate host controls, no hidden stale speech, and clean stop/delete behavior. When an optional integration fails, the browser path remains functional and the limitation is disclosed. Unsupported claims about production privacy, identity accuracy or general meeting quality are excluded.
