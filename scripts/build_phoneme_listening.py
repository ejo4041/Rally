#!/usr/bin/env python3
"""Build offline, randomized same-text MMS/Meta-phone listening pairs."""
import argparse
import html
import json
from pathlib import Path
import subprocess
import sys

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--result',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
data=json.loads(args.result.read_text())
if data['state']!='completed':raise ValueError('A completed benchmark is required')
args.output.mkdir(parents=True,exist_ok=False)
links=[]
for clip_id in ['development-01','development-02','development-03','validation-01','validation-05']:
    rows=[row for row in data['utterances'] if row['id']==clip_id and row['state']=='generated']
    if len(rows)!=2 or {row['backend'] for row in rows}!={'mms','phoneme'}:raise ValueError('Missing paired audio')
    if rows[0]['text']!=rows[1]['text']:raise ValueError('Words differ')
    directory=args.output/clip_id;directory.mkdir()
    manifest={'referenceText':rows[0]['text'],'comparisonContext':'Two different Meta models and voices: MMS and a direct-phone FastSpeech2 candidate. Same authored words, constant-gain matched loudness. This cannot isolate the effect of the frontend. Rate pronunciation and rhythm; no naturalness ratings have been collected.','conditions':[{'name':row['backend']+' '+row['model']+'@'+row['revision'],'audio':row['audio']} for row in rows]}
    manifest_path=directory/'manifest.json';manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    subprocess.run([sys.executable,str(Path(__file__).with_name('build_tts_listening.py')),'--manifest',str(manifest_path),'--output',str(directory/'index.html')],check=True)
    links.append(f'<li><a href="{clip_id}/index.html">{html.escape(rows[0]["text"])}</a></li>')
(args.output/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rally pronunciation listening</title><style>body{max-width:780px;margin:40px auto;padding:20px;font:18px system-ui}li{margin:20px 0}</style><h1>Rally pronunciation listening</h1><p>Listen before revealing identities. Different voices are expected. Record incorrectly pronounced words separately from naturalness. Each page works offline; ratings stay on your device.</p><ul>'+''.join(links)+'</ul><p>No ratings collected yet. Production voice is unchanged.</p></html>')
print(json.dumps({'index':str(args.output/'index.html'),'pairs':len(links),'listenerRatings':0,'paidCalls':0}))
