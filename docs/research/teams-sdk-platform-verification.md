# Teams SDK platform verification

Researched October 28, 2026 against Microsoft primary sources. Research only: this document does not claim a successful Teams meeting join, installed SDK, media exchange, or Azure entitlement. Server inspection reports Linux; installation and local audio probes are recorded separately by the implementation task.

## Which SDK actually joins and transports audio?

| Candidate | Documented role | Fit for this server |
| --- | --- | --- |
| `@microsoft/teams-js` | Hosted iframe experiences such as tabs and dialogs | Useful for a future in-meeting panel; installing it does not create an autonomous media participant |
| `Microsoft.Graph.Communications.Calls.Media` | Application-hosted raw meeting media | C#/.NET and Windows Server; cannot provide native Linux media here |
| `@azure/communication-calling` with `@azure/communication-common` | Browser calling client with Teams meeting interoperability | Best Microsoft SDK candidate for a Chrome-based Linux prototype |

Microsoft describes TeamsJS as an iframe host integration for tabs/dialogs. This is distinct from joining as a voice participant. [TeamsJS scope](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/using-teams-client-library)

Microsoft's Graph app-hosted media route requires its media .NET library, C# implementation, and Windows Server. Production requires Windows Server in Azure; Windows Server on premises is available for development/testing. Node.js and C++ APIs do not expose this real-time media path. Publicly reachable per-instance media endpoints and current media-library versions add infrastructure work. [Graph media requirements](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/requirements-considerations-application-hosted-media-bots)

## Recommended feasibility route

Use a browser page loaded in actual Chrome on this Linux server, with the ACS Calling SDK. Microsoft explicitly lists Chrome on Ubuntu/Linux and requires HTTPS except localhost development. Its support matrix does **not** explicitly establish headless Chrome/Playwright support: automation is an empirical prototype assumption. A Node import or successful bundle alone does not prove WebRTC connectivity. [Platform and browser support](https://learn.microsoft.com/en-us/azure/communication-services/concepts/voice-video-calling/calling-sdk-features)

With an ACS identity/access token, instantiate `CallClient`, create a call agent named `Rally`, and join the existing meeting using `callAgent.join({ meetingLink })`. A meeting link alone does not replace the ACS token. [Teams join how-to](https://learn.microsoft.com/en-us/azure/communication-services/how-tos/calling-sdk/teams-interoperability)

For a BYOI ACS user, the organizer's tenant must permit anonymous joining. Rally appears as an external participant; a Teams user must be present, and lobby admission applies unless everyone may bypass it. Teams personal-use interoperability is unsupported. Receiving an email invite is optional when the join URL is already available. Microsoft explicitly permits custom applications used by bots, with bot disclosure under the application's control. [Meeting interoperability](https://learn.microsoft.com/en-us/azure/communication-services/concepts/join-teams-meeting)

## Virtual microphone and speaker

ACS provides a direct programmatic media path; an OS virtual sound card is not inherently required:

1. Receive: access `call.remoteAudioStreams` after connection and on stream changes, then call `getMediaStream()`. Route the resulting audio track through a Web Audio processor and Rally's PCM resampler into Muse ASR. This is call audio; do not assume distinct named-speaker tracks.
2. Transmit: generate a Web Audio `MediaStreamAudioDestinationNode`; pass its stream to `new LocalAudioStream(stream)` and use it in audio call options. Send approved audio into that graph; gain control/queue cancellation can immediately silence output.

Microsoft supplies raw audio receive and synthetic outgoing-audio examples; these establish API shapes, not verified Teams-interoperability performance on this host. [Raw media guide](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/voice-video-calling/get-started-raw-media-access), [remote stream API](https://learn.microsoft.com/en-us/javascript/api/azure-communication-services/@azure/communication-calling/remoteaudiostream?view=azure-communication-services-js), [local stream API](https://learn.microsoft.com/en-us/javascript/api/azure-communication-services/@azure/communication-calling/localaudiostream?view=azure-communication-services-js)

The implementation task installed Calling SDK **2.0.0**. Inspection of its shipped `types/communication-calling.d.ts` confirms the same relevant shapes: `LocalAudioStream(MediaStream, options?)`, `AudioOptions.localAudioStreams`, `RemoteAudioStream.getMediaStream()`, `Call.remoteAudioStreams`, `remoteAudioStreamsUpdated`, and `CallAgent.join(TeamsMeetingLinkLocator, options?)`. This is concrete package-interface evidence, not a live-call test; older v1 examples should still be checked against v2's full token/identity requirements before cloud use.

Browser `speechSynthesis` does not itself return a MediaStream. Therefore existing Rally browser speech cannot simply be passed to ACS as its virtual microphone. Use an actual audio asset/PCM-rendering TTS adapter, or separately prove an OS audio loopback approach. This is an engineering inference from the stream constructor contract. First test a short synthetic tone or licensed recording without Muse spend.

## Current lifecycle caveat

The live ACS retirement guide distinguishes retiring standalone services from Calling SDK breaking changes. Its current wording explicitly permits creating resources for supported Teams Meeting Interoperability scenarios despite October 23, 2026 onboarding restrictions for retiring services. New major SDK migration is required for affected services by September 30, 2028. Do not interpret the general retirement banner as either immediate unavailability of Teams interop or proof of our account's access. [Current ACS lifecycle guide](https://learn.microsoft.com/en-us/azure/communication-services/acs-retirement-and-breaking-changes-guide)

## Proof required before promoting Teams

Install and lock the Calling SDK in an isolated spike; verify the browser can construct its media graph without cloud credentials. Then obtain an ACS VoIP access token, a normal scheduled work/school Teams meeting URL, consenting participants and lobby host. Verify join, inbound audio, audible outbound audio, immediate cancel, clean departure and Azure usage. Microsoft ACS charges are separate from Meta credits. No paid Muse calls were made for this research.
