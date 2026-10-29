# Teams SDK and virtual audio spike

Installed October 28, 2026. Isolated from the deployed Rally application; no product deployment changed.

**Follow-up:** The [Rally Site now exposes server-side join controls](../../docs/research/teams-site-integration.md) using this browser harness plus `runner.mjs`. `rally-teams-runner.service` is active with user lingering enabled; Node and browser shared libraries live under `/srv/hackathon/tools/`. The runner polls the Site and reloads root `.env.local` each time. Add `AZURE_COMMUNICATION_CONNECTION_STRING` there for automatic temporary ACS token generation; [credential setup](../../docs/teams-setup.md). Current state is online but unconfigured, with no real Teams join. The standalone spike instructions below remain useful for local reproduction.

**App registration:** The runner also supports `AZURE_COMMUNICATION_ENDPOINT`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` through `auth.mjs`. [Preferred setup](../../docs/teams-app-registration-setup.md). An ACS resource is still required. `npm run test:auth` exercises the real SDK against a local injected transport without Azure/Muse calls. Partial app setup cannot silently fall back to a shared key.

Use **Azure Communication Services Calling SDK**, not TeamsJS, for browser-based Teams meeting media. Pinned Calling SDK 2.0.0 and communication-common 2.5.0 are installed in this directory's ignored `node_modules`, with a reproducible lockfile. The native Graph media SDK requires Windows Server and cannot run natively on this Ubuntu server. See [Microsoft platform research](../../docs/research/teams-sdk-platform-verification.md).

## Reproduce the local test

Requires Node 24+, Playwright Chromium and its Linux shared libraries:

```bash
cd /srv/hackathon/repo/experiments/teams-audio
export PATH="/tmp/rally-node/bin:$PATH"
npm ci --ignore-scripts
npm run build
LD_LIBRARY_PATH=/tmp/rally-browser-libs/unpacked/usr/lib/x86_64-linux-gnu npm test
```

Temporary Node/browser-library paths are specific to this development session and can disappear. For a fresh supported machine use a normal Node installation and `npx playwright install --with-deps chromium` with appropriate OS package permissions. The test starts its own loopback HTTP server and shuts down server/browser afterward; it blocks external page requests, uses no credentials and makes no model calls. Raw local results go to ignored `test-results/local-probe.json`. Last measured results and evidence boundaries are [saved in Markdown](../../docs/research/teams-sdk-local-spike.md).

## What the probe establishes

- Browser loads the actual ACS SDK; constructs `CallClient` and `LocalAudioStream` from a generated MediaStream and retrieves its track.
- Two local WebRTC peers exchange distinct 440 Hz and 880 Hz signals simultaneously.
- Receive and transmit remain isolated; output Stop silences the transmit channel while receive continues.
- These use browser virtual streams, without PulseAudio, a physical sound card or an OS virtual speaker/mic.

It does **not** call ACS to authenticate, join Teams, test a tenant, measure Teams network latency, send speech to a person, or connect the Muse pipeline. Chromium headless is empirical prototype evidence, not Microsoft's certified Chrome support.

## Prepared real-meeting harness — not run yet

```bash
npm run build
node serve.mjs
```

The page is at **http://localhost:4178**. Use the literal `localhost`: installed SDK rejected `http://127.0.0.1` as an insecure origin despite browser secure-context treatment. Keep the server bound to loopback. For a browser on another computer, forward the port via SSH or deliberately host an authenticated HTTPS service; a laptop browser would run the client on the laptop, not prove media works on this server. To prove the server path, use the page inside server Chromium through a controlled runner/remote browser.

The harness requires an **ACS user access token with voip scope**, a normal **work/school Teams meeting URL**, consenting participants, anonymous join enabled and a host to admit Rally. A Teams/Microsoft login or Muse API key is not an ACS token. Token is password input, held in memory and cleared from the field; it is not written to localStorage or source. Do not paste a long-lived Azure connection string into this page or chat. Obtain a short-lived user token using the ACS identity service/dashboard; resource provisioning and account entitlement remain untested.

Joining may incur Azure charges, separately from Meta credits. The harness leaves after three minutes including lobby/connection time; explicit Leave is also available. No auto-retry. Join display name is `Rally audio test`. It exposes incoming stream level and can send a supplied short speech clip through its custom stream; Stop ends the clip without muting receive. No recording, voice identity, Muse forwarding or production recovery is implemented. Verify departure in the meeting roster if connectivity fails.

Browser `speechSynthesis` does not produce a MediaStream, and this server browser returned zero voices. Use an audio-producing TTS service/PCM clip for eventual speech output, or separately prove OS audio loopback. Installing the SDK alone does not make existing browser Rally speech speak into Teams.
