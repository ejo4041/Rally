# Rally readiness check — October 31, 2026

Checked GitHub refs/source and the running public HTTPS UI. Remote main is `a2278e0`; the release symlink is `a9f0004`. All 31 tracked API source files and all 26 tracked frontend source files match main. The API remains the earlier `8054fb5` process after subsequent static-only releases; this is documented and not missing application code. No production service restart or meeting join was performed.

## Fresh live UI evidence

The existing deployed Playwright workflow passed public HTTPS MFA enrollment/login, secure cookies, closed signup, theme persistence, model attribution, loading failure recovery, duplicate-submit protection, Rally response history, actual PDF download, named-account sharing, full-meeting denial and revocation. Disposable synthetic records were removed. Zero model calls and zero platform joins. [Machine-readable result](research/current-ui-audit-2026-10-31.json). Desktop/mobile viewport screenshots were inspected; physical device acceptance remains separate.

The first operator run stopped at a local PDF output permission error. A temporary copy redirected its download into writable /tmp and passed; the temporary script was removed. Application code was unchanged. Both runs used the required bounded transient systemd unit.

## Implementation and documentation still useful

- Handle individual finalized turns longer than 8,000 characters in live reasoning without falsely presenting truncated evidence as a full turn. Current implementation explicitly skips that live check; the complete text remains available for final analysis. Long-turn response behavior needs its own acceptance case.
- Refresh the submission draft and demonstration script to reflect continuous monitoring, integrated Teams voice/video, Seamless speech, closed accounts, sharing/PDF and graceful wrap-up. The older submission package still describes Teams as a transcription-only experiment. The current 180-second narrated draft is explicitly synthetic and still mentions advance participants removed from setup.
- Consolidate the append-only handoff into one current status plus dated history. Historical release, access and pending-test statements now conflict with completed work.
- Finish source licensing/access decisions, named judge account/access instructions, contributor verification and an accurate final video. Final submission remains on hold. No root LICENSE was found locally; anonymous GitHub access and authenticated portal requirements were not rechecked in this audit.
- WhatsApp guest joining and other native platform connectors remain separate unfinished integrations. Host-side microphone/tab capture is implemented; expanding connectors is optional to completing the Teams demonstration.

## Acceptance tests still needed

1. A 30–60-minute real Teams meeting on current code: continuous/overlapping speech, addressed questions, drift/recovery, pause/dismiss/voice-off, mute, dashboard close/reopen, network interruption and 55-minute ASR handoff; then full report and reconciled provider usage. Prior accelerated replays and synthetic media soaks do not establish this integrated real-provider result.
2. Remote recipient verification of current camera framing, enlarged text/captions, smoothness and speech audibility. Duplex is currently enabled in runtime configuration; prior implementation notes condition reliable overlap/echo claims on remote testing. Check that Rally voice does not become participant commitments while overlapping human speech is retained.
3. A normal host-owned End flow: moving finishing scene, minimum hold, posted clickable summary, recipient MFA/read-only access and confirmed remote departure. Posted anchors/Leave and local report ACLs already have evidence; the user's opening of the newest exact report link remained unconfirmed in wrap-up notes.
4. Actual phone/laptop and network coverage: foreground/background, sleep, mic/tab permissions, audio restore, MFA/recovery and intended Bitwarden behavior. Public UI/media previously passed server-origin relay tests; restrictive-network connectivity still needs acceptance and TURN only if required by observed failure.
5. Judge rehearsal from an independently invited account, including activation/MFA, report permissions, app/source/video links and complete demo timing.

Recorded latest broad suite: 139 backend and 17 frontend tests, type checks/build and workflow checks. This audit did not rerun that suite; it freshly ran the deployed UI/PDF/sharing workflow above.

## Existing reliability evidence

The prior 65-minute synthetic browser/LiveKit capture experiment passed, crossing a 55-minute handoff. Its source predates later realtime/presence work. The earlier local eight-hour MMS attempt records stopped after about 4.5 hours, so it must not be described as a completed eight-hour pass. Production speech now uses Seamless through the configured endpoint; local MMS tests are separate evidence.
