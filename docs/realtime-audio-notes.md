# Continuous monitoring audio implementation

The speech job owns its lifetime independently of subsequent assessments. Preparing/playing jobs reject replacement offers without queueing. Explicit host/security/transport cancellation remains available. Evidence invalidation cancels preparing jobs, but marks playing jobs superseded and lets them finish. Optional `checkId`, `snapshotAt`, `speakBy` and `evidenceValid` bind an offer to its accepted check. Validity is rechecked at first audio; normal new checks cannot extend that deadline.

Speech status now includes normalized text, delivery timestamps, optional observed `playedMs`, progress source, and evidence supersession. `speech_delivery` stores bounded per-utterance state separately from participant turns, with deletion cascading from meetings. It is not an agreement/evidence source.

Teams local playback progress comes from PCM observed on the private output sink monitor, starting at first non-silent sample. This is local playout, not remote-listener acknowledgment or word alignment. Missing monitor data leaves progress unavailable so the UI can show static text. Browser read-along uses its actual media element clock instead. No synthesized audio is retained by this instrumentation.

Input shielding and exclusion recording remain enabled unless the explicit Teams duplex flag is enabled. The flag requires a real overlapping-speech/remote-echo rehearsal; isolated routing and normalized fixture tests cannot prove accurate remote overlap transcription.

Validation: normalized LiveSpeech tests cover finish-once-started, superseded evidence, explicit cancellation and invalid evidence before first playback. Local PCM clock test covers silence and split sample reconstruction. No provider/model calls or live meeting joins were made for these checks.

A real isolated PulseAudio sink/monitor check observed 1,020.25 ms for a 1,000 ms synthetic tone, across 202 observations. [Evidence](research/realtime-local-playout-check.json). The fixture needed an isolated D-Bus address to avoid competing with the existing user daemon; no production audio configuration changed. This validates local monitor timing, not Teams remote audio or simultaneous participant transcription.

Independent HTTP/engine integration checks (`realtime-http.test.ts`) pass: cumulative unfinalized speech assessed across a simulated 90-second turn; owner-only history and pause; nonzero Teams input preserved during held moderator playback; original utterance finishes; host extension proposal/replay protection; logout revokes an outstanding browser decision; provisional spoken agreement cannot extend time while an explicit finalized post-proposal agreement can. These use real HTTP/SQLite/engine scheduling with injected model and transport interfaces. No real model or platform calls occur. TypeScript checking passes. Previous unfinished per-utterance delivery records become canceled on store initialization after restart.
