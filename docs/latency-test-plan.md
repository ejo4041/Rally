# Rally latency acceptance spike

Status: initial tests run October 28, 2026 after the user configured `.env.local`. [Measured results](research/latency-results.md) cover text reasoning and silent ASR access checks; real-speech finalization, actual playback and end-to-end latency remain unmeasured.

## Decision to make

Can Rally transcribe, decide whether an intervention is useful, and begin speaking quickly enough to participate naturally? This is a Day 1 gate before expanding integrations. The team is entering the Indie Developer track.

Research: [technical latency notes](research/rally-latency-technical-notes.md). These document API behavior, not measured performance.

## Timing definitions

Use one monotonic clock at the browser/controller for end-to-end measurements. Trace request/turn IDs across backend stages; use per-process durations for server timing rather than subtracting unsynchronized timestamps. Record real-time input, not accelerated audio uploads.

| Timestamp | Event |
| --- | --- |
| T0 | Human finishes the relevant spoken turn, marked against a known test recording or observed reference |
| T1 | Final usable transcript for that turn is available to the moderator |
| T2 | Moderator request sent |
| T3 | Complete structured moderator decision received, validated against current state/evidence, and eligible to speak |
| T4 | Actual audible speech begins, observed via speech-start event and checked against recording |
| T5 | Host presses stop/override |
| T6 | Speech audibly stops |

Report T1−T0 (transcription finalization), T2−T1 (application scheduling), T3−T2 (reasoning/validation), T4−T3 (speech startup), T4−T0 (total), and T6−T5 (cancel delay). Time to first token is not time to a usable moderator decision. Queued speech is not audible playback.

Measure intentional drift observation separately: the time Rally deliberately waits to distinguish sustained drift from a brief useful aside. A model can be fast but the policy can still interrupt too late. Track the time from first off-agenda statement and from the policy's actionable drift point; do not hide a long observation window behind a favorable service-latency number.

## Initial targets — hypotheses, not results

- Total post-turn intervention delay: aim for median at most 3 seconds and at least 9 of 10 samples within 5 seconds. Report every outlier and the maximum. Ten trials are a smoke test, not a robust production p95 estimate.
- Host cancel: aim for audible stop within 500 ms on the chosen demo device, and invalidate late responses so canceled speech does not restart.
- Fail the demo-readiness gate if intervention repeatedly exceeds 10 seconds, has minute-scale delays, acts on stale agenda state, or invents a commitment.
- Product quality gate: intervene on sustained drift; stay quiet on an on-agenda discussion, brief aside, and quoted off-topic example. Measure intervention relevance alongside latency.

These thresholds are provisional engineering targets. Revisit after measuring the real experience, without retroactively presenting changed thresholds as initial results.

## Brief experiment sequence

Timebox approximately 2–4 focused hours after credentials/audio are available. If access or audio formatting consumes that time, report the blocker rather than claiming the test passed.

1. Verify one real Spark call and one live transcription session. Record model ID, mode, request IDs, date, region/runtime, and errors without secrets.
2. Stream a consented or purpose-recorded three-speaker English recording at real-time pace. Run the same recording with ENDPOINTING and DIARIZATION independently. Compare finalization time and identity handling. Keep uncertainty visible; a fast transcription mode may trade off diarization.
3. With fixed transcript input, compare Spark `minimal` and `low` reasoning on a compact agenda/current item/recent turns. Use documented controls only. Require structured output with evidence turn IDs. Judge intervention relevance as well as latency.
4. Connect live audio → transcription → moderator → browser speech. Run ten relevant completed-turn samples, noting cold versus warm start and speaking duration. Include realistic, longer recent context for some samples; a tiny greeting benchmark is insufficient.
5. Exercise an on-agenda segment, sustained drift, brief aside, quoted off-topic example, ambiguous commitment, human interruption, pause, and final wrap-up. Check cooldown and consented capture behavior.
6. Stop speech mid-utterance; confirm no canceled/stale result speaks later and Rally's own words do not confirm an action.
7. Test API-based voice separately when account access is configured. Keep Muse inputs and moderator text fixed for comparison; speech quality and wording fidelity are part of the result.

Use streaming audio, bounded recent context plus authoritative meeting state, concise moderator responses, and application timers. Avoid waiting for a whole meeting upload or serially calling optional models on every turn. These are design directions to validate, not measured optimizations.

## Results format and decision

Create `docs/research/latency-results.md` after actual experiments. Include settings, device/browser, sample count, individual stage timings, summary median/max/within-target count, intervention relevance, speaker attribution issues, cancel results, and raw timing-log location. Exclude raw personal audio and secrets from the public repo. Mark any prerecorded input as prerecorded and streamed at real-time pace.

**Current result: PARTIAL.** Credentials work. Minimal reasoning returned valid decisions in 10/10 fixture cases (median 1.382 seconds); low reasoning returned usable decisions in 9/10. ASR sessions accepted both modes with silent input. The full end-to-end acceptance gate has not passed. See [results](research/latency-results.md); browser TTS and API voice access remain untested.

Follow-up: [licensed reference-audio baseline](research/public-audio-benchmark.md) returned 0% normalized word error on 59 words in both modes, with subsecond acoustic-end-to-finalization estimates. This resolves the no-speech-fixture blocker but not the need for meeting-style audio and actual connected playback tests.

If the loop passes, proceed to the browser vertical slice. If it fails, isolate the slow stage, change one setting at a time, and retest. Defer Teams and additional model calls until this gate passes. Never conceal processing waits with edits in a segment presented as real-time.
