# Normal Teams client — server and live audio test

Verified 2026-10-28T19:32:47+00:00. User authorized trying a normal Teams client on the existing Ubuntu server and supplied a work/school test-meeting link. The host admitted **Rally audio test**, confirmed it was in the meeting, and explicitly confirmed hearing the diagnostic speech. The user also spoke during a timed incoming-audio measurement. No ACS resource, custom app registration, Graph application permissions, Azure client secret, or Muse request was used.

## Result

A normal headed Teams web client successfully joined the designated meeting as a guest on this server. Outgoing speech was audible to the host. Incoming speech was measured both from the decoded browser audio stream and from the OS virtual speaker monitor. This verifies the proposed normal-client transport, not the complete Rally moderation loop.

| Check | Actual evidence |
| --- | --- |
| Teams guest join | Normal pre-join UI, host lobby admission, host confirmation, connected WebRTC audio |
| Virtual microphone | Browser enumerates and captures `Rally_Virtual_Microphone`; no fake audio device flag |
| Outgoing speech | Offline diagnostic WAV → `rally_teams_out` → virtual mic → Teams; host said “Yes, I can hear it!” |
| Real incoming browser audio | Maximum window RMS **0.138258**, peak **0.583376** across 495 windows |
| Real incoming OS speaker capture | **24.997 seconds**, RMS **0.027447**, peak **0.578888**; PCM16 mono 16 kHz |
| Initial WebRTC evidence | Inbound bytes/packets and cumulative audio energy increased with host speech; outbound media-source energy and bytes increased during the diagnostic phrase |
| Local OS routing | Synthetic 440 Hz microphone and 880 Hz speaker paths pass simultaneously; more than 20 dB separation and output Stop leaves input active |
| Bounded departure | Three-minute deadline includes lobby time; normal Leave attempted and browser closed. Both live test sessions ended automatically |
| Private services | Chromium debugging binds 127.0.0.1:9226, Xvfb TCP disabled, PulseAudio uses a private Unix socket |
| Data and model cost | Numeric levels only saved; no raw meeting audio or transcript stored; no Muse/model calls in this task |

Initial short incoming-level samples were silent despite incoming WebRTC energy. They were insufficient to establish a routing failure. The later timed comparison, while the user was explicitly speaking, measured nonzero audio through both paths. Do not carry forward the intermediate suspicion as a confirmed defect.

## Installed experiment and isolation

Source and commands: [normal-client experiment README](../../experiments/teams-web-client/README.md). It reuses existing pinned Playwright and Chromium installations and runs as `hack`, separately from the deployed ACS runner. The source is under `experiments/teams-web-client/`; ignored `state/` contains the meeting URL, profile, and private audio environment. Ignored `test-results/` contains numeric evidence and a pre-join screenshot. No meeting URL/passcode is included in these documents.

The user service `rally-teams-web-client.service` is manually started and not enabled at boot. It launches a private PulseAudio daemon, Xvfb and headed Chromium. The browser used in the evidence is **156.0.8078.4**. Headed automation on a server is empirical prototype evidence, not a Microsoft-certified hosted bot architecture or production support guarantee.

OS packages installed: PulseAudio/utilities, Xvfb, xauth, libcups2t64, eSpeak NG and dependencies. No OS upgrade, reboot, hosted Site deployment, existing ACS runner replacement, or new npm package download occurred. Existing Node and Playwright packages were reused. Any future npm download must use Nexus per the project instruction.

## What an app registration needs for this route

**Nothing: no custom app registration is needed for the guest browser-client route demonstrated here.** It joins using the normal Teams client and meeting URL under the organizer's guest/lobby policy. If another tenant requires authentication, use an authorized Teams user with interactive sign-in/MFA in that normal client. Client-credentials authentication represents software, not a signed-in Teams user, and does not substitute for that user session.

The four Azure app-registration fields in [the ACS setup guide](../teams-app-registration-setup.md) apply only if using the separate ACS SDK transport. They are not prerequisites for this successful browser-client test. No new Graph calling/calendar/mail permissions should be requested to reproduce it.

Microsoft sources: [Teams for Web browser/OS support](https://learn.microsoft.com/en-us/microsoftteams/teams-client-web), [guest meeting join and admission](https://support.microsoft.com/en-us/teams/meetings/join-a-meeting-without-an-account-in-microsoft-teams), and [application versus user identity](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/users-groups-entra-apis/error-call-me-endpoint-microsoft-graph). Microsoft documents Linux browser support; its VDI/server-automation caveat remains relevant to productization.

## Boundaries and next implementation

- This test used a fixed offline diagnostic phrase, not a Muse-authored response or Rally's final voice.
- The normal client is not yet connected to Rally's existing Muse transcription/moderation loop. No new transcription or moderation was performed in Teams.
- The deployed Site's Invite Rally controls still invoke the existing ACS runner. The proven normal-client runner needs an explicit transport adapter and the existing protected queue/control contract before those controls can use it.
- Next: feed the measured PCM input to the existing Muse path after explicit meeting consent; render approved moderator speech to the virtual microphone; verify echo exclusion, cooldown, cancel/Stop, host override, departure and failure handling in a bounded live test.
- Normal-client login expiry, tenant guest policy, browser UI changes, meeting rejoin and concurrent meetings remain unverified. Retain the ACS experiment as an alternative until the normal-client path is integrated and reliable.

No Muse calls occurred. The previous global cost total and remaining credit balance were not re-reconciled or claimed as current.
