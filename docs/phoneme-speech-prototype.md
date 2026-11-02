# Direct phoneme speech prototype — November 2, 2026

Rally now has an opt-in speech adapter using Meta's released FastSpeech2 English acoustic checkpoint and the HiFi-GAN vocoder distributed with it. The shared frontend converts written words into stressed ARPABET phones using the pinned CMU dictionary and explicit pronunciation overrides. It passes phones to a phone-trained model, preserving the approved original wording in the UI, transcripts and evidence.

The implementation is working locally. Production has not switched voices. Better phone control is established; better naturalness is **not yet established**. Listener assessment remains necessary, particularly for Meta, agenda and evidence. Different voices/models mean a preference comparison cannot isolate the causal effect of the frontend alone.

## Research and architecture

[Primary-source research and provenance](research/meta-phoneme-backend-feasibility-2026-11-02.md) records why the existing pinned MMS English checkpoint cannot accept these phones directly. MMS has character embeddings and `phonemize:false`; changing a tokenizer flag cannot supply the missing phone-trained embeddings. Hosted Seamless has no verified direct-phone input contract.

```text
Approved canonical text
  → shared deterministic dictionary / explicit stressed-phone override
  → validated sentence phone sequences
  → Meta FastSpeech2 acoustic model
  → Meta-distributed HiFi-GAN vocoder
  → mono PCM16 at 16 kHz
  → existing speech lifecycle and meeting transport
```

Acoustic revision: `facebook/fastspeech2-en-ljspeech@a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf`. Full weights are outside Git. [Six-file manifest](../experiments/meta-fastspeech2/model-manifest.json), [backend implementation and reproducibility](../experiments/meta-fastspeech2/README.md), [upstream MIT notice](../experiments/meta-fastspeech2/vendor/LICENSE). The experiment executes pinned upstream model definitions with narrow runtime compatibility bindings and strict weight loading; it does not install legacy fairseq or use a third-party neural G2P/TTS model.

## Configuration

Provision the model explicitly with `python3 experiments/meta-fastspeech2/download.py --model-directory /srv/hackathon/models/meta-fastspeech2`. The existing local Torch/SciPy environment was used without package installation. In an isolated API process, select:

```dotenv
RALLY_SPEECH_ADAPTER=fastspeech2-local
RALLY_EXPERIMENTAL_PHONEMES=1
RALLY_PHONEME_PYTHON=/srv/hackathon/tools/mms-venv/bin/python
RALLY_PHONEME_MODEL_DIR=/srv/hackathon/models/meta-fastspeech2
RALLY_PHONE_OVERRIDES={"Meta":"M EH1 T AH0","agenda":"AH0 JH EH1 N D AH0","evidence":"EH1 V AH0 D AH0 N S"}
```

Overrides are optional, case-sensitive word keys; Meta, agenda and evidence already have dictionary/brand references. Overrides select pronunciation globally for that exact spelling and must not resolve a context-dependent word incorrectly elsewhere. This adapter uses `SpeechEngine` for offline WAV jobs and `TextToSpeech` for the common live speech lifecycle. Existing `RALLY_PAID_ENABLED` still gates the application's common live output path because it also enables the meeting's Muse providers; local TTS itself makes no provider API call. No speech API token is needed for the local model. Existing host controls, owner isolation and usage allowances remain in force.

## Explicit boundaries

- English, one released female speaker. This is a separate configurable Meta voice; MMS and Seamless keep their own input contracts.
- Unknown names, unresolved homographs, unreviewed multiple pronunciations, uppercase initialisms, numeric text, URLs and unsupported symbols require an explicit reviewed pronunciation or normalization. No partial utterance or silent spelling fallback is generated. The `reviews` smoke initially failed this ambiguity policy; using a supported smoke phrase proves transport, not unrestricted language coverage.
- A small documented list accepts dictionary alternatives differing in reduction/dialect, choosing the first variant. This is not contextual language understanding. Tests cover refusals such as read, contract, Polish, US, IT and dotted addresses.
- At most 650 text characters, 300 phones, 32 sentences and 30 seconds of output. Long approved text needs separate meaning-preserving segmentation/normalization work.
- Sentence joins insert 300 ms silence and short boundary fades. Native synthesis buffers the whole waveform; yielding PCM transport chunks afterward does **not** make model inference streaming.
- One synthesis per worker; abort kills that worker and a later explicit request can start a new one. Expected pronunciation refusals return 422, busy 429, timeout 504 and unexpected worker failure 502 in the streaming API.
- Local API charge is zero. Shared-host infrastructure cost is unknown, recorded separately; this is not a claim of zero total operating cost.

## Validation and next decision

The authoritative authored corpus contains 20 development and 20 validation utterances, frozen in [phoneme-corpus.json](../scripts/fixtures/phoneme-corpus.json), SHA-256 `796728d62709da7abbb0e3ddd3d14d78c93d15b77149f996da80c7021156f804`. A preliminary 80-clip generation run succeeded before the final sentence interface; retain it as preliminary evidence. A final run and listening files are recorded in the linked measured results below when completed.

The actual local HTTP smoke uses Express/SQLite authentication fixtures, real Meta inference, injected ASR/reasoning/media, verifies approved WAV, other-owner denial, unchanged canonical text and audio revocation after pause. The browser and Teams common live speech smokes generate actual PCM and preserve model/revision/billing through injected transports. These are **not real Teams meetings, remote audibility or production MFA tests**. The two cold live smoke paths each took about three seconds to the first recorded transport byte; playback/device/network delay was not measured.

Before production selection: listen blind to same-text, matched-loudness MMS/candidate pairs; label pronunciation separately from naturalness; review coverage/refusal behavior for real moderator text; measure warmed first-audio and real recipient audibility in a consented call. A completed waveform or low ASR WER cannot establish a naturalness score. No final entry action, external video upload or production voice switch occurs in this work.
