# Rally live-loop latency: technical notes

Checked October 28, 2026. Documentation research only: no credentials, authenticated calls, or latency measurements. Use with the [feasibility report](rally-feasibility.md). Timings below are instrumentation points, not performance promises.

## ASR connection and completion contract

Connect to `wss://api.meta.ai/v1/asr/realtime`. First send a JSON handshake within ten seconds; wait for its session acknowledgment. WebSocket authentication is `authorization.accessToken`, not an HTTP header. Suggested documented handshake:

```json
{
  "authorization": {"accessToken": "Bearer <server-held-key>"},
  "model": "muse-voice-transcribe-1.0",
  "audioEncoding": "PCM_24KHZ",
  "mode": "ENDPOINTING",
  "partialMode": "CUMULATIVE",
  "emitAudioProgress": true
}
```

`ENDPOINTING` supplies speech boundaries; `DIARIZATION` supplies speaker labels but is not tuned for low-latency commands. Mode is fixed per session. `speechEnd` is a boundary, not final text; wait for `speechComplete` keyed by `turnId`. Turns may finish out of order; cumulative partials can revise text. `PUSH_TO_TALK` instead completes with `transcript.final: true`. `endStream` ends the session, not one turn. [Meta speech-to-text guide](https://dev.meta.ai/docs/speech-to-text)

Stream raw mono PCM16, preferably 24 kHz, paced in real time; the WAV header is not part of the live payload. Meta's cookbook provides a streaming-file sample and a microphone path. File upload is a separate recording workflow; use it for offline comparison, not by waiting for a complete meeting recording before moderation. [Meta Voice API cookbook](https://github.com/meta-models/meta-model-cookbook/blob/main/06_muse_voice/01_voice_api_fundamentals/README.md)

Rally recommendation: use finalized turns as evidence. A speculative partial-text classifier can prepare a candidate intervention but must invalidate it when the text changes. Never confirm commitments from a revisable partial. This is application policy, not a capability guaranteed by ASR.

## Spark controls supported by documentation

For Chat Completions use `model: "muse-spark-1.3"` and top-level `reasoning_effort: "minimal"` for the first latency experiment, comparing with `"low"` for quality. Responses instead uses `reasoning: {"effort": "minimal"}`. `"none"` is unsupported and returns HTTP 400. Higher effort adds reasoning tokens, latency, and cost; omitting the parameter does not disable reasoning. Reasoning consumes the output budget, so an excessively small `max_tokens`/`max_output_tokens` can prevent useful visible output. [Meta reasoning guide](https://dev.meta.ai/docs/reasoning)

Request a small JSON-schema decision such as intervention type, short spoken text, and evidence turn IDs. Meta documents `response_format.type = "json_schema"`; schema conformity does not prove factual accuracy. Wait for a complete, parsed and validated decision before speaking. [Meta structured output guide](https://dev.meta.ai/docs/structured-output)

Application recommendations: keep the live prompt to the current agenda item, recent finalized turns, and compact meeting state; avoid optional Wonder audits, tool loops, or full-meeting summaries on each turn. Check wrap-up timers deterministically. These reduce avoidable work but are not measured speedups. No ASR silence-threshold override or undocumented “fast mode” is proposed.

## Minimal experiment

Once access is configured, use the same short English recording with three spoken introductions, topic drift, an explicit decision, an owner/deadline, and a correction. Replay it at actual speed; do not accelerate network delivery to simulate lower latency.

1. Run two independent sessions over that input: ENDPOINTING and DIARIZATION. Keep capture, network path, and playback device fixed. Evaluate attribution separately from turn speed.
2. Feed finalized turns to Spark at minimal effort, then repeat at low effort with the identical extraction task. Include at least one case that should remain silent.
3. Play approved text through the first-priority browser TTS adapter. Include host cancel, a speaker resuming during playback, and a stale result arriving after cancellation.
4. Save request/session IDs, settings, errors, completeness failures, and timestamps, without raw audio or keys. Note that missing credentials make the live result **not run**, not passed.

Record using one monotonic clock where possible:

| Point | Meaning |
| --- | --- |
| A | Last relevant human audio sample captured/sent |
| B | `speechEnd` received |
| C | Matching `speechComplete` received |
| D | Spark request sent |
| E | Complete validated intervention received |
| F | Playback actually begins |
| G/H | Host cancel requested / audible output stops |

Report C−A (ASR finalization), E−D (reasoning), F−E (speech startup), F−A (perceived reaction), and H−G (cancel response). Log first partial separately for UI responsiveness. `audioProcessedMs` is a processing position, not a replacement for local receive timestamps. Browser playback events are useful proxies; verify actual audible timing with a consenting observer or temporary timing-only loopback measurement.

Start with ten relevant turns per configuration, reporting every result plus median and maximum; a tiny sample should not be presented as a production p95 benchmark. Reject a faster configuration if it fabricates commitments, misattributes confirmations, or speaks after host override. Separately test long uninterrupted speech: a moderator cannot depend on waiting for a meeting-length batch or an endlessly delayed finalized turn.

## Decision after the brief test

Choose the fastest configuration that preserves evidence and confirmation quality. If diarization finalization is unsuitable for interventions, retain unknown-speaker/manual mapping fallback and evaluate endpointing for the live loop. If reasoning dominates, narrow the live task and keep optional audits off that path. If playback dominates, test the selected browser/device first before adding another voice model. Teams adds transport and admission variables; benchmark browser capture first, then repeat the same scenario through the actual Teams bot.
