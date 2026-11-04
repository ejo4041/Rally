# Rally web

The current TypeScript frontend shares its interface between the authenticated full application and an isolated fictional public sample.

Follow the [judge quickstart](../../docs/judge-quickstart.md) to run both servers, activate your invited administrator with MFA and enable your own API key. There is no open signup. For immediate evaluation without installation or credentials, use [the hosted sample](https://rally.tail703f9e.ts.net/demo.html) or serve the root `demo/` directory with Python.

From this directory after installing locked dependencies with npm:

```sh
npm run typecheck
npm test
npm run build
```

`npm run dev` serves the web UI on loopback port 5173 and proxies `/api/` to the local backend. The root launcher starts API/media and frontend together. Browser tests require installed Playwright Chromium and its OS dependencies; each script documents its fixture prerequisites.

Real microphone/browser-tab capture, paid model inference and Teams transport belong to the full application. The public sample uses authored text and prerecorded voices, performs no model calls, and cannot reach private meetings. Its sharing controls are in-memory demonstrations. Demo provenance is in [`demo/provenance.json`](../../demo/provenance.json).
