#!/usr/bin/env python3
"""Measure real ASR→Spark while file audio continues at real-time pace; no TTS."""
import asyncio
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

from muse_latency_spike import OUT, check_budget, key, record


def decide(turns, start):
    schema={'type':'object','properties':{
        'intervene':{'type':'boolean'},'spoken_text':{'type':'string'},
        'evidence_turn_ids':{'type':'array','items':{'type':'integer'}}},
        'required':['intervene','spoken_text','evidence_turn_ids'],'additionalProperties':False}
    body={'model':'muse-spark-1.3','reasoning_effort':'minimal','max_tokens':1024,
          'response_format':{'type':'json_schema','json_schema':{'name':'moderation','strict':True,'schema':schema}},
          'messages':[{'role':'system','content':'You are Rally, a meeting moderator. The current agenda is deciding Friday software-release scope. Two consecutive finalized turns clearly unrelated to software releases count as sustained drift. If that occurs, briefly ask to return to the release decision. Literary/art discussion is unrelated. Do not invent decisions or commitments. Only cite supplied turn IDs. One brief question at most; otherwise remain silent.'},
                      {'role':'user','content':json.dumps({'finalized_turns':turns})}]}
    encoded=json.dumps(body).encode()
    check_budget((len(encoded)*1.25+1024*4.25)/1_000_000,0,.02)
    r={'test':'connected-speech/minimal-moderation','model':body['model'],'estimated_cost_usd':None}
    t=time.perf_counter()
    r['request_sent_seconds']=round(t-start,4)
    try:
        request=urllib.request.Request('https://api.meta.ai/v1/chat/completions',data=encoded,
                                     headers={'Authorization':'Bearer '+key(),'Content-Type':'application/json'})
        with urllib.request.urlopen(request,timeout=20) as response:
            data=json.load(response)
            r.update(status=response.status,request_id=response.headers.get('x-request-id'),usage=data.get('usage',{}))
        u=r['usage']
        if 'prompt_tokens' in u and 'completion_tokens' in u:
            cached=u.get('prompt_tokens_details',{}).get('cached_tokens',0)
            r['estimated_cost_usd']=((u['prompt_tokens']-cached)*1.25+cached*.15+u['completion_tokens']*4.25)/1_000_000
        choice=data['choices'][0]
        r['finish_reason']=choice.get('finish_reason')
        decision=json.loads(choice['message']['content'])
        evidence=decision.get('evidence_turn_ids')
        valid=(choice.get('finish_reason')=='stop' and set(decision)==set(schema['required'])
               and type(decision['intervene']) is bool and isinstance(decision['spoken_text'],str)
               and isinstance(evidence,list) and all(type(x) is int and x in {v['turn_id'] for v in turns} for x in evidence)
               and (not decision['intervene'] or bool(evidence) and bool(decision['spoken_text'].strip())))
        r.update(decision=decision,valid=valid)
    except urllib.error.HTTPError as e:
        r.update(status=e.code,request_id=e.headers.get('x-request-id'))
    except Exception as e:
        r.setdefault('status','error');r['error_type']=type(e).__name__
    r['seconds']=round(time.perf_counter()-t,4)
    r['validated_at_seconds']=round(time.perf_counter()-start,4)
    record(r)
    return r


async def main():
    import websockets
    manifest=json.loads((OUT/'public-audio-manifest.json').read_text())
    pcm=Path('/tmp/rally-public-audio/input.pcm').read_bytes()
    import hashlib
    assert hashlib.sha256(pcm).hexdigest()==manifest['pcm_sha256']
    # Reserve both ASR duration and a conservative capped Spark call estimate.
    check_budget(.012,0,.02)
    mode='ENDPOINTING'
    session={'test':'connected-speech/asr','model':'muse-voice-transcribe-1.0','estimated_cost_usd':None}
    output={'scenario':'Licensed audiobook audio with artificial Friday-release agenda; a pipeline smoke test, not a real meeting.',
            'mode':mode,'events':[],'audio_seconds':manifest['total_audio_seconds']}
    turns={}
    reasoning=None
    processed=None
    sent=0
    t=time.perf_counter()
    try:
        async with websockets.connect('wss://api.meta.ai/v1/asr/realtime',open_timeout=15,close_timeout=3) as ws:
            await ws.send(json.dumps({'authorization':{'accessToken':'Bearer '+key()},'model':session['model'],
                                     'audioEncoding':'PCM_16KHZ','mode':mode,'partialMode':'CUMULATIVE','emitAudioProgress':True}))
            ack=json.loads(await asyncio.wait_for(ws.recv(),timeout=15))
            if not ack.get('sessionId'):raise ValueError('No ASR session acknowledgment')
            session['session_id']=ack['sessionId']
            start=time.perf_counter()
            output['handshake_seconds']=round(start-t,4)
            async def receive():
                nonlocal reasoning,processed
                async for message in ws:
                    if not isinstance(message,str):continue
                    event=json.loads(message)
                    if isinstance(event.get('audioProcessedMs'),(int,float)):
                        processed=max(processed or 0,event['audioProcessedMs'])
                    if event.get('type')=='error':raise ValueError('ASR error event')
                    if event.get('type')!='speechComplete':continue
                    now=round(time.perf_counter()-start,4)
                    turn_id=event['turnId']
                    turns[turn_id]={'turn_id':turn_id,'text':event['transcript']}
                    output['events'].append({'turn_id':turn_id,'text':event['transcript'],'final_received_seconds':now})
                    if reasoning is None and len(turns)>=2:
                        output['moderation_trigger_seconds']=now
                        output['trigger_turn_ids']=sorted(turns)
                        # Thread keeps blocking HTTP off audio send/receive loop.
                        reasoning=asyncio.create_task(asyncio.to_thread(decide,[turns[k] for k in sorted(turns)],start))
            receiver=asyncio.create_task(receive())
            try:
                for pos in range(0,len(pcm),2560):
                    await asyncio.sleep(max(0,start+pos/32000-time.perf_counter()))
                    await ws.send(pcm[pos:pos+2560]);sent+=len(pcm[pos:pos+2560])
                await asyncio.sleep(max(0,start+len(pcm)/32000-time.perf_counter()))
                output['end_stream_seconds']=round(time.perf_counter()-start,4)
                await ws.send(json.dumps({'type':'endStream'}))
                await asyncio.wait_for(receiver,timeout=15)
            finally:
                if not receiver.done():
                    receiver.cancel();await asyncio.gather(receiver,return_exceptions=True)
            session['status']='session_completed'
    except Exception as e:
        session.update(status='error',error_type=type(e).__name__)
    if reasoning is not None:
        output['moderation']=await reasoning
    session.update(seconds=round(time.perf_counter()-t,4),audio_sent_seconds=sent/32000,audio_processed_ms=processed)
    if processed is not None:
        session['estimated_cost_usd']=int(processed/1000)*.18/3600
        session['cost_basis']='reported_processed_whole_seconds'
    elif session.get('status')=='session_completed':
        session['estimated_cost_usd']=int(sent/32000)*.18/3600
        session['cost_basis']='sent_audio_estimate'
    record(session)
    output['asr']=session
    output['reference_second_clip_speech_end_seconds']=manifest['clips'][1]['speech_end_seconds']
    if output.get('moderation',{}).get('valid'):
        output['speech_end_to_validated_decision_seconds']=round(output['moderation']['validated_at_seconds']-manifest['clips'][1]['speech_end_seconds'],4)
        output['decision_completed_before_stream_end']=output['moderation']['validated_at_seconds']<output['end_stream_seconds']
    (OUT/'connected-loop-results.json').write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps(output,indent=2))


if __name__=='__main__':
    asyncio.run(main())
