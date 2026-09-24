#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,base64
root=Path(__file__).resolve().parents[2]
raw=(root/'releases/2026-09-24-kit-versioned/worker.mjs').read_bytes()
assert hashlib.sha256(raw).hexdigest()=='30c56840224b8130b4fbc3a232e08496131d3194166564974a0f2fe98565b9f9'
config=json.loads((root/'dasha-compute-download-release.mjs').read_text().removeprefix('export default ').strip().removesuffix(';'))
archive=(root/'dasha-compute-download-archive.mjs').read_text().split('export default ',1)[1].strip().removesuffix(';');blob=base64.b64decode(json.loads(archive));assert len(blob)==config['manifest']['bytes'] and hashlib.sha256(blob).hexdigest()==config['manifest']['sha256']
helper=(root/'dasha-compute-download.mjs').read_text().replace("import archiveBase64 from './dasha-compute-download-archive.mjs';",'const archiveBase64 = '+archive+';').replace("import release from './dasha-compute-download-release.mjs';",'const release = '+json.dumps(config)+';').replace('export async function','async function')
s=raw.decode();marker='var __defProp = Object.defineProperty;';assert s.count(marker)==1;s=helper+'\n'+s[s.index(marker):]
p=Path(__file__).parent;(p/'worker.mjs').write_text(s)
manifest={'inputs':{'live':{'sha256':'8f6c266daa36fb8476710cd13bc434756719cd8feee1721c1accef02587648fe','bytes':1970428},'transformation':{'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)},'candidate':{'sha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode())}},'archiveSha256':config['manifest']['sha256'],'deployment':'Preserve all existing assets, bindings, settings. No runtime GitHub dependency. Root only.'}
(p/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
