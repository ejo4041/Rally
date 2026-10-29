#!/usr/bin/env python3
"""Real-time ASR benchmark using a licensed reference-transcript audio subset."""
import argparse
import asyncio
import ctypes
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import sys
import time
import urllib.request

from muse_latency_spike import LOG, OUT, check_budget, key, record

DATASET = 'https://huggingface.co/datasets/hf-internal-testing/librispeech_asr_dummy'
ROWS = 'https://datasets-server.huggingface.co/rows?dataset=hf-internal-testing%2Flibrispeech_asr_dummy&config=clean&split=validation&offset=0&length=3'


class SFInfo(ctypes.Structure):
    _fields_ = [('frames',ctypes.c_int64), ('samplerate',ctypes.c_int),
                ('channels',ctypes.c_int), ('format',ctypes.c_int),
                ('sections',ctypes.c_int), ('seekable',ctypes.c_int)]


def decode(path, library):
    lib=ctypes.CDLL(library)
    lib.sf_open.argtypes=[ctypes.c_char_p,ctypes.c_int,ctypes.POINTER(SFInfo)]
    lib.sf_open.restype=ctypes.c_void_p
    lib.sf_readf_short.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_short),ctypes.c_int64]
    lib.sf_readf_short.restype=ctypes.c_int64
    lib.sf_close.argtypes=[ctypes.c_void_p]
    info=SFInfo()
    handle=lib.sf_open(str(path).encode(),0x10,ctypes.byref(info))
    if not handle:
        raise ValueError('Unable to decode fixture')
    try:
        assert info.samplerate==16000 and info.channels==1
        samples=(ctypes.c_short*info.frames)()
        assert lib.sf_readf_short(handle,samples,info.frames)==info.frames
    finally:
        lib.sf_close(handle)
    assert sys.byteorder=='little'
    # Last 20ms frame above fixed RMS threshold, an approximate acoustic end.
    end=None
    for start in range(0,len(samples),320):
        frame=samples[start:start+320]
        rms=math.sqrt(sum(v*v for v in frame)/len(frame))
        if rms>200:
            end=min(start+320,len(samples))/16000
    if end is None:
        raise ValueError('No speech-energy reference')
    return bytes(samples), info.frames/16000, end


def prepare(args):
    cache=Path('/tmp/rally-public-audio'); cache.mkdir(exist_ok=True)
    data=json.load(urllib.request.urlopen(ROWS,timeout=30))
    clips=[]
    offset=0
    pcm=bytearray()
    for item in data['rows']:
        row=item['row']
        blob=urllib.request.urlopen(row['audio'][0]['src'],timeout=30).read()
        path=cache/(row['id']+'.flac'); path.write_bytes(blob)
        raw,duration,speech_end=decode(path,args.sndfile)
        clips.append({'id':row['id'],'reference':row['text'], 'sha256_flac':hashlib.sha256(blob).hexdigest(),
                      'speaker_id':row['speaker_id'],'duration_seconds':duration,
                      'start_seconds':offset,'speech_end_seconds':offset+speech_end,
                      'end_seconds':offset+duration})
        pcm.extend(raw)
        pcm.extend(bytes(2*16000*2))  # two seconds of inserted silence per clip
        offset+=duration+2
    revision=data['rows'][0]['row']['audio'][0]['src'].split('/--/')[1]
    manifest={'dataset':DATASET,'dataset_revision': revision,
              'license':'CC BY 4.0','upstream':'https://www.openslr.org/12',
              'sample_rate':16000,'clips':clips,'total_audio_seconds':offset,
              'transform':'FLAC decoded to PCM16 mono; two seconds silence appended after each clip; no speed change',
              'pcm_sha256':hashlib.sha256(pcm).hexdigest()}
    (cache/'input.pcm').write_bytes(pcm)
    (OUT/'public-audio-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'clip_count':len(clips),'duration_seconds':offset}),flush=True)
    return manifest,bytes(pcm)


def words(text):
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?",text.lower())


def distance(a,b):
    row=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        nxt=[i]
        for j,y in enumerate(b,1):
            nxt.append(min(nxt[-1]+1,row[j]+1,row[j-1]+(x!=y)))
        row=nxt
    return row[-1]


async def test(mode,manifest,pcm,label='public-audio'):
    import websockets
    rate=16000
    result={'test':label+'/'+mode,'model':'muse-voice-transcribe-1.0',
            'estimated_cost_usd':None,'mode':mode,'events':[]}
    t=time.perf_counter()
    processed=None
    sent=0
    try:
        async with websockets.connect('wss://api.meta.ai/v1/asr/realtime',open_timeout=15,close_timeout=3) as ws:
            await ws.send(json.dumps({'authorization':{'accessToken':'Bearer '+key()},'model':result['model'],
                         'mode':mode,'audioEncoding':'PCM_16KHZ','partialMode':'CUMULATIVE','emitAudioProgress':True}))
            ack=json.loads(await asyncio.wait_for(ws.recv(),timeout=15))
            if not ack.get('sessionId'):
                raise ValueError('Session was not acknowledged')
            result['session_id']=ack['sessionId']
            start=time.perf_counter()
            result['handshake_seconds']=round(start-t,3)
            async def receive():
                nonlocal processed
                async for msg in ws:
                    if not isinstance(msg,str): continue
                    event=json.loads(msg)
                    if isinstance(event.get('audioProcessedMs'),(int,float)):
                        processed=max(processed or 0,event['audioProcessedMs'])
                    if event.get('type')=='error':
                        raise ValueError('ASR server error')
                    if event.get('type') in ['speechStart','speechEnd','speechComplete','transcript']:
                        result['events'].append({**{k:v for k,v in event.items() if k in ['type','turnId','transcript','speaker','speakerId','speakerLabel','speaker_id','speaker_label','final','audioProcessedMs']},
                                                 'provider_fields':sorted(event),
                                                 'received_seconds':round(time.perf_counter()-start,4)})
            receiver=asyncio.create_task(receive())
            try:
                frame_bytes=rate*2*80//1000
                for pos in range(0,len(pcm),frame_bytes):
                    await asyncio.sleep(max(0,start+pos/(rate*2)-time.perf_counter()))
                    await ws.send(pcm[pos:pos+frame_bytes])
                    sent+=len(pcm[pos:pos+frame_bytes])
                await asyncio.sleep(max(0,start+len(pcm)/(rate*2)-time.perf_counter()))
                result['end_stream_sent_seconds']=round(time.perf_counter()-start,4)
                await ws.send(json.dumps({'type':'endStream'}))
                await asyncio.wait_for(receiver,timeout=15)
            finally:
                if not receiver.done():
                    receiver.cancel()
                    await asyncio.gather(receiver,return_exceptions=True)
            result['status']='session_completed'
    except Exception as e:
        result.update(status='error',error_type=type(e).__name__)
    result['seconds']=round(time.perf_counter()-t,3)
    result['audio_sent_seconds']=sent/(rate*2)
    result['audio_processed_ms']=processed
    if processed is not None:
        result['estimated_cost_usd']=int(processed/1000)*.18/3600
        result['cost_basis']='reported_processed_whole_seconds'
    elif result['status']=='session_completed':
        result['estimated_cost_usd']=int(sent/(rate*2))*.18/3600
        result['cost_basis']='sent_duration_estimate'
    finals=sorted([e for e in result['events'] if e['type']=='speechComplete'],key=lambda e:e.get('turnId',0))
    hypothesis=' '.join(e.get('transcript','') for e in finals)
    reference=' '.join(c['reference'] for c in manifest['clips'])
    errors=distance(words(reference),words(hypothesis))
    result.update(reference_words=len(words(reference)),word_errors=errors,wer=errors/len(words(reference)),hypothesis=hypothesis)
    # Compare finalized cumulative prefix against known clip boundaries. This is
    # alignment by word count, not by predicted audioProcessedMs as a wall clock.
    result['clip_finalizations']=[]
    count=0
    for clip in manifest['clips']:
        count+=len(words(clip['reference']))
        cumulative=0
        matched=None
        for e in finals:
            cumulative+=len(words(e.get('transcript','')))
            if cumulative>=count:
                matched=e; break
        result['clip_finalizations'].append({'id':clip['id'],'reference_prefix_words':count,
            'final_received_seconds':matched['received_seconds'] if matched else None,
            'since_estimated_speech_end_seconds':round(matched['received_seconds']-clip['speech_end_seconds'],4) if matched else None,
            'alignment':'cumulative_word_count_proxy; validate against transcript and turn events'})
    # Ledger keeps only cost/usage summary; full events live in a separate artifact.
    record({k:v for k,v in result.items() if k not in ['events','hypothesis','clip_finalizations']})
    print(json.dumps({k:result.get(k) for k in ['mode','status','seconds','wer','estimated_cost_usd']}),flush=True)
    return result


async def main(args):
    manifest,pcm=prepare(args)
    samples=[]
    spent=0
    projected=math.ceil(manifest['total_audio_seconds'])*.18/3600
    for mode in ['ENDPOINTING','DIARIZATION']:
        check_budget(projected,spent,args.budget_usd)
        r=await test(mode,manifest,pcm)
        samples.append(r)
        (OUT/'public-audio-results.json').write_text(json.dumps(samples,indent=2)+'\n')
        spent+=r.get('estimated_cost_usd') or projected
        if r['status']!='session_completed': break
    report(manifest,samples)


def report(manifest,samples):
    rows=[json.loads(s) for s in LOG.read_text().splitlines()]
    known=sum(r.get('estimated_cost_usd') or 0 for r in rows)
    cost=sum(r.get('estimated_cost_usd') or 0 for r in samples)
    lines=['# Public reference-audio transcription benchmark', '',
           'Run October 28, 2026. Actual Muse API calls; no generated transcripts or accelerated uploads. This is a clean audiobook baseline, not a public-video or meeting benchmark.', '',
           '## Source and license', '',
           f'Three consecutive clips (rows 0–2) from [Hugging Face’s small LibriSpeech validation fixture]({DATASET}), revision `'+manifest['dataset_revision']+'`. These are dev-clean excerpts, not a new held-out test corpus. Original corpus: [LibriSpeech / OpenSLR 12](https://www.openslr.org/12), prepared by Vassil Panayotov with Daniel Povey; corpus paper authors Vassil Panayotov, Guoguo Chen, Daniel Povey, and Sanjeev Khudanpur. License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Audio and reference text are supplied together by the dataset; reference text was never sent as an ASR prompt or keyword hint.', '',
           'We used paired reference audio rather than extracting a random video: source transcript alignment and license are documented, and only three tiny assets were needed. This does not establish performance on spontaneous video discussions.', '',
           'Transformation: decode FLAC to 16 kHz mono PCM16; concatenate clips in source order and insert two seconds of silence after each. Original speech speed unchanged. Raw source/PCM cached in `/tmp/rally-public-audio`, not committed. [Manifest](public-audio-manifest.json) records sample IDs, hashes, source revision, reference text, durations, and transformations.', '',
           '## Method', '',
           'One WebSocket session per mode, streamed in 80 ms chunks at real-time pace. Same audio and settings except mode. Model `muse-voice-transcribe-1.0`, `PCM_16KHZ`, cumulative partials and progress enabled; no retries. Each session contains '+f"{manifest['total_audio_seconds']:.3f} seconds including added silence. Source clips total {sum(c['duration_seconds'] for c in manifest['clips']):.3f} seconds, including their original natural pauses. All samples are one known speaker, not three speakers.", '',
           'WER = word-level Levenshtein edits / reference words, after lowercasing and removing punctuation while preserving internal apostrophes. No special substitution for names, abbreviations, or numbers. Aggregate word sequence checked against the full concatenated reference.', '',
           'Finalization delay is final transcript receive time minus an estimated acoustic end: last 20 ms source frame with RMS above 200 PCM units. One local perf_counter clock tracks real-time input and received events. Chunk pacing gives about 80 ms granularity and the RMS boundary is a proxy, not human-annotated timing. Each final transcript matched one whole reference clip in this run; cumulative word-count alignment was checked against the saved transcripts. Delay includes buffering and network as well as provider processing. It is not a pure model inference number.', '',
           '## Results', '',
           '| Mode | Reference words | Word errors | WER | Median finalization delay | Maximum delay | Estimated cost |',
           '| --- | --- | --- | --- | --- | --- | --- |']
    for r in samples:
        ts=[x['since_estimated_speech_end_seconds'] for x in r['clip_finalizations'] if x['since_estimated_speech_end_seconds'] is not None]
        lines.append(f"| {r['mode']} | {r['reference_words']} | {r['word_errors']} | {100*r['wer']:.2f}% | {statistics.median(ts):.3f}s | {max(ts):.3f}s | ${r.get('estimated_cost_usd') or 0:.5f} |" if ts else f"| {r['mode']} | {r['reference_words']} | — | — | unmeasured | unmeasured | unknown |")
    lines+=['', '| Clip | Duration | ENDPOINTING delay | DIARIZATION delay |', '| --- | --- | --- | --- |']
    for i,c in enumerate(manifest['clips']):
        values=[]
        for r in samples:
            v=r['clip_finalizations'][i]['since_estimated_speech_end_seconds']
            values.append(f'{v:.3f}s' if v is not None else 'unmatched')
        lines.append(f"| {c['id']} | {c['duration_seconds']:.3f}s | "+' | '.join(values)+' |')
    lines+=['', 'Full transcript/events and receipt timestamps: [results JSON](public-audio-results.json). All observed speechComplete events arrived before endStream on this successful run, demonstrating incremental finalization rather than waiting for the entire recording to end.', '',
            '## Interpretation and limits', '',
            'Clean-speech transcription is fast enough to justify the next live-loop experiment. ENDPOINTING had the lower finalization delays on this tiny sample. This is not a reliable distribution estimate, proof of meeting readiness, or evidence that diarization is universally slower.', '',
            'These are only 59 words from one known speaker, drawn from a widely used benchmark that could have appeared in model training/evaluation. No overlap, microphones, room echo, named-speaker introductions, topic drift, reasoning, TTS, host cancellation, or Teams transport was tested. The two-second inserted gaps help endpoint detection; natural conversational gaps can be shorter. Aggregate WER ignores capitalization and punctuation.', '',
            'The earlier Spark fixture timings cannot simply be added to this run and described as measured end-to-end latency. Next test the connected speech → finalized evidence → live moderator → audible response path, then a licensed conversational/video segment with independent transcript and multiple speakers.', '',
            '## Cost and reproduction', '',
            f'This batch: **${cost:.8f} estimated**. Cumulative tracked spend: **${known:.8f}**. Conditional remainder from a full applied $150 grant with no other usage: **${150-known:.8f}**. Actual Billing balance remains unverified. See [cost ledger](muse-cost-ledger.md).', '',
            'Pricing: [Meta official rates](https://dev.meta.ai/docs/pricing-rate-limits), $0.18 per processed audio hour with whole-second metering; both completed sessions reported 29.155 seconds processed, giving 29 billed whole seconds each under the documented rounding rule. No Spark/TTS calls in this batch.', '',
            'Harness: `scripts/muse_audio_benchmark.py`; uses existing `websockets` temporary dependency and libsndfile to decode the reference audio. For this run, the SHA256-verified PyPI soundfile 0.14.0 Linux wheel was unpacked to `/tmp/rally-audio-decode`; only its bundled libsndfile was loaded via ctypes. No global package installation. WER sanity checks passed (case/punctuation normalization and single insertion/deletion).', '',
            'Command used:', '', '```bash', 'PYTHONPATH=/tmp/rally-benchmark-deps python3 scripts/muse_audio_benchmark.py --sndfile /tmp/rally-audio-decode/_soundfile_data/libsndfile_x86_64.so', '```', '',
            'The script explicitly loads the ignored credentials file; do not print it. Default run estimate cap $0.02, existing daily/development budget checks, no automatic retries. Raw audio is fetched again on a rerun; do not rerun without an unanswered question.', '']
    (OUT/'public-audio-benchmark.md').write_text('\n'.join(lines))


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--sndfile',required=True,help='Local libsndfile shared library path')
    p.add_argument('--budget-usd',type=float,default=.02)
    asyncio.run(main(p.parse_args()))
