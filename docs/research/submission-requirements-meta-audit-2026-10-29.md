# Rally submission requirements and Meta integration review

**Current release:** [Version 12](../releases/2026-10-29-v12.md) adds browser-call inputs, a free local audio check, presenter view and manual WhatsApp follow-up drafts. MMS browser playback and saved review are deployed. The initial research below records earlier implementation status; use the current release and [submission draft](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/submission-package.md) for current behavior. Real calls/device rehearsal and final submission remain pending.

**Implementation update later the same night:** [Saved review and the measured local MMS CPU spike](../overnight-build-2026-10-29.md) are now completed locally. MMS generated four synthetic phrases; hosted/Teams playback and live validation remain pending. The research findings below distinguish eligibility from runtime proof.

Researched October 29, 2026 against first-party event/model documentation and the existing implementation. No production changes, account setup, messages or model requests were made. This report is an evidence audit and recommendation, not organizer approval or a claim that optional integrations work.

## Decision

Keep the signature demo centered on an actual meeting: Rally notices drift, asks a useful question, obtains an explicitly confirmed owner/deadline, and preserves the exact supporting speech. Complete that loop reliably before admitting more products. The highest-priority additional Meta component is **self-hosted MMS TTS**, explicitly allowed by the organizer FAQ supplied during this review. It closes a real output gap while replacing ambiguous third-party browser speech. Next is a bounded post-meeting evidence audit using Wonder. WhatsApp follow-up is useful only if an existing account is ready. Muse Voice Transcribe is not TTS.

## What is verified, and what is still missing

The [official event page](https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon) confirms the two tracks, Meta-model focus, November 4 submission deadline at 9 PM Eastern, and named Baseten/Modal/Fireworks inference partnerships. On that date the deadline is **November 5, 02:00 UTC**. These partnerships are evidence against assuming that every non-Meta hosting provider is prohibited; they do not prove arbitrary third-party models are permitted.

The [official waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) identifies the submission portal, one track/project, a team Representative and team attribution, the published evaluation criteria, original-work ownership, and permission for third-party technical assistance and licensed open-source components. Its document was recovered from publicly served page data because the ordinary page reader exposed almost no text. The wording read does not establish a blanket ban on all non-Meta services. It does not resolve a later Discord clarification either.

The [submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) is the exact path linked by the waiver. An unauthenticated visit returned event/sign-in material, not a complete usable submission form. We have **not** submitted an entry or verified the authenticated form's fields, upload constraints, edit behavior or confirmation screen.

The [user-supplied participant guide](../hackathon-participant-guide.md) additionally records public source, a three-minute video, clearly identified hackathon contributions, all contributors, and the published award eligibility requirements. Treat those as working requirements. The public marketing page is less detailed; do not downgrade the supplied requirements merely because it omits them. Verify any additional award eligibility against the current participant instructions.

### Organizer FAQ supplied during this review

The user subsequently supplied this Discord exchange, attributed to **Cerebral Valley APP**, at **8:05 PM**. The question asks whether Meta Massively Multilingual Speech TTS can be used. Organizer response, as supplied by the user:

> Yes — MMS (Massively Multilingual Speech) is an open-source Meta model, and open-source Meta models count as Meta models however you run them, like Llama, SAM, Demucs and V-JEPA 2. You can run MMS TTS yourself for voice output, while third-party TTS models stay off limits. Just say in your README which open Meta models you use and where.

This is **user-supplied organizer evidence**. Its permalink and calendar date were not independently recovered. Preserve the excerpt/provenance and obtain a permalink if practical, but it is specific enough to guide current work: **self-hosted MMS TTS is allowed; third-party TTS models are not**. Being open source alone does not make an unrelated TTS model eligible under this wording. Do not adopt Kokoro, eSpeak or GPT voice as the competition voice path on that basis. Browser/OS voice locality also does not establish Meta model origin.

The excerpt does not prohibit Teams, hosting, source control or coding tools. Do not widen its TTS/model restriction into an unsupported ban on all non-Meta infrastructure. Other rule questions still need their own organizer wording.

## Submission work, owners and gates

This checklist uses the supplied guide and existing [demo plan](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/demo-walkthrough.md). Dates before the official cutoff are internal targets.

| Item | Current evidence | Owner and target | Completion check |
| --- | --- | --- | --- |
| Accepted entrant, applicable rules, Indie track and Representative | Indie is the recorded choice; acceptance/account details not audited | Eric, October 30 | Open authenticated portal, confirm entry/account/track, list every human contributor and Representative |
| Exact FAQ restriction | Specific user-supplied organizer reply approves MMS and excludes third-party TTS | Agent records excerpt; Eric can retain permalink, October 30 | Use Meta MMS for voice; document model and execution location in README; clarify any other ambiguous rule separately |
| Public source and original work | Authorized source push to `ejo4041/Rally`, recorded checkpoint `cc79c96`; new development may be later | Agent prepares; Eric controls visibility/license, by November 2 | Outside viewer can browse code; own project license and third-party notices present; README accurately distinguishes shipped/local/unverified |
| Three-minute demo video | Storyboard exists; no finished video established | Eric + consenting participants, capture November 2; finish November 3 | Video is at most three minutes; readable/audible; normal-speed model behavior; public/unlisted link works signed out |
| Working product and judge access | Restricted version 7 exists; local history/review additions not yet published | Agent prepares; Eric verifies judge access, November 3 | Judge can open allowed demo without access-request dead end; real user records stay protected |
| New-work attribution | Source and research provenance exist; concise original-contribution statement still needed | Agent drafts; Eric verifies, November 3 | List newly written components, external libraries/models, licensed audio, and limitations; no claim that third-party model/transport is ours |
| Product reliability | Offline checks pass; real Teams test ended early; pacing fix has no subsequent live retry | Eric + agent, next live window; freeze by November 2 | Three full rehearsals of chosen demo surface; timeout/Leave/override and final transcript verified |
| Meta proof and actual costs | Muse ASR and Spark evidence exists; not every integrated path is proved | Agent, each experiment | Retain model/request IDs, actual usage, timing definitions and observed result; reconcile unknowns |
| Final entry and receipt | Not submitted | Eric, target November 4 at 5 PM Eastern | Verify all links as an outside viewer, submit the entry and retain confirmation before official 9 PM cutoff |

Unauthenticated browsing to [the GitHub repository](https://github.com/ejo4041/Rally) returned 404 during this audit, despite recorded SSH push success. That observation does **not** prove the repository is private; it makes outside-viewer access unverified. A root project `LICENSE` was not found in the working source search. A successful push alone therefore does not establish the public/open-source submission gate. Do not change visibility or choose Eric's source license silently.

## Product validation status

The following table separates observed implementation evidence from pending validation.

| Product area | Existing evidence | Remaining validation |
| --- | --- | --- |
| Meeting outcomes | A narrow software/product-team problem; confirmed vs proposed commitments; transcript evidence; factual scorecard | Record a real participant reaction and one concrete observed outcome. Show unresolved ownership honestly. Do not invent meeting-time or dollar savings. |
| Meta model integration | Muse real-time ASR → Spark structured moderation; separate extraction and confirmation contract; real request traces | Demonstrate the connected live behavior at normal speed. Add an evidence audit only if it catches a meaningful issue on a fixed evaluation. Record the result and cited evidence for each additional integration. |
| Runtime reliability | Source revisions, evidence validation, budget accounting, cancellation, pacing regression and honest failure diagnostics | Prove end-to-end timeout/departure, spoken cancel/echo behavior, and data lifecycle. Explain one failure mode and its fix concisely. Verify clean reproduction and source licensing. |
| Complete live workflow | Three-minute storyboard, working UI, scripted walkthrough separated from live processing | Largest open gate: repeatable live microphone-to-audible-intervention behavior with three people. Resolve judge access and readable recording. Label retrospective review, replay and compressed clocks explicitly. |

**Current boundary:** deployed Teams is a three-minute transcription POC. The initial integrated test worked then failed early; a sender pacing defect was fixed offline, but the exact original trigger remains unproven. Normal-browser joining/two-way audio has separate evidence. Local history and locally tested retrospective review are useful follow-through, but they are not live Teams moderation. Existing local-microphone moderation is another path. [Latest live checkpoint](../tonight-handoff-2026-10-28.md), [offline progress](../offline-progress-2026-10-29.md).

The demonstration should cover the intended moderation workflow: an off-agenda discussion, a relevant redirect, an explicit commitment, host confirmation and source evidence. Distinguish the live workflow from retrospective transcript review.

## Dependency audit under the supplied FAQ

These classifications separate implementation facts from the specific organizer statement. MMS approval and third-party TTS exclusion come from that statement; other dependencies are not ruled out by it.

| Component | Current role | Consequence under available wording |
| --- | --- | --- |
| Muse Voice Transcribe + Spark | Runtime transcription and reasoning at `api.meta.ai` | Core Meta role; keep Standard mode and existing budget guards |
| ChatGPT Sites / Worker + D1 | Hosting, storage and restricted access | External infrastructure; supplied TTS excerpt does not prohibit hosting |
| DigitalOcean Ubuntu host | Normal Teams browser runner/audio routing | External infrastructure; supplied TTS excerpt does not prohibit this host |
| Microsoft Teams | User's meeting platform and browser guest transport | External integration surface; no Teams ban is stated in the supplied TTS excerpt |
| Browser/OS `speechSynthesis` | Voices Muse-authored text | Not an eligible model-origin guarantee; use MMS or visible text for the competition path |
| OpenAI TTS / GPT voice | Earlier researched option, not implemented in current runtime | Third-party TTS is explicitly excluded by supplied FAQ; do not add as the competition voice |
| Old ACS implementation | Stopped optional transport | Not required by current guest-browser route; avoid reviving credentials/setup as a baseline requirement |
| Chromium/Playwright/PulseAudio/Node and libraries | Browser, transport and development/runtime components | OSS licenses still need notice/dependency audit; OSS code may access proprietary services |
| GitHub | Source publication | Required-public-source working requirement; hosting classification distinct from inference |
| Codex | Development agent | Development tool, not runtime intelligence; supplied TTS excerpt states no coding-tool ban |

Current implementation direction: keep intelligence on Muse, use self-hosted Meta MMS for speech, and retain visible text when MMS is unavailable. Document infrastructure separately. Do not count a local-only third-party voice as Meta MMS. Self-hosted MMS now has [CPU generation measurements](mms-cpu-benchmark.json) but remains to be connected to hosted/Teams playback; the FAQ approval is not proof of runtime behavior.

### Browser voice: local is not proof of Meta model origin

The [Web Speech API specification, synthesis voice attributes](https://webaudio.github.io/web-speech-api/#speechsynthesisvoice-attributes) defines `localService` as local vs remote synthesizer location. Its [utterance voice rules](https://webaudio.github.io/web-speech-api/#speechsynthesisutterance-attributes) allow an unset/null voice to use a browser default that can be local or remote.

If retained for non-submission device diagnostics, a local-only setting should filter for `localService === true`, select that actual current voice when calling `speak`, and fall back to visible text when no qualifying voice exists. Do not fall through to a default voice, including during device voice tests. Recheck at speech time if available voices change. Preserve existing cancel/epoch guards.

**Inference:** that flag establishes reported execution location, not the engine's copyright license, Meta ownership, organizer approval or a guarantee about every aspect of operating-system behavior. Label such diagnostics “local device speech.” The supplied FAQ excludes third-party TTS models even if self-hosted, so local-only browser voices are not a substitute for the approved Meta MMS path.

## Additional Meta/Facebook products, prioritized by useful work

These are candidates, not new committed scope or proof of access.

| Priority | Candidate and distinct role | Admission test and cost/scope boundary |
| --- | --- | --- |
| 0 | **Meta MMS English TTS:** render Muse-authored interventions locally | Organizer-approved model family. Verify CPU latency, names/dates, cancellation, output-level and Teams virtual-microphone routing. Do not replace Muse reasoning with a voice model. |
| 1 | **Muse Wonder evidence audit:** post-meeting check of candidate owners/dates/decisions against cited speech | Fixed cases: wrong owner, unspoken deadline, unsupported confirmation, clean control. Keep only if useful errors are caught with valid citations; never silently alter a host-confirmed record. One bounded request, no live latency dependency. |
| 2 | **WhatsApp follow-through:** host-approved delivery of confirmed actions to consenting recipients | Start only if an existing Meta account/test setup is usable. Preview exact recipients/text and require Send approval. Delivery success is not proof someone accepted an action; replies need separate identity/confirmation design. No messages were sent here. |
| 3 | **Glimmer or Spark Open evidence-check adapter:** useful open-weight execution path | Keep hosted Spark baseline. Use approved partner access if ready; confirm hardware fit before provisioning. Record actual model/provider evidence and license. |
| 4 | **Spark multimodal agenda grounding:** host-provided agenda/whiteboard image tied to meeting setup | Useful only if a real user needs it; explicit upload consent and editable extracted agenda. A screenshot/demo fixture is not meeting understanding proof. |
| Later | **SAM 3.1:** identify whiteboard regions or objects before structured extraction | Requires useful visual input, extraction/display work and accuracy tests. Segmentation alone cannot establish meeting decisions or read their meaning. |
| Later | **Muse Image:** optional visual recap illustration | Never use generated pixels as the authoritative action/decision record. Decorative output adds little to the current signature demo. |
| Defer | Facebook/Instagram/Threads publishing or social features | No clear week-one connection to a private team's decision meeting. Public distribution is a separate user-approved action, not a mandatory Meta product integration. |

Wonder's documented API model is `muse-wonder-1.0`; Wonder Full is a separate Muse Code-only variant. Spark/Wonder support structured output and return text; Voice Transcribe returns transcription, not speech. The catalog documents image/vision options above. [Meta model catalog](https://dev.meta.ai/docs/models). JSON-schema compliance is a shape guarantee, not factual grounding; Rally must continue checking references and preserving uncertainty. [Meta structured output](https://dev.meta.ai/docs/structured-output).

Glimmer is documented as 30B with Apache 2.0 weights and self-hosted runtimes; actual machine fit is untested. [Glimmer documentation](https://dev.meta.ai/docs/muse-glimmer). Spark Open is much larger, has a specific Muse Model License and supports partner hosting; its documented footprint makes an improvised local deployment a poor overnight dependency. [Spark Open documentation](https://dev.meta.ai/docs/muse-spark-open). Open-weight execution is distinct from normal hosted Spark; retain actual model and provider evidence for the path used.

The [Meta-owned WhatsApp collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api?entity=request-13382743-9dbec0ce-30d4-4df2-b188-674b7d8da2d9) documents business account/phone identifiers, tokens and messaging permissions. First-party [WhatsApp getting-started documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) was sign-in gated and older overview requests were rate limited in this audit. Account setup, template/messaging rules, pricing and any current restrictions need verification in the actual account before selecting this as a demo dependency. A WhatsApp-ready text export is useful groundwork but must not be called a working API integration.

## Approved MMS path, technical fit and licenses

**Use Meta’s English MMS checkpoint `facebook/mms-tts-eng` for the first voice spike.** Its publisher model card specifies VITS, 36.3 million parameters, English text-to-speech, Transformers support from version 4.33, and CC BY-NC 4.0 licensing. Its example loads `VitsModel` and `AutoTokenizer`, runs inference under `torch.no_grad()`, and writes a waveform at the model's sampling rate. Duration prediction is stochastic, so a fixed seed is needed for repeatable waveform experiments. [Meta MMS English model card](https://huggingface.co/facebook/mms-tts-eng).

The [official MMS source README](https://raw.githubusercontent.com/facebookresearch/fairseq/main/examples/mms/README.md) provides an English generator-only download and original VITS inference instructions, and separately states the code/model license. For this POC, the Transformers-supported checkpoint avoids importing the full older fairseq training toolchain. CPU execution is a plausible spike at this model size; neither this review nor the source establishes actual latency on the droplet.

The organizer’s express competition permission and the publisher’s weight license are different facts: record **Meta MMS, self-hosted on the Rally Ubuntu host**, the exact pinned checkpoint/revision, and CC BY-NC 4.0 in README/notices. Do not describe the weights as Apache/MIT or assume the FAQ grants future commercial deployment rights. Preserve attribution and assess any later commercial use separately.

Operational admission: obtain a small pinned model artifact; verify its identity/hash; keep model/runtime caches outside the public source; make startup fail clearly if missing; avoid model downloads on a meeting's critical path; produce known phrases containing names and deadlines; check first-audio time and real-time factor; cap output text/duration; cancel both generation/playback; keep raw meeting audio out of TTS inputs; reject stale output after host override. Test the virtual microphone route separately from producing a WAV file. Use visible text if the approved voice is unavailable; never silently fall back to a third-party TTS engine.

Kokoro and eSpeak were initially considered when the FAQ was only recalled as an OSS exception. **That suggestion is superseded by the exact organizer excerpt:** unrelated third-party TTS models stay off limits. Their licensing does not establish event eligibility. No such model was installed by this audit.

Do not substitute other Meta speech research merely because it can generate audio. SeamlessM4T/SeamlessStreaming weights use CC BY-NC 4.0, while Seamless/SeamlessExpressive have a distinct noncommercial research license. [Meta Seamless licensing](https://github.com/facebookresearch/seamless_communication#license), [Meta Seamless license](https://github.com/facebookresearch/seamless_communication/blob/main/SEAMLESS_LICENSE). MMS has an explicit organizer approval and a narrower, smaller English spike path.

AudioCraft is for music/sound generation and codecs rather than exact-word moderator speech; its MIT code and noncommercial weights are distinct. [Meta AudioCraft](https://github.com/facebookresearch/audiocraft#license). Music or synthetic ambience does not provide Rally's required spoken moderator output.

## Recommended next actions

1. Preserve the supplied FAQ and document Meta MMS/model execution location. Clarify other rule questions separately; do not generalize the TTS exclusion into a ban on infrastructure.
2. Complete and verify saved Teams review and host confirmation; preserve its retrospective label. Stage useful screenshots and source proof while live testing is unavailable.
3. Implement and measure the approved local MMS voice; default to visible text when unavailable. A local-only browser diagnostic policy is useful but not proof of eligible model origin.
4. Prepare a small Wonder evidence-audit evaluation behind the existing provider adapter. Admit it only after measured value; follow the budget policy before any paid requests.
5. In the next live window, validate pacing/Leave/timeout, then the core actual audible moderation loop on a reliable surface. Freeze broad new integrations before rehearsal.
6. Resolve public repo/access/license and authenticated submission fields well before the video and final deadline. Keep the private product's real-user data protected while giving judges a usable demonstration.

No inference cost was incurred. Latest project totals remain whatever the authoritative ledger records; this read-only audit does not verify Billing or consume a new model batch.
