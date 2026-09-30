/**
 * /compute/how-agents-pay-for-inference - how agents pay for GPU inference.
 * Four payment models (prepaid credits with per-key caps, metered keys, x402
 * per-request, token packs), the signed receipt chain differentiator, a worked
 * guest-key example with the honest caveat (guest receipts do not land on the
 * public settled chain - checked live Sep 29 2026), honest constraints, FAQ.
 * Static page; claims dated Sep 29 2026 and checked against live llms.txt,
 * /caps, and the public npm skill that day. No plugin.jup.ag. No people-data.
 */
export const HOW_AGENTS_PAY_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>How AI agents pay for GPU inference - Dasha Compute</title>
<meta name="description" content="Prepaid credits, metered keys, x402 per-request payments, and token packs - how agents actually pay for GPU inference, and what proof exists that the money bought the claimed compute.">
<link rel="canonical" href="https://www.getdasha.com/compute/how-agents-pay-for-inference">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.getdasha.com/compute/how-agents-pay-for-inference">
<meta property="og:title" content="How AI agents pay for GPU inference - Dasha Compute">
<meta property="og:description" content="The four payment models for agent inference, and the receipt question: billing says what you paid; receipts say what ran.">
<meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="How AI agents pay for GPU inference - Dasha Compute">
<meta name="twitter:description" content="The four payment models for agent inference, and the receipt question: billing says what you paid; receipts say what ran.">
<meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebPage","name":"How AI Agents Pay for GPU Inference","url":"https://www.getdasha.com/compute/how-agents-pay-for-inference","dateModified":"2026-09-29","about":{"@type":"Thing","name":"AI agent inference billing"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
{"@type":"Question","name":"Do agents need accounts to run inference?","acceptedAnswer":{"@type":"Answer","text":"Not always. x402 endpoints take per-request USDC payment with no account. Dasha Compute guest keys are minted by a single POST (no signup), last 24 hours, cover chat and models, and are limited to 3 mints per hour per IP, per the public compute llms.txt as of September 29, 2026."}},
{"@type":"Question","name":"What is the cheapest way to let an agent run one job?","acceptedAnswer":{"@type":"Answer","text":"A Dasha Compute guest key carries free starter cents, so one small job can cost nothing and no account is needed. x402 pays per call in USDC, so there is no minimum but every call costs. For anything repeated, a prepaid key with a spend cap is the controlled option."}},
{"@type":"Question","name":"Can I verify a job without trusting the provider?","acceptedAnswer":{"@type":"Answer","text":"For integrity and origin, yes: Dasha Compute publishes a signed receipt chain - sha256 canonical bodies, ed25519 signatures, prev_hash linkage - and a public verify endpoint anyone can check without an account. For independent re-execution of the model output, no: no provider offers that cheaply today. Provider-signed proves the receipt was not altered and came from the operator; it does not prove the tokens were computed honestly."}},
{"@type":"Question","name":"Does Dasha Compute support x402?","acceptedAnswer":{"@type":"Answer","text":"No, as of September 29, 2026. Dasha Compute uses prepaid keys with per-key USD spend caps instead: every key carries its own ceiling ($5/month default, $1-$1,000 or uncapped at creation, monthly or weekly reset), and the API answers 402 when the key hits its cap."}}
]}
</script>
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
code{background:#121218;border:1px solid #26262f;border-radius:4px;padding:1px 5px}
pre{background:#121218;border:1px solid #26262f;border-radius:8px;padding:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.card{background:#121218;border:1px solid #26262f;border-radius:10px;padding:14px 16px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:13px;margin:12px 0}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #22222b;color:#c9c9d4;vertical-align:top}
th{color:#8a8a96;font-weight:600}
dl{margin:12px 0}
dt{font-weight:600;margin-top:10px}
dd{margin:2px 0 0 0;color:#9a9aa8}
.qa p{margin:4px 0 14px}
footer{margin-top:44px;padding-top:16px;border-top:1px solid #26262f;color:#8a8a96;font-size:13px}
</style>
</head>
<body>
<main>
<p class="fine"><a href="/compute">&larr; Dasha Compute</a></p>
<h1>How AI agents pay for GPU inference.</h1>
<p class="lede">Agents do not pay GPUs directly. They spend against a budget a principal set up - prepaid credits, metered keys, or per-request machine payments. The interesting question is what proof exists that the money bought the claimed compute.</p>
<p class="fine">Last checked September 29, 2026</p>

<h2>The short answer</h2>
<p>Four models cover the market: a funded account balance the agent draws on with a scoped key, metered billing that invoices the account after the fact, per-request machine payment where the endpoint itself asks for money, and prepaid packs bought over crypto rails. They differ on who holds the risk and what the agent needs before its first call. They also differ on what you can check afterward - and that is where most providers stop at an invoice.</p>

<h2>The four payment models</h2>
<table>
<tr><th>Model</th><th>How it works</th><th>Who uses it</th><th>Proof you get</th></tr>
<tr><td>Account budget / prepaid credits</td><td>Principal funds a balance; the agent holds a scoped key with its own caps. Dasha Compute: every key carries its own USD ceiling - $5/month default, $1-$1,000 or uncapped at creation, monthly or weekly reset; the API answers 402 when the key hits its cap (<a href="https://www.getdasha.com/caps">getdasha.com/caps</a>).</td><td>Dasha Compute, most inference startups</td><td>Usage records; Dasha Compute adds a public signed receipt chain (below).</td></tr>
<tr><td>Metered API-key billing</td><td>Provider meters usage and bills the account after the fact; gateways can unify several providers onto one bill.</td><td>OpenAI-style providers; <a href="https://developers.cloudflare.com/ai-gateway/features/unified-billing/">Cloudflare AI Gateway unified billing</a></td><td>Invoices and dashboards.</td></tr>
<tr><td>Per-request machine payment (x402)</td><td>Endpoint answers HTTP 402 with a price; the agent pays USDC for that call and retries. No account, no key.</td><td><a href="https://github.com/x402-foundation/x402">x402 Foundation spec</a>; live endpoints listed at <a href="https://x402-list.com">x402-list.com</a></td><td>The payment itself is on-chain; proof of what ran is separate.</td></tr>
<tr><td>Token packs / crypto rails</td><td>Buy credit-equivalents in USDC or a project token. Dasha Compute's $5 pack: $5.00 by card, $4.85 in USDC, $4.75 in $DASHA - the published discount for optional token payment (npm skill, dasha-compute 0.1.1).</td><td>Dasha Compute, crypto-native providers</td><td>Varies by provider.</td></tr>
</table>

<h2>What a receipt buys you</h2>
<p>Billing answers "what did I pay." Receipts answer "what ran." Dasha Compute publishes a public signed receipt chain: each receipt is a sha256 hash of a canonical JSON body (<code>{"job_id":...,"engine":...,"tokens":...,"cents":...,"at":...,"prev_hash":...}</code> - exactly those keys in that order), an ed25519 signature over that hex string verifiable against the operator's published key, and a prev_hash link to the previous receipt. Anyone can recompute the hashes and check the signatures without an account. A machine verdict endpoint (<code>GET /compute/api/verify?hash=&lt;hash|job_id|request_id&gt;</code>) reports tiers: ANCHORED means the chain tip is covered by a signed anchor head under an hour old; SELF-CONSISTENT means the chain verifies internally but no recent head covers it - heads mint on demand when the endpoints are hit, so quiet windows honestly read SELF-CONSISTENT. Signed checkpoints (<code>GET /heads/checkpoint</code>) let you store a signed note over the tip and detect a rewritten tail later. The full recipe, with exact key order, is public at <a href="https://lobby.getdasha.com/compute/llms.txt">lobby.getdasha.com/compute/llms.txt</a>, and live state is at <a href="https://www.getdasha.com/compute/proof">/compute/proof</a> (<a href="https://www.getdasha.com/compute/proof.json">proof.json</a>).</p>

<h2>A worked example</h2>
<p>The free path, all from public docs:</p>
<pre>curl -sS -X POST https://lobby.getdasha.com/compute/api/guest-keys \
  -H 'Content-Type: application/json' -d '{}'
# -&gt; guest key (dgk_...), 24h, chat + models, 3 mints/hour/IP

curl -sS -X POST https://lobby.getdasha.com/compute/api/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-8b","messages":[{"role":"user","content":"Say hi in three words"}],
       "max_tokens":16,"request_id":"my-run-1"}'</pre>
<p>One honest caveat, verified live September 29, 2026: guest-key jobs run fine, but guest receipts do not land on the public settled chain - a verify lookup for a guest request_id returns <code>found: false</code> against the 300-receipt chain. The find-by-request_id recipe and the local re-verification steps above apply to paid-key jobs, whose receipts settle on the chain. A successful paid job bills $0.05 from prepaid credits.</p>

<h2>Honest constraints</h2>
<dl>
<dt>Guest jobs never appear on the settled chain.</dt>
<dd>Free-tier runs are real inference, but the public chain records settled paid jobs. Checked live September 29, 2026.</dd>
<dt>Community receipts omit unknown USD.</dt>
<dd>Spend headers carry x-dasha-spend-usd when known; community-provider receipts omit it when the USD figure is unknown (compute llms.txt, line-checked September 29, 2026).</dd>
<dt>Provider-signed is integrity and origin, not re-execution.</dt>
<dd>The signed chain proves the receipt was not altered and came from the operator. It does not prove the model computed the tokens honestly - independent re-execution is the stronger tier, and no provider offers it cheaply today.</dd>
</dl>

<h2>Common questions</h2>
<div class="qa">
<p><strong>Do agents need accounts to run inference?</strong></p>
<p>Not always. x402 endpoints take per-request USDC payment with no account. Dasha Compute guest keys are minted by a single POST (no signup), last 24 hours, cover chat and models, and are limited to 3 mints per hour per IP.</p>
<p><strong>What is the cheapest way to let an agent run one job?</strong></p>
<p>A Dasha Compute guest key carries free starter cents, so one small job can cost nothing and no account is needed. x402 pays per call in USDC, so there is no minimum but every call costs. For anything repeated, a prepaid key with a spend cap is the controlled option.</p>
<p><strong>Can I verify a job without trusting the provider?</strong></p>
<p>For integrity and origin, yes, via the signed receipt chain and the public verify endpoint. For independent re-execution of the model output, no - nobody offers that cheaply today.</p>
<p><strong>Does Dasha Compute support x402?</strong></p>
<p>No, as of September 29, 2026. Dasha Compute uses prepaid keys with per-key USD spend caps instead: $5/month default, $1-$1,000 or uncapped at creation, monthly or weekly reset, and a 402 when the key hits its cap.</p>
</div>

<h2>Sources</h2>
<ul>
<li><a href="https://lobby.getdasha.com/compute/llms.txt">Dasha Compute llms.txt</a> - guest keys, verification recipe, verdict tiers, checkpoints (checked September 29, 2026)</li>
<li><a href="https://www.getdasha.com/caps">Dasha Compute spend caps</a> - $5/month default, $1-$1,000 or uncapped, reset windows, 402 behavior</li>
<li><a href="https://www.npmjs.com/package/dasha-compute">dasha-compute on npm</a> - $5 pack ladder ($5.00 card / $4.85 USDC / $4.75 $DASHA), $0.05 per successful job</li>
<li><a href="https://www.getdasha.com/compute/proof">Dasha Compute proof</a> and <a href="https://www.getdasha.com/compute/proof.json">proof.json</a> - live chain state</li>
<li><a href="https://developers.cloudflare.com/ai-gateway/features/unified-billing/">Cloudflare AI Gateway unified billing</a></li>
<li><a href="https://github.com/x402-foundation/x402">x402 Foundation spec</a> and <a href="https://x402-list.com">x402-list.com</a></li>
</ul>

<footer>
<p>Dasha Compute. This page is dated and re-checked; live state moves at <a href="https://www.getdasha.com/compute/proof">/compute/proof</a>.</p>
</footer>
</main>
</body>
</html>
`;
