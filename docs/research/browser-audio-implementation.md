# Rally browser audio implementation notes

Researched October 28, 2026 against browser documentation. No browser, physical device, microphone, speech service, or API was exercised in this task. No paid calls were made. This is an implementation recommendation, not measured compatibility. See [agreed scope](../planning-interview.md), [latency plan](../latency-test-plan.md), and [speech/Teams research](rally-speech-and-teams.md).

## Recommended first diagnostic

Build one browser page with an explicit **Start meeting** gesture, microphone consent, input-level meter, selected-device settings, live transcript, one short approved spoken intervention, and a prominent **Stop speaking** button. Use desktop Chrome first for diagnosis, then the actual phone/browser intended for the demo. Chrome-first is a development choice, not evidence that Safari cannot work. Keep the chosen phone awake and the page foregrounded for the first demo; background and lock-screen behavior are separate tests.

Capture and microphone permission require a secure context; localhost qualifies for local development. An ordinary `http://<laptop-LAN-IP>` link on a phone is not equivalent to localhost on that phone. Use HTTPS for the phone test. Permission denial, unavailable devices, and an unanswered permission prompt must remain visible rather than appearing to be ASR latency. Embedded previews can also require explicit microphone Permissions Policy. [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

Use the initial click/tap to create/resume the audio context, request the microphone, and test voice playback. Media/Web Audio autoplay policies vary, so handle blocked output and offer a direct **Enable sound** action. That action is a useful compatibility strategy, not a promise that one tap permanently unlocks all future audio or speech on every device. Test speech synthesis separately from media-element autoplay. [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay), [AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume)

## Capture and PCM conversion

Recommended pipeline: microphone track → MediaStream source → AudioWorklet → bounded frame queue → application WebSocket → Rally backend proxy → Muse ASR. Keep the raw-audio path transient and the microphone input disconnected from audible speaker monitoring to avoid a feedback loop.

AudioWorklet runs custom audio processing off the main thread. Its input uses floating-point channel arrays; inspect actual block lengths rather than hard-coding 128 frames, which the documentation warns may change. Put capture/packing work there and keep DOM work outside it. [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet), [processor process()](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process)

Request mono audio and echo cancellation as preferences; inspect the resulting track settings and `audioContext.sampleRate`. A requested track rate is not a guarantee about the rate processed by the audio context. Context sample rate can be specified, but unsupported values can fail; otherwise its default follows the output device. Record both rates in diagnostics. [MediaStreamTrack.getSettings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings), [AudioContext constructor](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext)

Implementation recommendation: if a 24 kHz context succeeds, pack its actual output to signed PCM16 little-endian. Otherwise resample the observed context rate to 24 kHz or 16 kHz. At 48→24 kHz, apply an antialias low-pass filter before decimation; at 44.1→24 kHz preserve fractional position/filter state across blocks. Simply relabeling 48 kHz bytes as 24 kHz changes speed; dropping arbitrary samples aliases the signal. Clamp float samples before PCM conversion. Validate with a known-duration fixture and the existing ASR baseline before tuning performance.

Start with the 80 ms network frame size already used by Rally's successful reference-audio experiment; do not introduce a different batching variable unnecessarily. At 24 kHz mono PCM16, 80 ms is 3,840 bytes. The provider requires real-time pacing and raw PCM rather than a WAV/Opus container. The browser worklet cadence and network batching cadence are separate. [Meta speech-to-text migration contract](https://dev.meta.ai/docs/speech-to-text)

Do not grow a silent backlog indefinitely. Monitor `WebSocket.bufferedAmount`, which reports bytes queued but not transmitted. A proposed diagnostic threshold of 500 ms queued audio should flag degraded connectivity; cap the application queue and mark a discontinuity or reconnect rather than replaying stale seconds as current conversation. Threshold and recovery policy are Rally recommendations to validate, not browser guarantees. [WebSocket.bufferedAmount](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/bufferedAmount)

## Browser speech adapter

`speechSynthesis.getVoices()` exposes device-available voices; enumerate immediately and refresh on `voiceschanged`. The list can be populated asynchronously, including in Chrome. Choose by language and an available voice identifier with a fallback; never assume a voice name exists on another device. Show selected voice in the diagnostic. [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [utterance example and events](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance)

Give each intervention an application utterance ID and generation number. Attach `start`, `end`, and `error` handlers before speaking; retain the utterance object while pending. Measure request-to-`start` as a playback-start proxy and verify against actual audible output during rehearsal. Supplying text or enqueueing it is not proof that the audience heard it. Speech rate, pronunciation of names/dates, sound routing, and start delay require actual-device checks. [SpeechSynthesisUtterance](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance)

For **Stop speaking**, invalidate the current generation and call `speechSynthesis.cancel()`, which removes queued utterances and stops current speech. Discard late model replies and obsolete playback events using the generation/meeting ID. Do not use `pause()` for a dismissal: it permits a later resume of stale content. Browser semantics do not establish a measured sub-500 ms stop on the chosen hardware. [SpeechSynthesis.cancel](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/cancel)

Browser TTS is not inherently local, offline, or zero-retention. `voice.localService` distinguishes local from remote synthesis; log that property and prefer a suitable local voice for the initial diagnostic if available. Remote voices may have additional latency or service implications. [SpeechSynthesisVoice.localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)

The speech API returns utterance/playback state rather than a documented audio buffer or MediaStream. A Web Audio MediaStream destination can export audio from its connected Web Audio graph, but that does not automatically make speech synthesis part of that graph. **Do not promise browser TTS can feed a Teams bot.** Test synthesis in the managed browser, or use a rendered audio file/stream through a supported transport. [SpeechSynthesis interface](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [MediaStreamAudioDestinationNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode)

## Echo, interruption, and confirmation integrity

Request `echoCancellation: true`, but treat it as assistance rather than proof that Rally's voice will be removed. The browser chooses what to cancel; support and effectiveness vary. Inspect applied settings and test speakerphone volume/placement. [Echo cancellation constraint](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation)

Application recommendation: maintain separate capture, moderator, and playback states. **Stop speaking** cancels voice immediately. **Pause moderator** prevents new interventions while the recording badge remains visible. **End meeting/stop capture** stops tracks and closes the provider session. A microphone mute is not an output mute, and stopping output must not silently end transcript capture.

Do not infer human barge-in from microphone energy alone: the energy can be Rally's own speaker output. Start with reliable host cancel; test spoken interruption with echo cancellation before advertising autonomous barge-in. Keep playback start/end intervals tagged. Transcript material overlapping unverified echo contamination cannot alone confirm Rally's own proposed commitment; ask for a clean human confirmation afterward. This conservative confirmation rule can miss overlapping human speech, so preserve uncertainty and allow host correction rather than claiming source separation.

## Server boundary and minimum states

The browser should connect only to Rally's authenticated backend, which owns the Meta key, opens provider sessions, validates audio format, maintains per-meeting limits, and emits sanitized transcript/decision events. Meta explicitly recommends keeping keys out of browser code and proxying requests. Use the existing ignored environment-file mechanism; never send that file or key to the page. [Meta authentication](https://dev.meta.ai/docs/authentication)

Recommended state boundaries:

| Boundary | Minimum behavior |
| --- | --- |
| Capture | `idle → requesting_permission → live → ended/error`; expose muted/ended track changes and stop all tracks on end |
| Moderator | `listening → evaluating → eligible/quiet`; accept a result only for current meeting/transcript/override generation |
| Playback | `idle → queued → speaking → ended/canceled/error`; queue at most one current intervention |
| Reconnect | Mark the transcript gap; discard expired moderator work; never replay raw backlog as live audio |

These are implementation choices. Existing cooldown, five-minute wrap-up, explicit outcome confirmation, and host authority remain governed by the agreed plan.

## Manual acceptance checklist and remaining blockers

Run the same checklist on desktop Chrome, intended Android Chrome if available, and intended iPhone Safari if available; record exact OS/browser and selected voice. Testing one does not establish support for the others.

1. HTTPS permission allowed, denied, and unanswered; input level moves and settings show actual rates/channels.
2. Fixed-duration source reaches ASR without speed/pitch change, repeated words, or dropped block boundaries.
3. Three participants speak normally and overlap briefly; uncertain speaker names remain correctable.
4. Rally speaks a short sentence containing names, a date, and a number; output is audible after initial interaction.
5. Host cancels mid-sentence and while a model response is pending; no stale speech restarts.
6. A human speaks while Rally plays; assess echo, human recovery, and false confirmation risk before enabling automatic barge-in.
7. Test background/foreground, phone lock/unlock, audio-device change/Bluetooth routing, network loss and reconnect; keep unsupported states visible.
8. End capture: microphone indicator clears, provider session closes, and no raw audio persists in logs/storage by accident.

All device checks are **unrun**. Documentation research cannot establish audible latency, chosen voice availability, Bluetooth behavior, echo rejection, or managed-bot synthesis. The first implementation task should produce this diagnostic and a trace of actual playback, not a polished meeting dashboard ahead of the audio gate.
