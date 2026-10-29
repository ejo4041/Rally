#!/usr/bin/env python3
"""Explicit paid hosted-ASR probe: two seconds of silence, no reasoning."""
import asyncio
import json
from pathlib import Path
import time
import urllib.request
from check_hosted_rally import SameOriginRedirect,read_input

async def main(config):
    import websockets
    base=config['url'].rstrip('/');token=config['token'];opener=urllib.request.build_opener(SameOriginRedirect())
    def call(path,body=None,method=None):
        req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'OAI-Sites-Authorization':'Bearer '+token,'Content-Type':'application/json'},method=method)
        with opener.open(req,timeout=20) as r:return json.loads(r.read())
    result={'scenario':'Private hosted ASR access/binary transport with two seconds silence; not speech accuracy or audible playback.', 'passed':False}
    try:
        meeting=call('/api/meetings',{'title':'Hosted live transport QA','agenda':['Verify audio transport'],'minutes':1,'wrapMinutes':.5})['meeting']
        async with websockets.connect(base.replace('https://','wss://')+f"/api/meetings/{meeting['id']}/connect",additional_headers={'OAI-Sites-Authorization':'Bearer '+token},open_timeout=20) as ws:
            async def until(predicate):
                while True:
                    event=json.loads(await asyncio.wait_for(ws.recv(),20))
                    if event['type']=='speak':await ws.send(json.dumps({'type':'playback','id':event['utterance']['id'],'state':'shown'}))
                    if event['type']=='notice' and event.get('code')=='error':raise RuntimeError(event['message'])
                    if predicate(event):return event
            await ws.send(json.dumps({'type':'start','consented':True}));await until(lambda e:e['type']=='ready')
            start=time.perf_counter()
            for i in range(25):
                await ws.send(bytes(2560));await asyncio.sleep(max(0,start+(i+1)*.08-time.perf_counter()))
            await ws.send(json.dumps({'type':'end'}));await until(lambda e:e['type']=='state' and e['meeting']['phase']=='ended')
        events=call('/api/usage')['events'];result['usage']=[e for e in events if e.get('meetingId')==meeting['id']]
        assert len(result['usage'])==1 and result['usage'][0]['usage']['audioSentSeconds']==2
        await asyncio.sleep(.5);call(f"/api/meetings/{meeting['id']}",method='DELETE')
        result['passed']=True;result['estimatedCost']=sum(e['estimatedCost'] or 0 for e in result['usage'])
    except Exception as e:
        result['error_type']=type(e).__name__
        try:result['usage']=call('/api/usage')['events']
        except:pass
    Path('/srv/hackathon/repo/docs/research/hosted-live-probe.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)

if __name__=='__main__':asyncio.run(main(read_input()))
