# Rally submission package — working draft

Prepared October 29, 2026. [Submission requirements and Meta eligibility review](research/submission-requirements-meta-audit-2026-10-29.md) is the source of requirements and unresolved access questions. This is a draft, not a submitted entry. Verify the actual authenticated form before copying fields.

## Submission path and deadlines

Open the [official submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit), sign in with the accepted entrant account, select/confirm Indie Developer, designate the Representative and list all human contributors. Exact form fields and upload constraints remain unverified behind sign-in. Prepare the description, public source, working product/access instructions, original-contribution statement and three-minute video before opening the final form. Verify links as an outside viewer, submit once and retain the confirmation/receipt. Do not assume saving a draft is final submission.

Official cutoff is **November 4, 2026, 9 PM Eastern / November 5, 02:00 UTC**, according to the event page and supplied guide. Internal target: November 4 at 5 PM Eastern, leaving four hours for upload/access fixes. Feature freeze/rehearsal target: November 2; complete video and package November 3.

## Project description draft

Rally helps small software teams turn a drifting meeting into a clear decision and an owned next step. It listens with Meta Muse Voice Transcribe, uses Muse Spark to interpret the discussion against the host's agenda, and keeps decisions and actions as proposals until the host confirms them. Each outcome links back to the exact finalized transcript evidence; missing owners, deadlines and speaker identities remain visible instead of being guessed.

The host can pause or dismiss interventions, correct speaker attribution, and review a saved record with export and deletion. A server-side Teams participant is in testing. We are adding self-hosted Meta MMS voice output so moderator text can be spoken using an organizer-approved Meta model.

**Before submitting:** rewrite the last two sentences to the exact verified final release. Do not describe the current Teams transcription POC, retrospective review or local MMS WAV generation as a complete live spoken Teams moderator.

## Original hackathon contributions draft

The new Rally application includes the meeting lifecycle and host controls; streaming Muse transcription adapter; agenda/cooldown/wrap-up policy; structured reasoning and evidence validation; explicit proposal/confirmation flow; transcript revisions and correctable speakers; usage accounting and budget gates; saved records/export/deletion; the normal Teams browser queue/audio experiment; audio-pacing regression fix; Teams transcript-to-history integration; and retrospective Teams proposal review. A separate self-hosted Meta MMS adapter now produces synthetic speech on CPU.

External components are credited separately: Meta models; Meta MMS English checkpoint and CC BY-NC 4.0 weights; PyTorch/Transformers; Chromium/Playwright/PulseAudio; Node/Python; Sites hosting/runtime/storage; the user's Teams platform; development tooling; and attributed licensed evaluation audio. We did not train those models or build those platforms. Repository creation/push dates alone do not establish when code was authored; retain the actual hackathon work records. Confirm all contributors and any pre-existing material before submission.

## Runtime model declaration

| Model | Role and execution | Current evidence |
| --- | --- | --- |
| Muse Voice Transcribe | Live transcription via Meta Model API | Real provider speech tests and initial Teams live test; subsequent pacing fix needs live retry |
| Muse Spark 1.3 | Structured moderation/proposals via Meta Model API | Existing real reasoning evidence; new saved-review controller tested with mocked provider only |
| Meta `facebook/mms-tts-eng` | English voice generation, self-hosted on Rally Ubuntu CPU | Four real synthetic generated WAVs and measured timings; not yet connected to deployed browser/Teams playback |

No third-party TTS model should be used for the competition voice path. Optional local browser/OS voice diagnostics do not establish Meta model origin; the new app code disables them by default. The deployed version predates that new default until republished. Describe hosting/transport separately from AI model providers.

## Three-minute capture plan

Use the existing [storyboard](demo-walkthrough.md) with this release gate: use a surface that can actually demonstrate the complete moderation loop reliably. Teams is eligible as the primary surface only after pacing, output, echo, cancellation and departure checks pass. Otherwise use the room-microphone surface with Meta voice if ready; present Teams as an explicitly limited add-on. Neither route has yet passed the required three-person physical rehearsal.

| Time | Capture | Claim allowed only with observed proof |
| --- | --- | --- |
| 0:00–0:15 | A specific team problem and desired meeting decision | Describe the real problem; no invented ROI |
| 0:15–0:30 | Agenda, roster, consent and active capture | Show consent and actual recording state |
| 0:30–1:10 | Two genuine off-agenda turns and a useful redirect | Actual Meta processing at normal speed; no synthetic replacement |
| 1:10–1:45 | Decision/action, missing owner/deadline question, host confirmation and source links | Outcomes are proposed until the demonstrated confirmation |
| 1:45–2:00 | Host override and immediate output stop | Playback really stops and stale results stay blocked |
| 2:00–2:20 | Clearly labeled compressed wrap-up clock | Do not imply 25 real minutes elapsed |
| 2:20–2:40 | Saved transcript, confirmed outcomes, uncertainty and export | Show the actual persisted record |
| 2:40–3:00 | Meta model roles, original contribution and accessible links | Disclose limited/experimental paths concisely |

Label rehearsed scenario, retrospective processing, fallback/replay footage and clock advances. Do not accelerate the key model-response footage. Keep participants and recordings consented. Record factual observations and response-time definitions; generation time alone is not audible latency.

## Gates that are still open

- Public repository accessibility: SSH push succeeded, but unauthenticated access returned 404 in audit. Verify visibility before claiming public source.
- Source license: no root project license selected; preserve third-party licenses. Eric must choose the project license and authorize any visibility change involving existing documentation.
- Judge access: the deployed Site is restricted. Verify a usable judge path without exposing real meeting records.
- Production release: history/review/default-voice changes remain local until the owning Sites account publishes them.
- Live reliability: fresh Teams pacing retry; timeout/Leave/final drain; actual MMS playback/echo/override; three-person and intended-device rehearsals.
- Final artifacts: video, authenticated form, contributor details, final URL checks and submitted-entry receipt.

The primary validation task remains the complete, repeatable decision loop. MMS closes a real Meta voice gap. A Wonder evidence audit is the next optional enhancement only if it catches unsupported claims on a fixed evaluation. WhatsApp is useful follow-through only with an existing account, verified recipient consent and host-approved sends; no API messages have been sent. Social publishing, decorative image generation and new GPU infrastructure are deferred.
