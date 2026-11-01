"""Sentence boundaries retained outside the punctuation-stripping MMS tokenizer."""
import re

def phrases(text, sentence_pause_ms=300):
    if not isinstance(text, str) or not text.strip():
        raise ValueError('invalid_request')
    if not isinstance(sentence_pause_ms, int) or not 120 <= sentence_pause_ms <= 650:
        raise ValueError('invalid_request')
    # Never split decimals, times, initials or abbreviations such as Dr. Priya.
    chunks = re.split(r'(?<=[.!?;])\s+|\n+', text.strip())
    combined = []
    for chunk in chunks:
        if not chunk.strip():
            continue
        if combined and re.search(r'(?:\b(?:Dr|Mr|Mrs|Ms|Prof|e\.g|i\.e)|\b[A-Z])\.$', combined[-1]):
            combined[-1] += ' ' + chunk.strip()
        else:
            combined.append(chunk.strip())
    return [{'text':part,'pauseMs':sentence_pause_ms if i < len(combined)-1 else 0} for i,part in enumerate(combined)]

def trim_edges(waveform, np, rate):
    # Trim only quiet edges, with 35ms handles. Do not alter word spacing internally.
    threshold = max(float(np.max(np.abs(waveform))) * .008, .0002)
    active = np.flatnonzero(np.abs(waveform) > threshold)
    if not len(active):
        raise ValueError('output_limit')
    pad = round(rate * .035)
    return waveform[max(0,int(active[0])-pad):min(len(waveform),int(active[-1])+pad+1)].copy()
