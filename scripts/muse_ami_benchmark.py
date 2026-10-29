#!/usr/bin/env python3
"""Small conversational ASR diagnostic; not official speaker-aware AMI scoring."""
import asyncio
import hashlib
import json
from pathlib import Path
from muse_audio_benchmark import test
from muse_latency_spike import LOG,OUT,check_budget


async def main():
    fixture=json.loads((OUT/'ami-fixture-manifest.json').read_text())
    raw=Path(fixture['audio']['path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==fixture['audio']['sha256_pcm_excerpt']
    # Preserve source speech speed; append a short flush/silence tail.
    pcm=raw+bytes(16000*2*2)
    duration=fixture['audio']['duration_seconds']
    meta={'total_audio_seconds':duration+2,'clips':[{
        'id':'AMI-ES2002a-267-317','reference':fixture['reference']['merged_text'],
        'speech_end_seconds':max(w['end_seconds'] for w in fixture['reference']['words'])}]}
    samples=[]
    spent=0
    for mode in ['ENDPOINTING','DIARIZATION']:
        check_budget((duration+2)*.18/3600,spent,.02)
        r=await test(mode,meta,pcm,label='ami-four-speaker')
        # No prefix-by-count finalization proxy: overlap/deletions make it invalid.
        r.pop('clip_finalizations',None)
        r['scoring_note']='Diagnostic chronological WER only; overlaps, fillers and contraction tokenization can affect alignment. Not diarization error rate.'
        samples.append(r)
        (OUT/'ami-benchmark-results.json').write_text(json.dumps(samples,indent=2)+'\n')
        spent+=r.get('estimated_cost_usd') or (duration+2)*.18/3600
        if r['status']!='session_completed':break
    report(fixture,samples)


def report(fixture,samples):
    rows=[json.loads(line) for line in LOG.read_text().splitlines()]
    total=sum(r.get('estimated_cost_usd') or 0 for r in rows)
    batch=sum(r.get('estimated_cost_usd') or 0 for r in samples)
    lines=['# AMI four-speaker meeting-audio diagnostic', '',
           'Actual Muse calls on October 28, 2026. This is a harder reference-audio check after the tiny clean LibriSpeech baseline, not official AMI speaker-aware scoring or a physical room-microphone test.', '',
           '## Source and rights', '',
           'AMI Meeting Corpus / AMI Consortium; Jean Carletta (2006), Announcing the AMI Meeting Corpus. [Corpus overview](https://groups.inf.ed.ac.uk/ami/corpus/overview.shtml), [signals/transcription license notice](https://groups.inf.ed.ac.uk/ami/download/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). No participant endorsement is implied.', '',
           'Source ES2002a, mixed headset, 267–317 seconds: 50 seconds PCM16 mono at 16 kHz, downloaded by validated HTTP byte range. Manual per-speaker word annotations are extracted from the official ZIP by byte range/CRC verification. No full corpus or video download. This is audio from a meeting corpus with associated video, not an extracted public-video upload.', '',
           'The excerpt has four annotated speakers (A=10, B=65, C=22, D=16 normalized reference tokens), 113 tokens total, and 4.0 seconds of word-timing overlap proxy. Boundaries fall in annotated lexical gaps with zero crossing words, but forced-aligned annotations do not guarantee physical acoustic silence. Test appends two seconds of digital silence after the source excerpt; original speech is neither stretched nor accelerated.', '',
           '[Fixture manifest](ami-fixture-manifest.json) records source URLs, byte range, hashes, attribution, exact reference words/timings, overlaps and scoring warnings. Raw PCM and XML are cached under `/tmp/rally-ami`, not committed.', '',
           '## Method', '',
           'One real-time-paced WebSocket session per mode, same input and settings except ENDPOINTING versus DIARIZATION. Model muse-voice-transcribe-1.0, PCM_16KHZ, 80 ms chunks, cumulative partials and progress enabled, no retries. Reference transcript is never supplied to the ASR model.', '',
           'Diagnostic aggregate WER is word-level Levenshtein edits divided by 113 chronological reference tokens, after lowercase/punctuation normalization with internal apostrophes preserved. It is not a percent of words that were correct, and not a diarization error rate. Overlapping words are merged by annotated start time; different intelligible ordering can be penalized. Fillers, disfluencies, contraction expansions (for example gonna versus going to) and forced-alignment boundaries also affect the score. We did not silently remove these errors or reference words to improve the result.', '',
           '## Observed results', '',
           '| Mode | Reference tokens | Word edits | Diagnostic WER | Finalized turns | Finals before endStream | Estimated USD |',
           '| --- | --- | --- | --- | --- | --- | --- |']
    for r in samples:
        finals=[e for e in r['events'] if e['type']=='speechComplete']
        before=sum(e['received_seconds']<r['end_stream_sent_seconds'] for e in finals)
        lines.append(f"| {r['mode']} | {r['reference_words']} | {r['word_errors']} | {100*r['wer']:.2f}% | {len(finals)} | {before}/{len(finals)} | ${r.get('estimated_cost_usd') or 0:.5f} |")
    firsts=[]
    for r in samples:
        finals=[e for e in r['events'] if e['type']=='speechComplete']
        firsts.append(f"{r['mode']}: {min(e['received_seconds'] for e in finals):.3f}s" if finals else f"{r['mode']}: no final output")
    lines+=['', 'The text preserves much of the discussion, but omissions and substitutions are material. The current result is one small excerpt, insufficient to claim a general accuracy advantage for either mode. First finalized output from stream start: '+', '.join(firsts)+'. These are times from stream start for differently segmented turns, not comparable acoustic-end latency measurements. Do not present them as ASR processing latency.', '',
            'Saved final events do not by themselves establish which speaker said each word. The diagnostic collector retains selected transcript/turn event types; standalone diarization messages, if emitted, are not used for scoring. Four speakers are known from the manual corpus annotation, not correctly identified by this test. Named-person recognition remains untested.', '',
            'Full hypotheses and timestamped events: [results JSON](ami-benchmark-results.json). Use the manifest for exact reference wording and overlap flags. No reasoning/TTS/host-cancel/Teams calls were included.', '',
            '## Product implications', '',
            '- The earlier 0/59-word clean result is not representative of multi-speaker meeting audio. Keep uncertainty and host corrections in the first build.',
            '- Proceed with the browser loop, but avoid final commitments inferred solely from an unreliable name/date fragment. Explicit confirmation and source evidence remain required.',
            '- Keep ENDPOINTING as the initial response-speed baseline and DIARIZATION configurable. A future targeted test should compare usable turn delay and speaker mapping on actual participants before committing to one mode for every meeting.',
            '- Do not spend more on this exact clip to chase a better headline. The next useful validation is real browser capture/playback, then a controlled owner/date/confirmation scenario with human review.', '',
            '## Cost and reproduction', '',
            f'Batch estimate: **${batch:.8f}**. Cumulative tracked estimate: **${total:.8f}**. Conditional remainder from a full applied $150 grant and no other usage: **${150-total:.8f}**. Actual Billing balance remains unverified. [Ledger](muse-cost-ledger.md).', '',
            'Each session sent 52 seconds including silence and cost an estimated $0.0026 at [Meta’s $0.18/hour rate](https://dev.meta.ai/docs/pricing-rate-limits). No external-provider inference spending.', '',
            'Prepare with `python3 scripts/prepare_ami_fixture.py`, then run `PYTHONPATH=/tmp/rally-benchmark-deps python3 scripts/muse_ami_benchmark.py`. The temporary dependency contains the previously verified websockets wheel; normal environments may install websockets through their package manager. Credentials are loaded without being displayed. Per-run estimate cap $0.02 and central budget checks apply. Do not rerun without a new question.', '']
    (OUT/'ami-benchmark.md').write_text('\n'.join(lines))


if __name__=='__main__':
    asyncio.run(main())
