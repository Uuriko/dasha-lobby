# Embedded verified Compute archive

The versioned URL and current CTA/metadata from PR310 remain unchanged. The exact reviewed272939byte public archive is embedded as base64 and decoded locally, with byte count and SHA-256 checked before responding. No runtime network request, redirect option, or AbortSignal is involved. This avoids the live503: workerd rejects the prior `fetch` option `redirect:'error'`, although Node accepted it.

Archive SHA706918197b633929b8963a27978bfab7dec5ed715fd8a83f32f04aa0d2152386 matches attested dasha-desk PR251. Base64 source is generated from those bytes; never edit it manually.

Reproduce with `python3 releases/2026-09-24-kit-embedded/build-candidate.py`. The transformation input is reviewed PR310 candidate30c56840…. The upload manifest instead fences rollback baseline8f6c266d…: root restored that coherent runtime while this fix was prepared. Preserve all existing assets/bindings/settings; do not change asset routing or upload a partial asset directory.

Validation:3 embedded identity/corruption/HEAD tests,27 existing candidate runtime tests, candidate download/CTA verification on both hostnames, and `verify-workerd.mjs` using Miniflare4.20260730.0 at compatibility date2026-08-06 with no flags. Its thin default-export entry shim imports the unchanged candidate, avoiding legacy test-only named exports as entrypoints. Outbound service is configured to throw; both hostnames still return200 with exact archive bytes and correctHEAD/kitmetadata.

Run `node releases/2026-09-24-kit-embedded/verify-workerd.mjs /absolute/path/to/miniflare/dist/src/index.js`. Root must verify actual public bytes after deployment; no successful upload alone proves a release.
