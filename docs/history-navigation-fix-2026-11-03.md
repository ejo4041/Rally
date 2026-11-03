# Saved meeting navigation — November 3, 2026

The user reported that selecting a previous meeting changed the URL but left the page unchanged. Investigation confirmed a retry defect: a failed saved-record GET leaves `#meeting/<id>` in the URL, and selecting that same history item again only assigns the identical hash. Browsers do not emit another `hashchange`, so the UI never retries the GET and remains on the home screen.

The original initiating failure on the user's browser was not observed. Normal history links, a failed-report fixture, existing ended-record shapes and an initial deployed synthetic report all rendered during investigation. The confirmed defect was isolated by returning a single synthetic 503 on the first record load, then clicking the same item again. Before the fix, the browser test timed out with the correct meeting URL, home visible and meeting hidden; the second click sent no new GET. This reproduces the reported visible symptom without altering production records or calling models.

The delegated history click handler now invokes the existing route function when the destination already matches the current hash. Different destinations continue through `hashchange`; existing capture/busy navigation guards and account authorization remain in force. This does not regenerate reports or retry paid provider analysis.

## Verification

The bounded browser regression `apps/rally-web/tests/history-navigation.mjs` passes against the real UI, isolated HTTP/MFA/SQLite fixtures and synthetic record responses. It checks first-load failure followed by same-item retry, ready-report text, failed-report disclosure, home/reopen, recent-sidebar links, browser Back/Forward and a 390×844 mobile viewport. Run `npm run test:history` from `apps/rally-web`; on the shared host, use the systemd browser limits in AGENTS.md. The 17 frontend unit tests, frontend typecheck and production build also pass.

Ranked hypotheses were missing same-hash retry, a navigation guard, and a report-rendering exception. Explicitly routing the same destination turned the deterministic retry repro green; the other two were not needed to explain that reproduction. No debug instrumentation remains in application code. The regression contains no production account data or provider credentials.

## Deployment

Frontend source `624d52b` is deployed as `624d52b-web-history`. The release copies backend `6fa6e2f` unchanged and updates only frontend source/built assets. A private SQLite backup preceded the atomic release-link switch; live meetings and processing reports were zero. API PID remained 625268; no API restart was performed. The current production speech configuration is preserved.

[Public HTTPS verification](research/history-navigation-deployed-2026-11-03.json) passes actual MFA with a disposable synthetic account/report, an intercepted first-GET 503, same-item retry, report display and back/reopen. Disposable records were removed. The probe used no paid model calls or platform joins. The earlier broad smoke reached report display but stopped at a pre-existing permission error saving its PDF artifact; the targeted navigation check avoids that unrelated output path and does not claim PDF verification.

Refresh the Rally page to load the fixed bundle, then reopen the meeting. An actually failed analysis remains visibly failed with its saved transcript; the separate [unknown-cost incident](report-cost-incident-2026-11-02.md) still needs reconciliation before further paid analysis. If a first record load fails again, capture its sanitized UI error/HTTP status to establish the initiating cause; the repeated history click can now retry it.
