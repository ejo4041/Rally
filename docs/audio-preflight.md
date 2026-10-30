# Free audio check in integrated Rally

Before starting a browser meeting, confirm participant consent and choose **Check audio · free**. Select the call tab with Share tab audio when using tab capture. Have a remote speaker talk, then speak into the host microphone. The two meters measure their sources separately before mixing. A signal establishes audio energy, not speaker identity or transcription quality.

The check stays local: no LiveKit connection, Muse request, recording or saved transcript is created. It stops after 15 seconds, on Stop check, when the dialog closes, on navigation/logout, or when sharing ends. Late permission grants are closed after cancellation. Start meeting acquires audio again and follows the existing paid-processing consent/budget path.

This uses the same source acquisition as the integrated live workflow. Backend/provider interfaces and the existing Teams runner are unchanged. It checks the browser used by the host; it does not inspect the server Teams guest or the pending WhatsApp guest.

Validation: frontend typecheck/build and four state tests pass. The full browser test uses real local HTTP/SQLite/LiveKit with injected model providers and synthetic audio. Both meters detect signals; manual and automatic stops close all tracks; missing consent opens no check; canceled picker grants close; the ASR session count stays unchanged during preflight. The subsequent complete meeting/report workflow also passes. No real model call was made. [Browser result](research/frontend-browser-check.json).

Next overnight priorities: connect approved Meta MMS speech to the Node backend with pause/dismiss/end cancellation and echo handling; verify shared-room attribution without equating voice labels with people; complete the WhatsApp guest admission/audio trial when a host supplies a fresh link; rehearse the three-person decision loop before recording. Actual human/device/platform validation remains necessary.
