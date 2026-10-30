# Rally Node backend — frontend contract v1

Final transcript records may include `sourceOrder`, an adapter-normalized speech-start order within a session. It is independent of opaque provider `turnId`; do not sort IDs numerically. Missing detected speech end stays null. Saved legacy records use available processing positions/insertion order as a fallback, without reconstructing missing chronology. [Speaker contract and limitations](speaker-attribution.md).

**October 30 additions:** [Speech routes/lifecycle](integrated-speech.md), [reversible speaker labels and durable annotations](speaker-attribution.md). Meeting snapshots optionally include `reportStale`, `reportNotes` and `audioExclusions`; missing fields on older records are supported. Speaker `name: null` clears a label. Report status includes `stale`; ready stale reports can be explicitly reanalyzed after capture has ended or been interrupted through the existing retry route. Resuming capture marks an existing report stale without automatically analyzing it; failed starts preserve its status. Intervention events include the approving `epoch`; clients reject older control/prompt epochs. `speech.cancel` revokes pending output after revised evidence.

The frontend is implemented separately. Start with [local setup](../apps/rally-api/README.md). Payload types and validation schemas live in [contracts.ts](../apps/rally-api/src/contracts.ts). The API is separate from the existing hosted Worker routes.

## Authentication and HTTP

Use `credentials: 'include'` for fetch. Use the same hostname for frontend and API (`localhost` consistently or `127.0.0.1` consistently). Configure exact frontend origins. Cookies are HttpOnly and scoped to `/api`; the frontend never receives a provider key. Protected resources belonging to another user return 404. Validation errors return `{error: string}`; 409 denotes an incompatible/busy state or budget block.

| Method and path, relative to `/api` | Request / result |
| --- | --- |
| `POST /auth/signup`, `/auth/login` | `{username,password}` → `{id,username}` and session cookie. Username: 3–40 lowercase letters/digits/underscore/hyphen; password: 10–200 characters. |
| `GET /auth/me` | Current public user. |
| `POST /auth/logout` | Stops the user's active capture and revokes this session. |
| `GET /meetings` | Current user's newest-first meeting summaries. |
| `POST /meetings` | `{agenda,durationMinutes,title?,participants?}` → saved meeting, HTTP 201. Waits for preparation; failure returns a saved draft with `error`, never a fabricated plan. |
| `GET /meetings/:id` | Authoritative meeting snapshot including all finalized `turns`. |
| `POST /meetings/:id/prepare` | Retry agenda generation for draft/ready meeting. |
| `PATCH /meetings/:id/plan` | Complete `Plan`: objective, topics with stable ID/title/outcome/minutes/status, durationMinutes, wrapMinutes. Non-parked topic budgets plus wrap-up must equal duration. |
| `POST /meetings/:id/start` | `{consented:true}` → `{meeting,connection:{url,token,room}}`. Call only after plan review and consent. |
| `POST /meetings/:id/connection` | Fresh room credentials for an active meeting. |
| `POST /meetings/:id/reconnect` | `{consented:true}` → explicitly replace failed capture/ASR with a new session; labels restart and transcript remains saved. |
| `POST /meetings/:id/commands` | `{type:'pause'|'resume'|'dismiss'|'request_guidance'}` → meeting. Pause affects moderation, not capture. |
| `PATCH /meetings/:id/speakers` | `{speakerId,name}` → corrected label mapping; `name` is trimmed 1–100 characters or `null` to clear. Changes during report processing return 409. |
| `POST /meetings/:id/end` | Stop/drain ASR, save, start final analysis; HTTP 202. Stop publishing microphone audio when ending. |
| `GET /meetings/:id/report` | `{status,report,error}`. Status: none/processing/ready/failed. |
| `POST /meetings/:id/report/retry` | Explicit background retry. Unknown accounting blocks paid calls. |
| `PATCH /meetings/:id/report` | `{note}` appends an attributed host correction to the completed summary. |
| `GET /meetings/:id/export` | Download JSON meeting, report and finalized transcript. |
| `DELETE /meetings/:id` | Stops capture and removes meeting/turns; returns 204. Busy preparation/report jobs and final audio drain must finish first. Accounting remains. |
| `GET /usage` | Current user's sanitized usage rows, including running reservations and unknown costs. |
| `GET /health` | `{ok:true}` liveness; not a claim that providers are reachable. |

Meeting phases: draft → ready → live → ended; a stopped/crashed capture becomes interrupted and can explicitly reconnect. Planned duration does not automatically end the meeting. End is idempotent. No command should be automatically retried merely because the HTTP response was lost: retrieve the authoritative snapshot first.

## LiveKit client

Install `livekit-client`. Use the returned credentials, not a backend API key. One host identity and one microphone publication per meeting are accepted; opening another tab with the same identity replaces the first connection.

```ts
import { Room, RoomEvent } from 'livekit-client';
const room = new Room();
room.on(RoomEvent.DataReceived, (bytes, _participant, _kind, topic) => {
  if (topic === 'rally') handleEvent(JSON.parse(new TextDecoder().decode(bytes)));
});
await room.connect(connection.url, connection.token);
await room.localParticipant.setMicrophoneEnabled(true);
// On End: disable the microphone, POST /end, remain connected for report.ready.
```

Use a user gesture for microphone permission and future audio playback. No product frontend is included in this package. The test browser page is only a transport check.

Events use `{version:1,id,meetingId,type,data}` on topic `rally`:

| Type | Data |
| --- | --- |
| `transcript.partial` | `{text, sessionId?, turnId?}` transient caption; scoped finals clear only their own caption; not evidence |
| `transcript.final` | Canonical turn with stable `id`, session/turn IDs, revision, text, speaker, nullable start/end milliseconds from meeting start |
| `assessment` | Health, concerns, evidence, cumulative progress, and model recommendations; only `intervention` events authorize presentation as an intervention |
| `intervention` | Approved `{id,at,text,kind}` after server cooldown/host checks |
| `plan.updated` | `{plan,reason}` |
| `moderator.control` | `{type,epoch}`; immediately clear dismissed/paused pending presentation |
| `speaker.updated` | `{speakerId,name}` |
| `capture.gap`, `processing.error` | Visible degraded state; use explicit reconnect/retry |
| `meeting.ended` | `{endedAt}` |
| `report.ready`, `report.failed` | Retrieve the saved report through HTTP |
| `state.changed` | `{refresh:true}` when a payload is too large for a small data event |

A data notification is not durable storage. On connection/reconnection, fetch the HTTP snapshot; upsert turns by ID and revision, never append partials to the transcript. Poll report status while processing as a fallback if a notification is missed. Speaker keys include the ASR session; do not merge `A` across reconnects.

## Result semantics

Reports are AI interpretations. `reported_agreement` indicates explicit agreement found in speech, `proposal` indicates a suggestion, and `unresolved` indicates missing certainty. None means a host explicitly confirmed the item. Owners/dates may be null; ticket/meeting follow-ups are draft suggestions only.

The overall score averages only assessable categories; `coverage` is the number out of five. Unknown speaker attribution and unavailable timing remain null. Host edits are preserved as a correction note, not silently attributed to the model.

## Existing Teams runner bridge

Authenticated `GET /teams/status`, `POST /teams/join`, `POST /teams/leave` and `POST /teams/save` reuse the bounded existing Teams transcription runner. Join accepts `{meetingUrl,consented:true,transcribe,transcriptionConsented}`. Leave/save accept the **local** owned connection `{id}`. Status never exposes another user's job. Save returns `{meetingId}` without a model request. The Teams service budget/usage is separate from the Node ledger. This is not LiveKit-based platform joining or live moderation. [Lifecycle, privacy and configuration](teams-integrated-ui.md).

## ASR continuity notifications

`transcription.gap` reports a planned or recoverable handoff: clear transient captions/interventions and refresh the snapshot, while preserving capture. `capture.gap` remains a fatal local-capture stop with explicit recovery. Both can have `{reason}` and persist gap metadata. See [session handoff and tests](asr-session-handoff.md).

## Streaming speech and live Teams (release `c20261d`)

These additions supersede the older host-only MMS delivery description when `RALLY_SPEECH_ADAPTER=seamless-aws` is selected. All routes below require backend login and owner access where a meeting is specified. Mutation requests retain origin checks. Provider credentials never reach clients.

| Route (under `/api`) | Contract |
| --- | --- |
| `GET /speech/status` | Configured adapter/model/audio identity and readiness. Configuration readiness is not an upstream health measurement. |
| `POST /speech/generate` | `{input,voice?:"default"}` → complete validated `audio/wav`. |
| `POST /speech/stream` | Same request → incremental raw PCM, `application/octet-stream`, headers `X-Audio-Format: pcm_s16le`, `X-Audio-Sample-Rate: 16000`, `X-Audio-Channels: 1`. |
| `GET /speech/usage` | Current owner's sanitized AWS speech request records; infrastructure costs may be null. |
| `POST /meetings/:id/heartbeat` | `{captureToken}` renews browser capture lease. Renew every twenty seconds; default expiry is ninety seconds. Token is supplied by the capture connection flow. |
| `POST /meetings/:id/teams/connect` | Prepared meeting, `{meetingUrl,consented:true}` → HTTP 202 join state. Requires enabled live Teams and streaming speech. Poll status for admission/failure. |
| `GET /meetings/:id/teams/status` | Current call connection state. Joining does not imply admission. |
| `POST /meetings/:id/teams/leave` | Explicitly disconnects. A previously started call, including an interrupted call, follows the existing final-report flow. |

The commands endpoint additionally accepts `voice_on` and `voice_off`. Voice-off cancels current synthesis/playback. Pause, dismiss, End, invalidation and transport loss also cancel current speech. Do not automatically retry commands or an utterance after uncertain partial playback.

Generic TTS accepts 1–1,200 Unicode characters (nonblank), English/default voice. It does not insert meeting language. WAV uses whole-generation; PCM uses sentence chunking. A network chunk need not align to a sample or playback frame: retain odd trailing bytes and frame for the consumer. A failure before response bytes uses the standard error response; after bytes begin, the connection closes. Honor `Retry-After` when present. Paid processing must be enabled; per-account request throttles, hourly/daily quotas and provider concurrency apply. No automatic provider retry or MMS fallback occurs.

Every approved meeting intervention is saved as structured guidance before audio begins and starts with `Let's get back on track.`. `speech.status` events identify job/intervention, epoch, destination and preparing/playing/completed/canceled/failed state. Accept only the current approved job/epoch; revoke stopped jobs immediately and do not replay on reconnect. Audio arrives through LiveKit, not as JSON/base64. In Teams mode it goes solely to the isolated call microphone; the dashboard does not duplicate speech or publish microphone input.

`meeting.status` is emitted at the ten-second check interval, including while paused or an assessment is busy. Its data includes `at`, `epoch`, `phase`, `paused`, nullable `health` and `reason`, `issues`, `progress`, `assessmentAt`, `assessmentState`, `speech`, `destination`, `callState` and `currentTopic`. `assessmentAt` makes stale judgments distinguishable from a fresh heartbeat. Authoritative HTTP snapshots retain assessment, `liveStatus`, `speechStatus` and call state for reconnects.

Teams has a connected-runner lease independent of the dashboard; logout or dashboard closure does not end it. Explicit End/Leave does. Transport loss interrupts capture without automatic rejoin. The legacy `/teams/join` flow is disabled when integrated live Teams is enabled. See [implementation](streaming-speech-plan.md) and [tested boundaries](streaming-speech-validation.md).

## Continuous monitoring additions

With `RALLY_REALTIME_ENABLED=1`, live snapshots include `monitor` and optional `extension`; `meeting.check` events carry monotonically sequenced check results, source freshness and a conservative forecast. `GET /api/meetings/:id/checks?before=<sequence>` provides owner-only pages of fifty records. `POST /api/meetings/:id/extension/presented` acknowledges a visible proposal with `{proposalId}`; `POST /api/meetings/:id/extension` confirms or rejects it with `{proposalId,accept}`. These mutations retain existing authentication and origin protection. Host reconfirmation resolves disputed spoken consent before further agenda edits. [Complete backend behavior](realtime-backend-notes.md) and [validation boundaries](realtime-monitoring-validation.md).
