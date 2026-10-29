# Backend AI quality audit and synthetic evaluation

October 29, 2026. Scope: agenda preparation, live interpretation and final report quality in `apps/rally-api/`. This is an engineering evaluation, not a validated meeting-quality instrument. [Agreed backend plan](backend-plan.md), [AI processing contract](ai-processing.md), [model contracts](model-interfaces.md), and [budget policy](api-budget.md) remain authoritative.

## Observed prior real-service result

Inspected the saved `apps/rally-api/test-results/muse-2c04aeb9-b49a-42ac-9995-c292d93d7118/meeting.json` and `usage.json`, rather than relying on the smoke script's assertions. These local evidence files may be ignored by Git.

That run successfully prepared an agenda, streamed licensed LibriSpeech audio, persisted three finalized turns with one anonymous speaker, produced a drift redirect and completed a scored report. The transcript was unrelated literary reading about Mister Quilter. It did not contain a realistic meeting decision, accepted action, corrected deadline or multiple speakers. It establishes integration and a simple negative case, not the quality of due-out extraction or multi-speaker coaching.

| Observed result | Assessment |
| --- | --- |
| Agenda retained five minutes, including one minute of wrap-up; topic allocation was 2 + 1 + 1 minutes | Useful basic structure; this is a simple agenda only |
| Live health 0, drift identified, short redirect to release-date decision | Supported by all three unrelated turns |
| No decisions/actions invented | Correct for the available speech |
| Report says focus failed “despite redirect” | Unsupported temporal implication: all speech ended before the redirect, and the meeting ended almost immediately afterwards. There was no captured response opportunity |
| Participation scored 1 because only one speaker contributed and no others engaged | Insufficient evidence of participation opportunities or exclusion; the roster was empty. Single-speaker speech alone does not establish poor participation. Null is better supported here |
| Focus-time estimates total approximately 36.33 seconds | Consistent with elapsed time and the three timestamped spans; estimates remain distinct from exact measurement |
| Overall 0.4, coverage 5 | Arithmetic is consistent with supplied category scores. Unsupported participation scoring inflates coverage; arithmetic correctness is separate from rubric validity |

Recorded batch cost was **$0.03199**: preparation $0.00390275, transcription $0.00175, assessment $0.00460675, report $0.02173050; no unknown charge in this batch. These calls were already recorded, so this audit does not add that cost again. See the [central ledger](research/muse-cost-ledger.md) for cumulative tracked spend and the conditional grant remainder. Billing balance and grant application remain unverified.

## Narrow prompt and contract recommendations

The parent implementation task owns changes to existing source. Recommendations were sent before the new experiment:

1. **Participation:** require evidence about invitations, opportunities to contribute and responses. Do not infer exclusion, disengagement or low effectiveness from silence or number of speakers. Use null when the necessary context is absent.
2. **Intervention chronology:** an intervention record proves the server emitted text. It does not prove anyone heard or ignored it. Only interpret a participant's response when later finalized turns support that interpretation. Compare meeting-relative speech time with intervention timestamps.
3. **Outcome chronology:** incorporate later corrections and conditions. Keep tentative offers distinct from accepted commitments; keep unknown owners and dates null. A conditional pilot is not an unconditional public launch.
4. **Experiment provenance:** save actual reasoning effort and output-token limit with each usage record, alongside model/pricing. Those settings affect comparability even when the model identifier stays the same.

Existing output validation checks shape, cited turn existence, category uniqueness, speaker attribution for tips and evidence presence for scored categories. Those checks cannot prove that a citation entails the model's claim. Free-text summaries and unresolved strings do not carry explicit citation fields. Keep that limitation visible; a breaking schema expansion is not necessary to run the present MVP evaluation.

The schema permits independent nullable focus-time values without enforcing elapsed-time totals or overlap accounting. The review aid flags totals above elapsed time, but null and uncertainty remain acceptable. No exact score or equal-airtime distribution is used as a golden answer. Speaker tips should remain optional when concrete corrective advice is unsupported.

## New original synthetic meeting fixture

[Fixture source](../apps/rally-api/tests/fixtures/astra-meeting.ts) contains 19 finalized text turns over a **controlled synthetic 625-second timeline**, three named speaker labels and one unattributed tentative offer. This is original authored text, not recorded speech or real ASR output. The requested meeting length is ten minutes, so the final turn ends 25 seconds over time.

Goal: decide whether the Heimdall dashboard can enter a two-customer pilot Monday, identify requirements and assign remaining work.

| Case | Expected behavior |
| --- | --- |
| Agenda | Retain ten minutes and a wrap-up; structure requirements, decision and owners without inventing facts |
| Useful tangent, through 128 seconds | The previous migration incident explains why rollback testing matters. Do not label that discussion as unrelated drift |
| Sustained drift, through 325 seconds | Three turns explicitly discuss coffee machines/cafes unrelated to Heimdall. A brief redirect is useful |
| Wrap-up, through 599 seconds | Preserve three launch conditions and identify remaining ownership gaps; avoid simply extending indefinitely |
| Final report, through 625 seconds | Capture the complete decision and three accepted tasks below; reflect 25 seconds of overtime |
| Speaker tips | Cite that speaker's actual turns, use at most two concrete behavioral suggestions, and avoid personality judgments or advice to equalize airtime |

Expected substantive outcomes:

- **Decision:** Monday's two-customer pilot is conditional on passing audit export, rollback and the later-added accessibility sign-off. Otherwise postpone. This is not general availability.
- **Leo:** fix the audit-export timezone bug by **Thursday at 3 pm**, explicitly corrected from Friday.
- **Priya:** verify audit export by **Friday noon** and run the rollback rehearsal by **Friday at 2 pm**.
- **Unresolved:** customer email and accessibility sign-off have no accepted owner or assigned deadline. The sign-off must precede the pilot; do not manufacture a calendar date.
- **Tentative:** an unattributed person offers to review the support checklist “sometime next week, perhaps” and explicitly declines assignment. It may remain an unresolved/proposed follow-up; it must not become an accepted named commitment.

Dates deliberately remain literal relative dates. Names have fixture-supplied mappings; they do not establish automatic named-speaker recognition. The useful-tangent and wrap-up snapshots are saved evaluation cases; the initial bounded paid runner requests only the sustained-drift snapshot to conserve spend.

## Runner and validation

[Runner](../apps/rally-api/scripts/astra-quality.ts), [review aid](../apps/rally-api/scripts/astra-quality-checks.ts), [offline tests](../apps/rally-api/tests/astra-quality.test.ts).

```bash
cd apps/rally-api
PATH=/srv/hackathon/tools/node/bin:$PATH node scripts/astra-quality.ts
PATH=/srv/hackathon/tools/node/bin:$PATH node --test tests/astra-quality.test.ts
```

Default execution is offline and does not load credentials. Three offline tests passed: fixture/reference validity; detection of stale dates, omitted late conditions, fabricated assignments, inflated time estimates and incorrect speaker-tip evidence; and rejection of paid execution without the explicit gate. Typecheck passed after adding the fixture and runner. No paid provider call was made by the quality-audit agent.

For the coordinating task, after reconciling existing unknown charges and the approved budget:

```bash
PATH=/srv/hackathon/tools/node/bin:$PATH RALLY_QUALITY_APPROVED=1 node scripts/astra-quality.ts --paid
```

The paid path makes one preparation request, one assessment request and one maximum-effort report request through `createMuse`/`UsageLedger`. Signup, preparation, start, guidance, end and retrieval use public HTTP routes. Transcript/media are injected fixtures. Model inputs use an explicit synthetic timeline, and the exact assessment/report inputs are saved. Production engine validation and overall-score calculation process the real model output. This proves text interpretation through the backend lifecycle, not audio transcription, LiveKit transport, physical speakers, elapsed wall-clock moderation or device behavior.

The persistent `.data/astra-quality-usage.sqlite` ledger enforces **$0.25 cumulative estimated spend for this experiment**, includes pending reservations, and blocks after unknown costs. It is deliberately reused across invocations; deleting it to rerun would bypass that protection. There are no automatic retries. The bound is an application estimate based on configured rates and token limits, not a verified provider Billing limit. The production maximum-effort/report-token settings remain in effect.

Each run writes `test-results/astra-quality-<uuid>/`: agenda, assessment, exact model inputs, persisted meeting, review findings, SQLite meeting record and usage. Usage preserves unknown costs instead of converting them into zero. The coordinating task must append batch evidence to the central ledger and report batch cost, global tracked cumulative spend and conditional $150 remainder. The runner's cumulative cost covers this experiment's local ledger only, not every project experiment.

The review aid uses a few case-specific patterns and reference checks to highlight likely omissions; it is not an automatic semantic accuracy score. Equivalent wording can trigger review findings. Human inspection of outcome evidence, conditional language, score reasons and tip usefulness remains required even when it returns no findings.

## Remaining evidence gaps

Run and inspect the bounded text experiment after prompt corrections. Record its actual outcome and costs separately from the fixture tests. Three-person natural speech, overlap, diarization stability, unknown attribution and name correction still require real audio evidence. The separate media audit owns transport checks. A useful final report on this fixture will not by itself establish useful live interventions on naturally paced meetings.

## Coordinated live evaluation follow-up

The initial three-call text evaluation used a $0.15 cap. Agenda and drift guidance passed, but the max-effort report exhausted 16,384 completion tokens (15,410 reasoning) and was correctly rejected as unfinished. The coordinator increased the production report allowance to 32,768 and the normal experiment cap to $0.25 to cover its conservative reservation. An explicit report-only retry has a separate $0.20 additional cap, retains the existing ledger, and does not repeat successful stages. Final results and examples are recorded in the consolidated report.

## Manual review of the successful real-model reports

Reviewed `test-results/astra-quality-2ff6d57e-c873-43f4-9b45-26495e60733c/meeting-retry.json` against its exact `report-input.json`, including source text and timestamps. The 19 persisted turns exactly match the supplied report turns. The saved case-specific review returned no findings; the conclusions below additionally inspect whether the cited evidence actually supports the claims.

**Accept the text scenario's core extraction.** The report correctly retains the conditional two-customer Monday pilot, all three gating requirements including the late accessibility addition, and the separate no-general-availability decision. It accurately extracts Leo's Thursday-at-3-pm fix, Priya's Friday-noon verification and Friday-at-2-pm rollback rehearsal. Their cited turns support the owners, corrected deadlines and work descriptions. Email and accessibility remain unowned with null dates; the unidentified support-checklist offer remains a proposal, not a commitment. Follow-up tickets are explicitly drafts. The report does not claim they were created.

The useful migration incident is treated as relevant. Three coffee turns support the live redirect. In the synthetic timeline, later speech returns to the pilot after the intervention, so the report can describe that sequence without assuming the intervention caused the return. Participation has direct evidence of invitations and responses in turns 0–2 and 15–17; this is materially stronger than counting speaker labels. The 625-second focus-time allocation sums correctly and discloses unknown gaps. Unknown attribution alone should not determine whether understandable speech is on topic; the 14-second support-checklist turn was conservatively classified unknown.

Remaining quality limitations:

- **One counterproductive speaker tip:** Leo is advised to avoid repeating the superseded Friday date. Both cited turns explicitly correct or reaffirm Thursday. Reconfirmation prevents ambiguity; this evidence does not justify discouraging it. Omit that tip or reinforce stating the final accepted deadline. The coffee-redirection tip is well supported. Tips for Maya and Priya are concrete and attributed, though providing two tips for every speaker should not become a quota.
- **Score explanations need task boundaries:** goal progress is partly penalized because later verification is still pending. This meeting sought a conditional decision and assignments, not execution of the future tests. Missing accessibility/email owners are legitimate gaps; tests not yet run are not automatically meeting failure. Similarly, leaving a deliberately unaccepted support-checklist offer unassigned is correct uncertainty handling, not itself a weak outcome.
- **Scores are not calibrated:** category values 3, 3, 3, 3 and 5 yield overall 3.4 with coverage 5. The evidence supports qualitative strengths and weaknesses; it does not establish those exact numeric cutoffs or comparability across meetings.
- **Synthetic clock defect in the harness:** `startedAt`, `endedAt` and intervention timestamps were normalized, but `revisions[].at` retained wall-clock time outside the synthetic meeting. The report did not visibly use that timestamp to make a false claim. Normalize revision timestamps before a future evaluation; this case does not validate revision chronology. No additional paid run is necessary solely to document this harness limitation.

The retry used 19,973 completion tokens, including 17,783 reasoning tokens, under the 32,768 allowance. Its recorded cost was **$0.08957025**. The first, unfinished report remains charged at **$0.07431700**; successful retry does not erase it. At this checkpoint the central ledger records tracked cumulative **$0.47338150**, conditional $150 remainder **$149.52661850**, unknown **0**. These are recorded estimates, not verified Billing/grant balance. This manual review made no provider calls.

### Separate real-audio example

Also inspected `test-results/muse-c2764a6e-c17e-490e-9f46-d1d6983674a7/meeting.json`. The coordinator's single-voice Meta MMS fixture passed through real transcription and produced six finalized turns. ASR split the one synthetic voice into A/B labels and rendered the intended Alice inconsistently as Ellis/Alyssa. The report correctly preserves that source conflict: dashboard owner null, Thursday retained, clarification requested. It preserves the conditional pilot and unowned retention work. It also explicitly states there were no finalized turns after the facilitator's clarification, fixing the earlier smoke's unsupported reaction inference.

This is evidence of conservative downstream handling of imperfect transcription, **not accurate named-speaker recognition or verified multi-person participation**. The report's participation score 4 relies partly on two session labels; those labels cannot establish two actual people. Pacing score 5 describes the short 68-second recording as efficient despite unresolved work; shorter elapsed time alone does not justify maximal pacing. Treat both as uncalibrated interpretations. Speaker advice about conflicting names should request verification of transcription or attribution, not imply that a participant caused the inconsistency. The remaining literal “debt retention” wording likewise demonstrates that faithful extraction cannot repair source transcription errors by itself.

Acceptance at this checkpoint: real text reasoning can produce useful evidence-backed due-outs, preserve uncertainty and handle corrected/conditional decisions; real audio reaches that pipeline and conflicting source names remain unresolved. Natural multi-speaker transcription, reliable names, calibrated scores and consistently helpful coaching remain open validation work.

Coordinator applied the final narrow coaching/scoring clarifications and normalized future synthetic revision timestamps. The last prompt edits have not had another paid evaluation; the captured outputs remain unchanged and honestly labeled in [examples](backend-ai-examples.md).
