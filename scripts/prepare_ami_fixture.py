#!/usr/bin/env python3
"""Fetch one licensed short AMI audio range and matching manual annotations.

No inference calls or third-party Python dependencies. Reuses /tmp/ES2002a.*
annotations when their CRC matches the original ZIP entry. Writes only temporary
audio and a provenance/reference manifest, never credentials.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import urllib.request
import xml.etree.ElementTree as ET
import zlib

ROOT=Path(__file__).resolve().parents[1]
WAV='https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/ES2002a/audio/ES2002a.Mix-Headset.wav'
ZIP='https://groups.inf.ed.ac.uk/ami/AMICorpusAnnotations/ami_public_manual_1.6.2.zip'
NITE='{http://nite.sourceforge.net/}id'


def ranged(url,start,end):
    request=urllib.request.Request(url,headers={'Range':f'bytes={start}-{end}'})
    with urllib.request.urlopen(request,timeout=30) as response:
        if response.status!=206:
            raise ValueError('Server ignored Range; refusing full download')
        match=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',response.headers.get('Content-Range',''))
        if not match or tuple(map(int,match.groups()[:2]))!=(start,end):
            raise ValueError('Content-Range mismatch')
        raw=response.read(end-start+2)
        if len(raw)!=end-start+1:
            raise ValueError('Unexpected range length')
        return raw,int(match.group(3))


def annotations(cache):
    _,total=ranged(ZIP,0,0)
    tail,_=ranged(ZIP,max(0,total-65557),total-1)
    pos=tail.rfind(b'PK\x05\x06')
    if pos<0:raise ValueError('Missing ZIP directory')
    eocd=struct.unpack_from('<4s4H2IH',tail,pos)
    size,offset=eocd[5:7]
    central,_=ranged(ZIP,offset,offset+size-1)
    entries={};pos=0
    while central[pos:pos+4]==b'PK\x01\x02':
        header=struct.unpack_from('<4s6H3I5H2I',central,pos)
        length,extra,comment=header[10:13]
        name=central[pos+46:pos+46+length].decode()
        entries[name]={'method':header[4],'crc':header[7], 'compressed_size':header[8],
                       'size':header[9], 'offset':header[16]}
        pos+=46+length+extra+comment
    results={}
    for speaker in 'ABCD':
        name=f'words/ES2002a.{speaker}.words.xml'
        entry=entries[name]
        existing=Path('/tmp')/name.rsplit('/',1)[-1]
        raw=existing.read_bytes() if existing.exists() else b''
        if len(raw)!=entry['size'] or zlib.crc32(raw)!=entry['crc']:
            header,_=ranged(ZIP,entry['offset'],entry['offset']+29)
            local=struct.unpack('<4s5H3I2H',header)
            if local[0]!=b'PK\x03\x04':raise ValueError('Invalid local ZIP entry')
            start=entry['offset']+30+local[-2]+local[-1]
            compressed,_=ranged(ZIP,start,start+entry['compressed_size']-1)
            if entry['method']==8:raw=zlib.decompress(compressed,-15)
            elif entry['method']==0:raw=compressed
            else:raise ValueError('Unsupported ZIP compression')
        if len(raw)!=entry['size'] or zlib.crc32(raw)!=entry['crc']:
            raise ValueError('Annotation CRC/length mismatch')
        (cache/name.rsplit('/',1)[-1]).write_bytes(raw)
        results[speaker]={'raw':raw,'sha256':hashlib.sha256(raw).hexdigest(),
                          'zip_entry':name,'crc32':f"{entry['crc']:08x}"}
    return results,total


def normalized(text):
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?",text.lower())


def lexical_words(raw,speaker):
    rows=[]
    for element in ET.fromstring(raw):
        text=(element.text or '').strip()
        if element.tag!='w' or element.get('punc')=='true' or not normalized(text):continue
        if element.get('starttime') is None or element.get('endtime') is None:continue
        start,end=float(element.get('starttime')),float(element.get('endtime'))
        if end<start:raise ValueError('Reversed annotation interval')
        rows.append({'id':element.get(NITE),'speaker':speaker,'text':text,
                     'source_start_seconds':start,'source_end_seconds':end,
                     'normalized_tokens':normalized(text)})
    return rows


def union(intervals):
    merged=[]
    for start,end in sorted(intervals):
        if end<=start:continue
        if merged and start<=merged[-1][1]:merged[-1][1]=max(end,merged[-1][1])
        else:merged.append([start,end])
    return merged


def overlap_regions(rows):
    boundaries=sorted({v for row in rows for v in (row['start_seconds'],row['end_seconds'])})
    regions=[]
    for start,end in zip(boundaries,boundaries[1:]):
        if end<=start:continue
        active=sorted({row['speaker'] for row in rows if row['start_seconds']<end and row['end_seconds']>start})
        if len(active)<2:continue
        if regions and regions[-1]['speakers']==active and abs(regions[-1]['end_seconds']-start)<1e-8:
            regions[-1]['end_seconds']=end
        else:regions.append({'start_seconds':start,'end_seconds':end,'speakers':active})
    for region in regions:
        region['duration_seconds']=round(region['end_seconds']-region['start_seconds'],6)
    return regions


def main(args):
    cache=Path(args.output_dir);cache.mkdir(parents=True,exist_ok=True)
    annotation_data,zip_size=annotations(cache)
    all_words=[row for speaker,item in annotation_data.items() for row in lexical_words(item['raw'],speaker)]
    all_words.sort(key=lambda row:(row['source_start_seconds'],row['speaker'],row['source_end_seconds'],row['id']))
    # Fixed reproducible boundaries in global lexical-annotation gaps. These
    # are not claimed to be acoustically verified silence or human word times.
    start,end=267.00,317.00
    gaps=union([(row['source_start_seconds'],row['source_end_seconds']) for row in all_words])
    quiet={}
    for label,boundary in [('start',start),('end',end)]:
        before=max(b for a,b in gaps if b<=boundary)
        after=min(a for a,b in gaps if a>=boundary)
        if not before<boundary<after:raise ValueError('Boundary is not an annotation gap')
        quiet[label]={'source_gap_start_seconds':before,'source_gap_end_seconds':after,
                      'cut_seconds':boundary,'kind':'lexical_annotation_gap_not_verified_acoustic_silence'}
    header,wav_size=ranged(WAV,0,255)
    if header[:4]!=b'RIFF' or header[8:12]!=b'WAVE':raise ValueError('Not a WAV source')
    pos=12;fmt=None;data_offset=None;data_size=None
    while pos+8<=len(header):
        kind,size=struct.unpack_from('<4sI',header,pos)
        if kind==b'fmt ':fmt=struct.unpack_from('<HHIIHH',header,pos+8)
        if kind==b'data':data_offset=pos+8;data_size=size;break
        pos+=8+size+(size%2)
    if fmt!=(1,1,16000,32000,2,16) or data_offset is None:
        raise ValueError('Unexpected WAV PCM format')
    first_sample=round(start*16000);last_sample=round(end*16000)
    byte_start=data_offset+first_sample*2;byte_end=data_offset+last_sample*2-1
    pcm,verified_size=ranged(WAV,byte_start,byte_end)
    if verified_size!=wav_size or byte_end>=data_offset+data_size:raise ValueError('Source changed or range invalid')
    (cache/'input.pcm').write_bytes(pcm)
    selected=[];crossing=[]
    for row in all_words:
        a,b=row['source_start_seconds'],row['source_end_seconds']
        if start<=a and b<=end:
            selected.append({**row,'start_seconds':round(a-start,6),'end_seconds':round(b-start,6)})
        elif a<end and b>start:
            crossing.append(row)
    regions=overlap_regions(selected)
    for row in selected:
        row['overlaps_other_speaker']=any(row['start_seconds']<r['end_seconds'] and row['end_seconds']>r['start_seconds'] for r in regions)
    per_speaker={}
    segments=[]
    for speaker in 'ABCD':
        rows=[r for r in selected if r['speaker']==speaker]
        per_speaker[speaker]={'lexical_annotation_count':len(rows),
             'normalized_token_count':sum(len(r['normalized_tokens']) for r in rows),
             'reference_text':' '.join(r['text'] for r in rows)}
        current=None
        for row in rows:
            if current is None or row['start_seconds']-current['end_seconds']>.25:
                current={'speaker':speaker,'start_seconds':row['start_seconds'],'end_seconds':row['end_seconds'],
                         'word_ids':[row['id']],'text':row['text']}
                segments.append(current)
            else:
                current['end_seconds']=max(current['end_seconds'],row['end_seconds'])
                current['word_ids'].append(row['id']);current['text']+=' '+row['text']
    segments.sort(key=lambda row:(row['start_seconds'],row['speaker']))
    overlapping=[r for r in selected if r['overlaps_other_speaker']]
    result={'fixture':'AMI ES2002a mixed headset, four speakers',
        'source':{'corpus':'https://groups.inf.ed.ac.uk/ami/','overview':'https://groups.inf.ed.ac.uk/ami/corpus/overview.shtml',
                  'download_and_license':'https://groups.inf.ed.ac.uk/ami/download/','wav_url':WAV,
                  'wav_total_bytes':wav_size,'wav_header_sha256':hashlib.sha256(header).hexdigest(),
                  'annotation_zip_url':ZIP,'annotation_zip_total_bytes':zip_size,
                  'annotation_entries':{s:{k:v for k,v in d.items() if k!='raw'} for s,d in annotation_data.items()}},
        'attribution':'AMI Meeting Corpus / AMI Consortium; Jean Carletta (2006), Announcing the AMI Meeting Corpus. Excerpted mixed-headset audio and manual words annotations.',
        'license':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/',
        'changes':'Audio excerpt only; PCM payload copied without resampling, channel changes, silence insertion or speed change. Reference removes punctuation annotation nodes, preserves lexical text and normalized tokens.',
        'audio':{'path':str(cache/'input.pcm'),'encoding':'PCM_16KHZ','sample_rate':16000,'channels':1,'sample_width_bytes':2,
                 'source_start_seconds':start,'source_end_seconds':end,'duration_seconds':(last_sample-first_sample)/16000,
                 'source_data_offset_bytes':data_offset,'http_byte_range_inclusive':[byte_start,byte_end],
                 'bytes':len(pcm),'sha256_pcm_excerpt':hashlib.sha256(pcm).hexdigest(),'boundary_gaps':quiet},
        'reference':{'merged_text':' '.join(r['text'] for r in selected),
             'merge_convention':'Only lexical w nodes (not punc=true) fully contained in [start,end], normalized via lowercase ASCII alphanumerics with internal apostrophes. Merge by source start time, then speaker code, then end time, then NXT word ID for ties; speaker codes are annotation identities, not recognized names.',
             'timing_convention':'Times are manual orthographic annotations with forced-aligned word timings, rebased to excerpt start; not perfect acoustic boundary ground truth.',
             'lexical_annotation_count':len(selected),'normalized_token_count':sum(len(r['normalized_tokens']) for r in selected),
             'per_speaker':per_speaker,'boundary_crossing_words_excluded':crossing,'words':selected,'segments':segments,
             'segment_convention':'Same-speaker consecutive lexical words merged across gaps <=0.25s; segments can overlap across speakers and are a convenience view, not annotated utterance boundaries.'},
        'overlap':{'definition':'Positive-duration intersection of word timing spans from at least two distinct speakers. Punctuation and zero-duration lexical tokens do not create intervals. This is a word-timing overlap proxy, not exhaustive acoustic speaker activity.',
             'regions':regions,'total_union_seconds':round(sum(r['duration_seconds'] for r in regions),6),
             'lexical_annotations_touching_overlap':len(overlapping),'normalized_tokens_touching_overlap':sum(len(r['normalized_tokens']) for r in overlapping),
             'nonoverlap_lexical_annotation_count':len(selected)-len(overlapping)},
        'scoring_warning':'Global chronological WER is order-sensitive during overlapping speech and may penalize an intelligible alternative ordering. Report overlap intervals separately; use timestamp-aware or speaker-aware scoring before claiming diarization accuracy. Do not delete reference overlap words and compare against the full mixed ASR hypothesis.',
        'tokenization_caveats':'This reference is a diagnostic, not the canonical AMI scoring pipeline. XML can split contractions/possessives differently from ASR (e.g. one spoken contraction may occupy multiple annotation nodes). Our normalization preserves only internal apostrophes, so separate clitics may differ from joined ASR forms. Fillers, backchannels, repetitions and truncated/disfluent words are retained when represented as lexical w nodes, but a model may normalize or omit them. Hyphenated forms split into multiple normalized tokens. These conventions can raise raw WER without an equivalent meaning error. Report the exact normalization, inspect high-error regions and distinguish lexical node counts from normalized tokens; do not silently tune scoring after seeing a hypothesis.',
        'inference_status':'No model calls made during fixture preparation.'}
    manifest=ROOT/'docs/research/ami-fixture-manifest.json'
    manifest.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'path':str(cache/'input.pcm'),'duration_seconds':result['audio']['duration_seconds'],
                     'bytes':len(pcm),'normalized_tokens':result['reference']['normalized_token_count'],
                     'speaker_counts':{s:d['normalized_token_count'] for s,d in per_speaker.items()},
                     'overlap_proxy_seconds':result['overlap']['total_union_seconds'],
                     'boundary_crossing_words':len(crossing),'manifest':str(manifest)},indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',default='/tmp/rally-ami')
    main(parser.parse_args())
