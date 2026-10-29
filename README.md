# Rally

A meeting moderator that keeps a decision meeting moving and turns discussion into explicitly confirmed, transcript-evidenced follow-ups.

**Private preview:** https://rally-meeting-moderator.excavator3496.chatgpt.site — sign in with the account used for this workspace.

Start with **Try a walkthrough** for a clearly labeled, zero-cost example. For real audio, create a meeting, enter an agenda/roster, confirm participant consent, and start the microphone. Muse handles transcription and reasoning; the browser voices Rally’s prompts. Review proposals before confirming them.

## Teams live-transcription POC

On the existing Site, scroll to **Invite Rally to Teams**, paste a fresh work/school meeting invite, confirm participant consent and check **Transcribe this test**. Admit **Rally audio test** from the lobby. Live text starts after admission; select **Leave meeting** and download the transcript before starting another test. The server runner is active and uses the normal Teams browser guest route, with no ACS resource/app registration required for this POC.

Tests stop after three minutes including preparation/lobby time. The deployed version is transcript-only, with no spoken moderation or main meeting-history integration yet. Local work now adds **Save to meeting history** for completed tests, with reload, Markdown export and deletion; this change has not been published. The first integrated live test transcribed speech but stopped about 26.5 seconds early. A server audio-pacing fix is installed and passes offline regression tests; a fresh consented live retry is pending. Phone-on-table browser microphone/TTS remains the fallback.

[Deployment result, verification and rollback](docs/research/teams-transcription-deployment-result.md) · [Current handoff](docs/handoff.md). Deployment incurred **$0** in Muse calls. Current tracked estimate **$0.15263115**, conditional remaining credit **$149.84736885** if the full $150 grant is applied and no other usage exists; actual Billing remains unverified.

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

The implemented flow includes live transcription/moderation, browser speech and host controls, proposed outcomes with explicit host confirmation, saved history, export/deletion, wrap-up timing, and visible cost estimates. The walkthrough is scripted and is never represented as a live model demonstration.

Phone hardware, room echo, automatic voice identity and the fixed Teams transcription flow still require real-device/live checks. The normal Teams client previously exchanged real meeting audio; see the deployment result for the boundary between that proof and the new queue/transcription integration.

## Submission source

The event requires a public repository. Source and documentation were pushed to [ejo4041/Rally](https://github.com/ejo4041/Rally) on October 29 with user authorization. The initial source checkpoint is `0668cf2` on `main`; repository visibility and outside-viewer access have not been verified. The sanitized publishing checkout is `/srv/hackathon/rally-source-checkpoint`; see [tonight's offline work](docs/offline-progress-2026-10-29.md). The Sites helper owns a nested source checkout at `apps/rally`; a sanitized export avoids nested-Git, credentials, local database and dependency files:

```bash
python3 scripts/export_submission.py --out /tmp/rally-submission-source.zip
```

The export is a source snapshot, not a deployed product or submission. Its hosting manifest omits this workspace’s Site identity. Preserve third-party fixture attribution in the research docs. Only claim features/code actually built during the hackathon; see the supplied [participant guide](docs/hackathon-participant-guide.md).
