# Rally — one-week demo roadmap

**Current speech requirement:** The organizer FAQ supplied on October 29 permits self-hosted Meta MMS and excludes third-party TTS models. Earlier browser/OpenAI speech proposals below are historical research, not the competition implementation. See [current model eligibility and execution evidence](research/submission-requirements-meta-audit-2026-10-29.md).

Scope agreed through four interview rounds on October 28, 2026. See [decision log](planning-interview.md), [brainstorm](brainstorm-notes.md), and [event guide](hackathon-participant-guide.md).

## Goal

Competition track: **Indie Developer**. Day 1 performance gate: [latency spike](latency-test-plan.md). Demonstration plan: [walkthrough](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/demo-walkthrough.md). Service-stage measurements are available in the linked reports; actual audible response latency remains unverified.

First-build update: [Rally v0.1 is privately deployed](https://rally-meeting-moderator.excavator3496.chatgpt.site). [Build report](build-progress.md) records implemented paths, 16 passing core/API/lifecycle tests, rendered browser checks, real app Muse integration and remaining physical-device limits. Service-stage latency has been measured; actual audible latency remains unverified. Move from research to three-person rehearsal/device validation before adding Teams or optional models.

Rally is an active meeting moderator for small software/product teams: it keeps an agenda moving, prompts for decisions, confirms owners and deadlines, and leaves an evidence-linked record of what was agreed.

Build with Codex; use Muse APIs for runtime intelligence. Browser microphone on laptop or phone is the baseline. Research Rally joining Microsoft Teams as a participant first; promote that integration only if real audio access and operational requirements fit the week.

## Schedule and capacity

One developer with Codex, with high availability. Seven build days: **October 28–November 3, 2026**. **November 4 is submission buffer**, ahead of the supplied 9 PM EST deadline. High availability does not remove external approval or integration delays.

| Day | Focus | Reviewable exit condition |
| --- | --- | --- |
| 1 — Oct 28 | Research, model access checks, technical choices, thin audio loop | Document exact model endpoints and actual test results when credentials are available. Capture microphone audio, obtain transcript, produce one short moderator response, and play speech. Record blockers explicitly. Make Teams go/no-go decision or hold it outside baseline. |
| 2 — Oct 29 | End-to-end browser meeting | Setup → consent → start → live transcript → brief opening/intervention → stop → saved record works with real services. Credentials remain server-side. |
| 3 — Oct 30 | Moderation and meeting state | Agenda checkpoints, sustained-drift prompts, clarification, cooldown, five-minute wrap-up, and host controls work. Pause/override takes effect before further moderator speech. Rally does not process its own speech as a participant commitment. |
| 4 — Oct 31 | Confirmed outcomes | Proposed versus confirmed decisions/actions are distinct. Owners/dates require confirmation, unknowns remain unresolved, transcript evidence is navigable, and host corrections persist. |
| 5 — Nov 1 | Demo usability and records | Phone/laptop layout, saved history, deletion, export, factual scorecard, errors/recovery, and protected hosted access are reviewable. Any admitted stretch integration works end-to-end today or is removed from demo scope. |
| 6 — Nov 2 | Rehearsal and reliability | Three-person live English meeting demonstrates full lifecycle repeatedly. Exercise audio/API failures, speaker correction, pause/override, and wrap-up. Freeze features; prepare a clearly labeled fallback capture if useful. |
| 7 — Nov 3 | Submission artifacts | Three-minute video, public repo documentation, original-work summary, working product link/access instructions, and submission fields ready. Check links as an outside viewer. |
| Buffer — Nov 4 | Final checks and submission | Fix blockers only; verify team attribution, accessible links, and submitted entry before 9 PM EST. |

Dates are planning targets, not claims that integrations already work. If access is blocked on Day 1, continue interface/state work against explicitly labeled fixtures while keeping the real model path a critical unresolved dependency. Fixtures do not satisfy the live demo acceptance criteria.

## Committed demo scope

- Enter agenda, desired outcomes, participant roster, and duration; edit a short opening.
- Explicit recording consent before capture; a visible recording state.
- Live English transcription and short spoken/visible moderator interventions.
- Agenda/time checkpoints, sustained drift, unclear decisions/commitments, and wrap-up; default 60-second intervention cooldown except direct requests and scheduled wrap-up. Tune drift detection during rehearsal.
- Wrap-up defaults to five minutes before planned end; configurable. Require a smaller setting for meetings of five minutes or less. Disclose compressed time in the short demo.
- Immediate host pause, dismiss, and override.
- Roster and spoken introductions; attribution tested against Muse output, with unknown-speaker fallback and correction. Automatic named-speaker recognition is not required.
- Propose decisions and due-outs; require explicit confirmation of owners/dates/decisions. Preserve unresolved items and source transcript references. Confirmations must correspond to the relevant proposal; ambiguity triggers clarification.
- Saved transcript/outcomes, copy/download, meeting deletion, and factual scorecard. Raw audio discarded after processing by default, subject to verifying provider retention behavior.
- Single shared protected demo workspace; no team-account system.

## Architecture direction — details depend on research

Browser capture/playback and host UI connect to a backend that protects API credentials, maintains authoritative meeting state, calls Muse services, and persists transcript/outcomes. Keep provider calls behind small adapters so verified model identifiers and streaming/batch behavior can be selected without rewriting meeting logic.

Use explicit meeting state and timers for scheduling, cooldown, override, and confirmation. Use the model for interpretation and moderator wording. Store evidence references with extracted outcomes. Avoid treating the model's free-form response as proof of participant agreement.

Product hosting and final UI tooling remain unselected. Verified model settings and the thin real-service audio loop guide the reversible architecture recommendations below.

Overnight refinement: [architecture recommendation](rally-architecture.md) proposes one Python ASGI service, simple same-origin browser interface and SQLite for the shared-workspace demo; [ordered backlog](implementation-backlog.md) gives dependencies and acceptance checks. These are reversible build recommendations, not completed implementation or a deployed stack. Runtime baseline is now verified `muse-voice-transcribe-1.0` ENDPOINTING plus `muse-spark-1.3` minimal. Browser speech remains the next real-device gate.

## Meta integration priorities

| Candidate | Intended role | Admission condition |
| --- | --- | --- |
| Muse transcription | Audio → transcript; evaluate diarization and names from intros | Successful actual call; workable audio format/latency; speaker behavior measured |
| Muse reasoning/Spark | Agenda interpretation, drift judgment, moderation, structured proposed outcomes | Successful call; valid structured output and evidence references |
| Muse speech-capable service, if available | Spoken moderator responses | Verify generation support separately from transcription; intelligible low-latency playback |
| Glimmer / Spark Open | Potential efficient secondary task or useful open-weight runtime | A defined product task, suitable runtime and measured benefit |
| Wonder / SAM 3.1 / Image | Investigate capabilities; possible later multimodal meeting features | Useful user-facing role, documented capability, and small effort after core loop is reliable |
| Muse Code | Not a runtime requirement | Development uses Codex as agreed |

Muse speech generation is not documented in the initial research. The user approved investigating two speech-output paths: browser speech synthesis first, followed by the GPT voice option in [the supplied gpt-live-1.1 discussion](https://community.openai.com/t/gpt-live-1-1-is-rolling-out-with-new-voices-and-better-accents/1406704). Verify exact model/API availability and controlled text-to-audio behavior before selecting the second implementation. Muse retains transcription and reasoning; GPT, if adopted, voices Rally's approved text. Do not silently substitute a different runtime intelligence provider.

The user already has a running Teams environment; provisioning a host meeting environment is unnecessary. The research task is to make Rally join that environment and verify receive/send audio, admission, and path-specific permissions. A meeting invite alone does not establish these untested bot capabilities.

## Research and admission gates

Research artifact: [Rally feasibility](research/rally-feasibility.md) (created by the research task). Verify official sources and distinguish facts, estimates, and unknowns.

Within the first 24 hours:

Measured progress: [clean reference audio](research/public-audio-benchmark.md) finalized speech in subsecond proxy measurements; [connected audio-to-moderation](research/connected-loop-benchmark.md) returned a validated decision 1.3208 seconds after the policy-qualifying speech end in one easy trial. These close basic access/connected-reasoning uncertainty, not the actual audible-interruption or three-person meeting gates. Research deliverables and next blockers are tracked in [overnight results](overnight-results.md).

1. Verify API access and identifiers; test one call per required capability. Assume access for planning, but report actual failures and latency honestly.
2. Test three voices introducing themselves, turn-taking, overlap, and unknown speakers. Distinguish diarization labels from correct name attribution.
3. Test capture during Rally playback and host interruption to prevent echo and false commitments.
4. For Teams, identify join path, audio receive/send, required permissions/admin consent, tenant/account prerequisites, hosting, and SDK/runtime constraints. Compare first-party bot implementation with a meeting-bot service. Research Otter's first-party material as an example, not an assumption about its internal architecture.
5. Admit Teams only if required access is obtainable and a concrete live-audio spike fits a timebox of at most one developer-day, without delaying the browser loop. This is a planning gate, not an estimate of Teams' actual difficulty. Otherwise keep findings for the next phase.

## Later roadmap

| Phase | Features |
| --- | --- |
| Next integration | Teams participant bot if not admitted in week one; calendars and approved follow-up invitations; messaging delivery |
| Meeting preparation | Verbal agenda setup; pre-meeting “could this be an email?” assessment; optional warm-up/cooldown |
| Richer facilitation | Stick-around coordination, breakout rooms, configurable tone, carefully designed interruption/volume coaching and hot-mic prompts |
| Organization product | Accounts/roles, team permissions, trends in meeting outcomes, optional gamification, defensible cost/value estimates |
| Further research | Useful multimodal/visual features, additional meeting platforms, native/PWA delivery improvements; clarify “good idea fairy” before scoping it |

## Acceptance and validation

### Speech comparison experiment

Use identical Muse-authored moderator text for both speech candidates: an opening with participant names, a drift redirect, an owner/deadline clarification, and a wrap-up. Measure time to first audible speech, completion, name pronunciation, exact wording, host cancel, behavior when a human starts talking, and feedback into transcription. Test the selected laptop and phone separately. Distinguish audible room output from an audio stream that a Teams transport can send; browser speech synthesis does not establish the latter. Record actual results and costs only after tests.

The user clarified that an existing GPT voice model is acceptable; the experiment is no longer restricted to GPT-Live-1.1. Evaluate documented `gpt-live-1` and dedicated OpenAI TTS options against the narrow speech-rendering need; account access must still be tested. `gpt-4o-mini-tts` is a possible hackathon experiment but is deprecated with January 6, 2027 shutdown, so record migration cost if adopted. Any voice model must preserve confirmed decisions, names, owners, and deadlines without independently rewriting Rally's meaning. See [updated speech research](research/rally-speech-and-teams.md).

The three-person live demo must show agenda setup, consent, an opening, a relevant autonomous intervention, participant confirmation of a decision and an owned/dated action, a host override, wrap-up, and an evidence-linked saved/exportable record. Use a clearly disclosed compressed clock. Show unknown/missing details honestly.

During implementation, use focused tests for timer/cooldown/override behavior, confirmation transitions, and evidence integrity. Validate real audio/model behavior through live experiments rather than relying on mocks. Test deletion and capture boundaries. Record unverified mobile/browser behavior as a limitation rather than claiming support.

Validate the complete meeting lifecycle, useful Meta runtime integration, bounded moderator authority, reliable host controls and evidence-linked outcomes. Preserve evidence of work created during the hackathon and describe any external components accurately.
