# Actual backend AI input/output examples

October 29, 2026. These are **actual Muse responses**, not hand-written ideal outputs. Agenda inputs and the meeting transcript were authored synthetic test cases. The text scenario tests reasoning through the application with injected transcript turns; the separate audio scenario uses real LiveKit and Muse ASR on locally generated Meta MMS speech. Neither is a human meeting rehearsal.

[Complete inputs and JSON outputs](research/backend-ai-examples.json) include the initial agenda defect, exact turn IDs, scoring reasons, all tips, and the separate audio result. [Astra manual quality review](backend-astra-ai-quality.md) identifies remaining weaknesses rather than treating a successful API response as calibrated judgment.

## Agenda creation

Duration is a separate user input. Each topic stores an intended outcome, time budget, stable ID and status, not just a title. Supplied names in the standup example were a separate participant list.

### Heimdall progress and requirements

Input (25 minutes):

> Sync up with the team about progress on the Heimdall efforts. Collect requirements for next steps.

Actual generated plan:

| Topic | Minutes | Intended outcome |
| --- | ---: | --- |
| Heimdall progress sync | 12 | Share current progress on Heimdall efforts |
| Requirements for next steps | 10 | Collect requirements for next steps |
| Closing / wrap-up | 3 | Recap and close in line with the objective |

Objective: Sync up on Heimdall progress and collect requirements for next steps.

### Daily standup

Input (15 minutes):

> Hold our daily standup with the team, round the room for updates and blockers, final last call at the end for missed rounds.

Actual generated plan:

| Topic | Minutes | Intended outcome |
| --- | ---: | --- |
| Alice - update and blockers | 3 | Hear Alice update and blockers |
| Ben - update and blockers | 3 | Hear Ben update and blockers |
| Cara - update and blockers | 3 | Hear Cara update and blockers |
| Diego - update and blockers | 3 | Hear Diego update and blockers |
| Last call for missed rounds | 1 | Final last call for missed rounds |
| Closing / wrap-up | 2 | Recap and close in line with the objective |

Objective: Hold a 15-minute daily standup with round-robin updates and blockers, plus a final last call.

### Heimdall milestone review

Input (60 minutes):

> Heimdall milestone review. Purpose: decide whether the next milestone is ready and agree requirements for the next sprint. Attendees: engineering, product, operations and security. 1. Opening and intended decisions (5 min). 2. Progress against the milestone: demo completed work, compare scope to commitments, call out unfinished work (15 min). 3. Engineering and operational readiness: reliability risks, deployment plan, rollback, support ownership (15 min). 4. Requirements for next sprint: collect product needs and security constraints, separate must-have from follow-up, identify unanswered questions (15 min). 5. Close: decide go/no-go or list evidence still needed; recap actions, owners and due dates (10 min). Constraints: do not assume a release date or assign someone work without discussion. Park deep architecture debates for a follow-up. Capture any requirement that needs a separate ticket.

Actual generated plan:

| Topic | Minutes | Intended outcome |
| --- | ---: | --- |
| Opening and intended decisions | 5 | Confirm intended decisions for milestone readiness and next-sprint requirements |
| Progress against the milestone | 15 | Demo completed work, compare scope to commitments, and call out unfinished work |
| Engineering and operational readiness | 15 | Surface reliability risks, deployment plan, rollback, and support ownership |
| Requirements for next sprint | 15 | Collect product needs and security constraints, separate must-have from follow-up, identify unanswered questions |
| Closing / wrap-up | 10 | Recap and close in line with the objective |

Objective: Decide whether the Heimdall next milestone is ready (go/no-go or list evidence still needed) and agree requirements for the next sprint, including recap of actions, owners and due dates. Do not assume a release date or assign work without discussion. Park deep architecture debates for follow-up. Capture any requirement that needs a separate ticket.

The first detailed-review attempt added a second wrap-up and trimmed other sections. The prompt was corrected to reuse an explicit closing allocation; the table above is the actual retest, preserving 5 + 15 + 15 + 15 + 10 minutes. Standup wrap-up behavior can still be tuned—for example, making the final last call part of the wrap rather than a separate one-minute topic.

## Live guidance example

The three-speaker text scenario contained substantive pilot discussion followed by three unrelated coffee/cafe turns. Actual health: **3/5**, concerns **drift** and **missing_action_details**. The intervention was:

> Pause coffee / cafe ranking and return to pilot: assign customer email owner + deadline, then confirm blockers.

Evidence: `quality:9`, `quality:10`, `quality:11`; the last says, “Let's rank those cafes and coffee machines now. It will take a few more minutes before we return to the pilot.” The model retained prior progress and moved the decision/assignment topic to active.

## Final due-outs and decision

The complete input contains 19 turns across a synthetic 10-minute-25-second meeting. The actual reported decision was:

> Enter two-customer Heimdall pilot on Monday only if audit-export, rollback rehearsal, and accessibility sign-off all pass; if any fails, postpone Monday's pilot.

This is a model extraction of expressed agreement, not a host-confirmed record. The late accessibility condition was retained; it was not lost behind the earlier two-condition decision.

| Due-out | Owner | Deadline | Status / evidence |
| --- | --- | --- | --- |
| Fix audit-export timezone bug | Leo | Thursday at 3 pm | reported_agreement; `quality:1`, `quality:12`, `quality:16`, `quality:18` |
| Verify audit-export after timezone fix | Priya | Friday noon | reported_agreement; `quality:2`, `quality:12`, `quality:17`, `quality:18` |
| Run rollback rehearsal against failed-migration case that caused empty dashboard (not just happy path) and report whether it passes | Priya | Friday at 2 pm | reported_agreement; `quality:3`, `quality:4`, `quality:12`, `quality:17`, `quality:18` |
| Assign owner and deadline for customer pilot email; currently no owner or date, Priya stated tentative help was not a commitment and later no capacity | Unresolved | Unresolved | unresolved; `quality:7`, `quality:8`, `quality:12`, `quality:17`, `quality:18` |
| Complete accessibility sign-off before pilot; owner and deadline not assigned, Leo stated cannot own as well | Unresolved | Unresolved | unresolved; `quality:14`, `quality:15`, `quality:16`, `quality:18` |
| Review support checklist sometime next week, perhaps (tentative offer from unknown speaker, explicitly not assigned yet; do not treat as commitment) | Unresolved | Unresolved | proposal; `quality:13`, `quality:18` |

Examples of source evidence:

- `quality:1`: “I can fix it by Friday—sorry, by Thursday at 3 pm. Friday is too late for QA.” The output uses the corrected Thursday date.
- `quality:17`: “Audit verification Friday noon, rollback rehearsal Friday at 2 pm; both are mine. I have no capacity for the email.” The output assigns Priya the checks, not the email.
- `quality:13`, unattributed: “I can review the support checklist sometime next week, perhaps. Don't put my name against it yet.” The output retains a proposal with no assigned owner/date.

Actual optional follow-up draft for the unassigned email:

> Draft ticket: Assign owner and deadline for two-customer pilot customer email before Monday; confirm content, sender, and timing. No owner assigned in meeting.

No ticket, calendar invitation, or external message was created.

## Scores and evidence

Actual overall score: **3.4/5**, coverage **5/5**. It is the arithmetic average of five assessable categories, not an average of live health readings. These are model judgments supported by evidence, not objective measurements.

| Category | Score | Model's actual reason | Evidence |
| --- | ---: | --- | --- |
| goal_progress | 3 | Conditional pilot decision with no GA was expressed and audit-export fix/verification and rollback rehearsal gained owners/dates, but customer email and accessibility sign-off owner/deadlines stayed open and final go remains pending verifications, so core objective partly met. | `quality:5`, `quality:6`, `quality:7`, `quality:12`, `quality:15`, `quality:16`, `quality:17`, `quality:18` |
| focus | 3 | Early turns stayed on audit-export, rollback and conditional pilot, then three turns drifted to coffee-machine/cafe ranking explicitly noted as unrelated to Heimdall. After redirect at 325s, later speech parked coffee and returned to pilot assignments and blockers, but email assignment part remained incomplete, showing mixed focus with recovery. | `quality:0`, `quality:5`, `quality:8`, `quality:9`, `quality:10`, `quality:11`, `quality:12`, `quality:14` |
| pacing | 3 | Original 10-minute plan (3+3+3 plus 1 wrap) and revised plan kept same durations with audit-export/rollback done and pilot-decision active. Actual time was 625s, 25s over as stated in close, with ~75s off-topic drift contributing to overrun and unresolved email/accessibility at wrap despite returning to pilot. | `quality:9`, `quality:10`, `quality:11`, `quality:12`, `quality:18` |
| actionable_outcomes | 3 | Three tasks have transcript-expressed owners/dates (Leo fix Thu 3pm, Priya verification Fri noon, Priya rollback Fri 2pm) and conditional pilot reported, but email and accessibility lack owners/dates and support-checklist tentative offer correctly remains unassigned with nulls preserved, so outcomes mixed. | `quality:1`, `quality:2`, `quality:4`, `quality:12`, `quality:13`, `quality:14`, `quality:17`, `quality:18` |
| participation | 5 | Maya invited Leo then Priya to state blockers and both responded, Priya questioned rollback readiness, Maya left email open asking who can take it, and Maya asked Leo and Priya for objections to three conditions with both responding no objection/agreed. Turn with null speaker has uncertain attribution and gaps alone are not evidence of exclusion. | `quality:0`, `quality:1`, `quality:2`, `quality:7`, `quality:8`, `quality:15`, `quality:16`, `quality:17` |

The approximate focus split was 285 seconds on topic, 75 off topic and 265 unknown. These numbers come from the authored timestamps, not measured human audio. Unknown includes gaps and unattributed speech; it is not assumed off-topic.

Manual review found that the scores can be too harsh about future verification still pending after a conditional decision, and about intentionally unassigned work. The latest prompt now distinguishes completing the meeting's decision from completing later tasks. That final wording change has not been re-evaluated with another paid call.

## Speaker suggestions

Below is one actual suggestion per named speaker; the full JSON contains both generated suggestions per speaker.

- **Maya**: When coffee or cafe talk starts, restate the open pilot assignment for email owner and deadline immediately instead of adding cafe examples. Evidence: `quality:8`, `quality:10`.
- **Leo**: Defer coffee-machine and cafe ranking to a separate thread to keep remaining minutes for pilot blockers. Evidence: `quality:9`, `quality:11`.
- **Priya**: Continue stating capacity limits explicitly when declining email or extra checks so tentative help is not recorded as ownership. Evidence: `quality:7`, `quality:17`.

One other actual suggestion told Leo not to repeat a superseded deadline. Review judged that advice unhelpful: explicit correction and reconfirmation improved clarity. The prompt now explicitly discourages criticizing useful corrections and permits fewer than two suggestions when further feedback would be artificial. This is a tuning change, not proof of improved behavior across meetings.

## Audio-path reality check

The separate actual-audio run finalized six turns, executed six assessments and completed a 3.6/5 report. Recognition was imperfect: “Heimdall” became “hymn all,” and “Alice” became “Ellis”/“Alyssa.” One synthetic voice became two diarization labels. The report correctly left the conflicting dashboard owner unresolved, but participation scores and person-specific tips require caution until attribution is corrected. Physical microphones, real multi-speaker accuracy and network impairment remain untested in this backend pass.

## Cost and reproducibility

These examples and the deeper review used 17 paid operations, costing **$0.28876035**, including an unfinished maximum-effort report. The report first exhausted a 16,384 completion-token limit, then completed on an explicit report-only retry with a 32,768 limit. Its usage was 19,973 completion tokens, including 17,783 reasoning tokens. Live guidance remains minimal effort. All calls are in the [cost ledger](research/muse-cost-ledger.md); no unknown costs in this batch.

Scripts in `apps/rally-api/scripts/`: `agenda-examples.ts`, `astra-quality.ts`, `retry-quality-report.ts`, `generate-meeting-fixture.mjs`, `muse-smoke.ts`. Paid scripts require explicit environment gates and enforce conservative estimated caps; they are not part of `npm test`. Preserve their usage ledgers and reconcile every run.
