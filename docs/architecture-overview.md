# Architecture overview

Rally keeps meeting state and host control in the application, with model capabilities behind explicit adapters. The public sample builds the same interface against a fictional in-memory API.

## A real meeting

1. The browser sends an agenda to the Node API. Muse Spark returns a validated, editable meeting plan.
2. After consent, microphone or browser-tab audio travels through LiveKit. The optional Linux Teams guest runner joins a supplied invitation and bridges virtual media.
3. Muse Voice Transcribe emits partial captions and finalized turns. Finalized transcript evidence is stored separately from transient captions.
4. Muse Spark evaluates the conversation against the agenda and available time. The host's participation mode, pause/dismiss controls and speech state gate what Rally displays or says.
5. End stops capture/participation and requests a report over the saved transcript. Report items link to supporting finalized turns. Host corrections, notes, exports and named-user report sharing remain application features.

Speech is a separately provisioned adapter. The deployed streamed voice uses a hosted Seamless endpoint; local MMS is optional. A Meta Model API key alone does not provision these speech services or Linux virtual devices.

## Source map

| Path | Responsibility |
| --- | --- |
| [`apps/rally-web/src/`](../apps/rally-web/src/) | Shared UI, capture controls, report review and theme |
| [`apps/rally-api/src/`](../apps/rally-api/src/) | HTTP API, account/security policy, meeting state, providers and persistence |
| [`apps/rally-api/src/muse.ts`](../apps/rally-api/src/muse.ts) | Meta reasoning/transcription integration and application usage ledger |
| [`apps/rally-api/src/teams-live.ts`](../apps/rally-api/src/teams-live.ts) | Integrated Teams guest lifecycle |
| [`packages/rally-speech/`](../packages/rally-speech/) | Shared speech text and greeting helpers |
| [`packages/living-silk/`](../packages/living-silk/) | Supplied visual runtime and Rally integration |
| [`demo/`](../demo/) | Portable checked-in sample, media and provenance |
| [`experiments/`](../experiments/) | Optional model adapters, experiments and historical integrations |

## Sample isolation

The demo build substitutes `demo-api.ts` and `demo-simulator.ts` for the authenticated client. It does not switch a real account into a weaker authentication mode. Scripted transcript turns, prerecorded voices, replies and reports remain fictional. A restrictive content policy prevents model/API network connections; only same-origin sample media plays.

## Data and trust boundaries

API keys stay on the server. SQLite stores accounts, encrypted MFA secrets, meetings, finalized transcript evidence, reports and usage/audit state. Private runtime data lives outside tracked source. Anonymous speaker labels do not verify identity. Report sharing and optional developer feedback are separate controls. Host-visible guidance and Rally's own speech are not participant evidence.

Read the [API contract](backend-api.md), [model contracts](model-interfaces.md), [security guidance](../SECURITY.md) and [setup guide](judge-quickstart.md) for implementation details and current provisioning limits.
