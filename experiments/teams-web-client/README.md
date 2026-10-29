# Normal Teams web client on the Rally server

This is an isolated transport experiment using headed Chromium, Xvfb and private PulseAudio devices. It does not use the ACS Calling SDK or a custom Entra app registration. The existing `experiments/teams-audio` ACS runner and hosted Site controls remain separate.

**Deployment update:** The [existing Site's version 7 controls](../../docs/research/teams-transcription-deployment-result.md) now use this normal queue runner and optional live transcription. `rally-teams-web-runner.service` is manually active; the old ACS runner is stopped/disabled. No automatic startup was enabled for the new POC. Integrated live queue→Teams→Muse validation is pending the user's fresh invite/consent. Historical standalone test instructions below must not be used to reopen the stored meeting link without authorization.

Actual meeting results and limits: [test report](../../docs/research/teams-web-client-spike.md).

## Prerequisites

- Existing Node at `/srv/hackathon/tools/node/bin/node` and existing pinned Playwright 1.64.1 at `../teams-audio/node_modules/playwright`. No new npm dependencies were downloaded for this experiment. Any future npm download must use the established Nexus registry and preserve authentication.
- Existing Playwright Chromium at `/home/hack/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`.
- OS packages installed for this test: `pulseaudio`, `pulseaudio-utils`, `xvfb`, `xauth`, `libcups2t64`, `espeak-ng`, and their dependencies. No distribution upgrade or reboot was performed.
- Commands below run as `hack`, with `XDG_RUNTIME_DIR=/run/user/1000` and `LD_LIBRARY_PATH=/srv/hackathon/tools/browser-libs`.

## Start and prepare

Store a normal work/school Teams meeting URL in ignored `state/meeting.url` with permissions 0600 and parent directory 0700. Do not commit meeting passcodes, browser profiles, cookies, screenshots, or credentials.

The provided user unit is installed at `/home/hack/.config/systemd/user/rally-teams-web-client.service`. It is a manually started experiment, not enabled at boot. As `hack`:

```bash
systemctl --user start rally-teams-web-client.service
cd /srv/hackathon/repo/experiments/teams-web-client
/srv/hackathon/tools/node/bin/node control.mjs prepare
/srv/hackathon/tools/node/bin/node control.mjs inspect
```

`prepare` uses the normal Teams controls: it dismisses the initial missing-camera notice, enters `Rally audio test`, keeps video off, selects computer audio and enables the real virtual microphone. The session grants browser device permission; `--use-fake-ui-for-media-stream` only handles permission UI. It does not install fake audio devices or synthesize the microphone stream. PulseAudio supplies the microphone, and the separate local probe verifies its data path.

## Explicit live test

Use a designated test meeting with a consenting host present. Joining notifies participants. No automatic retry or calendar integration occurs.

```bash
/srv/hackathon/tools/node/bin/node control.mjs join
/srv/hackathon/tools/node/bin/node control.mjs rtc
/srv/hackathon/tools/node/bin/node control.mjs meter
/srv/hackathon/tools/node/bin/node control.mjs direct-meter 20000
/srv/hackathon/tools/node/bin/node control.mjs play
/srv/hackathon/tools/node/bin/node control.mjs leave
systemctl --user stop rally-teams-web-client.service
```

The join action starts a three-minute deadline, including lobby time. At that deadline the session attempts normal Leave and closes its browser regardless. `RuntimeMaxSec=7200` bounds an idle prepared browser. The browser debugging port 9226 binds only to 127.0.0.1. Xvfb has TCP disabled. PulseAudio uses a private Unix socket under `/run/user/1000/rally-teams-pulse/`.

`play` sends the local diagnostic WAV through the virtual microphone. Generate it with:

```bash
espeak-ng -w state/test-voice.wav 'Rally audio test. The server microphone is working.'
```

This is an offline diagnostic voice, not Rally's selected production voice or a Muse response. No model call occurs.

## Audio paths and local validation

- Teams microphone: `rally_teams_mic`, remapped from `rally_teams_out.monitor`.
- To speak: play rendered PCM/WAV to `rally_teams_out`.
- To listen: read `rally_teams_in.monitor`; the test reads PCM16, mono, 16 kHz. The decoded browser MediaStream is also available and was measured independently.
- Default browser speaker: `rally_teams_in`.
- Environment: ignored `state/audio-env.json`.

Before joining a real meeting, run `audio-probe.mjs` while the session is prepared. It uses synthetic 440 Hz/880 Hz signals to verify a real browser microphone, OS speaker capture, channel isolation and output stop while input continues. It does not join Teams or use Muse/ACS. Do not run the synthetic probe inside an admitted meeting: its signals would be audible to participants.

## Authentication and unfinished work

The successful test used guest admission from the meeting URL. No new app registration, Graph permissions, ACS subscription or client secret is required for that route. A tenant requiring sign-in instead needs an authorized Teams user and interactive sign-in/MFA; a client ID/secret is not a Teams user session. Do not bypass tenant policies or paste account secrets into chat.

This is a working transport spike, not integrated Rally moderation. The hosted Invite Rally control still invokes the original ACS runner. Next work is to adapt the authenticated Site queue to the normal-client runner, feed incoming PCM to the existing Muse pipeline only after explicit consent, play rendered moderator speech into the outgoing device, and verify echo/stop/override behavior. Browser UI changes, guest policy, login expiry, network recovery and multiple meetings remain limitations.
