# receipts-chain-monitor

Independent, zero-infra verification of the Dasha Compute receipts chain, run by GitHub Actions every hour in public.

Do not trust us - watch the verifier run. Every hour this workflow:

1. Fetches the public endpoints: `/keys.json`, `/heads`, `/compute/api/chain`, `/heads/checkpoint`, `/compute/api/verify`
2. Recomputes every receipt's SHA-256 hash over the canonical body (`job_id, engine, tokens, cents, at, prev_hash`) and checks `prev_hash` linkage back to `GENESIS`
3. Verifies every ed25519 signature (receipts, heads, checkpoint) against the published signer keys
4. Verifies the signed checkpoint references a real head and the verified chain tip
5. Cross-checks the site's own `/compute/api/verify` verdict against the independently computed one

Hard failure (endpoint down, hash/link/signature mismatch, bad checkpoint) files an issue on this repo automatically. A `SELF-CONSISTENT` result (chain valid but no fresh covering head - normal during quiet hours) warns but does not fail.

Run it yourself:

```bash
pip install pynacl
python3 receipts-monitor/verify.py
```

## Fork your own: audit us from your own account

Don't trust our uptime claims - run our monitor against us.

`receipts-monitor/forkable.yml` is a 50-line, zero-dependency-copy version of this monitor: hourly hash-walk over every receipt plus every Ed25519 signature, then a heads-covers-tip check. It needs nothing from this repo.

1. Copy `receipts-monitor/forkable.yml` into any GitHub repo you control at `.github/workflows/dasha-chain-monitor.yml`
2. Done. It runs hourly at :17 (or Actions -> Run workflow), and opens an issue in YOUR repo if our chain ever fails verification.

No API keys, no account, no secrets - it reads only the public endpoints any client already uses.
