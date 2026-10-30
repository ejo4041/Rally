# Transcription session handoff

Meta documents a 60-minute streaming-session cap. Rally's default policy starts a new Muse ASR session after 55 minutes, preserving the browser's existing LiveKit publication. `RALLY_ASR_ROTATION_MS` configures the interval; choose one below the selected model's documented limit. This is server capture policy, independent of a model's speaker labels or the UI framework. [Official cutoff documentation](https://dev.meta.ai/docs/cookbook/voice-api-fundamentals#cutoff-behaviour).

The previous implementation treated planned rotation as a fatal capture gap, let incoming frames reach a closed source during replacement startup, skipped rotation while the moderator was paused, and did not fully discard late replacement results after logout. Offline tests reproduced those cases before the fix.

## Current behavior

The engine owns the entire handoff. It revokes pending moderator speech, drains the old source, temporarily discards incoming frames, opens the replacement, and resumes delivery only after the replacement is ready. It does not replay buffered microphone audio. Speaker scope restarts with the new ASR session; host names are not carried to a new anonymous voice automatically.

A successful handoff records a continuity gap and emits `transcription.gap`. The client clears transient text/prompts and shows the notice while keeping its microphone and room connected. This is distinct from fatal `capture.gap`, which still stops local capture. A brief handoff can exclude speech; the saved gap calls attention to that uncertainty and is not proof of seamless audio or speaker accuracy. Every handoff is recorded even when its message repeats; rapid duplicate capture errors are briefly coalesced rather than hidden permanently.

Moderator pause affects reasoning, not transcription. Rotation therefore still occurs while paused, without requesting an assessment. A failed replacement interrupts capture and requires explicit recovery after checking usage; it is not automatically retried. Logout/end can stop a pending handoff. A replacement that becomes ready after it loses ownership is drained and closed, and superseded sources cannot mutate the transcript or issue stale disconnect errors. Shutdown waits for pending handoffs before closing storage.

The common `ASRSession` interface stays small: send, bounded final drain/end, close and source metadata. Adapters own cleanup when opening fails. Provider wire parsing remains in the adapter; transport/session ownership stays in the engine.

## Validation and endurance scope

Six HTTP/clock-controlled tests exercise repeated normal handoffs, discarded frames, source ownership, moderator pause, replacement failure, logout, shutdown and repeated-gap visibility. Frontend state tests distinguish a continuity notice from a fatal disconnect. These tests use injected providers and make no paid calls.

`npm run test:endurance --prefix apps/rally-web` runs a separate bounded browser → LiveKit → Node capture experiment with synthetic microphone audio and injected ASR/reasoning/speech. The default is 65 minutes to cross the actual 55-minute policy. It measures PCM delivery, signal energy, track liveness, session changes, final drain and sampled memory. It does not run the real Muse adapter or prove cloud-ASR pacing, physical microphone quality or human speaker identification. The model API key is cleared in owned fixture processes.

A two-minute pilot crossed a one-minute test handoff and ended cleanly. A one-minute pilot with a 20-second test interval preserved signal and capture across replacements. Longer runs remain running/unproven until their terminal reports are inspected. `RALLY_ENDURANCE_MINUTES` is bounded to 1–180; use distinct `RALLY_ENDURANCE_REPORT_NAME` basenames to retain results. The harness uses isolated loopback ports and explicitly separate media ports; it does not restart production services or join a platform meeting.
