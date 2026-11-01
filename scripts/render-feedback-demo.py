# Compose the recorded branch UI and attributed local narration into an exact 3-minute review draft.
from pathlib import Path
import json,subprocess,textwrap,os,re
root=Path(__file__).resolve().parents[1];out=Path(os.environ.get('RALLY_DEMO_ARTIFACT_DIR',str(root/'artifacts/feedback')))
first=json.loads((out/'demo-recording-0.json').read_text());second=json.loads((out/'demo-recording-94.json').read_text());evidence=json.loads((out/'demo-narration-evidence.json').read_text())
segments=evidence['segments'];assert first['durationSeconds']==94 and second['durationSeconds']==86
command=['ffmpeg','-nostdin','-hide_banner','-loglevel','warning','-y','-i',first['rawVideo'],'-i',second['rawVideo']]
for i in range(len(segments)):command+=['-i',str(out/f'narration-{i}.wav')]
voice=out/'production-voice-synthetic.wav'
subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-f','s16le','-ar','16000','-ac','1','-i',str(out/'production-voice-synthetic.pcm'),str(voice)],check=True)
command+=['-i',str(voice)]
filters=[
 f"[0:v]trim=start={first['leadSeconds']}:duration=94,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111b25,setsar=1[p]",
 f"[1:v]trim=start={second['leadSeconds']}:duration=86,setpts=PTS-STARTPTS,split=2[phone][post]",
 '[phone]trim=start=0:end=16,setpts=PTS-STARTPTS,crop=390:844:0:0,scale=-2:1000,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111b25,setsar=1[m]',
 '[post]trim=start=16:end=86,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111b25,setsar=1[q]',
 '[p][m][q]concat=n=3:v=1:a=0,fps=30,format=yuv420p[vbase]',
 "[vbase]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='SYNTHETIC REPLAY | REVIEW DRAFT':x=w-tw-28:y=h-th-24:fontsize=22:fontcolor=0xd7c6ff:box=1:boxcolor=0x17212bee:boxborderw=12[vbadge]"
]
chapters=[
 (24,50,'Meta Muse Spark 1.3 | Agenda preparation'),
 (50,79.4,'Meta Muse Voice Transcribe + Muse Spark | Listen and guide'),
 (79.5,85.44,'Meta SeamlessM4T | Previously recorded voice sample'),
 (88,110,'Host control | Pause, identify speakers, mobile review'),
 (110,140,'Meta Muse Spark 1.3 | Full report with source evidence'),
]
previous='vbadge'
for index,(start,end,title) in enumerate(chapters):
 label='v' if index==len(chapters)-1 else f'vchapter{index}'
 filters.append(f"[{previous}]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='{title}':x=34:y=22:fontsize=30:fontcolor=white:box=1:boxcolor=0x17212be6:boxborderw=12:enable='between(t,{start},{end})'[{label}]")
 previous=label
for i,segment in enumerate(segments):
 available=segment['end']-segment['start']-.7
 if segment['seconds']>available:raise ValueError(f'Chapter {i} is too long; shorten narration instead of accelerating speech')
 speed=1
 filters.append(f'[{i+2}:a]atempo={speed},volume=.9,adelay={segment["start"]*1000}:all=1[a{i}]')
filters.append(f'[{len(segments)+2}:a]volume=.95,adelay=79500:all=1[voice]')
filters.append(''.join(f'[a{i}]' for i in range(len(segments)))+'[voice]'+f'amix=inputs={len(segments)+1}:duration=longest:normalize=0,apad=whole_dur=180,atrim=0:180,afade=t=out:st=179:d=1[a]')
target=out/'rally-three-minute-narrated-draft.mp4'
command+=['-filter_complex_threads','1','-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','veryfast','-crf','21','-threads','2','-c:a','aac','-ar','48000','-ac','2','-b:a','160k','-t','180','-movflags','+faststart',str(target)]
subprocess.run(command,check=True)
def timestamp(value):
 ms=round(value*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
blocks=[]
for segment in segments:
 phrases=segment.get('phrases') or [{'text':segment['text'],'startSeconds':0,'endSeconds':segment['seconds']}]
 original_phrases=[part.strip() for part in re.split(r'(?<=[.!?;])\s+|\n+',segment['text']) if part.strip()]
 for index,phrase in enumerate(phrases):
  # Captions use measured sentence timings; silence is not spread across words.
  words=(original_phrases[index] if len(original_phrases)==len(phrases) else segment['text']).split()
  spoken=phrase['endSeconds']-phrase['startSeconds']
  groups=[words[i:i+8] for i in range(0,len(words),8)]
  consumed=0
  for group in groups:
   begin=segment['start']+phrase['startSeconds']+spoken*consumed/len(words)
   consumed+=len(group)
   finish=segment['start']+phrase['startSeconds']+spoken*consumed/len(words)
   blocks.append(f'{len(blocks)+1}\n{timestamp(begin)} --> {timestamp(finish)}\n'+textwrap.fill(' '.join(group),width=42))
(out/'rally-three-minute-narrated-draft.srt').write_text('\n\n'.join(blocks)+'\n')
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(target)]))
duration=float(probe['format']['duration']);assert abs(duration-180)<.1
metadata={'file':str(target),'durationSeconds':duration,'width':1920,'height':1080,'videoCodec':'h264','audioCodec':'aac','sizeBytes':target.stat().st_size,'scope':'Actual current UI with labeled synthetic meeting/model replay; two bounded chapters','narration':evidence['model'],'narrationLicense':evidence['license'],'newPaidSpeechSampleCalls':0,'speechSampleReused':True,'speechSampleOriginalCost':None,'speechSampleFirstByteMs':1643,'speechSampleCached':False,'uploaded':False,'speechTimeStretch':False,'sentenceProsody':True}
(out/'demo-render-evidence.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata))
