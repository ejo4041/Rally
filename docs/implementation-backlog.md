# Rally ordered implementation backlog

Build-ready recommendations derived from [architecture](rally-architecture.md) and [agreed roadmap](rally-roadmap.md). Estimates are focused one-developer ranges, not guarantees; work can exceed them on device/provider problems. The existing diagnostic scripts are experiments, not completed product tickets.

## First-build status — October 28

The first version is implemented and privately deployed. [Verification report](build-progress.md) is the source of actual results. R01–R09 have implemented product paths with automated coverage; R02/R03/R06/R07 still require physical microphone/speaker checks. R10 is partial: headless/browser, budget and error-lifecycle checks pass; real devices, echo and full production recovery remain unverified. R11 Teams and R12 optional Wonder are deferred behind their stated gates. R13 video/rehearsal/public-repository/submission work remains outstanding. The implementation uses a Worker/D1 backend instead of the proposed Python service to fit the supported private hosting runtime.

| ID | Task and dependencies | Acceptance criterion | Estimate |
| --- | --- | --- | --- |
| R01 | Reproducible backend/dev setup, env loading and protected workspace | One documented launch command; no secrets in client/logs; unauthorized access denied before capture/history; persistent DB path explicit | 2–4 h |
| R02 | Browser microphone diagnostic and PCM transport; R01 | Real mic captured at verified sample format/rate; server receives bounded continuous PCM; partial/final caption visible; capture gaps and permission failures shown | 3–6 h |
| R03 | Browser speech diagnostic and host stop; R01 | User starts audio, selected voice speaks fixed text, actual start/end/error logged; cancel stops and clears pending text; test actual laptop/phone | 2–4 h plus human device check |
| R04 | Meeting setup and controller; R01 | Agenda, outcomes, roster, duration and short-meeting wrap-up validation; consent gates capture; phases/timer state explicit | 2–4 h |
| R05 | Transcript canonicalization/persistence; R02,R04 | Finals keyed by session/turn/revision, partial replacement, out-of-order handling, unknown speaker/correction and reconnect continuity tested | 3–5 h |
| R06 | Connect bounded moderation to audio; R02,R03,R04,R05 | Live finalized turns trigger schema/evidence-validated Spark minimal decision while audio continues; normal-speed audible timings saved with costs | 3–6 h |
| R07 | Cooldown, host override, cancel and stale-result control; R06 | Late decisions cannot speak after pause/end/agenda change; no queued historical interventions; self-speech cannot confirm a commitment | 3–5 h |
| R08 | Proposed/confirmed outcomes and missing fields; R05,R06 | Explicit confirmation tied to one proposal, owner/date unresolved states, ambiguity clarification and source evidence work | 4–6 h |
| R09 | Wrap-up, saved history, export, deletion, factual scorecard; R04,R05,R08 | Five-minute default and disclosed demo clock work; outcomes trace to evidence; end/save/delete consistent; no raw audio saved | 3–5 h |
| R10 | Browser/reconnect/error/cost hardening; R02–R09 | Key/provider errors visible, budget/session caps active, disconnect degrades honestly, real laptop/phone run completed | 3–5 h plus human check |
| R11 | Teams managed bot spike, gated; R06 and service access | Existing Teams meeting admits Rally; live input feeds Muse; response audible; cancel/leave and retention verified. Cut if prerequisites stall or spike exceeds one day | 4–8 h spike; polish extra |
| R12 | Optional Wonder evidence audit, gated; R08 | Compare one audit against Spark extraction; measurable corrected issue/useful unresolved item with cited evidence; keep if valuable and fast | 2–4 h or defer |
| R13 | Demo rehearsal and submission; R09,R10 | Three complete rehearsals, key sequence normal-speed, clock advance labeled, ≤3-minute video, public repo/product/video accessible, original-work summary | Protect Nov 2–4 |

The baseline estimates are roughly 28–50 focused hours before rehearsals, excluding optional Teams/Wonder and delays. They are capacity forecasts, not permission to fill every available hour with scope. Preserve the final two days for reliability and submission.

## Critical path and cuts

R01 → R02/R03/R04 → R05 → R06 → R07/R08 → R09/R10 → R13. If capture/speech fails on phones, use the proven laptop first and record phone support as unverified. If ASR attribution is unreliable, use roster/manual correction and unknown speakers. If speech adds latency, tune short utterances and chosen device before adding more voice providers. Keep transcript/evidence integrity and host controls even if visual polish is cut.

Teams and Wonder remain off the critical path. Calendar writes, outbound messaging, breakout rooms, rich coaching, org analytics, gamification, and standalone open-weight deployment remain deferred unless core acceptance is already met with protected rehearsal time.

## Morning review

Review [overnight results](overnight-results.md) and choose whether to start the browser vertical slice. The settled product direction does not need another broad interview. Surface only concrete technical decisions or missing access that cannot be resolved locally; continue independent tasks around them.
