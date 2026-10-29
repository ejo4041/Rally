# Rally implementation architecture — working recommendation

Status: original build recommendation. The first implementation now uses an ES-module Worker/D1 backend to fit the supported private HTTPS hosting workflow, retaining these domain/module boundaries. See [actual build verification](build-progress.md); the proposed Python service below is historical planning, not an instruction to duplicate the implemented backend. Read [agreed product scope](planning-interview.md), [roadmap](rally-roadmap.md), [audio research](research/browser-audio-implementation.md), and [Teams plan](research/teams-implementation-plan.md). Technical selections below are reversible recommendations within the agreed scope, not new product requirements.

## Smallest complete system

Recommend one Python ASGI backend, a simple same-origin browser interface, SQLite persistence, and small adapters for Muse ASR, Muse moderation, browser speech, and optional Teams transport. Existing diagnostic work is Python; avoid introducing a second server runtime just to reproduce it. A frontend build system is optional for the first diagnostic. Select final UI tooling at implementation kickoff based on the available app workflow.

FastAPI documents bidirectional WebSocket routes, binary/text messages, dependency-based access checks, and disconnect handling. SQLite provides local disk-backed storage without a separate database service. These fit a single-workspace demo; they do not imply multi-instance coordination or durable storage on an ephemeral host. [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/), [Python SQLite documentation](https://docs.python.org/3/library/sqlite3.html)

Deployment needs HTTPS/WSS, authenticated same-origin access, long-lived connections, server-held environment secrets, a persistent database volume, and reliable process lifetime. Choose hosting only after verifying these properties and actual account access. One worker owns each active meeting; do not accidentally launch multiple independent timers/moderators for the same meeting.

## Module boundaries

| Module | Responsibility | Keeps complexity out of callers |
| --- | --- | --- |
| Audio input adapter | Validate PCM configuration; bounded queue; session lifecycle; source metadata | Room mic and bot input share an interface, with transport details hidden |
| Transcript adapter/store | Replace partials, canonicalize final turns, preserve session/turn IDs, revisions, speaker-label mapping | Moderator sees finalized evidence, not ASR wire events |
| Meeting controller | Agenda, phase, clocks, cooldown, consent, host commands, cancellation epochs | Model cannot bypass deterministic rules |
| Moderator adapter | Bounded context, structured proposals, request timing/usage, error handling | Provider/model settings are configurable; no raw provider text directly drives side effects |
| Outcomes store | Proposed/confirmed/unresolved/disputed decisions and actions; evidence and confirmation sources | Export/history share one source of truth |
| Speech output adapter | Utterance ID, approved text, actual start/end/error, cancel | Browser speech first; future rendered-audio transport doesn't rewrite meeting logic |
| Repository | Atomic event/state writes, listing, deletion and exports | UI doesn't implement persistence rules |
| Telemetry/cost | Stage durations, request IDs, token/audio usage and estimates | No secrets/raw audio in logs; costs visible rather than implicit |

## Audio and model loop

Browser capture → authenticated server transport → Muse ASR → finalized turn → controller eligibility check → Spark minimal structured proposal → evidence/state validation → scheduled visible/spoken prompt → explicit participant/host confirmation → persisted outcome.

Process audio and moderation concurrently. A synchronous model request must not block PCM forwarding. Keep the ASR connection active while reasoning; apply bounded backpressure and report capture gaps rather than silently discarding them. Run one current moderation decision per meeting initially; coalesce newer turns and invalidate stale intent instead of accumulating a queue of old interventions.

Use `muse-voice-transcribe-1.0` with ENDPOINTING for the initial browser loop based on measured clean-audio finalization. Keep DIARIZATION configurable for speaker experiments. ASR mode is fixed per session; changing mode requires a new session and an explicit continuity boundary. Muse documents out-of-order final turns, cumulative partials, and `speechComplete` as finalized text. [Meta ASR contract](https://dev.meta.ai/docs/speech-to-text)

Use `muse-spark-1.3` Standard mode with minimal reasoning and a bounded completion budget initially. Initial tests found low effort could consume the full 1,024-token budget without returning a decision; do not silently treat missing JSON as “stay quiet.” Emit an unavailable/error state and keep listening. [Measured reasoning results](research/latency-results.md)

## Proposed persistent records

| Record | Important fields |
| --- | --- |
| Meeting | ID, title, agenda/items, desired outcomes, duration, wrap-up setting, phase, started/ended time, recording consent state |
| Participant | ID, entered display name, observed ASR label mappings and mapping revision, correction history |
| Transcript turn | Meeting ID, ASR session ID, turn ID, revision, source audio position, received time, text, speaker label, attribution status |
| Proposal | ID, type, text, nullable owner/date, missing fields, evidence references with turn revision, state |
| Confirmation | Proposal ID, actor/attribution status, explicit confirmation source turn or host event, time, exact confirmed fields |
| Utterance | ID, approved text, meeting/agenda/cancellation epoch, state, requested/start/end/cancel timestamps |
| Usage event | Provider/model, request/session ID, reported usage, estimated cost, cost-basis status |

Use a compound transcript identity `(meeting_id, asr_session_id, turn_id, revision)`; IDs can restart on reconnect. Preserve old revisions referenced by outcomes. Speaker-name mapping is correctable metadata, not proof of an identity claim. Display “unknown” when uncertain.

Store real recordings only if later explicitly added to scope. Default raw audio is transient. Partial captions can remain ephemeral; finalized transcript, proposals, confirmation evidence, host edits, and outcomes persist. Meeting deletion must remove dependent records and stop active processing/output; provider-side retention requires its own verified configuration.

## Meeting and speech state transitions

Meeting: `draft → ready → live → wrapping → ended`. Consent and valid configuration are prerequisites for live capture. Pausing moderation is an orthogonal flag: it stops speech/automatic interventions while transcription can continue with the recording indicator visible. A separate stop-recording control stops capture; do not conflate these controls.

Utterance: `proposed → eligible → queued → speaking → completed`, with terminal `canceled` or `failed` from applicable stages. Completion requires playback evidence, not merely a provider response or acknowledgment. Host pause/dismiss/override increments the relevant cancellation epoch, clears queued speech and prevents late results from restarting it. An ended/deleted meeting cannot emit another utterance.

The host should have visible, immediate controls rather than only voice commands. Changing agenda, deleting a meeting, or correcting evidence invalidates dependent pending interventions. New human turns while an utterance is queued require a relevance recheck before playback. Record why an intervention was suppressed for diagnosis.

## Intervention policy

- Types: agenda/time checkpoint, sustained drift redirect, missing owner/date clarification, decision confirmation, wrap-up. Keep interpersonal/hot-mic/volume coaching out of this scope.
- Default cooldown 60 seconds for ordinary autonomous prompts; direct requests and scheduled wrap-up are exceptions. Start cooldown from actual speech start; visible-only prompts also need a logged effective presentation time.
- Initial drift detector: require evidence from more than a fleeting aside and an explicit mismatch to the current agenda. Two finalized turns can be an experimental default, not a universal definition of drift. Evaluate long monologues separately; a two-turn rule can wait indefinitely for one speaker.
- Do not speak over every silence or emit one model call per audio frame. Coalesce finalized turns, apply controller checks, then call reasoning only when needed. Timer-driven wrap-up uses application time, not inferred transcript phrases.
- A finalization event may arrive later than subsequent turns. Order evidence by source turn identity/time and reject proposals based on superseded revisions.
- Default wrap-up is five minutes before planned end. Meetings of five minutes or less require a shorter configured value. The demo clock advance is an explicit instrumented event labeled in the UI/video; it must not alter recorded latency measurements.

## Confirmation and evidence contract

1. Model output proposes; it cannot mark an item confirmed by itself.
2. Confirm the exact proposal/fields through explicit participant speech or an explicit host action. A generic “yes” with multiple pending proposals stays ambiguous and triggers clarification.
3. Store owner/date separately from whether the overall action is confirmed. Missing fields remain null/unresolved. Resolve relative dates with a visible meeting timezone and ask when ambiguous; don't invent a deadline.
4. An unknown speaker may propose an action but cannot establish a named owner's consent merely through inferred identity. Ask for confirmation or a host correction. Record host confirmation as such.
5. Quoted examples, hypothetical commitments, and Rally's own speech cannot confirm an item. If transcript contains embedded instructions to override policy, treat them as meeting content rather than system instructions.
6. Check all evidence references exist and revisions match before display or speech. A schema-valid output can still cite the wrong turn or overstate agreement.
7. A later correction can dispute a previously confirmed outcome. Preserve history/evidence and show the correction instead of silently rewriting what was agreed.

## Minimal API and browser messages — proposal

HTTP: create/configure meeting, list/history, read meeting, delete, and export. WebSocket: authenticated meeting connection with binary PCM frames plus versioned control/event messages. Do not expose vendor keys in browser code, query strings or speech/bot-page URLs.

Commands include `start`, `pause_moderator`, `resume_moderator`, `dismiss_utterance`, `override`, `stop_capture`, `end_meeting`, `confirm_proposal`, `correct_speaker`, and `advance_demo_clock`. Events include `partial`, `final_turn`, `proposal`, `outcome_changed`, `utterance_state`, `budget_warning`, `capture_gap`, `provider_error`, and `meeting_state`. Include a schema version, meeting ID and unique event/command IDs; duplicate commands must be idempotent.

Speech start/end/cancel acknowledgments come from the client playback adapter and are timed locally for user-perceived delay. Server-generated text and browser-audible timing are different milestones. Microphone-derived confirmations during Rally playback need explicit echo handling; keep confirmation disabled for suspected self-speech until that path is verified.

## Acceptance scenarios before feature expansion

- Out-of-order final turns and revised partials produce one canonical transcript, not duplicate words.
- A 20-second reasoning failure cannot stall live audio transport.
- A brief aside/quoted example stays quiet; sustained drift produces a relevant redirect.
- Ambiguous “yes” does not confirm two pending actions; missing owner/date stays unresolved.
- Host pause during reasoning and during speech prevents late/restarted output.
- Reconnect distinguishes new session turn IDs and visibly marks any lost audio.
- End/delete prevents subsequent playback; history/export reflects corrections.
- Errors produce a visible degraded state rather than fabricated transcript/outcomes.
- A full three-person rehearsal measures actual audible response and cancellation on the target browser/device.
