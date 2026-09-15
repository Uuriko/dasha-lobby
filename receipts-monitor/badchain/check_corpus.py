#!/usr/bin/env python3
"""Run the bad-chain corpus: fixture-1 (good control) must verify OK,
every tampered fixture (2-7) must FAIL loudly. Exit 1 on any surprise.

Run: python3 receipts-monitor/badchain/check_corpus.py  (needs: pip install cryptography)
"""
import os, sys
from verify_fixture import run

HERE = os.path.dirname(os.path.abspath(__file__))

EXPECTED = {
    "fixture-1-good-control.json": "OK",
    "fixture-2-modified-amount.json": "FAIL",
    "fixture-3-broken-prev-hash.json": "FAIL",
    "fixture-4-invalid-signature.json": "FAIL",
    "fixture-5-reordered-receipts.json": "FAIL",
    "fixture-6-nonascii-field.json": "FAIL",
    "fixture-7-uncovered-tip.json": "FAIL",
}

bad = 0
for name, want in sorted(EXPECTED.items()):
    got = run(os.path.join(HERE, name))
    ok = got.startswith(want)
    print(f"{'PASS' if ok else 'UNEXPECTED'}: {name}: {got}")
    if not ok:
        bad += 1
if bad:
    sys.exit(f"{bad} fixture(s) misbehaved")
print(f"OK: {len(EXPECTED)} fixtures behave as expected (control passes, all tamper classes fail loudly)")
