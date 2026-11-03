# New-meeting setup — November 3, 2026

The user reported that Join could not be clicked after entering the setup information and that the previous meeting invitation was still prefilled.

## Diagnosis

A read-only production check found the newest meetings in draft phase with no plan and the error “Unknown provider costs must be reconciled before further paid work.” Join requires a prepared plan as well as consent and, for Teams, a valid work/school invitation. Filling the visible inputs cannot satisfy a plan that failed to generate. This is the existing accounting block from the [failed final-report request](report-cost-incident-2026-11-02.md), not an additional new charge or a newly introduced Join restriction.

The invitation leak is a separate frontend bug: opening another meeting reset consent but left the shared Teams input's value intact. The browser reproduction waited until the second meeting rendered, then failed because the first meeting's synthetic invitation was still present. This rules out merely checking the field before navigation completes.

The investigated explanations were a retained invitation input, invalid-link/consent gating, and missing preparation because of the provider guard. The first and third are confirmed; valid invitation and consent correctly enable a prepared meeting in the browser test.

## Change

Each successful route to a different meeting now clears the invitation input, and the input has autocomplete disabled. No saved invitation is populated into a new meeting. The existing consent reset is preserved.

A visible status beside Join explains missing preparation, invalid/missing invitation, missing consent and an operation in progress. Preparation errors appear there with a retry instruction; an unknown-cost failure explains that provider billing reconciliation is required before retrying preparation. Join's existing requirements and the server budget guard remain enforced. This frontend change does **not** restore paid preparation while the unknown cost remains unresolved.

## Verification and deployment

The isolated real-browser test `apps/rally-web/tests/meeting-setup.mjs` covers the stale-link failure, empty link/consent on the next meeting, valid/invalid invitations, an enabled Join sending one intercepted POST, preparation failure, explicit unknown-cost messaging, successful explicit preparation retry with injected providers and a 390×844 viewport. Run `npm run test:setup` from `apps/rally-web`, using AGENTS.md's bounded systemd settings on this host. All 17 frontend unit tests, frontend typecheck and build pass.

Source `817b08b` is deployed as `817b08b-web-setup`, preserving backend `6fa6e2f` and the earlier history retry fix. A private SQLite backup preceded the atomic static release switch. Live meetings, processing reports and running usage were all zero; one unknown usage row remained. API PID stayed 625268 with no restart.

[Deployed public HTTPS evidence](research/meeting-setup-deployed-2026-11-03.json) passes actual MFA with disposable synthetic meetings, prepared Join enabling/request dispatch, next-meeting invitation and consent reset, and blocked-preparation explanation. The Join POST was intercepted; no real platform call or provider request occurred. Synthetic records were removed.

## Remaining input

Refresh the UI for the fixed form. To restore new paid meeting preparation, reconcile the failed report request around November 2 at 18:56 UTC against actual Meta usage/billing evidence. Its $0.253929 reservation is not a confirmed charge. The user has been asked for any corresponding billing/usage details. No unknown row was deleted, set to zero, converted to settled or bypassed. This batch made zero paid model calls and no final submission.
