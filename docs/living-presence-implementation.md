# Rally living presence

Current integration combines the supplied silk with the deployed MFA, streaming speech and [continuous-monitoring specification](realtime-monitoring-plan.md). Source worktree: `rally-whatsapp-guest`. Remote acceptance is pending; the active deployment remains the prior reviewed release until this integration is verified.

## Continuous emotions and AI

The shared controller stores eight independent 0–100 axes: joy, curiosity, worry, irritation, sadness, confidence/composure, energy and sass. Expressiveness is 100%. No feeling enum or health score selects a preset. Nullable signed forces describe bounded displacements from a direction-episode anchor. Same-direction commands replace load; reversal anchors at current position. Analytical critically damped motion preserves position, with T95 = 8 − 7.2 × |force| seconds. A ten-second drive lease holds its attained value when evidence stops; silence does not manufacture recovery. Evidence hashes prevent replay or regrouping from renewing an old drive. Contradictory-direction commands are rejected and surfaced to the next model context.

The production `LiveMonitor.check` call now returns affect, focus and concern updates alongside the existing agenda/extension/speech decision. There is no second inference call. The accepted production cadence supersedes the earlier foundation proposal: ten-second checks, eight-second decision eligibility, first speech by snapshot plus ten seconds, accounting drain through eighteen seconds, at most two outstanding requests. Model usefulness and urgency govern intervention; the abandoned foundation's fixed 45/15-second speech gates are not imposed on the newer monitor.

Input includes complete finalized turns bounded to twenty turns/8,000 characters, scoped provisional speech, current emotions with precomputed valid-force bounds, original deadline, cumulative progress, coverage gaps and up to eight active/eight resolved concerns. Oversized final evidence is explicitly skipped rather than silently truncated. Persistent evidence proofs distinguish corrected provisional content from compatible append/finalization. Corrections invalidate dependent focus/concerns and hold the prior emotional drive without canceling an utterance already playing. Fresh assessments can subsequently reverse or intensify it. Final reports retain their separate canonical projection.

Agenda mutations preserve stable topic identities and consumed time. Initial capture activates the first pending topic if none is active. Time is settled at checks and topic transitions. Host and model paths reject multiple active topics or reclaiming spent allocations; consumed topics must be retained as parked rather than removed. Original goals and extension consent remain governed by the accepted monitor specification.

## Shared browser and camera scene

The supplied source is vendored in `packages/living-silk`, with its original archive and attribution retained. Pose/material/mote shaders are unchanged. Shared trajectory sampling runs in the existing animation loop. Browser time is aligned with server HTTP samples. Versioned scenes carry only bounded emotional trajectories, caption/topic text, agenda markers and timing—not transcripts, accounts or reports.

Actual spoken text takes priority. Otherwise the scene shows intended current topic, italic next topic or wrap-up, detour/return guidance and adjustment reason. Accepted focus survives subsequent checking/expired results; evidence corrections clear it. Progress uses the original meeting duration and shows overtime. The existing observation/history, extension controls and approximate read-along remain available.

Browser articulation borrows the approved playing bot track. Native articulation measures the isolated outgoing sink, never incoming participant speech. Voice frames are sequenced by capture epoch and latest-only. Completion, cancellation and teardown clear local caption ownership. Missing graphics leaves readable text.

## Canonical Teams connection

The existing `TeamsLive` / `connectTeamsBrowser` flow owns joining, native incoming audio, streamed speech, camera and teardown. The earlier standalone runner, queue API and renderer bootstrap design were removed during integration: they competed with the deployed streaming transport. Local media experiments remain as validation tools only.

Before Teams enumerates devices, an owned foreground renderer displays the 1920×1080 scene on a separate virtual display. FFmpeg feeds `/dev/video42`; Teams publishes it as its camera. Native1920×1080 text/output with the silk rendered at1280px wide (1280×561 in the measured layout), economy initial mesh and disabled MSAA were selected from measured software-rendering throughput. Separate Teams and renderer displays prevent window occlusion. Scene/voice updates reach the renderer directly through its owned Playwright page, without an app cookie or renderer network credentials. Browser observers receive existing authenticated LiveKit events.

The connector holds a shared host lock, including across service-private `/tmp` namespaces. It releases late-acquired locks after cancellation and awaits resource cleanup. Browser departure, input/output-monitor stalls and backend media loss stop the native call. Explicit Stop/Pause/End and security revocation cancel speech; ordinary transcript growth does not replace an active utterance. Pending joins are withdrawn on logout; already connected independently hosted calls retain the deployed explicit-Leave policy. Closed signup, MFA, owner isolation and administrator revocation are preserved.

## Evidence and remaining acceptance

The merged suite passed 115 backend tests and fourteen frontend tests, both typechecks and the full HTTP/SQLite/LiveKit browser workflow at the first combined checkpoint. Additional review regressions cover corrected provisional affect/focus, deleted-job cleanup and sink-underrun progress; final counts are recorded in the handoff. Synthetic providers establish lifecycle behavior, not model or remote audio accuracy.

Three initial merged-schema judgments tested tangent → recovery → relapse; all valid in2.503–4.901s. A cadence follow-up exposed one10.690s response (production discards it) and clarified the distinction between holding versus reducing attained concern. The final targeted recovery check cleared worry/irritation with valid negative forces in3.920s. [Results](research/living-presence-live-benchmark.json), [cost ledger](research/muse-cost-ledger.md). Earlier foundation calibration is historical evidence, not a substitute for this production-path check.

Local virtual-camera/WebRTC and actual pinned-MMS measurements are [video](research/living-presence-local-video.json), [audio](research/living-presence-local-audio.json) and [browser MMS](research/living-presence-real-mms-browser.json). Camera measurement was 29.29 distinct frames/s at 1920×1080. These do not establish remote Teams negotiated resolution, recipient smoothness or remote speech audibility. A consented live call must still verify enlarged video, captions, voice and the tangent/recovery/relapse scenario. No successful remote acceptance is claimed.

## Integration review and release correction

Fresh Astra spec/systems reviews found and prompted fixes for persistent concern provenance, full-turn evidence, accepted focus retention, nested evidence invalidation, agenda spending, voice sampling, captions, logout during joining, transport failure, lock cancellation, terminal-job cleanup and underrun progress. Review is not a substitute for final regression and remote acceptance.

An attempted activation of the older foundation exposed a deployment ancestry mismatch with newer MFA/streaming/monitoring work. It was rolled back to `40c5739` before any preparation or Teams join. The merged implementation preserves those newer contracts; the old foundation must not be deployed independently. No new provider charge occurred during that reverted activation. See [operations](living-presence-operations.md).
