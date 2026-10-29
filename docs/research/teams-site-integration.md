# Teams controls on the Rally Site

Built and deployed October 28, 2026 following the request to paste a Teams meeting URL in the existing Web UI and launch a participant from this server. The user reaffirmed Teams bot priority; phone-on-table browser microphone/TTS remains the fallback.

## Deployed behavior

Open https://rally-meeting-moderator.excavator3496.chatgpt.site and scroll to **Invite Rally to Teams**. A server-online badge shows the runner heartbeat. After Azure calling is configured, paste a work/school Teams meeting link, confirm consent and select Invite Rally. Admit **Rally audio test** from the lobby. Join/lobby/connected/failure states, incoming audio meter and Leave meeting are visible on the Site. Closing the browser tab does not stop the server bot; explicit Leave and a three-minute test deadline do.

**Current verified blocker:** the hosted status check reports the runner online but **Azure calling credentials not configured**. Nothing has joined Teams. [Credential setup](../teams-setup.md) gives the exact file/key and Microsoft references. The UI can alternatively accept a short-lived ACS VoIP token for one test.

This is a transport connection preview. It does not yet forward Teams audio into Muse or speak moderator prompts into Teams. The existing local/browser microphone meeting flow still does those jobs outside Teams. Do not present the Teams test as the complete Rally moderator until join/audio and Muse/speech integration are proven.

## Runtime and data boundaries

The hosted Worker stores a bounded job in D1. A systemd user service on the Ubuntu server polls using the Site's existing supported service access plus an additional secret bridge credential. It runs Playwright Chromium only when a user explicitly starts a test. No public server port or tunnel is needed; its internal page stays bound to loopback. A fresh generated ACS identity/token is issued only on explicit join when the server connection string is present, with no automatic paid join retries. Cleanup attempts to delete that temporary ACS identity.

Long-lived Azure connection string remains on the Ubuntu server in ignored `.env.local`; it is not sent to the Site or browser bundle. A per-test token entered in the UI is AES-GCM encrypted in D1 using the secret bridge key, with job ID as authenticated context. Claim is atomic; ciphertext is erased on claim, leave or expiration. Workspace status never returns a token or encrypted payload. Underlying database backup retention is separate from deleting current rows.

Only one active job is permitted by a database unique slot; a runner lease excludes simultaneous runners. Host cancellation before claim never joins. Queued requests expire after sixty seconds; unresponsive running tests are marked failed, with an explicit instruction to verify the Teams roster. The runner closes its client on loss of Site control connectivity and also enforces its independent maximum duration. Browser/provider failures can still require roster verification. Meeting URLs remain server-side in job metadata; raw audio is not recorded by this transport test.

Current Site audience is the existing restricted shared access policy, including its already-invited visitor. This was discovered via native get_site and preserved; earlier documentation describing the Site as owner-only is historical. No access-policy change was made to enable the runner. Service/bridge credentials are stored server-side and excluded from exports.

## Validation

- **18 automated app tests pass**, including new link validation, consent, credential prerequisites, encryption/no token leakage, one-shot claim, concurrent singleton admission, runner exclusion, host leave and expiry cleanup.
- Original rendered browser suite passes, preserving microphone/walkthrough/confirmation/history/export behavior and mobile layout.
- New rendered Teams flow passes through **UI → real D1 queue → actual Node runner → server Chromium SDK → failure status** using an intentionally invalid token. SDK rejects that malformed token before ACS authentication or meeting join. This is not a fake connected state and not evidence of a real Teams join.
- Hosted read-only check verifies actual published Teams HTML/script, enabled queue and live runner heartbeat; credentialsConfigured=false. [Machine-readable result](teams-hosted-check.json).
- Dependency audit reports zero known vulnerabilities; Worker artifact validates as ESM.
- No Muse calls or paid Azure session calls were made. This task's Muse cost is **$0**; last reconciled tracked estimate **$0.07461610** and conditional credit remainder **$149.92538390** are unchanged, subject to unverified Billing/intervening user usage.

The earlier [local duplex WebRTC probe](teams-sdk-local-spike.md) proves simultaneous virtual input/output and cancellation on this server, not ACS/Teams end-to-end delivery. Real tenant policy, lobby admission, incoming speech, remotely audible speech, cancellation and cost still need a consented real session.

## Deployment checkpoint

- Native version **6**, source **07c06a1150655d245ca25b77e99b1b0441167cbf**.
- Saved version `appgprj_6ae17976c3c88191a5b2627b0187e484~appgver_57b82ac3d9c081918cdc28a13b4b1271`.
- Deployment `appgdep_6ae23d13fb448191b1ba2e36022bb1e7`, succeeded, environment revision **5**.
- Schema migration `0001_teams` appended; original applied migration remains unchanged.
- Service: `rally-teams-runner.service`, currently active, no restarts during verification.

## Operations and next handoff

Source: `apps/rally/src/teams.js`, `apps/rally/web/teams-client.js`, `experiments/teams-audio/runner.mjs` and the existing SDK browser harness. [Runner README](../../experiments/teams-audio/README.md).

```bash
systemctl --user status rally-teams-runner.service
systemctl --user restart rally-teams-runner.service
systemctl --user stop rally-teams-runner.service
journalctl --user -u rally-teams-runner.service -n 30 --no-pager
```

Node binary and browser shared libraries were copied from the existing verified installations into `/srv/hackathon/tools/` to remove the service's dependency on temporary Node/library paths. Chromium remains in the user's Playwright cache. `.env.local` is reloaded each poll; adding AZURE_COMMUNICATION_CONNECTION_STRING is sufficient for readiness to update without a Site redeployment.

Next: configure that credential, conduct an explicit consented three-minute join test through the Web UI, verify actual audio/admission/departure/Azure usage, then connect Muse PCM and rendered TTS output. Keep the phone fallback while this is tested. Do not silently increase the test duration or start real model processing in this transport experiment.
