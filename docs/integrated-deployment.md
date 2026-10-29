# Integrated Rally deployment

**Teams UI update:** Application release `35ad395` now includes [the owned Teams invite-link bridge](teams-integrated-ui.md) at this same URL. Runtime configuration includes the existing server-only Sites service credential. Refresh and return to Meetings to see the new connection choices. Existing app accounts/data are preserved. The deployment details below describe the initial integration release where they identify `64fed29`.

Deployed October 29, 2026 from application commit `64fed291b404f1c3a220bc92f76e48bc59c3b153` on the existing Rally Ubuntu host. This runs the Node frontend, Express/SQLite API and self-hosted LiveKit together.

**Open [Rally](https://rally.tail703f9e.ts.net:8445) with Tailscale connected.** Create an app account or sign in to an account created in this deployment. App accounts are separate from Sites/Omnigent sign-in and the backend development database. No demo password is published or required.

## First test

1. Open the URL on a Tailscale-connected laptop in Chrome or Edge. Create an account with a username of 3–40 lowercase letters/digits/underscore/hyphen and a password of at least ten characters.
2. Create a short meeting with an agenda, duration and participant names. **Prepare with Muse** makes a real model request. Review/edit the generated plan.
3. Inform participants and confirm consent. Select Room microphone, or Meeting browser tab with optional host microphone. For a call tab, enable Share tab audio and use headphones.
4. Start the meeting, speak a known sentence and check finalized text. Speaker labels are anonymous/session-scoped until corrected; roster entry does not identify voices automatically.
5. Use Ask Rally for a deliberate guidance request, and exercise mute, pause/resume and dismiss. Guidance is visible text in this release; generated moderator speech has not yet been integrated into this backend.
6. End the meeting. Recording stops, final words drain, and the full report processes in the background. Reported agreements are model interpretations. Unknown scores/owners remain unknown. Check source links, correction notes, export and saved history. Failed analysis offers an explicit paid retry.

Muse processing is enabled for the user's test with the backend's existing conservative gates: $2 estimated per meeting and $5 cumulative for this deployment database. These are application gates, not provider Billing limits. There are no new connector subscriptions. Unknown costs block further processing. No final hackathon submission was performed.

## Runtime and access

| Component | Endpoint / storage |
| --- | --- |
| Private frontend/API | `https://rally.tail703f9e.ts.net:8445` |
| Private LiveKit signaling | `wss://rally.tail703f9e.ts.net:8446` |
| API process | Loopback `127.0.0.1:3301` |
| Frontend/API proxy | Loopback `127.0.0.1:6772` |
| Media signaling proxy | Loopback `127.0.0.1:6773` |
| LiveKit signaling | Loopback and Tailscale address, port 17890 |
| WebRTC | Tailscale-advertised IP, TCP 17891 / UDP 17892; firewall allows these only through tailscale0 |
| Release root | `/srv/hackathon/rally-deployed/releases/64fed29` |
| Active release symlink | `/srv/hackathon/rally-deployed/current` |
| Persistent database | `/srv/hackathon/rally-deployed/state/rally.sqlite` |
| Runtime secrets | `/srv/hackathon/rally-deployed/config/api.env` and `livekit.yaml`, mode 0600, excluded from Git |

Tailscale Serve supplies trusted HTTPS. App cookies are Secure, HttpOnly and scoped to `/api`. API origin validation uses the exact frontend origin. LiveKit uses a newly generated key/secret, rather than development placeholders; room credentials are short-lived. Node and Caddy run as `hack` under system systemd units, with filesystem writes scoped to persistent state. Media advertises the private Tailscale address rather than the public server address. Existing SSH and prior private service URLs were preserved. No Funnel/public site was enabled.

Server resolution for the private hostname is explicitly mapped to its Tailscale address because this host does not accept Tailscale DNS configuration. Clients use their normal Tailscale DNS. This release requires Tailscale on the testing device; it is not a public judge-access deployment.

## Verification

The deployed HTTPS frontend and compiled bundle load. A temporary account completed signup, secure-cookie validation, reload and logout; empty history/usage were checked. The mobile layout did not overflow. A real browser connected to the deployed WSS endpoint, published a synthetic tone and delivered 35,200 PCM bytes to a Node media subscriber with detected signal energy. Reliable data passed in both directions. Test rooms/accounts/sessions were removed. [Measurement](research/integrated-deployment-check.json).

These checks ran from the server through the actual HTTPS endpoints. They do not establish a remote phone/work-network connection, physical microphone behavior, real multi-speaker quality or human meeting success. They made zero Meta model calls. Existing backend/provider experiments remain separate evidence; the deployment check did not repeat them or claim new ASR/report accuracy.

Prior verification remains 25 backend tests, four frontend state tests, frontend build/typecheck and the isolated full HTTP/LiveKit browser workflow. The deployed source is exactly the tested integration commit. Generated speech, remote platform participant joining and automatic platform display-name attribution remain pending.

## Operations and rollback

Units are enabled for reboot:

```bash
sudo systemctl status rally-integrated-api rally-integrated-media rally-integrated-web
sudo journalctl -u rally-integrated-api -n 50
sudo systemctl restart rally-integrated-api
```

Restarting the API interrupts active capture/report work. Wait until no user meeting or report is active before an update. Persistent state and secrets remain outside releases. Build/test a new immutable release, install dependencies from physical package directories, update `current`, then restart the API/proxy. Do not run npm with a symlinked `--prefix`: npm 11 treated this as an inconsistent lock tree during initial preparation; installing from the physical release directories succeeded without lock changes.

To stop only this deployment:

```bash
sudo tailscale serve --https=8445 off
sudo tailscale serve --https=8446 off
sudo systemctl disable --now rally-integrated-api rally-integrated-web rally-integrated-media
```

Keep the database for recovery; do not delete prior user data. The previous restricted Sites app remains available at its original URL and is unaffected. Deployment service/proxy files and secret-free examples live in `ops/integrated/`. LiveKit's [deployment guide](https://docs.livekit.io/transport/self-hosting/deployment/) and [configuration reference](https://github.com/livekit/livekit/blob/master/config-sample.yaml) informed TLS, private advertised addresses and media-port configuration.

Deployment validation cost: **$0**. Prior cumulative tracked estimate remains **$0.47338150**, with unknown recorded charges zero at the preceding checkpoint. Actual Billing/grant balance is unverified. Subsequent user testing is recorded in this deployment's usage database and should be reconciled with the central ledger.
