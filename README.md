# dasha-lobby

Live Cloudflare Worker for [getdasha.com](https://www.getdasha.com) (lobby, compute, faucet, chess, privacy, …).

Mirrored from Grok Bot’s ship tree after wrangler deploys. **Production deploys still go Cloudflare-first**; this repo is the GitHub mirror.

## Deploy

```bash
npx wrangler@3.114.15 deploy --keep-vars -c dasha-lobby-wrangler.deploy.jsonc
```

Worker name: `dasha-lobby`. Never commit secrets (`.dev.vars`, payout keys, OAuth secrets).

## Compute

Product: https://www.getdasha.com/compute  
OSS companion (OCM / Mac provider): [Uuriko/dasha-desk](https://github.com/Uuriko/dasha-desk)

## Assets

Large Worker media (`grwm` mp4, simp photos, open-alpha tarball) stay on the Cloudflare Worker / R2 and are gitignored here.

## Stay off

Designer-publish · `plugin.jup.ag` · rewriting Graham OCM `#44` from this tree
