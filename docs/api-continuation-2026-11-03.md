# Authorized API continuation — November 3, 2026

The user checked Meta Billing, saw no issue and explicitly requested API availability tonight despite missing usage for the earlier failed report. That authorizes a provisional reservation policy while preserving actual-cost uncertainty.

`RALLY_ALLOW_UNKNOWN_COST_ESTIMATES=1` now allows new provider requests when unknown usage rows exist. The ledger still counts each unknown row's estimate toward the meeting and application caps. Actual cost remains null and status remains unknown until evidence supports reconciliation. Production retains its existing $6 per-meeting/$20 application caps; no cap was increased and no failed report is automatically retried. Default configuration remains strict when the flag is absent.

The regression checks default blocking, explicit continuation, unknown estimates counting against both caps, running reservation updates and known settlement, and byte-for-byte preservation of the original unknown record. All 159 backend tests and API typecheck pass.

Backend source `35f86ed` is deployed as `35f86ed-api-continuation`, preserving frontend `817b08b` with the blank-invitation and history fixes. No active meetings, processing reports or running requests existed before restart. A private SQLite/config backup preceded the atomic release switch and API restart. Existing secrets and user records are preserved. The runtime flag is enabled only in the private server environment; its value is not a provider credential.

Refresh Rally and use **Retry agenda preparation** on the existing draft, or create a new meeting. A draft can retain the previous preparation error until its explicit retry succeeds. This change does not rerun a prior meeting or regenerate its failed report automatically.

[Public actual-provider verification](research/api-continuation-deployed-2026-11-03.json) passed actual MFA and one real Muse agenda request: the meeting reached ready with a prepared plan, HTTP200 usage settled at **$0.002948**, and the original unknown row stayed unchanged. The disposable meeting/account were removed; paid usage remains in the production ledger. The first probe attempt hit local TLS resolution before the server/provider; the corrected explicit browser-fetch probe made the single paid request. No provider call was automatically retried. Tracked development cumulative is **$5.34461765**; conditional unverified-$150 remainder **$144.65538235**, excluding unverified unrelated runtime activity and unknown costs. No real meeting was joined; final submission remains on hold.
