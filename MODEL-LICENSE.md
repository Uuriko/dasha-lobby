# Compute model license ladder

Dasha Compute advertises a weight on Provide / Ask only after commercial-serve is explicit.

**Ladder:** community bench → license clear → Provide advertise → Ask route.

This is the motion from the Darkbloom / Gajesh note (2026-09-17): the community can make a model faster; we still hold launch until the license allows commercial serving. Dasha copy stays ours. Do not paste Eigen / Darkbloom brand, and do not invent agreement outcomes.

## Status

| Status | Meaning | Public face |
|---|---|---|
| `cleared` | Commercial serve allowed for this id | May appear on `/compute/api/network` `models_available`, `/v1/models`, Provide allow-list, Ask picker |
| `held` | Bench / research only; grant missing or pending | Never advertise. Never route as a catalog SKU |
| `unknown` | No row | Fail closed — same as held |

Code: `dasha-compute-model-license.mjs` (`canAdvertiseModel`, `filterAdvertisableModels`). `growAllowedModels`, register/enroll, network advertise, and `/v1/models` all go through that check.

## Live catalog (cleared)

These ids are already on getdasha.com/compute and stay advertisable until a human marks a hold:

- `qwen3-4b` · `qwen3-8b` · `qwen3-30b-a3b` — Qwen3 Apache-2.0
- `gemma3-12b` · `gemma3-27b` — Gemma Terms
- `gpt-oss-20b` · `gpt-oss-120b` — Apache-2.0
- `ternary-bonsai-2-27b` — community weight already on the live catalog
- `qwen3.5-4b` · `qwen3.5-9b` — Qwen3.5 Apache-2.0 (verified 2026-09-19)
- `gemma4-e2b` · `gemma4-26b-a4b` — Gemma 4 Apache-2.0 (verified 2026-09-19)
- `muse-glimmer-30b` — Meta Muse Glimmer Apache-2.0 (verified 2026-09-19)
- `qwen3.8-27b` · `qwen3.6-35b` — Qwen3.8 / Qwen3.6 Apache-2.0 (verified 2026-09-19; Splash packages exist, beta)

## Held (do not advertise)

- `qwen3.8-flash` (and aliases) — community MLX bench. Qwen 3.8 Flash commercial-serve agreement status is **UNKNOWN**. Hold until a signed grant exists. Then flip the row to `cleared` and only then add the id to the worker catalog / picker.
- `lfm2.5-8b-a1b` — Liquid AI LFM2.5. License is **LFM Open License v1.0** (custom, not Apache-2.0). Read the actual terms before commercial-serve; held until then.

Do not add a held id to `MODELS` / the Ask picker “to preview.” Preview lives in benches, not Provide/Ask.

## How to add a community weight

1. Bench on a first-party Mac (tok/s, RAM, doctor). Record the bench; do not advertise.
2. Read the weight’s license. If commercial serving needs a separate agreement, stop.
3. When the grant is in hand, add a `cleared` row here and in `MODEL_LICENSE`, then add the catalog id.
4. Provide kit `DASHA_MODEL_MAP` + Ask picker follow the catalog. Heartbeats still cannot grow an unlicensed id.

## Honesty

- No Darkbloom fleet counts, ARR, or $/machine on getdasha.com.
- No “experimental only” wall on first paint. The gate lives in code + this doc + a quiet model/Provide line.
- Room / lobby stays separate. Compute does not grow people-data.
