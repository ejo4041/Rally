# Speech reliability checkpoint — October 29 morning

The deployed application remains version 9. This batch changes the local speech runner and adds a reusable output controller for later Teams audio integration. No Worker redeployment or schema migration is required. No final submission, external message or paid Muse request was made.

## Runner fixes

Two deterministic tests reproduced failures in the existing runner:

- A generation could finish while a heartbeat request was in flight. When that old response returned, the loop could treat a status record as a newly claimed job and request generation again. The runner now pins the job associated with each poll and only processes a result as a claim when that request was actually an idle claim request.
- Canceling MMS terminates the model subprocess. The runner could subsequently advertise readiness before warming its replacement. Before the next idle poll it now awaits model startup. Startup failures stop the process for the existing service supervisor to handle.

Shutdown signals are checked after awaited polls so a late response does not start a new job. The fixed runner was restarted after a preflight showed no active Teams job and the previous runner lease had time to expire. The existing restricted Site and three-minute Teams limit are unchanged.

## Audio output controller

[output.mjs](../experiments/meta-mms/output.mjs) accepts the existing normalized speech-engine interface, an authoritative `canSpeak` callback and a playback adapter. It checks host permission before generation and again before playback. Generation does not mark incoming audio as echo risk; playback and a configurable short tail do. This permits a future Teams consumer to keep listening while preparing speech, then handle possible self-audio conservatively.

The PulseAudio adapter writes bounded mono 16 kHz PCM to `paplay` stdin, requires an explicitly named sink and terminates the process on cancellation/timeout. It does not save a speech file, select the host's default output or start a meeting.

This controller is not yet wired to the active Teams runner or its evidence processing. The timing flag is not an acoustic echo filter. Live Teams spoken moderation still needs the host controls, moderation session and transport joined together and tested.

## Real local audio measurement

A temporary private PulseAudio daemon and null sink exercised actual MMS generation → PCM playback → sink-monitor capture. Active monitor RMS reached 0.00689. Canceling playback settled in approximately 1 ms; after a 650 ms observation interval the monitor RMS was zero. The controller's echo-risk tail had also cleared. No participant audio was captured or saved, no Teams meeting was opened, and no physical audibility/pronunciation claim is made. Temporary audio processes/devices were cleaned up.

[Recorded measurement](research/mms-pulse-probe.json). The probe can be reproduced with `node experiments/meta-mms/pulse-probe.mjs` after the local MMS prerequisites are installed; it uses a private audio daemon rather than the Teams devices.

## Validation

18 adapter/queue/output/pacing tests pass, including the two reproduced runner races, stale generation refusal, playback cancellation, echo-tail timing and explicit-device PCM validation. The source-export regression also passes. Application code is unchanged in this batch; the existing version 9 validation remains applicable.

The morning [rehearsal checklist](morning-rehearsal.md) identifies the remaining physical-browser and live Teams checks. Muse spend remains at the last reconciled total of $0.15263115, with conditional grant remainder $149.84736885 and zero recorded unknown charges. Actual Billing remains unverified. Local synthesis and audio testing incurred no new provider inference charge.
