# Security and privacy

Rally handles meeting transcripts, account credentials and model-service keys. Keep reports and reproduction material private when they contain real meeting data.

## Report a vulnerability

Use the repository's **Security → Report a vulnerability** option if private reporting is enabled. Otherwise, contact the maintainers through the private channel you already use for repository access. Do not put credentials, real transcripts, meeting invitation links or exploit details in a public issue. There is no promised response SLA or bug bounty.

Include the affected revision, the feature involved, a minimal reproduction using fictional data, expected impact and any workaround. Avoid testing against other users' accounts or meetings.

## Scope and configuration

The current code under `apps/rally-api/` and `apps/rally-web/` is the active implementation. Historical experiments are not independently supported deployments.

The full app uses invitation-only registration, MFA, rate limits and owner-isolated meeting access. Report sharing grants a named account read access and can be revoked. Optional developer-feedback sharing is a separate opt-in; see [account/privacy behavior](docs/mfa-admin-judge-audit.md).

The portable sample uses fictional data and an in-memory API substitute. Its content policy blocks network model/API connections; it cannot access real meetings. Its report-sharing controls are demonstrations.

Keep API keys and the persistent MFA encryption key in private, ignored configuration. Local development binds to loopback. Internet hosting requires its own HTTPS, secure cookies, restricted origins and firewall configuration; the local setup guide is not a production deployment recipe. Model charges and infrastructure costs belong to the configured operator account.
