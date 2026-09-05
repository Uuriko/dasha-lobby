# Darkbloom `/v1/stats` delta — 2026-09-04 ~6:41 PM PT

**Source:** `GET https://api.darkbloom.dev/v1/stats` (live curl succeeded)  
**Priors:** COMPUTE-DEEP-WIDE (~3:05 PM PT) · COMPUTE-RESEARCH-V4 (~5:07 PM PT)

| Metric | ~3:05 PM PT | ~5:07 PM PT (V4) | **This fetch ~6:41 PM PT** |
|---|---|---|---|
| `active_providers` | 1,239 | ~1,220 | **1,212** |
| `code_attested_providers` | 995 (~80%) | ~968 (~79%) | **758 (~62%)** |
| last_24h requests | ~3.13M | ~3.23M | **3,211,537** |
| last_24h total tokens | ~10.55B | ~10.89B | **~10.86B** |
| network util | ~4.1% | ~3.3% | **~8.0%** |
| capacity tok/s | ~19.2k | ~18.8k | **~14.5k** |
| queued_requests | — | 0 | **0** |
| active_requests | — | — | **259** |
| bottleneck_model | — | — | `gemma-4-26b-qat-4bit` |

**Read:** Fleet size flat/soft-cool; **attestation count dropped hard** vs afternoon (758 vs ~968) — treat as Darkbloom-side signal / measurement churn, not Dasha action. Util up to ~8% while capacity down — still **supply ≫ demand**. Hot provider counts: `gpt-oss-20b` 624, `gemma-4-26b-qat-4bit` 561, `qwen3.6-35b-a3b-vl-mtp-mxfp8` 755.

**Implication unchanged:** don’t chase provider-count theater; keep chat + credits honesty while peer util is thin.
