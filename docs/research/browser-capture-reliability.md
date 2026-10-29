# Browser meeting capture verification

October 29, 2026. The production app is version 12. These checks use synthetic audio and preserve the distinction between browser transport evidence and real meeting/provider evidence.

| Check | Result and boundary |
| --- | --- |
| Capture lifecycle | Six unit cases cover tab/audio requirements, wrong display selection, permission rejection, sharing ending during setup, cancellation during the tab picker and cancellation during the microphone picker. Existing tracks stop immediately; late grants stop without starting another prompt. |
| Initialization interruption | Browser tests force worklet loading failure and sharing ending during worklet setup; all sources close and no model socket opens. |
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

## Sample-rate and alias checks

The actual PCM worklet passed 11 offline synthetic-tone cases at 16, 44.1, 48 and 96 kHz input rates. Every two-second case produced exactly 32,000 output samples in 25 frames of 1,280 samples. A 1 kHz input at amplitude 0.2 stayed between 0.1996 and 0.2001. A 6 kHz input stayed between 0.1591 and 0.2000; the 96 kHz input has the largest measured upper-band attenuation.

For downsampling, an input tone at 10 kHz would alias to 6 kHz without filtering. Its measured output was 0.000105–0.001235, at least approximately 44 dB below the input amplitude. These are limited frequency checks, not a complete filter characterization, transcription accuracy test or latency claim. Offline render time is unrelated to Muse response time. No waveforms or real meeting audio were saved. [Measurement](browser-audio-quality-check.json). Run `node tests/audio-quality-browser.mjs` against the local preview to repeat.

## Completed 45-minute run

The native capture run completed successfully with process exit 0 and browser/display cleanup. Rally remained hidden at all 270 observation points. Over 2,700,005 ms, the worklet delivered 33,751 frames (86,402,560 PCM bytes), compared with approximately 33,750 expected frames. The largest observed delivery interval was 94.7 ms for the nominal 80 ms frame cadence. Host mute produced silence and unmute restored the tone. PCM was discarded after aggregation; no audio recording was saved. [Measurement](tab-soak-browser-check.json).

This used the version 11 audio-capture implementation, which version 12 retains unchanged; version 12 adds presenter layout and separate browser checks. The source was a synthetic local tone, the provider socket was mocked, and no Muse call or real platform meeting occurred. The run validates long-duration browser capture and background delivery, not meeting-platform compatibility, network performance, transcription accuracy or Teams pacing.
