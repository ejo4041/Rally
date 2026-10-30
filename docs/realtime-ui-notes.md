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
