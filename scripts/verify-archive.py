from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'verification/ARCHIVE_MANIFEST.json').read_text(encoding='utf-8'))
bad=[]
for item in manifest['files']:
 p=root/item['path']
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=item['sha256']:bad.append(item['path'])
print(json.dumps({'ok':not bad,'checked':len(manifest['files']),'changed_or_missing':bad},ensure_ascii=False))
sys.exit(bool(bad))
