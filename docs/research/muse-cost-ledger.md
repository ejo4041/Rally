# Muse API cost ledger

Costs are estimates from response usage and published Standard prices, not billing receipts.
Actual grant application, prior/shared usage, and current Billing balance are unverified.
The $150 remainder below assumes the full grant is applied and no other usage exists.

[Official pricing](https://dev.meta.ai/docs/pricing-rate-limits): Spark input $1.25/M, cached input $0.15/M, output $4.25/M; Voice Transcribe $0.18/hour.

Known estimated spend: **$0.18462115**. Conditional $150 remainder: **$149.81537885**.
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
