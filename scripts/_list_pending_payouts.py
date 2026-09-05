from pathlib import Path
import urllib.request
secret = Path("/home/box/secrets/COMPUTE_PAYOUT_SECRET").read_text().strip()
req = urllib.request.Request(
  "https://lobby.getdasha.com/compute/api/provider/payouts/pending",
  headers={"Authorization": f"Bearer {secret}", "User-Agent": "Mozilla/5.0"},
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("HTTP", r.status)
        print(r.read().decode()[:3000])
except Exception as e:
    if hasattr(e, "code"):
        print("HTTP", e.code)
        print(e.read().decode()[:3000])
    else:
        print("ERR", type(e).__name__, e)
