# Bad-chain test corpus (growth lane, 100-task item 120, Sep 15)

Tiny fixtures proving the receipts-chain verifier fails LOUDLY on each tamper class.
Verifier logic is copied verbatim from dasha-lobby receipts-monitor/forkable.yml
(chain verification + heads tip-coverage). Base data: first 5 live receipts +
live keys.json, fetched Sep 15 ~3:07 PM PT. Fixtures 1 and 7 use a synthetic
head entry so tip-coverage is testable on a 5-receipt window.

Run: python3 verify_fixture.py fixture-N.json   (needs: pip install cryptography)

Expected:
| fixture | tamper | expected |
|---|---|---|
| 1 good-control | none | OK: 5 receipts + tip covered |
| 2 modified-amount | cents +1 on receipt 2 | FAIL at that job_id (hash mismatch) |
| 3 broken-prev-hash | prev_hash replaced on receipt 3 | FAIL at that job_id (link break) |
| 4 invalid-signature | sig = 64 zero bytes on receipt 2 | FAIL at that job_id (ed25519) |
| 5 reordered-receipts | receipts 2/3 swapped | FAIL (prev_hash link break) |
| 6 nonascii-field | engine "community" -> "cømmunity" | FAIL (canonical body divergence, ensure_ascii=False does NOT silently pass) |
| 7 uncovered-tip | heads cover only through receipt 4 | FAIL: no head covers tip |

Verified Sep 15: all 7 behave exactly as above.

CI: .github/workflows/receipts-monitor.yml job `badchain-corpus` runs
check_corpus.py on the same schedule as the live monitor and files an issue
if the verifier ever accepts a tampered chain or rejects the good control.
