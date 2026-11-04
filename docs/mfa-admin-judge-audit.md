# Closed registration, MFA and judge activity

Implements the October 30 user request by extending the existing username/password and SQLite session backend. No OAuth or audio recording was added. Current access URL: https://rally.tail703f9e.ts.net/ . The existing public Funnel and streaming/Teams release are preserved; this change does not configure a new relay or reopen laptop Omnigent.

## Account flow

Public signup returns 403. Administrators invite individual named accounts and deliver the one-time activation code privately. Invitations expire after 24 hours. The user chooses their password, scans the Rally QR code with a standard authenticator app and confirms a six-digit TOTP. Existing users keep their passwords and must enroll at first login after migration. All pre-MFA sessions are revoked once by the database migration.

Password authentication issues only a ten-minute enrollment/verification challenge, never an application session. Challenge cookies are HttpOnly/SameSite Strict; app cookies remain HttpOnly/SameSite Lax/Secure in deployment. All app, API and room-token routes require an enabled user with verified MFA. Enrollment can resume after a page refresh while its challenge remains valid. Subsequent login requires password and a fresh code; previously accepted TOTP time steps cannot be replayed. Standard SHA1/6-digit/30-second TOTP accepts one adjacent time step for clock skew.

Enrollment displays eight single-use recovery codes once. Recovery requires password plus a recovery code, revokes sessions and forces fresh enrollment before access. A competing password-only login cannot enroll a replacement factor during recovery. MFA reset similarly requires the administrator-delivered reset token plus the existing password, and never grants password-only access. If an activation has been consumed and enrollment expires, ask the administrator for a fresh reset code.

Stored TOTP secrets (including pending enrollment) use AES-256-GCM with the separately configured persistent `RALLY_MFA_KEY`. Keep this key backed up securely: losing it requires administrator recovery and re-enrollment. Session, challenge, invitation and recovery tokens are stored hashed. Passwords retain scrypt with random salts and timing-safe comparison.

## Administration

The Admin button appears only for an administrator; the server checks roles separately on every endpoint. Administrators can invite accounts, enable/disable accounts, change another user's role, and reset another user's MFA. Account changes require MFA verification within five minutes (or Admin security password+fresh code reauthentication). Self-disable, self-demotion and self-reset are rejected; the last enabled administrator is protected. Reset and role/disable changes revoke target sessions. Security revocation cancels pending/active browser capture and Teams capture; ordinary logout retains the existing independently hosted Teams behavior.

Reset requires an audit reason and trusted-channel identity verification by the administrator. The reset response tells the administrator to notify the user privately; no email/SMS notification service is configured. Activation codes are displayed once and cleared from the admin dialog on close/logout. Admin content is read-only. Previously issued media tokens use a unique room per capture and cannot access later captures; closing capture deletes the room and disconnects participants. Token expiry is admission control, not a general instantaneous JWT revocation service.

Initial operator-created administrator: `rally_admin`. Use the private activation file delivered separately, choose a password and enroll your authenticator. Activation credentials and encryption keys must never appear in repository documents.

Offline bootstrap/recovery, as an authorized OS administrator:

```bash
# Use the deployment environment; secret values are not command arguments.
RALLY_ENV_FILE=/srv/hackathon/rally-deployed/config/api.env \
RALLY_ACTIVATION_FILE=/private/new-activation-file.txt \
node scripts/admin.ts invite-admin new_admin_username

# Stop API first for offline reset of an existing administrator.
RALLY_API_STOPPED=1 RALLY_ENV_FILE=/srv/hackathon/rally-deployed/config/api.env \
RALLY_ACTIVATION_FILE=/private/new-reset-file.txt \
node scripts/admin.ts reset-admin existing_admin_username
```

Bootstrap refuses to replace an existing account; secret files use mode 0600 and exclusive creation. Recovery requires OS access. Restart only after checking for active capture/report work and backing up SQLite.

## Judge activity and content

Admin activity lists the latest 200 meetings: account, time, capture mode, duration, state, transcript turn count and report/error status. It also shows per-account Muse usage/cost/reservations, speech status/usage with unknown costs kept explicit, and the latest 300 audit events. Individual accounts provide account-level attribution, not proof of the human's identity. This is operational activity, not a clickstream recorder or a complete provider bill.

Each meeting has an unchecked-by-default **Share this test’s transcript and report with the developer for feedback** option. Only the owner can change it. The notice explains basic telemetry, optional content access and participant notice. Sharing is stored separately from provider-generated content and works for imported/saved transcripts too. An administrator cannot open an unshared transcript via the admin endpoint. Every content view is audited. Withdrawal blocks future server reads; it cannot retract text already viewed/exported. Deleting a meeting cascades its sharing permission. Reports/notes/speaker corrections are included in explicitly shared content.

No replayable participant recording is added. Raw audio follows the existing transient processing path. This review does not establish upstream-provider retention. Transcripts retain the existing user history/deletion behavior; there is no new automatic transcript purge. Audit events are pruned to 30 days when events are written and on startup; backups have separate operator retention. Operational logs contain no passwords, codes, tokens, meeting invite URLs or transcript text. Audit rows are application-controlled SQLite records, not externally immutable logs.

## Throttling and deployment

SQLite-backed limits persist across restart: 12 account attempts per 15 minutes for login/MFA/enrollment/reauth, six for recovery; a ten-attempt maximum per challenge; 200 attempts per direct peer IP per auth category/window. Expired counters are cleaned up. Hashing concurrency is capped at two. No caller-controlled forwarding header is trusted. Behind the current loopback proxies the IP limit is deliberately aggregate; account limits remain per user. Distributed edge/DDoS controls are outside this application change.

Set `RALLY_MFA_KEY` to a persistent cryptographically random 32-byte hex secret before startup; missing/invalid configuration fails before opening/migrating the database. Keep its secret configuration outside releases. Use the exact existing allowed origins and secure cookies. In this dated validation, npm dependencies were fetched through an authenticated package mirror on the laptop because the droplet could not resolve that mirror, then copied to the isolated server worktree. OTPAuth and node-qrcode implement TOTP and QR rendering; enrollment QR is generated locally, never sent to an external QR service.

Security worktree: `/srv/hackathon/rally-security`, branch `security/mfa-admin-20261030`, based on the latest reviewed streaming release history (`e779d8d`, runtime `c20261d`). Existing dirty WhatsApp/streaming worktrees were preserved. The existing AWS cached-opening correction is retained. GitHub main is not force-updated.

## Validation and limitations

- Backend security/integration suite includes legacy-session migration; closed signup; password-only denial; enrollment, TOTP replay, recovery and reset; role/reauth/disable controls; owner-only sharing, withdrawal, deletion and content audit; persistent throttles; pending capture cancellation.
- Frontend unit tests, both TypeScript checks and build.
- Actual browser account activation, enrollment, admin invitation/reset, session revocation, optional sharing and mobile admin checks using synthetic records.
- Full existing HTTP/SQLite/LiveKit browser workflow and actual streaming/Stop regression use synthetic model providers; zero paid calls or platform joins from these tests.
- Public HTTPS smoke passes after deployment: Secure/HttpOnly session cookie, enrollment across refresh, password-only denial, closed registration, owner isolation, public signaling and synthetic audio in both directions; temporary account removed. [Evidence](research/mfa-public-deployment-smoke-2026-10-30.json). It uses a temporary account and synthetic bidirectional media; it does not establish actual Teams admission, physical device audio or model accuracy.
- The Nexus audit reports existing Express high-severity metadata and lower-severity dependency findings with no automatic fix advertised. No claim of a complete vulnerability audit or zero dependencies at risk is made. Authentication dependencies did not replace the existing Express stack.

Primary references: [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [OTPAuth](https://github.com/hectorm/otpauth), [node-qrcode](https://github.com/soldair/node-qrcode).

## Deployed checkpoint

Application release `ca539a5` is active at the public base URL. Existing account/password and meeting records were preserved. SQLite and configuration backup: `/srv/hackathon/rally-deployed/backups/before-mfa-20261030T152640Z`, private permissions. `rally_admin` activation instructions were delivered to the owner’s local Downloads file; the server plaintext copy was removed. The first public smoke attempt hit the server-only DNS/SSH443 resolution path from Playwright’s separate HTTP client; the corrected operator script uses browser fetch through the public relay and passes. This script-only correction is in the security branch; runtime application code did not change or restart again.

71 backend tests and nine frontend tests pass, as do type checks/build, the full existing browser flow, streaming audio/Stop flow, and admin/MFA/sharing browser flow. Tests use synthetic model providers. No paid call, platform join or real transcript inspection occurred in this change. Default branch is not changed; the security branch also contains the prior streaming release history.
