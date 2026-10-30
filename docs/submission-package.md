# Rally submission package — working draft

Updated October 30 for the [integrated Node deployment](integrated-deployment.md), with [current access observations](research/submission-access-check-2026-10-30.md). This is preparation only. **Final submission is on hold** pending a separate user instruction. Authenticated form fields, contributor details and receipt have not been verified.

## Entry path and working requirements

Use the [official submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) with the accepted entrant account. The [official event page](https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon) currently lists **November 4, 2026, 9 PM Eastern / November 5, 02:00 UTC**. Check it again before submitting. The supplied [participant guide](hackathon-participant-guide.md) records the public-repository, accessible three-minute-video, original-contribution and contributor-list requirements. The latest public-page recheck could not independently recover every form requirement; absence from a marketing page does not remove a guide requirement.

Prepare the description, contributor/Representative details, source license/access, working product instructions and video before entering the final form. Verify links signed out, submit once only when instructed, then retain the receipt. Saving a draft and final submission are distinct actions.

## Project description draft

Rally helps a small software team keep a decision meeting moving and retain the evidence for what happens next. Muse Voice Transcribe supplies finalized speech and anonymous speaker labels. Muse Spark interprets the discussion against the agenda, offers concise guidance and reviews the complete transcript. The report distinguishes reported agreement, proposal and unresolved outcomes. Source links, uncertain owners/dates and host correction notes make those interpretations reviewable.

The host captures a room microphone or selects a browser meeting tab, with an optional host microphone. A free local input check runs before paid transcription. Optional self-hosted Meta MMS speaks approved prompts in the host's browser, with Stop, pause/dismiss cancellation and input shielding. Host speaker labels are reversible and remain scoped to a transcription session; a room name or roster does not verify individual identity.

After the meeting, the host reviews a saved report, follows source evidence, adds durable annotations, exports the record and builds an editable WhatsApp follow-up from selected rows. The host chooses recipients and sends manually in WhatsApp. Teams has a separate bounded transcription-test invitation. WhatsApp guest calling remains a prototype awaiting a fresh host admission/audio trial. Neither route is claimed as verified remote spoken moderation.

## Original contribution draft

Rally application work includes authenticated owner-isolated meeting/history APIs; canonical transcript revisions and evidence validation; agenda/progress/intervention policy; provider budget/unknown-cost accounting; complete-report semantics and scored coverage; normalized model capability interfaces; Node/LiveKit browser capture; opt-in local MMS playback/cancellation/shielding; reversible session speaker labels and late-metadata corrections; stale-report handling and durable annotations; reviewed WhatsApp drafts; and normal-browser guest transport/audio experiments.

The earlier Sites application is a separate hackathon iteration with its own confirmation, presenter, demo-clock and sharing workflow. Identify any of those controls separately if they appear in footage. Do not attribute Meta models, LiveKit, Chromium or meeting platforms to Rally. Confirm all human contributors, prior material and event-period work before copying this statement into an entry.

External components retain attribution: Meta models and MMS checkpoint; LiveKit; Node/Express/SQLite; PyTorch/Transformers; Chromium/Playwright/PulseAudio; the earlier Sites runtime; licensed evaluation audio; and the user's meeting platform. See the source, model provisioning notes and evaluation records for exact provenance. Root project-source licensing remains unselected.

## Runtime model declaration

| Model | Role | Evidence and limit |
| --- | --- | --- |
| Muse Voice Transcribe | Streaming transcription and anonymous speaker labels through Meta Model API | Earlier real provider/Teams tests and Node pipeline experiments; current changes use offline decoder/WebSocket fixtures. No new human diarization accuracy claim. |
| Muse Spark 1.3 | Agenda, structured guidance and full report reasoning through Meta Model API | Actual backend AI examples and earlier pipeline evidence; later lifecycle/annotation changes validated with injected providers. |
| Meta `facebook/mms-tts-eng` | Approved voice, self-hosted offline on Rally CPU | Pinned revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`; real local waveform and deployed browser playback/Stop checks. Weights CC BY-NC 4.0. Physical/remote audibility remains a human check. |

The organizer FAQ supplied by the user permits self-hosted MMS and excludes third-party TTS. Compatible model changes require the validated adapter interface and appropriate licensing/pricing. Hosting/transport and AI model providers are separate roles; no blanket approval of every possible external service is claimed.

## Demonstration and access

Use [the integrated rehearsal packet](integrated-rehearsal.md) and [three-minute script](demo-script.md). Show a complete useful meeting loop and the source for an outcome, then reserve the closing 30 seconds for a clearly labeled future meeting-platform vision. Preserve normal model-response speed. If a report needs a later capture, identify the transition and elapsed time. Human consent, actual input/voice, cancellation and a three-person run remain necessary before recording.

The integrated app requires Tailscale and app login. It is not public judge access. Anonymous GitHub page/API requests currently return 404; that does not distinguish a private repository from another availability issue. Resolve source access, license choice, usable judge access, finished video, contributor verification and the final receipt before claiming entry readiness. Do not change visibility or publish private meeting records as part of draft preparation.

## Local source archive preparation

`python3 scripts/export_submission.py --out /tmp/rally-source-draft.zip` creates a **local draft archive**, not a submission. It requires a Git checkout, includes only tracked files and filters known runtime/credential/model/dependency paths, SQLite sidecars and symlinks. The old Sites hosting metadata omits its private project ID. Untracked scratch transcripts or screenshots are excluded even outside the usual runtime folders. Review the resulting files and scan against configured secrets before sharing; path filters cannot prove all possible content is publishable. Archive tests use synthetic private values. No weights, account credentials or private meeting data should be distributed.

No final entry, video publication, repository visibility change or source-license choice has been performed by this draft.

A local draft from source commit `3317f1f` contains 386 filtered files. [Archive manifest/secret-value scan](research/source-draft-archive-check.json) and [clean extraction reproduction](research/source-draft-reproduction-check.json) pass: dependencies installed, 38 backend/seven frontend tests and type checks passed, LiveKit 1.13.11 downloaded with checksum verification, and the full synthetic-provider browser workflow passed. No shared credentials were loaded and no paid calls were made. The archive remains local; this does not verify public source access, licensing or submission.
