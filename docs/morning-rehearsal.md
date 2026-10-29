# Morning rehearsal — October 29

The deployed app is version 11. [Browser meeting inputs and WhatsApp follow-up](browser-meetings.md) are available; actual call/device validation is pending. Use Check audio first to verify local input levels without a model charge. Self-hosted Meta MMS browser output is available; the latest server runner also includes the morning cancellation/race fixes. The Teams participant receives audio and streams it to Muse Voice Transcribe. The new local virtual-microphone output controller has passed an isolated audio test; live Teams speech moderation is still being connected.

## Short first check

1. Open the restricted Rally Site in the browser you will use for the demo.
2. Use the labeled walkthrough, then Test voice. Confirm you hear the generated sentence and check names/deadlines when exercising the opening. Use Stop while speech is audible and verify it stays stopped.
3. Check that a fresh Teams test has no active predecessor. Supply a fresh invite and participant consent, select transcription, invite Rally and admit the participant.
4. Speak a known sentence, allow the test to pass the earlier failure window, and exercise either deliberate Leave or the three-minute absolute departure. Verify the participant leaves and the final words remain in the transcript.
5. Save the completed test to history, reopen it and verify export. A retrospective Muse review is an explicit paid action requiring permission; the transcript/history checks themselves do not request reasoning.
6. Reconcile the usage record for any real transcription/reasoning test before another paid batch.

## Roles and demonstration

Use [the draft script](demo-script.md) as a rehearsal outline. The goal is to demonstrate a useful meeting interaction followed by a brief future-platform description. Human speakers can prepare the discussion scenario; retain actual model responses and response timing. Keep the future meeting-platform slide visibly labeled as a future direction.

The first rehearsal should confirm the chosen browser, microphone and speakers. Then run the complete three-person sequence, including consent, an intervention, source-linked proposals, explicit host confirmation, override, saved evidence and export. Keep Teams voice output separate until the route is implemented and verified in a consented meeting.

## What the offline audio check establishes

Real MMS waveform samples reached an isolated PulseAudio output and its monitor. Canceling playback completed in approximately 1 ms in that trial; the monitor was silent 650 ms later. The temporary daemon/device were removed and no captured audio was saved. [Measurement](research/mms-pulse-probe.json).

The output controller marks its own playback and a 400 ms tail as potential echo. This is a conservative timing flag for a future caller; it is not acoustic echo cancellation or a verified speaker classifier. Connecting that flag to Teams transcript/evidence handling and testing remote echo remain open work.

No final submission is authorized. Source license, public repository access, reviewer access and the final recording remain separate open tasks.
