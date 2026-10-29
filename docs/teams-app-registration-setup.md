# Rally app registration setup

**Scope:** These instructions apply to the ACS SDK runner only. The [normal Teams browser-client test](research/teams-web-client-spike.md) successfully joined with two-way audio as a guest and needs no custom app registration or ACS resource. Its integration with the Rally moderation loop remains pending.

October 28, 2026. User requested app registration if it meets Rally's needs. Selected implementation: **Entra app registration authenticates the existing ACS/Linux runner**. A question distinguishing this from the Windows-native bot option remains unanswered as of this checkpoint; no Windows infrastructure or Graph bot was provisioned. This is a compatible authentication change, not proof of real Teams audio or an option that eliminates ACS.

## What this supports

The runner now accepts app registration credentials to create short-lived ACS calling tokens. It retains the browser's custom audio input/output APIs and same Site join controls. App authentication is implemented and locally verified; actual authorization, Teams admission, audible audio, Muse forwarding and TTS still need staged real-service verification. The currently hosted transport preview remains three minutes and does not enable Muse/TTS inside Teams.

An ACS resource in an active Azure subscription is **still required**. It can be in an approved existing subscription. The application identity grants permission to use that resource; it does not replace the calling service. [Microsoft ACS service-principal setup](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/identity/service-principal?pivots=platform-azcli).

## Steps you can perform in app registrations

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/), then **Identity → Applications → App registrations → New registration**. Portal navigation can vary; searching App registrations also works.
2. Name it **Rally Hackathon**. Choose **Accounts in this organizational directory only**. This server-side client-credentials flow does not need a redirect URI.
3. From its Overview page, copy **Directory (tenant) ID** and **Application (client) ID**.
4. Open **Certificates & secrets → Client secrets → New client secret**. Choose a suitable expiration covering the event under your organization's policy. Copy the secret's **Value**, not its Secret ID. The runner currently implements client-secret authentication; certificate authentication is not implemented.
5. Do not add Microsoft Graph calling/calendar permissions for this ACS external-participant route. It authenticates to the ACS Identity service and needs Azure resource permissions instead. The app registration does not itself need a Teams user license for this external-participant design. [ACS authentication](https://learn.microsoft.com/en-us/azure/communication-services/concepts/authentication), [Teams interoperability](https://learn.microsoft.com/en-us/azure/communication-services/concepts/join-teams-meeting).

## Step for whoever controls Azure resources

Create/select an **Azure Communication Services** resource, then open **Access control (IAM) → Add role assignment**. Assign an approved role to the enterprise application/service principal corresponding to Rally Hackathon, at **this single resource's scope**.

Microsoft's ACS Identity service-principal quickstart uses **Contributor**. That is the documented prototype-compatible role, but broader than token creation/deletion; do not grant subscription-wide Contributor on our behalf. Exact minimal custom-role permissions have not been established here. If your administrator uses a narrower approved role, verify that it allows both identity/token creation and identity deletion in an explicit test. See [role research and sources](research/teams-app-registration-fit.md).

Copy the ACS resource's HTTPS **Endpoint** from its Overview/Keys page. The shared access key is not needed for this authentication mode.

## Store four values on the server

Add these to **`/srv/hackathon/repo/.env.local`**, keeping existing Muse and runner settings:

```dotenv
AZURE_COMMUNICATION_ENDPOINT="https://YOUR-RESOURCE.communication.azure.com/"
AZURE_TENANT_ID="YOUR-DIRECTORY-TENANT-ID"
AZURE_CLIENT_ID="YOUR-APPLICATION-CLIENT-ID"
AZURE_CLIENT_SECRET="YOUR-SECRET-VALUE"
```

Do not paste real secrets into chat, Markdown, frontend JavaScript or Git. The runner reloads the file on each poll. This public-Azure prototype validates that the endpoint is an HTTPS resource endpoint under `communication.azure.com` without credentials, query parameters or a non-root path. Sovereign-cloud endpoints would require a separate authentication/endpoint update.

Presence of any app-registration setting selects this mode. Missing/invalid settings mark the runner unconfigured; it **does not fall back silently** to an old connection string or static token. All four fields are required. Complete configuration is only readiness, not verified permission; invalid secrets, expired secrets and missing RBAC will still cause the explicit connection test to fail. Browser-entered temporary calling tokens remain an explicit per-test alternative.

## Then test in order

1. Confirm the Site reports the server online and Azure calling configured. No token request happens from opening the Site alone.
2. Allow any new role assignment to propagate.
3. With consent, paste a normal work/school Teams meeting URL and invite Rally. Host admits **Rally audio test**. Anonymous external joining must be allowed.
4. Verify connected state, incoming audio, clean departure and Azure usage. Only then connect Muse/transcription and rendered speech output to this Teams transport. Phone-on-table browser Rally remains the fallback; participant bot remains the priority.

Azure billing is separate from Meta credits. No real Azure login, token issuance or Teams join has been performed as part of adding this authentication support.

## Implementation and checks

- Auth module: `experiments/teams-audio/auth.mjs`; runner uses it for both readiness and identity creation.
- Pinned Azure Identity **4.13.0**, ACS Identity **2.0.0**. Initial Azure Identity 4.14.0 introduced an MSAL advisory; 4.13.0 avoids that affected MSAL major version. Its transitive UUID dependency is overridden to **11.1.1** to resolve the separate UUID advisory. Final dependency audit reports **zero known vulnerabilities**. Do not run an indiscriminate audit-fix upgrade that reverses this choice.
- `npm run test:auth`: two tests pass, covering partial/invalid setup, no silent fallback, actual ACS SDK bearer request serialization, VoIP scope and delete cleanup through a local injected HTTP transport. No real Azure requests occur.
- Actual ClientSecretCredential + CommunicationIdentityClient construction succeeds with fixture settings; no token request sent.
- No Site source/deployment change is required: its existing job/readiness contract works with the updated runner.
- This task's Muse cost **$0**; last reconciled total **$0.07461610**, conditional remainder **$149.92538390**, assuming full $150 grant and no other usage. Actual grant/Billing and intervening hosted usage remain unverified.

For background or administrator discussion: [plain-language architecture and brief](teams-admin-brief.md).
