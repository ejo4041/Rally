# Presenter recording package — November 3, 2026

Closing revision: [next-chapter pitch](demo-next-chapter-pitch.md) offers a stronger future-direction close, an optional opening callback and visual cues. Record it as an alternative to the closing below; do not append both.

Draft for a three-minute presenter-led Rally video. Record the human presenter and screen footage separately, then assemble face-to-camera opening/closing, product footage and a movable corner overlay. The timeline below is a target edit, not measured delivery timing. Leave room for an actual Rally voice excerpt. Final submission remains on hold.

## Script and edit cues

Replace [Name] before recording. Read conversationally, about 135–145 words per minute. Record each chapter independently, twice, with two seconds of silence before and after. If a take runs long, shorten wording rather than accelerate the audio. Read only the quoted narration.

### 0:00–0:15 — Personal hook, full-screen presenter

“Ever leave a meeting thinking, ‘Wait—what did we actually decide?’

I'm [Name], and I built Rally during this hackathon to help teams leave with clear decisions, owners, and next steps. Let me show you.”

Visual: face at eye level, name and Rally lower third, then cut directly to the product.

### 0:15–0:35 — Problem, product footage with presenter in the corner

“Picture a release meeting. The conversation drifts. Someone says, ‘We should check that before Friday.’ But who owns it? And did we agree to ship?

Rally follows the conversation and helps bring those questions back into focus while the meeting is happening.”

Visual: agenda, transcript and an unresolved action. Use illustrative text only as a clearly labeled example; do not pass it off as actual meeting output.

### 0:35–0:55 — Setup and planning

“Start with the outcome you need, your agenda, and the time available. Meta's Muse Spark turns that into a meeting plan.

Choose how actively Rally should participate. With consent, start capturing the conversation, or connect through the Teams meeting path.”

Visual: agenda entry → prepared plan → guidance setting → consent → connected meeting excerpt. Cut setup waits visibly where needed.

### 0:55–1:20 — Meta listens and reasons

“Meta's Muse Voice Transcribe supplies the transcript. Muse Spark uses the conversation, the agenda, and the time remaining to generate relevant guidance.

Here, watch the conversation and the response together. Rally brings the missing owner back into focus, and the host can decide how to move forward.”

Visual: transcript, actual related guidance and its evidence. Select a matching recorded event. If unavailable, revise this sentence or label a replay clearly. Brief model label: Muse Voice Transcribe → Muse Spark 1.3.

### 1:20–1:30 — Let Rally speak

No presenter narration. Play one complete short actual Rally utterance with its source audio. Choose an excerpt that fits; do not fabricate wording or cut away a condition. Remove the face overlay briefly so the product has the stage. Ten seconds is an edit allowance, not a claim about response latency.

### 1:30–1:53 — Meta speech and host control

“That reply is voiced by Meta's SeamlessM4T. The host can pause or stop Rally, and its response stays visible for review.

The integration brings transcription, reasoning, and speech into one meeting flow, with controls that keep the host in charge.”

Visual: actual speech event, pause control and visible response. Use the Seamless attribution only with a Seamless-generated excerpt. For an MMS/FastSpeech2 excerpt, substitute the correct model name.

### 1:53–2:23 — Outcomes and evidence

“When the meeting ends, Muse Spark reviews the complete transcript. You get decisions, action items, and unresolved questions, with links back to the supporting conversation.

Missing owners and dates stay unresolved. You can review the evidence, make a correction, export a PDF, or share the report with a named Rally account.”

Visual: report → conditional decision → unresolved owner → source link → correction/PDF/sharing. Keep each detail readable; select fewer shots if narration delivery leaves less time.

### 2:23–2:40 — Original integration and Meta roles

“During the hackathon, I built the meeting workflow, host controls, and evidence-linked records around Meta's models.

Muse transcribes. Spark plans, guides, and reviews. Seamless speaks. Rally connects those capabilities around the decisions a team needs to make.”

Visual: simple three-role graphic with product footage behind it. This is an original-integration statement, not a claim to have built the models or supplied artwork. Presenter narration is the user's real voice; remove any old credit saying MMS narrates this version.

### 2:40–3:00 — Return to full-screen presenter, product vision

“Today, Rally helps teams turn a conversation into clear next steps.

The bigger vision is a meeting workspace built around Meta AI: preparation before the call, useful guidance during it, and follow-through afterward.

That's where I want to take Rally. Better meetings, with decisions you can act on.”

Visual: presenter returns; label the expanded workspace as future direction. End on Rally and a clean product shot. Keep the vision under twenty seconds so the working product remains central.

## Recording tools, checked November 3

| Tool | Best use tonight | Verified first-party facts |
| --- | --- | --- |
| [OBS Studio](https://obsproject.com/) | Recommended screen/B-roll recorder, or webcam/mic recorder on Windows, Mac or Linux | Free/open source; supports scenes with screen/window/webcam sources. [Quick start](https://obsproject.com/kb/quick-start-guide/), [sources](https://obsproject.com/kb/sources-guide). |
| [QuickTime Player on Mac](https://support.apple.com/guide/quicktime-player/record-a-movie-qtp356b55534/mac) | Simplest Mac face-and-voice take | File → New Movie Recording; choose camera and microphone. High quality is H.264/AAC; Maximum creates much larger ProRes/PCM files. Screen recording is a separate workflow. |
| [Microsoft Clipchamp](https://support.microsoft.com/en-us/clipchamp/what-is-clipchamp) | Browser alternative for camera capture and optional manual editing | Personal free plan has watermark-free export up to 1080p; premium assets/features can require payment. [Webcam recorder](https://support.microsoft.com/en-us/clipchamp/how-to-record-a-webcam-video), [free plan](https://clipchamp.com/en/pricing/). |

Recommended capture approach: laptop webcam/mic or an existing phone camera for clean presenter takes, plus OBS for separate clean screen footage. No paid editor or recorder plugin is needed. Camera placement, framing and capture settings below are editorial recommendations, not vendor guarantees. For this plan, recording tools only capture media; narration is human and Rally's runtime model roles remain Meta/Muse.

## Quick recording setup

1. Landscape 1920×1080, 30 fps when supported; use standard SDR. Frame chest-up, leave some space around your head, put the lens at eye height and face a soft light. Keep the script near the lens. A phone on a stable support is sufficient if its picture is better.
2. Record a twenty-second test and play it back with headphones. Check speech clarity, lip sync, camera focus and readable UI. Start with one microphone; aim for healthy levels without clipping. Do not buy equipment for this recording.
3. Record presenter chapters without desktop audio. Record clean screen B-roll separately, and capture system audio for the Rally speech excerpt. Use headphones while playing Rally to avoid speaker-to-mic echo. If separate devices record the same event, clap once visibly/audibly at the start to assist synchronization.
4. In OBS: run the Auto-Configuration Wizard for recording; create a Camera scene with Video Capture Device + mic, and a Screen scene with the appropriate screen/window source. Keep source files separate by recording these passes independently. Adding both sources to one ordinary OBS scene burns the overlay into one video; it does not give the editor separate video tracks.
5. OBS recommends MKV for resilient recording; File → Remux Recordings can make an MP4 afterward. Preserve the MKV original. [OBS recording/output guide](https://obsproject.com/kb/standard-recording-output-guide). A standard H.264 hardware encoder is a practical choice where available. Mic 48 kHz if supported; other normal sample rates can be converted in the edit.
6. Record two takes of each chapter. Pause, then restart the whole sentence after a mistake. Do not stop to edit every take. Keep original files and capture a few seconds of quiet room tone.

## B-roll and energy

The demo's own UI is the most useful B-roll: agenda creation, consent/start, connected Teams view, transcript updates, one useful intervention, pause, report evidence and PDF. Record 15–30 seconds per simple shot, longer for the actual intervention. Hold the screen still before and after the action; avoid constant cursor movement. Use [the detailed live shot list](demo-live-edit.md).

Open and close full-screen on the presenter. In product chapters, a rectangular or rounded face inset around 20–24% of frame width is a useful starting point; choose its corner per shot so it never covers evidence, captions or host controls. Hide it for detailed UI closeups and Rally's speech. Alternate wider product shots with purposeful closeups every several seconds, while leaving enough time to read. Aim for an engaged conversation with one person: emphasis, brief pauses and a smile, rather than racing the script. Background music is optional; clear voice and product sound are the priority.

Capture only approved participant material. Existing synthetic walkthrough clips retain their replay labels; real meeting excerpts retain their actual provenance. Do not imply edited response timing is a latency measurement. Do not call WhatsApp/Zoom production integrations complete. FastSpeech2 is experimental with mixed listener preferences and a reported postpone pronunciation issue; keep it out of the main success claim. An optional engineering insert can truthfully say: “I'm also testing a self-hosted Meta voice with direct pronunciation control.” Replacing a paragraph with that line is preferable to lengthening the video.

## File handoff for Codex assembly

Put originals under ignored `artifacts/feedback/presenter-20261103/raw/` after transfer. Do not commit raw face recordings, participant footage, credentials or invite URLs. Suggested names:

```text
01-intro-take1.mp4
02-problem-take1.mp4
03-setup-take1.mp4
04-meta-listen-reason-take1.mp4
05-speech-controls-take1.mp4
06-outcomes-take1.mp4
07-meta-roles-take1.mp4
08-close-take1.mp4
broll-agenda.mp4
broll-transcript.mp4
broll-intervention-with-audio.mp4
broll-host-pause.mp4
broll-report-evidence.mp4
```

Supply the files or a reachable local directory and note preferred takes/any material to exclude. MP4, MOV and MKV originals are usable. Keep a backup. The capture can be longer than three minutes; the final edit targets exactly 180 seconds.

Codex edit steps: inspect duration/audio/frame rate; select complete sentences; align B-roll to the words; crop/reposition the presenter; normalize/clean speech conservatively; duck underlying audio; preserve the complete Rally example; generate captions matching the actual human take; add accurate model labels and original-work credit; render a 1080p H.264/AAC review MP4 and check all 180 seconds. Existing `scripts/assemble-live-demo.py` handles fixed footage replacement; freely timed presenter overlays and new narration require extending that compositor or a new FFmpeg edit manifest. That editor work is not implemented or rendered by this document. Final upload/submission remains a separate user action.

The older [demo script](demo-script.md) describes the prior MMS-narrated synthetic walkthrough and remains its provenance record. This presenter script is the new recording draft, not a claim that the new video has already been produced.
