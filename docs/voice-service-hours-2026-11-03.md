# Voice unavailable outside service hours — November 3, 2026

The user asked whether failing voice was caused by the AWS server being unavailable. Two recent production `seamless-aws` requests failed with zero audio bytes and no first-byte timing. The prior recorded request on November 2 at 18:56 UTC completed normally.

One authenticated synthetic-text POST to the configured endpoint returned HTTP503 in 364 ms with the JSON error: “Speech service operates daily 7:00–19:00 America/New_York”. The AWS endpoint is reachable and explicitly denies speech outside its service hours. This does not prove the underlying instance's power state. The Rally token and paid-processing configuration are present; this failure is distinct from Muse's earlier accounting guard.

[Sanitized response and request ID](research/voice-service-hours-2026-11-03.json). No audio was returned, no provider request was automatically retried, and no new Muse call occurred. AWS infrastructure cost is unknown. The active meeting and API services were preserved; no deployment or voice-model switch was performed.

For tonight, the configured voice service needs its availability extended by its operator, or Rally needs an explicitly selected local Meta voice for the common live speech path. This environment has no AWS management tool/CLI configured for changing that service's schedule or instance state. The experimental local FastSpeech2 adapter exists but has mixed listener feedback and is not the production voice. Local MMS is available through its existing offline/browser voice interface; full shared live transport selection would need appropriate integration rather than a silent fallback.

The current adapter maps upstream errors to a generic provider failure, obscuring the operating-hours explanation in the UI. Preserving a safe upstream error classification is a useful follow-up. The speech status endpoint describes configuration readiness, not current upstream availability.
