# Teams SDK installation and local audio evidence

October 28, 2026. User requested installing a Teams SDK to investigate joining from this server with virtual microphone/speaker audio. Completed installation and local media feasibility; **no real meeting joined**.

## Installed

Isolated directory: `/srv/hackathon/repo/experiments/teams-audio`.

| Dependency | Locked version | Role |
| --- | --- | --- |
| @azure/communication-calling | 2.0.0 | Microsoft browser calling and Teams meeting interoperability |
| @azure/communication-common | 2.5.0 | ACS user token credential |
| esbuild | 0.28.2 | Local browser bundle |
| playwright | 1.64.1 | Server Chromium feasibility probe |

Install succeeded; npm reported zero known dependency vulnerabilities. Source/lockfile reproducible; node_modules and artifacts ignored. The private Rally deployment and its source checkpoint were not changed. Node is the existing temporary Node 24.22.1 installation; browser shared libraries are the existing unprivileged temporary extraction.

## SDK choice

Microsoft's TeamsJS is for hosted app UI. The native Graph raw media SDK needs Windows Server. On this Ubuntu server, the relevant Microsoft option is ACS Calling SDK inside Chrome with Teams interoperability. ACS supplies custom outgoing MediaStream input and raw incoming MediaStream output, so OS virtual audio devices are unnecessary for this candidate. Official sources, current Teams-interoperability lifecycle status, policy prerequisites and shipped v2 API checks are in [platform verification](teams-sdk-platform-verification.md).

## Actual local test results

Headless Chromium **156.0.8078.4**, Web Audio **48 kHz**, two local WebRTC peers, no STUN/TURN server and external page requests blocked:

| Check | Measured result |
| --- | --- |
| Real SDK CallClient construction | Pass |
| Real SDK LocalAudioStream from generated stream / getMediaStream | Pass; one audio track |
| Both local WebRTC peer states | Connected |
| Incoming simulated human, intended 880 Hz | Peak 878.90625 Hz; RMS 0.14156 |
| Outgoing simulated Rally, intended 440 Hz | Peak 439.453125 Hz; RMS 0.14147 |
| Rally's own output leakage in incoming channel | 440 Hz component about 88.7 dB below incoming 880 Hz component in this synthetic local test |
| Output Stop, sampled 600 ms later | RMS 0.0000634 |
| Incoming audio after output Stop | Still active; RMS 0.14152 |
| Available speechSynthesis voices | Zero |
| Real Teams meeting / ACS auth / Muse calls | None |

This establishes functioning local simultaneous send/receive and output cancellation on the server. It does **not** establish Teams connectivity, perceived audio quality, real-world echo, physical speakers, hosted network timing or sub-500-ms cancellation. The synthetic channels are separate by construction; real meeting mixes and ACS behavior still need testing. Tests use native RTCPeerConnection for the local media exchange, not an authenticated ACS call.

## Failures found and resolved

1. SDK construction rejected HTTP numeric loopback `127.0.0.1`; using literal `localhost` fixed the SDK's secure-origin gate.
2. Initial local peer connection succeeded but both received analysers showed silence. Adding an active silent HTML audio consumer for each remote track started Chromium playout. The analyser graph also has a silent sink. This fixed the actual test and is included in the prepared join harness. A connected signaling state alone would have been an inadequate pass criterion.
3. Server browser exposes zero speechSynthesis voices. Existing laptop browser speech is not a ready server voice engine. SpeechSynthesis also does not expose capturable stream output, so use a decoded speech clip/audio-producing TTS adapter for ACS; OS loopback is an alternative experiment, not tested here.

## Prepared next step

The isolated page can join as `Rally audio test`, read incoming level, send a user-supplied speech clip of up to 15 seconds, stop output and leave. It requires explicit consent, holds a short-lived ACS user token in memory, and attempts automatic departure after three minutes. It has **not** been authenticated or used against a meeting. [Reproduction and prerequisites](../../experiments/teams-audio/README.md).

To prove the requested end-to-end server path: supply an ACS VoIP user token, a standard work/school Teams meeting URL, consenting participants and lobby host. Run the harness in the server's browser; verify admission, incoming speech, remotely audible outgoing speech, cancellation, clean departure and actual Azure usage. Then wire the incoming stream to Rally's existing PCM/Muse backend and approved speech audio to the outgoing graph. Do not claim that the current hosted Rally already joins Teams.

No Azure resources were created, no paid Azure calls or Muse calls made, and no OS audio daemon installed. **This task's Muse cost: $0.** Last reconciled tracked estimate remains **$0.07461610**, with conditional **$149.92538390** remaining from $150 if fully applied and with no other usage; actual Billing and intervening hosted usage remain unverified.
