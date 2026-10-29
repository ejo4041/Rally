# Rally

**Integrated app:** [Open Rally](https://rally.tail703f9e.ts.net:8445) with Tailscale connected, then create an app account or sign in. [Deployment and test steps](docs/integrated-deployment.md). The older Sites preview below remains a separate version.

**Node API frontend:** [Local setup and integration](apps/rally-web/README.md) · [Validation and next steps](docs/frontend-integration.md). This is a separate integrated frontend for the new backend; the private Site below remains its earlier release.

A meeting moderator that keeps a decision meeting moving and turns discussion into explicitly confirmed, transcript-evidenced follow-ups.

**Current release: version 12.** Browser meeting input, a free local audio check and presenter view are available.

**Private preview:** https://rally-meeting-moderator.excavator3496.chatgpt.site — sign in with the account used for this workspace.

Start with **Try a walkthrough** for a clearly labeled, zero-cost example. For real audio, create a meeting, enter an agenda/roster, confirm participant consent, and start the microphone. Muse handles transcription and reasoning. Self-hosted Meta MMS English now provides browser speech through the protected app. Unavailable speech leaves prompts visible. Speech into Teams remains pending. Review proposals before confirming them.

## Teams live-transcription POC

On the existing Site, scroll to **Invite Rally to Teams**, paste a fresh work/school meeting invite, confirm participant consent and check **Transcribe this test**. Admit **Rally audio test** from the lobby. Live text starts after admission; select **Leave meeting** and download the transcript before starting another test. The server runner is active and uses the normal Teams browser guest route, with no ACS resource/app registration required for this POC.

Tests stop after three minutes including preparation/lobby time. Version 9 includes Teams transcript history and retrospective review. Teams output is still transcript-only; spoken Teams moderation remains pending. Use **Save to meeting history** for completed tests, with reload, Markdown export and deletion. Saved Teams records now also have host agenda/roster editing, paid-consent retrospective Muse review, source-linked proposals, explicit confirmation, speaker correction and dismissal. These controls are deployed in version 9. The first integrated live test transcribed speech but stopped about 26.5 seconds early. A server audio-pacing fix is installed and passes offline regression tests; a fresh consented live retry is pending. Phone-on-table browser capture remains the baseline; MMS browser playback is deployed; Teams output is still being connected.

[Deployment result, verification and rollback](docs/research/teams-transcription-deployment-result.md) · [Current handoff](docs/handoff.md). Deployment incurred **$0** in Muse calls. Current tracked estimate **$0.15263115**, conditional remaining credit **$149.84736885** if the full $150 grant is applied and no other usage exists; actual Billing remains unverified.

## Browser meeting inputs

Choose **Meeting browser tab** when creating a meeting to capture a user-selected WhatsApp Web, Zoom Web, Google Meet, Jitsi or other browser call, with an optional host microphone. Use **Check audio · free** to verify separate input levels locally before starting Muse transcription. Prompts stay with the host; this route does not add Rally as a call participant. [Presenter view](docs/presenter-view.md) provides a clean call display. **Share confirmed outcomes** prepares a manual WhatsApp draft after the meeting. No additional connector subscription is used; real Muse calls retain their existing costs. [Instructions and validation limits](docs/browser-meetings.md) · [Platform handoff](docs/platform-progress-2026-10-29.md).

## Meta model use and competition voice

Runtime transcription uses **Muse Voice Transcribe** and reasoning uses **Muse Spark 1.3** via Meta Model API. The additional voice adapter uses **Meta MMS English `facebook/mms-tts-eng`**, pinned to `c71de0fe7204c83f1c10820a7d696d0b450048ba`, **self-hosted on the Rally Ubuntu CPU host**. Its weights are **CC BY-NC 4.0**; model files stay outside this repository. [Adapter, attribution and reproduction](experiments/meta-mms/README.md) · [actual CPU measurements](docs/research/mms-cpu-benchmark.json).

The organizer FAQ supplied by the user permits self-hosted MMS and excludes third-party TTS models. No GPT/third-party TTS is used for the competition path. Legacy browser/OS voice diagnostics are disabled by default in the new app code; local voice execution alone is not proof of Meta model origin. MMS is connected to the deployed browser player in version 9. Protected hosted playback and Stop passed with synthetic text; physical listening and Teams audio output remain unverified.

[Model interfaces and configuration](docs/model-interfaces.md) · [MMS playback](docs/mms-playback.md) · [Current release](docs/releases/2026-10-29-v12.md) · [Earlier build checkpoint](docs/overnight-build-2026-10-29.md) · [submission requirements and model eligibility review](docs/research/submission-requirements-meta-audit-2026-10-29.md) · [submission draft](docs/submission-package.md).

## Run locally

Node.js 24+ is required:

```bash
cd apps/rally
npm ci
npm run build
npm run dev
```

The default local server disables paid calls. To enable real Muse locally, configure `MODEL_API_KEY` in the ignored root `.env.local` and run `RALLY_PAID_ENABLED=1 npm run dev`. Never commit the key. The dev server binds loopback; use HTTPS for phone microphone tests.

## Review the build

- [Build verification and limits](docs/build-progress.md)
- [Current handoff](docs/handoff.md)
- [Roadmap](docs/rally-roadmap.md) and [implementation backlog](docs/implementation-backlog.md)
- [Documentation index](docs/README.md)
- [API budget](docs/api-budget.md) and [tracked cost ledger](docs/research/muse-cost-ledger.md)

The baseline implemented flow includes live transcription/moderation, host controls, proposed outcomes with explicit host confirmation, saved history, export/deletion, wrap-up timing, and visible cost estimates. The walkthrough is scripted and is never represented as a live model demonstration.

Phone hardware, room echo, automatic voice identity and the fixed Teams transcription flow still require real-device/live checks. The normal Teams client previously exchanged real meeting audio; see the deployment result for the boundary between that proof and the new queue/transcription integration.

## Submission source

The event requires a public repository. Source and documentation were pushed to [ejo4041/Rally](https://github.com/ejo4041/Rally) on October 29 with user authorization. The initial source checkpoint is `0668cf2` on `main`; repository visibility and outside-viewer access have not been verified. The sanitized publishing checkout is `/srv/hackathon/rally-source-checkpoint`; see [tonight's offline work](docs/offline-progress-2026-10-29.md). The Sites helper owns a nested source checkout at `apps/rally`; a sanitized export avoids nested-Git, credentials, local database and dependency files:

```bash
python3 scripts/export_submission.py --out /tmp/rally-submission-source.zip
```

The export is a source snapshot, not a deployed product or submission. Its hosting manifest omits this workspace’s Site identity. Preserve third-party fixture attribution in the research docs. Only claim features/code actually built during the hackathon; see the supplied [participant guide](docs/hackathon-participant-guide.md).
