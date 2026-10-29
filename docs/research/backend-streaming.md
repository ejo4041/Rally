# Backend audio transport selection

Selected local LiveKit for the Node backend after the user prioritized opinionated audio handling and strong documentation over a strictly single-process server. Research and implementation: October 29, 2026.

| Candidate | Fit |
| --- | --- |
| LiveKit browser/Node SDKs | Selected: microphone tracks, decoded Node PCM, outgoing audio publication, media reconnection and data events; requires a local media-server process. |
| Socket.IO | Useful event transport, but does not solve audio capture, resampling, playback or media buffering. Not added. |
| Raw WebSocket / simple-peer | Less infrastructure in some configurations, but more application-level media/signaling/recovery work. Not selected for the browser audio boundary. |
| Pipecat SmallWebRTC | Opinionated voice transport; its server pipeline introduces a Python runtime that this Node backend does not need. |

Packages: `livekit-client`, `@livekit/rtc-node`, `livekit-server-sdk`; pinned versions are in the backend lockfile. Local server setup verifies the official release archive checksum. This is an implementation choice, not a production reliability guarantee.

Sources: [Node AudioStream](https://docs.livekit.io/reference/client-sdk-node/classes/AudioStream.html), [AudioSource](https://docs.livekit.io/reference/client-sdk-node/classes/AudioSource.html), [local server](https://docs.livekit.io/transport/self-hosting/local/), [coding-agent documentation](https://docs.livekit.io/intro/coding-agents/), [Socket.IO offline buffering](https://socket.io/docs/v4/client-offline-behavior/).

The official [LiveKit Meta plugin](https://docs.livekit.io/agents/models/stt/meta/) does not support diarization. Rally therefore consumes LiveKit PCM through a narrow Muse adapter, preserving source timestamps, separate speaker events, usage accounting and final drain. The framework's automatic conversational replies are not used: Rally's application scheduler owns ten-second assessments.

The [existing Teams POC](teams-web-client-spike.md) demonstrated guest join and two-way audio. Later implementation has additional [model interfaces](../model-interfaces.md) and [current handoff](../handoff.md). Browser-client audio can attach to the same PCM boundary later; outgoing Teams video is not implemented by this backend. LiveKit does not itself join Teams.
