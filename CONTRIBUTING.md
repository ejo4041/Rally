# Contributing to Rally

Thanks for helping make meetings more useful. Start with the [architecture overview](docs/architecture-overview.md) and [local setup](docs/judge-quickstart.md). Use the dependency-free `demo/` sample to explore before configuring real model access.

## A small, reviewable change

1. Branch from current `main`, for example `fix/report-export` or `feature/meeting-controls`. Use a separate worktree when sharing a host with other developers.
2. Keep the change focused. Preserve meeting ownership, account isolation, host controls and explicit opt-ins for capture and speech.
3. Add meaningful regression coverage for changed behavior. Describe fixture tests separately from real model or meeting checks.
4. Update the relevant guide when behavior or setup changes, and open a pull request with the supplied template.

After dependencies are installed, run:

```sh
npm run typecheck --prefix apps/rally-api
npm test --prefix apps/rally-api
npm run typecheck --prefix apps/rally-web
npm test --prefix apps/rally-web
npm run build --prefix apps/rally-web
python3 scripts/check-repo-docs.py
```

Dependency installs follow the registry configuration in the setup guide. Rally runs from a source checkout; contributing does not require publishing a package to a registry. Keep existing lockfiles and package authentication settings intact.

The unit suites use fixtures. Integration tests may need Chromium, native media devices, models or paid service access; read the script before running it. Never use a production database for test setup. Shared-droplet browser checks must use the resource limits in [AGENTS.md](AGENTS.md).

## A useful issue or pull request

Describe the goal, exact steps, expected behavior and actual result. Include browser/OS, whether this was the simulated sample or the real application, and the smallest reproducible example. State what you tested and what remains unverified. Use fictional names, agendas and transcripts in screenshots or GIFs. Keep keys, credentials, invitation URLs, private logs and real meeting data out of issues and commits.

For security issues, follow [SECURITY.md](SECURITY.md) instead of filing a public issue. For larger features, start a discussion in an issue before implementing a broad redesign.

## Documentation and media

The [documentation index](docs/README.md) separates user/developer guides from dated engineering records. Add links to an existing authoritative guide rather than duplicating operating instructions. Screenshots in `docs/assets/` use only the synthetic sample; record provenance and make edited timing explicit. Preserve earlier numbered demo-video exports unless an owner explicitly requests a replacement.

Attribution and licensing are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Do not add a license badge or change third-party/model licenses by assumption.
