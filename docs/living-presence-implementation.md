# Rally living presence

Implemented in the active integrated Node application. This replaces the October 30 foundation-only checkpoint. The existing capture-lease work is an integration dependency and is preserved. Private Tailscale access and application authentication remain required.

## State and assessment

The shared controller in `packages/rally-presence/state.ts` stores eight continuous 0–100 axes: joy, curiosity, worry, irritation, sadness, confidence/composure, energy and sass. Expressiveness remains 100%. No health-score enum selects emotion presets.

Muse returns nullable signed forces. Null retains a channel; zero holds its attained value. A nonzero force sets a bounded displacement from a persistent direction-episode anchor. Same-direction commands replace the load; reversal reanchors at the evaluated current position. The analytical critically damped response has T95 = 8 − 7.2 × |force| seconds. Commands preserve compatible bounded momentum and never teleport position. A ten-second drive lease expires into a hold, not cheerful recovery. Consumed evidence revisions persist across assessments; regrouping or replaying old evidence does not renew the drive. Contradictory direction commands are rejected per axis and reported in subsequent context.

Assessments receive at most 40 complete finalized turns and 12,000 transcript characters, current plan, original deadline, bounded progress, eight active/eight recently resolved concerns, recent actual playback and coverage gaps. Reports, full revision/intervention histories, accounts and the emotion evidence ledger are excluded. Per-axis valid-force bounds and endpoint commands are precomputed so the model need not reconstruct controller arithmetic. Corrections to supplied turns or concern evidence invalidate stale results. Appended turns remain available for a coalesced subsequent assessment. Oversized latest turns produce a visible error without a paid call.

Normal cadence is ten seconds. Continuous model urgency can shorten the cadence to two seconds when new evidence arrives. One request runs at a time; automatic starts use a three-token bucket refilling one token per five seconds. Explicit host requests remain deliberate overrides. Capture expiry and ASR rotation run independently of pending reasoning. Each accepted result is validated and saved before events are published. Monotonic scene revisions prevent older updates from replacing newer render state.

Automatic speech waits 45 seconds after actual playback end (or the prior text intervention if voice was not played). Evidence-backed urgency can shorten this to a 15-second floor. Wrap-up has no blanket bypass. Host-requested guidance is an explicit override. Ordinary speech is limited to 40 words and urgent speech to 20. `armed` input shielding is distinct from actual `playing`; coverage bounds extend when playback really begins.

## Browser surface

The supplied Living Silk source is vendored under `packages/living-silk`; the original tarball is retained under the frontend vendor directory. Three.js notices are preserved. Material, pose equations and mote shaders are unchanged. Added hooks evaluate the shared analytical trajectory inside the existing animation loop, without a second semantic spring or RAF. HTTP clock samples establish a monotonic server-time estimate.

The shared surface shows actual spoken text first; otherwise intended topic, italic next topic, detour/return guidance and agenda-adjustment reason. Progress retains the original deadline, topic markers and overtime. Teardown disposes graphics/audio analysis without stopping borrowed playback tracks. Browser MMS articulation borrows the playing media element's audio track; Teams articulation uses sequenced features from the actual outgoing native monitor. Participant audio never drives articulation. Graphics failure leaves readable topic/caption guidance.

## Teams path

A reviewed meeting has a separate **Join with voice and video** flow with explicit consent. This is a native guest browser participant camera, not a shared presentation. Node owns ASR, Muse accounting, moderator approvals and the speech job lifecycle. The native runner transports incoming PulseAudio to the existing LiveKit/Node ASR path and plays approved MMS WAVs into the private virtual microphone. It does not run legacy Sites ASR or its ledger.

LiveKit identities distinguish host observer, capture runner, backend and renderer. Renderer credentials cannot publish media/data or subscribe to participant media. A short-lived one-use bootstrap returns only bounded scene data and a renderer token. No app cookie, service credential, transcript or report is sent to the renderer. Reliable versioned scenes and unreliable sequenced voice features use the existing room. Camera captions and the browser observer share the same scene contract.

Native playback is stopped on authoritative cancellation, control/epoch changes, input gaps, call loss and lease loss; pending synthesis is invalidated too. The runner checks Teams connectivity after admission, stops on LiveKit disruption, and renews capture only while its media path is alive. Deadlines apply during startup and lobby. Both legacy and presence runners acquire the same host lock before claiming work. Active claims are never reissued to a restarted runner. Logout withdraws pending invitations. A service process group is the final cleanup boundary.

The camera has its own foreground 1920×1080 display, separate from the Teams browser. FFmpeg captures the entire display, including the CSS atmosphere and DOM text, into v4l2loopback. Production on this CPU uses the existing economy mesh initially, native pixel resolution and no multisample antialiasing; the browser UI keeps its default rendering policy. Auto quality can still evaluate improvements. This avoids claiming an upscaled silk buffer as native 1080p.

## Validation evidence

- Deterministic controller scenarios cover replay, continuity, expiry, repair, relapse and invalid-direction rejection.
- HTTP integration checks cover runner claims/restart, logout withdrawal, lease expiry during pending reasoning, atomic rejection, bounded scene packets, clock-independent force hints and single-use renderer access.
- [Real browser workflow with pinned MMS](research/living-presence-real-mms-browser.json): real HTTP/auth/SQLite/LiveKit and local MMS, synthetic reasoning/ASR; no paid call.
- [Actual local camera → WebRTC](research/living-presence-local-video.json): 1920×1080 received, about 29 distinct frames/s, no dropped frames over the measured ten-second window. This is not a remote Teams result or a long-duration reliability claim.
- [Actual MMS virtual-microphone check](research/living-presence-local-audio.json): outgoing voice observed; incoming participant sink remained silent; Stop returned output to silence.
- [Initial Muse sequence](research/living-presence-muse-stage-2.json) and [targeted repair/relapse retest](research/living-presence-muse-repair.json): eight actual assessments cost $0.055676 total. One initial contradictory command was rejected; after valid-force hints, both targeted commands were accepted. Retest latencies were 5.462 and 4.741 seconds. These authored scenarios are calibration evidence, not broad perceptual validation.

The first installed loopback driver and Ubuntu 0.12.7 both failed repeated producer startup. This host now uses upstream v0.15.4 (`0f9ee86760b7f2bea174b7e3e7a1d38845da0ab4`) through DKMS for kernel 6.8.0-142. Missing kernel video modules, Mesa drivers, FFmpeg and video utilities were installed. No reboot was required. Headed ANGLE/OpenGL works; earlier headless SwiftShader failures are not the deployed renderer configuration.

## Operations and remaining acceptance

See [presence operations](living-presence-operations.md) for installation and rollback. Full regression results and final review are recorded at release time. The user's real Teams call remains the final acceptance boundary: enlarged remote quality, received voice/captions, cancellation, rejoin and tangent/recovery behavior must be observed. Other meeting platforms remain outside this implementation. Private access is unchanged; no submission or public publication has been performed.

Sources: supplied Living Silk handoff at `/home/hack/living-silk-handoff/AGENT-HANDOFF.md`, [abstract motion affect](https://www.bartneck.de/publications/2010/perceptionAffectElicitedRobotMotion/index.html), [v4l2loopback](https://github.com/v4l2loopback/v4l2loopback), [Chromium rendering modes](https://github.com/chromium/chromium/blob/main/docs/gpu/swiftshader.md). Research does not establish that viewers reliably distinguish every silk emotion; human perception remains part of rehearsal.
