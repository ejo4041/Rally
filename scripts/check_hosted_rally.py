#!/usr/bin/env python3
"""Hosted QA; credential supplied only through hidden stdin, never persisted."""
import asyncio
import json
from pathlib import Path
import sys
import termios
import time
import urllib.error
import urllib.parse
import urllib.request


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if urllib.parse.urlparse(req.full_url).netloc!=urllib.parse.urlparse(newurl).netloc:
            raise RuntimeError('Refusing cross-origin credential redirect')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def read_input():
    old=None
    if sys.stdin.isatty():
        old=termios.tcgetattr(sys.stdin);hidden=old.copy();hidden[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,hidden)
    print('Ready for hosted QA configuration on hidden stdin.',flush=True)
    try:return json.loads(sys.stdin.readline())
    finally:
        if old:termios.tcsetattr(sys.stdin,termios.TCSANOW,old)


async def main(config):
    import websockets
    base=config['url'].rstrip('/');parsed=urllib.parse.urlparse(base)
    if parsed.scheme!='https' or not parsed.hostname.endswith('.chatgpt.site'):raise ValueError('Expected the verified private Site URL')
    headers={'OAI-Sites-Authorization':'Bearer '+config['token'],'Content-Type':'application/json','Origin':base}
    opener=urllib.request.build_opener(SameOriginRedirect())
    result={'url':base,'checks':[],'paid':False}
    def call(path,body=None,method=None):
        request=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
        with opener.open(request,timeout=20) as response:
            payload=response.read().decode();return response.status,payload
    meeting_id=None
    try:
        before_usage={e['id'] for e in json.loads(call('/api/usage')[1])['events']}
        status,body=call('/');assert status==200 and '<title>Rally' in body;result['checks'].append('private HTML served')
        status,body=call('/api/config');options=json.loads(body);assert options['liveAvailable'];result['checks'].append('server-side Muse secret configured')
        status,body=call('/api/meetings',{'kind':'walkthrough','title':'Hosted QA walkthrough','minutes':2,'wrapMinutes':.5});assert status==201;meeting_id=json.loads(body)['meeting']['id']
        uri=base.replace('https://','wss://')+f'/api/meetings/{meeting_id}/connect'
        async with websockets.connect(uri,additional_headers={'OAI-Sites-Authorization':headers['OAI-Sites-Authorization']},origin=base,open_timeout=20) as ws:
            async def until(predicate):
                while True:
                    value=json.loads(await asyncio.wait_for(ws.recv(),timeout=20))
                    if value['type']=='speak':await ws.send(json.dumps({'type':'playback','id':value['utterance']['id'],'state':'shown'}))
                    if value['type']=='notice' and value.get('code')=='error':result['checks'].append('notice: '+value['message'])
                    if predicate(value):return value
            await ws.send(json.dumps({'type':'start','consented':True}));await until(lambda m:m['type']=='ready')
            for i in range(6):
                await ws.send(json.dumps({'type':'walkthrough_next'}));value=await until(lambda m:m['type']=='state' and len(m['meeting']['turns'])==i+1)
            action=next(o for o in value['meeting']['outcomes'] if o['type']=='action')
            await ws.send(json.dumps({'type':'confirm','id':action['id'],'owner':'Priya','dueDate':'Thursday at 3 PM'}))
            await until(lambda m:m['type']=='state' and any(o['status']=='confirmed' for o in m['meeting']['outcomes']))
            await ws.send(json.dumps({'type':'end'}));await until(lambda m:m['type']=='state' and m['meeting']['phase']=='ended')
        result['checks'].append('hosted WebSocket walkthrough, proposals, confirmation and save')
        status,body=call(f'/api/meetings/{meeting_id}/export');assert 'SCRIPTED WALKTHROUGH' in body and 'Thursday' in body;result['checks'].append('hosted Markdown export')
        await asyncio.sleep(.5);status,_=call(f'/api/meetings/{meeting_id}',method='DELETE');assert status==200;meeting_id=None;result['checks'].append('QA meeting deleted')
        result['usage']=json.loads(call('/api/usage')[1])['events'];result['newUsageEvents']=[e for e in result['usage'] if e['id'] not in before_usage];assert not result['newUsageEvents'];result['passed']=True
    except Exception as e:
        result['passed']=False;result['error_type']=type(e).__name__
    Path('/srv/hackathon/repo/docs/research/hosted-qa.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)


if __name__=='__main__':
    asyncio.run(main(read_input()))
