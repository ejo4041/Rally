# Rally feasibility research

Researched October 28, 2026 against primary documentation. Read alongside [the planning interview](../planning-interview.md) and [event requirements](../hackathon-participant-guide.md). No authenticated API calls, audio experiments, account provisioning, or meeting joins were performed. Public documentation establishes advertised interfaces; it does not establish this team's access or measured performance.

Follow-up: the user already has a running Teams environment and approved browser TTS first plus research into the specifically requested GPT-Live-1.1 voice path. See [speech and Teams invite findings](rally-speech-and-teams.md) for that version's API availability gap, exact-text rendering considerations, and the shortest managed join-URL flow. Native Graph hosting requirements below apply only to the native media-bot route; no new Teams host deployment is required.

## Recommendation

Build the browser microphone → Muse transcription → Spark moderation → spoken/visible intervention → confirmed due-out loop first. Keep Microsoft Teams as a gated integration experiment. A managed meeting bot is a more plausible week-one addition than a native Microsoft media bot; this is an engineering judgment based on the requirements below, not a tested effort guarantee.

**Speech output needs a separate solution.** Meta's catalog explicitly says Muse Voice Transcribe does not generate speech or provide speech-to-speech. Spark and Wonder produce text. Use browser speech synthesis for the first browser demo, validate it on the selected devices, and evaluate an audio-generating provider only if required for quality or Teams output. Do not claim browser-generated voice is a Muse capability. [Meta model catalog](https://dev.meta.ai/docs/models), [browser speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)

## Meta capabilities and proposed roles

| Service | Documented interface | Rally recommendation |
| --- | --- | --- |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0`; audio input, transcript output | Core live transcription and speaker labels |
| Muse Spark | `muse-spark-1.3`; text output; structured output and tools | Core bounded moderator/extractor |
| Muse Wonder | `muse-wonder-1.0`; text output; structured output and tools | Optional final audit of decisions against transcript |
| Muse Glimmer | Open-weight; self-hosted, not Model API | Later local/privacy experiment |
| Muse Spark Open | Open-weight; self-host or provider | Optional partner-hosted alternative; event guide supplies a special Baseten identifier |

These identifiers and hosting distinctions are documented in the [Meta model catalog](https://dev.meta.ai/docs/models). Actual model access remains untested. Preserve provider/model configuration so a failed optional integration does not block the core flow.

### Live transcription and speaker names

The live endpoint is `wss://api.meta.ai/v1/asr/realtime`, with authentication in the handshake frame. `DIARIZATION` emits speaker labels such as A/B; `ENDPOINTING` is tuned for turn endings. Diarization marks possible speaker changes and is not optimized for low-latency voice commands. Completed turns can arrive out of order: use turn IDs; partials are cumulative updates, not append-only text. Timestamps are turn-level, not word-level. Stream raw mono PCM16 at 16 or 24 kHz, paced in real time; reconnect before the session limit (default 60 minutes). [Meta speech-to-text guide](https://dev.meta.ai/docs/speech-to-text)

**Inference:** Speaker labels are not verified identities. Map an explicit introduction such as “I'm Alex” to the observed speaker label and roster, then allow host correction. Test whether labels remain stable through pauses, overlapping speech, reconnects, and Rally's own playback. Preserve “unknown speaker” when uncertain. Meta's research explains diarization using lettered speaker tags rather than a named-person identification contract. [Muse Voice Transcribe research](https://research.meta.ai/blog/introducing-muse-voice-transcribe)

### Reasoning and evidence

Meta documents schema-constrained JSON via `response_format.type = "json_schema"`, including a Spark example. This can encode proposed interventions, candidate decisions/actions, evidence turn IDs, and missing owner/date fields. Schema validity does not establish factual correctness. Validate referenced turns and require explicit confirmation before setting an item to confirmed. Enforce timing, cooldown, pause, and override in application code rather than letting model text directly control them. [Meta structured output](https://dev.meta.ai/docs/structured-output)

Wonder is an optional audit pass, not a prerequisite to every live turn. Suggested experiment: compare one Spark-only extraction with Spark plus Wonder verification on the same meeting, recording added latency and corrected errors. Keep it only if the benefit is visible. No latency or cost benchmark has been measured for Rally.

### Other Meta tooling

SAM 3.1 segments images/video into boxes and masks. A possible later role is selecting a whiteboard region before processing its content; segmentation alone does not read handwriting or identify speakers. This does not improve the agreed audio-only core enough to justify mandatory camera work this week. [Meta media segmentation](https://dev.meta.ai/docs/media-segmentation)

Glimmer is a later candidate for local classification or private local meeting processing, contingent on hardware/runtime testing. Local deployment adds an operational surface before proving the core interaction. [Meta Glimmer documentation](https://dev.meta.ai/docs/muse-glimmer)

Muse Image can be considered for optional visual recaps after the core is reliable. Defer it unless it adds meaningful meeting value. Muse Code is a development tool, and the user has chosen Codex; count only actual runtime integrations in Rally's product claims.

## Browser path

Microphone capture requires permission and a secure browser context. Capture is from the selected input device; a room microphone is not an established way to receive all remote meeting participants. Test laptop and phone room capture separately. [getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

Speech synthesis exposes device voices and playback controls, including cancellation. Validate a user-initiated start, audible output, immediate host cancel, and behavior on the demo browser/device. A browser synthesis API does not by itself promise a portable audio file/stream for a remote meeting bot. [SpeechSynthesis documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)

Implementation proposal: browser captures PCM → server proxy holds API credentials → transcription events update the meeting → finalized evidence feeds a bounded moderator → app schedules voice/visual output. Keep raw audio transient and ensure logs/debug capture do not silently persist it. The proxy and buffering design are recommendations, not vendor requirements.

## Microsoft Teams participant integration

### Native Graph media bot

Microsoft's call API supports joining existing meetings after registering a calling bot. Joining uses application permissions (or documented resource-specific consent); application-hosted media additionally requires `Calls.AccessMedia.All` under the create-call guidance. Ordinary delegated personal-account OAuth is not supported for this API. Join-link possession is not a blanket authorization to join any tenant. [Graph create call](https://learn.microsoft.com/en-us/graph/api/application-post-calls?view=graph-rest-1.0)

`Calls.AccessMedia.All`, `Calls.JoinGroupCall.All`, and `Calls.JoinGroupCallAsGuest.All` require administrator consent. The permissions reference also lists narrower resource-specific permissions, including `Calls.AccessMedia.Chat`; assess compatibility for the chosen scenario before assuming they replace the documented media permission. Tenant/application registration and consent are real prerequisites. [Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference#callsaccessmediaall)

For direct real-time media, Microsoft requires its `Microsoft.Graph.Communications.Calls.Media` C#/.NET library. Production runs on Windows Server in Azure; testing may run on on-premises Windows Server. Node.js does not expose this real-time-media interface. Azure Web Apps are unsupported. Instances need public network reachability; media is pinned to the VM accepting the call. Microsoft describes the platform as developer preview and requires a recent media library version. [Application-hosted media bot requirements](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/requirements-considerations-application-hosted-media-bots)

**Recommendation:** Defer native media-bot implementation unless working tenant/admin access, Azure/Windows hosting, and an existing sample are already available. This is a separate service, not merely adding a Teams SDK to the web app.

### Managed bot experiment

Recall.ai documents Teams support for Output Media. Its bot opens a webpage controlled by the application, supplies meeting audio, and streams that page's output back into the meeting. This could reuse Rally's UI/audio adapter while Muse remains the intelligence backend. The documentation warns that including the bot in mixed recorded audio can create a feedback loop; use the meeting input path excluding bot output. Managed transport is not proof that generated voice, admission, identity, or latency will work in our meeting. [Recall Output Media](https://docs.recall.ai/docs/stream-media)

Recall permits zero recording-media retention via explicit configuration and real-time delivery. Recording-media deletion does not cover all integration metadata or third-party storage. Validate retention configuration and delete behavior rather than accepting defaults. [Recall storage and retention](https://docs.recall.ai/docs/storage-and-playback)

Teams detects external bots and can require explicit lobby admission even when ordinary participants bypass it. Test the actual host tenant's policy; do not assume a managed service bypasses it. [Microsoft external bot controls](https://learn.microsoft.com/en-us/microsoftteams/manage-external-bots)

### What Otter establishes

Otter's own help center confirms its notetaker joins Teams, Zoom, and Google Meet to record/transcribe meetings, with additional Teams setup. That establishes the user-visible pattern is possible. It does not disclose a reusable Otter media SDK, prove its internal architecture, or establish support for Rally's live synthesized interventions. Use a documented transport API or native Microsoft path rather than reverse-engineering assumptions about Otter. [Otter Notetaker overview](https://help.otter.ai/hc/en-us/articles/4425393298327-Otter-Notetaker-Overview)

## Validation experiments and first-24-hour gates

These are proposed acceptance targets, not measured results. No secret values should be written into source or logs.

| Experiment | Pass condition | Fallback / cut decision |
| --- | --- | --- |
| Access smoke test | Real authenticated model listing/chat response and live transcription session, with provider request IDs | Resolve access before claiming a live Muse demo; use clearly labeled fixtures only for development |
| Three-person intros | Correct name-to-label mapping on all staged non-overlapping demo turns, or transparent unknown/correction handling | Keep manual correction; never promise reliable name recognition |
| Latency | Measure 10 end-of-human-turn → intervention-start samples; aim for p95 ≤5 seconds | Reduce prompt/context and call frequency; omit Wonder from live path |
| Audio feedback | Rally speaks, host interrupts/cancels, then human confirms an item; Rally never confirms its own proposal | Separate output/input; if necessary suspend recognition of commitments during playback and disclose that limitation |
| Evidence | Every confirmed decision/action points to real transcript turns; missing information stays unresolved | Keep proposals unconfirmed and request clarification |
| Teams transport | In one test meeting, Rally joins under its name, host admits it, receives live audio, plays a response, and leaves cleanly | Keep browser-only demo if any prerequisite stalls; Teams remains roadmap work |
| Retention | End/delete test meeting; verify raw audio was not retained by Rally or configured transport, and transcript/outcomes delete | Fix before using real meeting data; use consenting synthetic demo content meanwhile |

By the end of the first 24 hours, choose the actual transcription mode, speaker mapping behavior, speech-output path, live reasoning model, and whether Teams qualifies for week-one work. Exclude Teams if join/receive/speak cannot all be demonstrated. Additional Meta models qualify only after the core loop works and the added model has a distinct benefit.

## Effort estimates

Estimates below are engineering judgments for one developer with Codex, after accounts are available; they are not vendor promises and can expand during testing.

- Browser audio/ASR smoke test: 3–6 focused hours; reliable live session handling: another 0.5–1.5 days.
- Structured moderator, evidence references, and confirmation rules: 1–2 days.
- Browser speech/cancel/feedback tests: 2–6 hours on selected devices; mobile issues may add time.
- Managed Teams proof of concept: 4–8 hours after service access; polished integration and lifecycle handling: another 1–2 days. Tenant restrictions can block this independently of code.
- Native Graph media bot: several days to multiple weeks depending on tenant access and Windows/Azure experience; unsuitable as a critical dependency for this week's browser demo.
- Wonder audit: 2–4 hours once structured extraction exists; optional and cut if latency or result quality does not improve.

## Remaining unknowns

Team entitlements and rate limits; actual transcription and reasoning latency; overlapping-speech accuracy; speaker label stability; chosen browser/device audio behavior; available synthesis quality; managed-bot account capabilities/cost and actual retention setup; Teams tenant admission/consent; provider retention details beyond Rally's own buffers. None should be represented as tested until the corresponding experiment is run.
