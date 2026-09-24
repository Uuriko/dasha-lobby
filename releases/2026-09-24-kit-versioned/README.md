# Versioned Compute kit release

The public archive, checksum and release manifest live under `/compute/releases/706918197b63/`. `/compute/kit.json` points to that archive. Current page links, setup commands, embedded skills, compatibility redirects, and coordinator kit-signature metadata use its URL and SHA. Archive filenames and extraction commands remain unchanged.

The existing root archive/sidecar and `/compute/release.json` remain legacy ASSETS URLs. They are not evidence of the new release. Do not delete or replace the incomplete local asset set to update them.

Why versioned paths: original version ee12ad10, reconciliation f61b6174, kit60edc20b and routing-attempt d39fffea all reported `resources.script_runtime.assets={serve_directly:true,base_path:"/"}`. The attempted `keep_assets:true` plus five-path `assets.config` upload did not change that configuration. These new paths avoid existing asset collisions without another speculative configuration write. No source routing config change is included.

Reproduce: `python3 releases/2026-09-24-kit-versioned/build-candidate.py`. It fences the exact deployed7e7b783b… bundle, replaces only the release handler, current download URLs and corresponding kit manifest hashes, preserving other live-only code. Root must upload this candidate with all existing assets, bindings and settings retained. No migrations or route/config changes.

Tests: `node --test dasha-compute-download.test.mjs` (3), `node releases/2026-09-24-kit-versioned/verify.mjs` (27 preserved runtime tests), and `node releases/2026-09-24-kit-versioned/verify-download.mjs` (actual pinned upstream archive/metadata and current CTA verification on both hostname handlers). The archive is272939bytes, SHA706918197b633929b8963a27978bfab7dec5ed715fd8a83f32f04aa0d2152386, from merged dasha-desk PR251. Package version remains0.3.0; existing providers need a reinstall for these changes.

After deployment verify the versioned archive's actual bytes and both versioned metadata files, `/compute/kit.json`, current `/compute` links and an unrelated existing asset on both www and lobby. A successful upload is not sufficient evidence that the public archive changed.
