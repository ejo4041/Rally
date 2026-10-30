# WhatsApp guest-call preparation

Prepared October 30, 2026 in `experiments/whatsapp-guest/`. The user authorized trying WhatsApp browser guests. Meta's [guest-calling announcement](https://about.fb.com/news/2026/10/introducing-whatsapp-guest-calling/) documents browser name entry and host admission, but the actual guest page and participant audio still require a host-created invite and an admission window.

The prototype now has direct-call URL validation, an ephemeral browser, isolated incoming/outgoing audio devices, bounded normal cleanup and a link-on-stdin inspection harness. It does not yet press Join or claim a working WhatsApp participant. No link was invented or reused, no personal account was signed in, and the deployed app/Teams runner were not changed.

The local audio test passed: a synthetic 440 Hz signal reached the guest browser microphone; its independent 880 Hz output reached the incoming monitor; stopping output reduced microphone RMS to zero. This is actual Chromium/PulseAudio routing evidence, not a WhatsApp call. [Measurement](research/whatsapp-guest-local-audio-check.json). The URL validation test also passes. No model calls, external messages or connector charges were incurred.

Next required input: a fresh WhatsApp call link from a consenting host who can admit Rally. Initial live verification will inspect the actual guest controls, then establish bounded join/admit/audio/leave before enabling an application invitation path. [Operator commands and limits](../experiments/whatsapp-guest/README.md) · [Platform research](research/meta-call-integration-options-2026-10-30.md).
