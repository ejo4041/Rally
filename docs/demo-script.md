# Rally demonstration script — draft

Updated October 30 for the [integrated Node app](integrated-deployment.md), including [Meta MMS speech](integrated-speech.md) and [speaker correction](speaker-attribution.md). No recording or final submission has been made. The earlier Sites preview is a separate release with different confirmation, presenter and sharing controls; this script describes the integrated app.

Start with the concrete meeting problem, demonstrate the working loop, then spend the closing 30 seconds on the future meeting-platform vision. A useful prototype makes that vision credible. Describe future capabilities as future work, and let the observed interaction carry the demonstration.

## Three-minute rehearsal script

| Time | Presenter and participants | Product behavior to capture |
| --- | --- | --- |
| 0:00–0:15 | Presenter: “A transcript tells us what was said. A team still needs to decide what happens next. Rally helps a host keep a decision meeting moving, then keeps the source for its conclusions.” | Prepared agenda: decide whether Friday's release can proceed and who owns the rollback check. Identify the demonstrated release. |
| 0:15–0:30 | Presenter: “This is a rehearsed discussion with consenting participants. Muse transcribes our audio; it does not use the meeting platform's transcript.” Participants confirm consent. | Show the real capture state and finalized transcript. Complete the free audio/voice checks before the timed take. |
| 0:30–1:05 | Alex: “Can we ship Friday?” Sam: “Before that, I spent all weekend comparing mountain bikes.” Priya: “We could compare bike frames and holiday routes.” Pause for the actual response. | Actual agenda-related guidance and opt-in local Meta MMS playback at normal speed. If using Ask Rally, show the click and describe it as a host request. Never substitute a prepared model response. |
| 1:05–1:35 | Alex: “Release only after rollback is verified.” Priya: “I'll run the rollback check.” If asked for a deadline, Priya: “Thursday at three.” | Actual clarification, if produced; current plan/progress and evidence-bearing finalized speech. If the model does not ask, the host can ask directly and the record should reflect that. |
| 1:35–1:50 | Presenter: “The host keeps the floor.” Use Stop speaking during an actual prompt, or pause Rally and then resume. | Immediate local playback stop and restored listening. Explain that speech input is shielded while Rally speaks. Remote call participants hearing the prompt requires a separately verified output route. |
| 1:50–2:30 | Presenter: “After we end, Rally reviews the complete transcript. These are its interpretations: reported agreement, proposal or unresolved. Here is the source. I can correct a name or add a correction note.” | End meeting and show the actual asynchronous report when ready; follow a source link, inspect a due-out and an unknown owner/date if present, then export/reopen history. If useful, show a [reviewed WhatsApp draft](integrated-whatsapp-follow-up.md) without sending. Identify Muse reasoning and self-hosted Meta MMS voice. |
| 2:30–3:00 | Presenter: “This is the starting point. I want to build a meeting space around the work itself: arrive with an agenda, get help when a decision stalls, and leave with clear next steps. Meta models could connect preparation, conversation and follow-through. We're starting with one promise: make it clear what was decided, who owns it, and why.” | Clearly labeled **Future direction**, then return to the actual product and project links. |

The table is a rehearsal target, not a promise about response latency. If the complete report does not fit the take, record the actual wait or use a clearly identified later capture from the same meeting. Preserve ordinary speed during the key live model interaction. A transition must make elapsed time clear. Do not claim a real three-minute end-to-end turnaround unless measured.

## Participant notes

Use three people, ideally on the intended recording devices. Prepare the scenario and words; model output remains what actually happens. Leave a short pause between speakers, avoid talking over the moderator, and use Stop speaking to interrupt it. Have each speaker introduce themselves, then assign a host label only if recognizable. A shared room name does not identify the individuals in it. Keep mistakes visible enough to explain the correction path.

For a browser call, the host selects the call tab with Share tab audio and can include their microphone. WhatsApp Web is a possible Meta-owned call surface only if its call works on the actual browser/device; the selection preset alone proves nothing about platform support. Zoom Web, Meet or Jitsi use the same capture boundary. Rally is not automatically a participant in these calls. Do not promise remote audibility of its host-browser voice. Use a room microphone for the main take if that is the surface the team has actually rehearsed successfully.

The Teams invitation remains a bounded transcription test. The WhatsApp guest prototype still needs a fresh link and admission/audio validation. Neither should become the main demonstration until its full intended path has been observed.

## Longer show-and-tell

Use the [longer presenter script](show-and-tell-script.md) for a separate six-to-eight-minute talk. Spend one minute on the team problem, three on the prototype, one on architecture and observed limits, then one to two on the future platform. Expand the source/correction example and invite feedback about real meeting habits. Keep this talk distinct from the required three-minute submission video. No adoption, revenue, accuracy or time-savings claim has been established by the current tests.

The implemented Meta responsibilities are complementary: Muse Voice Transcribe supplies speech evidence, Muse Spark reasons about agenda/progress/outcomes, and the local MMS adapter makes approved prompts audible. Future services should solve a clear user need and retain replaceable capability boundaries. The pitch does not require claiming every Meta service is integrated.

## Before recording

Use the [integrated rehearsal packet](integrated-rehearsal.md). Verify physical sound, microphone/remote input, cancellation and the complete report on the chosen devices. Keep real consent, errors, pauses and model timing accurate. The eight-hour synthetic speech check is reliability evidence, not a participant meeting or a demo recording. Submission remains on hold.
