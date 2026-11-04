# Judge quickstart

## Try Rally immediately

**https://rally.tail703f9e.ts.net/demo.html** requires no authentication, API key or microphone. This is the regular UI driven by a fictional, prerecorded sample. It demonstrates the workflow without accessing real meetings or making model calls. For an entirely local copy, from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory demo
```

Open http://127.0.0.1:8000/. Create a meeting, start its simulation, watch the transcript, ask Rally a scripted question, end the meeting and inspect its report/evidence/PDF export. The sample resets on reload. Sharing is simulated. This path needs no npm install.

## Run the real application with your own key

Use **Node 24 or later**, npm, Git, and Linux x64 (WSL2 is suitable for the baseline browser capture path). The automatic LiveKit installer also needs `tar` and outbound access to GitHub releases. A current Chrome/Edge browser is recommended. Native macOS/Windows require a separately installed compatible LiveKit binary via `LIVEKIT_BINARY`; they have not been tested for the full guest-Teams stack.

Clone `https://github.com/ejo4041/Rally`, then run these commands from its root. Install the locked dependencies with npm:

```sh
npm ci --prefix packages/living-silk
npm ci --prefix apps/rally-api
npm ci --prefix apps/rally-web
node scripts/init-local.mjs
npm run setup:media --prefix apps/rally-api
```

These commands use npm’s configured registry; a standard npm installation uses the public npm registry. If your organization requires a package mirror, use your approved npm configuration. No organization-specific npm registry or registry account is required by Rally. The LiveKit download is version-pinned and SHA-256 checked against its release checksums. Dependency versions and integrity hashes are pinned in each package’s committed lockfile.

`init-local` writes an ignored `.env.local`, generates a persistent random MFA encryption key and leaves model spending off. It refuses to overwrite existing configuration. Keep this file private and back up its MFA key with your database. Losing/changing the key invalidates existing encrypted authenticator secrets. On Windows-mounted filesystems, also protect the file with Windows access controls.

Before starting the API, invite your own administrator:

```sh
cd apps/rally-api
RALLY_ENV_FILE="$PWD/../../.env.local" RALLY_ACTIVATION_FILE="$PWD/.data/admin-invitation.txt" node scripts/admin.ts invite-admin judge_admin
cd ../..
node scripts/dev-rally.mjs
```

Open http://127.0.0.1:5173/. Choose **Activate or reset account**, use the username and activation code from `apps/rally-api/.data/admin-invitation.txt`, choose your password, enroll an authenticator and save recovery codes. The invitation expires in 24 hours. Delete the invitation file after activation. Registration is closed; additional users are invited through **Account → Administration**. There are no supplied judge passwords and no MFA bypass. Do not run the legacy seed command as an administrator bootstrap.

With processing disabled you can sign in and inspect the application; **Prepare with Muse and real transcription require the next step**. To enable genuine model calls, stop the launcher, edit `.env.local` locally:

```dotenv
MODEL_API_KEY=your_own_meta_model_api_key
RALLY_PAID_ENABLED=1
RALLY_REALTIME_ENABLED=1
```

Restart `node scripts/dev-rally.mjs`. Shell environment values override the file. Use a Meta Model API key entitled to **Muse Spark 1.3** and **Muse Voice Transcribe 1.0**. The server calls Meta's chat and realtime transcription endpoints; keys never go into the browser. Model availability and provider charges depend on your account. Default estimates cap each meeting at $2 and this database's total at $5; these are application guards, not a provider billing guarantee. Failed requests with unconfirmed costs pause further paid work until reconciled; avoid blindly retrying or raising limits.

Create a short agenda and click Prepare with Muse. Successful preparation is your first genuine reasoning check. Choose **microphone** or a **browser tab** and give consent, then speak a short test. Browser tab capture needs a tab with audio and the browser's “share tab audio” option; arbitrary desktop/system audio is not supported everywhere. Confirm finalized transcript text and evidence in the UI. End the meeting and inspect the report; unresolved owners/dates should stay unresolved. These checks make real provider calls and incur your own charges.

## Speech and Teams are optional extra integrations

The baseline key setup provides reasoning and transcription. It does **not** provision a speech model or a Teams video/audio participant. Use [MMS provisioning](../experiments/meta-mms/README.md) for the pinned local Meta MMS adapter and configure `RALLY_MMS_PYTHON`, `RALLY_MMS_MODEL_DIR` and `RALLY_MMS_ENABLED=1`. Model weights are downloaded separately and retain their model license. The hosted Seamless adapter requires an independently provisioned endpoint/token; the maintainer's infrastructure credentials are not distributed. Without speech provisioning, assess the text guidance and reports rather than expecting audible replies.

The Teams guest route additionally needs Linux Chromium/Playwright, PulseAudio virtual devices, and the video/media setup described in [current Teams transport](../apps/rally-api/src/teams-live.ts) and [rehearsal notes](teams-live-rehearsal-2026-10-30.md). Do not assume an unprivileged laptop can reproduce the deployed Linux media devices. Azure ACS and an Azure app registration are **not** prerequisites for this guest-client route. WhatsApp joining remains experimental; follow-up drafts are manual. Prefer browser microphone/tab capture for the first source evaluation.

## Validation and troubleshooting

The backend suite includes local Chromium checks for PDF rendering and Teams chat/leave behavior. Install the pinned Playwright browser before running the tests. On a minimal Linux system, Chromium also needs its [system libraries](https://playwright.dev/docs/browsers#install-system-dependencies); Playwright reports missing dependencies when it launches.

```sh
node apps/rally-api/node_modules/playwright/cli.js install chromium
npm run typecheck --prefix apps/rally-api
npm test --prefix apps/rally-api
npm run typecheck --prefix apps/rally-web
npm test --prefix apps/rally-web
npm run build --prefix apps/rally-web
```

The ordinary unit tests use fixtures and do not require a provider key. Browser/media/model smoke suites have separate prerequisites and may access devices or services; read their instructions before running them. `/api/health` on localhost:3001 checks API reachability, not provider or speech readiness.

- API rejects `RALLY_MFA_KEY`: generate config with init-local, or set a persistent random 32-byte hex value; never paste a shared example key.
- Prepared plan/transcription unavailable: check explicit paid/realtime flags, your key entitlement, budgets and network access. The public sample never invokes models.
- Existing config is elsewhere or source is an extracted archive: set `RALLY_ENV_FILE` to its absolute path. The launcher defaults to this checkout's root `.env.local`.
- API port 3001, web port 5173 or LiveKit port 7880 occupied: stop the previous local stack or configure `PORT`, `RALLY_WEB_PORT`, `LIVEKIT_PORT` and matching allowed origins before restarting.
- Stop the launcher with Ctrl+C before offline admin resets or changing the database. See the admin script's explicit `reset-admin` safeguards. Database and invitation files belong in ignored `.data/`.

Both development servers bind loopback. These instructions are for local evaluation, not an internet deployment recipe. HTTPS, secure cookies, restricted origins, service supervision, secrets management and firewall policy are separate deployment responsibilities.
