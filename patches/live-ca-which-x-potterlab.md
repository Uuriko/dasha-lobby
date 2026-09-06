# Live leftover: /ca → /which, /x → @potterlab

Proved against **live** www on 2026-09-06:

```
GET https://www.getdasha.com/ca       → 308 https://www.getdasha.com/bag     WRONG
GET https://www.getdasha.com/x        → 308 https://x.com/dash_eats         WRONG
GET https://www.getdasha.com/verify   → 308 https://www.getdasha.com/which  OK
```

Home HTML has **no** `#which-door` and **no** official Telegram.
Chess still ships the unescaped regex:

```js
return /^/chess/(challenge|queue|tournament)/.test(path)
```

## Do not merge #63 as-is

Draft [PR #63](https://github.com/Uuriko/dasha-lobby/pull/63) mirrors Worker `8266782e` leftover that moved `/ca` onto `/bag`. `/contract` `/holder` `/holders` can stay `/bag`. **`/ca` is identity** (dash_eats vs VVAIFU). Traders who type `/ca` must land on `/which`.

GitHub `main` already has `/ca` in `POTTER_WHICH_308_PATHS` (#57). Live does not — live has the bag leftover **on top of** an older leftover that never got #57/#60.

## Apply on the live Grok Bot ship tree

Assets are not in git. Do not wrangler from a clean clone. Do not Designer-publish.

### 1. Which leftover

`POTTER_WHICH_308_PATHS` must include:

```js
'/ca', '/ca/',
```

Remove `'/ca', '/ca/'` from any bag set / `/ca` → `/bag` branch. Keep:

```js
'/contract', '/contract/',
'/holder', '/holder/',
'/holders', '/holders/',
```

→ `/bag`.

### 2. Official X leftover

```js
if (p === '/x' || p === '/x/' || p === '/twitter' || p === '/twitter/') {
  return 'https://x.com/potterlab';
}
```

Not `https://x.com/dash_eats`. `@dash_eats` is culture, not the coin account.

### 3. Home doors (#60)

Mount before simp-door:

```html
<section id="which-door" aria-labelledby="which-title"><div class="wrap door"><div><p class="section-kicker">dash_eats</p><h2 class="section-title" id="which-title">Which $dasha?</h2><p class="door-line">This mint. Not VVAIFU.</p></div><a class="pill primary" href="/which">This mint</a></div></section>
<section id="tg-door" aria-labelledby="tg-title"><div class="wrap door"><div><p class="section-kicker">Telegram</p><h2 class="section-title" id="tg-title">The one group.</h2><p class="door-line">Official room only.</p></div><a class="pill primary" href="https://t.me/+xB7S8mIQaKFiZjRh" target="_blank" rel="noopener noreferrer">Open Telegram</a></div></section>
```

### 4. Chess parse (#57)

```js
return /^\/chess\/(challenge|queue|tournament)/.test(path)
```

### Deploy

```bash
npx wrangler@3.114.15 deploy --keep-vars -c dasha-lobby-wrangler.deploy.jsonc
```

### Prove

```bash
curl -sSI https://www.getdasha.com/ca
# 308 Location: https://www.getdasha.com/which

curl -sSI https://www.getdasha.com/x
# 308 Location: https://x.com/potterlab

curl -sS https://www.getdasha.com/ | grep -E 'which-door|t.me/\+xB7S8mIQaKFiZjRh'

curl -sS https://www.getdasha.com/chess | grep -F 'return /^\/chess\/(challenge|queue|tournament)/'
```

Mint `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`. Official TG `https://t.me/+xB7S8mIQaKFiZjRh`. Never plugin.jup.ag.
