# Rally current handoff — October 31, 2026

The public app is https://rally.tail703f9e.ts.net/ . Access requires an invited account and MFA. At this check, remote main was `a2278e0`, static release `a9f0004`, and API application source `8054fb5`. All tracked API/frontend source matched main; later static updates did not restart the API. [Fresh live UI readiness check](readiness-2026-10-31.md).

## Implemented

- Muse Voice Transcribe supplies streaming transcript evidence and anonymous session speaker labels. Native platform transcripts are not used.
- Muse Spark 1.3 prepares agendas, evaluates provisional/finalized speech against time and goals, answers addressed questions, and generates full reports. Passive/balanced/proactive settings retain host pause/stop control.
- SeamlessM4T-v2-large through the configured speech endpoint supplies streamed production voice. Local pinned Meta MMS is a configurable local voice and demo narration tool. Remote speech checkpoint revision is unknown.
- Integrated Teams voice/video uses one meeting engine and a Living Silk visual presence. Connected calls survive dashboard closure; End performs a bounded animated wrap-up, posts an authenticated summary link when chat permits, confirms Leave, and releases resources.
- Original agenda, speaker correction, durable host notes, named-account report grants/revocation, PDF/export, response history, mobile sheets, themes and explicit developer-sharing consent are implemented.
- Closed registration, MFA/recovery, admin role controls and owner isolation protect records.

## Evidence

Latest broad recorded regression: 139 backend tests and 17 frontend tests, both type checks/build and browser workflows. The October 31 [deployed UI measurement](research/current-ui-audit-2026-10-31.json) freshly passed MFA, closed signup, theme persistence, loading recovery, PDF, named sharing/denial/revocation with disposable synthetic records and zero model calls. Actual Teams rehearsal, chat hyperlink and normal Leave evidence are in [wrap-up](teams-wrapup.md). Local camera measurements are distinct from remote recipient acceptance.

## Demo and source preparation

[Current three-minute script](demo-script.md), [narration/footage provenance](demo-feedback-draft.md) and [submission draft](submission-package.md) describe the current product and separate actual model/meeting evidence from the synthetic walkthrough. The video remains a local artifact pending review; final submission is on hold. Preserve Meta/component attribution and accurate original-work disclosure.

## Remaining acceptance

Use the ordered [readiness list](readiness-2026-10-31.md): a 30–60-minute current-code real call and settled usage; remote camera/captions/duplex/echo; normal host-to-recipient End/report access; real mobile/background/network/MFA behavior; handling individual finalized turns above 8,000 characters; final video, source licensing/access and judge account rehearsal. WhatsApp guest joining remains experimental.

## Operations

Workspace `/srv/hackathon/rally-feedback`. API/web/media system services are `rally-integrated-api`, `rally-integrated-web`, `rally-integrated-media`; immutable releases and persistent state/configuration are under `/srv/hackathon/rally-deployed`. Before deployment, check active capture/report/usage, compare release ancestry, build fully and back up SQLite. Preserve MFA secrets, the shared Teams camera lock and runtime data. Shared-host browser checks must use the bounded systemd settings in AGENTS.md.

[API](backend-api.md) · [Model interfaces](model-interfaces.md) · [Presence operations](living-presence-operations.md) · [MFA/admin](mfa-admin-judge-audit.md) · [Deployment](integrated-deployment.md) · [Dated prior handoffs](handoff-history-through-2026-10-31.md).
