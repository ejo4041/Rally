# Muse realtime speaker metadata contract

Research date: October 30, 2026. Scope: read-only inspection of public primary documentation, official example source, the current `TranscriptDecoder`, and existing sanitized evidence. No inference requests, credentials, audio access, service changes, or code edits. 

## Source access and authority

The following Meta pages were opened as full pages, not accepted from search snippets. Public unauthenticated HTTP GETs also returned HTTP 200 with the relevant schema/guide text. Their HTML includes an identity-confirmation dialog, but the cited content itself was accessible. No login was attempted. Content behind any further authentication, and unpublished server implementation details, remain **unknown**.

- [Voice schemas](https://dev.meta.ai/docs/api-reference/voice/schemas): normative field and event descriptions.
- [Speech-to-text guide](https://dev.meta.ai/docs/speech-to-text): behavior and illustrative wire sequences.
- [Official voice cookbook](https://dev.meta.ai/docs/cookbook/voice-api-fundamentals#attribute-speech-to-speakers-with-diarization): explicit lifecycle description.
- [Realtime endpoint reference](https://dev.meta.ai/docs/api-reference/voice/realtime#client-frames): transport completion.
- [Official Python example, lines 182–195](https://github.com/meta-models/meta-model-cookbook/blob/71410bb1f214e9b197b75809dde4de7453dcecde/06_muse_voice/01_voice_api_fundamentals/transcribe_stream.py#L182-L195), linked through Meta's cookbook: corroborating client example, **not** server/SDK implementation proof. The public GitHub commits API identified this file revision; its corresponding `main` source was read without executing it.

## Documented contract and its limits

| Question | Established by accessible primary text |
| --- | --- |
| Anonymous voice or display name? | `label` is model-generated, session-local, and unverified. Treat it as an anonymous diarization identifier, not a participant display name or a cross-session identity. [Speaker schema](https://dev.meta.ai/docs/api-reference/voice/schemas#speaker-event). |
| What does `speaker.audioProcessedMs` locate? | Audio processed at label emission, measured from stream start; not an exact acoustic boundary. The label retrospectively covers the span since the previous `speechStart` or `speaker`, whichever was later. It does not announce a speaker change. [Speaker schema](https://dev.meta.ai/docs/api-reference/voice/schemas#speaker-event). |
| Ordering before `speechComplete`? | The cookbook documents `speechStart` → partials → `speaker` → `speechEnd` → `speechComplete` for a turn. Completion is asynchronous; correlate lifecycle events using `turnId`. This supports normal same-turn precedence, not globally serialized turns or arbitrary late correction events. [Cookbook lifecycle](https://dev.meta.ai/docs/cookbook/voice-api-fundamentals#attribute-speech-to-speakers-with-diarization). |
| What does ordered stream mean? | Events share one ordered stream. That alone does not establish timestamp sorting or a metadata-revision protocol. [Server message schema](https://dev.meta.ai/docs/api-reference/voice/schemas#server-message). |
| End boundary and inclusivity? | `speechEnd` marks detected speech end; `speechComplete` supplies finalized text. Both timestamps describe processing positions, not precise acoustic edges. No inclusive/exclusive sample-boundary rule was found. [End schema](https://dev.meta.ai/docs/api-reference/voice/schemas#speech-end-event), [completion schema](https://dev.meta.ai/docs/api-reference/voice/schemas#speech-complete-event). |

The guide explicitly allows a new turn to start before an earlier completion and assigns partials to the latest `speechStart`. Its diarization prose claims exactly one speaker event per turn, yet its immediately preceding example has two `A` events under the same `turnId`. Event-count guarantees are therefore **internally inconsistent**, not established by that example. [Guide: endpointing and diarization](https://dev.meta.ai/docs/speech-to-text#label-speakers-with-diarization).

The cookbook limits diarization coverage to non-overlapping speech. This is distinct from interleaved lifecycle completion. No reliable simultaneous-speaker separation guarantee follows. The official example comments corroborate retrospective labels and asynchronous completion, but provide no timestamp interval-join algorithm. [Cookbook](https://dev.meta.ai/docs/cookbook/voice-api-fundamentals#attribute-speech-to-speakers-with-diarization), [example source](https://github.com/meta-models/meta-model-cookbook/blob/71410bb1f214e9b197b75809dde4de7453dcecde/06_muse_voice/01_voice_api_fundamentals/transcribe_stream.py#L182-L195).

Remaining unknowns: strict timestamp monotonicity, equal-timestamp tie handling, exact acoustic offset/latency, post-completion corrections, and the contradictory speaker-event count. Do not invent these rules. Session drain is explicitly documented: send `endStream`, continue reading, and consume pending results until normal server close. [Realtime reference](https://dev.meta.ai/docs/api-reference/voice/realtime#client-frames).

## Existing observations, not guarantees

- [Backend streaming selection](backend-streaming.md) describes the transport/adapter choice and preservation of source timestamps and separate speaker events. It supplies no raw real-provider event-order trace establishing the joins below. “Source timestamps” should not be read as exact acoustic times.
- [Backend AI examples: audio reality check](../backend-ai-examples.md#audio-path-reality-check) reports six finalized turns and one synthetic voice splitting into two diarization labels. This is evidence against treating observed labels as a reliable one-to-one person mapping. It is not a test of participant-name recognition or the full event contract.
- [AMI diagnostic](ami-benchmark.md#observed-results) reports 9 ENDPOINTING and 11 DIARIZATION finals, all before `endStream`. Its collector excluded standalone diarization events from scoring. Those results establish neither speaker association nor speaker-event ordering. Reference annotation overlap does not validate provider overlap handling.

No private audio, corpus words, human-meeting quotations, or raw transcript payloads were needed or copied. These three records do not establish late labels, corrected boundaries, or endpoint inclusivity.

## Decoder comparison and concrete follow-up

Baseline: [decoder at `61d6824`](https://github.com/ejo4041/Rally/blob/61d6824/apps/rally-api/src/muse.ts#L315). The comparison below records that implementation; the correction is described afterward.

| Current behavior | Assessment |
| --- | --- |
| Map keyed by `turnId`; output includes `sessionId`; zero/multiple retained labels produce `null` (`322–354`). | Appropriate identity scope and conservative handling of retained conflicts. A single retained label is still not a verified name. |
| Associate `speaker` with exactly one turn containing its processing time, using `start <= time <= end`; unset end is unbounded (`371–383`). | **Concrete semantic mismatch:** this is a numeric interval join, whereas the documented label relation is to the preceding event span. Equality and processing delay cannot establish exclusive turn membership. Track preceding spans in event order; if a whole-turn association remains ambiguous, keep it unknown. Do not simply change `<=` to `<`: that would invent an endpoint convention. |
| Discard a label when zero or multiple turns qualify, without recording uncertainty (`377–383`). | **Concrete safety gap by code inspection:** an already retained `A` survives a later discarded conflicting/ambiguous label. `publish` can still emit `A` for the entire turn because it sees only stored labels. Preserve an ambiguity/coverage state for affected turns, so discarded evidence cannot silently become confident attribution. This is a static failure mode, not an observed provider trace. |
| On completion, use its processing time as missing `end` (`395–400`). | **Timing conflation:** completion position is not the detected speech-end position. Keep a missing end unknown, or represent this explicitly as a processing-time fallback; never use it as proven acoustic coverage for speaker matching. |
| Emit/revise finals whenever text exists; deduplicate identical payloads (`330–354`, `382`, `401`). | Useful application behavior. Acceptance of late labels or timing corrections does not establish that Meta emits them, or that a backdated label belongs to a historic turn. |

The existing [late-metadata test](../../apps/rally-api/tests/providers.test.ts#L142) injects labels after completion with smaller timestamps and then corrects `speechEnd`. It tests local revision behavior only. Neither that fixture nor its passing assertions establish a provider guarantee. No tests were executed or modified for this research.

Recommended policy for a future code fix: use documented event-span semantics and session-scoped IDs; keep participant-name mapping separately confirmed. Preserve `speaker: null` for unresolved overlap, conflicting spans, insufficient coverage, or uncertain turn association. An unambiguous span alone must not establish an entire finalized turn's speaker when other spans remain ambiguous. Continue accepting finalized text even when attribution/timing remains unknown. This policy is an application recommendation, not an additional Meta guarantee.


## Implemented correction

The adapter now tracks preceding transcript spans in event order, keeps uncertain coverage/overlap unknown, retains missing detected ends as null, and emits an explicit normalized source order independent of opaque signed IDs. Late or conflicting metadata cannot silently retain or invent a confident whole-turn identity. Canonical storage uses that source order; older records retain explicit fallback limitations. These behaviors are verified through offline packets and local adapter/storage tests, not a new real-provider or human-speaker benchmark. See [current speaker attribution](../speaker-attribution.md).
