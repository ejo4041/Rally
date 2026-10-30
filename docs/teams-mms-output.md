# Meta MMS output for the Teams guest runner

The normal Teams runner can now render self-hosted Meta MMS into its private outgoing audio device. This prepares the audio path for a consenting live test. It does not make the current invite workflow an autonomous spoken moderator: that workflow streams Muse transcription to the protected queue and imports finalized text afterward; it does not yet connect an integrated live agenda/assessment session to approved Teams speech.

## Implemented

`experiments/teams-web-client/speech.mjs` wraps the existing local MMS engine and speech output controller. PCM goes through stdin to `paplay --device=rally_teams_out`. The browser microphone is `rally_teams_mic`, remapped from that sink's monitor. Incoming Teams audio remains on the separate `rally_teams_in.monitor`. Default host speakers are never selected.

A call owns one speech controller. The runner checks its current job, deadline, connected WebRTC state and protected queue permission before generation and again before playback. Leave, deadline, shutdown and loss of queue control close the controller, aborting model work and playback. Connection loss observed by inspection cancels output. Queue revocation is observed on the existing polling cadence, so it is not an instantaneous remote Stop guarantee. No synthesis/playback retry occurs automatically.

The runner has a default-off diagnostic switch, `RALLY_TEAMS_MMS_TEST=1`. For a deliberately configured future test it plays one fixed sentence after observed connection: “Rally audio test. This voice is generated locally by Meta MMS. Please confirm that you can hear me.” It never accepts arbitrary browser speech text. It makes no paid TTS request. Normal transcription, if opted into, retains its existing charges and three-minute bound.

The ASR adapter replaces incoming frames with silence during playback and an 800 ms tail, preserving frame cadence and discarding excluded audio rather than replaying it. `shieldedSeconds` is included in local end statistics. This excludes participant speech too; wait until the diagnostic ends before speaking. It does not reconstruct missed words or prove acoustic echo cancellation. No inferred commitment should come from the moderator's own voice.

## Local validation

Nine offline tests cover permission refusal, permission lost during generation, playback cancellation/leave, explicit private output selection, ASR framing/drain and shielding without replay. No meeting or paid model is used.

`XDG_RUNTIME_DIR=/run/user/1000 node experiments/teams-web-client/mms-audio-check.mjs` starts a disposable private PulseAudio daemon with the exact Teams device names, uses real pinned MMS, and measures its virtual microphone alongside an independent incoming tone. [Measurement](research/teams-mms-local-audio-check.json): MMS reached the microphone, cancellation returned it to silence, and incoming audio remained active. Only aggregate measurements are saved. No Teams browser/call or real meeting audio is used in that check.

## Next live test

Use a fresh consenting host-created invite and an admission window. Explicitly enable the fixed diagnostic for that bounded run. Verify the host hears MMS, Stop/Leave and removal stop it, the virtual microphone is selected/unmuted, incoming speech reaches Muse, and Rally's own phrase does not become participant evidence. Reconcile actual transcription usage before repeating. Disable the diagnostic after the test.

Automatic meeting-specific replies still require owner-scoped live transcript/agenda state, validated Muse assessment and approved prompt IDs/epochs delivered to this controller, with host pause/dismiss and durable playback coverage records. Those are not supplied by this fixed diagnostic. The common `present(utterance)` operation is available for that connection but callers must establish approval and revocation; its presence is not evidence the integration exists.
