# Backend MVP implementation review

Reviewed against baseline main `510bb07e0c8da794c92eb2a9c489d026de5a04d6`; originating spec: [backend plan](backend-plan.md). The implement skill invoked two independent review agents using the code-review skill. Initial implementation commit: `e35d8a1`.

## Standards

- Capability-contract violation: pending guidance could use superseded transcript revisions because only the meeting control epoch was checked. **Fixed:** compare captured turn revisions against canonical stored turns before publishing. A deferred-provider HTTP regression covers a corrected turn arriving during inference.
- Possible Divergent Change (heuristic): model transport, accounting and prompts shared one module. **Addressed narrowly:** application prompts now live in `apps/rally-api/src/prompts.ts`; no broader architecture added.

## Spec

- Speaker tips could repeat a speaker entry and cite another person's turns, bypassing the two-tip and attribution rules. **Fixed:** reject duplicate speaker entries and require each tip's cited turns to belong to that speaker.
- Evidence arrays allowed unsupported outcomes, numerical scores and tips. **Fixed:** outcomes/tips require nonempty evidence, and non-null scores require evidence. Unknown scores remain permitted without evidence. HTTP report retry regressions cover invalid attribution, duplicates and empty supporting evidence.

## Validation and disposition

All four findings were addressed. Also fixed empty-transcript report cleanup so failed reports remain retryable/deletable, and blocked capture restart during report processing. The scheduled-loop regression verifies unchanged-input suppression, ordinary intervention cooldown and explicit host requests. Final full suite: **8 tests passed**, TypeScript check passed, production dependency audit reported **0 vulnerabilities**. Source formatting was normalized for handoff. No additional paid calls were needed for review fixes; the prior real-provider output remains integration evidence, not an evaluation of meeting quality.

Standards: 2 findings, material stale-revision issue fixed. Spec: 2 findings, unsupported and misattributed report claims rejected.
