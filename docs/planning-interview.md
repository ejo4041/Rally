# Planning interview — Muse meeting moderator

**Current speech requirement:** The organizer FAQ supplied on October 29 permits self-hosted Meta MMS and excludes third-party TTS models. Earlier browser/OpenAI speech proposals below are historical research, not the competition implementation. See [current model eligibility and execution evidence](research/submission-requirements-meta-audit-2026-10-29.md).

## Status

Rounds 1–4 answered and scope agreed. User answered “yes to all” Round 4 proposals. One-week roadmap: [rally-roadmap.md](rally-roadmap.md). Feasibility research kicked off; application implementation has not started.

## Confirmed instructions

- Source ideas: [brainstorm-notes.md](brainstorm-notes.md).
- Event constraints: [hackathon-participant-guide.md](hackathon-participant-guide.md).
- Optimize for a working demo within one week; defer involved work.
- Use as much Meta tooling as is practical; model capabilities and availability require research rather than assumptions.
- Record interview answers and scope decisions here after each round.

## Design tree

1. Primary user and meeting → pain point → signature moderator behavior → measurable demo outcome.
2. First demo environment → audio capture and playback → speaker identity → interruption and override controls → fallback.
3. Team capacity → one-week workload → milestones and feature cuts.
4. Available access and resources → feasibility research → model roles and integration selection.
5. Settled product behavior → transcript and due-out evidence → data handling and participant notice → follow-through actions.
6. Agreed scope and feasibility → one-week roadmap → research kickoff → implementation handoff.

## Round 1 — open questions

1. Primary audience: start with a small software/product team running a decision-making project meeting? If different, identify the real meeting and its recurring failure.
2. Demo environment: start with a browser app using the room microphone, usable on a laptop or a phone on the table, and assess meeting-platform bots/integrations later?
3. Capacity: plan for one primary developer with agent assistance for the next week, or specify builders, availability, and useful expertise?
4. Access: should research assume Meta API access and credits are not yet verified? Identify already-working model access and any existing calendar/meeting-platform developer accounts, without sharing secrets.

### Round 1 answers and decisions

- **Name:** Rally (user's name for the product).
- **Audience:** Small software/product teams running project meetings that run long and lack clear decisions or owners.
- **Primary surface:** Browser app with room microphone, usable on laptop or phone placed on the table.
- **Meeting participant path:** Also research inviting Rally as another meeting participant. The user cites Otter.ai as an example to investigate; this is a research requirement, not yet a committed integration or established technical approach.
- **Capacity:** One developer working from this Codex session, potentially around the clock with frequent prompting. Calendar availability is high; roadmap estimates must still account for integration/debugging time.
- **Development versus runtime:** Build with Codex; run Rally with Muse APIs as its backend. Muse Code is not a required development-tool integration.
- **Access:** No models have been called yet. Assume Muse APIs work for planning, as requested; validate with real calls before relying on them for the demo. Availability and capabilities remain unverified facts.

## Round 2 — open questions

1. Signature demo: agree to an agenda-driven decision meeting where Rally notices drift, prompts for a decision, obtains an owner and due date, and produces evidence-linked due-outs?
2. Moderator authority: agree to brief spoken interventions plus visible prompts, with host pause/override, rather than host approval before every intervention?
3. Bot research boundary: investigate Zoom as the first participant-join candidate, while retaining browser capture as the committed demo path until feasibility is established?
4. Data handling: agree to visible recording notice and affirmative participant consent for demo sessions, retaining transcript and outcomes but not raw audio by default?

### Round 2 answers and decisions

- **Signature demo:** Agenda-driven decision meeting. Rally notices drift, prompts for a decision, obtains an owner and due date, and produces due-outs linked to transcript evidence.
- **Authority:** Automatic brief spoken interventions and visible prompts, with immediate host pause, dismiss, and override. Define triggers and limits in the next round.
- **Participant integration research:** Microsoft Teams first, overriding the proposed Zoom-first research. Browser capture remains the demo baseline until bot feasibility is established.
- **Recording and retention:** Explicit participant consent for demo sessions. Retain transcripts and outcomes; discard raw audio after processing by default.

## Round 3 — open questions

1. Intervention policy: prioritize agenda/time checkpoints, sustained topic drift, unclear decisions or commitments, and a final wrap-up; use a default 60-second cooldown except direct requests and scheduled wrap-up, and defer interpersonal coaching?
2. Confirmation: treat extracted decisions and due-outs as proposals until participants explicitly confirm; preserve missing owners or dates as unresolved rather than inventing them?
3. Speaker identity: begin with a manually entered roster and spoken introductions; allow host correction and show unknown speaker when attribution is uncertain, without making automatic speaker recognition a demo requirement?
4. Follow-through: provide an in-app record and copy/download of decisions, owned due-outs, deadlines, unresolved items, and transcript evidence; defer automatic invitations, messages, and breakout rooms?
5. Demo shape: demonstrate a real live English-language meeting with three participants, using a short agenda and a configurable compressed clock to show wrap-up inside a three-minute submission video?

### Round 3 answers and decisions

- **Interventions:** Agenda/time checkpoints, sustained topic drift, unclear decisions or commitments, and wrap-up. Default 60-second cooldown except direct requests and scheduled wrap-up. Defer interpersonal coaching, hot-mic detection, and volume feedback.
- **Wrap-up:** Default trigger is five minutes before the planned end. Demo uses a disclosed compressed clock; the production default remains five minutes. Short-meeting behavior still needs definition.
- **Confirmation:** Proposed decisions, owners, and deadlines require explicit participant confirmation. Missing owners/dates stay unresolved; Rally asks rather than inventing them.
- **Speaker identity:** Enter roster and use spoken introductions; host corrections and unknown-speaker fallback are accepted. Test whether Muse transcription can attribute speakers from introductions. This capability is a hypothesis, not verified behavior.
- **Outputs:** In-app record plus copy/download of decisions, due-outs, owners, deadlines, unresolved items, and transcript evidence. Defer calendar invitations, outbound messages, and breakout rooms.
- **Demo:** Live English-language meeting, three participants, short agenda, and a clearly disclosed compressed clock for the three-minute submission video.

## Round 4 — open questions

1. Setup and short meetings: start with typed/pasted agenda, desired outcomes, roster, and duration; offer a brief editable opening; allow wrap-up timing override and require a smaller value when duration is five minutes or less; defer verbal setup and pre-meeting email screening?
2. Meta breadth: prioritize verified Muse transcription, reasoning/moderation, and speech output for the core loop; add other Muse/Meta models only for distinct useful capabilities that pass quick feasibility checks; keep required SAM/image/video usage out of scope unless research finds a compelling low-effort role?
3. Meeting quality: include a factual end-of-meeting scorecard (decisions confirmed, actions with owners/dates, unresolved items, elapsed versus planned time); defer dollar-value estimates, individual grading, gamification, and longitudinal analytics?
4. History and access: use one shared demo workspace with persisted meeting history, skip team accounts and roles for week one, and provide a way to delete a meeting and its stored transcript/outcomes?

### Round 4 answers and decisions

All proposals accepted:

- Typed/pasted agenda, desired outcomes, roster, and duration; brief editable opening. Adjustable wrap-up, with a smaller setting required for meetings of five minutes or less. Defer verbal setup and pre-meeting email screening.
- Prioritize transcription, reasoning/moderation, and speech output. Explore broader Meta model use through quick feasibility checks; no required SAM/image/video integration without a useful low-effort role.
- Factual scorecard: confirmed decisions, actions with owners/dates, unresolved items, elapsed versus planned time. Defer monetary valuation, individual grading, gamification, and longitudinal analytics.
- One shared demo workspace with persisted meeting history and deletion of meeting transcript/outcomes. Defer team accounts/roles; establish access protection before hosting real meeting data.

Concrete model assignments and feasibility are research outputs, not assumed capabilities. These answers close the product-scope interview; research may surface technical decisions that require a focused follow-up.

## Research kickoff and technical follow-up

### Latest priorities

- User authorized independent overnight research and small experiments without further input. [Review list](overnight-plan.md) defines scope and a $0.50 additional Muse test ceiling; [results](overnight-results.md) tracks completed artifacts and blockers. No persistent overnight scheduler is configured.

- Confirmed competition track: **Indie Developer**.
- Prove that transcription → reasoning → audible intervention can keep pace with a meeting through brief real-service tests before broadening the build. Minute-scale response time is unacceptable to the user. Targets and timing definitions are in [latency test plan](latency-test-plan.md); actual measurements are still pending credentials.
- Plan the three-minute video around the working meeting lifecycle and documented validation. See [demonstration walkthrough](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/demo-walkthrough.md).
- Persist all substantive outputs and important context as organized Markdown with good handoff points. See [documentation index](README.md) and [current handoff](handoff.md).

Initial official-source research is complete: [Rally feasibility](research/rally-feasibility.md). No authenticated calls or meeting experiments have been run.

- Documentation supports live transcription/diarization, but mapping names from introductions needs testing.
- Documented Muse services do not synthesize speech. **User-approved experiment order:** browser speech synthesis first, then research/test the GPT voice option linked below. Muse remains responsible for transcription and reasoning; speech output is a separate adapter. Neither approach has been tested yet.
- Native Teams real-time media has substantial runtime/hosting/permission requirements. Investigate the documented managed-bot path as a gated stretch; do not make Teams a critical dependency.

### User follow-up: existing Teams environment and two speech approaches

- The user already has a running Microsoft Teams environment and wants to invite Rally as another meeting participant. We do not need to provision a meeting environment. Still verify bot join identity, audio transport, meeting admission, and whichever permissions the chosen native or managed path requires.
- First speech experiment: browser text-to-speech. Second candidate: the newly announced GPT voice model in [the supplied gpt-live-1.1 discussion](https://community.openai.com/t/gpt-live-1-1-is-rolling-out-with-new-voices-and-better-accents/1406704).
- User requested further research before implementation. Verify the exact named model, API availability versus a ChatGPT feature rollout, text-to-audio behavior, latency/cancellation, and audio routing into Teams. Do not silently substitute another model.
- Follow-up research: [speech and Teams](research/rally-speech-and-teams.md).
- Follow-up findings: the supplied announcement says GPT-Live-1.1 API access is forthcoming; a callable endpoint for that exact version has not been established. Keep it pending, without substituting a predecessor. Documented GPT-Live-family commentary may paraphrase, so exact-text fidelity is a separate admission test even when access becomes available.
- Teams candidate: pass a normal meeting join URL to a managed bot named Rally, admit it from the existing meeting lobby, and test live receive/send audio. No calendar integration or new host Teams deployment is needed for that experiment. Provider account access, policy, retention, and browser synthesis inside the bot remain untested.

### Validation backlog

Latest user steering: the GPT voice option need not be the latest version. An existing available GPT-Live or TTS model is acceptable to investigate. Official documentation confirms `gpt-live-1` as an API model; actual account access remains untested. This supersedes the earlier exact-version-only restriction. Browser TTS remains first. Prefer a dedicated text-to-audio path for fixed Muse-authored interventions; GPT-Live's possible paraphrasing requires a fidelity test. `gpt-4o-mini-tts` is documented but deprecated with January 6, 2027 shutdown, so it is a possible hackathon experiment with migration cost rather than an unqualified long-term choice. See the updated speech research.

- Verify official model documentation, actual API access, identifiers, capabilities, latency, and streaming support for candidate Meta services.
- Verify transcription, speaker identification, and speech-output options; establish what genuinely requires another service.
- Specifically test speaker attribution after spoken introductions with three participants; distinguish speaker labels from correct mapping to participant names. Test interruption/audio playback handling so Rally's own speech is not mistaken for a participant commitment.
- Investigate Microsoft Teams participant-join first, including official APIs, permissions, tenant/admin requirements, real-time audio access, hosting, and bot-service alternatives. Compare with browser capture; keep the browser demo baseline unless feasibility justifies expansion.
- Give each candidate integration a minimal feasibility check, fallback, and estimated effort before accepting it into the one-week scope.
- Distinguish runtime model integrations from coding tools and infrastructure in the demo's claims.

