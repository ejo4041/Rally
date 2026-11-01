"""Local Meta MMS model adapter; JSON lines on stdio, no HTTP/product backend."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from prosody import phrases, trim_edges

MODEL = 'facebook/mms-tts-eng'
REVISION = 'c71de0fe7204c83f1c10820a7d696d0b450048ba'
MAX_CHARS = 650
MAX_SECONDS = 30

def emit(value):
    print(json.dumps(value, separators=(',', ':')), flush=True)

def load(directory,model_id=MODEL,revision=REVISION):
    # Loading is strictly offline; download.py is the only download operation.
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TOKENIZERS_PARALLELISM'] = 'false'
    manifest = json.loads((directory / 'rally-model-manifest.json').read_text())
    if manifest.get('model') != model_id or manifest.get('revision') != revision:
        raise ValueError('Unexpected model identity')
    required = {'config.json','model.safetensors','special_tokens_map.json','tokenizer_config.json','vocab.json'}
    if not required.issubset(manifest['sha256']):
        raise ValueError('Incomplete model manifest')
    for name in required:
        if hashlib.sha256((directory / name).read_bytes()).hexdigest() != manifest['sha256'][name]:
            raise ValueError('Model artifact verification failed')
    import torch
    from transformers import AutoTokenizer, VitsModel
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    model = VitsModel.from_pretrained(directory, local_files_only=True, trust_remote_code=False, use_safetensors=True).eval()
    tokenizer = AutoTokenizer.from_pretrained(directory, local_files_only=True, trust_remote_code=False)
    return model, tokenizer

def run(directory,model_id=MODEL,revision=REVISION):
    started = time.monotonic()
    try:
        model, tokenizer = load(directory,model_id,revision)
    except Exception:
        emit({'type':'error','code':'model_load_failed'})
        return 1
    emit({'type':'ready','model':model_id,'revision':revision,'loadMs':round((time.monotonic()-started)*1000)})
    import torch
    import numpy as np
    for line in sys.stdin:
        request_id = None
        try:
            if len(line) > 12000:
                raise ValueError('request_too_large')
            request = json.loads(line)
            request_id = request.get('id')
            text = request.get('text')
            if not isinstance(request_id,str) or len(request_id)>80 or not isinstance(text,str) or not 1<=len(text.strip())<=MAX_CHARS:
                raise ValueError('invalid_request')
            if any(ord(char)<32 and char not in '\n\t' for char in text):
                raise ValueError('invalid_request')
            started = time.monotonic()
            prosody = request.get('prosody', {})
            speed = prosody.get('speakingRate', 1.0)
            pause = prosody.get('sentencePauseMs', 300)
            if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not .85 <= speed <= 1.15:
                raise ValueError('invalid_request')
            rate = int(model.config.sampling_rate)
            parts, phrase_timings, cursor = [], [], 0
            for phrase in phrases(text, pause):
                torch.manual_seed(42)
                inputs = tokenizer(phrase['text'],return_tensors='pt')
                if inputs.input_ids.numel()>1400:
                    raise ValueError('input_limit')
                with torch.inference_mode():
                    audio = model(**inputs, speaking_rate=speed).waveform[0].float().cpu().numpy()
                if not len(audio) or not np.isfinite(audio).all():
                    raise ValueError('output_limit')
                audio = trim_edges(audio, np, rate)
                # 5ms boundary fades prevent joins clicking, without time-stretching.
                fade = min(round(rate * .005), len(audio)//2)
                if fade:
                    audio[:fade] *= np.linspace(0, 1, fade)
                    audio[-fade:] *= np.linspace(1, 0, fade)
                phrase_timings.append({'text':phrase['text'],'startSeconds':cursor/rate,'endSeconds':(cursor+len(audio))/rate,'pauseMs':phrase['pauseMs']})
                parts.extend([audio, np.zeros(round(rate*phrase['pauseMs']/1000), dtype=np.float32)])
                cursor += len(audio) + len(parts[-1])
                if cursor/rate > MAX_SECONDS:
                    raise ValueError('output_limit')
            waveform = np.concatenate(parts)
            seconds = len(waveform)/rate
            if seconds>MAX_SECONDS or not len(waveform) or not np.isfinite(waveform).all():
                raise ValueError('output_limit')
            pcm = (np.clip(waveform,-1,1)*32767).astype('<i2').tobytes()
            emit({'type':'audio','id':request_id,'model':model_id,'revision':revision,
                  'sampleRate':rate,'seconds':seconds,'phrases':phrase_timings,'prosody':{'speakingRate':speed,'sentencePauseMs':pause},'synthesisMs':round((time.monotonic()-started)*1000),
                  'pcmBase64':base64.b64encode(pcm).decode('ascii')})
        except ValueError as error:
            code = str(error) if str(error) in {'invalid_request','input_limit','output_limit','request_too_large'} else 'invalid_request'
            emit({'type':'error','id':request_id,'code':code})
        except Exception:
            emit({'type':'error','id':request_id,'code':'synthesis_failed'})
    return 0

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--model-directory',type=Path,required=True)
    parser.add_argument('--model-id',default=MODEL)
    parser.add_argument('--model-revision',default=REVISION)
    args=parser.parse_args()
    raise SystemExit(run(args.model_directory.resolve(),args.model_id,args.model_revision))
