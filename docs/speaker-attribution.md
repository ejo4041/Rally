# Speaker attribution in integrated Rally

Muse Voice Transcribe supplies anonymous voice labels. Rally does not read platform captions or native transcripts and does not automatically know a participant's Teams, WhatsApp or Zoom display name. An entered roster offers suggestions for host labeling; it does not identify voices.

Each label is keyed by transcription session and provider label. Anonymous UI labels include a session number so `A` after reconnect is distinguishable from `A` before reconnect. The host can assign a label to a recognized voice, or leave the name field empty to remove an assignment. Clearing restores the anonymous label and does not merge transcript turns or alter their text. Duplicate save requests with the same value do not advance the moderation epoch.

A shared room connection can contain multiple speakers. Muse may separate some voices, merge voices, split one person into several labels, or return no speaker. A room's platform display name identifies the connection, not the people in it. Assign individual names only when recognizable; otherwise retain anonymous labels or a truthful shared-room label. Reliable person-level identification in shared rooms has not been established by the current experiments. Voice labels are not biometric identity verification.

Changing labels during final report processing is rejected so a paid result is not invalidated mid-flight. Changing them after a report is ready marks `reportStale=true`; existing conclusions retain their original wording and the UI warns that names may be outdated. Transcript display labels update immediately. No model request is made by naming or clearing a speaker. **Reanalyze · uses Muse** is an explicit request through the existing budget gates; a successful report clears the flag. Export includes the mappings, raw session-scoped labels and stale flag. Existing records without this optional field are treated as current until a label changes.

`PATCH /api/meetings/:id/speakers` accepts `{speakerId, name}` where `name` is a trimmed 1–100 character string or `null` to clear. Unknown labels and another owner's meeting are rejected. `GET /api/meetings/:id/report` also exposes `stale`. The report itself remains an AI interpretation grounded in final transcript evidence.

Backend validation covers clear/no-op behavior, ownership, unknown labels, processing conflicts, stale results and explicit regeneration. Browser validation covers assignment, clearing, anonymous session display, reload persistence, warning/export and the absence of automatic analysis. A human multi-speaker rehearsal remains the quality gate.

## Correction notes and reanalysis

Host correction notes are stored separately as `reportNotes` and retained when a model report is regenerated. They remain visibly labeled host annotations in the summary and export; they do not rewrite transcript evidence or automatically revise an action row. Reanalysis excludes the previous generated report and annotations from model input, then restores the notes after the new result. New notes include their saved timestamp, are trimmed and capped at 4,000 characters each and 50 notes per meeting. Older appended correction segments are retained as legacy text with unknown timestamps and a legacy marker; their old format did not independently preserve authorship metadata. Tests cover note ownership, whitespace rejection, one-time legacy migration and preservation across label changes/regeneration.

## Late provider metadata

The Muse decoder now republishes a completed turn when later speaker/timing metadata changes its normalized meaning. It keeps the same session/turn ID; canonical storage advances the revision rather than adding another transcript row. Repeated identical labels produce no extra final. A later second voice label within that turn changes attribution back to unknown. Timing corrections also remove labels whose timestamped evidence falls outside the corrected bounds. Revised evidence cancels pending speech and cannot approve an assessment based on the superseded revision. Empty new final text and malformed/nonfinite timing do not become usable speech evidence. Labels that cannot be uniquely associated with a known timed turn remain unknown.

This fixed an offline fixture where late labels were accumulated internally but never reached canonical final storage. Decoder tests, a local WebSocket final-drain test and HTTP speech cancellation checks pass. This is a parser/lifecycle correction, not a newly measured increase in real-meeting diarization accuracy.

## Reviewing then resuming interrupted capture

A successfully resumed capture marks an existing report as stale while retaining its original result and host notes. The report shows that it covers an earlier transcript. Draft sharing and reanalysis controls are withheld during live capture; ending triggers analysis of all finalized turns and a successful result clears the flag. A failed audio start leaves the prior report current. This does not automatically request another model result at resume. An ended/imported transcript with no report offers an explicit **Analyze · uses Muse** action; importing still never starts analysis automatically.
