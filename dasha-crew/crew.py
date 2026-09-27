#!/usr/bin/env python3
"""Dasha Crew — five jobs. You keep the keys. Public HTTP/RPC only."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump"
PAIR = "9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7"
WSOL = "So11111111111111111111111111111111111111112"
BUY = f"https://jup.ag/swap?sell={WSOL}&buy={MINT}"
TG = "https://t.me/+xB7S8mIQaKFiZjRh"
DEX = f"https://api.dexscreener.com/latest/dex/pairs/solana/{PAIR}"
LIVE_ONCE = "https://www.getdasha.com/crew/api/once"
LIVE_LOG = "https://www.getdasha.com/crew/api/log"
ROOT = Path(__file__).resolve().parent
UA = "dasha-crew-kit"

def load_env():
    path = ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))

def get(url, timeout=8):
    req = urllib.request.Request(url, headers={"accept": "application/json", "user-agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.getcode(), res.read()

def head_or_get(url, timeout=6):
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"user-agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return int(res.getcode())
        except Exception:
            continue
    return 0

def load_prompt(name):
    path = ROOT / "prompts" / f"{name}.txt"
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""

def agent(id_, name, job, vote, note):
    return {
        "id": id_,
        "name": name,
        "job": job,
        "vote": vote,
        "note": note,
        "prompt": load_prompt(id_),
    }

def tape():
    try:
        code, raw = get(DEX)
        data = json.loads(raw.decode("utf-8"))
        pair = (data.get("pair") or data.get("pairs") or [None])
        if isinstance(pair, list):
            pair = next((row for row in pair if row and row.get("pairAddress") == PAIR), None)
        if not pair or str(pair.get("baseToken", {}).get("address") or "") != MINT:
            # dexscreener pair endpoint returns {pair: {...}}
            if isinstance(data.get("pair"), dict):
                pair = data["pair"]
            if not pair:
                return None
        if str(pair.get("baseToken", {}).get("address") or pair.get("baseToken") or "") not in (MINT, ""):
            if pair.get("pairAddress") != PAIR:
                return None
        change = pair.get("priceChange") or {}
        txns = pair.get("txns") or {}
        h24 = txns.get("h24") or {}
        return {
            "priceUsd": float(pair.get("priceUsd") or 0) or None,
            "liquidityUsd": float((pair.get("liquidity") or {}).get("usd") or 0) or None,
            "volume24hUsd": float((pair.get("volume") or {}).get("h24") or 0) or None,
            "changeH1": num(change.get("h1")),
            "changeH24": num(change.get("h24")),
            "buys24": int(h24.get("buys") or 0),
            "sells24": int(h24.get("sells") or 0),
        }
    except Exception:
        return None

def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def holders(rpc):
    if not rpc:
        return None
    body = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenLargestAccounts",
        "params": [MINT, {"commitment": "confirmed"}],
    }).encode("utf-8")
    req = urllib.request.Request(
        rpc,
        data=body,
        headers={"content-type": "application/json", "user-agent": UA},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            data = json.loads(res.read().decode("utf-8"))
        rows = (((data.get("result") or {}).get("value")) or [])
        return len(rows)
    except Exception:
        return None

def verdict(agents):
    votes = {row["id"]: row["vote"] for row in agents}
    if votes.get("clock") == "sit":
        return "sit"
    if votes.get("scout") == "sit" or votes.get("trace") == "sit":
        return "sit"
    if votes.get("scout") == "yes" and votes.get("trace") == "yes" and votes.get("vibe") == "yes" and votes.get("clock") == "yes":
        return "yes"
    return "no"

def once():
    load_env()
    snap = tape()
    top = holders(os.environ.get("SOLANA_RPC_URL", "").strip())
    lobby = head_or_get("https://www.getdasha.com/lobby")
    simp = head_or_get("https://www.getdasha.com/simp")
    tg = head_or_get(TG)

    if not snap or not snap.get("priceUsd"):
        scout = agent("scout", "Scout", "$dasha tape only", "sit", "No tape.")
        trace = agent("trace", "Trace", "public holders / flow", "sit", "No flow without tape.")
        clock = agent("clock", "Clock", "sit if the tape is dumping", "sit", "No tape.")
    else:
        note = f"price {snap['priceUsd']} · liq {snap['liquidityUsd']} · vol24 {snap['volume24hUsd']} · 1h {snap['changeH1']}% · 24h {snap['changeH24']}%"
        scout = agent("scout", "Scout", "$dasha tape only", "yes", note)
        flow = f"buys24 {snap['buys24']} · sells24 {snap['sells24']}"
        if top is not None:
            flow += f" · top accounts {top}"
        live_flow = (snap["buys24"] + snap["sells24"]) > 0 or (top or 0) > 0
        trace = agent("trace", "Trace", "public holders / flow", "yes" if live_flow else "sit", flow if live_flow else "No public flow.")
        dump = (snap["changeH1"] is not None and snap["changeH1"] <= -5) or (snap["changeH24"] is not None and snap["changeH24"] <= -15)
        clock = agent(
            "clock",
            "Clock",
            "sit if the tape is dumping",
            "sit" if dump else "yes",
            "Dump. Sit." if dump else f"1h {snap['changeH1']}% · 24h {snap['changeH24']}%",
        )

    rooms = []
    if lobby == 200:
        rooms.append("lobby")
    if tg == 200:
        rooms.append("tg")
    vibe = agent(
        "vibe",
        "Vibe",
        "lobby / @dash_eats",
        "yes" if lobby == 200 and simp == 200 else "sit",
        (" · ".join(rooms) + " · @dash_eats") if rooms else "Rooms quiet.",
    )
    kill = agent("kill", "Kill", "default no", "no", "No.")

    card = {
        "agents": [scout, trace, vibe, clock, kill],
        "verdict": verdict([scout, trace, vibe, clock, kill]),
        "mint": MINT,
        "pair": PAIR,
        "buy": BUY,
        "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    return card

def main(argv):
    cmd = (argv[1] if len(argv) > 1 else "once").lower()
    if cmd in {"-h", "--help", "help"}:
        print("usage: python3 crew.py once|log")
        return 0
    if cmd == "log":
        try:
            _, raw = get(LIVE_LOG)
            print(raw.decode("utf-8"))
            return 0
        except Exception:
            print(json.dumps({"cards": [once()]}, indent=2))
            return 0
    if cmd != "once":
        print("usage: python3 crew.py once|log", file=sys.stderr)
        return 2
    print(json.dumps(once(), indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
