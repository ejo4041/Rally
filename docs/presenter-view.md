# Present Rally in a call

Presenter view shows the meeting title, Rally's prompt and up to three host-confirmed outcomes. It hides the workspace history, full transcript, proposed outcomes and budget controls. Host pause/mute/end controls, speech settings and any scripted-walkthrough or demo-clock labels remain visible.

1. Set up and start the meeting normally, including consent and the free audio check. Choose **Presenter view** in the meeting header.
2. Review the displayed prompt and confirmed outcomes before sharing. The layout stays in the current tab and is restored on reload when the browser permits per-tab session storage. Navigation to another meeting is blocked until you return to the workspace.
3. In your call's screen-sharing controls, choose the **Rally tab** to display it. Enable that call's tab-audio option if available and if you want to test sharing Meta MMS speech. In Rally, enable **Spoken prompts** and use **Test voice** for an audible check with a consenting remote listener.
4. Keep Rally's incoming capture pointed at the **call tab**. Incoming call audio and outgoing Rally presentation are different selections. Use headphones and verify your own microphone remains audible too.
5. Stop the outgoing share in the call before choosing **Return to workspace**. That button changes Rally's layout; it cannot stop a share owned by another website.

The view itself starts no recording, model session, message or screen share. It uses the existing voice player and host controls. The full record remains available in the workspace; this layout is not a separate access-control boundary.

## Current verification

Local browser tests pass for hidden transcript/history/proposals, confirmed-only readout, live host controls, preserved example/clock labels, reload restoration, blocked cross-meeting navigation and desktop/mobile layout. [Measurement](research/presenter-browser-check.json).

Actual outgoing speech through WhatsApp, Zoom, Meet or Jitsi remains unverified. Presenter view is implemented; call-side audio sharing is an optional manual route requiring the platform/device check. Zoom documents tab audio in Chrome but also a microphone-muting issue for some web-sharing paths. WhatsApp's broader screen/audio announcements do not establish that every current browser/guest variant supports this exact setup. [Primary-source assessment](research/manual-tab-voice-sharing.md).
