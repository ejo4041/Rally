# Muse API cost ledger

Costs are estimates from response usage and published Standard prices, not billing receipts.
Actual grant application, prior/shared usage, and current Billing balance are unverified.
The $150 remainder below assumes the full grant is applied and no other usage exists.

[Official pricing](https://dev.meta.ai/docs/pricing-rate-limits): Spark input $1.25/M, cached input $0.15/M, output $4.25/M; Voice Transcribe $0.18/hour.

Known estimated spend: **$0.47338150**. Conditional $150 remainder: **$149.52661850**.
Calls/sessions with unknown cost: **0**. These are excluded from the known total; it is not a complete total if nonzero.

| Time UTC | Test | Model | Seconds | Status | Estimated USD |
| --- | --- | --- | --- | --- | --- |
| 2026-10-28 (initial access check) | initial-access-smoke | muse-spark-1.3 | 0.784 | 200 | 0.00014750 |
| 2026-10-28T03:50:08.515467+00:00 | minimal/on_agenda | muse-spark-1.3 | 1.2 | 200 | 0.00160925 |
| 2026-10-28T03:50:10.710759+00:00 | minimal/sustained_drift | muse-spark-1.3 | 2.195 | 200 | 0.00141925 |
| 2026-10-28T03:50:12.508401+00:00 | minimal/brief_aside | muse-spark-1.3 | 1.797 | 200 | 0.00134325 |
| 2026-10-28T03:50:13.991333+00:00 | minimal/quoted_example | muse-spark-1.3 | 1.482 | 200 | 0.00120995 |
| 2026-10-28T03:50:15.714829+00:00 | minimal/missing_owner | muse-spark-1.3 | 1.723 | 200 | 0.00142200 |
| 2026-10-28T03:50:16.766936+00:00 | minimal/confirmed_action | muse-spark-1.3 | 1.052 | 200 | 0.00107725 |
| 2026-10-28T03:50:18.049516+00:00 | minimal/sustained_drift_2 | muse-spark-1.3 | 1.282 | 200 | 0.00153825 |
| 2026-10-28T03:50:18.876205+00:00 | minimal/on_agenda_2 | muse-spark-1.3 | 0.826 | 200 | 0.00111850 |
| 2026-10-28T03:50:21.200952+00:00 | minimal/missing_date | muse-spark-1.3 | 2.324 | 200 | 0.00230575 |
| 2026-10-28T03:50:22.379435+00:00 | minimal/resolved_decision | muse-spark-1.3 | 1.178 | 200 | 0.00133750 |
| 2026-10-28T03:50:23.899927+00:00 | low/on_agenda | muse-spark-1.3 | 1.52 | 200 | 0.00204275 |
| 2026-10-28T03:50:26.311772+00:00 | low/sustained_drift | muse-spark-1.3 | 2.411 | 200 | 0.00271975 |
| 2026-10-28T03:50:28.194685+00:00 | low/brief_aside | muse-spark-1.3 | 1.882 | 200 | 0.00193295 |
| 2026-10-28T03:50:30.089080+00:00 | low/quoted_example | muse-spark-1.3 | 1.894 | 200 | 0.00195475 |
| 2026-10-28T03:50:32.185698+00:00 | low/missing_owner | muse-spark-1.3 | 2.096 | 200 | 0.00283300 |
| 2026-10-28T03:50:34.116187+00:00 | low/confirmed_action | muse-spark-1.3 | 1.93 | 200 | 0.00181145 |
| 2026-10-28T03:50:36.482697+00:00 | low/sustained_drift_2 | muse-spark-1.3 | 2.366 | 200 | 0.00279625 |
| 2026-10-28T03:50:38.056915+00:00 | low/on_agenda_2 | muse-spark-1.3 | 1.574 | 200 | 0.00183675 |
| 2026-10-28T03:50:40.934891+00:00 | low/missing_date | muse-spark-1.3 | 2.877 | 200 | 0.00412900 |
| 2026-10-28T03:50:45.101300+00:00 | low/resolved_decision | muse-spark-1.3 | 4.165 | 200 | 0.00460575 |
| 2026-10-28T03:50:59.130782+00:00 | asr-silence/ENDPOINTING | muse-voice-transcribe-1.0 | 2.683 | session_completed | 0.00010000 |
| 2026-10-28T03:51:01.626146+00:00 | asr-silence/DIARIZATION | muse-voice-transcribe-1.0 | 2.494 | session_completed | 0.00010000 |
| 2026-10-28T04:01:03.346728+00:00 | public-audio/ENDPOINTING | muse-voice-transcribe-1.0 | 29.713 | session_completed | 0.00145000 |
| 2026-10-28T04:01:32.936245+00:00 | public-audio/DIARIZATION | muse-voice-transcribe-1.0 | 29.586 | session_completed | 0.00145000 |
| 2026-10-28T04:07:54.018050+00:00 | connected-speech/minimal-moderation | muse-spark-1.3 | 0.975 | 200 | 0.00080075 |
| 2026-10-28T04:08:09.740253+00:00 | connected-speech/asr | muse-voice-transcribe-1.0 | 29.7232 | session_completed | 0.00145000 |
| 2026-10-28T04:15:07.999606+00:00 | ami-four-speaker/ENDPOINTING | muse-voice-transcribe-1.0 | 52.456 | session_completed | 0.00260000 |
| 2026-10-28T04:16:00.407178+00:00 | ami-four-speaker/DIARIZATION | muse-voice-transcribe-1.0 | 52.402 | session_completed | 0.00260000 |
| 2026-10-28T04:50:46.218Z | app-smoke-first-attempt/no-audio | muse-voice-transcribe-1.0 | — | closed | 0.00000000 |
| 2026-10-28T04:58:05.959Z | app-smoke/actual-transport-no-redirect | muse-spark-1.3 | 1.712 | 200 | 0.00172775 |
| 2026-10-28T04:58:20.127Z | app-smoke/actual-transport-no-redirect | muse-spark-1.3 | 1.57 | 200 | 0.00151475 |
| 2026-10-28T04:58:23.461Z | app-smoke/actual-transport-no-redirect | muse-voice-transcribe-1.0 | 0.0 | closed | 0.00145000 |
| 2026-10-28T05:00:12.283Z | app-moderator/sustained-drift-policy | muse-spark-1.3 | 1.761 | 200 | 0.00216250 |
| 2026-10-28T05:01:25.761Z | app-smoke/passed-actual-audio-and-moderation | muse-spark-1.3 | 1.981 | 200 | 0.00211825 |
| 2026-10-28T05:01:40.064Z | app-smoke/passed-actual-audio-and-moderation | muse-spark-1.3 | 1.877 | 200 | 0.00213825 |
| 2026-10-28T05:01:43.246Z | app-smoke/passed-actual-audio-and-moderation | muse-voice-transcribe-1.0 | 0.0 | closed | 0.00145000 |
| 2026-10-28T05:06:33.038Z | app-model-contract/initial-policy-cases | muse-spark-1.3 | 1.433 | 200 | 0.00144475 |
| 2026-10-28T05:06:34.473Z | app-model-contract/initial-policy-cases | muse-spark-1.3 | 2.272 | 200 | 0.00159400 |
| 2026-10-28T05:06:36.746Z | app-model-contract/initial-policy-cases | muse-spark-1.3 | 3.933 | 200 | 0.00377025 |
| 2026-10-28T05:09:02.521Z | app-model-contract/literal-deadline-fixed | muse-spark-1.3 | 3.736 | 200 | 0.00340400 |
| 2026-10-28T05:10:26.816Z | hosted-app/two-second-ASR-probe | muse-voice-transcribe-1.0 | — | closed | 0.00010000 |

Per-call usage and request IDs: [sanitized log](muse-call-log.jsonl). Reasoning tokens are included in completion tokens, not charged twice. Audio costs use processed whole seconds when available; sent duration alone is an estimate. Failed requests without usage remain unknown rather than assumed free.

## Normal Teams transcription POC batch

Hosted usage was reconciled by stable usage/request/session IDs. The appended hosted events and synthetic probe are in the sanitized log. The synthetic probe sent 7.78 seconds of offline speech; Meta reported 7.84 seconds processed; whole-second estimate $0.00035000. No meeting audio was used.

## First live Teams transcription incident

User-initiated test: 128.62 seconds sent, 128.64 seconds reported processed, estimated $0.00640000. Session ended early and was marked failed. No additional paid call was made while investigating or applying the server pacing fix.

## Backend MVP real-provider smoke — October 29

Run `2c04aeb9-b49a-42ac-9995-c292d93d7118`: one prepared agenda, one 35.2-second diarized ASR session, one live assessment, one final report. Licensed reference speech was unrelated to the test agenda; low relevance scores are expected. All four operations completed; three final turns, one speaker label, one intervention, completed report. This tests the integration, not meeting-quality accuracy. Batch estimate **$0.03199000**, unknown costs **0**. Cumulative known estimate **$0.18462115**, conditional $150 remainder **$149.81537885**. Billing balance and grant remain unverified.

| Operation | Estimated USD |
| --- | --- |
| prepare | 0.00390275 |
| transcription | 0.00175000 |
| assess | 0.00460675 |
| report | 0.02173050 |

## User agenda examples — October 29

Three actual Spark agenda preparations: terse Heimdall progress/requirements, daily standup, detailed milestone review. All returned valid plans. Batch **$0.01273585**, unknown **0**. Cumulative tracked **$0.19735700**, conditional $150 remainder **$149.80264300**; Billing unverified. Run `a0a8fdd8-7c70-4518-9b57-64dfac6a606b`; sanitized request usage is in the call log.

## Detailed agenda closing-allocation retest

The initial detailed agenda added an extra wrap-up despite an existing closing allocation. A narrow prompt correction reuses the supplied closing time. One actual preparation retest cost **$0.00386100**, unknown **0**. Cumulative **$0.20121800**, conditional remainder **$149.79878200**. Run `1b7965c6-6ccb-4d6f-91d0-8083fe583a06`; no automatic retry.

## Astra realistic text-meeting evaluation

Prepare and drift assessment completed. Maximum-effort report exhausted its 16,384 completion-token allowance (15,410 reasoning tokens), and was correctly marked failed rather than accepted as partial JSON. Three operations cost **$0.08482875**, including failed report **$0.07431700**; unknown **0**. Cumulative **$0.28604675**, conditional remainder **$149.71395325**. Run `2ff6d57e-c873-43f4-9b45-26495e60733c`. A separately accounted explicit report-only retry will use a larger output allowance; no automatic retry.

## Full audio meeting pipeline with scheduled moderation

Original 60.336-second synthetic single-voice meeting generated offline with Meta MMS passed through real LiveKit → Muse ASR → 10-second scheduled moderation → final max-effort report. Six transcript turns, one eligible intervention, ready report with overall 3.6. Muse split the single synthetic voice into two labels; do not interpret this as accurate multiple-speaker attribution. This run began before the report-token-limit fix and used the earlier 16,384 allowance successfully on this simpler content. Batch **$0.09776450**, unknown **0**. Cumulative **$0.38381125**, conditional remainder **$149.61618875**. Run `c2764a6e-c17e-490e-9f46-d1d6983674a7`.

## Explicit realistic-report retry

One report-only retry with maximum effort and 32,768 completion-token allowance completed, passed application evidence validation and the case-specific checks. No successful preparation/assessment was repeated. Cost **$0.08957025**, unknown **0**. Cumulative **$0.47338150**, conditional remainder **$149.52661850**. Run `report-retry-1793281702834`. The whole Astra follow-up spent **$0.28876035** across agenda examples, initial failed report, full audio test, and explicit successful retry.

## October 30 — continuous monitoring production-schema smoke

Four purpose-written text fixtures through the real `checkLive` adapter, Spark 1.3 minimal, 1,024 output tokens. [Results and per-call usage](realtime-model-benchmark.json). All four valid and below eight seconds (2.131–4.243 seconds). Identical exploratory input remained silent with twenty minutes available and prompted a redirect with three minutes available; on-topic input stayed silent and irrelevant drift prompted redirect. No retries, ASR, TTS or platform join. This small short-context batch is not a production p95 guarantee or near-limit context evaluation.

Batch **$0.01176350**, unknown **0**. Development-ledger cumulative **$0.48514500**, conditional remainder **$149.51485500** against the unverified $150 grant. Separately recorded user-operated live meeting charges are not reconciled into this development ledger; this is not an actual Billing balance. Runtime accounting remains authoritative for those requests. Experiment maximum was $0.15, not an allowance consumed in full.

### Continuous monitoring agenda and bounded-context follow-up

Two additional production-schema text checks exercised an actual agenda reorder and a bounded 20-topic/recent-transcript context. [Per-call results](realtime-model-edge-benchmark.json). Both valid within eight seconds: reorder 6.257 s (841 output tokens including 712 reasoning), bounded context 1.791 s (4,585 prompt tokens). No retries or audio/platform calls; no latency guarantee inferred.

Batch **$0.01194350**, unknown **0**. Development-ledger cumulative **$0.49708850**; conditional unverified-grant remainder **$149.50291150**. All six realtime experiment calls together cost **$0.02370700**. User-operated live meeting charges remain separately recorded, not reconciled into this development estimate.

## Living presence schema calibration — October 30

Stage 1: one synthetic on-topic assessment through the production Muse adapter and strict presence schema. Passed in 2.282 seconds; no intervention and no forced affect change. Batch **$0.00407575**, unknown **0**. Central tracked cumulative **$0.47745725**; conditional $150 remainder **$149.52254275**. Billing/grant unverified; deployed user-session usage is recorded separately in its runtime database. The authorized presence experiment ceiling is $3, not a spending target.

Stage 2: five sequential synthetic tangent/repair/relapse assessments. Batch **$0.03679250**, unknown **0**. Presence experiment cumulative **$0.04086825**; central tracked cumulative **$0.51424975**, conditional $150 remainder **$149.48575025**. All strict schemas parsed; one contradictory recovery force was rejected by the controller. Latencies ranged 5.658–8.185 seconds; no model migration or automatic retry.

Stage 3: two targeted repair/relapse retests after supplying precomputed valid-force bounds. Batch **$0.01480775**, unknown **0**. Presence experiment cumulative **$0.05567600**; central tracked cumulative **$0.52905750**, conditional remainder **$149.47094250**. Both commands accepted without contradictory-direction rejection; see [results](living-presence-muse-repair.json).

## Runtime usage reconciliation — October 30

Read-only audit of the integrated runtime ledger imported 105 distinct usage rows, with no duplicated usage IDs against the central log: **$0.85913060**, unknown **0**. These are previously incurred deployment/user-session costs, not a new experiment batch. Combined tracked estimate **$1.38818810**, conditional remainder **$148.61181190**. [Sanitized audit](runtime-usage-reconciliation-2026-10-30.json). Billing/grant still unverified.

Combined reconciliation including the separate six realtime benchmarks adds $0.02370700: tracked total **$1.41189510**, conditional unverified-$150 remainder **$148.58810490** before the merged presence benchmark. No new charge occurred during the reverted activation; signup failed before any preparation or meeting join.

## Merged presence/realtime production schema — October 30

Three sequential synthetic tangent/recovery/relapse calls through the actual `checkLive` adapter returned valid output in 3.086, 2.503 and 4.901 seconds; all continuous commands were accepted. No ASR, speech-provider call or Teams join. [Results](living-presence-live-benchmark.json). Batch **$0.01735250**, unknown **0**. Combined tracked estimate **$1.42924760**, conditional unverified-$150 remainder **$148.57075240**. Presence calibration cumulative **$0.07302850**, below the authorized $3 ceiling. This is a small scenario check, not a production latency percentile.

### Cadence/recovery follow-up

Three valid-schema calls with ten-second simulated state advancement cost **$0.01919525**, unknown0. One tangent response took10.690s and would be discarded by the production8s gate; recovery4.274s and relapse3.874s were eligible. [Results](living-presence-live-cadence.json) explicitly distinguish simulated state from production acceptance. Recovery held attained worry rather than releasing it, prompting a targeted endpoint-semantics clarification. Combined tracked total **$1.44844285**, conditional unverified-$150 remainder **$148.55155715**. Presence experiments cumulative **$0.09222375**.

### Attained-concern recovery endpoint check

One targeted real check after clarifying that zero holds (does not reduce) attained emotion. [Result](living-presence-live-repair.json). Valid in3.920s; batch **$0.00659400**, unknown0. Combined tracked total **$1.45503685**, conditional unverified-$150 remainder **$148.54496315**. Presence calibration cumulative **$0.09881775**. No audio or platform join.

## First merged Teams presence rehearsal

Consented4m56s live call:32 Muse usage records (preparation, transcription,29live checks and final report), known **$0.33466395**, unknown0. Combined tracked **$1.78970080**, conditional unverified-$150 remainder **$148.21029920**. User reported the experience worked well but camera included the browser shell. Repeated late-call checks exhausted1024 outputtokens; all such responses were rejected, not acted on. Calls ended and report completed. Existing hosted streaming-speech costs remain separately recorded and unpriced by the app; this figure is Muse-only. No meeting link or transcript is saved in this engineering record.

## Presence cache measurement — October 30

Three synthetic bounded-transcript calls using production schema and cache-friendly layout: **$0.01526095**, unknown0. Latencies1.928/1.708/2.559seconds; all valid and within8seconds. Cached inputs0/3898,0/3950,3313/4002 (82.78% on third request). No real participant content, speech or meeting join. This is a small cache measurement, not a guaranteed production hit rate. [Usage/results](living-presence-cache-benchmark.json).

Combined tracked Muse spend **$1.80496175**; conditional unverified-$150 remainder **$148.19503825**. Actual grant/Billing remains unverified; other ongoing deployment activity is not inferred from this experiment.

## Feedback direct-address and passive-mode check — October 30

Two synthetic-discussion real Spark1.3 calls, maximum authorized working ceiling $0.15, no retry. Addressed recap in passive mode answered accurately with both supplied evidence IDs in2.412s; ambient discussion in passive mode returned no intervention in2.839s. Batch **$0.01088575**, unknown0. [Usage and responses](feedback-model-check.json). Combined tracked Muse **$1.81584750**, conditional unverified-$150 remainder **$148.18415250**. Existing provider/deployment activity outside this check is not inferred. No TTS provider call or platform join. Local narration and replay recording add zero model API calls.

### Uncached speech validation (separate AWS infrastructure accounting)

One synthetic, non-retrying SeamlessM4T-v2-large utterance without the old prefix completed. First PCM1.643s, total2.234s, output5.94seconds, cache miss. No playback or meeting join during the check. AWS infrastructure cost is **unknown**, not charged to the Muse grant in this ledger. The recorded output is used as an explicitly synthetic production-voice sample in the local demo draft. [Evidence](feedback-tts-check.json). No additional Muse call.

## Teams wrap-up rehearsal — October30

One authorized live join,25seconds captured by Muse Voice Transcribe and one Muse Spark report. Estimated ASR $0.00125000 + recorded report $0.01683700 = **$0.01808700**, unknown rows0, TTS disabled. Tracked cumulative **$1.83393450**; conditional unverified-$150 remainder **$148.16606550**, excludes unrelated runtime usage and AWS speech infrastructure. Report ready/private, explicit grant to rally_admin. Local stop returned3.5s and camera animation appeared, but user observed a frozen lingering participant; real departure acceptance failed. Chat click attempted, delivery unconfirmed; no automatic retry. Fix actual leave acknowledgement before further rehearsal.

## Teams leave acknowledgement rehearsal — October30

One live join,26processed ASR seconds estimated $0.00130000 and one report $0.02563345. Batch **$0.02693345**, unknown0, TTS disabled. Tracked total **$1.86086795**; conditional unverified-$150 remainder **$148.13913205**. Client reached post-call UI and closed both peers before camera teardown; user confirmed clean departure. Chat message appeared as plain text, confirmed by user; clickable URL formatting requires follow-up. Both reports grant rally_admin; user reports denial under their signed-in account, account/URL clarification pending.


## Long-turn and endurance preparation — October 31

A two-minute controlled-input real-provider pilot passed normal-speed LiveKit audio, real Muse ASR, an accelerated planned handoff, real streaming Seamless output and a complete report. Sixteen Muse usage rows settled at **$0.17267055**, unknown0. Two AWS speech requests retain unknown infrastructure cost. [Pilot evidence](provider-endurance-pilot-2026-10-31.json).

The first standalone long-turn check spent **$0.00266355** on preparation; its live check was blocked before a provider request by the conservative final-report reserve. A separate corrected configuration bounded the unused report reserve (no report is generated by this check), then two real long-window checks passed at3.312/2.999seconds for **$0.01699770**, unknown0. [Long-turn evidence](long-turn-model-check-2026-10-31.json). No provider failure was automatically retried.

Batch known Muse spend **$0.19233180**; tracked cumulative **$2.05319975**; conditional unverified-$150 remainder **$147.94680025**. Actual Billing/grant and unrelated deployment usage remain unverified. No Teams platform was joined. The planned65-minute real-provider test is separate and must settle before adding its cost or claiming endurance.

## Completed 65-minute real-provider endurance — October 31

[Terminal evidence](provider-endurance-65-minute-2026-10-31.json): 394 Muse usage rows settled at **$3.28526990**, unknown0/running0, including real preparation, two ASR sessions, live reasoning and complete report. No automatic provider retry. Eight completed Seamless requests have **unknown AWS infrastructure cost**, separate from Muse; together with the pilot this task made ten speech requests.

Current long-turn/endurance task batch known Muse **$3.47760170** including the earlier pilot and standalone checks. Tracked cumulative **$5.33846965**; conditional unverified-$150 remainder **$144.66153035**. Actual Billing/grant and unrelated deployment usage remain unverified. The run used authored synthetic speech and did not join Teams.

## Voice naturalness preparation — November 1

Zero new Muse calls. Local pinned MMS generated a same-text before/after pair and seven narration clips with sentence pauses; it made no speech-provider API calls. One separately gated, non-retrying real Seamless request generated7.58seconds, uncached, first PCM1.539seconds. **AWS infrastructure cost remains unknown**, recorded separately from Muse. [Evidence](voice-quality-2026-11-01.json). Tracked Muse remains **$5.33846965**; conditional unverified-$150 remainder **$144.66153035**, excluding unverified unrelated runtime activity. No platform was joined and no final entry/upload was performed.

## Local pronunciation reference follow-up — November 1

Zero new Muse calls. A pinned local CMU reference and model-specific grapheme corrections prepared the revised MMS narration without speech API charges. One new non-retrying hosted Seamless sample generated8.48seconds, uncached, first PCM1.505seconds. **AWS infrastructure cost remains unknown**, separate from Muse. [Measurements](pronunciation-reference-2026-11-01.json). Tracked Muse remains **$5.33846965**; conditional unverified-$150 remainder **$144.66153035**, excluding unverified unrelated runtime activity. No platform join or final submission.

## Selected Jobs speech pilot — November 2

Three production-adapter Muse ASR calls:45s discovery **$0.00225000**,13.4s original clip **$0.00065000**,6.496375s MMS clip **$0.00030000**; conservative whole sent-or-processed-second estimates. [Results](jobs-tts-pilot-2026-11-02.json). Batch **$0.00320000**, unknown0/running0. Tracked cumulative **$5.34166965**; conditional unverified-$150 remainder **$144.65833035**, excluding unverified unrelated activity. One failed Seamless request retains **unknown AWS infrastructure cost**; no automatic retry. Local MMS has no API fee. The selected21-word comparison uses a documented podcast recording of the Stanford speech; YouTube audio identity is unverified. No meeting join, upload, production restart or final submission.
