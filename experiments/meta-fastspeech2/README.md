# Meta FastSpeech2 CPU phone backend

Experimental offline JSONL worker using released Meta acoustic/vocoder weights and pinned upstream fairseq definitions. No production deployment. The shared text/CMU front end and JS adapter are owned separately; this worker consumes their phones directly and never imports `g2p_en`.

## Identity and provenance

| Component | Identity / revision |
| --- | --- |
| Acoustic model | `facebook/fastspeech2-en-ljspeech` / `a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf` |
| Vocoder | `hifigan.bin` bundled in the same Meta model snapshot; SHA-256 `d4f4f016c791fd9ca9859a9e25e7eb0a823fee2ea997c1e5ae8e1a9ea5f99b1f` |
| Upstream definitions | `facebookresearch/fairseq` / `3d262bb25690e4eb2e7d3c1309b1e9c406ca4b99` |
| Local model cache | `/srv/hackathon/models/meta-fastspeech2` |
| Native / output rate | 22050 Hz / 16000 Hz, mono PCM16 little endian |

[model-manifest.json](model-manifest.json) records all six artifact hashes and immutable URLs; [vendor/manifest.json](vendor/manifest.json) pins copied upstream source files and their hashes. Inference checks the cache manifest against the experiment's manifest and verifies every artifact before `torch.load`. Vendored source is verified before executing selected definitions. Neither inference nor tests download weights.

The six downloaded artifacts total **550,645,814 bytes**. Explicit provisioning is reproducible with standard-library Python:

```bash
python3 experiments/meta-fastspeech2/download.py --model-directory /srv/hackathon/models/meta-fastspeech2
```

No dependency installations were performed. Tested interpreter: `/srv/hackathon/tools/mms-venv/bin/python`, Python 3.12.3, Torch 2.15.0+cpu, NumPy 2.5.4, SciPy 1.18.1. That interpreter's existing packages are used read-only; no fairseq, Hydra, OmegaConf, torchaudio or G2P package was added to it.

## Probe and worker

Run from the repository root. Generated audio belongs under the ignored artifacts directory:

```bash
mkdir -p artifacts/feedback/phoneme-prototype
/srv/hackathon/tools/mms-venv/bin/python experiments/meta-fastspeech2/worker.py \
  --model-directory /srv/hackathon/models/meta-fastspeech2 \
  --phones-json '["HH","AH0","L","OW1","sp","DH","IH1","S","IH1","Z","AH0","T","EH1","S","T","R","AH1","N"]' \
  --output artifacts/feedback/phoneme-prototype/sample-hello.wav
```

Omit `--phones-json` and `--output` for a persistent worker. `--model-id` and `--model-revision` accept only the identity above. `--model-dir` is an alias for `--model-directory`. `--threads` defaults to 2.

Ready event:

```json
{"type":"ready","model":"facebook/fastspeech2-en-ljspeech","revision":"a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf","sampleRate":16000,"inputKind":"arpabet","loadMs":747}
```

Request example:

```json
{"id":"example-1","text":"Hello.","phones":["HH","AH0","L","OW1"],"inputKind":"arpabet"}
```

The response has `type:"audio"`, matching `id`, pinned `model`/`revision`, `sampleRate:16000`, `seconds`, `synthesisMs`, and `pcmBase64`. Extra diagnostic fields are `timings.acousticMs`, `timings.vocoderMs`, `melFrames`, `phoneCount`, `peak`, and `rms`. CLI `--output` writes a WAV and substitutes an `output` path for base64. Optional `sentences:[{text?,phones,pauseMs}]` supports 1–32 segments whose concatenated phones must exactly match the top-level phones, still capped at 300 total. Pauses must be integer 0 or 300 ms (booleans rejected). Segments are all validated before inference and synthesized separately with their own EOS. The worker inserts zero-filled silence and returns `phrases` with `sentenceIndex`, optional `text`, `startSeconds`, `endSeconds`, and `pauseMs`; end excludes the following pause. Output including pauses is capped at 30 seconds. Multiple segments get 5 ms edge fades; a single segment with zero pause preserves PCM bytes. Unsupported/mismatched segmentation fails explicitly.

Timing begins after request validation; model initialization is reported separately. The worker buffers the full waveform; it does not stream audio chunks.

Errors return `type:"error"`, `id` where validated, and `code`; model-load failure exits with status 1. Logs/warnings go to stderr. Each request needs an ID of 1–80 characters without ASCII controls/DEL. Optional text is metadata, capped at 4000 characters without ASCII controls/DEL, and is never phonemized here. `inputKind`, if supplied, must equal `arpabet`.

Accepted phones are exactly the 71 entries of pinned `vocab.txt`, preserving case and vowel stress. The worker prepends the four fairseq special dictionary symbols internally and appends EOS once. Callers cannot supply special symbols, raw punctuation, unstressed vowel labels, unknown phones, or strings containing multiple phones. Phones must be a nonempty array of at most 300 tokens. The frontend maps comma/semicolon to `sp`; upstream's default G2P filtering drops period/question marks and spaces. No unknown-token fallback occurs. `spn` is a valid released vocabulary token but is never substituted automatically for an unknown token.

`prosody` may be absent, null or `{}`. Other values fail with `unsupported_prosody`; the frozen candidate uses upstream duration/pitch/energy factors of 1.0. A future duration-factor variant needs its own identity/configuration and measurements. Predicted duration expansion is capped at 2500 mel frames (about 29.0 native seconds), before decoder/vocoder allocation. Overlong lines are drained in bounded reads and rejected. Cancellation is process termination, provided by the JS wrapper; this worker does not implement concurrent jobs or in-process cancellation.

## Implementation boundary

[backend.py](backend.py) executes selected, unchanged AST definitions from verified upstream files, avoiding fairseq's training/registry/dataclass imports. It retains upstream FastSpeech2 FFT blocks, attention, variance prediction, position embeddings, length regulation and HiFi-GAN generator. Small local compatibility definitions provide encoder base classes, disabled quantization noise, dictionary IDs, position numbering, and length masks. This is not a port to Transformers' different FastSpeech2Conformer architecture.

The checkpoint contains an `argparse.Namespace` and plain config structures; `torch.load(weights_only=True, mmap=True)` succeeds with a Namespace allowlist. Both model state dicts load strictly, including upstream removal of the deprecated positional `_float_tensor` buffer. All inference runs on CPU float32. Global CMVN is inverted before HiFi-GAN, following upstream `speech_generator.py`; SciPy polyphase resampling uses the exact 320/441 ratio. Explicit `import torch.onnx.operators` is required by upstream sinusoidal embeddings under this runtime. Legacy weight-normalization deprecation warnings are expected.

## Evidence and tests

The direct 18-phone probe produced 150 mel frames, 1.7415 seconds of 16 kHz audio, model load/hash verification 747 ms, synthesis 901 ms (acoustic 359 ms, vocoder 541 ms), peak 0.5264 and RMS 0.07368. These are a single smoke measurement, not perceptual quality or an independent holdout result. The main agent separately reported a successful real JS-wrapper probe: 35 phones, 2.763 seconds audio, 1.203 seconds warm request time, 748 ms model-reported initialization; this backend task did not independently repeat that measurement.

Use the shared frozen corpus at [scripts/fixtures/phoneme-corpus.json](../../scripts/fixtures/phoneme-corpus.json) and the main-owned benchmark. No separate holdout from this experiment is retained. Do not tune against its validation clips. No listening scores or speech recognition accuracy are established by a finite waveform alone.

Focused checks:

```bash
/srv/hackathon/tools/mms-venv/bin/python experiments/meta-fastspeech2/test_backend.py
```

Tests cover corruption rejection before `torch.load`, unknown/special/EOS token rejection, input count and prosody bounds, exact single EOS insertion, PCM length/duration consistency, ID/text/input-kind constraints, and recovery after an oversized line. Final focused result: **9 tests passed in 1.277 seconds**, including sentence validation before inference, exact silence insertion, unchanged single-sentence PCM and joined duration limits. Log: `artifacts/feedback/phoneme-prototype/tests.log` (ignored). Model inference tests should run separately from shared CPU latency measurements.

## Licenses

Both pinned HF model cards omit a license field/file. The upstream [fairseq README license section](https://github.com/facebookresearch/fairseq/blob/3d262bb25690e4eb2e7d3c1309b1e9c406ca4b99/README.md#license) explicitly states MIT licensing also applies to pretrained models. These cards identify the models as fairseq S² and link the same upstream project. That is the first-party license basis used here; the missing HF declarations remain a provenance limitation, not evidence of MMS's CC BY-NC license applying to these different weights. [vendor/LICENSE](vendor/LICENSE) preserves the upstream MIT notice. The official [LJSpeech source](https://keithito.com/LJ-Speech-Dataset/) describes the dataset as public domain. The bundled vocoder has no separate HF license declaration. The supplied organizer FAQ says open-source Meta models count however run, with examples. Meta publisher identity plus the upstream MIT statement are consistent with that category; the supplied FAQ does not require separate per-checkpoint approval. See [FAQ provenance](../../docs/research/submission-requirements-meta-audit-2026-10-29.md#organizer-faq-supplied-during-this-review).

See the [full primary-source feasibility research](../../docs/research/meta-phoneme-backend-feasibility-2026-11-02.md) for comparison with TTS Transformer and MMS.
