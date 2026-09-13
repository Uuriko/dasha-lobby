/**
 * /compute/proof - live proof page for Dasha Compute.
 * Six sections, every number pulled client-side from a live public endpoint
 * (or a linked external doc), so nothing on this page is a claim the reader
 * cannot re-check in one click. Machine-readable twin: /compute/proof.json.
 * No wrangler. No plugin.jup.ag. No people-data.
 */
export const COMPUTE_PROOF_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proof - Dasha Compute</title>
<meta name="description" content="Live proof for Dasha Compute: providers online, signed receipts, machine verdict, fail-loud behavior, real pricing, and the provider wall. Every number re-checkable in one click.">
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
.big{font-size:44px;font-weight:700;line-height:1.1;margin:8px 0 2px}
.zero{color:#ff9d9d}
.ok{color:#9dffab}
.card{background:#121218;border:1px solid #26262f;border-radius:10px;padding:14px 16px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #22222b;color:#c9c9d4}
th{color:#8a8a96;font-weight:600}
.strip{display:flex;gap:2px;align-items:flex-end;height:44px;margin:10px 0 4px}
.strip .h{flex:1;background:#2f6f4f;border-radius:1px;min-width:2px;height:100%}
.strip .h.off{background:#5a2f35}
.src{font-size:12px;color:#77778a}
.pill{display:inline-block;border:1px solid #26262f;border-radius:999px;padding:2px 10px;font-size:12px;color:#9a9aa8;margin:2px 4px 2px 0}
.warn{color:#ffcf8a}
</style>
</head>
<body>
<main>
<p class="fine"><a href="/compute">&larr; Dasha Compute</a></p>
<h1>Proof, not promises.</h1>
<p class="lede">This page has no marketing numbers. Every figure below is fetched live from a public endpoint when you load it, and each section links the exact endpoint it reads. Machine-readable twin: <a href="/compute/proof.json">/compute/proof.json</a>.</p>

<h2>1. Right now</h2>
<p class="fine">Source: <a href="/compute/api/network">/compute/api/network</a> &middot; <a href="/compute/api/readyz">/compute/api/readyz</a></p>
<div class="card">
<div class="big" id="p-online">&hellip;</div>
<div class="fine" id="p-online-label">community providers online</div>
<div id="p-models"></div>
<div class="fine" id="p-readyz"></div>
</div>

<h2>2. Every job, signed</h2>
<p class="fine">Sources: <a href="/compute/api/verify">/compute/api/verify</a> &middot; <a href="/compute/api/chain">/compute/api/chain</a> &middot; <a href="/keys.json">/keys.json</a> &middot; format: <a href="/compute/llms.txt">/compute/llms.txt</a></p>
<div class="card">
<div class="big" id="c-len">&hellip;</div>
<div class="fine">receipts on the public ed25519 chain &middot; verdict: <span id="c-verdict">&hellip;</span></div>
<div class="fine">tip <code id="c-tip">&hellip;</code></div>
</div>
<table id="c-rows"><thead><tr><th>receipt</th><th>job</th><th>tokens</th><th>cents</th><th>when (UTC)</th></tr></thead><tbody></tbody></table>
<p class="fine">Recompute a receipt hash yourself - copy, paste, run:</p>
<pre id="c-curl">curl -s https://www.getdasha.com/compute/api/chain | python3 -c '
import json,sys,hashlib
r=json.load(sys.stdin)["receipts"][-1]
body={"job_id":r["job_id"],"engine":r["engine"],"tokens":r["tokens"],"cents":r["cents"],"at":r["at"],"prev_hash":r["prev_hash"]}
h=hashlib.sha256(json.dumps(body,separators=(",",":")).encode()).hexdigest()
print("recomputed:",h); print("chain has :",r["hash"]); print("match:",h==r["hash"])'</pre>
<p class="fine">Signature check: <code>sig</code> is ed25519 over the UTF-8 bytes of that hex string, verifiable against the signer key at <a href="/keys.json">/keys.json</a>. Preimage format: <a href="/compute/llms.txt">/compute/llms.txt</a>.</p>

<h2>3. Ask the network</h2>
<p class="fine">No signup, no key: the chain verdict is a public JSON endpoint. This is what it answered when you loaded the page:</p>
<pre id="v-raw">&hellip;</pre>
<pre>curl -s https://www.getdasha.com/compute/api/verify</pre>

<h2>4. Fail loud, not silent</h2>
<p class="fine">When no community Mac is online, the API does not pretend. Calls answer with a machine-readable <code>no_mac_online</code> reason:</p>
<pre>{
  "status": "action_required",
  "reason": "no_mac_online",
  "hint": "Join a Mac or poll GET /compute/api/network.",
  "next": [ { "path": "/compute/api/network" }, { "path": "/compute#provide" } ]
}</pre>
<p class="fine">Uptime history, including the dark windows - hourly presence samples from <a href="/compute/api/metrics">/compute/api/metrics</a> (<code>providers_online_hourly</code>). Red means zero Macs online that hour:</p>
<div class="strip" id="u-strip"></div>
<p class="fine" id="u-note">&hellip;</p>

<h2>5. What it costs</h2>
<p class="fine">Source: <a href="/compute/api/pricing">/compute/api/pricing</a> (live) vs <a href="https://api-docs.deepseek.com/quick_start/pricing">DeepSeek's published pricing</a> (checked Sep 12, 2026).</p>
<div class="card">
<div class="big" id="price-usd">&hellip;</div>
<div class="fine">flat per successful chat completion, prepaid guest credits. <span id="price-note"></span></div>
</div>
<table>
<thead><tr><th>DeepSeek (per 1M tokens)</th><th>off-peak</th><th>peak</th></tr></thead>
<tbody>
<tr><td>deepseek-flash input (cache miss)</td><td>$0.15</td><td>$0.30</td></tr>
<tr><td>deepseek-flash output</td><td>$0.60</td><td>$1.20</td></tr>
<tr><td>deepseek-v4-pro input (cache miss)</td><td>$0.66</td><td>$1.32</td></tr>
<tr><td>deepseek-v4-pro output</td><td>$1.98</td><td>$3.96</td></tr>
</tbody>
</table>
<p class="fine">From 12:00 Beijing on Sep 14, 2026, DeepSeek routes <code>deepseek-v4-pro</code> requests to V4.1-Flash and bills them at Flash rates - their table, their words, linked above. Different shapes: DeepSeek bills per token, Dasha bills a flat per-job price you can verify per job on the chain in section 2. DeepSeek is cheaper at scale; no one there hands you a signed receipt per job.</p>

<h2>6. The provider wall, honestly</h2>
<p class="fine">Source: <a href="/compute/api/network">/compute/api/network</a></p>
<div class="card">
<p id="w-line" style="font-size:18px;margin:4px 0">&hellip;</p>
<p class="fine">Community side runs on spare Macs people plug in. Provider terms as published on the Provide door: $0.05/job + $0.01/1k completion tokens, $1 minimum payout, pending operator settle, +10% if you take $dasha. One more always-on Mac changes the reliability story more than any ad - <a href="/compute#provide">become a founding provider</a>.</p>
</div>

<p class="src">Page rendered from live endpoints at <span id="rendered-at">&hellip;</span>. If an endpoint is unreachable its section says so instead of guessing.</p>
</main>
<script>
const $=id=>document.getElementById(id);
const J=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(u+' -> '+r.status);return r.json();};
const ago=t=>new Date(t).toISOString().replace('T',' ').slice(0,16)+'Z';
(async()=>{
$('rendered-at').textContent=new Date().toISOString();
const [network,readyz,verify,chain,metrics,pricing]=await Promise.allSettled([
  J('/compute/api/network'),J('/compute/api/readyz'),J('/compute/api/verify'),
  J('/compute/api/chain'),J('/compute/api/metrics'),J('/compute/api/pricing')]);
if(network.status==='fulfilled'){
  const n=network.value,on=n.providers_online;
  $('p-online').textContent=on;
  $('p-online').className='big '+(on>0?'ok':'zero');
  $('p-online-label').textContent=on===1?'community provider online - one Mac, stated as one Mac':'community providers online';
  $('p-models').innerHTML=(n.capacity||[]).map(c=>'<span class="pill">'+c.model+' &middot; '+(c.tokens_per_second??'?')+' tok/s</span>').join('')||'<span class="pill warn">no community models online</span>';
  window.__net=n;
}else{$('p-online').textContent='unreachable';$('p-online').className='big zero';}
if(readyz.status==='fulfilled'){$('p-readyz').textContent='readyz: can_serve='+readyz.value.can_serve+' ('+readyz.value.reason+')';}
if(verify.status==='fulfilled'){
  const v=verify.value;$('c-len').textContent=v.chain.length;$('c-verdict').textContent=v.verdict.tier+' - '+v.verdict.why;
  $('c-tip').textContent=v.chain.tip.slice(0,24)+'\u2026';
  $('v-raw').textContent=JSON.stringify(v,null,2);
}else{$('v-raw').textContent='verify endpoint unreachable: '+verify.reason;}
if(chain.status==='fulfilled'){
  const rows=chain.value.receipts.slice(-5).reverse();
  document.querySelector('#c-rows tbody').innerHTML=rows.map(r=>'<tr><td><code>'+r.id+'</code></td><td><code>'+(r.job_id||'-')+'</code></td><td>'+r.tokens+'</td><td>'+r.cents+'</td><td>'+ago(r.at)+'</td></tr>').join('');
}
if(metrics.status==='fulfilled'){
  const h=metrics.value.providers_online_hourly||{},keys=Object.keys(h).sort(),strip=$('u-strip');
  let dark=0;keys.forEach(k=>{const d=document.createElement('div');const off=!h[k];if(off)dark++;d.className='h'+(off?' off':'');d.title=k+': '+(off?'0 (dark)':h[k]+' online');strip.appendChild(d);});
  const pct=keys.length?Math.round(100*(keys.length-dark)/keys.length):0;
  $('u-note').textContent=keys.length+' hourly samples, '+dark+' dark. That is '+pct+'% uptime across the recorded window - real history, dark hours included, not an SLA.';
}else{$('u-note').textContent='metrics endpoint unreachable: '+metrics.reason;}
if(pricing.status==='fulfilled'){
  $('price-usd').textContent='$'+pricing.value.request_usd;
  $('price-note').textContent=pricing.value.card_available?'Cards accepted.':(pricing.value.card_note||'');
}
if(window.__net){
  const on=window.__net.providers_online;
  $('w-line').textContent=on===1?'The entire community network is 1 provider - one Mac. That is the honest state of it.':('The community network is '+on+' providers right now.');
}
})();
</script>
</body>
</html>`;
