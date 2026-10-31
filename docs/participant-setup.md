# Remove the advance participant list

Meeting creation no longer asks for participant names or submits a roster. The meeting header no longer counts roster names. The old field was optional free text, supplied as model context and as suggestions in the speaker naming dialog; it was never tied to Rally accounts or access grants.

The backend already defaults omitted participants to an empty array. Preserve its compatible field and historical records. Live transcription still detects speaker labels, and users can identify those speakers during the meeting. Historical roster name suggestions remain available when viewing older meetings. Report sharing continues to require explicit Rally-account grants.

Validation: frontend typecheck, 17 unit tests, build and full synthetic-provider browser workflow pass, including creation without a roster, live capture, speaker controls, report generation, PDF and access grant/revocation. No paid model requests. Browser screenshots use bounded viewports under capped systemd execution.

## Meeting setup alignment

The approach and connection selectors now share a top baseline in bounded 22rem columns, stacking on mobile. The creation dialog approach selector is also capped at 22rem. The developer feedback checkbox is immediately below participant consent in a shared column; its explanatory text remains visible. The feedback control returns to the main meeting view during capture/review so users retain the ability to withdraw access after a meeting. Sharing remains optional and initially off.

Browser validation checks selector alignment/width, checkbox alignment/order, light and dark desktop presentation, mobile overflow and feedback visibility. The existing full workflow checks speaker identification, settings sheets, capture and reports.

## Deployment

Merged into main and deployed static release `7af2a98`. The API/media services were not restarted; backend source is unchanged. SQLite backup preceded the atomic release switch. [Public MFA/PDF/access-control smoke checks passed](research/participant-setup-deployed.json), with disposable synthetic records removed and zero paid calls.
