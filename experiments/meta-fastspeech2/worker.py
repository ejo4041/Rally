#!/usr/bin/env python3
"""JSONL worker or one-shot direct-phone probe; stdout contains JSON only."""
import argparse
import base64
import json
from pathlib import Path
import sys
import time
import traceback
import wave

import numpy as np

from backend import Backend, DEFAULT_MODEL_DIR, MODEL, REVISION


def emit(message):
    print(json.dumps(message, allow_nan=False), flush=True)


def validate_request(request):
    if not isinstance(request, dict):
        raise ValueError("invalid_request")
    request_id = request.get("id")
    if (not isinstance(request_id, str) or not 1 <= len(request_id) <= 80
            or any(ord(char) < 32 or ord(char) == 127 for char in request_id)):
        raise ValueError("invalid_request_id")
    if "inputKind" in request and request["inputKind"] != "arpabet":
        raise ValueError("invalid_input_kind")
    if "text" in request:
        text = request["text"]
        if (not isinstance(text, str) or len(text) > 4000
                or any(ord(char) < 32 or ord(char) == 127 for char in text)):
            raise ValueError("invalid_text")
    return request_id


def bounded_lines(stream):
    while True:
        line = stream.readline(65538)
        if not line:
            return
        if len(line) > 65536:
            while line and not line.endswith("\n"):
                line = stream.readline(65538)
            yield None
        else:
            yield line


def sentence_segments(request, backend):
    phones = request.get("phones")
    if not isinstance(phones, list) or not 1 <= len(phones) <= 300:
        raise ValueError("invalid_phones")
    if any(not isinstance(p, str) or p not in backend.phones for p in phones):
        raise ValueError("unknown_phone")
    if request.get("prosody") not in (None, {}):
        raise ValueError("unsupported_prosody")
    if "sentences" not in request:
        return None
    sentences = request["sentences"]
    if not isinstance(sentences, list) or not 1 <= len(sentences) <= 32:
        raise ValueError("invalid_sentences")
    flattened = []
    for sentence in sentences:
        if not isinstance(sentence, dict):
            raise ValueError("invalid_sentence")
        part = sentence.get("phones")
        pause = sentence.get("pauseMs")
        if not isinstance(part, list) or not part or len(part) > 300:
            raise ValueError("invalid_sentence_phones")
        if type(pause) is not int or pause not in (0, 300):
            raise ValueError("invalid_sentence_pause")
        if "text" in sentence:
            text = sentence["text"]
            if (not isinstance(text, str) or len(text) > 4000
                    or any(ord(char) < 32 or ord(char) == 127 for char in text)):
                raise ValueError("invalid_sentence_text")
        flattened.extend(part)
        if len(flattened) > 300:
            raise ValueError("invalid_phones")
    if flattened != phones:
        raise ValueError("sentence_phone_mismatch")
    return sentences


def synthesize_request(backend, request):
    sentences = sentence_segments(request, backend)
    if sentences is None:
        return backend.synthesize(request["phones"], request.get("prosody"))
    started = time.monotonic()
    parts, phrases = [], []
    cursor = frames = acoustic_ms = vocoder_ms = 0
    result = {}
    for index, sentence in enumerate(sentences):
        pcm, result = backend.synthesize(sentence["phones"], request.get("prosody"))
        # Preserve single-sentence audio byte-for-byte. Multi-sentence joins
        # receive a 5 ms edge fade to prevent discontinuities at inserted silence.
        if len(sentences) > 1:
            samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32)
            fade = min(80, len(samples) // 2)
            if fade:
                samples[:fade] *= np.linspace(0, 1, fade)
                samples[-fade:] *= np.linspace(1, 0, fade)
            pcm = samples.round().astype("<i2").tobytes()
        samples_count = len(pcm) // 2
        pause_samples = sentence["pauseMs"] * 16
        if cursor + samples_count + pause_samples > 480000:
            raise ValueError("output_limit")
        phrase = dict(sentenceIndex=index, startSeconds=cursor/16000,
                      endSeconds=(cursor+samples_count)/16000, pauseMs=sentence["pauseMs"])
        if "text" in sentence:
            phrase["text"] = sentence["text"]
        phrases.append(phrase)
        parts.extend([pcm, bytes(pause_samples * 2)])
        cursor += samples_count + pause_samples
        frames += result["melFrames"]
        acoustic_ms += result["timings"]["acousticMs"]
        vocoder_ms += result["timings"]["vocoderMs"]
    pcm = b"".join(parts)
    wave_samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32767
    result = dict(sampleRate=16000, seconds=cursor/16000,
                  synthesisMs=round((time.monotonic()-started)*1000),
                  timings=dict(acousticMs=acoustic_ms, vocoderMs=vocoder_ms),
                  melFrames=frames, phoneCount=len(request["phones"]), phrases=phrases,
                  peak=float(np.abs(wave_samples).max()),
                  rms=float(np.sqrt(np.mean(wave_samples**2))))
    return pcm, result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-directory", "--model-dir", dest="model_dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--model-id", default=MODEL, choices=[MODEL])
    parser.add_argument("--model-revision", default=REVISION, choices=[REVISION])
    parser.add_argument("--threads", type=int, choices=range(1, 5), default=2)
    parser.add_argument("--phones-json", help="JSON array of stressed ARPABET phones")
    parser.add_argument("--output", type=Path, help="one-shot WAV output; JSON excludes PCM")
    args = parser.parse_args()
    if args.output and not args.phones_json:
        parser.error("--output requires --phones-json")
    try:
        backend = Backend(args.model_dir, args.threads)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        emit(dict(type="error", code="model_load_failed", model=MODEL, revision=REVISION))
        return 1
    emit(dict(type="ready", model=MODEL, revision=REVISION, loadMs=backend.load_ms,
              sampleRate=16000, inputKind="arpabet"))
    requests = [json.dumps(dict(id="probe", phones=json.loads(args.phones_json)))] if args.phones_json else bounded_lines(sys.stdin)
    failed = False
    for line in requests:
        request_id = None
        try:
            if line is None or len(line) > 65536:
                raise ValueError("request_too_large")
            request = json.loads(line)
            request_id = validate_request(request)
            pcm, result = synthesize_request(backend, request)
            result.update(type="audio", id=request_id, model=MODEL, revision=REVISION)
            if args.output:
                with wave.open(str(args.output), "wb") as stream:
                    stream.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
                    stream.writeframes(pcm)
                result["output"] = str(args.output)
            else:
                result["pcmBase64"] = base64.b64encode(pcm).decode("ascii")
            emit(result)
        except (ValueError, TypeError) as error:
            failed = True
            emit(dict(type="error", id=request_id, code=str(error).split(":", 1)[0], detail=str(error)))
        except Exception:
            failed = True
            traceback.print_exc(file=sys.stderr)
            emit(dict(type="error", id=request_id, code="synthesis_failed"))
    return int(failed and bool(args.phones_json))


if __name__ == "__main__":
    raise SystemExit(main())
