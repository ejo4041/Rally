# Rally API — hackathon backend

A separate Node 24 / TypeScript / Express / SQLite backend with local LiveKit audio. It does not modify or deploy the existing Sites application.

```bash
npm ci
npm run setup:media
npm run seed    # first set RALLY_DEMO_PASSWORD in shared local secrets
npm run dev
```

The default API is `http://127.0.0.1:3001`; LiveKit is `ws://127.0.0.1:7880`. `npm start` starts only the API when a media server already runs. Use Node 24 with npm on PATH. This host currently has a complete distribution under `/tmp/rally-node-download/node-v24.22.1-linux-x64/bin`; the API itself does not depend on that location.

Secrets load from the primary Git checkout's ignored `.env.local`, found through the common Git directory. `RALLY_ENV_FILE` overrides the path. Process environment takes precedence. No secrets are copied into worktrees. For exported source without Git, explicitly supply that variable or environment values. The SQLite database defaults to this package's ignored `.data/rally.sqlite`.

Paid calls default off. Set `RALLY_PAID_ENABLED=1` to enable real Muse processing. Without it, accounts/history work and meeting creation returns a draft with a visible preparation error. No scripted data is substituted for model output. Manually provided plans are supported, but starting ASR still requires real provider access.

Default seed users are `demo` and `demo2`; passwords come only from `RALLY_DEMO_PASSWORD`. Existing users are never reset by seeding.

## Configuration

| Variable | Default |
| --- | --- |
| `PORT`, `RALLY_HOST` | `3001`, `127.0.0.1` |
| `RALLY_DB_PATH` | `.data/rally.sqlite` |
| `RALLY_ALLOWED_ORIGINS` | localhost/127.0.0.1 frontend on port 5173, comma separated |
| `RALLY_SECURE_COOKIES` | `0`; set `1` for HTTPS |
| `LIVEKIT_URL` | `ws://127.0.0.1:7880` |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit's local-development placeholders |
| `LIVEKIT_PORT`, `LIVEKIT_BINARY` | `7880`, `.data/bin/livekit-server` |
| `RALLY_ASSESSMENT_MS`, `RALLY_COOLDOWN_MS` | `10000`, `60000` |
| `RALLY_CAPACITY` | `5` |
| `RALLY_MEETING_BUDGET`, `RALLY_BUILD_BUDGET` | `$2`, `$5` cumulative for this database |
| `RALLY_MODEL_CONFIG` | Existing capability config, plus optional `report` effort/token settings |

Use separate API/media ports and databases for worktrees. The launcher binds LiveKit to loopback with development credentials; it is not a production hosting recipe. Run a single API process per database.

## Checks

```bash
npm run typecheck
npm test
npm run test:media  # local synthetic browser/Node audio; no model calls
```

`test:media` uses Playwright Chromium. Override `PLAYWRIGHT_CHROMIUM` and, if required, `LD_LIBRARY_PATH` for another host. It launches its own temporary LiveKit server, tests real browser↔Node audio and data, and stops owned processes. It does not prove physical microphone/speaker behavior.

`npm run test:muse` is separately gated by `RALLY_SMOKE_APPROVED=1`, uses a licensed PCM fixture via `RALLY_SMOKE_PCM`, and enforces a $0.15 batch cap in an isolated database. It is never run by `npm test`. Reconcile its `test-results/muse-*/usage.json` into the central ledger after each run.

See [API contract](../../docs/backend-api.md), [AI processing](../../docs/ai-processing.md), [plan](../../docs/backend-plan.md), and [implementation evidence](../../docs/backend-implementation-status.md).
