# COMPUTE-SOLO — Provide keep-alive / advertise≠URLError (PR-mirror)

**When:** 2026-09-07  
**Agent:** Grok Bot  
**Lane:** hop DOWN (`DASHA_SHIP_SKIP_CLAIMS=1`)  
**Worker (already live):** `c1749fba-0abb-4f02-989d-6e5c2e31a0dc`  
**Kit (already live):** sha256 `4f48b0221dded4a6817da3baa1c04cd29b8edd5ec0ecc5771485aa170310edcf`  
**This repo:** PR-mirror only. Do **not** wrangler deploy. Do **not** merge.

## What shipped live

Provide kit + Host skill docs already on the edge:

- **OLLAMA_KEEP_ALIVE=-1** on the Ollama launch agent / service (a shell `export` is not enough on macOS).
- **Advertise ≠ URLError** — heartbeat / `providers_online` can stay up while mid-Ask fails with `provider inference failed: URLError` (localhost Ollama `127.0.0.1:11434` refused/reset). Soft doctor lines do not block advertise alone.
- Host skill: enrolled ≠ advertising already live — never invent Mac counts.
- Doctor soft-warns battery / thermal / SIP when detectable; never fails solely for those; never claims enclave or hardware attestation.

Mirrored into this tree: Provide skill (`PROVIDE.md` + embed + Worker `/compute/skill/provide.md`), Host skill (`OCM-HOST.md` + Worker `/compute/skill/ocm-host.md`), kit `README.md` + `provider/agent.py`.

## Stay off

ocm/ · Room · Arcade · Designer · wrangler · plugin.jup.ag · people-data · TUI-inject
