# Submission portal answers — November 4, 2026

Draft mapped to the authenticated form text pasted by the user. Exact dropdown choices and character limits were not supplied. No form filled, consent accepted or project submitted. Personal ratings and promotional consent remain the entrant's choices. Earlier draft claims about MMS narrating the finished video must not be reused for the human-presenter edit.

## Team Name (required)

Rally

## Team Members

Confirm the actual contributor roster in the portal. The supplied paste shows Eric Offermann / Eric-Veilant; these may be account/display labels, not separate people. Do not infer additional members from duplicate labels.

## Which track are you submitting to? (required)

Indie Developer — recorded project choice; select the matching offered option.

## Which problem statement did you build towards? (required)

Build for Your World — select the matching offered option.

## Most Viral X post link

Leave blank unless entering that award with an actual qualifying post. No post URL is supplied here.

## Project Description (required)

A meeting ends. Someone says, “We should check that before Friday.” But who owns it—and did anyone actually agree to ship?

Rally is an active meeting guide powered by Meta AI. It helps small software and product teams keep an agenda moving, surface unresolved questions, and leave with reviewable decisions and next steps.

Start with an outcome, an agenda and a time budget. Rally prepares a plan, follows the conversation through Muse transcription, and uses Muse Spark to generate relevant guidance. It can participate through the Teams integration or consented browser audio. The host controls how actively it participates and can pause, dismiss or stop it.

Rally also has a visible personality. Its animated presence changes color and movement as it follows the meeting—calm and fluid when the discussion is focused, warmer and more animated when time is tight or the agenda drifts. These visual cues give the team a shared sense of momentum before Rally needs to speak.

Afterward, Rally produces a report with decisions, action items and unresolved questions linked to supporting transcript evidence. Missing owners and dates remain unresolved. Hosts can correct the record, export a PDF and grant or revoke read-only report access.

The hackathon work includes the meeting lifecycle, model adapters, evidence validation, controlled speech, Teams and visual-presence integration, report workflow and account controls. Meta models and supplied/open-source components are separately attributed.

The next chapter is continuity from preparation through conversation and follow-through, built around Meta AI. That expanded workspace is future direction. Today, the focus is clear: know what was decided, who owns the next step, and why.

## Public GitHub Repository (required)

https://github.com/ejo4041/Rally

Verify anonymous access and the current source-license state before final entry; this draft does not establish either.

## 3-Minute Demo Video (required)

INSERT THE APPROVED, ACCESSIBLE FINAL VIDEO URL. A local MP4 path is not a submission link. Check the finished human-presenter edit's model credits, actual footage and replay labels.

## Describe your use of Meta products to build the submitted project (required)

Muse Voice Transcribe supplies Rally's streaming transcript; Rally does not rely on native Teams transcription. Muse Spark 1.3 prepares meeting plans, evaluates the conversation against the agenda and remaining time, answers addressed questions, and generates the final report from finalized transcript evidence.

Meta SeamlessM4T-v2-large renders approved interventions as speech through the configured hosted endpoint. We also implemented a pinned local Meta MMS voice option and prototyped direct phoneme control using Meta's released FastSpeech2 checkpoint and its bundled HiFi-GAN vocoder. The phoneme path remains experimental; it is not the production voice.

Rally connects these capabilities through configurable interfaces, with host controls, evidence references, cancellation and usage accounting. The animated presence is supplied visual artwork integrated with Rally's state, not a Meta vision model or an analysis of participant emotions. Application development used Codex; we do not claim Muse Code usage.

## Why are Meta's models important to your solution? (required)

Rally needs to connect what people say with the purpose of their meeting. Muse Voice Transcribe provides the speech evidence, and Muse Spark interprets that evidence alongside the agenda, time remaining and unresolved questions to produce useful guidance and a structured retrospective. Meta speech models give approved guidance a voice.

Using these complementary capabilities lets Rally support the host during the conversation and retain the source behind its conclusions afterward. The application supplies the boundaries: provisional speech is distinguished from finalized evidence, stale guidance is rejected, and missing owners or dates stay unresolved. Those controls make model output reviewable while keeping the host in charge.

The open Meta speech models also let us explore local inference and pronunciation control through the same application interfaces. Our intended long-term value is a coherent meeting workflow that can evolve with Meta's models.

## Provide feedback from your experience using partner technologies

If no direct partner use occurred: “We did not use Fireworks, Modal or Baseten for this submission, so we cannot provide firsthand feedback on those services.” Verify against any other development sessions before using this answer. AWS hosting alone does not establish use of the listed partners.

## How likely are you to build with Meta Model API? (required)

Entrant selects the offered rating based on their own intent; choices were not supplied. Suggested optional explanation: “Likely to continue: Rally already uses Muse for transcription and reasoning. Broader production use will depend on measured quality, reliability, pricing and operational fit.” Use only if it reflects the entrant's view.

## How would you describe your overall opinion of Meta Model API? (required)

Entrant selects the offered option. Suggested optional explanation: “Positive about the complementary speech and reasoning capabilities. Clearer diagnostics for failed requests and missing usage would make operation easier.” This is a proposed personal response, not an independently collected satisfaction rating.

## Permission to publish/promote submitted materials

Entrant reviews and accepts personally if appropriate. No permission checkbox has been accepted by this drafting work.

## How likely are you to recommend the Meta Model API to another developer or engineering team building with LLMs?

Entrant supplies their own rating. Do not invent a numeric answer.

## How likely are you to recommend Muse Code to another developer or engineering team?

Choose “Not used” / “Not applicable” if offered. If free text: “We used Codex for development and did not evaluate Muse Code, so we cannot provide an informed recommendation.” Do not supply an experience rating for an untested tool.

## What was the biggest obstacle your team hit while building this project?

Making an always-on meeting assistant behave reliably across transcription, reasoning, speech and host controls. Long speech turns, transcript revisions, session handoffs and cancellation all have to preserve the same source evidence and avoid stale interventions. We addressed these with explicit lifecycle state, bounded live context, revision-aware evidence checks and a 65-minute real-provider test using authored synthetic speech and isolated LiveKit. That test crossed the normal 55-minute ASR handoff; it is separate from real human Teams acceptance.

Voice quality and availability also exposed practical limits: pronunciation needed refinement, and the supplied hosted speech endpoint enforced an operating-hours policy. We retained clear model boundaries and explored local Meta voice options rather than treating a generated waveform as proof of naturalness.

## Compared with other AI models your team has used for the same kind of work, how did Meta's models perform on this project?

We did not run a controlled comparison against other vendors for this exact meeting workflow. Muse supported the transcription, agenda preparation, live guidance and reporting we implemented. Our tests focused on the complete application: evidence consistency, long turns, session handoff, cancellation and report completeness. Local Meta speech comparisons produced mixed listener preferences, so we do not claim one voice or model is universally better. A production decision would need repeatable quality and latency evaluation on representative meetings.

## When your team chooses an AI model or coding tool, what matters most?

Suggested response for entrant review: “Quality on the actual task, dependable latency, clear pricing, data controls and integration effort. For Rally, transcript fidelity, evidence-grounded structured output and predictable speech matter more than a general benchmark ranking. Good documentation and failure diagnostics affect how quickly we can build and operate the product.”

## What makes it hardest for your team to switch to a different AI model or coding tool?

Suggested response for entrant review: “Revalidating behavior and operational assumptions. A replacement needs to preserve evidence IDs, structured output, streaming audio, cancellation and timing—not just accept a similar prompt. Rally uses capability interfaces and configuration to isolate providers, but each replacement still needs representative quality, safety and reliability testing.”

## If your team took this project to production, what would most likely stop you from using Meta's models?

Suggested response for entrant review: “Inability to meet our requirements for availability, latency, speech quality, data handling or predictable cost. We would also need suitable commercial licensing for the exact open checkpoints we deploy. The observed speech-service hours belong to the configured hosted endpoint and should not be presented as a limitation of all Meta services. We would prefer to keep the Meta integration where it meets those requirements.”

## Final review

Resolve the actual video URL, repository access/license and accurate member roster. Review personal ratings/consent in the portal. Match model and footage claims to the finished demo. Field lengths and dropdown options need checking inside the form. This draft does not authorize final submission.
