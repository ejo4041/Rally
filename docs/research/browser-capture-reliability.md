# Browser meeting capture verification

October 29, 2026. The production app is version 11. These checks use synthetic audio and preserve the distinction between browser transport evidence and real meeting/provider evidence.

| Check | Result and boundary |
| --- | --- |
| Capture lifecycle | Six unit cases cover tab/audio requirements, wrong display selection, permission rejection, sharing ending during setup, cancellation during the tab picker and cancellation during the microphone picker. Existing tracks stop immediately; late grants stop without starting another prompt. |
| Mixed audio | Synthetic 440 Hz tab and 880 Hz microphone tracks reach the real 16 kHz PCM worklet. Both signals are measured; these are not human voices or platform calls. |
| Free audio check | Separate tab/microphone levels register locally; manual stop, dialog closure, pending-picker cancellation and automatic 15-second stop close tracks without opening a model socket. |
| Native Chromium | Real `getDisplayMedia` selects a synthetic 660 Hz tab. The local check and actual outbound PCM path pass. The model socket is mocked. [Measurement](native-tab-browser-check.json). |
| Deployed native check | The same real browser API and local level check pass against the restricted Site. The test opens no model socket and Muse usage stays unchanged. [Measurement](native-tab-hosted-check.json). |
| Hosted API | The new module/permission policy, capture metadata and confirmed-only follow-up pass. QA records are deleted. [Measurement](platform-hosted-check.json). |
| Real calls | WhatsApp, Zoom, Meet and Jitsi still need consenting device tests; no direct participant or remote speech-injection behavior is claimed. |

The native test uses an isolated Xvfb display and Openbox. It does not attach to the Teams display or change the meeting runner. Temporary window-manager dependencies were extracted under `/tmp` rather than installed into the server's package database. The production app does not use Chromium automation flags.

## Protected worklet test limitation

The optional service-token browser harness can authenticate page/API requests and run the deployed local audio check. A subsequent attempt to load the PCM AudioWorklet module received HTTP 401 because that browser-module request did not carry the harness's extra header. The test therefore records only deployed local metering, while the full PCM test runs locally. No deployed end-to-end ASR success is inferred from it.

[Worklet loading](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule) defaults to same-origin credentials, which supports ordinary same-origin cookies. Real users' authenticated browser sessions and full live transcription still need device validation. Production code and access policy were not relaxed to accommodate the test credential.

## Longer capture check

The optional `tests/tab-soak-browser.mjs` fixture holds real tab capture for a chosen duration, keeps the Rally window minimized, and checks PCM frame progress, signal presence and delivery gaps. It starts a separate Chromium process and attaches with Playwright defaults disabled, so focus emulation does not hide the browser's real visibility state. The provider remains mocked; this does not test network transport or Muse finalization.

The fixture aggregates frame counts/timing and discards PCM after the initial frequency check. It also verifies that host mute sends silence and unmute resumes the signal. Results are written to `apps/rally/test-results/tab-soak-browser.json`; a completed measurement must be copied here before claiming a passed long-duration run.

To run on an equipped Linux host from `apps/rally`: `RALLY_TEST_SOAK_MINUTES=30 dbus-run-session -- node tests/native-tab-runner.mjs tests/tab-soak-browser.mjs`. Whole durations from 1 to 55 minutes are accepted. The runner has a bounded deadline and removes its display/browser processes on completion.
