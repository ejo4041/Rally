# Session continuation — Azure ACS and app registrations

Recovered 2026-10-28T19:06:04+00:00 from the existing `hack` Codex session in tmux `team:0.0` and the repository's current documentation. This chat continues with the recovered context and works on the same server through SSH; no second Codex agent was started or prompted, and the original session remains available.

## Subsequent live test

The user authorized testing a normal Teams client, supplied a meeting URL and admitted Rally. Guest joining, host-audible outgoing speech, and measured incoming audio on both browser/virtual-speaker paths succeeded. This route required no custom app registration or ACS resource. The bounded experiment left automatically. Full Muse moderation and hosted-control integration are still pending. See [the authoritative live test report](research/teams-web-client-spike.md). Earlier uncertainty below records the historical stopping point.

## Where the original discussion stopped

The user requested app registration if it meets Rally's needs. Entra client-secret authentication was implemented in the existing Linux/ACS runner, with local SDK/auth tests recorded in [setup and validation](teams-app-registration-setup.md). Those tests were not rerun during context recovery. The Teams preview remains a bounded three-minute transport test. Full Teams audio to Muse and rendered speech back into the call remain unverified.

## Fresh observations

- Existing project: `/srv/hackathon/repo` on the Ubuntu Droplet.
- The `hack` user's `rally-teams-runner.service` is active.
- None of the four app-registration settings is populated in the ignored server `.env.local`: `AZURE_COMMUNICATION_ENDPOINT`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`. The connection-string alternative is also absent. Only presence was inspected; no secret values were displayed.
- No Azure login, resource creation, role assignment, identity/token issuance, Teams join, model request, or paid experiment was performed in this continuation.

## User clarification now driving the discussion

The user understands app registration. They want to know why ACS is needed if Rally can simply participate, listen, transcribe, and speak back into a meeting. Do not respond with another generic explanation of application registration.

ACS is required by the particular Calling SDK transport currently installed. It is not required merely because Rally transcribes speech, nor by every possible Teams participant. A working normal Teams client plus proven input/output routing would provide an alternative transport. The browser microphone/playback implementation and local synthetic audio experiment do not prove that such a Teams connection already exists.

The immediate decision is whether to complete the installed ACS transport or evaluate a normal Teams client with virtual microphone/speaker routing. The latter is an unverified candidate, not an implemented replacement. Keep the existing participant priority and browser fallback from [the planning interview](planning-interview.md). Do not start another infrastructure stack merely to explain the distinction.

## Authoritative references and next step

Use [the corrected administrator explanation](teams-admin-brief.md) for the transport distinction, [setup instructions](teams-app-registration-setup.md) for the implemented credentials, and [fit/RBAC research](research/teams-app-registration-fit.md) for scoped resource permissions and their limits.

Rechecked Microsoft primary sources: [ACS authentication](https://learn.microsoft.com/en-us/azure/communication-services/concepts/authentication), [Teams interoperability](https://learn.microsoft.com/en-us/azure/communication-services/concepts/join-teams-meeting), and [service-principal prerequisites](https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/identity/service-principal?pivots=platform-azcli). The Identity SDK accepts Entra credentials; Calling uses a user access token. The ACS route needs an active subscription and ACS resource. Its BYOI participant is external and subject to meeting policy/lobby admission.

A question about existing Azure subscription versus app-registration-only access was presented and remains unanswered at this checkpoint. Answer the transport question first; subscription access matters if ACS remains the selected approach.

This continuation used no Muse calls; no new billing balance or global usage total was inferred.
