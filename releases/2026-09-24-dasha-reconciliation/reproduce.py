#!/usr/bin/env python3
"""Verify three locally supplied public-source bundles and reproduce the candidate.

Usage: python3 reproduce.py LIVE BASELINE MAIN OUTPUT
Never fetches credentials, reads settings, or deploys anything.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
if len(sys.argv) != 5:
    raise SystemExit(__doc__)
inputs = {}
for name, filename in zip(('live', 'baseline', 'main'), sys.argv[1:4]):
    data = Path(filename).read_bytes()
    if hashlib.sha256(data).hexdigest() != manifest['inputs'][name]['sha256']:
        raise SystemExit(f'{name} hash differs; re-review the changed input')
    inputs[name] = data
with tempfile.TemporaryDirectory(prefix='dasha-reconcile-') as temp:
    temp = Path(temp)
    for name, data in inputs.items():
        if name == 'live':
            data = data.replace(b'// ../dasha-lobby-repo/node_modules/', b'// node_modules/')
        (temp / name).write_bytes(data)
    result = subprocess.run(['git', 'merge-file', '-p', str(temp/'live'), str(temp/'baseline'), str(temp/'main')], capture_output=True)
    if result.returncode:
        raise SystemExit('Three-way merge failed or conflicts exist; candidate not written')
    expected = manifest['inputs']['candidate']['sha256']
    if hashlib.sha256(result.stdout).hexdigest() != expected:
        raise SystemExit('Candidate hash differs; candidate not written')
    Path(sys.argv[4]).write_bytes(result.stdout)
    print('Verified candidate:', expected)
