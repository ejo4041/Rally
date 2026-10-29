# App registration fit for Rally's Teams participant

Verified October 28, 2026 against Microsoft documentation and the installed ACS Identity SDK 2.0.0 declarations. Research only: no Entra application, Azure resource, permission assignment, credential request or real meeting join was performed. No Muse cost.

**Subsequent implementation:** The root task added and tested the app-auth adapter. Proposed credential support below is now implemented; [current setup/evidence](../teams-app-registration-setup.md) is authoritative for executable readiness. No real Azure authorization or meeting join has been established.

## Decision supported by the evidence

An **Entra app registration plus an ACS resource** can authenticate the current Linux/browser design without a shared ACS resource key. An **app registration alone does not provide live meeting audio**. A native Graph calling bot is a separate Windows/.NET media-host design.

The first option preserves our existing receive/send MediaStream architecture and independent server participant. It changes how the server obtains ACS VoIP user tokens, not how meeting audio flows. Actual tenant access, headless ACS calling, live input/output, cancellation and speaker handling remain unverified. Do not claim this authentication change alone proves every Rally requirement.

## Option A: App registration authenticates ACS Identity SDK

Microsoft's ACS authentication matrix accepts Microsoft Entra authentication for the **Identity SDK**; the browser **Calling SDK** still takes an ACS user access token. The backend exchanges its app identity for permission to create ACS identities/tokens, then hands only a short-lived calling token to the isolated participant browser. [ACS authentication](https://learn.microsoft.com/en-us/azure/communication-services/concepts/authentication).

Official JavaScript SDK documentation demonstrates `CommunicationIdentityClient(endpoint, TokenCredential)`. `ClientSecretCredential` is a TokenCredential implemented by Azure Identity using app-registration credentials. The installed `@azure/communication-identity` 2.0.0 `dist/commonjs/communicationIdentityClient.d.ts` confirms that constructor overload and `createUserAndToken(scopes, options)` / `deleteUser(user, options)`. [Identity SDK](https://learn.microsoft.com/en-us/javascript/api/overview/azure/communication-identity-readme?view=azure-node-latest), [Azure Identity service-principal authentication](https://github.com/Azure/azure-sdk-for-js/blob/main/documentation/using-azure-identity.md#clientsecretcredential-and-clientcertificatecredential).

Proposed server configuration (names only; secrets belong in ignored `/srv/hackathon/repo/.env.local`):

```dotenv
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_COMMUNICATION_ENDPOINT=https://YOUR-RESOURCE.communication.azure.com/
```

The secret must be its **Value**, not its secret ID. The endpoint belongs to an existing/provisioned ACS resource. An Azure subscription and resource remain prerequisites even with app registration. Microsoft's service-principal quickstart explicitly requires both and documents tenant/client/secret configuration. [Service-principal quickstart](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/identity/service-principal?pivots=platform-azcli).

Proposed administrator steps:

1. Create a single-tenant Entra app registration for Rally in the organization that will authorize the ACS resource. A server client-credentials flow does not need a browser redirect URI.
2. Create a suitable client secret, or choose certificate credentials if required by organizational policy. Record tenant ID, application/client ID and secret Value securely.
3. Provision/select an approved ACS resource in an existing suitable Azure subscription.
4. On **that ACS resource → Access control (IAM)**, assign the application's service principal an approved Azure RBAC role for ACS Identity operations. Allow propagation time before testing.
5. Supply the four server configuration values above; keep secrets out of the Site's frontend and chat. The runner needs explicit credential support added before these fields work.

This ACS BYOI calling route does not call Microsoft Graph to read calendars or join as a Graph bot. Therefore **Graph `Calls.*`, `OnlineMeetings.*` and organization-wide calendar/email permissions are not needed for the selected token-generation design**. This conclusion follows from the ACS token/client architecture; it is not a general statement about every Teams integration. The resulting participant is an external/anonymous meeting participant, subject to anonymous-join policy and lobby admission. [Teams interoperability and client behavior](https://learn.microsoft.com/en-us/azure/communication-services/concepts/join-teams-meeting).

## RBAC: supported role versus unproven minimum

Microsoft's service-principal **Identity** quickstart uses the built-in **Contributor** role. Its sample assigns subscription scope; for Rally, assign at the **single ACS resource scope** instead. Contributor is a documented prototype-compatible choice, but is broader than token issuance/deletion and should not be described as the minimum role. An administrator with appropriate role-assignment authority must approve it. [Identity quickstart](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/identity/service-principal?pivots=platform-azcli).

The official permission catalogue lists `Microsoft.Communication/CommunicationServices/Read`, `/Write`, `/Delete`, `/ListKeys/action` and other resource operations; it does not establish separate minimal Identity-specific actions for `createUserAndToken` and `deleteUser`. **Exact least-privilege custom-role permissions for these two operations were not established by this research.** Do not invent Identity DataActions or copy email-only permission recipes as verified calling permissions. [Microsoft.Communication permission catalogue](https://learn.microsoft.com/en-us/azure/role-based-access-control/permissions/integration#microsoftcommunication).

Microsoft also documents the **Communication and Email Service Owner** built-in role for SMTP. That source confirms the role exists, not that it is the verified least-privilege Identity SDK role. If the administrator prefers a narrower built-in/custom role, confirm its actual token-create/delete authorization in an explicit controlled identity test. [Official SMTP role documentation](https://learn.microsoft.com/en-gb/azure/communication-services/quickstarts/email/send-email-smtp/smtp-authentication?tabs=built-in-role).

## Option B: Native Graph bot using app registration

The native bot path requires app registration/calling bot configuration plus relevant Graph calling permissions. Microsoft documents application permissions with administrator consent and also meeting/chat resource-specific permissions. Registration alone does not implement media handling. [Calling bot registration](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/registering-calling-bot).

For application-hosted raw audio, Microsoft's media SDK requires **C#/.NET and Windows Server**. Production hosting is Windows Server in Azure; non-production Windows Server on premises is documented. Node.js and C++ do not provide that real-time media access. The existing Ubuntu server cannot run that native media stack without a separate supported Windows host. [Media-bot requirements](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/requirements-considerations-application-hosted-media-bots).

## Recommendation

If the user means familiar app-registration **authentication**, support Option A while clearly retaining the ACS resource prerequisite. If the intent is **no ACS/subscription setup**, do not present Option A as meeting that requirement; discuss the native Windows hosting and bot registration requirements explicitly before switching architecture. Neither option is a proven real-meeting Rally integration yet. The phone/browser mode remains the fallback; Teams participant remains the user's stated priority.
