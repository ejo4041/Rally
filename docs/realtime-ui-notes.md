# Continuous monitoring UI implementation

The existing Rally card now has a textual/color moderation state, health, source-snapshot age, concise observation, approximate spoken-word read-along, expandable owner check history, agenda-revision reasons and exact-proposal extension confirmation controls. Color describes Rally's assessment, not detected participant emotion. No raw model reasoning is rendered.

`meeting.check` and authoritative snapshots use check sequence plus terminal-state ordering so late checking events cannot replace accepted results. Speech state similarly cannot regress a completed job to playing. Previous observations remain explicitly marked while a new check runs.

Browser read-along measures the attached media element's playback-clock advancement only while playing and connected. It pauses on known stalls/reconnection; Teams uses `playedMs` only with `progressSource=local-playout`. Without a measured clock, text remains static. Word pacing is approximately 150 words/minute, not model-provided word alignment. Reduced motion uses static text. Reconnected utterances never restart animation. Explicit Stop immediately freezes local animation and audio. Ordinary plan changes no longer automatically stop streamed speech.

Validation:

- 12 frontend tests pass, including check/speech ordering and read-along cancellation/restoration.
- Frontend TypeScript and production build pass.
- `tests/realtime-display-browser.mjs` passes actual DOM interactions for feeling/freshness, history, extension confirmation, approximate read-along, Stop, reduced motion and restored utterances. It uses synthetic normalized events and HTTP responses; no model or meeting calls.
- Existing `tests/streaming-browser.mjs` passes actual Express/SQLite/LiveKit playback and Stop using synthetic model/audio providers.

No paid model calls, remote meeting joins or deployment were performed by this UI work. Independent review, cross-component regression and live rehearsal remain the parent implementation task's responsibility.

## Review follow-up

Extension disputes now remain visible and require an explicit Reconfirm extension action; confirmed, rejected and superseded proposals show their state without active confirmation controls. Snapshot ordering cannot silently hide a dispute behind an old confirmed/pending version. Pending proposals acknowledge presentation through the owner API only once their element intersects the viewport in a visible document; creation is not treated as presentation.

The minimal card also shows a calculated schedule shortfall, distinguishes last transcript-update age from model snapshot age, and places the conservative six-checks-per-minute cost forecast inside expandable history. Forecast text explicitly includes the report reserve and excludes unknown AWS speech costs.

13 frontend tests pass. The browser display test additionally verifies dispute/reconfirmation, presentation acknowledgement, timing shortfall, source freshness and forecast wording. Typecheck/build pass after these additions; no paid calls.
