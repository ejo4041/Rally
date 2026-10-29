# Rally Node backend — frontend contract v1

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
| `PATCH /meetings/:id/speakers` | `{speakerId,name}` → corrected label mapping. |
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
| `transcript.partial` | `{text}` replacing the previous partial; not evidence |
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
