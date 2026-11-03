# Optional Teams join welcome — 2026-11-03

Owner requested a spoken welcome/agenda when Rally joins, then clarified: optional checkbox on the Teams invitation screen, OFF by default. Branch `feature/optional-join-greeting`; existing developer worktrees remain untouched.

## Behavior

“Play a welcome and read the agenda when Rally joins” appears beneath the Teams invitation field. It is unchecked on each loaded meeting; recording consent and valid-link gates remain independent. The server treats missing/false as off and validates an explicit boolean. Real browser microphone/tab capture does not get an automatic welcome from this change.

When enabled for a meeting’s first successful Teams start, the server waits until the connector and engine start have completed and the call is marked connected. It then offers one deterministic welcome through the existing approved speech path: “Hi team, Rally here. Let’s get this meeting started. Here is the agenda: …” Prepared topic titles are read in order, excluding parked topics. Very long agendas are abridged with an explicit “full agenda is on screen” ending; bounded text stays within speech limits. No Muse reasoning call is needed to compose it.

The attempt marker is persisted before offering audio. Refresh/status polling, retries, restart/reconnect and failed speech cannot repeat the welcome. Pause/mute wins. A welcome error is nonfatal: the meeting remains connected and the saved response/speech failure is visible. Existing cancellation, playback shielding and AWS accounting apply. Default-off meetings make no additional speech request.

The credential-free demo uses one new pre-generated Seamless welcome clip for its fixed sample agenda. Its checkbox is also off by default. If the user edits the demo topic titles, the fixed clip is disabled with an explanation rather than reading a mismatched agenda or invoking a live model. Existing23voice clips are preserved;24voice clips now ship. Demo runtime still makes no model/ASR calls.

## Validation

Core helper/engine/Teams tests cover topic order, parked/long agendas, disabled/muted/paused/stale/disconnected states, persist-before-dispatch, no repeat and nonfatal speech failure. Real HTTP/auth/media integration with a synthetic connector/TTS proves omitted/off causes no speech and opt-in sends exactly one welcome after connected; other-owner access remains404. Frontend setup regression proves unchecked default and false/true payloads. Demo browser tests verify actual prerecorded welcome playback before participant voices, and existing pause/dismiss/end/fallback controls.

Full master backend suite initially163passed, plus2new HTTP tests passed separately; both typechecks and26frontend units passed. Final staged-baseline tests/deployment results are recorded in handoff. No real Teams call was joined during these tests; physical recipient audibility remains a user rehearsal check.

## Costs / scope

One additional authorized existing AWS speech request generated the8.52second fixed demo welcome; HTTP200, provider/infrastructure costunknown. No new Muse/Meta Model API call or local model generation. Runtime actual Teams speech incurs the normal provider usage only when opted in. Existing demo assets’ bytes were preserved. Production API deployment must retain the current backend baseline and apply only engine/contracts/Teams hook and connect-schema changes; unpromoted phoneme backend code on main must not be deployed incidentally. Existing UI styles and protected signup/MFA remain.
