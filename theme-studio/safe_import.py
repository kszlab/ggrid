#!/usr/bin/env python3
import json, os, stat, sys, zipfile
from pathlib import Path, PurePosixPath

MAX_FILES=2000
MAX_TOTAL=200*1024*1024
MAX_FILE=50*1024*1024

def bad_name(name):
    norm=name.replace('\\','/')
    p=PurePosixPath(norm)
    parts=p.parts
    return (
        not norm or
        norm.startswith('/') or
        '..' in parts or
        (parts and ':' in parts[0]) or
        any(part in ('', '.', '..') for part in parts)
    )

def main():
    if len(sys.argv)!=3:
        raise SystemExit('usage: safe_import.py archive.zip outdir')
    src=Path(sys.argv[1]); out=Path(sys.argv[2]).resolve()
    out.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(src) as z:
        infos=z.infolist()
        if len(infos)>MAX_FILES:
            raise SystemExit('too many files')
        total=0
        names=set()
        for i in infos:
            if i.is_dir():
                continue
            if bad_name(i.filename):
                raise SystemExit('unsafe archive path: '+i.filename)
            if i.file_size>MAX_FILE:
                raise SystemExit('file too large: '+i.filename)
            total+=i.file_size
            if total>MAX_TOTAL:
                raise SystemExit('archive expands too large')
            mode=(i.external_attr>>16)&0xFFFF
            if stat.S_ISLNK(mode):
                raise SystemExit('symlink not allowed: '+i.filename)
            names.add(i.filename.replace('\\','/'))
        if 'manifest.json' not in names or 'project.json' not in names:
            raise SystemExit('missing manifest/project')
        manifest=json.loads(z.read('manifest.json').decode('utf-8'))
        allowed=set((manifest.get('files') or {}).keys())|{'manifest.json'}
        extras=names-allowed
        if extras:
            raise SystemExit('archive contains unlisted files: '+', '.join(sorted(extras)[:10]))
        for name in sorted(names):
            target=(out/name).resolve()
            if target!=out and out not in target.parents:
                raise SystemExit('path escape: '+name)
            target.parent.mkdir(parents=True,exist_ok=True)
            with z.open(name) as r, open(target,'wb') as w:
                while True:
                    b=r.read(1024*1024)
                    if not b: break
                    w.write(b)
if __name__=='__main__':
    main()
