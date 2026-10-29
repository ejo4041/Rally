#!/usr/bin/env python3
"""Export source, excluding credentials, runtime data, nested Git and dependencies."""
import argparse
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
EXCLUDED={'.git','node_modules','__pycache__','.data','.venv','dist','test-results','.cache','state','profile','.wrangler'}

def export(out):
    out=out.resolve()
    if out.is_relative_to(ROOT):raise ValueError('Write the archive outside the source tree.')
    count=0
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(ROOT.rglob('*')):
            relative=path.relative_to(ROOT)
            if any(part in EXCLUDED for part in relative.parts) or path.is_symlink() or not path.is_file():continue
            if any(part.startswith('.env') and part!='.env.example' for part in relative.parts):continue
            if path.name=='.dev.vars' or path.suffix in {'.pyc','.sqlite','.sqlite3','.db'}:continue
            if '.openai' in relative.parts and path.name!='hosting.json':continue
            if '.openai' in relative.parts and path.name=='hosting.json':
                data=json.loads(path.read_text());data.pop('project_id',None);archive.writestr(str(relative),json.dumps(data,indent=2)+'\n')
            else:archive.write(path,relative)
            count+=1
    return count

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=Path('/tmp/rally-submission-source.zip'));a=p.parse_args();print(f'Exported {export(a.out)} source files to {a.out}')
