"""Explicit, pinned Meta model download. Never invoked during speech synthesis."""
import argparse
import hashlib
import json
from pathlib import Path
from huggingface_hub import snapshot_download

MODEL = 'facebook/mms-tts-eng'
REVISION = 'c71de0fe7204c83f1c10820a7d696d0b450048ba'
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    args = parser.parse_args()
    root = args.directory.resolve()
    snapshot_download(MODEL, revision=REVISION, local_dir=root,
                      allow_patterns=['config.json','model.safetensors','special_tokens_map.json','tokenizer_config.json','vocab.json','README.md'])
    files = {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir() if p.is_file()}
    manifest = {'model':MODEL,'revision':REVISION,'license':'CC-BY-NC-4.0','sha256':files}
    (root / 'rally-model-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'model':MODEL,'revision':REVISION,'files':len(files),'directory':str(root)}))
