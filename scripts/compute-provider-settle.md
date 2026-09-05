# Compute provider payout settle (v1)

Honest fail-closed path. Worker does **not** auto-chain-send unless `COMPUTE_PAYOUT_KEYPAIR` is set.
Never use the faucet tip key by default. Never pay providers from `CREDIT_DEST` (user top-ups only).

## Env (Worker secrets)

| Secret | Required | Purpose |
|---|---|---|
| `COMPUTE_PAYOUT_SECRET` | yes for operator routes | Gate `GET …/pending` + `POST …/settle` |
| `COMPUTE_PAYOUT_KEYPAIR` | optional | Explicit USDC treasury signer for auto-send only. **Not** `FAUCET_KEYPAIR`. |

If `COMPUTE_PAYOUT_SECRET` is unset → routes return **503** `not configured`.

## Operator flow (manual USDC — default)

1. Set `COMPUTE_PAYOUT_SECRET` on the Worker (`wrangler secret put COMPUTE_PAYOUT_SECRET`).
2. List pending:

```bash
curl -sS 'https://lobby.getdasha.com/compute/api/provider/payouts/pending' \
  -H "Authorization: Bearer $COMPUTE_PAYOUT_SECRET"
# or: -H "x-dasha-payout-secret: $COMPUTE_PAYOUT_SECRET"
```

3. Send USDC from the **compute payout treasury** (separate from faucet tip / CREDIT_DEST):
   - Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
   - Amount raw = `payout_cents * 10_000` (6 decimals; $1.00 = 100¢ = 1_000_000 raw)
   - Dest = row `wallet`
4. Mark paid with the Solana tx signature:

```bash
curl -sS -X POST 'https://lobby.getdasha.com/compute/api/provider/payout/settle' \
  -H "Authorization: Bearer $COMPUTE_PAYOUT_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"payout_id":"payout_…","signature":"<base58 tx sig>"}'
```

Signature shape: base58, 64–128 chars (64-byte tx sig). Replay-safe for the same sig; rejects already-paid / cancelled.

## $dasha method

v1 skips auto-send (needs price oracle). Operator sends `$dasha` (`53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`) manually, then POST settle with signature (mark-paid only).

## Optional Worker auto-send (USDC only)

Only when **both** `COMPUTE_PAYOUT_SECRET` and `COMPUTE_PAYOUT_KEYPAIR` are set:

```bash
curl -sS -X POST 'https://lobby.getdasha.com/compute/api/provider/payout/settle' \
  -H "Authorization: Bearer $COMPUTE_PAYOUT_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"payout_id":"payout_…"}'
# omits signature → Worker SPL-transfers USDC then marks paid
```

Auto-send stays **off** unless `COMPUTE_PAYOUT_KEYPAIR` is explicitly configured.

## UI

Earnings (`#earn`): pending rows show status; paid rows show a quiet Solscan link when `signature` is present.
