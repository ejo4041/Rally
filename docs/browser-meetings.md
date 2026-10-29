# Use Rally with a meeting browser tab

Rally can receive a user-selected browser tab's audio and optionally your microphone. It uses Muse transcription and the existing moderator controls. You join the call yourself; Rally's prompts appear in your workspace and optional speech is played locally.

1. Join the WhatsApp Web, Zoom Web, Google Meet, Jitsi or other browser meeting in a separate tab.
2. In Rally, create a meeting and choose **Meeting browser tab** as the audio source. Choose the platform to label the record, enter the agenda/participants and select whether to include your microphone.
3. Obtain participant consent before starting transcription. Use headphones, especially when including your microphone.
4. Press **Start meeting**. In the browser picker, choose the actual meeting tab and enable **Share tab audio**. Rally refuses whole-screen/window selection and a tab without audio.
5. Read live text and host-side moderation in Rally. Visible prompts are the default for this mode. The captured display handle stays active for browser Stop sharing controls; only audio is processed/uploaded.
6. Use **Mute audio** to mute all capture, **Pause Rally** to pause moderation while transcription continues, or **End meeting** to stop. Stopping tab sharing also ends capture. This does not hang up your separate meeting call.

Desktop Chrome or Edge with tab-audio sharing is the intended path. Mobile/other-browser audio capture is not assumed. If the picker does not offer audio, join the call in a supported desktop browser. Browser selection and platform rules still apply; Rally cannot grant missing call access or determine that the chosen tab matches the platform label.

No added platform connector subscription is used. Real Muse calls still use the existing paid/grant account and software budget gates. The labeled walkthrough remains available without real model calls.

## WhatsApp follow-up

After ending a meeting and confirming outcomes, choose **Share confirmed outcomes**. Review the draft and either copy it or open it in WhatsApp. Choose the recipient and press Send in WhatsApp yourself. Unconfirmed outcomes, stale evidence and the full transcript are excluded. The WhatsApp draft URL contains the displayed draft text; opening it shares that text with WhatsApp.

[Platform research and current limits](research/free-platform-options-2026-10-29.md). Synthetic browser tests validate the audio path; actual platform calls still require consenting device tests. Direct Teams participant joining remains available through its existing separate panel. Direct WhatsApp/Zoom/Meet/Jitsi participant joining is not part of browser-tab capture.
