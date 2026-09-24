#!/usr/bin/env python3
"""Apply only the reviewed immutable-kit route to the preserved production bundle."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[2]
baseline=root/'releases/2026-09-24-dasha-reconciliation/worker.mjs'
raw=baseline.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='8f6c266daa36fb8476710cd13bc434756719cd8feee1721c1accef02587648fe'
config=json.loads((root/'dasha-compute-download-release.json').read_text())
assert len(config['commit'])==40 and int(config['commit'],16)>=0
assert len(config['manifest']['sha256'])==64
helper=(root/'dasha-compute-download.mjs').read_text()
helper=helper.replace("import release from './dasha-compute-download-release.json' with { type: 'json' };",'const release = '+json.dumps(config)+';').replace('export async function','async function')
needle='    {\n      const room = await roomDiscoveryResponse(request, { fetch: env?.fetch || globalThis.fetch });'
s=raw.decode();assert s.count(needle)==1
s=helper+'\n'+s.replace(needle,'    const kitRelease = await computeDownloadResponse(request);\n    if (kitRelease) return kitRelease;\n'+needle)
output=Path(__file__).with_name('worker.mjs');output.write_text(s)
print(json.dumps({'baselineSha256':hashlib.sha256(raw).hexdigest(),'candidateSha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode())}))
