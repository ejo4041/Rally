# Laptop handoff — November 2, 2026

## Resume here

Repository: https://github.com/ejo4041/Rally, branch `main`. Latest implementation is `d620008`; measured results are committed as `871eeeb`. This handoff is committed afterward. Server workspace: `/srv/hackathon/rally-feedback`.

For a new laptop checkout:

```bash
git clone https://github.com/ejo4041/Rally.git
cd Rally
git log -3 --oneline
```

For an existing checkout, inspect `git status` first, preserve local work, then `git pull --ff-only`. Read `AGENTS.md`, [current handoff](handoff.md), and [the phoneme prototype](phoneme-speech-prototype.md). The server already contains the working environment and downloaded models; reconnecting to it is the quickest way to continue actual synthesis. Laptop audio listening needs neither Python nor model weights.

## What just shipped to source

The user asked for research and a working grapheme-to-phoneme integration using Meta technology within an eight-hour window. A working experimental path is implemented and pushed:

1. Canonical approved text → pinned CMU dictionary / explicit stressed ARPABET overrides.
2. Meta `facebook/fastspeech2-en-ljspeech`, revision `a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf`.
3. The HiFi-GAN vocoder bundled in that same Meta snapshot → mono PCM16 at 16 kHz.
4. Rally's existing offline speech jobs and common browser/Teams live speech lifecycle.

MMS English uses character embeddings and cannot acquire real phone control by toggling its tokenizer. This new adapter is a separate configurable Meta voice. No third-party neural G2P/TTS model is used. The compatibility loader verifies pinned upstream code and all six weight/config artifacts before restricted deserialization; MIT notice and provenance are preserved. [Research and primary sources](research/meta-phoneme-backend-feasibility-2026-11-02.md).

Production is still release `6fa6e2f` at `/srv/hackathon/rally-deployed/current`, with its existing voice. API, web and media services were active at handoff verification. This prototype has **not** been promoted to the live app.

## Listen on the laptop first

Five randomized, same-text, matched-loudness A/B comparisons target Meta, agenda, evidence and two validation sentences. Human ratings are pending. The pages embed the audio, work offline and export ratings locally.

Server files:

- Directory: `/srv/hackathon/rally-feedback/artifacts/feedback/phoneme-listening-20261102/`
- Transfer archive: `/srv/hackathon/rally-feedback/artifacts/feedback/phoneme-listening-20261102.tar.gz`
- Full 80-clip corpus: `/srv/hackathon/rally-feedback/artifacts/feedback/phoneme-pilot-v2-20261102/`

Using the SSH host or alias you normally use for this server, run on the laptop; replace `YOUR_SERVER` below:

```bash
scp hack@YOUR_SERVER:/srv/hackathon/rally-feedback/artifacts/feedback/phoneme-listening-20261102.tar.gz .
tar -xzf phoneme-listening-20261102.tar.gz
```

Open `phoneme-listening-20261102/index.html` in your browser. Listen before revealing identities. Record wrong words and pacing separately from naturalness. A preference between different voices does not isolate the effect of the phoneme frontend. These artifacts are ignored by Git; pulling the repository alone will not download them.

## Evidence already collected

[Committed measurements](research/phoneme-prototype-results-2026-11-02.json) identify clean candidate `d620008` and the frozen 20-development/20-validation corpus hash.

- All 80 WAVs generated: 40 MMS and 40 direct-phone Meta clips, no unsupported corpus items. This bounded authored corpus does not prove unrestricted text coverage.
- Direct-phone validation complete-waveform latency: median 941 ms, P95 1149 ms; worker cold start 2084 ms. Native model generation buffers the complete waveform before transport chunking.
- Warm phone planning P95: 0.017 ms across 4,000 calls; no per-word network requests.
- 158 backend tests, 17 frontend tests, 46 shared/local speech tests and nine native-model tests passed; both type checks and frontend build passed.
- Actual local HTTP/SQLite approved-speech smoke passed owner isolation, canonical wording preservation and pause revocation, using real model audio with injected providers/auth fixtures.
- Browser and Teams common live transport smokes generated actual PCM, with roughly three seconds to first transport byte from cold. Meeting connections were fixtures: no real Teams join or remote recipient audibility was established.
- Bounded browser check decoded all ten listening samples and exercised identity hiding/export. Synthetic browser test ratings were discarded; zero human ratings exist.

## What to do next

1. Listen to the five pairs and capture pronunciation/naturalness feedback before switching production voices.
2. Evaluate realistic moderator text coverage. The frontend currently refuses unknown names, unresolved homographs, unreviewed multiple pronunciations, numeric text, addresses and unsupported symbols. Add reviewed normalization/context handling without changing canonical transcript/evidence or silently changing meaning. Do not globally assign one homograph pronunciation when context can vary.
3. Improve long-text handling if needed: current request bounds are 650 characters, 300 phones, 32 sentences and 30 seconds audio. Sentence joins use 300 ms pauses and short fades.
4. After quality and coverage acceptance, test actual recipient audibility, duplex/echo, pause/cancel and latency in a consented call. Then consider production selection through the documented deployment process, preserving active calls, database and secrets.
5. If accepted for the demo, regenerate narration with original captions and recheck the three-minute edit. Existing demo drafts remain available; the new voice has not replaced them.

For the broader product acceptance, follow [Monday live rehearsal](monday-live-rehearsal.md), [demo edit workflow](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/demo-live-edit.md), and [current handoff](handoff.md). Real meeting endurance, recipient playback/camera and final footage acceptance remain distinct from local prototype tests.

## Runtime and reproducibility

On the server:

```text
Node: /srv/hackathon/tools/node/bin/node
Python: /srv/hackathon/tools/mms-venv/bin/python
FastSpeech2 cache: /srv/hackathon/models/meta-fastspeech2
MMS cache: /srv/hackathon/models/mms-tts-eng
```

[Backend README](../experiments/meta-fastspeech2/README.md) records the tested Python/Torch/SciPy versions, weight provisioning and native tests. Models total about 551 MB for this new backend and are outside Git. Do not assume server paths or the tested runtime exist on the laptop.

Select the experimental adapter only in an isolated process using `RALLY_SPEECH_ADAPTER=fastspeech2-local`, `RALLY_EXPERIMENTAL_PHONEMES=1`, `RALLY_PHONEME_PYTHON` and `RALLY_PHONEME_MODEL_DIR`; optional `RALLY_PHONE_OVERRIDES` takes exact-case word keys. See [full configuration](phoneme-speech-prototype.md#configuration). The common meeting output still uses the existing paid-provider enable gate; enabling local speech does not itself authorize unlimited Muse calls.

Source entry points: `packages/rally-speech/phonemes.mjs`, `experiments/phoneme-speech/adapter.mjs`, `experiments/meta-fastspeech2/worker.py`, `apps/rally-api/src/phoneme-tts.ts`. Reproducible corpus runner: `scripts/phoneme-benchmark.mjs`; listening builder: `scripts/build_phoneme_listening.py`. Use fresh run/output names; existing results are retained.

## Continuing constraints

No final submission, external upload or messages are authorized by this handoff. Preserve Meta/Muse runtime requirements, original-work/model attribution, Muse transcription and unchanged canonical text. Keep factual engineering records in the repository.

This prototype batch made zero paid model calls. Tracked Muse spend remains **$5.34166965**; conditional unverified-$150 remainder **$144.65833035**. AWS/shared-host infrastructure costs remain separate and unknown. Read [API budget](api-budget.md) before new paid experiments and record batch usage. The user's request to preserve at least 75% of weekly Codex allowance remains a constraint; this session has no verified account quota balance or reliable way to guarantee that percentage.

Suggested prompt for the next laptop session: “Read AGENTS.md and docs/laptop-handoff-2026-11-02.md, inspect main and the server state, then continue Rally's Meta phoneme speech evaluation. Start with my listening feedback, keep production unchanged until quality acceptance, and do not submit the hackathon entry.”
