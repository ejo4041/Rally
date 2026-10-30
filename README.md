# Rally

Rally helps a host keep a decision meeting moving and retain the evidence for what happens next. It combines Muse transcription and reasoning with self-hosted Meta MMS voice. Outcomes remain labeled as reported agreement, proposal or unresolved, with source links and host corrections.

**Integrated app:** [Open Rally](https://rally.tail703f9e.ts.net:8445) with Tailscale connected, then create an app account or sign in. [Current handoff](docs/handoff.md) · [Deployment](docs/integrated-deployment.md) · [Demo draft](docs/demo-script.md). This private deployment is not a public judge-access endpoint.

## Run the integrated app

Use Node 24+ with npm on PATH:

```bash
npm ci --prefix apps/rally-api
npm ci --prefix apps/rally-web
cd apps/rally-api
npm run setup:media
cd ../..
node scripts/dev-rally.mjs
```

Open `http://127.0.0.1:5173`. Sign up for a local account. Paid processing defaults off: accounts/history work, but agenda preparation saves a draft with a visible error until real provider access is deliberately enabled. No synthetic output is substituted for a model response. For real processing configure the server-side `MODEL_API_KEY`, explicitly enable `RALLY_PAID_ENABLED=1`, and review the [budget policy](docs/api-budget.md). Optional offline MMS needs separately provisioned Python/model files and `RALLY_MMS_ENABLED=1`.

[Frontend setup](apps/rally-web/README.md) · [API setup](apps/rally-api/README.md) · [MMS provisioning and license](experiments/meta-mms/README.md). Keep credentials in ignored local/runtime configuration. The browser never receives the model key.

## Workflow and integration boundaries

- Prepare/review an agenda; obtain participant consent; check local input with **Check audio · free** before starting Muse processing.
- Capture a room microphone or a host-selected meeting browser tab with optional microphone. The host joins the call normally. WhatsApp Web, Zoom Web, Meet and Jitsi compatibility must be checked on the intended device; a tab preset is not an automatic participant connector.
- Receive finalized Muse transcript turns, agenda/progress assessments and approved moderator prompts. Host mute, pause/resume, dismiss, guidance request and end remain available.
- Enable [spoken prompts](docs/integrated-speech.md) for host-browser Meta MMS output. **Test voice · free** checks a fixed phrase before a live meeting. Input is shielded during playback; remote call audibility is not automatic.
- Correct anonymous [session-scoped speaker labels](docs/speaker-attribution.md). A roster or room display name does not establish a person's identity. Clearing a host label is supported.
- End and review the complete transcript-grounded report, unresolved details, source evidence and speaker suggestions. Save host annotations, export and reopen history. Label changes mark prior conclusions as stale; reanalysis is explicit and charged.
- Build a [reviewed WhatsApp follow-up draft](docs/integrated-whatsapp-follow-up.md) from selected report rows. Edit it, then choose recipients and send manually in WhatsApp. No message is sent by Rally.

The [Teams invitation bridge](docs/teams-integrated-ui.md) is a separate bounded transcription test, with fresh link, consent and host admission. It uses the existing guest runner and Muse, not Teams native transcription. The [WhatsApp guest prototype](docs/whatsapp-guest-prototype.md) has isolated audio-routing evidence but still needs a fresh call admission/audio trial; an enabled WhatsApp invite connector is not deployed.

## Meta models and replaceable capabilities

| Model | Role | Execution |
| --- | --- | --- |
| Muse Voice Transcribe | Streaming transcription and anonymous speaker labels | Meta Model API |
| Muse Spark 1.3 | Agenda, guidance and complete report reasoning | Meta Model API |
| `facebook/mms-tts-eng` | Approved moderator voice | Self-hosted offline on Rally's CPU host |

MMS defaults to revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`. Its weights use **CC BY-NC 4.0**, separate from library and project-source licensing; review the model license before commercial use. The organizer FAQ supplied by the user permits self-hosted MMS and excludes third-party TTS. Model weights and runtime secrets are not distributed in this repo. A root project-source license remains to be selected.

[Capability interfaces/configuration](docs/model-interfaces.md) separate audio transport, transcription, reasoning, speech generation and application policy. Compatible model changes require validated protocol/audio support, explicit checkpoint provenance and changed-model pricing where applicable. Native platform transcripts and third-party TTS are not used for the competition path.

## Validation and contribution

The Node implementation uses Express, SQLite and self-hosted LiveKit. Rally's application work includes the meeting lifecycle, canonical transcript/evidence handling, moderation policy, budget accounting, report semantics, model adapters, authenticated frontend, correction/sharing controls and guest-transport experiments. External models, libraries and meeting platforms retain their own attribution and licenses; see [the submission draft](docs/submission-package.md) for contribution details pending final contributor verification.

Run backend and frontend type checks/tests from their package scripts. The frontend browser test also needs Chromium and LiveKit; it uses injected ASR/reasoning fixtures, with optional actual local MMS. [Current validation and limitations](docs/handoff.md) identify real model measurements, synthetic checks and pending human rehearsal. No finished demo or final hackathon entry is claimed.

## Documentation and earlier preview

[Documentation index](docs/README.md) · [Backend handoff](docs/backend-team-handoff.md) · [API contract](docs/backend-api.md) · [AI processing](docs/ai-processing.md) · [actual AI examples](docs/backend-ai-examples.md) · [rehearsal packet](docs/integrated-rehearsal.md).

The earlier Sites application in `apps/rally/` remains separately hosted at the restricted [Sites preview](https://rally-meeting-moderator.excavator3496.chatgpt.site), version 12. It has different confirmation, presenter, demo-clock and sharing controls. [Earlier release](docs/releases/2026-10-29-v12.md). Follow its own setup when inspecting it; the integrated app above uses `apps/rally-web` and `apps/rally-api`.
