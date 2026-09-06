#!/usr/bin/env node
/**
 * Less-is-more word/design diet: short buttons, UI-state status, no honesty essays.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertLess(html, label) {
  // Engine buttons — short labels
  assert.match(html, /id=["']eng-hosted["'][^>]*>Hosted</, `${label} Hosted short`);
  assert.match(html, /id=["']eng-community["'][^>]*>Community</, `${label} Community short`);
  assert.match(html, /id=["']eng-mixture["'][^>]*>Mixture</, `${label} Mixture short`);
  assert.doesNotMatch(html, /Hosted · always on/, `${label} no always on`);
  assert.doesNotMatch(html, /Community · no Mac/, `${label} no Community · no Mac`);
  assert.doesNotMatch(html, /Mixture · sub-24GB</, `${label} no Mixture · sub-24GB button`);
  assert.match(html, /is-dim/, `${label} dim empty engines`);
  assert.match(html, /engCom\.textContent=providersOnline>=1\?`Community · \$\{providersOnline\}`:'Community'/, `${label} Community · N`);

  // Quiet Ask + gate Marketplace plain; peek Console · N holds the count only
  assert.match(html, /askOcm\.textContent='Marketplace'/, `${label} quiet ask-ocm plain Marketplace`);
  assert.match(html, /function paintAskEngine\(/, `${label} paintAskEngine`);
  assert.match(html, /id=["']change-engine["'][^>]*>Hosted</, `${label} Ask shows Hosted`);
  assert.match(html, /aria-label=["']Change engine["']/, `${label} change-engine aria`);
  assert.doesNotMatch(html, /id=["']ocm-door["']/, `${label} no gate Marketplace primary`);
  assert.doesNotMatch(html, /Marketplace · \$\{ocmHosts\}/, `${label} no Marketplace · N template`);
  assert.doesNotMatch(html, /say something strange/, `${label} no strange phrase`);
  assert.match(html, /id=["']ask-starters["']/, `${label} ask-starters row`);
  assert.match(html, /id=["']ask-starter["'][^>]*>Welcome note</, `${label} Welcome note chip`);
  assert.match(html, /id=["']ask-starter-2["'][^>]*>Summarize this</, `${label} Summarize this chip`);
  assert.match(html, /id=["']ask-starter-3["'][^>]*>Draft a curl</, `${label} Draft a curl chip`);
  assert.match(html, /id=["']pick-pay["'][^>]*title=["']Top up or sponsor["']/, `${label} Pay = top-up/sponsor`);
  assert.match(html, /id=["']pick-credits["'][^>]*title=["']Use prepaid["']/, `${label} Credits = prepaid`);
  assert.match(html, /id=["']step-pay["']/, `${label} step-pay`);
  assert.match(html, /id=["']step-credits["']/, `${label} step-credits`);
  assert.match(html, /id=["']step-earn["']/, `${label} step-earn`);
  assert.match(html, /id=["']you-earn["'][^>]*>Earnings</, `${label} you Earnings`);
  assert.match(html, /\$dasha · \+10%/, `${label} dasha +10% label`);
  assert.match(html, /USDC face/, `${label} USDC face label`);
  assert.doesNotMatch(html, /auto-chain|Stripe|plugin\.jup\.ag/, `${label} no auto-chain/Stripe in UI`);

  assert.match(html, /showTf\(['"]pay['"]\)/, `${label} showTf pay`);
  assert.match(html, /showTf\(['"]credits['"]\)/, `${label} showTf credits`);
  assert.doesNotMatch(html, /pick-pay['"]\)\.addEventListener\(['"]click['"],\(\)=>goAskFromGate\(['"]pay['"]\)/, `${label} pick-pay not goAskFromGate`);
  assert.match(html, /path=\['pay','pay-buy','pay-send','pay-done'\]/, `${label} pay progress`);
  assert.match(html, /Goes to credits\./, `${label} Goes to credits`);
  assert.doesNotMatch(html, /Stripe|plugin\.jup\.ag|\$0\.00|Balance\s+\$/, `${label} no fake Stripe/balance`);
  assert.doesNotMatch(html, /\['ocm-door','ask-ocm'\]/, `${label} no joint ocm label loop`);
  assert.match(html, /id=["']ask-host["'][^>]*>Host</, `${label} quiet Host button`);
  assert.doesNotMatch(html, /id=["']ask-host["'][^>]*href=/, `${label} Ask Host no hard leave`);
  assert.match(html, /id=["']step-host["']/, `${label} host Typeform peek`);
  assert.match(html, /id=["']host-run["'][^>]*href=["']\/compute\/ocm\/provider["'][^>]*>Open</, `${label} host Open`);
  assert.match(html, /showTf\(['"]host['"]\)/, `${label} showTf host`);
  assert.match(html, /path=\['ask','host'\]/, `${label} ask→host progress`);
  assert.match(html, /hostOpen=\$\(['"]host-run['"]\)/, `${label} hostOpen paint`);
  assert.match(html, /hostOpen\.textContent=\(ocmHosts!=null&&ocmHosts>0\)\?`Open · \$\{ocmHosts\}`:'Open'/, `${label} host Open · N`);
  assert.match(html, /id=["']step-market["']/, `${label} market Typeform peek`);
  assert.match(html, /id=["']market-open["'][^>]*href=["']\/compute\/ocm["']/, `${label} market Console href`);
  assert.match(html, /id=["']market-host["'][^>]*href=["']\/compute\/ocm\/provider["']/, `${label} market Host`);
  assert.match(html, /Console · \$\{ocmHosts\}/, `${label} Console · N`);
  assert.match(html, /open\.textContent=\(ocmHosts!=null&&ocmHosts>0\)\?`Console · \$\{ocmHosts\}`:'Console'/, `${label} market-open Console`);
  assert.match(html, /showTf\(['"]market['"]\)/, `${label} showTf market`);
  assert.match(html, /path=\['ask','market'\]/, `${label} ask→market progress`);
  assert.match(html, /removeAttribute\(['"]aria-description['"]\)/, `${label} strip aria-description`);
  assert.doesNotMatch(html, /setAttribute\(['"]aria-description['"]/, `${label} no aria-description essay`);
  assert.match(html, /if\(step===['"]gate['"]\|\|step===['"]how['"]\|\|step===['"]ask['"]\|\|step===['"]night['"]\|\|step===['"]market['"]\|\|step===['"]host['"]\)\{paintSplit\(\)/, `${label} showTf gate/how/ask/night/market/host → paintSplit`);
  assert.match(html, /if\(step===['"]gate['"]\|\|step===['"]ask['"]\|\|step===['"]market['"]\|\|step===['"]host['"]\)loadOcmHosts\(\)/, `${label} loadOcmHosts on gate|ask|market|host`);
  assert.doesNotMatch(html, /id=["']ocm-peek["']/, `${label} no clutter ocm-peek line`);
  assert.doesNotMatch(html, /<iframe/i, `${label} no iframe`);

  // Top-state minimal
  assert.doesNotMatch(html, /community · no Mac/, `${label} no community · no Mac top`);
  assert.doesNotMatch(html, /mixture · no Mac/, `${label} no mixture · no Mac top`);
  assert.doesNotMatch(html, /hosted · gpt-oss-20b/, `${label} no hosted · gpt-oss top`);
  assert.doesNotMatch(html, /hosted idle/, `${label} no hosted idle`);
  assert.match(html, /top\.textContent=`\$\{n\} · \$\{modelName\} · \$\{tpsLabel\} tok\/s`/, `${label} N · model · measured tok/s`);
  assert.match(html, /else if\(modelName\)top\.textContent=`\$\{n\} · \$\{modelName\}`/, `${label} N · model`);
  assert.match(html, /else top\.textContent=`\$\{n\}`/, `${label} N only`);
  assert.match(html, /top\.textContent=''/, `${label} empty top when idle hosted`);

  // Ask hint hidden
  assert.match(html, /id=["']ask-hint["'][^>]*hidden/, `${label} ask-hint hidden`);
  assert.doesNotMatch(html, />Enter · Esc</, `${label} no Enter · Esc visible copy`);
  assert.doesNotMatch(html, /Enter · 1–3 · Esc/, `${label} no Ask 1–3 advertise`);
  assert.match(html, /class=["']tf-quiet["'] id=["']copy-skill-use["']/, `${label} copy-skill-use quiet`);
  assert.match(html, /title=["']Enter to run · Esc back["']/, `${label} prompt title`);

  // Night — H1 + short buttons, no fine copy
  assert.match(html, /id=["']night-offer-copy["'][^>]*hidden/, `${label} night-offer-copy hidden`);
  assert.match(html, /id=["']night-use-hosted["'][^>]*>Hosted</, `${label} night Hosted`);
  assert.match(html, /id=["']queue-night["'][^>]*>Queue</, `${label} night Queue`);
  assert.match(html, /id=["']queue-night-login["'][^>]*>Sign in</, `${label} night Sign in`);
  assert.doesNotMatch(html, /Use Hosted now/, `${label} no Use Hosted now`);
  assert.doesNotMatch(html, /Queue for when a Mac is up/, `${label} no Queue essay`);
  assert.doesNotMatch(html, /Log in to queue/, `${label} no Log in to queue`);
  assert.doesNotMatch(html, /Queued — runs when a Mac is up/, `${label} no Queued essay`);
  assert.match(html, /textContent=status==='running'\?'Running':'Queued'/, `${label} Queued/Running`);

  // Provide
  assert.match(html, /id=["']provide-next-line["'][^>]*hidden/, `${label} provide-next-line hidden`);
  assert.doesNotMatch(html, /token → kit → doctor/, `${label} no Next: token line`);
  assert.match(html, /id=["']provide-beat["']/, `${label} #provide-beat`);
  assert.doesNotMatch(html, /Waiting for heartbeat…/, `${label} no waiting essay`);
  assert.doesNotMatch(html, /Mac online · \$\{providersOnline\}/, `${label} no Mac online essay`);
  assert.match(html, /'Online'|`\$\{providersOnline\} online`/, `${label} Online / N online`);
  assert.match(html, /classList\.add\(['"]waiting['"]\)/, `${label} waiting pulse class`);
  assert.match(html, /classList\.add\(['"]acid['"]\)/, `${label} Online acid class`);
  assert.match(html, /#provide-beat\.acid\{[^}]*color:var\(--acid\)/, `${label} Online acid color beats .fine`);
  assert.match(html, /#provide-beat\.acid::before/, `${label} Online acid pulse`);
  assert.match(html, /if\(tto\)tto\.hidden=true/, `${label} hide tto when Online`);
  assert.match(html, /if\(tto\)tto\.hidden=false/, `${label} show tto while waiting`);
  assert.match(html, /function paintProvideBeat/, `${label} paintProvideBeat`);
  assert.match(html, /function refreshProvideDone/, `${label} refreshProvideDone`);
  assert.match(html, /startProvideBeatPoll/, `${label} poll starter`);
  assert.match(html, /clearProvideBeatPoll/, `${label} poll clearer`);
  assert.match(html, /15000/, `${label} ~15s poll`);
  assert.match(html, /if\(step===['"]provide-done['"]\)\{[\s\S]*?refreshProvideDone\(\)/, `${label} provide-done refresh`);
  assert.match(html, /tfStep!==['"]provide-done['"]/, `${label} poll scoped to provide-done`);
  assert.match(html, /macs\.hidden=tfStep!==['"]provide-done['"]/, `${label} provider-macs on provide-done`);
  assert.match(html, /id=["']provider-macs["']/, `${label} provider-macs details`);
  assert.match(html, /Your Macs ·/, `${label} Your Macs summary`);
  assert.match(html, /\/compute\/api\/network/, `${label} network endpoint`);
  assert.match(html, /providers_online/, `${label} providers_online`);

  // Soft login
  assert.match(html, /'Sign in\.'/, `${label} soft Sign in.`);

  // Mixture honesty — no Raptor; capability on model chip only
  assert.doesNotMatch(html, /Raptor/, `${label} no Raptor`);
  assert.doesNotMatch(html, /pull tag/, `${label} no pull-tag promise`);
  assert.match(html, /sub-24GB specialists · live default qwen3-8b/, `${label} honest mixture chip`);
  assert.match(html, /Prefer a hot small specialist on the selected model/, `${label} honest mixture tip`);

  // Hosted Cancel
  assert.match(html, /runAbort=null/, `${label} runAbort state`);
  assert.match(html, /runAbort=new AbortController\(\)/, `${label} AbortController on Run`);
  assert.match(html, /signal:runAbort\.signal/, `${label} fetch signal`);
  assert.match(html, /if\(!activeJob&&!runAbort\)return/, `${label} Cancel allows hosted`);
  assert.match(html, /error\?\.name===['"]AbortError['"]/, `${label} AbortError → cancelled copy`);

  // Progress fraction beside dots (P2)
  assert.match(html, /function paintProgress\(step\)/, `${label} paintProgress`);
  assert.match(html, /progressLabel/, `${label} progressLabel`);
  assert.match(html, /tf-frac/, `${label} tf-frac class`);
  assert.match(html, /tf-progress-label/, `${label} tf-progress-label id`);
  assert.match(html, /textContent=\(idx\+1\)\+' \/ '\+path\.length/, `${label} N / M paint`);
  assert.match(html, /aria-valuetext/, `${label} aria-valuetext`);
  assert.match(html, /if\(step===['"]gate['"]\|\|step===['"]credits['"]\|\|step===['"]you['"]\|\|step===['"]earn['"]\)\{bar\.hidden=true;bar\.replaceChildren\(\);return\}/, `${label} hide progress gate|credits|you|earn`);
  assert.match(html, /className='tf-dot'/, `${label} keep dots`);
  assert.match(html, /font-variant-numeric:tabular-nums/, `${label} tabular nums`);

  // Locks
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /Designer/, `${label} no Designer`);
}

assertLess(disk, "disk");
assertLess(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
const served = await res.text();
assertLess(served, "worker.fetch");
assert.match(served, /id=["']provide-beat["']/);
assert.doesNotMatch(served, /id=["']ocm-door["']/);
assert.match(served, /id=["']pick-ask["']/);
assert.match(served, /id=["']ask-starter["']/);

console.log("dasha-compute-less-is-more: PASS");
