import json, hashlib, sys, base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
def run(path):
    d=json.load(open(path))
    pub=Ed25519PublicKey.from_public_bytes(
        serialization.load_pem_public_key(d["keys"]["keys"][0]["spki_pem"].encode()).public_bytes(
            serialization.Encoding.Raw,serialization.PublicFormat.Raw))
    prev,n="GENESIS",0
    for r in d["receipts"]:
        body=json.dumps({k:r[k] for k in ("job_id","engine","tokens","cents","at","prev_hash")},separators=(",",":"),ensure_ascii=False)
        h=hashlib.sha256(body.encode()).hexdigest()
        ok = h==r["hash"] and r["prev_hash"]==prev
        try: pub.verify(base64.b64decode(r["sig"]),h.encode())
        except Exception: ok=False
        if not ok: return f"FAIL at {r['job_id']}"
        prev=r["hash"]; n+=1
    tip=d["receipts"][-1]["hash"]
    if not any(h["tip"]==tip for h in d["heads"]): return "FAIL: no head covers tip"
    return f"OK: {n} receipts + tip covered"
if __name__=="__main__":
    print(run(sys.argv[1]))
