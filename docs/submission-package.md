# Rally submission package — working draft

**Current implementation:** [Version 12](releases/2026-10-29-v12.md) is deployed with browser meeting inputs, a free local audio check, confirmed WhatsApp follow-up drafts, presenter view, saved Teams review, configurable model adapters and MMS browser playback. Real platform/device calls, Teams speech output and the full three-person rehearsal remain pending.

**Submission status:** Draft preparation only. The user has explicitly put final submission on hold; a separate instruction is required before submitting an entry.

Prepared October 29, 2026. [Submission requirements and Meta eligibility review](research/submission-requirements-meta-audit-2026-10-29.md) is the source of requirements and unresolved access questions. This is a draft, not a submitted entry. Verify the actual authenticated form before copying fields.

## Submission path and deadlines

Open the [official submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit), sign in with the accepted entrant account, select/confirm Indie Developer, designate the Representative and list all human contributors. Exact form fields and upload constraints remain unverified behind sign-in. Prepare the description, public source, working product/access instructions, original-contribution statement and three-minute video before opening the final form. Verify links as an outside viewer, submit once and retain the confirmation/receipt. Do not assume saving a draft is final submission.

Official cutoff is **November 4, 2026, 9 PM Eastern / November 5, 02:00 UTC**, according to the event page and supplied guide. Internal target: November 4 at 5 PM Eastern, leaving four hours for upload/access fixes. Feature freeze/rehearsal target: November 2; complete video and package November 3.

## Project description draft

Rally helps small software teams turn a drifting meeting into a clear decision and an owned next step. It listens with Meta Muse Voice Transcribe, uses Muse Spark to interpret the discussion against the host's agenda, and keeps decisions and actions as proposals until the host confirms them. Each outcome links back to the exact finalized transcript evidence; missing owners, deadlines and speaker identities remain visible instead of being guessed.

The host can use a room microphone or select audio from a browser call, with WhatsApp Web, Zoom Web, Google Meet and Jitsi presets. A free local check verifies input levels before transcription starts. Moderator prompts stay with the host; self-hosted Meta MMS provides optional browser voice. Presenter view provides a clean display of prompts and confirmed outcomes. The host can pause or dismiss interventions, correct speaker attribution, and review a saved record with export and deletion. Confirmed outcomes can be reviewed and opened as a WhatsApp draft for the host to send manually.

A separate server-side Teams transcription participant is in testing. Spoken Teams moderation and real-call validation for the new browser presets remain pending. These are the release's current implementation limits; refresh them against observed device results before recording.

## Original hackathon contributions draft

The new Rally application includes the meeting lifecycle and host controls; streaming Muse transcription adapter; agenda/cooldown/wrap-up policy; structured reasoning and evidence validation; explicit proposal/confirmation flow; transcript revisions and correctable speakers; usage accounting and budget gates; saved records/export/deletion; the normal Teams browser queue/audio experiment; audio-pacing regression fix; Teams transcript-to-history integration; retrospective Teams proposal review; browser-tab/microphone mixing and capture cleanup; a free local audio check; and confirmed-only WhatsApp draft sharing. A separate self-hosted Meta MMS adapter produces speech on CPU and serves it through the protected browser player.

External components are credited separately: Meta models; Meta MMS English checkpoint and CC BY-NC 4.0 weights; PyTorch/Transformers; Chromium/Playwright/PulseAudio; Node/Python; Sites hosting/runtime/storage; the user's meeting platform; development tooling; and attributed licensed evaluation audio. We did not train those models or build those platforms. Repository creation/push dates alone do not establish when code was authored; retain the actual hackathon work records. Confirm all contributors and any pre-existing material before submission.

## Runtime model declaration

| Model | Role and execution | Current evidence |
| --- | --- | --- |
| Muse Voice Transcribe | Live transcription via Meta Model API | Real provider speech tests and initial Teams live test; subsequent pacing fix needs live retry |
| Muse Spark 1.3 | Structured moderation/proposals via Meta Model API | Existing real reasoning evidence; new saved-review controller tested with mocked provider only |
| Meta `facebook/mms-tts-eng` | English voice generation, self-hosted on Rally Ubuntu CPU | Real CPU waveform measurements and protected hosted browser playback/Stop checks; physical listening and Teams speech output pending |

No third-party TTS model should be used for the competition voice path. Optional local browser/OS voice diagnostics do not establish Meta model origin; the new app code disables them by default. Version 11 retains that disabled default. Describe hosting/transport separately from AI model providers.

## Three-minute capture plan

Use the existing [storyboard](demo-walkthrough.md) with this release gate: use a surface that can actually demonstrate the complete moderation loop reliably. Teams is eligible as the primary surface only after pacing, output, echo, cancellation and departure checks pass. Otherwise use a verified room-microphone or meeting-tab surface with Meta voice when ready; present Teams as an explicitly limited add-on. The browser presets are host-side audio capture. No route has yet passed the complete three-person physical rehearsal. Run the free audio check before recording the browser variant.

| Time | Capture | Claim allowed only with observed proof |
| --- | --- | --- |
| 0:00–0:15 | A specific team problem and desired meeting decision | Describe the real problem; no invented ROI |
| 0:15–0:30 | Agenda, roster, consent and active capture | Show consent and actual recording state |
| 0:30–1:10 | Two genuine off-agenda turns and a useful redirect | Actual Meta processing at normal speed; no synthetic replacement |
| 1:10–1:45 | Decision/action, missing owner/deadline question, host confirmation and source links | Outcomes are proposed until the demonstrated confirmation |
| 1:45–2:00 | Host override and immediate output stop | Playback really stops and stale results stay blocked |
| 2:00–2:15 | Clearly labeled compressed wrap-up clock | Do not imply 25 real minutes elapsed |
| 2:15–2:30 | Saved evidence, confirmed follow-up preview and actual Meta model roles | Show the persisted record; WhatsApp sending stays manual |
| 2:30–3:00 | Clearly labeled future meeting-platform direction, ending on the actual product/links | Describe the future vision separately from implemented behavior |

Label rehearsed scenario, retrospective processing, fallback/replay footage and clock advances. Do not accelerate the key model-response footage. Keep participants and recordings consented. Record factual observations and response-time definitions; generation time alone is not audible latency.

## Gates that are still open

- Public repository accessibility: SSH push succeeded, but unauthenticated access returned 404 in audit. Verify visibility before claiming public source.
- Source license: no root project license selected; preserve third-party licenses. Eric must choose the project license and authorize any visibility change involving existing documentation.
- Judge access: the deployed Site is restricted. Verify a usable judge path without exposing real meeting records.
- Production release: version 12 is deployed on the existing restricted Site; capture/API/native-metering evidence is documented. Real platform calls and full user-session validation remain open.
- Live reliability: fresh Teams pacing retry; timeout/Leave/final drain; actual MMS playback/echo/override; three-person and intended-device rehearsals.
- Final artifacts: video, authenticated form, contributor details, final URL checks and submitted-entry receipt.

The primary validation task remains the complete, repeatable decision loop. MMS closes a real Meta voice gap. A Wonder evidence audit is the next optional enhancement only if it catches unsupported claims on a fixed evaluation. WhatsApp follow-through is implemented as a preview and manual draft, without Business API setup. The host chooses a recipient and sends in WhatsApp; no messages have been sent by this build. Social publishing, decorative image generation and new GPU infrastructure are deferred.
