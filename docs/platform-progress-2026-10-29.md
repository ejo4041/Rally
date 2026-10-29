# Browser platform progress — October 29

Rally version 12 is deployed on the [existing restricted Site](https://rally-meeting-moderator.excavator3496.chatgpt.site). Access remains the existing owner and two invited viewers. Source and current instructions are pushed to [GitHub main](https://github.com/ejo4041/Rally). No final hackathon entry was submitted.

## What is available

| Feature | Current behavior |
| --- | --- |
| Browser-call input | WhatsApp Web is the first preset, followed by Zoom Web, Google Meet, Jitsi and Other. The host selects the actual call tab and optionally adds their microphone. This is host-side assistance; Rally does not join those calls as a participant. |
| Free audio check | Separate tab/microphone levels, without recording, transcription or a model connection. Stops after 15 seconds or on user cancellation/sharing end. |
| Presenter view | Prompts and up to three host-confirmed outcomes. History, full transcript and proposals are hidden. Host controls and example/clock labels remain. Reload restores the view; other-meeting navigation is blocked until exit. |
| WhatsApp follow-up | Review confirmed outcomes, copy them or open a WhatsApp draft. The host chooses the recipient and sends manually. No Business API or automatic message. |
| Model boundaries | Browser/Teams audio continues through Muse Voice Transcribe; reasoning uses Muse Spark. Optional speech uses self-hosted Meta MMS. Compatible model changes use the existing configuration/adapter ports. |

No additional connector subscription, account provisioning, paid transport or virtual audio driver was added. Real Muse transcription/reasoning still uses its normal charges and budget controls. The existing separate Teams transcription participant is unchanged; its new live pacing retry and spoken output remain pending.

## Evidence

All 46 application tests pass. Browser checks cover mixed tab/microphone PCM, missing audio, wrong display selection, permission cancellation, initialization failure, Stop sharing and manual/automatic local-check shutdown. Presenter checks cover hidden panels, confirmed-only output, working host controls, test labels, reload, navigation and mobile layout. The protected deployed browser/API check passes with synthetic records deleted and Muse usage unchanged.

Real Chromium tab capture of a synthetic tone reaches both the local meter and PCM stream. Eleven offline frequency cases validate 16, 44.1, 48 and 96 kHz inputs with correctly sized 16 kHz frames. These checks do not establish human transcription accuracy or real Zoom/WhatsApp call compatibility. [Verification details](research/browser-capture-reliability.md).

A **45-minute native background capture run passed**: 33,751 PCM frames, a largest delivery interval of approximately 95 ms, verified mute/unmute, and successful track/browser/display cleanup. The source was a synthetic tone and the model connection was mocked; no raw audio was saved. [Measurement](research/tab-soak-browser-check.json).

## First call checks

1. Join an existing consenting browser call and create Rally's agenda/roster. Use [the browser instructions](browser-meetings.md).
2. Run the free audio check. Have a remote participant speak, then speak yourself. Return to Rally if the browser focuses the selected call tab.
3. Start a short Muse session and verify a known sentence from each speaker, corrected names where needed, Stop sharing, saved final words and export. Reconcile usage before another paid batch.
4. Confirm an actual outcome and inspect the WhatsApp draft. Sending remains a separate manual host action.
5. Use [presenter view](presenter-view.md) for a clean shared display. Outgoing tab-audio sharing is a candidate, with [platform-specific limits](research/manual-tab-voice-sharing.md); a remote listener must verify both Rally voice and the host microphone before it is part of the demonstration.

Actual browser-platform calls, the complete three-person rehearsal, fresh Teams pacing validation and remote speech still need device testing. Judge/public access, the source license, authenticated submission-form details and the final recording also remain open. The submission draft and demo script describe the current release and reserve the closing segment for an explicitly labeled future meeting-platform direction.

New Muse charges for this platform work: **$0**. The tracked project estimate remains **$0.15263115**; actual Billing/grant balance is unverified. No external message was sent.
