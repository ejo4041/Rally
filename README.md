# Rally

Rally helps a host turn a decision meeting into clear next steps with reviewable source evidence. Meta models listen, reason and speak while the host controls when Rally participates.

[Open Rally](https://rally.tail703f9e.ts.net/) · [Current handoff](docs/handoff.md) · [Three-minute demo script](docs/demo-script.md) · [API](docs/backend-api.md) · [Documentation](docs/README.md)

## Judges: explore without credentials

**[Open the interactive sample](https://rally.tail703f9e.ts.net/demo.html)** — no login, setup, microphone, model keys or paid calls. The login page also links to this sample. Ordinary meeting accounts still require invitations and MFA.

Alternatively, run the checked-in portable sample from a repository checkout with Python 3; no npm dependencies or backend are needed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory demo
```

Open http://127.0.0.1:8000/ . The sample uses the **same home page, Create meeting modal, live meeting screen and report UI as the regular site**. Create a meeting, review its prepared sample plan, check the simulation acknowledgment and click Start simulated meeting. A fictional engineering discussion plays with prerecorded Meta voices as its simulated transcript streams in. Alex and Sam share the MMS voice; Priya uses FastSpeech2; Rally uses Seamless. Pause/resume playback, identify speakers, ask Rally for a scripted reply, change its approach and end the meeting to prepare a sample report. Explore the preloaded completed meeting for the full evidence trail, JSON export, print/PDF, fictional report-sharing controls and a local follow-up draft. Edits stay in memory and reset on reload. Appearance preference alone is saved locally. Start unlocks audio; Settings → Demo audio can silence playback while text continues. Pause replay, End, navigation and reset stop audio.

### Evidence and limitations

| Judge path | What it establishes | Limits |
| --- | --- | --- |
| Interactive sample (`demo/`, shared `main.ts` UI with `demo-api.ts` / `demo-simulator.ts`) | Runnable agenda/transcript/report interaction, source navigation and exports | Authored fictional text, speakers, replies and report, plus prerecorded Meta speech. Captions follow playback approximately; no live AI, ASR, Teams or authentication. Sharing/revocation is in-memory role-play, with no real grants. |
| Three-minute video and [edit provenance](docs/human-demo-edit-2026-11-02.md) | Human-narrated actual Rally UI and recorded multi-participant Teams/transcription footage, with identified edits | Edited excerpts do not establish end-to-end latency. Final public video URL is added to the submission separately. |
| Full application setup below | Source and configuration for real service integrations | Requires service credentials, invited accounts/MFA, media setup and model availability; processing can incur charges. |

The demo bundles the regular app interface with a build-time substitution of the API client for an in-memory simulator, plus a `connect-src 'none'` content policy and same-origin-only prerecorded media. The regular build always uses the authenticated API client; a URL parameter cannot change it. It cannot access private meetings or invoke model endpoints. Checked-in bundle hashes and source paths are in [demo/provenance.json](demo/provenance.json). Rebuild it with the frontend build followed by `node scripts/export-demo.mjs` from `apps/rally-web`. Component attribution is included with the portable files.

## Meta technologies

| Model | Role in Rally | Provenance |
| --- | --- | --- |
| Muse Voice Transcribe | Streaming audio transcription and anonymous speaker labels | Meta Model API; Rally does not use native Teams transcripts. |
| Muse Spark 1.3 | Agenda preparation, continuous guidance and complete final reports | Meta Model API; validated structured output and source references. |
| SeamlessM4T-v2-large | Streamed production speech for approved prompts | Configured AWS-hosted Meta-model endpoint; exact remote checkpoint revision is not supplied. |
| Meta MMS English | Configurable local voice, prerecorded demo participants and earlier narration experiments | Self-hosted `facebook/mms-tts-eng`, pinned revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`; weights CC BY-NC 4.0. |
| Meta FastSpeech2 + HiFi-GAN | Prerecorded demo participant speech; not selected for production meetings | Pinned Meta checkpoint and bundled vocoder; [provenance](experiments/meta-fastspeech2/README.md). |

Living Silk is visual artwork/runtime, not a Meta vision model or participant emotion detector. LiveKit supplies self-hosted media transport. Component authorship and licenses remain with their owners. [Model interfaces and configuration](docs/model-interfaces.md), [MMS provisioning](experiments/meta-mms/README.md).

## Meeting workflow

Prepare an agenda and choose passive, balanced or proactive guidance. With participant consent, select a microphone, browser call tab, or a valid Teams invitation for Rally's integrated voice/video participant. The host can pause, dismiss, mute or stop speech. Teams calls continue independently of the dashboard until End/Leave.

Review finalized transcript evidence, identify recognized voices, and inspect reported agreement, proposals and unresolved details. Reports preserve unknown owners/dates. Add host notes, export PDF/JSON or grant read-only report access to a named Rally account. Access can be revoked. WhatsApp follow-up is a reviewed manual draft; WhatsApp guest joining remains experimental.

## Run locally

**[Full application: judge quickstart](docs/judge-quickstart.md)** — Node 24, locked dependencies through Nexus, generated private configuration, administrator activation/MFA, local media and your own Meta Model API key. The guide distinguishes basic browser capture from optional speech/Teams provisioning and includes validation commands. Paid processing defaults off; keys remain server-side. No Azure ACS setup is required for the guest-Teams route.

The current application lives in `apps/rally-api/` and `apps/rally-web/`. The earlier `apps/rally/` Sites application is retained as a historical implementation. The [current handoff](docs/handoff.md) identifies the running release and validation boundaries.

## Demonstration and contribution

The [three-minute script](docs/demo-script.md) covers Meta transcription, reasoning, speech, host control and evidence review. The current three-minute cut uses human narration and recorded actual UI/Teams footage. The older synthetic replay and the new credential-free interactive sample are separate artifacts. Neither edited video nor scripted playback measures live model latency. [Current video provenance](docs/human-demo-edit-2026-11-02.md).

Rally's application contribution includes meeting state, agenda policy, evidence validation, owner-isolated records, model capability interfaces, controlled speech, Teams transport, visual presence integration, report review/sharing and host controls. Meta models, visual assets, transport/runtime libraries and tools retain their own attribution. The [submission draft](docs/submission-package.md) records remaining access/licensing and contributor verification; final submission is on hold.

## Rehearsal and release preparation

[Monday live-test runbook](docs/monday-live-rehearsal.md) · [Real-footage shot list/edit workflow](docs/demo-live-edit.md) · [Judge access rehearsal](docs/judge-access-rehearsal.md) · [Component notices](THIRD_PARTY_NOTICES.md). The root application license, supplied artwork permission, public source access and final human contributor confirmation remain pending in [source readiness](docs/source-release-readiness.md). Final submission stays on hold.
