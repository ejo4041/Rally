# Rally show-and-tell and platform pitch — draft

A separate six-to-eight-minute talk for the integrated app. This does not replace the [three-minute demo](demo-script.md). Run the [device and participant rehearsal](integrated-rehearsal.md) first. The timings are rehearsal targets; leave room for actual model responses and report generation. No video has been recorded or published.

## Setup

Open a prepared meeting with the objective “Decide Friday release readiness and rollback-check ownership.” Use the room microphone or call-tab setup that has passed the human rehearsal. Obtain consent, finish the free input/voice checks, and show the actual capture surface. Keep the project link and one already-saved, clearly identified rehearsal report available if the new report takes longer than the talk.

Presenter: host. Participants: Alex, Priya and Sam, or the consenting people actually taking those roles. Assign speaker names only after recognizing the corresponding voice. Prepare the discussion, not model responses. Use the actual report even if its interpretation needs correction.

## 0:00–0:45 — The meeting and the work

**Presenter:** “At the end of a meeting, I want to know three things: what did we decide, who owns the next step, and where did that conclusion come from? A transcript can help, but someone still has to turn the conversation into work.”

“Rally starts with a narrow kind of meeting: a small software team making a decision. Today we need to decide whether Friday's release can proceed and who will check rollback. I'll show the working prototype, then explain where I want to take it.”

Show the agenda and the objective. Do not open the architecture diagram yet.

## 0:45–2:30 — Help during the discussion

**Presenter:** “This is a rehearsed discussion with consenting participants. Rally captures our audio and sends it to Muse Voice Transcribe. It is not reading a Teams or Zoom transcript.”

Start actual capture. Let the finalized words appear.

**Alex:** “Can we ship Friday?”

**Sam:** “Before that, I spent the weekend comparing mountain bikes.”

**Priya:** “We could compare bike frames and holiday routes.”

Leave space for the actual guidance. If none appears, the host may click **Ask Rally**, visibly, and say: “I'm asking Rally for guidance here.” Describe the result as observed; do not claim an autonomous intervention after a host request.

**Presenter:** “The guidance is tied to the agenda and the finalized discussion. Optional speech comes from self-hosted Meta MMS. In this version it plays in my browser.”

**Alex:** “Release only after rollback is verified.”

**Priya:** “I'll run the rollback check.”

If Rally asks for a deadline, answer it. Otherwise the host asks directly.

**Priya:** “Thursday at three.”

Do not speak over Rally. Use **Stop speaking** to return the floor if needed.

## 2:30–3:00 — Host control

**Presenter:** “The host keeps control. I can stop the voice immediately, or pause moderation while we talk. Transcription continues when moderation is paused.”

Demonstrate Stop on actual playback, or Pause and Resume if there is no current voice. Show the resulting state.

“While Rally speaks, its input is temporarily shielded so its own prompt does not become meeting evidence. That also means someone talking during the window may be missed. We keep that limitation visible.”

Do not claim remote callers heard the prompt unless the intended output route has separately passed a human check.

## 3:00–4:30 — Review the result

End the meeting and wait for the actual report. If it is still processing, use the next section while it runs. If a previously saved report is needed, say: “This is an earlier rehearsal report; the meeting we just ended is still processing.” Do not silently substitute it.

**Presenter:** “These are model interpretations, so Rally distinguishes reported agreement, a proposal and an unresolved item. A suggested task is not automatically someone's commitment.”

Open a real outcome and follow its source. Check whether the conditional release and rollback owner/date were captured. An absent or incorrect detail is an opportunity to show review, not a reason to narrate it as correct.

“I can correct an anonymous speaker name and add a host note without rewriting what was said. If I change a name after analysis, Rally marks the report as needing a refresh. Reanalysis is an explicit model request.”

Show one correction or note, then history/export. If time allows, select one outcome for the editable WhatsApp draft.

“This draft includes the items I choose. I review the wording, choose the recipient in WhatsApp, and send it myself.”

Do not open the WhatsApp link or send a message during the talk unless separately intended and authorized. Copying/showing the draft is enough to explain this workflow.

## 4:30–5:15 — How the parts fit

Show the diagram from [model interfaces](model-interfaces.md).

**Presenter:** “The model responsibilities are distinct. Muse Voice Transcribe turns speech into finalized evidence. Muse Spark reasons about the agenda, guidance and complete report. Local Meta MMS gives approved prompts a voice.”

“Rally owns the meeting state: who can access it, which source a conclusion cites, when the host has paused, and whether a result is still current. The models sit behind capability interfaces. A compatible replacement can use configuration; a different protocol needs an adapter and validation.”

“The capture path works through the host's microphone or a selected browser tab. That is different from a bot joining every platform. The Teams guest test is bounded, and WhatsApp guest calling still needs an actual admission and audio trial.”

Return to the report if it has now completed.

## 5:15–6:45 — The platform direction

Use a slide or title labeled **Future direction**.

**Presenter:** “The longer-term idea is to make the meeting space understand the work from the moment people arrive. The agenda, conversation, evidence and follow-up would belong to one shared workspace.”

“Our starting user is a small software team making a release or planning decision. I would start with that repeated workflow, rather than trying to serve every meeting at once. The first question is whether the host gets a useful, reviewable result with less cleanup.”

“The next step is reliable use on the devices and call surfaces people already have. Then I want a durable work loop: bring an unresolved decision into the next agenda, carry its source and corrections forward, and let people review the proposed next step before it leaves the meeting.”

“A native meeting room could eventually bring preparation, conversation and follow-through together. That would need real participant controls, consent, identity, audio routing and permissions. Today's prototype gives us a way to test the core interaction before making that larger commitment.”

“Meta's models already cover three useful roles here: listening, reasoning and speaking. Additional integrations should earn their place by helping that work loop. We should be able to change a model without redesigning the meeting experience.”

## 6:45–7:15 — Close and useful feedback

Return to the current product and its source/report view.

**Presenter:** “What works today is a guided decision meeting with a reviewable record and manual follow-through. The next proof is repeated use with real teams: did Rally capture the right owner and condition, did people trust the source, and what did the host still have to repair?”

“If you hosted this release meeting tomorrow, which part would you trust it with first, and which part would you still want to control yourself?”

Finish on the actual app and project links. No adoption, revenue, accuracy or time-savings metric is established by this script or the synthetic tests.

## Rehearsal review

Record the actual total time and time spent waiting for guidance/report generation. Note whether people could hear the voice, whether a participant spoke during shielding, which speaker labels needed repair and whether the source supported the stated owner/date/condition. Keep private names and meeting details out of public notes unless consent covers them. Revise the talk around observed behavior before recording.
