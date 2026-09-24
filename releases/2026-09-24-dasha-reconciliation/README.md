# Reconciled Dasha Worker candidate

This is a recovered deployment artifact, not a claim that the ordinary source
checkout reproduces every deployed feature. Do not deploy the ordinary Worker
entry over production while this source gap remains.

Production includes provider engine/fleet statistics and pricing/try-it UI that
are absent from git main. Git main includes security fixes missing from that
production bundle. `worker.mjs` combines both using a clean three-way merge:

1. Baseline source commit `10c080d`, built with Wrangler 3.114.15 and
   `dasha-lobby-wrangler.deploy.jsonc --dry-run`.
2. Live `dasha-lobby-worker.mjs` module downloaded through the authenticated
   Cloudflare script API. No credentials or Worker settings are included here.
3. Main `d50fb98`, plus this PR's small settlement-recovery source fix, built
   with the same Wrangler command.

`manifest.json` pins all input and output bytes. The sole normalization replaces
one build-directory source comment. `live-to-candidate.diff` shows the deploy
change without the unchanged recovered bundle. The three-way merge preserves
live fleet/engine/uptime/job statistics, model catalog and compute interfaces,
while adding durable guest limits, gateway-capped usage review, protected hosted
factory settlement, faucet rendering fixes and current route aliases.

The additional source fix separates usage-review acceptance from completed
settlement. After interruption, retry completes idempotent settlement instead of
incorrectly reporting a completed replay. It does not expose a new operator route.

## Reproduce and verify

Build the baseline in an isolated checkout and the PR source in its checkout:

```sh
node /path/to/wrangler-3.114.15/bin/wrangler.js deploy --dry-run \
  --outdir /private/baseline-build -c dasha-lobby-wrangler.deploy.jsonc
# Repeat from the PR checkout using a separate main-build output directory.
python3 releases/2026-09-24-dasha-reconciliation/reproduce.py \
  /private/live-worker.mjs /private/baseline-build/dasha-lobby-worker.js \
  /private/main-build/dasha-lobby-worker.js /private/reproduced.mjs
node releases/2026-09-24-dasha-reconciliation/verify.mjs
```

The verification adapter exposes tree-shaken test symbols without replacing their
runtime implementations, then runs six existing suites against the actual
candidate: usage review (including crash recovery), forged factory settlement,
hosted and community streaming usage, durable guest limits, and full Worker
routing/UI audit. Source-string assertions in those suites still inspect the
maintainable source files; runtime calls inspect the candidate.

Additional local verification rendered `/compute` at 390px and 1365px with no
page errors or horizontal overflow in an isolated offline browser. Candidate
`/compute`, `/compute/proof`, `/benchmarks` return 200; new benchmark/factory
aliases return the expected 308. This is not a real account/payment test.

## Release boundary

No upload is performed by these scripts. The release owner must independently
review the exact candidate and recheck the live input hash before upload. If
production changed, stop and reconcile again. Preserve current secrets,
non-secret settings, routes, Durable Object bindings/migrations and asset set;
do not replace them with defaults from an old configuration. Existing source-map
comments identify a prior build map and are not evidence of restored source.

After activation, recover the original feature source from its owner and fold
these changes into ordinary modules. Keep the manifest as the release receipt.
