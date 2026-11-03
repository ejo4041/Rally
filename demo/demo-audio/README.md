# Prerecorded Meta voices for the simulated demo

These are generated clips of Rally’s authored fictional meeting script, not recordings of real participants. The browser plays static files; it does not send audio to ASR or invoke models. Simulated partial captions follow each clip’s playback fraction, not forced word alignment. Clips were generated once on2026-11-03 and given constant RMS gain toward−22dBFS with a−2dBFS peak ceiling; pitch and playback speed were not changed.

| Character | Voice source |
| --- | --- |
| Alex and Sam | Meta `facebook/mms-tts-eng`, revision `c71de0fe7204c83f1c10820a7d696d0b450048ba`; same underlying voice for both characters. |
| Priya | Meta `facebook/fastspeech2-en-ljspeech`, revision `a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf`, with its bundled HiFi-GAN vocoder. |
| Rally | Existing hosted `facebook/seamless-m4t-v2-large`, default voice. Exact remote checkpoint revision unavailable. |

`manifest.json` maps all24voice clips to their canonical text, model/revision, duration and SHA256. Silence.wav is a100ms generated silent WAV used to unlock browser playback after the user clicks Start. No personal voice was cloned.

Generated with `scripts/build-demo-audio.mjs`: existing pinned offline MMS/FastSpeech2 workers, reviewed script-specific ARPABET choices for the phone backend, and seven authorized existing-service AWS speech requests for Rally. Zero Muse calls. Local model API fees zero; hosted speech/infrastructure cost unknown. Runtime makes no speech/model requests; static hosting/bandwidth still has normal infrastructure costs.

Attribution/license sources: Meta MMS model card https://huggingface.co/facebook/mms-tts-eng (weights CC BY-NC4.0); FastSpeech2/fairseq and vocoder provenance in experiments/meta-fastspeech2/README.md and upstream MIT notice; Seamless provenance in docs/model-interfaces.md. See root THIRD_PARTY_NOTICES.md. These model-specific terms are separate from application licensing; this is a hackathon sample, not a declaration of commercial rights.

The additional greeting.wav is opt-in/off by default and reads the fixed prepared sample agenda. It precedes participants only when selected.
