# Rally API

Node 24 backend: closed-registration accounts and MFA, owner-isolated meetings, LiveKit capture, Meta reasoning/transcription, optional speech, Teams transport, and evidence-linked reports.

**Start with the [judge quickstart](../../docs/judge-quickstart.md)** for installation, persistent MFA-key generation, administrator invitation and your own Meta API key. Do not use the historical demo seed as an administrator bootstrap. Processing defaults off; public signup is disabled.

Run local commands from this directory after following that guide:

```sh
npm run setup:media
npm run dev
npm run typecheck
npm test
```

Use the Nexus registry for installs as documented in the quickstart. `npm run dev` starts a loopback LiveKit instance and the API. The root `node scripts/dev-rally.mjs` starts the frontend too. API defaults to 127.0.0.1:3001; LiveKit to 127.0.0.1:7880. SQLite lives in ignored `.data/`. `RALLY_ENV_FILE` selects an explicit configuration file; the combined launcher defaults to its own checkout's `.env.local`.

`npm run test:media` and `npm run test:muse` are separate integration checks with service/device or paid-call prerequisites. Ordinary tests use fixtures. See [API contract](../../docs/backend-api.md), [model interfaces](../../docs/model-interfaces.md), and [current handoff](../../docs/handoff.md) for details and deployment verification boundaries.
