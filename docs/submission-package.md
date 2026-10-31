# Rally submission package — working draft

This draft reflects the integrated Node application on October 31, 2026. Final submission remains on hold. Use the [supplied participant guide](hackathon-participant-guide.md) and recheck authenticated portal requirements before entering a final submission. The existing [access review](research/submission-access-check-2026-10-30.md) is dated evidence, not proof of current source/video accessibility.

## Project description

Rally helps a host keep a decision meeting moving and retain the source for its conclusions. Meta Muse Voice Transcribe supplies streaming speech evidence. Muse Spark 1.3 prepares an agenda, evaluates the conversation against goals and remaining time, answers addressed questions and analyzes the full finalized transcript. SeamlessM4T streams approved prompts into the browser or integrated Teams call. Local pinned Meta MMS supplies a configurable local voice and the prepared video's narration.

The host chooses passive, balanced or proactive guidance and retains pause, dismiss and stop controls. Rally can join Teams with an animated visual presence or capture a host microphone/selected call tab with consent. Connected Teams calls survive dashboard closure. End drains speech, produces the report, attempts an authenticated summary hyperlink in permitted meeting chat, confirms Leave and releases media resources.

Reports distinguish reported agreement, proposal and unresolved items. Source links, uncertain owners/dates, reversible speaker names and durable host notes make the interpretation reviewable. Named-account report grants are read-only and revocable; PDF/JSON export is available. Accounts are invitation-only with mandatory MFA. Developer content sharing is separately optional and initially off.

## Original application work

Application work includes meeting lifecycle, live agenda/deadline policy, provisional/final evidence validation, concern memory, model capability adapters, approved speech/cancellation, owner-isolated records, Teams transport and visual-presence integration, source review, annotations, sharing, PDF and account controls. The source history and dated measurements identify implementation checkpoints. Meta models, visual assets and external libraries remain credited to their authors. The earlier Sites application is a separate iteration with different controls.

Verify the actual contributor list and event-period contributions before final submission. Operational references to concurrent sessions are not contributor attribution. Do not omit anyone whose work must be disclosed under the event's rules, or claim authorship of external components. Root source licensing remains unselected.

## Models and evidence

| Model | Role and provenance |
| --- | --- |
| Muse Voice Transcribe | Meta Model API transcription; labels remain anonymous/session scoped. |
| Muse Spark 1.3 | Meta Model API preparation, continuous guidance and final reporting; evidence-linked interpretations. |
| SeamlessM4T-v2-large | Streaming production speech through the configured endpoint; remote checkpoint revision unknown. Earlier provider and Teams measurements are retained. |
| `facebook/mms-tts-eng` | Offline local voice and narration, pinned revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`; weights CC BY-NC 4.0. |

[Model interfaces](model-interfaces.md) · [MMS provenance](../experiments/meta-mms/README.md) · [Teams wrap-up evidence](teams-wrapup.md). Living Silk is the supplied visual artwork/runtime, not a Meta image/video model. No claim of Wonder/SAM integration or native platform person-level speech feeds is made.

## Video and judge access

[Three-minute script](demo-script.md) and [video provenance](demo-feedback-draft.md) identify synthetic meeting footage and local MMS narration explicitly. The 180-second walkthrough is an edited review artifact; it does not establish live inference latency. Actual live-call observations remain separate. The closing meeting-workspace idea is future direction.

The app is public HTTPS at https://rally.tail703f9e.ts.net/ with invitation-only MFA access. Prepare and rehearse a named judge account, then check app, source and finished video links from an independent device. Confirm source public access/license, actual contributors and authenticated portal fields. The older private/Tailscale-only instructions are superseded. Do not expose real records or alter visibility as a side effect of preparing this draft.

## Source package

`python3 scripts/export_submission.py --out /tmp/rally-source-draft.zip` makes a local tracked-source archive with runtime/credential/model filters. Review contents and configured-secret matches before sharing. Old archive manifests refer to their pinned commits, not current code. No source archive, video or final entry has been submitted by this preparation.
