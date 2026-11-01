# Live-footage edit and Monday shot list

The existing video remains a complete 180-second synthetic walkthrough. The new local edit draft adds visible placeholders for Monday's actual footage. No unavailable live shot is presented as recorded evidence. The [script](demo-script.md) supplies narration and Meta model roles; [provenance](demo-feedback-draft.md) describes the base. This edit is local, unuploaded and unsubmitted.

## Capture these shots

Record a 1920×1080 landscape master if possible, with system audio and no notification overlays. Keep the remote Teams view distinct from the Rally dashboard; a local renderer preview does not establish what another participant sees. Leave several seconds of handles before and after each action. Record longer than the target slot so an editor can choose a clean actual-speed excerpt. Use headphone audio to avoid duplicate mic/system echo.

| Slot in 180-second edit | Capture target | Minimum useful source | Evidence/label |
| --- | --- | --- | --- |
| 0:30–0:39 | Rally appears after host admission; remote view has clean framing | 15–20 s | Hide invite URL and unrelated participant details. Edited admission excerpt; no claim of instant joining. |
| 0:51–1:03 | Muse transcript updates while a person speaks; source view remains readable | 20–30 s | Actual human speech, correct visible label or explicit unknown. |
| 1:04–1:18 | Drift or missing ownership leads to useful guidance | 30–60 s continuous master | Preserve real trigger-to-response interval privately. Selected excerpt is edited, not a latency measurement. |
| 1:19.5–1:25.44 | Remote observer hears one complete short Rally utterance, with visible animated presence | 15–30 s with system audio | Only narration-free slot accepts source audio. Use one intelligible complete phrase; keep the existing attributed sample if none fits. |
| 1:29–1:38 | Pause stops speech; voice-off leaves response visible | 15–25 s | Actual host control; do not stage a fixture as a live stop. |
| 1:51–2:05 | Final report with real condition, accepted action and clickable source | 20–30 s | Remove unapproved personal material. Report-generation wait may be cut with an edited-transition label. |
| 2:06–2:15 | Remote participant disappears; exact report opens under intended account | 20–40 s | Cut between these steps explicitly; never record MFA/activation material. |

A long-turn shot, shared-room ambiguity and the minute-55 warning are useful supplementary engineering footage even when they do not fit the three-minute edit. Do not manufacture an error, agreement or intervention to fill a shot. If an acceptance item fails, fix/retest it and select only accurately described footage.

## Edit preparation

The checked-in manifest is [live-demo-edit.json](../scripts/fixtures/live-demo-edit.json). All sources initially remain null. The compositor preserves the original video and writes only under ignored artifacts. It does not contact a model or upload anything.

```bash
python3 scripts/assemble-live-demo.py --check-only
python3 scripts/assemble-live-demo.py
```

The default output is `artifacts/feedback/rally-three-minute-live-edit-draft.mp4`, with an adjacent hash/provenance JSON. Each missing slot shows **LIVE FOOTAGE PENDING | EDIT SLOT**, while the base retains its synthetic replay label. This is a review/edit guide, not the finished submission video.

After footage arrives, put approved excerpts under ignored `artifacts/feedback/live/`. Copy the manifest into that directory; set source paths relative to repo root, sourceStart in seconds, and a new output path. Use the copied manifest with `--manifest`. Each selected source must contain its entire interval at normal speed. The script rejects overlapping slots, short footage, overwritten base/source files and absent requested audio. It never speed-fits or repeats a short real clip. Live replacements carry **LIVE TEAMS | EDITED EXCERPT**. Test-only clips must set sourceKind to synthetic-test and carry **SYNTHETIC COMPOSITOR TEST** instead. Missing shots keep the placeholder, never a fabricated live label.

For the voice slot only, useSourceAudio replaces the old sample audio. Other slots retain narration and mute source audio. If the real sentence does not fit the slot, keep the existing attributed synthetic-text sample and leave its label intact, or revise the narration/timeline deliberately. Do not cut off a word to imply a response that did not occur. The sidecar SRT belongs to the original narration; check any future narration change and do not apply those captions to replacement live speech.

Before a final review, revise the opening narration from “synthetic meeting replay” to an accurate mixed-footage description only once actual clips exist, then regenerate the affected local MMS narration. Keep original-work/model attribution and the last fifteen seconds as a clearly labeled future direction. Suggested close: “Today Rally guides a meeting and keeps its evidence. Next, we want preparation, conversation and follow-through in one meeting workspace, built around Meta's complementary capabilities.” This is a product direction, not a claim of a completed meeting platform.

Validate exact 180-second duration, full decoding, readable text, clean audio, approved participants and every per-segment scope label. Check the finished link signed out only after publication is separately authorized. Final submission remains on hold.
