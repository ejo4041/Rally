# Remove the advance participant list

Meeting creation no longer asks for participant names or submits a roster. The meeting header no longer counts roster names. The old field was optional free text, supplied as model context and as suggestions in the speaker naming dialog; it was never tied to Rally accounts or access grants.

The backend already defaults omitted participants to an empty array. Preserve its compatible field and historical records. Live transcription still detects speaker labels, and users can identify those speakers during the meeting. Historical roster name suggestions remain available when viewing older meetings. Report sharing continues to require explicit Rally-account grants.

Validation: frontend typecheck, 17 unit tests, build and full synthetic-provider browser workflow pass, including creation without a roster, live capture, speaker controls, report generation, PDF and access grant/revocation. No paid model requests. Browser screenshots use bounded viewports under capped systemd execution.
