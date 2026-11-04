# Third-party components and model provenance

Rally's original application code is licensed under the adjacent MIT LICENSE. Third-party components, supplied artwork and model terms remain separately governed; the application license does not grant rights to those materials. Preserve upstream license files when distributing their work. Locked dependency metadata and model provenance are separate from the application license.

| Component | Use | Recorded license/provenance |
| --- | --- | --- |
| Meta Muse Voice Transcribe and Muse Spark 1.3 | Hosted ASR, planning, continuous guidance, complete analysis | Meta Model API services; account/provider terms apply. No model weights are included. |
| Meta `facebook/seamless-m4t-v2-large` | Production streamed speech at configured AWS endpoint | Meta model; [publisher model weights CC BY-NC 4.0](https://huggingface.co/facebook/seamless-m4t-v2-large). Exact remote revision is not supplied. AWS hosting is infrastructure, not model authorship. |
| Meta `facebook/mms-tts-eng` | Local optional speech and video narration | Revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`, weights CC BY-NC 4.0; see [provisioning and provenance](experiments/meta-mms/README.md). Weights/caches are excluded from source export. |
| Living Silk | Supplied visual artwork/runtime, with Rally integration | Original source/archive attribution retained under packages/living-silk. Artwork's separate redistribution permission/license still needs an explicit owner-provided record. Three.js licensing does not license the supplied artwork. |
| Three.js 0.180.0 | Visual rendering | MIT; full bundled notice retained in [THIRD_PARTY_NOTICES.txt](packages/living-silk/THIRD_PARTY_NOTICES.txt). |
| LiveKit client 2.23.0, server SDK 2.19.2, rtc-node 1.2.1 | Self-hosted media/signaling and server transport | Apache-2.0, from installed locked package metadata. Preserve each distribution's license/notice. |
| Express 5.3.0, ws 8.22.0, Zod 4.6.7, OTPAuth 9.5.2, qrcode 1.5.4 | API, protocols, validation and local MFA enrollment | MIT, from installed locked package metadata. |
| Chromium/Playwright, Node, FFmpeg, esbuild, TypeScript and Python packages | Development, runtime, recording and editing tools | Separate upstream licenses apply; these binaries/environments are not included in the tracked-source archive. Retain distribution-specific notices if packaging them later. |

This is a direct-component inventory, not a complete transitive legal audit. Historical source under apps/rally and experiments retains its own dependency records. Application originality is described in [the submission draft](docs/submission-package.md); current model contracts are in [model interfaces](docs/model-interfaces.md). The [owner's remaining license/access decisions](docs/source-release-readiness.md) remain explicit. Final submission is on hold.

## Pronunciation reference

The local English reference includes the CMU Pronouncing Dictionary, copyright Carnegie Mellon University, under its BSD-style two-condition redistribution license. Full notice: [CMUDICT-LICENSE](packages/rally-speech/vendor/CMUDICT-LICENSE). [Pinned source and SHA-256](packages/rally-speech/vendor/cmudict-manifest.json). This is a reference dataset, not a speech-generation model or an external service. Its entries can be ambiguous or incorrect for brands; Rally retains explicit brand corrections and unknown-word handling.

## Experimental Meta phone synthesis

The opt-in `facebook/fastspeech2-en-ljspeech` checkpoint and bundled HiFi-GAN vocoder are pinned in the [model manifest](experiments/meta-fastspeech2/model-manifest.json). Selected upstream fairseq definitions are copied without changes and verified against their [source manifest](experiments/meta-fastspeech2/vendor/manifest.json). Preserve the full [MIT license](experiments/meta-fastspeech2/vendor/LICENSE). Meta's upstream fairseq README expressly applies that license to pretrained models; this license basis differs from MMS English's CC BY-NC 4.0. Weights are provisioned outside Git/source exports. The existing licensed CMU dictionary supplies stressed phones; no third-party neural G2P or TTS checkpoint is used. [Research, provenance and limitations](docs/research/meta-phoneme-backend-feasibility-2026-11-02.md).

## Prerecorded synthetic demo voices

The public sample ships generated Meta MMS English, Meta FastSpeech2/HiFi-GAN and hosted Seamless speech clips, not real participant recordings or model weights. [Asset attribution, model/revision mapping and limits](demo/demo-audio/README.md), [text/duration/hash manifest](demo/demo-audio/manifest.json). Model-specific notices above remain applicable; the sample does not assert additional commercial rights. Alex and Sam share one MMS voice; Priya uses FastSpeech2; Rally uses the existing Seamless default.
