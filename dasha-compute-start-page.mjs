/**
 * /compute/start - the canonical evaluator path for Dasha Compute.
 * One block: Run once. Verify the receipt. Check the anchor. Under 10 minutes.
 * Every command is copy-paste exact against live public endpoints; the live
 * numbers strip is fetched client-side from /compute/api/network so nothing
 * here is a claim the reader cannot re-check. Linked from the /compute gate
 * and /compute/proof.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
export const COMPUTE_START_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Run once. Verify the receipt. Check the anchor. - Dasha Compute</title>
<meta name="description" content="The canonical 10-minute evaluator path for Dasha Compute: mint a guest key, run one call on a live-advertised model, look up your own signed receipt, and check the signed head that covers it.">
<link rel="canonical" href="https://www.getdasha.com/compute/start">
<link rel="describedby" href="/llms.txt" type="text/plain">
<link rel="describedby" href="/llms-full.txt" type="text/plain">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.getdasha.com/compute/start">
<meta property="og:title" content="Run once. Verify the receipt. Check the anchor.">
<meta property="og:description" content="The canonical 10-minute evaluator path: guest key, one call, your own signed receipt, and the signed head that covers it.">
<meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Run once. Verify the receipt. Check the anchor.">
<meta name="twitter:description" content="The canonical 10-minute evaluator path: guest key, one call, your own signed receipt, and the signed head that covers it.">
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
.src{font-size:12px;color:#77778a}
.pill{display:inline-block;border:1px solid #26262f;border-radius:999px;padding:2px 10px;font-size:12px;color:#9a9aa8;margin:2px 4px 2px 0}
.ok{color:#9dffab}
.warn{color:#ffcf8a}
</style>
</head>
<body>
<main>
<p class="fine"><a href="/compute">&larr; Dasha Compute</a> &middot; <a href="/compute/proof">Proof</a> &middot; <a href="/verify">Verify</a></p>
<h1>Run once. Verify the receipt. Check the anchor.</h1>
<p class="lede">This is the canonical evaluator path. Four copy-paste commands, under ten minutes, no account and no card. You run one real call, look up <em>your own</em> signed receipt - not a demo receipt - and check the signed head that covers it. Every step is re-checkable from the endpoint named above it.</p>

<div class="card">
<span class="pill">providers online: <b id="b-online">&hellip;</b></span>
<span class="pill">advertised models: <b id="b-models">&hellip;</b></span>
<span class="pill">jobs queued: <b id="b-queue">&hellip;</b></span>
<p class="src">Live from <a href="/compute/api/network">/compute/api/network</a> as this page loaded. If providers online is 0, community calls fail loud (<code>no_mac_online</code>) - see the failure scripts below; the path still works through Hosted.</p>
</div>

<h2>0. Preflight</h2>
<p class="fine">Source: <a href="/caps">/caps</a> &middot; <a href="/compute/api/network">/compute/api/network</a></p>
<pre># /caps is a redirect by design - confirm it answers, and see where it lands:
curl -sSI https://www.getdasha.com/caps | head -5

# Confirm capacity and kit state before you time anything:
curl -sS https://lobby.getdasha.com/compute/api/network | jq '{providers_online, models_available, jobs_queued, kit_versions}'</pre>
<p class="fine">Kit note: providers run the published open-alpha kit. If <code>kit_versions</code> shows a provider on an older build than the published tarball, that is a known lag on provider side, not a fork - jobs still settle with signed receipts.</p>

<h2>1. Capture a guest key</h2>
<p class="fine">Source: <code>POST /compute/api/guest-keys</code>. Free, no account: 24h TTL, chat + models only, 3 mints/hour/IP, 3 chats/10min/key.</p>
<pre>export DASHA_API_KEY=$(curl -sS -X POST https://lobby.getdasha.com/compute/api/guest-keys \\
  -H 'Content-Type: application/json' -d '{}' | jq -r .api_key)
echo "$\{DASHA_API_KEY:0:12}..."   # dgk_... - shown once, treat as a secret</pre>

<h2>2. Make the first call</h2>
<p class="fine">Source: <code>POST /compute/api/v1/chat/completions</code> (OpenAI-compatible). The model is pulled from the live-advertised list, not hard-coded.</p>
<pre>MODEL=$(curl -sS https://lobby.getdasha.com/compute/api/network | jq -r '.models_available[0] // "qwen3-4b"')
RESP=$(curl -sS https://lobby.getdasha.com/compute/api/v1/chat/completions \\
  -H "Authorization: Bearer $DASHA_API_KEY" -H 'Content-Type: application/json' \\
  -d "{\\"model\\":\\"$MODEL\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Say READY\\"}]}")
echo "$RESP" | jq '{job_id, model, usage, receipt}'
JOB=$(echo "$RESP" | jq -r .job_id)</pre>
<p class="fine">The response carries <code>job_id</code> and a <code>receipt</code> object (model, route, latency, settlement state). That <code>job_id</code> is the stable correlation identifier for everything below.</p>

<h2>3. Verify your receipt</h2>
<p class="fine">Source: <a href="/verify">/verify</a> &middot; <code>GET /compute/api/verify?hash=</code>. One exact lookup, keyed by the job id from your own call:</p>
<pre>curl -sS "https://lobby.getdasha.com/compute/api/verify?hash=$JOB" | jq '{verdict, chain}'</pre>
<p class="fine">The verdict recomputes the receipt's signature and walks the public receipt chain. Same check runs in the browser on <a href="/verify">/verify</a>, no key needed.</p>

<h2>4. Check the anchor</h2>
<p class="fine">Source: <code>GET /heads/checkpoint</code> (signed checkpoint over the receipt-heads log).</p>
<pre>curl -sS https://lobby.getdasha.com/heads/checkpoint | jq '{head, tip}'</pre>
<p class="fine">When the checkpoint's covered tip is at or past your receipt's chain tip, the verify verdict reads <code>ANCHORED</code> - the network's own signer has countersigned the log that contains your receipt. Rewrite boundary in one sentence: nothing at or before the checkpointed tip can be altered or dropped without invalidating the signer's published signature, so history up to that tip is frozen.</p>

<h2>When it does not work</h2>
<div class="card">
<p><b>No capacity.</b> The call returns <code>no_mac_online</code> when no community Mac advertises your model. That is deliberate fail-loud, never a silent fallback. Poll <code>/compute/api/network</code>, or run the same prompt on the Hosted path in the <a href="/compute">/compute</a> UI (Hosted is Cloudflare Workers AI, clearly labeled, 3 free / 10 min).</p>
<p><b>Receipt pending.</b> Settlement shows <code>pending_operator</code> while the operator settles the job; the receipt itself is signed at completion. If verify returns not-found seconds after the call, wait a minute and re-run the same lookup - the id is stable.</p>
<p><b>Not yet anchored.</b> A verdict of verified-but-not-<code>ANCHORED</code> means your receipt is in the chain but the next signed checkpoint has not been issued yet. Checkpoints land about hourly; re-check <code>/heads/checkpoint</code> and the verdict later.</p>
<p><b>Verifier failed.</b> A failed check on a receipt this network issued is an incident, full stop. The page names the exact failed check - report it on <a href="https://t.me/+ck9pUjL2ncNiZjRh" target="_blank" rel="noopener noreferrer">Telegram</a>.</p>
</div>

<h2>What it costs</h2>
<p class="fine">Community jobs settle at a flat $0.05 per successful completion plus $0.01 per 1k completion tokens, paid from prepaid USDC or $dasha credits - no card rail today. Guest calls are free inside the rate limits above. Current card/rail state is public on <a href="/compute/proof">/compute/proof</a>.</p>

<p class="fine">Official Telegram (the only official Dasha invite - ignore lookalike groups): <a href="https://t.me/+ck9pUjL2ncNiZjRh" target="_blank" rel="noopener noreferrer">https://t.me/+ck9pUjL2ncNiZjRh</a>. Do not paste secrets into prompts; community Mac operators can read assigned prompts.</p>
</main>
<script>
(function(){
  fetch('/compute/api/network').then(function(r){return r.json()}).then(function(n){
    var on=document.getElementById('b-online');
    var mo=document.getElementById('b-models');
    var q=document.getElementById('b-queue');
    if(on) on.textContent=String(n.providers_online!=null?n.providers_online:'?');
    if(mo) mo.textContent=(n.models_available&&n.models_available.length)?n.models_available.join(', '):'(none advertised)';
    if(q) q.textContent=String(n.jobs_queued!=null?n.jobs_queued:'?');
  }).catch(function(){
    var on=document.getElementById('b-online'); if(on) on.textContent='unreachable';
  });
})();
</script>
</body>
</html>
`;
