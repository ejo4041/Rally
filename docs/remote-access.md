# Remote access and tonight's test preflight

Updated 2026-10-29 02:46 UTC / October 28 US Eastern.

## Current Teams checkpoint

Read [tonight's authoritative handoff](tonight-handoff-2026-10-28.md).
SSH access from Eric's home PC works on port 22. The existing hack tmux
session team remains idle and has not received a new prompt. Its chat predates
the first live test and pacing fix; the handoff is authoritative.

Read-only production preflight: normal Teams runner online, transcription ready,
no active job. User service normal runner active; browser and old ACS runner
inactive. No restart, meeting join or Muse call was initiated. Evidence:
[home resume check](research/teams-transcription-home-resume-check.json).
Tracked estimate remains $0.15263115, conditional $150 remainder $149.84736885,
unknown 0. Fresh meeting invite and explicit participant consent still needed.
Retain the three-minute absolute cap. Observe termination metrics and reconcile
usage after the test; do not reuse the old invite or retry automatically.

## Local computer access

In Eric's local metahackathon folder, Connect-Rally.ps1 attaches to hack's
existing team session over SSH; -ReadOnly observes it. This uses the project
private key on Eric's PC. No web console is needed. This chat can also inspect
the server and carry out explicitly requested work over SSH.

## Omnigent

User requested the Databricks-associated omnigent-ai/omnigent project for phone
control. Installed official packaged Omnigent 0.20.0 under hack with uv, without
the Databricks workspace extra/CLI (not needed for local Codex login). No npm
packages were downloaded. Existing Node 24 and Codex are used.

User unit omnigent.service is enabled and running, bound ONLY to 127.0.0.1:6767,
with built-in accounts authentication enabled. SQLite/artifacts live under
/home/hack/.omnigent. Verified /v1/info from the server and Eric's PC through
an SSH tunnel: version 0.20.0, accounts_enabled=true, needs_setup=true.

Eric created the first admin; needs_setup=false verified. An SSH tunnel was
started on Eric's PC; Open-Rally-Remote.ps1 can reopen one later.
Tailscale 1.104.4 installed and authenticated: rally, 100.91.20.8; Eric's Pixel
is also connected. Private Tailscale Serve is running at
https://rally.tail703f9e.ts.net:8443 , proxying 127.0.0.1:6767. HTTPS certificate
validation and /v1/info verified using curl --resolve on the droplet (server
retains accept-dns=false). Accounts enabled and needs_setup=false. Port 8443
avoids the existing wildcard SSH listener on 443. Public Funnel is not enabled.
Existing port 443 SSH listener remains unchanged. Phone sign-in still needs
Eric's device check; use Tailscale on the Pixel and the exact URL with :8443.

omnigent-host.service is enabled and running with local server target
http://127.0.0.1:6767; host status confirms online, no owned sessions. PATH
includes the current Codex and Node installations. No model task was submitted.
A phone connection and an Omnigent-to-Codex prompt have NOT been verified yet.
The existing native tmux conversation has NOT been imported or moved into
Omnigent. Do not claim new Omnigent sessions automatically control that old
conversation. Verify supported continuation/import behavior before handoff.
No agent task or model request was launched by installation.

Herdr stable 0.9.5 installed and --version verified on Eric's Windows laptop
using herdr.dev's official Windows installer. Open a new PowerShell and run
herdr. No Herdr server or agent session was launched; no droplet Herdr install
was performed. Herdr and Omnigent are separate tools, not automatic imports
of the existing tmux session.

Sources: https://omnigent.ai/quickstart/install ,
https://omnigent.ai/docs/interact/mobile ,
https://omnigent.ai/docs/collaborate/auth .
