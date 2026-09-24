# Compute steal — bit-identical Bonsai pack + residual control

**When:** 2026-09-18  
**Lane:** Compute research + kit hook. No wrangler.  
**Product language:** pack fidelity · adjustable residual control · local Mac.

## What this is

Ternary Bonsai 2 27B is one Community weight download (~5.9 GB, ~1.72 bits/weight). A separate runtime can apply a residual-stream intervention without editing or re-quantizing the pack:

```
y ← y − α (y · r) r
```

`α` default **0** = stock behavior (same pack, no intervention). 129 residual writers (hybrid: MLP + linear-attn + full-attn + embed). Primary path is Apple Silicon / local Mac. Direction was estimated on a BF16 base; QAT transfer is unmeasured here — do not claim a behavior guarantee.

This is **not** a second 27B checkpoint. Catalog honesty: same pack, optional residual control.

## Kit hook (this tree)

Open-alpha provider (`dasha-compute-open-alpha/provider/agent.py`):

- `DASHA_RESIDUAL_ALPHA` optional, default `0`.
- When `DASHA_MODEL_MAP` uses an `openai:` backend **and** the public/local id is Bonsai, the agent passes `residual_alpha` (and runtime `alpha`) as chat extras.
- Provider result/receipt may include `residual_alpha` + `residual_site_count` (129) for A/B honesty.
- Default 0 does **not** enable ablation.

Mac map already used locally (PR #248):

`ternary-bonsai-2-27b=openai:http://127.0.0.1:8080/v1:Ternary-Bonsai-2-27B-PQ2_0`

## Worker / receipt

`publicPhase0Receipt` copies `residual_alpha` (and `residual_site_count` when present) only if the provider reported them on a Bonsai job. Never invent `0` server-side. Never invent a warm probe.

## Catalog

`ternary-bonsai-2-27b` stays in `COMPUTE_CATALOG_MODELS`, license-cleared advertise, leftover picker, and network capacity filters so Instinct can surface a Mac that actually polls it. `gemma3-27b` is not demoted here (#258 waits for live bonsai).

## Honesty

- Not live until Instinct deploy + wrangler tip. This PR does not deploy.
- Mac doctor-green is a local fact; do not invent a warm probe or Ask-ready from this hop.
- Fleet advertise of bonsai is flaky until re-proved on live `/compute/api/network`.
- No hero copy. No Room blend. No people-data. No Phase 0 #8/#9.

## Kit manifest vs published tar (2026-09-18)

Measured, no wrangler from this hop:

| Surface | Live |
|---|---|
| `GET /compute/kit.json` (www + lobby) | `version` **0.3.1**, `sha256` **43df0883a900058320ceca36bf029b82d2495b2f2f17086495d31219cc3fec24** |
| `GET /dasha-compute-open-alpha.tar.gz` | **33433** bytes, sha256 **4f48b0221dded4a6817da3baa1c04cd29b8edd5ec0ecc5771485aa170310edcf** |
| Inside that tar | `package.json` **0.3.0**, no `VERSION` file, agent has no `openai:` backend / no `DASHA_RESIDUAL_ALPHA` |

Tip `VERSION` is 0.3.2 (residual + openai: map). Advertising 0.3.2 on `kit.json` before ASSETS is packed is why a Mac can soft-warn “kit v0.3.2 available” while live `kit.json` still says 0.3.1 and the gzip is the 0.3.0 tree.

This PR aligns `COMPUTE_KIT_JSON` / `COMPUTE_KIT_MANIFEST` to the **published tar bytes** (`0.3.0` / `4f48b022…`). Residual-α=0 stays in git only until Instinct packs `dasha-worker-assets` and bumps the manifest in the same deploy. `*.tar.gz` is gitignored — this hop does not invent a packed archive.

## Stay-outs

Unchanged: no wrangler, no Designer-publish, no Jupiter plugin host, no CUDA claim for this MLX pack, no re-quant fork of the pack.
