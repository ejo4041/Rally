# Rally in Microsoft Teams — implementation spike plan

Researched October 28, 2026. Documentation only: no account creation, meeting join, API call, purchase, deployment, or tenant change. The user already has a working Teams meeting environment; this plan supplies a participant/media path, not a new Teams deployment.

**Follow-up:** The user subsequently requested a Microsoft SDK installation/server virtual-audio spike. ACS Calling SDK is now installed in an isolated experiment and local duplex audio passes; real Teams join is still pending credentials/meeting admission. This adds a direct Microsoft browser option alongside the managed-provider recommendation below. See [local spike](teams-sdk-local-spike.md) and [platform verification](teams-sdk-platform-verification.md).

## Recommendation

Keep the browser meeting loop as the committed demo. When its speech/playback behavior is reliable, try **Recall Output Media** first as a transport adapter, with **Meeting BaaS raw bidirectional streaming** as the one alternative. This ordering is an engineering judgment: Recall can run a Rally-controlled webpage, while Meeting BaaS offers a more direct PCM bridge but adds another transport integration. Neither path has been tested by this team.

Use Muse transcription and Spark moderation in both. Do not replace Muse with a vendor's built-in transcription or hosted voice-agent brain merely because its sample app does so.

## Shortest Recall path and prerequisites

Recall documents ordinary Teams Web meetings working without additional platform setup. Bots normally wait in the lobby for admission; organization policy still controls entry. Direct calls, breakout rooms, registration-required meetings, Town Halls and GCC High are unsupported. Use an ordinary scheduled meeting hosted in the user's existing environment. [Recall Teams overview](https://docs.recall.ai/docs/microsoft-teams)

Create Bot accepts `meeting_url` and `bot_name`, so a meeting join URL and `Rally` are sufficient to identify the target/name; no calendar integration is needed for this spike. For production scheduling Recall recommends `join_at` at least ten minutes ahead. Use lifecycle webhooks rather than polling. A crucial unrelated default: Recall's own accuracy-first transcription can lag 3–10 minutes. Do not enable that path; send raw audio to Muse. [Create Bot reference](https://docs.recall.ai/reference/bot_create)

Required before a real test:

- A provider account/key with accessible region and bot allocation. Neither exists in the current session.
- A standard Teams join URL, host present to admit Rally, and consenting participants.
- A reachable HTTPS Rally output webpage and backend/WebSocket endpoint. No public deployment or tunnel has been created.
- A verified browser/PCM speech-output adapter. A working laptop `speechSynthesis` voice does not establish that the managed bot browser has a voice installed.
- Explicit retention configuration and separate provider-cost tracking.

## Live media and important constraints

Output Media runs a webpage whose audio/video goes into Teams. Its `getUserMedia()` supplies mixed meeting audio without the bot's own output; use that input for Muse to avoid feedback. It is **not audio-only**: the webpage video remains present. Show an agenda/status tile. Output Media cannot run concurrently with the separate Output Audio endpoint. The vendor claims under 50 ms added output transport latency; that is not a Rally measurement. Hosted speech voices and actual interruption behavior still need testing. [Output Media guide](https://docs.recall.ai/docs/stream-media)

Recommended control design: a host override invalidates the current utterance ID, clears synthesis/media playback and queued buffers on the output page, and suppresses late model results. Preserve input capture so a human's next statement is heard. This is Rally application logic; do not equate muting input with stopping output. Use the provider's stop-output operation as an emergency fallback, not proof of subsecond cancellation. The acceptance target remains measured audible stop within 500 ms; network delivery can affect it.

Keep Muse keys on Rally's backend. A per-meeting short-lived page token can authorize the bot page; the page relays audio to that backend. Do not put the long-lived Muse or provider key in its URL/JavaScript. This is a proposed integration boundary, not implemented code.

## Current documented provider cost

Recall advertises $0.50/bot-hour Standard PAYG and the first five recording hours free. Four-core bots add $0.10/hour; GPU adds $1/hour. Transcription is separately priced, and storage has separate retention charges. These advertised allowances do not establish our entitlement or whether every upgrade is covered. No startup discount is assumed for an Indie entry. [Recall pricing](https://www.recall.ai/pricing)

Bot usage includes active time from `joining_call` to a terminal state, including lobby time and in-call time without recording. Configure finite waiting-room and idle timeouts and explicitly leave. Do not estimate cost from transcript duration alone. [Usage calculation](https://docs.recall.ai/docs/calculating-usage)

Illustrative **forecasts**, without free-hour offsets: a ten-minute spike is $0.0833 at $0.50/hour or $0.10 at $0.60/hour, plus Muse and any voice service. A half-hour meeting is $0.25 or $0.30, respectively. These are external-provider dollars; the $150 Meta credits are not assumed to pay Recall. No costs incurred in this research.

## Recording retention and deletion

Set `recording_config.retention: null` on every relevant recording request to enable Recall ZDR. It processes recording media in memory and supplies real-time data; omitting the field can retain media indefinitely. Real-time delivery failures are not recoverable later under ZDR. Do not turn on vendor transcription to obtain a live audio stream. [Zero Data Retention](https://docs.recall.ai/docs/zero-data-retention)

If media was stored during a consented diagnostic, use Delete Recording or Delete Bot Media and verify deletion. Changing defaults does not remove old recordings. Recording deletion does not cover custom metadata, meeting URLs, telemetry or third-party systems; this is not a blanket zero-data-retention claim. Retained Rally transcripts/outcomes must also follow Rally's own meeting-deletion flow. The retention and create-reference pages describe URL lifecycle differently, so verify actual account policy rather than promising all metadata disappears. [Storage and retention scope](https://docs.recall.ai/docs/storage-and-playback)

## One documented alternative: Meeting BaaS

The current API v2 can deliver raw meeting audio over WebSockets and accept audio back. Configure the raw-audio path with vendor transcription disabled; do not copy a v1 `streaming.input/output` payload into v2. Its native format/rate and output buffering/control contract need verification against the selected v2 schema before coding. This offers an audio transport candidate that can feed Muse directly. [v2 streaming](https://docs.meetingbaas.com/api-v2/streaming)

Avoid selecting its separate Speaking Bots service unchanged: its documented default pipeline uses Meeting BaaS's speech/language providers; supported hosted brains listed are OpenAI, Anthropic and Z.ai, not an established Muse adapter. A custom bridge is a different implementation. [Speaking Bots introduction](https://docs.meetingbaas.com/speaking-bots)

Its main pricing page advertises eight free hours, prepaid recording tokens, one token/hour recording, and 0.10 additional token/hour **per streaming direction**. The smallest paid pack is $50/100 tokens: raw recording plus two directions forecasts 1.2 × $0.50 = **$0.60/hour**, before Muse/voice. A separate first-party pricing subdomain still advertises four free hours; confirm entitlement in the actual dashboard. Never buy a token pack just to unblock this research. [Main pricing](https://www.meetingbaas.com/en/pricing), [older pricing subdomain](https://pricing.meetingbaas.com/pricing)

This alternative is not promoted into the roadmap yet: cancellation semantics, zero-retention configuration, Teams-specific admission and raw audio behavior remain untested. The primary choice has a clearer documented ZDR path for the agreed retention policy.

## Native Microsoft fallback

Direct application-hosted real-time media requires Microsoft's C#/.NET media library and Windows Server hosting, with Azure production requirements. This is an additional service with operational prerequisites, not merely inviting a webpage into a meeting. Defer it unless managed transport cannot meet requirements and there is time for that separate implementation. [Microsoft media bot requirements](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/requirements-considerations-application-hosted-media-bots)

## One-developer-day spike gate

The following timeboxes are planning limits, not vendor promises. Start only after the account, reachable page, meeting URL and host are available. Current overnight authorization excludes provisioning/joining, so these are the next execution steps, not completed work.

| Timebox | Task | Pass evidence / cut condition |
| --- | --- | --- |
| 30 min | Inspect account allocation, pricing and retention; create one explicitly named test bot | Record configuration and expected maximum active time; if account/access is blocked, keep Teams deferred |
| 30 min | Host admits Rally into a standard scheduled meeting | Rally visible under its name; lifecycle events verified; otherwise record lobby/policy blocker |
| 60–90 min | Receive audio and forward PCM through backend to Muse | Correct live transcript from at least two participants; no vendor-ASR substitution |
| 60 min | Render one fixed Muse-approved line through the output page | Participants actually hear it; wording unchanged; check managed browser voice availability |
| 60 min | Host cancel, a human speaking during output, and stale response | Measure audible stop and ensure Rally does not hear itself as a confirmed commitment |
| 30 min | Leave, stop transport, inspect usage/retention | Bot removed, no orphan session, expected provider usage and recording-media policy verified |

**Promote Teams only when join, receive, speak, cancel and cleanup all pass within this timebox.** Otherwise preserve the working browser demo and leave a reproducible blocker record. This honors the existing user environment without pretending that a meeting invite alone supplies an implemented media agent.

## Morning review items

There is no required overnight input. Future test prerequisites: provider account/key, normal Teams join link and admission host, consented session, reachable bot page, and authorization for the separate provider spend. A browser voice test or public deployment is not silently assumed done. Account free-hour eligibility, managed-browser TTS, actual media latency, speaker mapping and retention behavior remain unverified.
