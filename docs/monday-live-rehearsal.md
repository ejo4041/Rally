# Monday live rehearsal — November 2, 2026

Use the current integrated app at https://rally.tail703f9e.ts.net/ with the host's invited account and MFA. This is a plan, not a completed live acceptance test. The [65-minute real-provider test](provider-endurance.md) already validates the backend with authored synthetic speech; Monday establishes the human/Teams behavior and supplies optional real demonstration footage.

## Before the call — ten minutes

Use a fresh Teams invite and a host who can admit Rally. Prefer three consenting adults using separate microphones/headphones; include a second device to observe Rally's actual remote camera/audio. Agree that the test transcript is retained by Rally and a separate local screen recording may be used in the demonstration. Decide which people, names and voices may appear publicly. Use a harmless fictional release discussion rather than private work. Close notifications and unrelated tabs; keep meeting URLs, MFA enrollment/recovery screens and account details out of frame.

Sign into Rally before recording, prepare a 65-minute agenda, choose balanced guidance, enable voice and verify the host can stop it. Suggested agenda: release condition 15 minutes, ownership/deadlines 15, decision/recovery review 30, wrap-up 5. Start one call at a time. The operator should check service health, deployed revision, free disk and absence of another capture first. Do not restart production while a call/report is active.

Start the local screen/audio recording before the Teams join; capture system audio and one clean narration microphone without acoustic feedback. Keep a continuous private master for timing evidence; select shorter excerpts for the public video. Note UTC start, deployed source revision, meeting ID privately, observer and device. Never put a meeting invitation, password or MFA code into a repository result.

## Main call — 65 minutes, then report/access checks

| Elapsed | Exercise | Expected observation and record |
| --- | --- | --- |
| 0–5 min | Paste invite, confirm consent, admit Rally, inspect it from the second device. Each participant introduces themselves and says a distinct sentence. | Join reaches connected. Remote observer hears Rally and sees the intended scene without browser chrome. Transcript uses Muse labels; names are checked manually, never inferred from Teams display name alone. |
| 5–12 min | Discuss a release. Say “We can release only after rollback verification passes. We have not run it yet.” Propose an owner, then have the actual owner explicitly accept with a deadline. | Conditional release stays conditional. Proposal and actual acceptance are distinguishable from source. Record exact source wording; do not require the model to use a scripted answer. |
| 12–18 min | One speaker explains continuously for several minutes, with a corrected date near the end: “Thursday at three, not Friday at noon.” | Partial/final evidence continues, live monitoring stays active, no forced manual segmentation. A long turn may remain below 8,000 characters; only claim the measured size. |
| 18–24 min | Brief natural interruption and two overlapping voices. Include two people sharing one room microphone, if available. | Record lost/merged words and speaker errors. A room name identifies the connection, not each person. Manual naming remains reversible; do not merge labels across an ASR restart without checking the voices. |
| 24–30 min | Let a discussion drift, then return to a useful decision. Ask “Rally, what still needs an owner?” | A useful redirect or answer is visible/audible; capture actual delay. A null intervention can be correct; record what happened. While Rally speaks, say one harmless distinct sentence to check duplex retention and echo contamination. |
| 30–36 min | Pause, keep talking, then resume. Turn voice off, ask a direct question, then restore voice. Dismiss an intervention. | Pause stops moderation/speech while transcription continues. Voice-off response remains visible with no new spoken delivery. No canceled/old prompt returns after resume. |
| 36–42 min | Close the dashboard and reopen it; refresh once. | Teams capture continues independently; current transcript/response history reloads. Opening a dashboard is not a new recording and must not create a second Rally participant. |
| 42–48 min | Briefly disconnect only the observer/dashboard device, then restore it. Separately, if practical, mute one human microphone and restore it. | Distinguish dashboard loss from Rally's server-side call loss. State resynchronizes; muted silence is not a commitment or evidence of inactivity. Do not deliberately disrupt other participants' network or stop production services. |
| 48–58 min | Continue normal speech through minute 55. Observe the planned ASR restart. | Capture remains active; one continuity warning is expected. Session speaker labels reset. Confirm transcript continues on both sides and audit for any lost speech. |
| 58–65 min | Recap actual agreements, proposed ownership and unresolved checks. Correct a speaker label if recognized. End while Rally is speaking or preparing speech, if the opportunity occurs naturally. | Active voice cancels, finishing scene moves, final speech drains, a report link is attempted in allowed chat, and the remote observer confirms departure. Log whether link is clickable and any blocked-chat behavior. |
| After End | Wait for report completion; compare early/late transcript and corrected date. Open the exact posted link under the intended recipient account. Export PDF, grant/revoke a disposable named recipient if available. | Full transcript retained; conditions/unknowns preserved; sources open correctly. Recipient has report-only access when explicitly granted, without full-meeting access. Revocation denies access. Record model usage only once all rows settle. |

If the server-side Teams connection itself drops, preserve the interrupted record. Reconnect explicitly through invitation controls with host admission; do not assume the dashboard's browser reconnect button rejoins Teams. Check for a lingering participant before another join. A failed ASR drain or unknown provider cost requires inspection before another paid attempt. No automatic provider retry is expected.

## Two short repeat rehearsals

After the long run and usage review, run two separate 10–15-minute calls if participants/time allow: one normal happy path and one host-control/End path. For each: fresh invite/admission as required, one condition, one explicitly accepted action, one direct question, End, exact report access and verified departure. Do not silently reuse a prior invite or restart a failed paid call. The long run plus these repeats test repeatability; record each independently rather than converting one success into three passes.

## B-roll and evidence

Use the [shot list](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/demo-live-edit.md) for clean clips. Keep the call master untouched; public excerpts should label edits and preserve actual-speed response sequences. Public footage must not include material that participants did not approve for release. Record platform/audio evidence separately from edited footage.

Copy [the result template](live-test-result-template.md) into a dated research record after the test. Mark each item pass/fail/not exercised and attach only sanitized evidence. Note source revision, actual run duration, raw versus edited timing, speaker mapping limitations and pending costs. A report that receives all text does not establish perfect interpretation.
