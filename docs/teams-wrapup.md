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

Both prior rehearsal reports grant rally_admin. Exact latest link: https://rally.tail703f9e.ts.net/#report/98de2d2a-7280-4815-b3b4-11672ca94b99 . The test grant was originally delayed until report completion; future rehearsal setup grants before joining. User confirmed username rally_admin; retry of the exact ready link is unconfirmed. Do not broaden normal report ACLs to all accounts or bypass MFA.

All later connection/readiness/formatting checks are transport-only, with no ASR/Spark/TTS model calls. Paid total remains $1.86086795, conditional unverified-$150 remainder $148.13913205. One standalone check failed to start because operator environment omitted XDG_RUNTIME_DIR; rerun used production’s /run/user/1000. Operator context must match systemd and hold the shared Teams lock. Native link insertion and final deployment are tracked in the latest handoff entry.
