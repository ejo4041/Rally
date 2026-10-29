# Rally v0.1 — build verification

Built October 28, 2026 under the user's authorization to implement independently without further prompts. This replaces the research-only stopping point. Work was completed in the active session; no unattended scheduler is configured.

**Teams follow-up:** Native version 6 adds [Site join controls plus a persistent Ubuntu browser runner](research/teams-site-integration.md). App suite now has 18 passing tests. Hosted controls/runner heartbeat are verified; Azure credential setup and an actual Teams join remain outstanding. No Muse calls in this follow-up. The original v0.1 build verification below remains historical evidence for the browser meeting implementation.

## Open the product

**Private preview:** https://rally-meeting-moderator.excavator3496.chatgpt.site

Sign in with the account used for this workspace. Start with **Try a walkthrough** for a clearly labeled scripted example with no microphone or model requests. Start the walkthrough, advance its example turns, review/confirm the proposed action, try pause/resume and the disclosed demo clock, then end/export the record.

For real audio, create a meeting, enter an agenda/outcome/roster, obtain participant consent, and press Start. Use Stop speaking for immediate voice override, Pause Rally to pause moderation while transcription continues, Mute mic to send silence, and End to stop capture and save. The browser voices model-generated prompts; speech synthesis is not a Muse capability.

## What was built

- Responsive workspace, meeting setup/history and desktop/mobile-width meeting room.
- Consent-gated microphone capture; stateful low-pass/fractional resampling to 16 kHz PCM16; bounded real-time WebSocket forwarding.
- Muse live ASR, cumulative partial captions, canonical finalized turns and correctable unknown speakers.
- Spark minimal structured moderation with evidence validation, sustained-drift policy, separate outcome extraction, literal spoken deadline fields and no model self-confirmation.
- Agenda overrun checkpoints, 60-second ordinary-intervention cooldown, five-minute default wrap-up, host-selected agenda item, configurable short-meeting wrap-up and disclosed demo clock.
- Browser voice selection/test; immediate local stop; generation/epoch rejection of late speech; explicit microphone shielding during Rally speech. Automatic spoken barge-in is not claimed.
- Proposed decisions/actions with source transcript links; explicit host confirmation with owner/date review; factual scorecard.
- Saved records, Markdown export, deletion and preserved usage totals.
- Persistent per-request token/audio usage, visible cost estimates, usage export, conservative meeting/app limits, no automatic paid retries, and unknown-accounting protection.
- Clearly separated scripted walkthrough with zero paid calls. It is never represented as live model output.

## Architecture and source

Source is in `apps/rally/`. The private hosted runtime is an ES-module Worker with D1 storage and an embedded same-origin HTML/CSS/JS client. This adapts the proposed Python architecture to the supported Sites runtime so it can run privately over HTTPS without an external server. The planned module boundaries and domain rules are retained.

Server secrets were configured through native Sites environment tooling, not embedded in source or the browser. Sites enforces owner-private access; do not switch this shared workspace to anonymous public access without implementing an appropriate authorization/data policy. Public source publication is separate.

The Sites helper maintains a nested source Git checkout; source commits and deployment identifiers are recorded in the current handoff. Schema-only D1 migrations were successfully applied. Native deployment and subsequent hosted checks verified the Site; no new provider accounts, Teams joins, calendar writes or external messages were created.

## Verification performed

| Check | Result and evidence boundary |
| --- | --- |
| Core/API/accounting/lifecycle suite | 16 tests pass: consent, short-meeting validation, source ordering/revisions, confirmation, evidence, cooldown/checkpoints, concurrency, trailing analysis, shutdown, cost persistence, export/delete. No paid calls. |
| Rendered browser flow | Pass on headless Chromium: setup, walkthrough, confirmation, pause/resume, demo clock, save/reload, export/delete, populated-to-empty isolation and no mobile-width overflow. No paid calls. |
| AudioWorklet | Two seconds of synthetic 48 kHz input produced exactly 32,000 samples of 16 kHz PCM with plausible signal amplitude. This is a browser processing test, not physical microphone proof. |
| Speech adapter | Synthetic engine callbacks test cancel and late/stale result rejection, including local override before server acknowledgment. Physical audible playback was not measured. |
| Real app audio/model smoke | Known licensed audiobook PCM streamed through the actual Worker app into Muse; three real finals and a Spark redirect reached the client. Playback acknowledged as visible-only; no physical speakers. |
| Policy/schema checks | On-agenda and explicitly quoted examples remained silent. The owned-action fixture produced a proposal, with literal Thursday deadline after a field-description fix; it was not auto-confirmed. Small fixtures, not a general quality benchmark. |
| Hosted app | Owner-private HTML, server secret presence, D1 persistence, WebSocket walkthrough, confirmation, export and deletion all passed. Repeated final check introduced no usage events. |
| Hosted Muse access | Two seconds of silent PCM verified actual hosted ASR authentication/transport and usage recording. It does not establish speech recognition or audible output on the user's device. |
| Code review | Independent Standards and Spec reviews found/fixed material queue, stale-display, finalization, playback and accounting bugs; follow-up reviews found no new P1 in reviewed changes. See the review artifact. |
| Packaging/security | Valid ESM bundle; dependency audit reports zero known vulnerabilities. Sanitized source export excludes credentials, Git internals, local database, binaries/dependencies and Site identity; actual-key scan found no leak. |

Artifacts: `docs/research/app-live-smoke.json`, `app-live-smoke-first-attempt.json`, `app-live-smoke-second-attempt.json`, `app-moderator-policy-check.json`, `app-model-contract-initial.json`, `app-model-contract.json`, `hosted-qa.json`, and `hosted-live-probe.json`. [Code review](research/build-code-review.md). Local screenshots are in ignored `apps/rally/test-results/`.

## Defects discovered and corrected

- Workers now default binary WebSocket events to Blob. Explicit ArrayBuffer delivery fixed the first transport attempt, which sent no audio and had a zero audio-based cost estimate.
- Initial moderation was too hesitant on an obvious staged tangent; the sustained-drift and quotation policy was clarified. A connected retest delivered the redirect.
- A literal relative deadline initially stayed in action text while its structured date field was null. Explicit field semantics fixed the targeted case. Host review remains necessary.
- Review fixes cover one-request concurrency, trailing finalized turns, transcript isolation, bounded final extraction, playback completion, immediate local stale-prompt blocking and persisted unknown-accounting warnings.

These fixes are not a claim of perfect transcription or reasoning. The earlier four-speaker AMI diagnostic still showed material word errors; explicit confirmation and unknown-speaker handling remain essential.

## Cost reconciliation

- Tracked before implementation: **$0.05174160**.
- Additional build/verification estimates: **$0.02287450**.
- Total tracked estimate: **$0.07461610** across 42 recorded API calls/sessions.
- Conditional remainder: **$149.92538390**, assuming a full applied $150 grant and no other usage. Actual Billing balance/grant remains unverified.
- Hosted D1 already contains **$0.00010000** of probe usage. Its configured baseline is **$0.07451610**, deliberately excluding that hosted amount to avoid double-counting.

All tracked costs are known estimates; no tracked cost is marked unknown. The central ledger retains unsuccessful attempts and reported usage. Rates come from the official pricing references in the ledger. The app defaults to a $0.25 meeting forecast ceiling and $0.50 additional app-usage ceiling; these are software estimate gates, not provider-enforced hard limits. No further paid batches remain running.

## Remaining limitations and morning priorities

1. Run an actual laptop/browser microphone-and-speaker check. Measure audible start/cancel and evaluate echo/overlap. Headless tests cannot establish those.
2. Test the intended phone and foreground/audio-routing behavior over HTTPS. Responsive screenshots are not phone-hardware support proof.
3. Rehearse three consenting participants: sustained drift, explicit decision, owned/dated action, host override, wrap-up and export. Confirm that real speech is not over-interrupted.
4. Named-speaker recognition from introductions is not verified. Manual per-turn correction and unknown labels are implemented; automatic voice confirmation of commitments is not.
5. Teams remains gated on a managed provider account, reachable media page, lobby admission, tested audio output/cancel and retention. No Teams integration is claimed.
6. Optional Wonder/open-weight/SAM features remain deferred. No model calls were added merely to increase tooling count.
7. Public hackathon repository publication, final video and submission remain outstanding. A sanitized source snapshot can be generated with `scripts/export_submission.py`. Preserve the private product's access boundary while preparing judge access.

Normal page closure finalizes and saves when possible. A hard runtime/network failure can leave a stale live record until its lease expires; it remains readable/exportable and can then be deleted. Seamless mid-call session resume and full production recovery are not implemented.

## Frozen source checkpoint

Private native version 5, source commit `1a881e7dd401c01e974eb4f4332b79e869a6cd01`, deployment `appgdep_6ae189c6e17881919dec94eb7f31e31a` succeeded with environment revision 4. Final browser checks also cover dismissible mobile navigation, device-voice testing on saved records, and immediate local stale-prompt rejection. A final targeted lifecycle regression verifies that explicit Ask Rally can retry an invalid response only after budget/known-accounting preflight; unknown-cost and over-budget requests remain blocked. No implicit paid retry is added.
