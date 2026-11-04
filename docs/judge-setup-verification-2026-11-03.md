# Judge setup verification — November 3

Branch: `docs/judge-ready-video06`, isolated checkout on the droplet. Production application/UI unchanged.

- Node 24.22.1; ordinary fixture suites: API 165/165, web 26/26; both TypeScript checks and frontend build passed.
- Frontend and Living Silk `npm ci --offline` succeeded with the required Nexus registry. Initially omitted Living Silk installation caused missing Three.js types; adding its separate locked install fixed the clean frontend build. API offline install failed on uncached yargs-parser; backend dependencies were copied from an existing checkout for subsequent checks. Network-fresh API installation remains unverified.
- Actual pinned LiveKit 1.13.11 download and checksum verification succeeded.
- init-local generated a fresh private configuration and persistent MFA key without displaying it. Admin CLI generated a private one-time invitation. A separate loopback development stack returned health OK and HTTP 200 for the frontend. Its real HTTP activation/enrollment endpoints accepted the invitation, required TOTP enrollment and returned the expected local administrator identity; unauthenticated meeting access was denied. No shared password or authentication bypass was added.
- All first-run data used an ignored, separate database. No production database was opened/migrated by the bootstrap test. The temporary stack was stopped after verification. No paid provider calls were made; real key entitlement, transcription/reasoning availability and full Teams/speech provisioning are not established by these tests.
- Anonymous GitHub URL returned 404. Public source access remains an owner visibility decision. License/asset status is retained in source-release-readiness.md.


## November4 portability update

The public setup guide now uses standard npm commands and the API lockfile uses canonical public package URLs, preserving every version and integrity hash. A fresh anonymous HTTPS clone and the exact Python-only quickstart were exercised locally: home, completed report/source highlighting, new meeting/consent, simulated transcript, Ask Rally and End/report all passed without npm installation, credentials or provider calls. This sample check does not establish a fresh full API install with real model credentials. The earlier cached-dependency test limits remain historical evidence.
