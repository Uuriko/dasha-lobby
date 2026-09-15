/**
 * /caps - spend caps page for Dasha Compute.
 * Every fact on this page is enforced server-side in dasha-compute-network.mjs
 * (API_KEY_LIMIT_DEFAULT_CENTS, parseApiKeyLimitCents, parseApiKeyLimitReset,
 * refreshApiKeySpendWindow, 402 on exceed). Static page, no live numbers.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
export const CAPS_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spend caps - Dasha Compute</title>
<meta name="description" content="Every Dasha Compute API key carries its own USD spend cap: $5/month by default, $1-$1,000 or uncapped at key creation, monthly or weekly reset, 402 on exceed. Caps sit on top of prepaid credits.">
<link rel="canonical" href="https://www.getdasha.com/caps">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.getdasha.com/caps">
<meta property="og:title" content="Spend caps - Dasha Compute">
<meta property="og:description" content="Every API key has its own USD spend cap. A runaway script burns the cap, never the account.">
<meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Spend caps - Dasha Compute">
<meta name="twitter:description" content="Every API key has its own USD spend cap. A runaway script burns the cap, never the account.">
<meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<style>
:root{color-scheme:dark}
body{margin:0;background:#0b0b10;color:#e8e8ef;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:28px;margin:24px 0 4px}
h2{font-size:19px;margin:40px 0 8px;padding-top:16px;border-top:1px solid #26262f}
.lede{color:#9a9aa8;margin:0 0 8px}
.fine{color:#8a8a96;font-size:13px;margin:6px 0}
a{color:#9ec1ff}
code,pre{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:#121218;border:1px solid #26262f;border-radius:8px;padding:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.card{background:#121218;border:1px solid #26262f;border-radius:10px;padding:14px 16px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #22222b;color:#c9c9d4}
th{color:#8a8a96;font-weight:600}
</style>
</head>
<body>
<main>
<p class="fine"><a href="/compute">&larr; Dasha Compute</a></p>
<h1>Spend caps.</h1>
<p class="lede">Every Dasha API key carries its own USD spend ceiling. A runaway script burns the cap, never the account.</p>

<h2>1. The default</h2>
<div class="card">
<p>Every new key starts with a <strong>$5 / month</strong> cap. No opt-in, no setup.</p>
</div>

<h2>2. Set at key creation</h2>
<div class="card">
<p>Choose the cap when you make the key on <a href="/compute">/compute</a> (Start &rarr; Build):</p>
<table>
<tr><th>Field</th><th>Values</th></tr>
<tr><td>Spend cap</td><td>$1 &ndash; $1,000 per window, or uncapped</td></tr>
<tr><td>Reset window</td><td>monthly (default) or weekly</td></tr>
</table>
<p class="fine">Anything outside $1&ndash;$1,000 falls back to the $5 default. Uncapped means no per-key ceiling - the prepaid credit balance still applies.</p>
</div>

<h2>3. On exceed: 402, then reset</h2>
<div class="card">
<p>When a key hits its cap, the API answers <code>402 key spend limit reached</code> until the window resets. Spend zeroes at the monthly or weekly rollover and the key works again. Jobs never bill past the cap.</p>
<pre>HTTP/2 402
{"error":"key spend limit reached"}</pre>
</div>

<h2>4. Caps vs credits</h2>
<div class="card">
<p>Credits are the prepaid balance every job draws from (buyer price $0.05 per successful chat completion). A cap is a second, per-key circuit breaker on top of that balance. A 402 from the cap does not mean the account is out of credits - it means this key hit its own ceiling.</p>
</div>

<h2>5. Check a key</h2>
<div class="card">
<p>Signed in on <a href="/compute">/compute</a>, <code>GET /compute/api/keys</code> lists each key with <code>limit_cents</code>, <code>limit_remaining_cents</code>, <code>spend_cents</code>, and <code>limit_reset</code>.</p>
</div>

<p class="fine">Machine-readable packet: <a href="/compute/llms.txt">/compute/llms.txt</a> &middot; API docs: <a href="/compute/api">/compute/api</a> &middot; Live proof: <a href="/compute/proof">/compute/proof</a></p>
</main>
</body>
</html>
`;
