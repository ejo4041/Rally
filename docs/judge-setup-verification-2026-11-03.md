# Judge setup verification

## Clean installation verified — November4

Revision409c761, Linux x64/WSL, Node24.19.0, npm11.17.0. This was a new public HTTPS clone with a new, initially empty npm cache and no copied or symlinked node_modules. The three documented installs succeeded:9packages in Living Silk,165in the API,24in the web app. Downloads used the workstation’s configured approved package mirror; direct public-registry network access was not independently exercised. The repository does not require a particular organization’s registry.

The documented init-local command generated private, ignored configuration/MFA key with model spending off. The pinned LiveKit1.13.11download/checksum installation passed. The administrator invite command generated a private activation file. The root launcher started web5173, API3001 and LiveKit7880; web/API health returned200.

A real browser exercised activation, TOTP enrollment and recovery-code issuance, confirmed the administrator role and Account → Administration, created a draft meeting, verified that missing key/paid-processing setup blocks Join with an explanation, and required MFA again after sign-out/password login. Anonymous meeting API access was denied. No browser page errors. Only generated local fixture accounts/data were used; no production database or live credentials were copied into this checkout.

Both TypeScript checks and the web build passed. Backend165/165and web26/26tests passed after installing the pinned Playwright Chromium. The initial backend run passed162and failed3solely because Chromium had not been installed. README/API/setup validation instructions now include the missing browser prerequisite. Browser system libraries were already available on this workstation; a bare OS image was not provisioned.

No paid provider calls, real audio-capture/transcription, model-backed reports, speech-model provisioning or real Teams join were exercised by this installation check. The sample’s synthetic browser flow has separate passing evidence. These results establish a clean full source install/startup/authentication, not a fully provisioned talking meeting bot. The prior claim that all API dependency testing reused an existing installation is superseded for this environment by this check; historical results below remain preserved.

# Earlier setup checks — November 3

Branch: `docs/judge-ready-video06`, isolated checkout on the droplet. Production application/UI unchanged.

- Node 24.22.1; ordinary fixture suites: API 165/165, web 26/26; both TypeScript checks and frontend build passed.
- Frontend and Living Silk `npm ci --offline` succeeded with the required Nexus registry. Initially omitted Living Silk installation caused missing Three.js types; adding its separate locked install fixed the clean frontend build. API offline install failed on uncached yargs-parser; backend dependencies were copied from an existing checkout for subsequent checks. Network-fresh API installation remains unverified.
- Actual pinned LiveKit 1.13.11 download and checksum verification succeeded.
- init-local generated a fresh private configuration and persistent MFA key without displaying it. Admin CLI generated a private one-time invitation. A separate loopback development stack returned health OK and HTTP 200 for the frontend. Its real HTTP activation/enrollment endpoints accepted the invitation, required TOTP enrollment and returned the expected local administrator identity; unauthenticated meeting access was denied. No shared password or authentication bypass was added.
- All first-run data used an ignored, separate database. No production database was opened/migrated by the bootstrap test. The temporary stack was stopped after verification. No paid provider calls were made; real key entitlement, transcription/reasoning availability and full Teams/speech provisioning are not established by these tests.
- Anonymous GitHub URL returned 404. Public source access remains an owner visibility decision. License/asset status is retained in source-release-readiness.md.


## November4 portability update

The public setup guide now uses standard npm commands and the API lockfile uses canonical public package URLs, preserving every version and integrity hash. A fresh anonymous HTTPS clone and the exact Python-only quickstart were exercised locally: home, completed report/source highlighting, new meeting/consent, simulated transcript, Ask Rally and End/report all passed without npm installation, credentials or provider calls. This sample check does not establish a fresh full API install with real model credentials. The earlier cached-dependency test limits remain historical evidence.
