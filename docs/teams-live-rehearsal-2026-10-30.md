# Live Teams rehearsal — October 30, 2026

The user reports a successful Teams test after correcting the integrated Chromium library path. The backend snapshot confirms connected Teams capture and completed call-only streaming speech with a cache hit. This is evidence of one successful user-reported trial, not broad tenant/network reliability. The meeting was still live when inspected; this inspection did not stop it or initiate model calls.

## Saved guidance results

Agenda: identify the three most important things to finish for Rally.

The saved spoken redirect was:

> Let's get back on track. Noted visualization as one candidate. Let's park open-source and other-project uses for now and collect 2-3 more finish candidates for the top-3 list.

Latest assessment at the inspection checkpoint:

```json
{
  "health": 4,
  "reason": "About 4 min elapsed of 10 with only one candidate captured and no new finalized turns after the redirect; time to collect remaining candidates and prioritize is tightening.",
  "issues": ["pacing"],
  "progress": "Brainstorm started with UI visualization / living mesh as one finish candidate; no ranked top-3 yet.",
  "intervention": null,
  "plan": null,
  "planReason": "No new finalized turns to evaluate response to redirect and no structural blockage; rebudget not warranted yet."
}
```

The store preserves the latest assessment and accepted interventions, not a full assessment history. Usage records establish four completed assessment requests by this checkpoint but do not retain their complete outputs. The redirect above is the saved approved intervention text, including the service-added opening, not a reconstructed full model response.

## Timing and delayed interruption

Times relative to capture start, from persisted transcript/model/speech records:

| Event | Elapsed |
| --- | --- |
| First detected speech begins | 6.7 s |
| First detected speech ends | 95.9 s |
| First assessment request starts | 101.108 s |
| Redirect approved/saved | 106.335 s |
| First TTS bytes / playback shielding starts | approximately 107.27 s |

The finalized transcript contains one 89.2-second speaking turn. `Engine.tick` assesses only persisted finalized turns (last 40); live partial captions do not enter its snapshot. It skips inference if no finalized turns exist. Therefore a long continuous first turn prevents the checker from assessing its evolving content. This is not an explicit wait-for-silence rule in the speech output path.

Measured gap from detected speech end to first audio is approximately 11.4 seconds: 5.2 seconds until the first recorded assessment request (includes unknown finalization/next-tick timing), 5.2 seconds for assessment/approval, and 0.922 seconds to first TTS bytes. Exact provider turn-final event arrival was not durably logged, so it cannot be separated from interval scheduling using these records.

The speech request reports cached=true, 333,440 PCM bytes / 10.42 seconds, completed. AWS cost remains unknown. Four assessment requests total $0.01882950; preparation was $0.00452, giving $0.02334950 in confirmed reasoning charges at this checkpoint. Live transcription had not settled, so this is not a final meeting cost or updated cumulative grant balance. These calls were initiated by the user's live test, not this read-only inspection.

## Follow-up decision

To intervene during a long speaking turn, the assessment path needs bounded provisional transcript context or shorter finalized segmentation. That is a behavior change requiring safeguards for unstable text, late revisions, duplicate intervention prevention and increased inference frequency. No such change was made during this inspection. The existing ten-second status heartbeat must not be confused with ten-second inference on partial speech.
