# Azure calling setup for Rally

The Teams participant bot is the priority. Phone-on-table open microphone and speaker TTS remains the browser fallback. User reaffirmed this ordering October 28, 2026.

**Current preference:** [app registration authentication setup](teams-app-registration-setup.md) is now implemented in the Linux runner. It uses a tenant ID, client ID, client secret and ACS endpoint instead of a shared resource connection string. It still needs an ACS resource and subscription. The connection-string instructions below remain a supported alternative.

Before requesting infrastructure, read [what we are connecting and the administrator brief](teams-admin-brief.md). ACS is the calling route selected for this Linux prototype, not a universal requirement for every Teams bot. Native Graph media bots use a different Windows-hosted architecture.

## Credential needed

### If Azure shows “Get $200 free credit / Manage access / Get free software”

User reported this welcome screen October 28, 2026. It suggests no accessible active subscription is selected; this is an inference from the described screen, not verified account state.

1. In the portal's top search box, search **Subscriptions** and open that service. If an active subscription is listed, use it. If an existing organization subscription is missing, check **Portal settings → Directories + subscriptions**, switch to the appropriate directory and check subscription filters. [Microsoft portal settings](https://learn.microsoft.com/en-us/azure/azure-portal/set-preferences).
2. If no subscription exists/access is available, the **Get $200 free credit** tile starts Azure free-account enrollment, subject to eligibility and Microsoft's terms. Complete that setup before creating ACS. These are Azure credits, separate from Meta's grant. [Azure account options](https://azure.microsoft.com/en-us/free/).
3. With an active subscription available, search **Communication Services**, select **Create**, choose the subscription/resource group, name the resource (for example `rally-teams`), choose its data location and complete creation. Then open the resource's **Keys** page. The ACS resource documentation requires an active subscription. [Microsoft ACS resource setup](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/create-communication-resource).

The “Manage access” and “Get free software” tiles do not create the ACS calling resource or supply its connection string.

Create/select an **Azure Communication Services** resource in the [Azure portal](https://portal.azure.com/), then open its **Keys** page and copy the **Connection string**. An active Azure subscription is required. [Microsoft resource setup](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/create-communication-resource).

Add the connection string to the existing ignored, mode-0600 file **`/srv/hackathon/repo/.env.local`**, keeping its Muse key and other settings:

```dotenv
AZURE_COMMUNICATION_CONNECTION_STRING="endpoint=https://YOUR-RESOURCE.communication.azure.com/;accesskey=YOUR-KEY"
```

Use the real value only in the file, never Markdown, chat, Git or frontend code. A Teams password, subscription ID or Muse key is not this credential. Server-side ACS Identity SDK uses the connection string to create a temporary identity and issue a VoIP token when a user explicitly invites Rally. It attempts to delete that identity when the test closes. No token/identity request occurs from merely opening Rally. [Microsoft identity/token documentation](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/identity/access-tokens?pivots=programming-language-javascript).

The runner reloads `.env.local` on its next poll, so adding this value does not require redeploying the Site. A temporary VoIP user token can instead be supplied in the Site's advanced connection setup for one test, but that expires and is not the preferred link-only workflow. The long-lived connection string stays on this server.

## Meeting prerequisites

Use a normal scheduled **work/school** Teams meeting link from `teams.microsoft.com`. The host tenant must permit anonymous joining; have a host present to admit **Rally audio test** from the lobby. Inform participants and obtain consent before starting the test. Azure call usage is separate from the $150 Meta grant. [Microsoft Teams interoperability](https://learn.microsoft.com/en-us/azure/communication-services/concepts/join-teams-meeting).

Current preview is a **three-minute connection test**, not a complete Teams moderator: join, lobby/connected status, incoming audio level, explicit leave and automatic timeout. Muse transcription/reasoning and speech output remain separate from this Teams transport until a real join/audio test passes. Existing browser/phone Rally continues to provide the live Muse meeting flow.
