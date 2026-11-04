# Prerecorded demo conversation voices — 2026-11-03

Owner explicitly authorized existing pronunciation-test voices for the public simulated demo while preserving the polished UI. Implementation is isolated on `feature/demo-audio` in `/srv/hackathon/rally-public-demo`.

## Behavior

New simulated meetings play authored participant/Rally speech from static WAV assets. Alex and Sam share Meta MMS English; Priya uses the separate Meta FastSpeech2/HiFi-GAN voice; Rally retains the hosted Seamless voice. These are three voice sources across four fictional characters, not four independently selected speakers. The complete script has21 dialogue clips; two additional Rally clips answer Ask Rally before/after the launch decision. No runtime ASR or speech/model service is invoked.

A single reusable HTML audio element is unlocked by Start. Its playback fraction drives transient partial captions; a participant turn is finalized only when its clip ends. This is approximate simulated alignment, not speech recognition or forced word alignment. Newly played participant timestamps follow the demo playback timeline. Scripted Rally text is shown separately as it starts, with playback state. Ask Rally interrupts the current segment; an old scripted Rally nudge is superseded instead of resuming after the answer. Participant playback can resume afterward. Passive/balanced/proactive policy and moderator pause still apply.

Pause replay resumes from the media clock. Pause Rally/dismiss stop its current reply. Home/navigation, End, reset, hidden-page transitions and pagehide stop playback; revisiting a live sample resumes its saved position. The existing Settings voice checkbox is repurposed as Demo audio: disabling it pauses sound while text replay continues. Blocked autoplay, a missing asset or an8second stalled load falls back to clocked text with a single notification, not live synthesis or a hanging meeting. Settings can retry audio. One player and generation guards prevent overlap/late playback resurrection.

No layout/color redesign. Existing UI controls are reused; explanatory text now accurately describes prerecorded voices. Demo CSP retains connect-src none and permits only same-origin media. No API/auth/meeting service or production voice configuration changed. The normal app uses its existing authenticated speech path.

## Generation and provenance

All23clips were generated from fictional text on November3. Local17participant clips use the already provisioned pinned models, sequentially under1600MB/no-swap/150%CPU/120second transient units. No model or npm download occurred. Five FastSpeech2 utterances have explicit script-reviewed dictionary choices; hyphens in spoken input become spaces without changing canonical captions. Unsupported phones are not silently guessed.

Six successful hosted AWS Seamless requests generated Rally's four scripted replies and two Ask variants. No Muse/Meta Model API calls. Local model API fees zero; hosted speech and incremental infrastructure charges unknown. Finished static assets eliminate runtime speech/model requests, while normal hosting/bandwidth costs remain. [Sanitized accounting](research/demo-audio-generation-2026-11-03.json). Detailed generation receipts are private under `artifacts/feedback/demo-audio-generation-20261103/`.

Audio uses constant RMS gain toward−22dBFS with peak capped at−2dBFS; no speed/pitch modification in shipped files. Pins, per-clip text, durations and SHA256 are in `demo/demo-audio/manifest.json`, with licenses/attribution in its README and root notices. Model weights and secrets remain outside Git. The source/portable demo ships the static assets; Python http.server needs no model setup.

## Validation

- 25frontend unit tests and TypeScript/build pass, including media-clock synchronization, paused progression, late ended callbacks, blocked-media fallback, exact asset hashes/script text, transcript evidence boundaries and replacement of a stale Rally nudge.
- Real Chromium playback with default autoplay policy passed after Start; pause/resume, Ask Rally, moderator pause/dismiss, existing Settings toggle, navigation/history resume and End all exercised. Exactly one player. Synthetic autoplay rejection and missing-file tests retain text replay without errors. Zero microphone/screen capture, model/API or WebSocket calls.
- Full proactive script played all21clips and finalized17participant turns, then generated the full report and an actual PDF. Test-only4× playback completed in57seconds to fit the shared host’s120second cap; normal demo speed remains1×. Themes/viewport sizes changed during playback;8history/home cycles and reload cleanup passed. Heap samples ~5–7MB in this bounded run. This is not a natural-speed multi-hour endurance or listening-quality result.
-48strict light/dark screens at390/1280px passed with no page errors, unexpected API/socket requests, measured contrast warnings or layout defects. Existing ordinary-app feedback integration passed (isolated MFA/HTTP/database/LiveKit/synthetic providers, PDF and named sharing/revoke). No real Teams meeting was joined.

Private validation artifacts: `/srv/hackathon/artifacts/demo-audio-20261103/`. Chromium automation does not establish physical Android/iOS/Safari behavior or subjective pronunciation/naturalness. Final deployed URL/asset smoke and release are recorded in the handoff.

## Deployed result

Release `bcebcb0-demo-audio` is active at https://rally.tail703f9e.ts.net/demo.html . Public real-playback controls, pending reply cancellation, pause/history restore, audio Settings toggle, navigation/End and blocked-autoplay/missing-file fallback all passed on that URL. No client API/model/WebSocket or mic/screen-capture calls. API health good and anonymous `/api/auth/me` remains401.

Tested dist (including all WAV assets) was compared byte-for-byte with staged files before the atomic switch. Backend byte-identical to `a0e3c4a-theme-spacing`, API PID755639 unchanged, private SQLite backup saved. Shared style.css is byte-identical to the polished release; the demo adds only the reused Settings audio checkbox’s visibility and factual audio labels. No deployment restart, production voice switch, new account or real meeting join.

Changes merged from `feature/demo-audio` to main. Existing demo tabs need refresh; create and start a new simulated meeting to hear playback. The preloaded completed record remains a report example and does not auto-play. Ask Rally plays a canned spoken answer. The normal UI’s pause/dismiss/end controls remain in use. Generation receipts and public/full/browser reports remain on the droplet; video05 is unchanged.
