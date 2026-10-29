# Use Rally with a meeting browser tab

Rally can receive a user-selected browser tab's audio and optionally your microphone. It uses Muse transcription and the existing moderator controls. You join the call yourself; Rally's prompts appear in your workspace and optional speech is played locally.

1. Join the WhatsApp Web, Zoom Web, Google Meet, Jitsi or other browser meeting in a separate tab.
2. In Rally, create a meeting and choose **Meeting browser tab** as the audio source. Choose the platform to label the record, enter the agenda/participants and select whether to include your microphone.
3. Obtain participant consent before starting transcription. Use headphones, especially when including your microphone.
4. First choose **Check audio · free**. Select the actual meeting tab and enable **Share tab audio**. Return to Rally if the browser focuses the shared call tab. Ask a remote participant to speak, then speak yourself; verify the corresponding meters register audio. This local check sends no audio, saves no recording and opens no model connection. It stops after 15 seconds; Stop check, closing the dialog or stopping sharing ends it sooner. A level indicates audio energy, not verified words or speaker identity.
5. Press **Start meeting** when ready for Muse transcription. Select the meeting tab again and enable **Share tab audio**. Rally refuses whole-screen/window selection and a tab without audio.
6. Read live text and host-side moderation in Rally. Visible prompts are the default for this mode. The captured display handle stays active for browser Stop sharing controls; only audio is processed/uploaded.
7. Use **Mute audio** to mute all capture, **Pause Rally** to pause moderation while transcription continues, or **End meeting** to stop. Stopping tab sharing also ends capture. This does not hang up your separate meeting call.

Desktop Chrome or Edge with tab-audio sharing is the intended path. Mobile/other-browser audio capture is not assumed. If the picker does not offer audio, join the call in a supported desktop browser. Browser selection and platform rules still apply; Rally cannot grant missing call access or determine that the chosen tab matches the platform label.

No added platform connector subscription is used. Real Muse calls still use the existing paid/grant account and software budget gates. The labeled walkthrough remains available without real model calls.

## WhatsApp follow-up

After ending a meeting and confirming outcomes, choose **Share confirmed outcomes**. Review the draft and either copy it or open it in WhatsApp. Choose the recipient and press Send in WhatsApp yourself. Unconfirmed outcomes, stale evidence and the full transcript are excluded. The WhatsApp draft URL contains the displayed draft text; opening it shares that text with WhatsApp.

[Platform research and current limits](research/free-platform-options-2026-10-29.md). Synthetic browser tests validate the audio path; actual platform calls still require consenting device tests. Direct Teams participant joining remains available through its existing separate panel. Direct WhatsApp/Zoom/Meet/Jitsi participant joining is not part of browser-tab capture.

## If a meter stays silent

For a silent meeting tab, confirm another participant is actually speaking and that Share tab audio was enabled. A desktop app's audio cannot be captured by selecting an unrelated browser tab; join the platform's browser call first. For a silent microphone, check its browser permission, input selection and mute state. Headphones avoid capturing the remote call twice through the host's microphone. Close the local check before starting transcription. If you cancel a permission picker, any later granted tracks are immediately stopped.

## Developer capture checks

With the local preview running on port 8792 (`PORT=8792 npm run dev`), `node tests/platform-browser.mjs` in `apps/rally` exercises synthetic tab/microphone streams, separate local meters, manual/automatic stop, cancellation during permission selection and the actual PCM worklet. It uses a mocked provider connection.

The optional Linux native check needs Playwright's full Chromium, Xvfb, D-Bus and Openbox (or an equivalent window manager): `dbus-run-session -- node tests/native-tab-runner.mjs`. `RALLY_TEST_WINDOW_MANAGER` can select an installed executable. This starts its own display and never attaches to the Teams browser. Chromium's test flag selects a synthetic local audio tab; the display-capture API is real, while the model connection is mocked. It verifies both the free local check and outbound PCM, without joining any real platform or opening a model session. [Native measurement](research/native-tab-browser-check.json).
