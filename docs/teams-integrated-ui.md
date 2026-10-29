# Teams invite links in the integrated app

The Meetings page now offers two explicit paths:

- **Set up browser-tab capture:** join Zoom, WhatsApp, Meet or Teams yourself, then select the call tab and Share tab audio in Rally. The new meeting opens with Meeting browser tab selected. Rally receives audio through the existing Node/LiveKit workflow; no meeting link is needed.
- **Invite Rally to Teams using a meeting link:** paste a work/school `teams.microsoft.com` invite, confirm consent, optionally enable Muse transcription, then choose Invite Rally to Teams. Admit **Rally audio test** from the lobby. Use Leave Teams meeting to stop early. The existing runner enforces three minutes including preparation/lobby time.

The Teams link flow is a bounded transcription test, not live moderation or speech into the call. It uses the existing protected Sites queue and normal Teams guest browser runner. No ACS credential is needed. Zoom/WhatsApp link-based participant joining remains unavailable. Meeting-tab capture remains their implemented path.

## Ownership and lifecycle

The Node API authenticates the app account and maps a local connection ID to the existing queue job. Only that owner can see its transcript, request departure or import its text. Other accounts see only runner availability/busy status. Browser responses contain neither the remote service credential nor the meeting URL. The runner is shared with the older Site, so only one connection test runs at a time.

Status polling carries lobby/connected/leaving/left/failed states and live text. A request whose outcome is unknown remains reserved: the API blocks blind duplicate invitations and requires operator reconciliation. Check the Teams roster before retrying. Do not remove an uncertain reservation until the corresponding remote status/departure has been verified. No automatic rejoin is attempted.

Closing the page or signing out does not stop the server participant. Use **Leave Teams meeting**; the absolute three-minute runner deadline also applies. Check departure in the Teams roster, especially after a failure. A stopped/failed finalized transcript can be saved to the owner's Node meeting history. The import is idempotent and retains unknown speaker identities/timing, failure status and the fact that no moderation was run. Partial captions and call links are excluded; importing makes no model request and does not fabricate a report. Individual speech timing is unavailable, and test job timestamps include lobby time.

The original queue retains its transcript independently of the Node history copy. Deleting a Node meeting removes that saved meeting/turns; it does not erase the upstream queue record. Review the existing shared-workspace data policy before using sensitive meeting content.

## Configuration and costs

Server-only variables: `RALLY_TEAMS_SITE_URL` and `RALLY_SITES_SERVICE_TOKEN`. They use the existing HTTPS-protected queue. Keys stay in the runtime secret file, never the frontend. The deployed app uses its existing private URL and app accounts; the old Site's access policy and runner protocol are unchanged.

Teams transcription continues to be reserved/reconciled in the existing queue's ledger and uses its budget gates. The UI discloses that this is separate from Node API usage. Full three-minute transcription is estimated at $0.009 using the existing $0.18/audio-hour configuration; actual sent/processed duration determines the recorded estimate. No live call or billed provider request was made to implement or verify this change.

## Verification

27 backend tests and four frontend state tests pass. New HTTP tests verify authentication, other-owner denial, link/consent validation before forwarding, unknown-result/concurrent-join protection, finalized-only import, missing timing, deletion/idempotence and zero model requests. Browser integration exercises the actual UI/API with an injected Teams queue: invalid links, lobby, Leave and saved transcript. It retains the existing real local LiveKit checks for the separate browser-capture path. [Browser result](research/frontend-browser-check.json).

Deployment validation checks the actual runner status and rendered invite panel without submitting a meeting invite. A consenting real Teams call remains the user's next test. Runtime services remain at the existing private HTTPS address.

## Deployed checkpoint

Application release `35ad395` is live at [the existing private Rally URL](https://rally.tail703f9e.ts.net:8445). Refresh the browser and return to Meetings, then expand **Invite Rally to Teams using a meeting link**. The server-side bridge is configured; live runner and Muse transcription readiness are both online. The actual deployed browser check verified the rendered link field, authenticated/owned status, mobile layout and tab-mode preset without submitting an invite or generating model usage. [Measurement](research/teams-integrated-ui-check.json). The pre-update database was backed up and existing accounts/history were preserved.
