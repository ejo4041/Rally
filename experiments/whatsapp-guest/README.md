# WhatsApp browser guest transport prototype

A separate, disposable Chromium context with private PulseAudio speaker and virtual microphone devices. No Meta account, Teams profile, model credential or LiveKit Cloud dependency is required by this harness. Actual guest joining remains pending a fresh consenting host-created call link.

The local synthetic audio test passed: 440 Hz output reached the browser microphone, an independent 880 Hz browser output reached the incoming monitor, and stopping output made the microphone silent. This validates routing only, not WhatsApp's call UI or conference audio. No inference call was made.

## Prepare and inspect

Install the existing frontend dependencies (`npm ci` in `apps/rally-web`). The host needs Playwright's full Chromium, PulseAudio, Xvfb and the existing browser libraries. In an interactive operator terminal, run from the repository root:

```bash
XDG_RUNTIME_DIR=/run/user/1000 \
LD_LIBRARY_PATH=/srv/hackathon/tools/browser-libs \
timeout --signal=TERM --kill-after=10s 190s \
node experiments/whatsapp-guest/probe.mjs
```

Supply one JSON line through stdin with `url` set to the actual fresh call URL and `consented` set to true. Do not put an invite in argv, Git, documentation or logs. The process validates direct `https://call.whatsapp.com/voice/...` or `/video/...` links; query parameters, credentials, fragments and unrelated hosts are rejected. The outer timeout is an additional process deadline; normal cleanup also closes Chromium and removes its temporary audio/profile files.

The probe opens the call page, inspects input/button labels and waits under the bounded deadline. **It does not press Join yet.** Actual name/join/waiting-room selectors must be checked against the host's guest page; they are not inferred from Teams or a local mock. Challenge/login requirements are surfaced for review rather than bypassed. No enabled WhatsApp invitation UI is deployed before a real transport check.

This is an operator-only prototype. The call page is remote, untrusted content. The browser runs in an ephemeral context with only microphone permission, no camera permission, no exposed debugging port, no shared personal browser profile and no injected model secrets. Do not save page screenshots or body text containing participant information to the public source. The sanitized report retains stage/time only; local audio test reports retain aggregate measurements.

## Local checks

```bash
node --test experiments/whatsapp-guest/guest.test.mjs
XDG_RUNTIME_DIR=/run/user/1000 LD_LIBRARY_PATH=/srv/hackathon/tools/browser-libs \
node --test experiments/whatsapp-guest/lifecycle.test.mjs
XDG_RUNTIME_DIR=/run/user/1000 LD_LIBRARY_PATH=/srv/hackathon/tools/browser-libs \
node experiments/whatsapp-guest/audio-check.mjs
```

The deadline includes audio/display/browser startup. Cancellation checks prevent later startup stages from reopening resources, and a browser launch that completes after cleanup is closed directly. Local lifecycle tests delay launch deterministically to reproduce that race; they also exercise an actual Chromium deadline and repeated close. PulseAudio/Xvfb and Playwright dependencies are required for these tests. No platform page is opened.

The audio check uses synthetic tones and writes its temporary waveform inside the disposable directory; it is deleted on cleanup. No real call or meeting audio is recorded. Existing Teams services and the deployed app are not restarted or modified.

## Live gates still required

Host supplies a link and admission window. Verify guest name and waiting room, host admission, receiving a known spoken phrase, outgoing diagnostic audio, mute/leave/host removal and deadline cleanup. Then a separate explicitly bounded Muse transcription test can establish the provider connection and actual cost. An owner-isolated queue/UI can follow observed success; generated moderator speech and echo controls need their own validation.
