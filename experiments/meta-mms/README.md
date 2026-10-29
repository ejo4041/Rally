# Meta MMS local speech adapter

This is a local model adapter, not a second product backend. It generates moderator speech using **Meta `facebook/mms-tts-eng`**, executed on CPU on Rally's Ubuntu host. The organizer FAQ supplied by the user explicitly permits self-hosted MMS and excludes third-party TTS models. [Rule audit](../../docs/research/submission-requirements-meta-audit-2026-10-29.md).

**Implemented and measured:** pinned offline model loading, persistent Python inference over stdio, one-request concurrency, bounded text/audio, cancellation by terminating model work, timeout, model-identity checks, PCM16/WAV output and synthetic-phrase CPU benchmark. **Connected in version 8:** [protected hosted browser playback](../../docs/releases/2026-10-29-v8.md) and Stop. Teams spoken interventions, echo rejection and host override through a real meeting remain pending.

## Model, license and provenance

- Publisher/model: [Meta MMS English](https://huggingface.co/facebook/mms-tts-eng), 36.3M-parameter VITS speech model.
- Pinned revision: `c71de0fe7204c83f1c10820a7d696d0b450048ba`.
- Weights license: **CC BY-NC 4.0**, as specified by the publisher. This is distinct from Rally's source licensing and Transformers/PyTorch licenses; event permission does not grant future commercial rights.
- Model/runtime files live outside source at `/srv/hackathon/models/mms-tts-eng` and `/srv/hackathon/tools/mms-venv`. They are not committed or distributed in the source export.
- [Artifact SHA-256 manifest](../../docs/research/mms-model-manifest.json). The explicit downloader retrieves safetensors, config/tokenizer files and the publisher README from the pinned revision. Inference checks local hashes and identity, disables hub access, and never executes remote model code.

## Reproduce

Python 3.12 and Node 24 were used. Install CPU PyTorch first to avoid pulling a GPU runtime. No npm installation is needed. If npm downloads are needed elsewhere in Rally, preserve the project's required Nexus registry.

```bash
uv venv /srv/hackathon/tools/mms-venv
uv pip install --python /srv/hackathon/tools/mms-venv/bin/python \
  --index-url https://download.pytorch.org/whl/cpu 'torch==2.15.0+cpu'
uv pip install --python /srv/hackathon/tools/mms-venv/bin/python \
  -r experiments/meta-mms/requirements.lock
/srv/hackathon/tools/mms-venv/bin/python experiments/meta-mms/download.py \
  --directory /srv/hackathon/models/mms-tts-eng
node --test experiments/meta-mms/speech.test.mjs
node experiments/meta-mms/benchmark.mjs
```

Override `RALLY_MMS_PYTHON` and `RALLY_MMS_MODEL_DIR` for another checkout/host. Benchmark outputs are ignored under `test-results/`; benchmark code contains only explicitly authored synthetic phrases. The helper is loaded once per adapter process; subsequent utterances reuse it. Do not download/load the model on each live intervention.

```js
import {MMSSpeech} from './experiments/meta-mms/speech.mjs';
const speech = new MMSSpeech({python: '/path/to/venv/bin/python', modelDirectory: '/path/to/pinned-model'});
try {
  const audio = await speech.synthesize('Could we return to the release decision?');
  // audio.wav is a mono 16 kHz WAV buffer; this call does not play anything.
} finally {
  speech.close();
}
```

`AbortSignal` cancels startup/generation and kills the process; a later request starts fresh. Only one request is accepted at a time. Input is limited to 650 characters, output to 30 seconds, CPU to two Torch threads, startup to 45 seconds and generation to 20 seconds. A cancellation/timeout must not trigger automatic third-party voice fallback.

## Observed benchmark, October 29

[Full measurements](../../docs/research/mms-cpu-benchmark.json). Four synthetic authored phrases, one cold process, two CPU threads, no meeting/provider API calls:

| Phrase | Audio duration | Synthesis time |
| --- | ---: | ---: |
| Opening | 6.144 s | 1.782 s |
| Redirect | 2.992 s | 0.716 s |
| Deadline question | 4.048 s | 0.963 s |
| Wrap-up | 5.728 s | 1.400 s |

Cold model load: 10.519 seconds; first request including load: 12.337 seconds. These are generation measurements, **not first-audible latency**. Physical listening, name pronunciation and Teams transmission were not verified. No service was installed/enabled, no audio was played and no meeting was joined. MMS inference adds no Muse API charges; the existing host still has its normal infrastructure cost.

Next: warm the adapter before advertising readiness; connect only server-approved moderator text, validate the returned WAV, gate against current host epoch, cancel generation and playback together, route through the proved virtual microphone, reject echoed speech, and prove Leave/override before claiming a working spoken Teams loop. Keep visible-text fallback.
