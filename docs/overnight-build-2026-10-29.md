# Rally overnight build — October 29

This checkpoint follows the [initial offline history work](offline-progress-2026-10-29.md) and authorized GitHub publication. It records additional code, actual MMS generation and the submission requirements review. Live Teams testing was unavailable tonight. The deployed Site remains version 7; no runner/service was restarted or changed by this work.

## Completed

### Retrospective Teams review and host editing

Saved Teams records now support host-entered title/agenda/roster/desired outcome, per-turn speaker correction, evidence-linked proposal review using the existing Muse adapter, explicit host confirmation and dismissal. Review considers all eligible saved turns up to the POC's 200-turn bound, instead of silently using the live moderator's last 16 turns. At most five proposals are accepted per response. Existing rejected proposals stay rejected; model output cannot confirm itself. Speaker correction marks confirmed cited outcomes disputed so the host must review them again.

The UI requires review consent; opening/saving a record makes no model request. Context setup must be saved first. Full source fingerprinting reuses an unchanged review without a second paid call. Context changes mark it stale. Retrospective review is labeled separately from live moderation, never queues speech and does not reconnect the ended meeting.

A shared meeting lease excludes simultaneous review/edit/deletion and live meeting ownership. A durable unknown-cost reservation is inserted atomically before sending a review to Meta, with global/meeting budget checks. It is reconciled in place, with no automatic retries. Failed network/handshake or lost accounting remains visible and blocks further paid use. Deletion rechecks the lease inside its atomic batch and retains unresolved accounting without duplicating an existing unknown charge.

### Organizer-approved Meta speech foundation

The user supplied an organizer FAQ explicitly approving self-hosted Meta MMS and excluding third-party TTS models. [Full sourced audit](research/submission-requirements-meta-audit-2026-10-29.md). We downloaded the official English `facebook/mms-tts-eng` checkpoint at pinned revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`, stored outside source with SHA-256 manifest, and executed it locally on CPU using safetensors and no remote model code.

The [MMS adapter](../experiments/meta-mms/README.md) uses a persistent Python model process over stdio, not a product HTTP backend. It caps input/output and CPU threads, enforces one request at a time, kills generation on cancel/timeout, validates model identity and PCM, and emits mono 16 kHz WAV. Model downloads are explicit setup only; inference is offline. Source exports exclude weight directories and weight-file formats.

Four actual synthetic phrase generations succeeded. Cold load: 10.519 seconds. Warm redirect: 0.716 seconds synthesis for 2.992 seconds audio. [All measurements](research/mms-cpu-benchmark.json). These are generation timings, not audible-latency claims. No audio was played or Teams meeting joined. Hosted/Teams output, pronunciation, echo and cancellation through the audio route remain pending.

The new app code disables browser/OS speech diagnostics by default (`RALLY_DEVICE_VOICE_ENABLED` is opt-in for non-submission diagnostics). If explicitly enabled, it selects only actual local English voices and refuses a remote/default-voice fallback. Locality is not Meta model provenance, so diagnostics are not the event's voice path. Approved MMS is not yet connected to the hosted player; prompts stay visible in the new default configuration. Existing deployed version 7 predates this change and should not be used to claim the new default before republishing.

### Submission requirements

The audit identifies the official submission portal, deadline, track/Representative/contributor requirements, public-source/video/access checks and remaining validation tasks. [Submission draft and capture checklist](submission-package.md) turns these into concrete work. The signature demo remains a useful intervention → explicit commitment → host confirmation → transcript evidence loop. Additional Meta priorities are MMS first, then a bounded Wonder evidence audit, with WhatsApp follow-through gated on usable account/access and explicit send approval.

The supplied TTS FAQ does not establish a Teams/hosting/Codex ban. Public GitHub access and a source license remain unresolved; successful SSH publication is not proof of anonymous judge access. No visibility change, new account or source-license grant was made.

## Validation and evidence boundary

- 28 application/backend/accounting/lifecycle tests pass, including eight new saved-review scenarios and a complete Worker API test with Meta fetch mocked and external network disabled.
- Saved-review browser scenario passes: details, consent, review, proposal/confirmation, speaker correction/dispute, dismissal, unchanged-result reuse, error display, navigation consent reset, safe transcript rendering and mobile layout.
- Existing Teams UI and full browser walkthrough regressions pass; the final run additionally covers the new voice diagnostic policy.
- Four MMS adapter tests pass: input/WAV bounds, concurrency, cancel during startup/generation, restart, invalid model output and timeout.
- Four existing Teams adapter/audio-pacing tests remain passing; no pacing code was modified in this batch.
- Source exporter regression passes, including exclusion of browser state and model weights. Worker build and ESM validation pass.
- Real MMS CPU benchmark uses only explicitly authored synthetic text. All new Muse-review provider calls in tests were mocked. No live ASR or paid reasoning experiment was run.

Additional Muse inference spend: **$0**. Last reconciled project estimate remains **$0.15263115**, conditional $150 remainder **$149.84736885**, unknown entries **0** in the recorded ledger. Actual Billing/grant remains unverified. Local MMS inference incurs no provider inference charge; existing host infrastructure still has its ordinary cost.

## Next gates

Publish the verified app through the owning Sites account; warm/connect MMS to server-approved moderator output with stale-epoch and playback cancellation; validate virtual-microphone/echo behavior; run the fresh Teams pacing retry and a three-person demo rehearsal. Resolve public repo/license and judge access, then record the video and complete the actual submission form. Do not label these pending gates as completed because offline tests passed.
