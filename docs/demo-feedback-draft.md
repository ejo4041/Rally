# Rally three-minute video — October 31 review artifact

The video records the current Node frontend from a branch based on main `a2278e0`, including simplified agenda setup, moderation settings, transcript/response history, visual presence, mobile sheets, speaker correction, final report, named-account sharing and PDF. All meeting content and ASR/reasoning responses in this walkthrough are synthetic fixtures. A permanent **SYNTHETIC REPLAY | REVIEW DRAFT** badge identifies that scope. It does not demonstrate a fresh Teams join or new live Meta inference.

## Meta roles and attribution

- Muse Voice Transcribe: implemented production audio-to-transcript path; anonymous labels are not verified identities.
- Muse Spark 1.3: agenda preparation, provisional/finalized live context, structured guidance and full final analysis.
- SeamlessM4T-v2-large: production streamed voice through the configured AWS endpoint; remote revision unknown. The video reuses one earlier synthetic-text provider sample, with no new call.
- Meta MMS: all newly generated narration uses locally provisioned `facebook/mms-tts-eng` revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`. Model weights are CC BY-NC 4.0. This narration is separately credited from production Seamless speech.
- Living Silk: supplied visual artwork/runtime, not Meta vision inference or participant emotion analysis. LiveKit, Chromium, FFmpeg and application dependencies retain their attribution.

[Word-for-word script and screen plan](demo-script.md). There are no adoption, revenue, accuracy or saved-time claims. Future-platform remarks are labeled as future direction.

## Reproduce locally

Provision local MMS/Python as in its README, install locked frontend/API/camera dependencies and use Node 24. Generate narration with `node scripts/feedback-demo-narration.mjs`. Record the two bounded browser chapters with `RALLY_DEMO_FROM=0 RALLY_DEMO_UNTIL=94` and `RALLY_DEMO_FROM=94 RALLY_DEMO_UNTIL=180`, using `node scripts/record-feedback-demo.mjs` in separate resource-limited systemd units as required by AGENTS.md. Each chapter reconstructs its own isolated fixture; the final video joins at the mobile transition. Auth enrollment occurs before recording. No production account, invite, transcript or model key is used.

Compose with `python3 scripts/render-feedback-demo.py`. Its inputs include the existing attributed synthetic Seamless sample; do not request a replacement silently. The compositor produces 1920×1080 H.264/AAC, exactly 180 seconds, permanent scope label, captions and a narration/model manifest. Narration may be gently fitted to its allotted chapter; this is edited synthetic walkthrough timing, not an inference-latency measurement.

Video, subtitles, raw footage and voice assets remain under ignored `artifacts/feedback/`. No upload or final submission has been performed. Inspect representative frames, duration, complete decoding and audio levels before sharing.

## October 31 artifact

- Video: `/srv/hackathon/rally-feedback/artifacts/feedback/rally-three-minute-narrated-draft.mp4`.
- Subtitles: same directory, `rally-three-minute-narrated-draft.srt`.
- Local voice generation: seven pinned MMS clips, no speech API call.
- Recording: two bounded isolated browser chapters, reconstructing synthetic state at the mobile transition. Both completed within 120 seconds with the shared-host memory/CPU limits.
- Validation: exact 180-second H.264/AAC output, complete decoding, representative frame inspection, and audio-level checks. [Artifact manifest](research/meta-demo-video-2026-10-31.json) pins the final file hash.

The source/footage scripts and narration text are versioned; large video/audio artifacts remain outside Git. No production service restart, meeting join, video upload or final submission occurred during this work.

## November 1 live-footage preparation

A second local edit draft preserves the original and adds seven explicit live-footage placeholders. [Shot list, timing and assembly instructions](demo-live-edit.md). The compositor supports normal-speed approved clips and source audio only during the narration-free voice slot. Until those clips are supplied, the output is an edit guide over the synthetic base, not a real meeting recording.

## November 1 voice revision

A new local candidate under `artifacts/feedback/voice-natural-v1/` uses shorter narration, local MMS sentence synthesis with deliberate pauses, technical-term pronunciation and measured sentence captions. It remains exactly180seconds and uses no narration acceleration. Original draft and real-footage edit guide remain separate artifacts. [Voice changes, samples, limitations and usage](speech-naturalness.md). Listener preference and the actual human meeting test remain pending.

## November 1 pronunciation reference candidate

The latest local candidate is `artifacts/feedback/voice-lexicon-v2/rally-three-minute-narrated-draft.mp4`. It preserves sentence pacing and corrects model-facing Meta/evidence spelling through the shared [local pronunciation reference](pronunciation-reference.md). Canonical captions and the synthetic replay label remain unchanged. All177unique demo word tokens have references; that is coverage, not proof of correct sound. Full listening acceptance is pending.

## Agenda correction candidate

The newest local revision is `artifacts/feedback/voice-agenda-v3/rally-three-minute-narrated-draft.mp4`, with the shared MMS `agenda` → `ajenda` cue. Sentence timing, original captions and the synthetic replay disclosure remain. Full-sentence before/candidate/alternative WAVs accompany it; listener acceptance remains pending. [Pronunciation notes](pronunciation-reference.md).
