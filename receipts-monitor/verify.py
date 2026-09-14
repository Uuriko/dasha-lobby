#!/usr/bin/env python3
"""Dasha receipts chain independent verifier.

Fetches the public endpoints and independently recomputes:
  1. receipt hash + prev_hash linkage + ed25519 signature for every receipt
  2. heads log hash/link/signature chain
  3. the signed checkpoint (format, signature, head + chain-tip references)
  4. cross-checks the site's own /compute/api/verify verdict

Exit 0 = chain verifies (ANCHORED or SELF-CONSISTENT; the latter warns).
Exit 1 = any hard failure (endpoint down, hash/link/sig mismatch, bad checkpoint).
"""
import base64, hashlib, json, sys, time, urllib.request

BASE = "https://www.getdasha.com"
FRESH_MS = 3600_000  # 1h, mirrors HEAD_MAX_AGE_MS

def fetch(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "dasha-receipts-monitor/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

def sha256hex(s):
    return hashlib.sha256(s.encode()).hexdigest()

def canon_receipt(r):
    body = {
        "job_id": None if r.get("job_id") is None else str(r.get("job_id")),
        "engine": str(r.get("engine") or ""),
        "tokens": max(0, int(float(r.get("tokens") or 0))),
        "cents": max(0, int(float(r.get("cents") or 0))),
        "at": (max(0, int(float(r.get("at") or 0))) or None),
        "prev_hash": str(r.get("prev_hash") or "GENESIS"),
    }
    return json.dumps(body, separators=(",", ":"), ensure_ascii=False)

def canon_head(h):
    body = {
        "ts": int(float(h.get("ts") or 0)),
        "tip": str(h.get("tip") or ""),
        "prev_head_hash": str(h.get("prev_head_hash") or "GENESIS"),
    }
    return json.dumps(body, separators=(",", ":"), ensure_ascii=False)

def raw_from_pem(pem):
    der = base64.b64decode("".join(l for l in pem.splitlines() if "-----" not in l))
    return der[-32:]

def ed_verify(sig_b64, msg_bytes, raw_pub):
    from nacl.signing import VerifyKey
    try:
        VerifyKey(raw_pub).verify(msg_bytes, base64.b64decode(sig_b64))
        return True
    except Exception:
        return False

def main():
    failures, warns = [], []
    try:
        keys = fetch("/keys.json")
        heads = fetch("/heads")
        chain = fetch("/compute/api/chain").get("receipts") or []
        checkpoint = fetch("/heads/checkpoint")
        site_verdict = fetch("/compute/api/verify").get("verdict") or {}
    except Exception as e:
        print(f"FAIL: endpoint fetch error: {e}")
        return 1

    pem_by_id = {k["id"]: k["spki_pem"] for k in keys.get("keys", [])}
    raw_by_id = {k: raw_from_pem(v) for k, v in pem_by_id.items()}

    # 1. receipts chain
    prev = "GENESIS"
    for r in chain:
        rid = r.get("job_id") or r.get("id") or "?"
        if str(r.get("prev_hash") or "") != prev:
            failures.append(f"chain break at {rid}")
            break
        h = sha256hex(canon_receipt(r))
        if h != r.get("hash"):
            failures.append(f"hash mismatch at {rid}")
            break
        raw = raw_by_id.get(r.get("signer"))
        if not raw:
            failures.append(f"unknown signer {r.get('signer')} at {rid}")
            break
        if not ed_verify(r.get("sig", ""), h.encode(), raw):
            failures.append(f"bad sig at {rid}")
            break
        prev = r["hash"]
    tip = prev
    print(f"receipts: {len(chain)} verified, tip {tip[:16]}...")

    # 2. heads log
    hprev, first = "GENESIS", True
    for hd in heads:
        hp = str(hd.get("prev_head_hash") or "GENESIS")
        if not first and hp != "GENESIS" and hp != hprev:
            failures.append(f"heads chain break at ts {hd.get('ts')}")
            break
        hh = sha256hex(canon_head(hd))
        if hh != hd.get("hash"):
            failures.append(f"head hash mismatch at ts {hd.get('ts')}")
            break
        raw = raw_by_id.get(hd.get("signer"))
        if not raw or not ed_verify(hd.get("sig", ""), hh.encode(), raw):
            failures.append(f"head bad sig at ts {hd.get('ts')}")
            break
        hprev, first = hd["hash"], False
    print(f"heads: {len(heads)} verified")

    # 3. checkpoint
    cp = checkpoint.get("checkpoint") or {}
    text, csig = cp.get("text", ""), cp.get("sig", "")
    lines = text.split("\n")
    if not (text.startswith("dasha-checkpoint-v1\n") and len(lines) >= 6):
        failures.append("checkpoint text malformed")
    else:
        csigner, cts, chead, ctip = lines[1], lines[2], lines[3], lines[4]
        raw = raw_by_id.get(csigner)
        if not raw or not ed_verify(csig, text.encode(), raw):
            failures.append("checkpoint bad sig")
        elif chead not in [h.get("hash") for h in heads]:
            failures.append(f"checkpoint head {chead[:12]} not in heads log")
        elif ctip != tip:
            failures.append(f"checkpoint chain tip {ctip[:12]} != verified tip {tip[:12]}")
        else:
            print(f"checkpoint: sig ok, head {chead[:12]}, tip {ctip[:12]}, ts {cts}")

    # 4. verdict cross-check + freshness
    covering = [h for h in heads if h.get("tip") == tip]
    if not covering:
        verdict, why = "SELF-CONSISTENT", "tip not covered by any head yet"
    else:
        newest = max(float(h.get("ts") or 0) for h in covering)
        age = time.time() * 1000 - newest
        if age > FRESH_MS:
            verdict, why = "SELF-CONSISTENT", f"freshest covering head {int(age/60000)}min old"
        else:
            verdict, why = "ANCHORED", f"tip covered by head {int(age/1000)}s old"
    print(f"computed verdict: {verdict} ({why})")
    print(f"site verdict:     {site_verdict.get('tier')} ({site_verdict.get('why')})")
    if site_verdict.get("tier") and site_verdict["tier"] != verdict:
        warns.append(f"site tier {site_verdict['tier']} != computed {verdict}")
    if verdict != "ANCHORED":
        warns.append(f"not ANCHORED: {why}")

    for w in warns:
        print(f"WARN: {w}")
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("RESULT: chain verifies" + (" (anchored)" if verdict == "ANCHORED" else " (self-consistent)"))
    return 0

if __name__ == "__main__":
    sys.exit(main())
