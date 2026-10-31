# Long finalized speaking turns

A finalized source turn larger than the live context's 8,000-character budget previously produced an empty final projection and a skipped assessment. A continuous long speaker could therefore stop receiving live guidance after finalization despite a complete saved transcript.

The live projection now includes a recent, explicitly labeled window of an oversized final. Normal turns remain complete. The total final-text budget stays at 8,000 characters and up to 20 source turns; newer complete turns retain priority. If at least 1,000 characters remain, the immediately preceding oversized source can contribute a window. The canonical transcript and full-report projection are unchanged.

`textWindow` carries `start`, exclusive `end` and `totalCharacters` in JavaScript UTF-16 coordinates. `prefixLength` retains the cumulative source coordinate for addressed-question identity. Surrogate pairs are never split at the window start. The model instructions identify omitted context and restrict claims to supplied spans; original source timestamps are not exact excerpt boundaries.

Evidence remains tied to the original source ID/revision. Proofs hash the supplied window with its actual source endpoint, so they validate against the complete canonical turn. A revision invalidates dependent guidance, concerns and remembered focus. Partial-to-final promotion keeps the same addressed-question key, preventing a replay solely because the projection grew. Missing earlier conditions are not reconstructed or treated as absent; full analysis still receives canonical text.

Validation includes the original failing reproduction, bounded windows above 8,000 characters, revision invalidation, source-coordinate proofs, newer-turn priority, partial/final question identity and Unicode boundaries. Real-provider endurance and any live Teams acceptance are documented separately; deterministic checks do not establish human-meeting accuracy.
