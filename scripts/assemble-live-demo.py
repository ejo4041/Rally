#!/usr/bin/env python3
"""Build a local 180-second edit draft; missing shots remain explicit placeholders."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]))


def seconds(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Times must be finite numbers')
    return value


def validate(data, inspect=probe):
    if data.get('version') != 1 or data.get('durationSeconds') != 180:
        raise ValueError('Expected version 1 and a 180-second timeline')
    base = (ROOT / data['base']).resolve()
    output = (ROOT / data['output']).resolve()
    artifacts = (ROOT / 'artifacts').resolve()
    if not output.is_relative_to(artifacts) or output.suffix != '.mp4':
        raise ValueError('Output must be an MP4 under ignored artifacts/')
    if not base.is_file() or output == base:
        raise ValueError('Base must exist and be preserved')
    info = inspect(base)
    if abs(float(info['format']['duration']) - 180) > .1:
        raise ValueError('Base must be 180 seconds')
    if not any(s['codec_type'] == 'audio' for s in info['streams']):
        raise ValueError('Base narration audio missing')
    seen, previous = set(), 0
    for slot in data['slots']:
        if slot['id'] in seen:
            raise ValueError('Duplicate slot ID')
        seen.add(slot['id'])
        start, end, offset = (seconds(slot[key]) for key in ('start', 'end', 'sourceStart'))
        if not 0 <= start < end <= 180 or start < previous or offset < 0:
            raise ValueError('Slots must be ordered, disjoint and within the timeline')
        previous = end
        if not isinstance(slot['useSourceAudio'], bool):
            raise ValueError('useSourceAudio must be boolean')
        # Text is displayed via textfile, never interpolated into shell/filter syntax.
        if not isinstance(slot['title'], str) or not slot['title'].strip() or len(slot['title']) > 100:
            raise ValueError('Slot title is required and bounded')
        if slot['source'] is not None:
            clip = (ROOT / slot['source']).resolve()
            if not clip.is_file() or clip == output:
                raise ValueError('Clip must exist and cannot be the output')
            meta = inspect(clip)
            if not any(s['codec_type'] == 'video' for s in meta['streams']):
                raise ValueError('Clip has no video')
            if float(meta['format']['duration']) + .01 < offset + end - start:
                raise ValueError('Clip too short; do not fabricate duration or accelerate playback')
            if slot['useSourceAudio'] and not any(s['codec_type'] == 'audio' for s in meta['streams']):
                raise ValueError('Selected source audio missing')
            if slot['useSourceAudio'] and not (79.5 <= start and end <= 85.44):
                raise ValueError('Source audio is restricted to the narration-free voice interval')
    return base, output


def build(data):
    base, output = validate(data)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Artifact directory is ignored and contains only prepared labels/metadata, never credentials.
    labels = output.parent / 'live-edit-labels'
    labels.mkdir(exist_ok=True)
    command = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'warning', '-y', '-i', str(base)]
    filters, last, audio, index = [], '0:v', '0:a', 0
    for n, slot in enumerate(data['slots']):
        start, end = slot['start'], slot['end']
        active = f'gte(t,{start})*lt(t,{end})'
        title = labels / f'slot-{n}.txt'
        title.write_text(('LIVE TEAMS | EDITED EXCERPT\n' if slot['source'] else 'LIVE FOOTAGE PENDING | EDIT SLOT\n') + slot['title'])
        if slot['source']:
            index += 1
            command += ['-i', str((ROOT / slot['source']).resolve())]
            filters.append(f'[{index}:v]trim=start={slot["sourceStart"]}:duration={end-start},setpts=PTS-STARTPTS+{start}/TB,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x111b25,setsar=1,fps=30[clip{n}]')
            filters.append(f'[{last}][clip{n}]overlay=eof_action=pass:repeatlast=0:enable=\'{active}\'[shot{n}]')
            last = f'shot{n}'
            if slot['useSourceAudio']:
                filters.append(f'[{audio}]volume=0:enable=\'{active}\'[duck{n}]')
                filters.append(f'[{index}:a]atrim=start={slot["sourceStart"]}:duration={end-start},asetpts=PTS-STARTPTS,adelay={round(start*1000)}:all=1[voice{n}]')
                filters.append(f'[duck{n}][voice{n}]amix=inputs=2:duration=first:normalize=0[audio{n}]')
                audio = f'audio{n}'
        filters.append(f'[{last}]drawbox=x=18:y=14:w=1884:h=96:color=0x17212bf5:t=fill:enable=\'{active}\',drawtext=fontfile={FONT}:textfile={title}:expansion=none:x=36:y=27:fontsize=26:fontcolor=white:enable=\'{active}\'[label{n}]')
        last = f'label{n}'
    command += ['-filter_complex_threads', '1', '-filter_complex', ';'.join(filters), '-map', f'[{last}]', '-map', f'[{audio}]' if audio != '0:a' else '0:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', '180', '-movflags', '+faststart', str(output)]
    subprocess.run(command, check=True)
    info = probe(output)
    if abs(float(info['format']['duration']) - 180) > .1:
        raise ValueError('Rendered duration failed')
    manifest = {'file':str(output),'durationSeconds':float(info['format']['duration']),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sourceBaseSHA256':hashlib.sha256(base.read_bytes()).hexdigest(),'replacedSlots':[s['id'] for s in data['slots'] if s['source']],'pendingSlots':[s['id'] for s in data['slots'] if not s['source']],'scope':'Edited review draft; each missing live shot remains visibly pending; synthetic base retains its label.','uploaded':False,'submitted':False,'paidModelCalls':0}
    output.with_suffix('.json').write_text(json.dumps(manifest, indent=2)+'\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT/'scripts/fixtures/live-demo-edit.json')
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    data = json.loads(args.manifest.read_text())
    validate(data)
    print(json.dumps({'valid':True,'pendingSlots':[s['id'] for s in data['slots'] if not s['source']]} if args.check_only else build(data)))
