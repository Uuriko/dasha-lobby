# Immutable Compute download release

Depends on reviewed dasha-desk PR251 and production reconciliation PR308. Do not deploy before both merge. Root owns deployment.

Public kit surfaces currently serve an older asset archive. This candidate intercepts only the archive, checksum, release manifest, and kit manifest after the existing HTTPS redirect. It pins dasha-desk commit06792c184460ae0032048b20a6a60b3b1549b52b (an ancestor of PR251) and verifies the entire archive against its reviewed size and SHA-256. No incoming credentials or query parameters reach GitHub. Upstream errors or byte/hash mismatches return503, never an older mismatched archive. Other routes and the full ASSETS binding remain unchanged.

The version remains0.3.0 because that is the actual package version; the SHA identifies this release. Automatic version-only updaters will not infer an upgrade. Reinstall the new archive to obtain the fixes.

Reproduce with `python3 releases/2026-09-24-kit-download/build-candidate.py`. It fences the deployed PR308 baseline and adds the exact checked-in helper and metadata to its preserved bundle. Ordinary source is updated too, but still lacks older live-only source; do not use an ordinary source deployment.

Checks: `node --test dasha-compute-download.test.mjs` and `node releases/2026-09-24-kit-download/verify.mjs`. The latter repeats existing27 runtime cases against this candidate. Actual candidate HTTP tests also fetched the pinned public archive, verified272939 bytes/SHA706918197b633929b8963a27978bfab7dec5ed715fd8a83f32f04aa0d2152386, checked all metadata paths and the preserved HTTP→HTTPS308.

The private root upload helper can use this worker and manifest with the same fresh live-hash/settings fences, keep_assets and keep_bindings. Do not upload a partial assets directory. After upload, download all four public paths and verify the exact archive SHA and matching manifests; verify another asset and `/compute` still work.
