# Integrated Teams startup configuration — October 30, 2026

## Symptom and cause

The user started a prepared meeting with a Teams invitation. Rally showed joining, but no participant appeared in the Teams lobby. At inspection, the temporary browser session recorded that it had stopped; no CDP listener existed on 9227.

Running the provisioned Chromium executable inside the API service mount namespace reproduced a loader error for `libatk-1.0.so.0`. The legacy Sites Teams units set `LD_LIBRARY_PATH=/srv/hackathon/tools/browser-libs`; the integrated API environment omitted it. Adding that variable made the same executable report its version successfully. This is deployment configuration evidence, not a Teams tenant rejection.

## Correction and validation

- Added `LD_LIBRARY_PATH=/srv/hackathon/tools/browser-libs` to private runtime `api.env` and restarted the API. No live capture existed; the attempted meeting remained ready. No meeting invite or credential was saved in documentation.
- Kept release `ca539a5` and its newer MFA/admin/closed-account changes intact. The streaming worktree was fast-forwarded to their documented checkpoint `1892f5d` before further edits.
- Updated the deployment configuration example with the Chromium library path and XDG runtime directory so rebuilding the service does not omit them.
- Ran the real headed `session.mjs` startup under a transient systemd service with the production User, NoNewPrivileges, PrivateTmp, ProtectSystem, ProtectHome and writable-state restrictions. The real browser CDP endpoint became reachable. Child browser/Pulse/Xvfb processes were stopped and temporary state removed.
- That check navigated only to the Teams landing page, did not click Join, and made no model calls. It establishes startup under the deployment restrictions, not invitation admission or call audio.

The user was asked to refresh and retry the prepared meeting. Live lobby/admission/audio results remain pending at this checkpoint. Earlier local startup-cancellation testing did not prove the production browser could finish loading; future deployment checks should require the real CDP endpoint before claiming browser startup success.
