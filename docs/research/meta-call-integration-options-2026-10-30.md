# Next meeting-platform integration

Researched October 30, 2026 against first-party product announcements, official API documentation and authors' source repositories. This follow-up concerns **Rally joining a call from a link**, beyond the browser-tab capture already implemented. No deployment change, account setup, meeting join, message, model request or purchased service was performed.

## Recommendation

Test **WhatsApp browser guest calling** first. It is the best-documented Meta-owned group-meeting path under the current no-new-paid-services constraint. Reuse the existing browser guest runner/audio-routing approach, retaining Muse transcription and later approved Meta MMS output. This is an implementation hypothesis; an announcement for human guests does not prove an automated participant adapter works or establish its permitted use.

### WhatsApp guest calls — first candidate

Meta's [October 14 guest-calling announcement](https://about.fb.com/news/2026/10/introducing-whatsapp-guest-calling/) documents desktop-browser guests entering a name, waiting for host admission and joining calls of up to 32 people. Guests need no WhatsApp account. Calls are free without time limits; an account holder must create the link. The [July 28 web-calling announcement](https://about.fb.com/news/2026/07/whatsapp-web-calling-new-features/) separately confirms browser group audio/video calls and a gradual rollout.

For Rally, this suggests a guest named Rally could be admitted to an existing call while server-side audio routing feeds Muse. We still need a fresh host-created call link and a consenting host to test actual browser/device behavior. We have not verified selectors, automation compatibility, audio routing, guest restrictions on the target deployment, or platform-policy fit for an unattended assistant. Do not add an enabled WhatsApp invitation field based only on the announcement.

The proposed free connector is separate from existing Muse inference charges. WhatsApp's end-to-end encryption protects the platform call; admitted Rally would process decrypted participant audio and send it to Meta transcription under the existing consent model.

## Other routes

| Route | Verified source and practical conclusion |
| --- | --- |
| Official WhatsApp-to-LiveKit connector | [LiveKit's connector documentation](https://docs.livekit.io/telephony/connectors/whatsapp/) describes bidirectional audio, inbound/outbound calls, a WhatsApp Business number, API credentials and public webhooks. It explicitly requires **LiveKit Cloud** and does not support self-hosted LiveKit servers. Our deployed self-hosted server therefore cannot use it as-is. A business-phone call is not documented here as joining an arbitrary consumer group-call invitation. |
| Self-hosted WhatsApp Business connector | The author's [mab3321/whatsapp-connector source](https://github.com/mab3321/whatsapp-connector) implements LiveKit-compatible calling RPCs and Opus relay. Its README requires publicly reachable IPv4 UDP media; its current interface does not handle active-call SDP/ICE renegotiation. It may remove the Cloud dependency, but requires separate review/testing and Business API access. It is not a consumer guest-link adapter. No verified zero-cost entitlement or group-meeting capability was established. |
| WAVoice setup helper | The author's [LiveKit integration guide](https://github.com/amitbhakt/wavoice/blob/main/docs/livekit.md) automates WhatsApp Business discovery/webhooks but targets LiveKit Cloud. The bundled demo uses another model provider. It is neither a replacement for our existing Muse pipeline nor a ready fit for the current self-hosted/no-new-paid-service constraint. It was not installed. |
| Messenger | Meta's [calling announcement](https://about.fb.com/news/2024/11/introducing-ai-backgrounds-noise-suppression-and-more-messenger-calling/) establishes voice/video calling. Current [Messenger help](https://www.facebook.com/help/messenger-app/448372435190713/) redirected to login/temporary-block content during this research. A supported guest-group-call bot/media API could not be verified. Browser-tab capture remains the current fallback when the user's actual call works in a shareable browser tab. This is uncertainty, not proof that no such integration exists. |
| Zoom | [Official RTMS getting-started instructions](https://developers.zoom.us/docs/rtms/meetings/getting-started/) require a Developer Pack subscription with credits. This is not the selected free route. Ordinary meeting-tab capture remains available; no attempt was made to bypass web-client bot controls. |
| Jitsi | The [official iframe API](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/) supports embedded meetings and media-device selection. [meet.jit.si's authentication announcement](https://jitsi.org/blog/authentication-on-meet-jit-si/) requires an account for room creation. Jitsi is a useful open-source alternative if Meta ownership is optional, but embedding alone does not expose raw conference PCM to our server. Self-hosting adds operations; no actual integration trial was run. |

The installed LiveKit Server SDK already includes WhatsApp Connector client methods. That is a client capability, not proof that the deployed media server implements the managed connector service. LiveKit's explicit Cloud-only prerequisite governs the official path.

Meta Business Calling overview/pricing pages returned HTTP 429 or were inaccessible in this run: [overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/), [pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/pricing), [getting started](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/get-started). Business calling eligibility, charges, region availability and conference support were not independently verified from those texts. Third-party claims of free inbound calls or business setup requirements were not promoted to verified Meta pricing/meeting claims.

## Smallest useful WhatsApp test

1. Have an account holder create a fresh WhatsApp call link and remain available for admission. Confirm participant consent before capture or transcription.
2. Open an isolated browser guest as Rally, without a personal login or reused Teams profile. First verify waiting-room entry, admission and explicit departure; keep the initial test bounded to three minutes including preparation.
3. Verify incoming audio and outgoing virtual microphone independently with synthetic diagnostic audio or known phrases; no inference is required for this transport gate. Check mute, host removal, closed page/client and deadline cleanup.
4. Only after transport works, run one short, budgeted Muse transcription test and reconcile usage. Keep built-in captions/transcripts out of Rally's evidence pipeline.
5. Add the owner-isolated invite/status/leave UI only after observed success. Connecting approved moderator speech and echo control remains a separate end-to-end gate, as it does for Teams.

This is the next recommended experiment, not a promise that WhatsApp guest automation will work unchanged. The current deployed app supports Teams link-based transcription tests and manual browser-tab capture for other platforms. No new platform adapter was shipped by this research.
