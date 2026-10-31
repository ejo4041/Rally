**Phone continuation:** Omnigent droplet session **Rally · Teams wrap-up handoff** (`bc8e5295591d4b4ba6e18164f8c7fd49`), workspace `/srv/hackathon/rally-feedback`. History-only checkpoint; no second runner. Current application8054fb5.

# Graceful Teams wrap-up

User request: End should visibly process notes instead of freezing, post a summary link in the meeting chat, then leave. Implemented on droplet branch feedback/demo-polish-20261030.

End immediately blocks further ASR input, cancels moderation/speech and drains final transcript. A finishing scene continues animating in the outgoing camera. Report generation runs in the background. A bounded Teams finish posts one configured-origin, authenticated summary deep link and presses Leave (never End for everyone), then closes browser/audio/camera resources. The camera stays up at least3seconds; entire finish is bounded12seconds. Duplicate Ends do not post twice. Administrative revoke/interrupt/shutdown still stop immediately, without posting a chat message. Failed ASR drain closes the call and leaves saved text for explicit review/retry.

The link `/#report/<meeting-id>` opens the owner view or the named recipient’s read-only report. It contains no bearer token and grants no new access; denied users see an instruction to ask the host. The message says notes may still be preparing. Host controls show sent/unavailable/uncertain delivery and the summary link. A blocked or uncertain chat never traps Rally in the call or automatically retries an ambiguous send. Playback/chat UI confirmation is not independent remote receipt.

Microsoft meeting policy can deny anonymous chat: https://support.microsoft.com/en-us/teams/meetings/access-meeting-chat-in-microsoft-teams . Browser adapter selectors require remote acceptance; local tests cover actual Playwright compose/send/confirmation and blocked/ambiguous paths.

Validation:138backend/17frontend tests, both typechecks/build. Focused real HTTP Teams test verifies ASR drain before finish, approved summary URL, one finish invocation, call close and repeat-End idempotence. Renderer check on an isolated port shows healthy silk and finishing spinner. Full browser feedback test passes deep-link recipient access and denied access after revocation, plus previous loading/MFA/PDF workflows. No paid calls in these fixture checks. Remote rehearsal is pending using the invite stored only in ignored artifacts.

## First remote rehearsal: failed acceptance

Spinner was visible; report completed and was shared with rally_admin. End returned3.5seconds and local resources closed, but user observed a frozen lingering Rally participant. Chat delivery was unconfirmed. Local close is not proof of remote departure. Follow-up waits for Teams post-call UI or disconnected peers after the actual Leave button before browser/camera teardown; displays unconfirmed departure explicitly on failure. Chat confirmation also tolerates Microsoft Safe Links and already-open chat. A renewed remote rehearsal remains required.

## Follow-up verification and remaining formatting

Release6df86ce active: Teams post-call screen and both closed peers confirmed before teardown; user confirmed animation then quick departure. Second batch $0.02693345, total tracked Muse $1.86086795, conditional unverified-$150 remainder $148.13913205.139backend tests pass, with focused chat/leave tests rerun after later composition changes;17frontend and feedback browser checks pass. No paid calls in the later transport-only checks.

User requests about ten additional seconds; source minimum increased from3to13seconds, with25second overall finish bound. Transport-only check using the prior ready private report confirmed sent chat and leave in13.885seconds. Chat readiness is later than media connection; wait for visible Chat control (8seconds) before opening composer. URL formatting still needs remote clickable-link acceptance. The account rally_admin already has both rehearsal report grants. Initial scripts granted only after report completion, permitting a transient denial when following the posted link early; future rehearsal grants are installed before connecting. Normal host-owned meetings already permit their creator to open the link while processing.

## Final requested polish

Minimum wrap-up increased to13seconds (about ten more than the first working version); a no-model transport check measured13.885seconds through confirmed departure. Source waits for Chat readiness separately from media connection. Native Teams Insert link (Ctrl+K, display text/address, Insert) now creates an explicit “Open meeting summary” hyperlink, verified in the composer before Send. A typed space after a filled URL did not establish a clickable link in the real client and was replaced. [Microsoft instructions](https://support.microsoft.com/en-us/teams/chat/send-a-file-picture-or-link-in-microsoft-teams). Local real-Chromium tests exercise the accessible insertion dialog, actual href, delayed chat readiness, send uncertainty and disabled chat. Final real-client native-link acceptance awaits host admission; do not claim it passed.

Both prior rehearsal reports grant rally_admin. The exact private report link is available in the owner account; it is omitted from public documentation. The test grant was originally delayed until report completion; future rehearsal setup grants before joining. User confirmed username rally_admin; retry of the exact ready link is unconfirmed. Do not broaden normal report ACLs to all accounts or bypass MFA.

All later connection/readiness/formatting checks are transport-only, with no ASR/Spark/TTS model calls. Paid total remains $1.86086795, conditional unverified-$150 remainder $148.13913205. One standalone check failed to start because operator environment omitted XDG_RUNTIME_DIR; rerun used production’s /run/user/1000. Operator context must match systemd and hold the shared Teams lock. Native link insertion and final deployment are tracked in the latest handoff entry.

## Actual clickable link fix

The anonymous Teams client exposes a minimal chat editor: Ctrl+K and the desktop Insert link dialog were not available, even with formatting expanded. Do not rely on the preceding native-dialog implementation. Normal formatted paste through the bot’s own isolated browser clipboard successfully created a real composer anchor and a posted chat anchor, verified in the live Teams page. The adapter now uses that supported paste path; it never injects message DOM or calls undocumented Teams endpoints. Clipboard permissions are scoped to the bot browser’s current Teams origin and preserve its camera/microphone grants. The clipboard is cleared after verifying the pasted anchor. No laptop clipboard or laptop services are touched. If Teams strips the hyperlink, the adapter does not send a plain-text substitute.

Actual live message/anchor and subsequent normal Leave are recorded in [clickable-summary evidence](research/teams-clickable-summary-check.json). This isolated formatting check did not run models or retime an Engine End; prior13.885second hold remains separate evidence. Real-Chromium localhost tests now use the actual Clipboard API and paste events, with delayed chat controls, new-message confirmation, uncertainty/no retries and disabled-chat paths. Three summary/leave tests and five Teams lifecycle tests pass after this fix; the previous full suite139 and frontend17/feedback browser checks remain recorded above.

## Current deployment —8054fb5

Final adapter is active. Idle capture/report/usage and free shared camera lock checked; SQLite backed up, API restarted, media service preserved.13second minimum wrap-up,25second bound, actual normal Teams leave acknowledgement, and explicit rich-text clipboard hyperlink. Live posted anchor verified and normal leave confirmed; no additional model calls in transport checks. The supplied meeting invite remains only in ignored mode0600 artifacts. Native dialog implementation08af62e was superseded after it proved unavailable in the anonymous client.

Rehearsal owner accounts (two wrapup_* users) remain to preserve auditable model usage and the two reports, with their sessions revoked. Both report grants to rally_admin remain active; disabling these owner accounts also disables recipient report access by design. These are private test reports, not broadly shared production meetings.
