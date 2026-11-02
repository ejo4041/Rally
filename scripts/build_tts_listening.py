#!/usr/bin/env python3
"""Make an offline randomized listening sheet with equal-loudness audio."""
import argparse
import base64
import html
import json
from pathlib import Path
import random
import subprocess

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--manifest',required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
args=parser.parse_args();data=json.loads(args.manifest.read_text())
conditions=list(data['conditions']);random.SystemRandom().shuffle(conditions)
rows=[];key={};normalizations=[]
for index,condition in enumerate(conditions):
    label=chr(65+index);target=args.output.parent/f'listening-{label}.wav'
    source=Path(condition['audio']).resolve()
    if target.resolve()==source:raise ValueError('Do not overwrite source recordings')
    measurement=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','info','-i',str(source),'-af','loudnorm=I=-20:TP=-2:LRA=11:print_format=json','-f','null','-'],check=True,capture_output=True,text=True)
    stats=json.loads(measurement.stderr[measurement.stderr.rfind('{'):])
    # Gain only: preserve timing and dynamics; avoid loudnorm's dynamic fallback.
    gain=-24-float(stats['input_i'])
    if float(stats['input_tp'])+gain>-1:raise ValueError('Loudness target would clip; lower the common target')
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(source),'-af',f'volume={gain}dB','-ar','16000','-ac','1',str(target)],check=True)
    verified=subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','info','-i',str(target),'-af','loudnorm=I=-24:TP=-1:LRA=50:print_format=json','-f','null','-'],check=True,capture_output=True,text=True)
    output_stats=json.loads(verified.stderr[verified.stderr.rfind('{'):])
    if abs(float(output_stats['input_i'])+24)>.15:raise ValueError('Matched loudness verification failed')
    normalizations.append({'label':label,'targetLUFS':-24,'gainDB':gain,'measuredOutputLUFS':float(output_stats['input_i']),'method':'Constant gain only; pitch, timing and dynamics preserved.'})
    key[label]=condition['name'];encoded=base64.b64encode(target.read_bytes()).decode('ascii')
    rows.append(f'''<section><h2>Clip {label}</h2><audio controls preload="none" src="data:audio/wav;base64,{encoded}"></audio>
<label>Naturalness<select id="natural-{label}" required><option value="">Choose after listening</option><option value="1">1 — very unnatural</option><option value="2">2 — mostly unnatural</option><option value="3">3 — mixed</option><option value="4">4 — mostly natural</option><option value="5">5 — very natural</option></select></label>
<label>Words that sound wrong / pacing notes<textarea id="notes-{label}" rows="3"></textarea></label></section>''')
script='''const labels=LABELS,key=KEY;
function results(){const ratings=labels.map(label=>({label,naturalness:document.getElementById('natural-'+label).value?Number(document.getElementById('natural-'+label).value):null,notes:document.getElementById('notes-'+label).value}));return {at:new Date().toISOString(),scope:'One informal listener; not a population MOS or standards-conformant study.',ratings,preference:document.getElementById('preference').value,key:document.getElementById('identity').textContent?key:null};}
document.getElementById('download').onclick=()=>{const result=results();if(result.ratings.some(r=>r.naturalness===null)){alert('Rate every clip before exporting.');return;}const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.href=url;a.download='rally-listening-ratings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.getElementById('reveal').onclick=()=>{document.getElementById('identity').textContent=JSON.stringify(key,null,2);};
'''.replace('LABELS',json.dumps(list(key))).replace('KEY',json.dumps(key).replace('<','\\u003c'))
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rally speech listening comparison</title>
<style>body{max-width:780px;margin:35px auto;padding:0 20px;font:18px system-ui;background:#f7f7f9;color:#18212d}section{background:white;padding:24px;margin:20px 0;border-radius:12px}label{display:block;margin:14px 0}select,textarea{display:block;width:100%;font:inherit;padding:8px;box-sizing:border-box}audio{width:100%}button{padding:12px;margin:8px;font:inherit}pre{white-space:pre-wrap}</style>
<h1>Speech listening comparison</h1><p>Use headphones at a comfortable volume. These clips have the same words and matched listening loudness. Rate how natural the speech sounds, including pronunciation and rhythm. Different voices need not sound alike. Score each before revealing identities.</p>
<p>The reference is an archival public speech; differences in recording conditions can affect ratings. No voice cloning is used. This short pilot cannot establish overall product quality.</p>
<details><summary>Verified text</summary><p>REFERENCE</p></details>
ROWS
<label>Which clip do you prefer?<select id="preference"><option value="">Not decided</option>PREFERENCES<option value="tie">Tie</option></select></label>
<button id="download">Download my ratings</button><button id="reveal">Reveal identities after rating</button><pre id="identity"></pre>
<p>No data is sent anywhere; the downloaded ratings stay on your device.</p><script>SCRIPT</script></html>'''
page=page.replace('REFERENCE',html.escape(data['referenceText'])).replace('ROWS',''.join(rows)).replace('PREFERENCES',''.join(f'<option value="{label}">Clip {label}</option>' for label in key)).replace('SCRIPT',script)
args.output.write_text(page)
args.output.with_suffix('.key.json').write_text(json.dumps({'key':key,'normalizations':normalizations,'ratingsCollected':0,'scope':'Randomized two-condition pilot; standalone offline file, no telemetry or submission.'},indent=2)+'\n')
print(json.dumps({'file':str(args.output),'clips':len(key),'ratingsCollected':0,'uploaded':False}))
