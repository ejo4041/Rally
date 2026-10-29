# Rally speech output and Teams invite research

**Current speech requirement:** The organizer FAQ supplied on October 29 permits self-hosted Meta MMS and excludes third-party TTS models. Earlier browser/OpenAI speech proposals below are historical research, not the competition implementation. See [current model eligibility and execution evidence](submission-requirements-meta-audit-2026-10-29.md).

Research date: October 28, 2026. Follow-up to [initial feasibility research](rally-feasibility.md). No API calls, provisioning, or implementation performed.

## Updated user constraints

- The user already has a running Microsoft Teams environment. Rally needs to join that environment; creating a new Teams deployment is outside the task.
- Speech priority: browser text-to-speech first; GPT voice second. The specific requested GPT model is **GPT-Live-1.1**, linked in the user's announcement below. Another model must not silently replace it.
- Muse retains transcription and meeting reasoning. Any GPT integration should be isolated to voice output.

## GPT-Live-1.1 availability: announcement versus callable API

### Update: existing models are acceptable

The user subsequently clarified that the voice option does not have to be the newest model. This supersedes the exact-version-only selection constraint above. Official documentation confirms `gpt-live-1` is available as an API model and supports audio output and full-duplex interaction; actual project access has not been tested. It is suitable to evaluate as the conversational-voice candidate, with the fidelity caveats below. [GPT-Live 1 model](https://developers.openai.com/api/docs/models/gpt-live-1)

For the narrow job of voicing Muse-authored text, a dedicated TTS endpoint is a simpler engineering candidate. `gpt-4o-mini-tts` accepts text and streams speech through `/v1/audio/speech`, but current docs mark it deprecated with shutdown January 6, 2027 and recommend `gpt-realtime-2.1-mini` via a different Realtime workflow. The older TTS path can be evaluated for the November hackathon with that limitation recorded; it is not an unqualified long-term recommendation. Research the replacement workflow before making it the permanent voice adapter. [Official TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)

Updated experiment order: browser speech first; compare a dedicated OpenAI TTS path for fixed text and `gpt-live-1` if conversational voice adds enough value. No API access, audio fidelity, latency, or playback cancellation has been measured.

The user-supplied October 15 announcement describes GPT-Live-1.1 rolling out to ChatGPT, Codex, and dots and explicitly says the API release is still forthcoming. A reply repeats that distinction. Consumer-product rollout is therefore not proof of an available developer endpoint. [User-supplied OpenAI community announcement](https://community.openai.com/t/gpt-live-1-1-is-rolling-out-with-new-voices-and-better-accents/1406704)

An exact official-domain documentation search did not establish a callable `gpt-live-1.1` API model. Attempting the corresponding [official model URL](https://developers.openai.com/api/docs/models/gpt-live-1.1) returned HTTP 404 during this research. The official catalog page retrieved instead documents **`gpt-live-1`**, including its model ID, full-duplex conversation behavior, and duration pricing. That is a different version; this report does not select it as a replacement. [Documented GPT-Live 1 model](https://developers.openai.com/api/docs/models/gpt-live-1)

**Conclusion:** Keep GPT-Live-1.1 as a second-path research candidate with unverified API availability, entitlement, model ID, and pricing. A 404 and unsuccessful search are evidence gaps, not proof that no account can access it. Recheck official documentation and the actual account's model access when testing begins.

## Why a voice conversation model is not necessarily a TTS renderer

Official GPT-Live documentation describes a full-duplex conversation frontend that listens, speaks, and delegates work; client delegation can connect an independently chosen backend service. This makes a Muse backend conceptually possible, but it introduces a second conversational decision-maker unless carefully constrained. [Getting started with GPT-Live](https://developers.openai.com/api/docs/guides/live)

The sessions guide says `session.commentary.append` may paraphrase supplied text, and acknowledgment does not prove speech was played. The model can add words or remain silent. For exact wording and known completion, the guide recommends a verified recording or rendered clip. It also documents no per-response audio-done event for GPT-Live. Those are material differences from rendering a fixed Muse-approved intervention. They are documented GPT-Live behavior, not verified GPT-Live-1.1 API guarantees. [Managing GPT-Live sessions](https://developers.openai.com/api/docs/guides/live-conversations)

The separate Speech API accepts text and streams generated audio, with WAV/PCM among its formats. The current guide names `gpt-4o-mini-tts` and explicitly marks it and older TTS models deprecated with shutdown January 6, 2027. Its suggested replacement is a Realtime workflow, not the same Speech endpoint. This establishes that dedicated TTS and GPT-Live are different products; it is not authorization to substitute a TTS model. [Official text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech)

## Comparison

| Consideration | Browser TTS — first | Requested GPT-Live-1.1 — second |
| --- | --- | --- |
| Current readiness | Browser API is documented; chosen-device testing remains | Callable API version and account access unverified |
| Muse text fidelity | Directly supplies the utterance text; test names/numbers | Exact-script rendering not established; GPT-Live family can paraphrase |
| Latency | Measure dispatch-to-audible-start on chosen devices | No verified 1.1 API latency figure; session/network/buffering add components |
| Host cancel | Cancel the speech queue and stale application work | Must control listener playback and pending work; 1.1 protocol unverified |
| Natural interruption | Application must implement interruption detection | Family is conversational/full duplex, but do not inherit API guarantees without 1.1 docs/tests |
| Browser playback | Native speech output | Documented family supports WebRTC audio tracks; exact 1.1 support unverified |
| Teams playback | Must test synthesis voices inside managed bot browser | Managed webpage can play audio; actual model connection still needs validation |
| Costs | No OpenAI model session; depends on selected device speech service | No verified 1.1 price; avoid quoting the predecessor's price as 1.1 |

Browser speech exposes voice selection and cancellation, while utterances have start/end/error events. Voices may be local or remote, so browser TTS must not be described as inherently offline or zero-retention. [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [SpeechSynthesisUtterance](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance), [Voice localService property](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)

For the documented GPT-Live family, WebRTC uses media tracks for audio and a data channel for events. The server creates the session; credentials stay server-side. A working browser connection does not establish the requested model's availability or prove remote-bot integration. [Official WebRTC guide, GPT-Live mode](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)

GPT-Live control guidance puts output checks/buffering in the player or media bridge. Canceling speech requires clearing queued audio and ignoring late approvals for canceled segments. Muting microphone input is not muting model output. Keep generation, playback, and canceled backend work as separate states. [Official server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls?api=live)

## Shortest Teams participant flow

The existing Teams environment removes the need to create a host environment. It does not itself create a joinable Rally bot, its media transport, or permission to enter the meeting.

A managed Teams Web bot is the shortest documented candidate found. Recall says its standard Teams Web bots need no platform setup and normally wait for lobby admission. Non-standard events, direct calls, and breakout rooms have limitations. Use a normal scheduled meeting for the first experiment. [Recall Teams overview](https://docs.recall.ai/docs/microsoft-teams)

Proposed experiment, without calendar integration:

1. Obtain an ordinary Teams meeting join URL from the existing environment.
2. Rally's server calls the managed provider's Create Bot API with that URL and display name `Rally`; immediate joining uses an ad-hoc bot. For a rehearsed scheduled demo, the provider recommends scheduling at least ten minutes ahead for join-time guarantees.
3. Configure the bot's controlled output webpage and explicit recording-retention behavior.
4. The meeting host admits Rally from the lobby.
5. Verify live input, one audible intervention, immediate cancel, and clean departure.

The create API takes `meeting_url` and `bot_name` and supports real-time streams and interactive agents. No automatic calendar connection is required for the join-URL experiment. [Recall Create Bot](https://docs.recall.ai/reference/bot_create)

Recall's controlled webpage receives mixed meeting audio through `getUserMedia()` and can play audio back to participants. Keep Muse transcription in that path rather than accidentally using provider transcription as the product backend. The docs warn about including bot output in mixed recorded audio causing feedback. The browser TTS voice service's availability inside this managed browser remains untested; if unavailable, a real rendered audio clip/stream is required. [Recall Output Media](https://docs.recall.ai/docs/stream-media)

Teams policy may still force explicit bot admission. Existing host access and managed transport do not bypass organizer controls. Raw audio retention must also be configured at the provider, not merely omitted from Rally's database. [Microsoft external bot controls](https://learn.microsoft.com/en-us/microsoftteams/manage-external-bots), [Recall recording retention](https://docs.recall.ai/docs/storage-and-playback)

Native Graph infrastructure remains a later alternative. Its Windows/Azure and permission requirements from the initial report apply to that specific route, not to every managed Teams join. Existing Teams availability should not be confused with having already implemented that native route.

## Recommended adapter and validation

This is a design recommendation, not implemented code:

- Muse produces the approved intervention text and evidence; application logic owns cooldown, scheduling, confirmation, and host override.
- One speech adapter accepts text plus a unique utterance ID, reports actual playback state, and supports cancel. Browser TTS is the first implementation target; GPT-Live-1.1 remains explicitly unavailable/unverified until tested.
- If exploring GPT voice, keep factual decisions and commitments in Muse/application state. Reject altered names, dates, or extra commitments; do not treat a second model's spoken elaboration as meeting evidence.
- Every cancellation invalidates queued playback and late asynchronous results for that utterance. Stop output immediately while preserving ongoing meeting capture.

Before promoting the second path, establish the exact callable model and price; compare a fixed set of names, dates, numbers, and questions against Muse's text; measure audible start and cancel delays; verify no unsolicited interjections; test the same audio inside Teams. If fidelity cannot be controlled, retain browser TTS and defer the GPT integration rather than silently switching models.

Open gaps: GPT-Live-1.1 developer release/account availability; exact-text speech contract; actual per-device voice quality; synthesis support in the managed browser; Teams host admission policy; provider account access/retention/cost; end-to-end latency and interruption behavior. No values in this report should be represented as measurements.
