# Rally

Rally helps a host turn a decision meeting into clear next steps with reviewable source evidence. Meta models listen, reason and speak while the host controls when Rally participates.

[Open Rally](https://rally.tail703f9e.ts.net/) · [Current handoff](docs/handoff.md) · [Three-minute demo script](docs/demo-script.md) · [API](docs/backend-api.md) · [Documentation](docs/README.md)

The hosted app uses invited accounts and mandatory MFA. Public signup is closed. Ask the project owner for an invitation; existing users sign in with their password and authenticator.

## Meta technologies

| Model | Role in Rally | Provenance |
| --- | --- | --- |
| Muse Voice Transcribe | Streaming audio transcription and anonymous speaker labels | Meta Model API; Rally does not use native Teams transcripts. |
| Muse Spark 1.3 | Agenda preparation, continuous guidance and complete final reports | Meta Model API; validated structured output and source references. |
| SeamlessM4T-v2-large | Streamed production speech for approved prompts | Configured AWS-hosted Meta-model endpoint; exact remote checkpoint revision is not supplied. |
| Meta MMS English | Configurable local voice and this demonstration's narration | Self-hosted `facebook/mms-tts-eng`, pinned revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`; weights CC BY-NC 4.0. |

Living Silk is visual artwork/runtime, not a Meta vision model or participant emotion detector. LiveKit supplies self-hosted media transport. Component authorship and licenses remain with their owners. [Model interfaces and configuration](docs/model-interfaces.md), [MMS provisioning](experiments/meta-mms/README.md).

## Meeting workflow

Prepare an agenda and choose passive, balanced or proactive guidance. With participant consent, select a microphone, browser call tab, or a valid Teams invitation for Rally's integrated voice/video participant. The host can pause, dismiss, mute or stop speech. Teams calls continue independently of the dashboard until End/Leave.

Review finalized transcript evidence, identify recognized voices, and inspect reported agreement, proposals and unresolved details. Reports preserve unknown owners/dates. Add host notes, export PDF/JSON or grant read-only report access to a named Rally account. Access can be revoked. WhatsApp follow-up is a reviewed manual draft; WhatsApp guest joining remains experimental.

## Run locally

Use Node 24 and the locked dependencies. Follow [API setup](apps/rally-api/README.md) and [frontend setup](apps/rally-web/README.md), including persistent MFA key/account bootstrap, media configuration and optional native camera dependencies. Paid processing defaults off. Keep credentials in ignored runtime configuration; model keys stay server-side.

The current application lives in `apps/rally-api/` and `apps/rally-web/`. The earlier `apps/rally/` Sites application is retained as a historical implementation. The [current handoff](docs/handoff.md) identifies the running release and validation boundaries.

## Demonstration and contribution

The [three-minute script](docs/demo-script.md) covers Meta transcription, reasoning, speech, host control and evidence review. The produced walkthrough is visibly labeled as synthetic replay; it does not claim live model latency or a new Teams trial. Recorded live-call evidence remains separate. [Video provenance](docs/demo-feedback-draft.md).

Rally's application contribution includes meeting state, agenda policy, evidence validation, owner-isolated records, model capability interfaces, controlled speech, Teams transport, visual presence integration, report review/sharing and host controls. Meta models, visual assets, transport/runtime libraries and tools retain their own attribution. The [submission draft](docs/submission-package.md) records remaining access/licensing and contributor verification; final submission is on hold.

## Rehearsal and release preparation

[Monday live-test runbook](docs/monday-live-rehearsal.md) · [Real-footage shot list/edit workflow](docs/demo-live-edit.md) · [Judge access rehearsal](docs/judge-access-rehearsal.md) · [Component notices](THIRD_PARTY_NOTICES.md). The root application license, supplied artwork permission, public source access and final human contributor confirmation remain pending in [source readiness](docs/source-release-readiness.md). Final submission stays on hold.
