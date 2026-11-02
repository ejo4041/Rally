#!/usr/bin/env python3
"""Offline speech diagnostics. WER is intelligibility, never a naturalness MOS."""
import argparse
import array
import json
import math
from pathlib import Path
import re
import subprocess
import sys


def words(text):
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?", text.lower().replace('’', "'"))


def word_errors(reference, hypothesis):
    a, b = words(reference), words(hypothesis)
    if not a:
        raise ValueError('Nonempty verified reference required')
    # Unit-cost Levenshtein with stable alignment to expose errors.
    rows = [[(i+j, []) for j in range(len(b)+1)] for i in range(len(a)+1)]
    for i in range(1,len(a)+1):rows[i][0]=(i,[{'type':'deletion','reference':w} for w in a[:i]])
    for j in range(1,len(b)+1):rows[0][j]=(j,[{'type':'insertion','hypothesis':w} for w in b[:j]])
    for i,x in enumerate(a,1):
        for j,y in enumerate(b,1):
            if x==y:
                rows[i][j]=rows[i-1][j-1]
            else:
                choices=[(rows[i-1][j-1][0]+1,rows[i-1][j-1][1]+[{'type':'substitution','reference':x,'hypothesis':y}]),(rows[i-1][j][0]+1,rows[i-1][j][1]+[{'type':'deletion','reference':x}]),(rows[i][j-1][0]+1,rows[i][j-1][1]+[{'type':'insertion','hypothesis':y}])]
                rows[i][j]=min(choices,key=lambda row:row[0])
    count,errors=rows[-1][-1]
    return {'referenceWords':len(a),'hypothesisWords':len(b),'wordErrors':count,'wer':count/len(a),'errors':errors,'interpretation':'Recognizer-dependent intelligibility proxy; not acoustic pronunciation accuracy or naturalness.'}


def audio_metrics(path, reference_word_count=None):
    raw=subprocess.check_output(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-i',str(path),'-ac','1','-ar','16000','-f','s16le','-'])
    samples=array.array('h');samples.frombytes(raw)
    if sys.byteorder!='little':samples.byteswap()
    if not samples:raise ValueError('Empty audio')
    frame=320
    rms=[math.sqrt(sum(x*x for x in samples[i:i+frame])/len(samples[i:i+frame]))/32768 for i in range(0,len(samples),frame)]
    # Identical fixed threshold: energy diagnostic, not validated speech VAD.
    threshold=10**(-35/20)
    active=[i for i,value in enumerate(rms) if value>=threshold]
    if not active:raise ValueError('No above-threshold signal')
    first,last=active[0],active[-1]
    runs=[];start=None
    for i in range(first,last+2):
        quiet=i<=last and rms[i]<threshold
        if quiet and start is None:start=i
        if not quiet and start is not None:
            duration=(i-start)*.02
            if duration>=.15:runs.append({'startSeconds':round(start*.02,3),'durationSeconds':round(duration,3)})
            start=None
    duration=len(samples)/16000
    span=min(duration,(last+1)*.02)-first*.02
    return {'durationSeconds':duration,'aboveThresholdSpanSeconds':round(span,3),'thresholdDBFS':-35,'internalLowEnergyRunsAtLeast150ms':runs,'lowEnergyFraction':sum(x<threshold for x in rms)/len(rms),'clippedSampleFraction':sum(abs(x)>=32760 for x in samples)/len(samples),'peakDBFS':20*math.log10(max(abs(x) for x in samples)/32768),'referenceWordsPerMinute':None if reference_word_count is None else reference_word_count*60/span,'scope':'20ms mono16k analysis; low energy is not guaranteed silence and applause/noise is not classified as speech.'}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();manifest=json.loads(args.manifest.read_text());reference=manifest['referenceText']
    result={'referenceSource':manifest['source'],'naturalnessMOS':None,'naturalnessReason':'No human listening ratings collected.','conditions':[]}
    for condition in manifest['conditions']:
        row={'name':condition['name'],'audio':audio_metrics(condition['audio'],len(words(reference)))}
        if condition.get('asrResult'):
            asr=json.loads(Path(condition['asrResult']).read_text())
            if asr['state']!='completed':raise ValueError('ASR did not complete')
            row['intelligibility']=word_errors(reference,asr['hypothesis'])
            row['usage']=asr['usage']
        result['conditions'].append(row)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
