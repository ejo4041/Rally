# Rally related products and optional Meta integrations

Researched October 28, 2026. This is research and implementation advice, not a claim that Rally features are implemented. No Muse/OpenAI inference calls, signups, purchases, or tenant changes were made. Existing user decisions remain in [planning interview](../planning-interview.md); event requirements are recorded in the [supplied participant guide](../hackathon-participant-guide.md).

## Related-product reference

**Recommendation:** Describe Rally as a focused moderator that turns live discussion into explicitly confirmed, evidence-linked commitments under immediate host control. Demonstrate that full loop and its measured delay. Avoid claiming to be the first assistant that talks, manages agendas, or extracts action items.

| Product | First-party documented overlap | Rally implementation focus |
| --- | --- | --- |
| Otter Meeting Agent | Voice participation, answers using meeting knowledge, and task-oriented interactions such as follow-up scheduling and email drafts. The cited announcement contains rollout details from its publication period; it does not establish current plan/platform availability for every account. | Validate the complete moderation result and its supporting transcript evidence. |
| Microsoft Teams Facilitator | Live notes, key decisions/open questions, agenda detection/tracking, countdown timers, overrun alerts, and help scheduling follow-ups. Microsoft documents a Copilot license requirement and marks some task features as preview. | Document the moderation policy, confirmation flow and host controls alongside the existing Teams integration. |
| Fireflies Live Assist | Live transcript/notes, follow-up suggestions, action items, and interactive AskFred answers. Its guide describes topic suggestions and live transcript speaker names/timestamps. | Live suggestions and action extraction are established related capabilities; validate Rally’s own implementation. |

Sources: [Otter announcement](https://otter.ai/blog/otter-meeting-agent-your-new-collaborative-teammate), [Microsoft Facilitator support](https://support.microsoft.com/en-au/teams/copilot/facilitator-in-microsoft-teams-meetings), [Fireflies Live Assist guide](https://guide.fireflies.ai/articles/6032274417-what-is-fireflies-live-assist-get-real-time-suggestions-answers-and-notes-live-during-the-meeting). These are vendor descriptions, not our comparative hands-on tests. The reviewed sources do **not** establish that competitors lack confirmation, evidence, or comparable controls.

Rally’s product scope is: “Rally keeps a decision meeting moving, asks who owns the next step, and shows exactly what the team confirmed.” Describe observed outcomes for participating teams; broader performance and economic effects remain unmeasured.

## Three-minute demonstration outline

This supplements [the existing storyboard](../demo-walkthrough.md); it does not expand scope. Use three consenting speakers discussing a software release. Label the planned scenario as a rehearsal and use actual model responses.

| Time | Beat | Visible proof |
| --- | --- | --- |
| 0:00–0:15 | “Our project meetings run long and end with vague follow-ups. We built Rally during this hackathon to close that gap.” | Agenda: decide Friday release; desired output: release decision and rollback owner. Original-work label. |
| 0:15–0:30 | Start the short meeting. | Consent state, participant roster, brief opening. Setup may already be entered. |
| 0:30–1:10 | Participants discuss an off-agenda topic in the labeled scenario. Rally redirects with a short decision-oriented question. | Actual audio, live transcript, normal-speed wait and measured event timing. Use only latency this connected path actually measured. |
| 1:10–1:45 | Someone offers to check rollback but omits a deadline. Rally clarifies; the participant confirms. | Proposed → confirmed transition, named owner/date, linked source turn. Missing information stays unresolved until answered. |
| 1:45–2:00 | Host dismisses or pauses a pending intervention. | Speech stops; canceled text does not later resume or create a commitment. |
| 2:00–2:20 | Show a disclosed demo-clock advance to five minutes remaining. | Actual wrap-up logic asks about unresolved work; no claim that a full 30-minute meeting occurred. |
| 2:20–2:40 | Review and export the outcome record. | One confirmed decision, one owned/dated action, source evidence, factual scorecard. |
| 2:40–3:00 | Explain runtime roles and newly built engineering. | Muse transcription → Spark moderation; deterministic application controls; optional models listed only if genuinely used. |

If timing is tight, reduce narration and decorative UI before cutting the confirmed-outcome sequence. Keep the key intervention at ordinary speed. Label any time jumps, replay, or fallback footage. Show Teams only if Rally has actually joined and exchanged live audio successfully; otherwise the browser room-mic path is sufficient for the agreed demo surface.

## Integration acceptance criteria

Validate consent, transcript quality, intervention relevance, explicit owner/deadline confirmation, evidence links, speaker correction and cancellation on the intended devices. Measure the complete audio-to-output path separately from service-stage benchmarks. Retain model identifiers, request/usage evidence and original-work attribution for the demonstrated release.

## Meaningful optional Meta additions

### Wonder: asynchronous evidence audit

Documented capabilities: Muse Wonder accepts text and supports structured output; Model API exposes `muse-wonder-1.0`. Wonder Full is a different variant available in Muse Code rather than the Model API. [Meta model catalog](https://dev.meta.ai/docs/models), [structured output guide](https://dev.meta.ai/docs/structured-output)

**Recommended experiment after the core works:** send finalized transcript turns and candidate/confirmed records to one post-meeting audit. Request only supported/unsupported/ambiguous classifications, cited turn IDs, and specific discrepancies. Detect a deliberately wrong owner, an unspoken deadline, and a proposal incorrectly marked confirmed. Validate cited turns in code; JSON-schema compliance does not prove facts. The audit may flag a conflict for review, but must not silently rewrite participant-confirmed state.

Keep Wonder off the live-interruption path. Retain it only if it catches meaningful errors in a small fixed evaluation that Spark alone misses. Record results honestly; calling two models without improvement is not evidence of deeper engineering.

Cost forecast, not an actual call: at documented Standard rates, 5,000 uncached input tokens plus 1,000 output tokens would cost about **$0.04** for Wonder. Reasoning consumes output tokens too, so set a cap and record actual usage. [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits)

### Open-weight path: partner-hosted first, separate eligibility proof

Meta documents Spark Open through self-hosting or a hosted provider. Its large weight footprint makes new local deployment a poor critical dependency for this week. Glimmer is a smaller 30B text/image open-weight model with supported local runtimes and Apache 2.0 weights; neither local availability nor suitable hardware is established for this team. [Spark Open documentation](https://dev.meta.ai/docs/muse-spark-open), [Glimmer documentation](https://dev.meta.ai/docs/muse-glimmer)

If a partner account is already ready, evaluate an existing provider behind the same evidence-audit adapter. This is a recommendation, not a required second backend. The supplied event guide specifies `meta-models/muse-spark-open-1026` for Baseten during the hackathon; verify actual provider access before use. Keep standard Model API Spark working as the baseline.

Evaluate an open-weight provider only for a defined product task on suitable hardware. Record the exact model, provider, license and measured result, and keep the existing hosted Spark path available during evaluation.

SAM segmentation or generated visual recaps remain later ideas. They need useful visual inputs and add capture/UI work; no evidence here justifies mandatory week-one camera features.

## Practical next audio source: AMI meeting excerpt

Follow-up: the actual prepared/tested fixture uses **267–317 seconds**, with 113 normalized lexical tokens and four speakers, rather than the exploratory interval/counts below. See [actual benchmark](ami-benchmark.md) and [final manifest](ami-fixture-manifest.json). The original exploratory counts included punctuation nodes and are superseded by the lexical filtering in the manifest.

**Recommendation:** AMI meeting `ES2002a`, mixed headset audio, approximately 270–330 seconds, is a useful harder fixture after LibriSpeech. The corpus contains actual recorded meetings, multiple microphone/video streams, and manually produced per-speaker transcripts with timings. Word timing is obtained through forced alignment, so it is an annotation reference, not a perfect physical speech-boundary oracle. [AMI overview](https://groups.inf.ed.ac.uk/ami/corpus/overview.shtml)

AMI explicitly releases signals, transcription, and some annotations under **CC BY 4.0**. Attribute AMI/Jean Carletta and the corpus source, retain the license link, state excerpt boundaries and transformations, and avoid implying participant endorsement. [AMI download and license notice](https://groups.inf.ed.ac.uk/ami/download/)

Small-download path verified by unauthenticated HTTP range requests only:

- [ES2002a mixed-headset WAV](https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/ES2002a/audio/ES2002a.Mix-Headset.wav): server returned HTTP 206. Header reports PCM16 mono at 16 kHz, data offset 44 bytes, 32,000 bytes/sec. Full file is 40,724,524 bytes; a 60-second excerpt requires 1.92 MB.
- For 270–330 seconds, request byte range `8640044-10560043`. These bytes are raw PCM, not a standalone WAV header. Build a fresh header if using a file API; use the raw samples directly for realtime PCM streaming. Recheck the header rather than assuming these offsets for another file.
- [Manual annotation ZIP](https://groups.inf.ed.ac.uk/ami/AMICorpusAnnotations/ami_public_manual_1.6.2.zip): full size 22,887,865 bytes, also supports HTTP 206. The ZIP central directory and four small compressed entries can be fetched independently. Extract `words/ES2002a.{A,B,C,D}.words.xml`; do not download the whole corpus.
- During this research, the four XML entries were recovered to `/tmp/ES2002a.{A,B,C,D}.words.xml`. By word start time in `[270,330)`, counts were A=61, B=77, C=19, D=20. These counts show four annotated speakers in that interval; they are not an ASR result. Words crossing either cut boundary must be excluded or the excerpt extended consistently.

Next experiment: pick boundaries on silence near this interval, retain word timestamps relative to excerpt start, merge transcript words across speakers by time, and measure normalized WER plus per-speaker alignment separately. Overlap can make one chronological word ordering unfair; report overlapping regions separately or use a suitable speaker-aware metric. Mapping A/B labels to names is a separate task; AMI speaker codes do not validate name recognition from introductions.

No audio excerpt was downloaded or submitted to Muse here, and no video was downloaded. This meets the source-research task, not the actual harder-audio test. It is a meeting-video corpus with corresponding audio; the next test need not download video to evaluate speech. The mixed-headset signal is easier than a distant phone microphone, so room-mic and echo tests still remain necessary.

## Handoff

Available research: related-product references, demonstration outline, optional-model admission gates, and a verified small multi-speaker source route. Still unverified: actual account access to optional models/providers; comparative product performance; Wonder improvement; excerpt ASR accuracy; overlap handling; real device acoustics and actual spoken interruptions.

No inference costs incurred by this task. Use the central cost ledger for any later experiments; source-download metadata checks are not Muse API calls.
