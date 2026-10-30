# Compose the recorded branch UI and attributed local narration into an exact 3-minute review draft.
from pathlib import Path
import json,subprocess,textwrap
root=Path(__file__).resolve().parents[1];out=root/'artifacts/feedback'
record=json.loads((out/'demo-recording.json').read_text());evidence=json.loads((out/'demo-narration-evidence.json').read_text())
lead=record['leadSeconds'];raw=record['rawVideo'];segments=evidence['segments']
command=['ffmpeg','-nostdin','-hide_banner','-loglevel','warning','-y','-i',raw]
for i in range(len(segments)):command+=['-i',str(out/f'narration-{i}.wav')]
voice=out/'production-voice-synthetic.wav'
subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-f','s16le','-ar','16000','-ac','1','-i',str(out/'production-voice-synthetic.pcm'),str(voice)],check=True)
command+=['-i',str(voice)]
filters=[f'[0:v]trim=start={lead}:end={lead+180},setpts=PTS-STARTPTS,split=3[pre][phone][post]',
 '[pre]trim=start=0:end=94,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111b25,setsar=1[p]',
 '[phone]trim=start=94:end=110,setpts=PTS-STARTPTS,crop=390:844:0:0,scale=-2:1000,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111b25,setsar=1[m]',
 '[post]trim=start=110:end=180,setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111b25,setsar=1[q]',
 "[p][m][q]concat=n=3:v=1:a=0,fps=30,format=yuv420p[vbase]",
 "[vbase]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='SYNTHETIC REPLAY | REVIEW DRAFT':x=w-tw-28:y=h-th-24:fontsize=22:fontcolor=0xd7c6ff:box=1:boxcolor=0x17212bee:boxborderw=12[v]"]
for i,segment in enumerate(segments):
 available=segment['end']-segment['start']-.7;speed=max(1,segment['seconds']/available)
 filters.append(f'[{i+1}:a]atempo={speed},volume=.9,adelay={segment["start"]*1000}:all=1[a{i}]')
filters.append(f'[{len(segments)+1}:a]volume=.95,adelay=79500:all=1[voice]')
filters.append(''.join(f'[a{i}]' for i in range(len(segments)))+'[voice]'+f'amix=inputs={len(segments)+1}:duration=longest:normalize=0,apad=whole_dur=180,atrim=0:180,afade=t=out:st=179:d=1[a]')
target=out/'rally-three-minute-narrated-draft.mp4'
command+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','veryfast','-crf','21','-threads','2','-c:a','aac','-ar','48000','-ac','2','-b:a','160k','-t','180','-movflags','+faststart',str(target)]
subprocess.run(command,check=True)
def timestamp(value):
 ms=round(value*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
blocks=[]
for i,s in enumerate(segments):blocks.append(f'{i+1}\n{timestamp(s["start"])} --> {timestamp(s["end"]-.1)}\n'+textwrap.fill(s['text'],width=72))
(out/'rally-three-minute-narrated-draft.srt').write_text('\n\n'.join(blocks)+'\n')
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(target)]))
duration=float(probe['format']['duration']);assert abs(duration-180)<.1
metadata={'file':str(target),'durationSeconds':duration,'width':1920,'height':1080,'videoCodec':'h264','audioCodec':'aac','sizeBytes':target.stat().st_size,'scope':'Local review draft; actual branch UI with replayed synthetic meeting/model outputs','narration':evidence['model'],'narrationLicense':evidence['license'],'newPaidSpeechSampleCalls':1,'speechSampleCost':None,'speechSampleFirstByteMs':1643,'speechSampleCached':False,'uploaded':False}
(out/'demo-render-evidence.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata))
