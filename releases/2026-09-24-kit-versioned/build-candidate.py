#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parents[2]
raw=(root/'releases/2026-09-24-kit-download/worker.mjs').read_bytes()
assert hashlib.sha256(raw).hexdigest()=='7e7b783bfa9a473cdcfc819b6e3984eef2b0f9c39d1734d99239578a7f6e1ac5'
config=json.loads((root/'dasha-compute-download-release.mjs').read_text().removeprefix('export default ').strip().removesuffix(';'))
helper=(root/'dasha-compute-download.mjs').read_text().replace("import release from './dasha-compute-download-release.mjs';",'const release = '+json.dumps(config)+';').replace('export async function','async function')
s=raw.decode();marker='var __defProp = Object.defineProperty;';assert s.count(marker)==1
s=s[s.index(marker):]
prefix='/compute/releases/706918197b63'
s=s.replace('https://www.getdasha.com/dasha-compute-open-alpha.tar.gz','https://www.getdasha.com'+prefix+'/dasha-compute-open-alpha.tar.gz')
s=s.replace('href="/dasha-compute-open-alpha.tar.gz','href="'+prefix+'/dasha-compute-open-alpha.tar.gz').replace('href=\\"/dasha-compute-open-alpha.tar.gz','href=\\"'+prefix+'/dasha-compute-open-alpha.tar.gz')
s=re.sub(r'(var COMPUTE_KIT_(?:MANIFEST|JSON) = \{.*?sha256: ")[a-f0-9]{64}(")',lambda m:m[1]+config['manifest']['sha256']+m[2],s,flags=re.S)
s=helper+'\n'+s
p=Path(__file__).parent;(p/'worker.mjs').write_text(s)
manifest={'inputs':{'live':{'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)},'candidate':{'sha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode())}},'archiveSha256':config['manifest']['sha256'],'publicArchive':'https://www.getdasha.com'+prefix+'/dasha-compute-open-alpha.tar.gz','deployment':'Preserve assets, bindings and settings; root only; no assets.config mutation.'}
(p/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
