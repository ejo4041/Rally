# Graceful Teams wrap-up

User request: End should visibly process notes instead of freezing, post a summary link in the meeting chat, then leave. Implemented on droplet branch feedback/demo-polish-20261030.

End immediately blocks further ASR input, cancels moderation/speech and drains final transcript. A finishing scene continues animating in the outgoing camera. Report generation runs in the background. A bounded Teams finish posts one configured-origin, authenticated summary deep link and presses Leave (never End for everyone), then closes browser/audio/camera resources. The camera stays up at least3seconds; entire finish is bounded12seconds. Duplicate Ends do not post twice. Administrative revoke/interrupt/shutdown still stop immediately, without posting a chat message. Failed ASR drain closes the call and leaves saved text for explicit review/retry.

The link `/#report/<meeting-id>` opens the owner view or the named recipient’s read-only report. It contains no bearer token and grants no new access; denied users see an instruction to ask the host. The message says notes may still be preparing. Host controls show sent/unavailable/uncertain delivery and the summary link. A blocked or uncertain chat never traps Rally in the call or automatically retries an ambiguous send. Playback/chat UI confirmation is not independent remote receipt.

Microsoft meeting policy can deny anonymous chat: https://support.microsoft.com/en-us/teams/meetings/access-meeting-chat-in-microsoft-teams . Browser adapter selectors require remote acceptance; local tests cover actual Playwright compose/send/confirmation and blocked/ambiguous paths.

Validation:138backend/17frontend tests, both typechecks/build. Focused real HTTP Teams test verifies ASR drain before finish, approved summary URL, one finish invocation, call close and repeat-End idempotence. Renderer check on an isolated port shows healthy silk and finishing spinner. Full browser feedback test passes deep-link recipient access and denied access after revocation, plus previous loading/MFA/PDF workflows. No paid calls in these fixture checks. Remote rehearsal is pending using the invite stored only in ignored artifacts.
