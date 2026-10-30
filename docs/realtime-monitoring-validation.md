# Continuous monitoring validation

Implementation worktree: `/srv/hackathon/rally-realtime-monitor`, branch `rally-realtime-monitor`, baseline `698fe63`. See [accepted specification](realtime-monitoring-plan.md), [audio notes](realtime-audio-notes.md) and [UI notes](realtime-ui-notes.md).

## Model evidence

Six real Spark 1.3 minimal requests used the live JSON schema and a 1,024-token output cap. Four [short-context cases](research/realtime-model-benchmark.json) tested useful exploration, deadline pressure, on-topic speech and unrelated drift. Two [follow-up cases](research/realtime-model-edge-benchmark.json) tested agenda reordering and a bounded larger context. All returned valid output within eight seconds; observed range 1.791–6.257 seconds. The paired exploration input remained silent with more time and prompted a redirect under deadline pressure. This is a small purpose-written test set, not a production percentile or real-audio accuracy guarantee. Diagnostic context fields continued evolving during implementation; timestamps identify the measured checkpoints.

Total cost $0.02370700, unknown charges zero. Development-ledger cumulative $0.49708850; conditional remainder $149.50291150 against an unverified $150 grant. User-operated meeting charges are separately recorded and not reconciled into that ledger. [Cost record](research/muse-cost-ledger.md).

## Media and browser evidence

A real isolated PulseAudio output monitor measured approximately 1,020 ms for a one-second synthetic tone. [Sanitized result](research/realtime-local-playout-check.json). This validates local output progress only, not remote Teams audibility or echo rejection.

The new browser display test covers emotional state, observation/freshness, check history, extension presentation acknowledgment, disputes and reconfirmation, read-along stopping, reduced motion and reconnect. The existing actual LiveKit playback/Stop workflow also passed. Providers in browser fixtures are synthetic.

## Independent review

Standards and Spec were reviewed separately by fresh-context Astra agents. Standards found duplicated, divergent evidence compatibility: unchanged partial-to-final promotion was rejected, while evidence absent from the bounded model input was accepted. A shared validator corrected both; the reviewer reproduced successful finalization acceptance and rejection of unsupplied evidence, with no remaining standards finding in that follow-up.

Spec review reproduced older accepted checks overwriting newer decisions, elapsed time reclaimed by parking, and finalized partial resurrection after controls. Those reproductions pass after correction. Presentation/extension lifecycle findings were corrected and independently verified, including the final disputed-extension recovery guard. Final Spec follow-up reports no remaining actionable findings. Standards: one finding resolved; Spec: all reported findings resolved.

## Live rehearsal boundary

No Teams call was joined by these implementation checks. Receiving participants while Rally speaks is implemented behind `RALLY_TEAMS_DUPLEX_ENABLED`; it remains disabled by default pending a consented remote-echo/overlap trial. Ordinary realtime checks use `RALLY_REALTIME_ENABLED`. Browser speech retains echo shielding. No transcript or animation should be described as sample-accurate remote playback or reliable simultaneous-speaker separation.

## Final local validation

96 backend tests and 13 frontend tests pass. Both TypeScript checks and frontend production build pass. The full browser/Express/SQLite/LiveKit regression passes, as do the new display/control browser test and existing actual streamed audio/Stop workflow. The report allowlist preserves the existing empty reportNotes contract; full regression caught and verified that compatibility correction. Tests using model and meeting fixtures do not establish real Teams duplex accuracy.
