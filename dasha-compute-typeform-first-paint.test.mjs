#!/usr/bin/env node
/**
 * Product: /compute Typeform gate-first — cold boot Start. (Ask / Provide / Pay / Credits).
 * Ask hidden until pick; quiet Provide · Marketplace · Host on Ask. No six-tab lab.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const computeDisk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(computeDisk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertMarkup(html, label) {
  assert.match(html, /data-step=["']gate["']/, `${label} body starts on gate`);
  assert.match(html, /id=["']step-gate["'][^>]*data-tf=["']gate["'](?![^>]*hidden)/, `${label} gate visible default`);
  assert.match(html, /id=["']step-ask["'][^>]*hidden/, `${label} ask hidden default`);
  assert.match(html, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} gate H1`);
  assert.match(html, /aria-label=["']Start\.["']/, `${label} gate aria`);
  assert.match(html, /id=["']pick-ask["'][^>]*>Ask</, `${label} Ask gate`);
  assert.match(html, /id=["']pick-provide["'][^>]*>Provide</, `${label} Provide gate`);
  assert.match(html, /id=["']pick-pay["'][^>]*>Pay</, `${label} Pay gate`);
  assert.match(html, /id=["']pick-credits["'][^>]*>Credits</, `${label} Credits gate`);
  assert.doesNotMatch(html, /id=["']ocm-door["']/, `${label} no Marketplace primary on gate`);
  assert.doesNotMatch(html, /id=["']ask-example["']/, `${label} no ask-example chip`);
  assert.match(html, /id=["']ask-starters["']/, `${label} ask-starters row`);
  assert.match(html, /id=["']ask-starter["'][^>]*>Welcome note</, `${label} Welcome note chip`);
  assert.match(html, /id=["']ask-starter-2["'][^>]*>Summarize this</, `${label} Summarize this chip`);
  assert.match(html, /id=["']ask-starter-3["'][^>]*>Draft a curl</, `${label} Draft a curl chip`);
  assert.match(html, /data-prompt=["']Write a short welcome for a new teammate\.["']/, `${label} Welcome prompt`);
  assert.match(html, /data-prompt=["']Summarize this in three short bullets:["']/, `${label} Summarize prompt`);
  assert.match(html, /data-prompt=["']Draft a curl that POSTs JSON to an HTTPS API\.["']/, `${label} Draft curl prompt`);
  assert.match(html, /querySelectorAll\(['"]#ask-starters \[data-prompt\]['"]\)/, `${label} starter click wiring`);
  assert.match(html, /id=["']pick-pay["'][^>]*title=["']Top up or sponsor["']/, `${label} Pay title`);
  assert.match(html, /id=["']pick-credits["'][^>]*title=["']Use prepaid["']/, `${label} Credits title`);
  assert.match(html, /tfStep==='gate'/, `${label} gate honesty top-state`);
  assert.doesNotMatch(html, /say something strange/, `${label} no strange phrase`);
  assert.match(html, /id=["']market-open["'][^>]*href=["']\/compute\/ocm["']/, `${label} peek Console → /compute/ocm`);
  assert.match(html, /id=["']market-open["'][^>]*>Console</, `${label} market-open Console label`);
  assert.match(html, /id=["']step-market["'][^>]*data-tf=["']market["']/, `${label} market peek step`);
  assert.match(html, /showTf\(['"]market['"]\)/, `${label} showTf market`);
  assert.match(html, />Marketplace</, `${label} Marketplace label`);
  assert.match(html, /id=["']ask-provide["']/, `${label} quiet Ask Provide`);
  assert.match(html, /id=["']ask-ocm["']/, `${label} quiet Ask Marketplace`);
  assert.match(html, /askOcm\.textContent='Marketplace'/, `${label} quiet ask-ocm plain (no · N)`);
  assert.match(html, /id=["']ask-host["']/, `${label} quiet Ask Host`);
  assert.doesNotMatch(html, /id=["']ask-host["'][^>]*href=/, `${label} Ask Host no hard leave`);
  assert.match(html, /id=["']ask-credits["']/, `${label} quiet Ask credits meter`);
  assert.match(html, /id=["']ask-credits-sep["']/, `${label} ask-credits sep`);
  assert.match(html, /function paintAskCredits\(/, `${label} paintAskCredits`);
  assert.match(html, /ask-credits['"]\)\?\.addEventListener\(['"]click['"],\(\)=>\{setComputeIntent\(['"]credits['"]\);showTf\(['"]credits['"]\)/, `${label} ask-credits → credits`);
  assert.match(html, /if\(step===['"]ask['"]\)\{paintAskCredits\(\);if\(loggedIn\)loadCreditsBalance\(\)\}/, `${label} showTf ask paints credits meter`);
  assert.match(html, /id=["']step-host["'][^>]*data-tf=["']host["']/, `${label} host peek step`);
  assert.match(html, /id=["']host-run["'][^>]*href=["']\/compute\/ocm\/provider["'][^>]*>Open</, `${label} Host Open → provider`);
  assert.match(html, /showTf\(['"]host['"]\)/, `${label} showTf host`);
  assert.match(html, /path=\['ask','host'\]/, `${label} host progress path`);
  assert.match(html, /hostOpen=\$\(['"]host-run['"]\)/, `${label} hostOpen paint`);
  assert.match(html, /hostOpen\.textContent=\(ocmHosts!=null&&ocmHosts>0\)\?`Open · \$\{ocmHosts\}`:'Open'/, `${label} host Open · N`);
  assert.match(html, /id=["']market-host["'][^>]*href=["']\/compute\/ocm\/provider["']/, `${label} peek Host`);
  assert.match(html, />Host</, `${label} Host label`);
  assert.match(html, /Console · \$\{ocmHosts\}/, `${label} Console · N`);
  assert.match(html, /open\.textContent=\(ocmHosts!=null&&ocmHosts>0\)\?`Console · \$\{ocmHosts\}`:'Console'/, `${label} market-open Console paint`);
  assert.match(html, /path=\['ask','market'\]/, `${label} market progress path`);
  assert.match(html, /if\(step===['"]gate['"]\|\|step===['"]ask['"]\|\|step===['"]market['"]\|\|step===['"]host['"]\)loadOcmHosts\(\)/, `${label} loadOcmHosts on market|host`);
  assert.match(html, /ask-doors/, `${label} ask-doors row`);
  assert.match(html, /id=["']prompt["']/, `${label} #prompt`);
  assert.match(html, /id=["']run-demo["']/, `${label} Run`);
  assert.match(html, /aria-label=["']Prompt["']/, `${label} prompt aria`);
  assert.match(html, /<h1 class=["']tf-q["']>Ask\.<\/h1>/, `${label} Ask heading`);
  assert.doesNotMatch(html, /Ask Dasha/, `${label} no dual Ask Dasha`);
  assert.match(html, /id=["']eng-mixture["'][^>]*>Mixture</, `${label} mixture option`);
  assert.match(html, /sub-24GB specialists/, `${label} mixture chip capability`);
  assert.match(html, /id=["']eng-mixture["']/, `${label} mixture engine chip`);
  assert.match(html, /Promise\.allSettled/, `${label} resilient auth`);
  assert.doesNotMatch(html, /setEngine\(['\"]community['\"]\)/, `${label} no auto Community yank`);
  assert.match(html, /id=["']answer-api["'][^>]*hidden/, `${label} answer-api hidden first paint`);
  assert.match(html, /id=["']answer-api["'][^>]*>API key</, `${label} answer-api label`);
  assert.match(html, /function paintAnswerApi\(/, `${label} paintAnswerApi`);
  assert.match(html, /function hasSuccessfulAnswer\(/, `${label} hasSuccessfulAnswer`);
  assert.match(html, /login\?return=\/compute%23build/, `${label} answer-api login return build`);
  assert.doesNotMatch(html, /id=["']pick-build["']/, `${label} no pick-build (X7 answer-api)`);
  assert.match(html, /id=["']answer-credits["'][^>]*hidden/, `${label} answer-credits hidden first paint`);
  assert.match(html, /function paintAnswerMoney\(/, `${label} paintAnswerMoney`);
  assert.match(html, /lastAskFailKind/, `${label} lastAskFailKind`);
  assert.doesNotMatch(html, /role=["']tablist["'][^>]*Dasha Compute sections/, `${label} no six-tab lab`);
  assert.doesNotMatch(html, /id=["']tab-use["']/, `${label} no tab-use`);
  assert.doesNotMatch(html, /id=["']tab-sponsor["']/, `${label} no sponsor tab`);
  assert.doesNotMatch(html, /Exact claim/, `${label} no truth lecture`);
  assert.doesNotMatch(html, /\$17,?292|eight Apple machines/, `${label} no sponsor meter theater`);
  assert.doesNotMatch(html, /ollama pull raptor/i, `${label} no fake raptor pull`);
  assert.doesNotMatch(html, /Raptor/, `${label} no Raptor fake-pull`);
  assert.match(html, /sub-24GB specialists · live default qwen3-8b/, `${label} honest mixture chip`);
  assert.match(html, /event\.key==='Enter'&&!event\.shiftKey/, `${label} Enter submits`);
  assert.doesNotMatch(html, /hosted · gpt-oss-20b/, `${label} no hosted gpt lecture in chrome`);
  assert.match(html, /top\.textContent=''|id=["']top-state["'][^>]*>·</, `${label} calm empty/dot status`);
  assert.doesNotMatch(html, /top\.textContent='down'/, `${label} no DOWN flash`);
  assert.match(html, /\$\{n\} · \$\{modelName\}|`\$\{n\}`/, `${label} N · model count`);
  assert.doesNotMatch(html, /id=["']split["']/, `${label} no split chrome`);
  assert.doesNotMatch(html, /id=["']route-note["']/, `${label} no route-note chrome`);
  assert.doesNotMatch(html, /id=["']count["']/, `${label} no count chrome`);
  assert.doesNotMatch(html, /id=["']demo-auth["']/, `${label} no demo-auth chrome`);
  assert.doesNotMatch(html, /Hosted when idle/, `${label} no lede fluff`);
  assert.match(html, /t\.me\/\+xB7S8mIQaKFiZjRh/, `${label} TG`);
  assert.match(html, /status\?\.live===true|status\.live===true/, `${label} hostedLive`);
  assert.match(html, /chmod 0600 \.dasha-provider-key/, `${label} 0600 after register`);
  assert.doesNotMatch(html, /hamburger/i, `${label} no hamburger`);
  assert.doesNotMatch(html, /compute\.getdasha\.com/, `${label} no compute subdomain`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /id=["']tab-night["']|id=["']pick-night["']/, `${label} no Night chrome`);
  assert.match(html, /id=["']night-offer["'] hidden/, `${label} Night offer hidden first paint`);
  assert.match(html, /id=["']queue-night["'][^>]*>Queue</, `${label} Night Queue`);
  assert.doesNotMatch(html, /Queue for when a Mac is up/, `${label} no Queue essay`);
  assert.match(html, /showTf\(['"]night['"]\)|data-tf=["']night["']/, `${label} Night as step`);
  assert.match(html, /id=["']eng-hosted["'][^>]*>Hosted</, `${label} Hosted short`);
  assert.doesNotMatch(html, /always on/, `${label} no always on`);
  assert.match(html, /id=["']eng-community["'][^>]*>Community</, `${label} Community short`);
  assert.doesNotMatch(html, /Community · no Mac/, `${label} no Community · no Mac`);
  assert.match(html, /id=["']night-use-hosted["'][^>]*>Hosted</, `${label} night Hosted`);
  assert.match(html, /id=["']provide-next-line["'][^>]*hidden/, `${label} provide-next-line hidden`);
  assert.doesNotMatch(html, /token → kit → doctor/, `${label} no token kit doctor prose`);
  assert.match(html, /fleetEmpty|showNightEmpty/, `${label} skip model when fleet empty`);
  assert.match(html, /id=["']tf-progress["']/, `${label} progress dots`);
  assert.match(html, /id=["']ask-hint["']/, `${label} Enter hint`);
  assert.match(html, /Copy AI skill/, `${label} Copy AI skill`);
  assert.match(html, /setEngine\(['"]hosted['"],\s*true\)/, `${label} hosted Ask path`);
  assert.match(html, /else showTf\(['"]gate['"]\)/, `${label} bootHash gate-first`);
  assert.match(html, /cameFromHow/, `${label} cameFromHow`);
  assert.match(html, /cameFromGate/, `${label} cameFromGate`);
  assert.match(html, /paintAskBack/, `${label} paintAskBack`);
  assert.match(html, /back\.hidden=eng===['"]hosted['"]&&!cameFromHow&&!cameFromGate/, `${label} Back on gate→Ask`);
  assert.match(html, /dasha-compute-intent/, `${label} intent localStorage`);
  assert.match(html, /goAskFromGate|setComputeIntent/, `${label} gate Ask/Pay/Credits`);
  assert.match(html, /id=["']step-pay["'][^>]*data-tf=["']pay["']/, `${label} step-pay`);
  assert.match(html, /id=["']step-credits["'][^>]*data-tf=["']credits["']/, `${label} step-credits`);
  assert.match(html, /pick-pay['"]\)\.addEventListener\(['"]click['"],\(\)=>\{setComputeIntent\(['"]pay['"]\);showTf\(['"]pay['"]\)/, `${label} pick-pay showTf pay`);
  assert.match(html, /pick-credits['"]\)\.addEventListener\(['"]click['"],\(\)=>\{setComputeIntent\(['"]credits['"]\);showTf\(['"]credits['"]\)/, `${label} pick-credits showTf credits`);
  assert.doesNotMatch(html, /pick-pay['"]\)\.addEventListener\(['"]click['"],\(\)=>goAskFromGate\(['"]pay['"]\)/, `${label} pick-pay not goAskFromGate`);
  assert.match(html, /path=\['pay','pay-buy','pay-send','pay-done'\]/, `${label} pay progress`);
  assert.match(html, /id=["']run-demo["'][^>]*\bhidden\b/, `${label} run-demo hidden first paint`);
  assert.match(html, /run\.hidden=true;run\.setAttribute\(['"]hidden['"],['"]['"]\);run\.style\.display=['"]none['"]/, `${label} guest Ask hides Run bulletproof`);
  assert.match(html, /Log in to run/, `${label} guest Ask Log in to run CTA`);
  assert.match(html, /ASK_DRAFT_KEY/, `${label} ask draft key`);
  assert.match(html, /saveAskDraftForLogin/, `${label} save ask draft before login`);
  assert.match(html, /resumeAskAfterLogin|takeAskResumeDraft/, `${label} resume ask after login`);

  assert.match(html, /run\.removeAttribute\(['"]hidden['"]\);run\.style\.display=['"]['"]/, `${label} show Run clears hidden+display`);
  assert.match(html, /#run-demo\[hidden\],#run-demo\[hidden\]:disabled\{display:none!important\}/, `${label} hidden Run beats disabled style`);
  assert.match(html, /else if\(noMac\)\{/, `${label} guest noMac keeps Run`);
  assert.match(html, /else if\(noMac\)\{[\s\S]*?loginBtn\.hidden=true/, `${label} guest noMac hides Ask Log in`);
  assert.doesNotMatch(html, /path=\['credits'\]/, `${label} no credits progress path`);
  assert.doesNotMatch(html, /path=\['you'\]/, `${label} no you progress path`);
  assert.match(html, /id=["']pay-topup["']/, `${label} pay-topup`);
  assert.match(html, /id=["']step-pay-buy["'][^>]*data-tf=["']pay-buy["']/, `${label} pay-buy`);
  assert.match(html, /id=["']step-pay-send["'][^>]*data-tf=["']pay-send["']/, `${label} pay-send`);
  assert.doesNotMatch(html, /id=["']step-pay-amount["']/, `${label} no pay-amount`);
  assert.doesNotMatch(html, /id=["']step-pay-method["']/, `${label} no pay-method step`);
  assert.match(html, /id=["']pay-usdc["']/, `${label} pay-usdc`);
  assert.match(html, /id=["']pay-dasha["']/, `${label} pay-dasha`);
  assert.doesNotMatch(html, /Stripe|Card details|card number/i, `${label} no card/Stripe`);
  assert.match(html, /id=["']credits-balance["']/, `${label} credits-balance`);
  assert.match(html, /id=["']pay-method-login["']/, `${label} pay-method-login`);
  assert.match(html, /id=["']credits-login["']/, `${label} credits-login`);
  assert.match(html, /function paintPayMethodAuth\(/, `${label} paintPayMethodAuth`);
  assert.match(html, /if\(!loggedIn\)\{[\s\S]*?showTf\(['"]pay-buy['"]\)/, `${label} unauth top-up stays pay-buy`);
  assert.doesNotMatch(html, /if\(!loggedIn\)\{\s*showTf\(['"]pay-send['"]\)/, `${label} unauth never showTf pay-send`);
  assert.match(html, /Auth gate: never paint payable Send/, `${label} auth gate comment`);
  assert.doesNotMatch(html, /% off|5% off|10% off/, `${label} no % off on pay-method`);
  assert.match(html, /CREDIT_DISCOUNTS=\{usdc:0\.03,dasha:0\.05\}/, `${label} discounts 3%\/5%`);
  assert.match(html, /function paintPayMethodPrices\(/, `${label} paintPayMethodPrices`);
  assert.match(html, /function priceFor\(/, `${label} client priceFor`);
  assert.match(html, /if\(!loggedIn\)\{showTf\(['"]pay-buy['"]\);return\}/, `${label} method click gates before order`);
  assert.doesNotMatch(html, /catch\(e\)\{\s*showTf\(['"]pay-send['"]\)/, `${label} catch never opens pay-send`);
  assert.match(html, /Never open pay-send unless loggedIn AND order created/, `${label} order-created gate comment`);
  assert.match(html, /id=["']pay-sponsor["']/, `${label} pay-sponsor`);
  assert.match(html, /id=["']step-sponsor["']/, `${label} step-sponsor`);
  assert.match(html, /id=["']sponsor-network["']/, `${label} sponsor-network`);
  assert.match(html, /id=["']sponsor-usdc["']/, `${label} sponsor-usdc`);
  assert.match(html, /createSponsorOrder/, `${label} createSponsorOrder`);
  assert.match(html, /\/compute\/api\/sponsors\/orders/, `${label} sponsor orders API`);
  assert.doesNotMatch(html, /pay-sponsor[\s\S]{0,200}showTf\(['"]provide-name['"]\)/, `${label} Sponsor not Provide dump`);
  assert.match(html, /id=["']credits-use["']/, `${label} credits-use`);
  assert.match(html, /Goes to credits\./, `${label} Goes to credits`);
  assert.match(html, /id=["']change-engine["']/, `${label} Change engine control`);
  assert.match(html, /id=["']change-engine["'][^>]*>Hosted</, `${label} change-engine shows Hosted`);
  assert.match(html, /aria-label=["']Change engine["']/, `${label} change-engine aria Change engine`);
  assert.match(html, /function paintAskEngine\(/, `${label} paintAskEngine`);
  assert.match(html, /paintAskEngine\(\)/, `${label} paintAskEngine called`);
  assert.match(html, /event\.key===['"]1['"]|event\.key==='1'/, `${label} keyboard digit`);
  assert.match(html, /event\.key===['"]Escape['"]|event\.key==='Escape'/, `${label} keyboard Escape`);
  assert.match(html, /path=\['ask','answer'\]/, `${label} hosted progress ask/answer`);
  assert.match(html, /id=["']cancel-job["']/, `${label} Cancel control`);
  assert.match(html, /data-tf=["']answer["'][\s\S]*?id=["']cancel-job["']/, `${label} Cancel on answer step`);
  assert.match(html, /startRunTick|runStartedAt/, `${label} Thinking elapsed`);
  assert.match(html, /Waiting for a Mac|Thinking/, `${label} Thinking/Waiting labels`);
  assert.match(html, /shortModelHint| · \$\{cap\}| · \$\{size\} · /, `${label} model capability hint`);
  assert.match(html, /button\.tf-choice, a\.tf-choice/, `${label} focus-first tf-choice`);
  assert.match(html, /python3 provider\/agent\.py --doctor/, `${label} setup agent doctor`);
  assert.match(html, /id=["']provide-beat["']/, `${label} provide-beat chip`);
  assert.match(html, /id=["']provide-tto["']/, `${label} provide-tto time-to-online`);
  assert.match(html, /id=["']provide-tto["'][^>]*>About 15–30 min to online\.</, `${label} provide-tto copy`);
  assert.match(html, /id=["']provide-prefer-mlx["'][^>]*>Prefer MLX when you can · Ollama ≥0\.33\.1 · models on internal SSD\.</, `${label} provide-prefer-mlx copy`);
  assert.match(html, /id=["']how-floor-fine["'][^>]*>Local Macs \+ Hosted floor\.</, `${label} how-floor-fine`);
  assert.match(html, /id=["']step-provide-done["'][\s\S]*?id=["']provide-tto["'][\s\S]*?id=["']provide-prefer-mlx["']/, `${label} prefer-mlx adjacent provide-tto`);
  assert.match(html, /id=["']step-provide-done["'][\s\S]*?id=["']provide-tto["']/, `${label} provide-tto inside provide-done`);
  {
    const gateSec = html.match(/<section[^>]*id=["']step-gate["'][^>]*>[\s\S]*?<\/section>/);
    assert.ok(gateSec, `${label} gate section present`);
    assert.doesNotMatch(gateSec[0], /provide-tto/, `${label} provide-tto not on gate`);
    assert.doesNotMatch(gateSec[0], /provide-prefer-mlx/, `${label} prefer-mlx not on gate`);
  }
  assert.match(html, /if\(step===['"]gate['"]\|\|step===['"]how['"]\|\|step===['"]ask['"]\|\|step===['"]night['"]\|\|step===['"]market['"]\|\|step===['"]host['"]\)\{paintSplit\(\)/, `${label} gate/how/ask/night/market/host paintSplit`);
  assert.match(html, /if\(step===['"]gate['"]\|\|step===['"]ask['"]\|\|step===['"]market['"]\|\|step===['"]host['"]\)loadOcmHosts\(\)/, `${label} loadOcmHosts on gate|ask|market|host`);
  assert.match(html, /communityIntent/, `${label} communityIntent`);
  assert.doesNotMatch(html, /community · no Mac/, `${label} no community top-state lecture`);
  assert.match(html, /id=["']ask-hint["'][^>]*hidden/, `${label} ask-hint hidden`);
  assert.doesNotMatch(html, />Enter · Esc</, `${label} no Enter · Esc copy`);
  assert.doesNotMatch(html, /Enter · 1–3 · Esc/, `${label} no Ask 1–3 advertise`);
  assert.match(html, /id=["']provider-macs["']/, `${label} provider-macs details`);
  assert.match(html, /class=["']tf-quiet["'] id=["']copy-skill-use["']/, `${label} copy-skill-use quiet`);
  assert.match(html, /classList\.add\(['"]waiting['"]\)/, `${label} heartbeat waiting pulse`);
  assert.doesNotMatch(html, /Waiting for heartbeat…/, `${label} no waiting essay`);
  assert.match(html, /tf-done['"]\)\.addEventListener\(['"]click['"],\(\)=>\{(?:clearAnswerMoney\(\);)?cameFromHow=false;cameFromGate=false;showTf\(['"]ask['"]\)/, `${label} Done → Ask`);
  assert.match(html, /data-back=["']ask["']/, `${label} How Back → Ask`);
  assert.match(html, /provide-done-gate['"]\)\.addEventListener\(['"]click['"],\(\)=>\{cameFromHow=false;cameFromGate=false;setEngine\(['"]hosted['"],true\)/, `${label} Provide Done → Ask`);
  assert.doesNotMatch(html, /provide-done-gate['"]\)\.addEventListener\(['"]click['"],\(\)=>showTf\(['"]gate['"]\)/, `${label} Provide Done not gate`);
  assert.match(html, /id=["']provide-name-back["'][^>]*data-back=["']ask["']/, `${label} Provide name Back default ask`);
  assert.match(html, /id=["']gate-signin["'][^>]*class=["']tf-quiet["'][^>]*href=["']\/login\?return=\/compute["'][^>]*>Log in</, `${label} gate-signin quiet Log in`);
  assert.match(html, /id=["']gate-you["'][^>]*class=["']tf-quiet["'][^>]*hidden[^>]*>You</, `${label} gate-you quiet hidden`);
  assert.match(html, /id=["']step-you["'][^>]*data-tf=["']you["'][^>]*hidden/, `${label} step-you hidden first paint`);
  assert.match(html, /<h1 class=["']tf-q["']>You\.<\/h1>/, `${label} You H1`);
  assert.match(html, /id=["']you-macs["'][^>]*>Macs</, `${label} you-macs`);
  assert.match(html, /id=["']you-earn["'][^>]*>Earnings</, `${label} you-earn`);
  assert.match(html, /id=["']you-credits["'][^>]*>Credits</, `${label} you-credits`);
  assert.match(html, /id=["']you-api["'][^>]*>API</, `${label} you-api`);
  assert.match(html, /id=["']you-logout["'][^>]*>Log out</, `${label} you-logout`);
  assert.match(html, /id=["']step-earn["'][^>]*data-tf=["']earn["'][^>]*hidden/, `${label} step-earn hidden first paint`);
  assert.match(html, /<h1 class=["']tf-q["']>Earn\.<\/h1>/, `${label} Earn H1`);
  assert.match(html, /id=["']earn-usdc["'][^>]*>USDC</, `${label} earn USDC`);
  assert.match(html, /id=["']earn-dasha["'][^>]*>\$dasha · \+10%</, `${label} earn dasha +10%`);
  assert.match(html, /id=["']earn-payout["'][^>]*>Request payout</, `${label} Request payout`);
  assert.match(html, /id=["']provide-done-earn["'][^>]*>Earnings</, `${label} provide-done Earnings`);
  assert.match(html, /function paintEarn\(/, `${label} paintEarn`);
  assert.match(html, /function loadEarn\(/, `${label} loadEarn`);
  assert.match(html, /\/compute\/api\/provider\/earnings/, `${label} earnings API`);
  assert.match(html, /id=["']earn-pending["']/, `${label} earn-pending`);
  assert.match(html, /Pending ·/, `${label} Pending payout status`);
  assert.match(html, /solscan\.io\/tx\//, `${label} quiet Solscan link for paid`);
  assert.match(html, /Paid /, `${label} Paid status label`);
  assert.doesNotMatch(html, /earnTotalUsdc=0[,;]/, `${label} no invent earnTotalUsdc=0`);
  assert.match(html, /function paintGateAuth\(/, `${label} paintGateAuth`);
  assert.match(html, /sessionLabel/, `${label} sessionLabel`);
  assert.match(html, /id===['"]you['"]\|\|id===['"]account['"]/, `${label} bootHash #you|#account`);
  assert.match(html, /\/auth\/logout/, `${label} logout POST`);
  assert.doesNotMatch(html, /id=["']gate-signin["'][^>]*class=["']tf-choice/, `${label} Log in not primary door`);
  assert.match(html, /function paintNightH1\(/, `${label} paintNightH1`);
  assert.match(html, /No Mixture Mac/, `${label} No Mixture Mac copy`);
  assert.match(html, /if\(mixEmpty\)\{\s*engMix\.title='No Mixture Mac · opens Night'/, `${label} Mixture dim title whenever mixEmpty`);
  assert.match(html, /engCom\.title='No Mac · opens Night'/, `${label} Community dim title opens Night`);
  assert.match(html, /Community · offline · opens Night/, `${label} Community dim aria-label`);
  assert.match(html, /provideBack/, `${label} provideBack`);
  assert.match(html, /id=["']provide-name-fine["']/, `${label} provide-name-fine`);
  assert.match(html, /clearPaySponsorFine/, `${label} clearPaySponsorFine`);
  assert.match(html, /--paper-muted:#d4cce0/, `${label} paper-muted contrast`);
  assert.match(html, /Leaves Dasha\./, `${label} Host/Market leave fine`);
  assert.match(html, /step===['"]gate['"]\|\|step===['"]credits['"]\|\|step===['"]you['"]\|\|step===['"]earn['"]/, `${label} hide progress gate|credits|you|earn`);
  assert.match(html, /title=["']OCM console["']/, `${label} Marketplace OCM console title`);
  assert.doesNotMatch(html, /OCM catalog/, `${label} no OCM catalog`);
  assert.match(html, /title=["']OCM host["']/, `${label} Host OCM host title`);
  assert.match(html, /3 free \/ 10 min · then credits/, `${label} free floor skill copy`);
  assert.doesNotMatch(html, /id=["']pick-you["']/, `${label} no pick-you fifth primary`);
}


assertMarkup(computeDisk, "disk");
assertMarkup(COMPUTE_PAGE_HTML, "embed");

const res = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get("x-dasha-edge"), "compute");
const served = await res.text();
assertMarkup(served, "worker.fetch /compute");
assert.match(served, /<h1 class="tf-q">Start\.<\/h1>/);
assert.match(served, /aria-label="Start\."/);
assert.match(served, /<h1 class="tf-q">Ask\.<\/h1>/);
assert.match(served, /https:\/\/lobby\.getdasha\.com\/compute\/api\/v1/);

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  const paint = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      step: document.body.dataset.step,
      gateQ: document.querySelector("#step-gate .tf-q")?.textContent || "",
      gateVis: vis(document.getElementById("step-gate")),
      ask: vis(document.getElementById("pick-ask")),
      provideGate: vis(document.getElementById("pick-provide")),
      pay: vis(document.getElementById("pick-pay")),
      credits: vis(document.getElementById("pick-credits")),
      marketGate: !!document.getElementById("ocm-door"),
      askProvide: vis(document.getElementById("ask-provide")),
      askOcm: vis(document.getElementById("ask-ocm")),
      askHost: vis(document.getElementById("ask-host")),
      prompt: vis(document.getElementById("prompt")),
      run: vis(document.getElementById("run-demo")),
      mixture: vis(document.getElementById("eng-mixture")),
      how: vis(document.getElementById("step-how")),
      backAsk: vis(document.getElementById("back-ask")),
      change: vis(document.getElementById("change-engine")),
      engine: document.getElementById("engine")?.value || "",
      hostedPressed: document.getElementById("eng-hosted")?.getAttribute("aria-pressed") || "",
      lede: !!document.body.textContent.match(/Hosted when idle/),
      split: !!document.getElementById("split"),
      count: !!document.getElementById("count"),
      route: !!document.getElementById("route-note"),
      tabs: !!document.querySelector("nav.nav[role=tablist]"),
      night: vis(document.getElementById("night-offer")),
      progressHidden: !!document.getElementById("tf-progress")?.hidden,
      progressDots: document.querySelectorAll("#tf-progress .tf-dot").length,
      askExample: !!document.getElementById("ask-example"),
      strange: /say something strange/.test(document.body.innerHTML),
      provideTto: vis(document.getElementById("provide-tto")),
      provideTtoText: document.getElementById("provide-tto")?.textContent || "",
      preferMlx: vis(document.getElementById("provide-prefer-mlx")),
      preferMlxText: document.getElementById("provide-prefer-mlx")?.textContent || "",
      gateSignin: vis(document.getElementById("gate-signin")),
      gateYou: vis(document.getElementById("gate-you")),
      youStep: vis(document.getElementById("step-you")),
    };
  });
  assert.equal(paint.step, "gate", "first paint gate");
  assert.equal(paint.gateQ, "Start.");
  assert.equal(paint.gateVis, true, "gate visible default");
  assert.equal(paint.ask, true, "Ask on gate");
  assert.equal(paint.provideGate, true, "Provide on gate");
  assert.equal(paint.pay, true, "Pay on gate");
  assert.equal(paint.credits, true, "Credits on gate");
  assert.equal(paint.marketGate, false, "no Marketplace primary on gate");
  assert.equal(paint.askProvide, false, "quiet Provide not on gate paint");
  assert.equal(paint.askOcm, false, "quiet Marketplace not on gate paint");
  assert.equal(paint.askHost, false, "quiet Host not on gate paint");
  assert.equal(paint.prompt, false, "prompt not on gate first paint");
  assert.equal(paint.run, false, "Run not on gate first paint");
  assert.equal(paint.mixture, false, "engines not on first paint");
  assert.equal(paint.how, false);
  assert.equal(paint.askExample, false, "no ask-example");
  assert.equal(paint.strange, false, "no strange phrase");
  assert.equal(paint.lede, false);
  assert.equal(paint.split, false);
  assert.equal(paint.count, false);
  assert.equal(paint.route, false);
  assert.equal(paint.tabs, false);
  assert.equal(paint.night, false);
  assert.equal(paint.progressHidden, true, "progress hidden on gate");
  assert.equal(paint.provideTto, false, "provide-tto not visible on gate");
  assert.equal(paint.provideTtoText, "About 15–30 min to online.", "provide-tto copy in DOM");
  assert.equal(paint.preferMlx, false, "prefer-mlx not visible on gate");
  assert.equal(paint.preferMlxText, "Prefer MLX when you can · Ollama ≥0.33.1 · models on internal SSD.", "prefer-mlx copy in DOM");
  assert.equal(paint.gateSignin, true, "guest Log in visible on gate");
  assert.equal(paint.gateYou, false, "guest You hidden on gate");
  assert.equal(paint.youStep, false, "You step hidden first paint");
  const setupPaint = await page.evaluate(() => {
    showTf("provide-done");
    const el = document.getElementById("provide-tto");
    const mlx = document.getElementById("provide-prefer-mlx");
    const vis = (n) => !!(n && !n.hidden && !n.closest("[hidden]") && n.offsetParent);
    return { step: document.body.dataset.step, vis: vis(el), text: el?.textContent || "", mlxVis: vis(mlx), mlxText: mlx?.textContent || "" };
  });
  assert.equal(setupPaint.step, "provide-done", "setup step");
  assert.equal(setupPaint.vis, true, "provide-tto visible on Setup");
  assert.equal(setupPaint.text, "About 15–30 min to online.", "provide-tto on Setup");
  assert.equal(setupPaint.mlxVis, true, "prefer-mlx visible on Setup");
  assert.equal(setupPaint.mlxText, "Prefer MLX when you can · Ollama ≥0.33.1 · models on internal SSD.", "prefer-mlx on Setup");
  await page.evaluate(() => showTf("gate"));
  // Gate → Ask
  await page.click("#pick-ask");
  const afterAsk = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    const runEl = document.getElementById("run-demo");
    return {
      step: document.body.dataset.step,
      askQ: document.querySelector("#step-ask .tf-q")?.textContent || "",
      prompt: vis(document.getElementById("prompt")),
      run: vis(runEl),
      runHiddenAttr: !!(runEl && (runEl.hidden || runEl.hasAttribute("hidden"))),
      runDisplayNone: !!(runEl && (runEl.style.display === "none" || getComputedStyle(runEl).display === "none")),
      login: vis(document.getElementById("login")),
      askProvide: vis(document.getElementById("ask-provide")),
      askOcm: vis(document.getElementById("ask-ocm")),
      askHost: vis(document.getElementById("ask-host")),
      backAsk: vis(document.getElementById("back-ask")),
      change: vis(document.getElementById("change-engine")),
      engine: document.getElementById("engine")?.value || "",
      intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
      progressHidden: !!document.getElementById("tf-progress")?.hidden,
      progressDots: document.querySelectorAll("#tf-progress .tf-dot").length,
    };
  });
  assert.equal(afterAsk.step, "ask");
  assert.equal(afterAsk.askQ, "Ask.");
  assert.equal(afterAsk.prompt, true);
  // Guest hosted Ask: hide Run so Log in is the only primary (no dual CTA muddle).
  assert.equal(afterAsk.run, false, "guest Ask hides Run");
  assert.equal(afterAsk.runHiddenAttr, true, "guest Ask run has hidden attr");
  assert.equal(afterAsk.runDisplayNone, true, "guest Ask run display none");
  assert.equal(afterAsk.login, true, "guest Ask shows Log in");
  const emptyLogin = await page.evaluate(() => (document.getElementById("login")?.textContent || "").trim());
  assert.equal(emptyLogin, "Log in", "guest empty prompt Log in");
  await page.click("#ask-starter");
  const afterStarter = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      prompt: (document.getElementById("prompt")?.value || "").trim(),
      loginText: (document.getElementById("login")?.textContent || "").trim(),
      loginVis: vis(document.getElementById("login")),
      runVis: vis(document.getElementById("run-demo")),
      draft: (() => { try { return sessionStorage.getItem("dasha-compute-ask-draft") || ""; } catch { return ""; } })(),
    };
  });
  assert.match(afterStarter.prompt, /welcome for a new teammate/i, "starter fills prompt");
  assert.equal(afterStarter.loginText, "Log in to run", "starter → Log in to run");
  assert.equal(afterStarter.loginVis, true, "starter keeps Log in primary");
  assert.equal(afterStarter.runVis, false, "starter still hides Run");
  assert.match(afterStarter.draft, /welcome for a new teammate/i, "starter stashes draft");
  await page.evaluate(() => { saveAskDraftForLogin(); document.getElementById("prompt").value=""; showTf("gate"); });
  await page.evaluate(() => {
    const draft = takeAskResumeDraft();
    if (!draft) return;
    const prompt = document.getElementById("prompt");
    if (prompt && !(prompt.value || "").trim()) prompt.value = draft;
    cameFromGate = true; cameFromHow = false;
    setComputeIntent("ask");
    setEngine("hosted", true);
  });
  const resumed = await page.evaluate(() => ({
    step: document.body.dataset.step,
    prompt: (document.getElementById("prompt")?.value || "").trim(),
    loginText: (document.getElementById("login")?.textContent || "").trim(),
  }));
  assert.equal(resumed.step, "ask", "resume opens Ask");
  assert.match(resumed.prompt, /welcome for a new teammate/i, "resume restores draft");
  assert.equal(resumed.loginText, "Log in to run", "resume keeps Log in to run");
  assert.equal(afterAsk.askProvide, true);
  assert.equal(afterAsk.askOcm, true);
  assert.equal(afterAsk.askHost, true);
  assert.equal(afterAsk.backAsk, true, "Back after gate→Ask");
  assert.equal(afterAsk.change, true);
  assert.equal(afterAsk.engine, "hosted");
  assert.equal(afterAsk.intent, "ask");
  assert.equal(afterAsk.progressHidden, false, "progress on ask");
  assert.ok(afterAsk.progressDots >= 2, "ask/answer progress dots");
  // Usertest: ocmHosts must NOT leak into quiet Ask nav as "Marketplace · 2"
  const quietNav = await page.evaluate(() => {
    ocmHosts = 2;
    paintSplit();
    return {
      ask: (document.getElementById("ask-ocm")?.textContent || "").trim(),
      open: (document.getElementById("market-open")?.textContent || "").trim(),
      hostOpen: (document.getElementById("host-run")?.textContent || "").trim(),
      provide: (document.getElementById("ask-provide")?.textContent || "").trim(),
      host: (document.getElementById("ask-host")?.textContent || "").trim(),
    };
  });
  assert.equal(quietNav.ask, "Marketplace", "quiet Ask Marketplace no · N");
  assert.equal(quietNav.provide, "Provide", "quiet Provide plain");
  assert.equal(quietNav.host, "Host", "quiet Host plain");
  assert.equal(quietNav.open, "Console · 2", "peek Console · N");
  assert.equal(quietNav.hostOpen, "Open · 2", "host peek Open · N");
  // Back → gate
  await page.click("#back-ask");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "gate", "Back → gate");
  await page.click("#pick-ask");
  // Change engine → How
  await page.click("#change-engine");
  const how = await page.evaluate(() => ({
    step: document.body.dataset.step,
    hosted: !!(document.getElementById("eng-hosted")?.offsetParent),
    community: !!(document.getElementById("eng-community")?.offsetParent),
    mixture: !!(document.getElementById("eng-mixture")?.offsetParent),
  }));
  assert.equal(how.step, "how");
  assert.equal(how.hosted, true);
  assert.equal(how.community, true);
  assert.equal(how.mixture, true);
  // Hosted from How → Ask with Back
  await page.click("#eng-hosted");
  const askBack = await page.evaluate(() => ({
    step: document.body.dataset.step,
    back: !!(document.getElementById("back-ask")?.offsetParent),
    engine: document.getElementById("engine")?.value || "",
  }));
  assert.equal(askBack.step, "ask");
  assert.equal(askBack.engine, "hosted");
  assert.equal(askBack.back, true, "Back after Change engine → Hosted");
  // Marketplace peek stays in Typeform
  await page.click("#ask-ocm");
  const market = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      step: document.body.dataset.step,
      title: document.querySelector("#step-market .tf-q")?.textContent || "",
      open: vis(document.getElementById("market-open")),
      host: vis(document.getElementById("market-host")),
      askGone: !vis(document.getElementById("step-ask")),
      openHref: document.getElementById("market-open")?.getAttribute("href") || "",
      hostHref: document.getElementById("market-host")?.getAttribute("href") || "",
    };
  });
  assert.equal(market.step, "market", "Marketplace peek step");
  assert.equal(market.title, "Marketplace.");
  assert.equal(market.open, true);
  assert.equal(market.host, true);
  assert.equal(market.askGone, true);
  assert.equal(market.openHref, "/compute/ocm");
  assert.equal(market.hostHref, "/compute/ocm/provider");
  await page.click("#step-market .tf-back");
  const backAsk = await page.evaluate(() => document.body.dataset.step);
  assert.equal(backAsk, "ask", "market Back → Ask");
  // Host peek stays in Typeform
  await page.click("#ask-host");
  const hostPeek = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      step: document.body.dataset.step,
      title: document.querySelector("#step-host .tf-q")?.textContent || "",
      open: vis(document.getElementById("host-run")),
      askGone: !vis(document.getElementById("step-ask")),
      openHref: document.getElementById("host-run")?.getAttribute("href") || "",
      openLabel: (document.getElementById("host-run")?.textContent || "").trim(),
    };
  });
  assert.equal(hostPeek.step, "host", "Host peek step");
  assert.equal(hostPeek.title, "Host.");
  assert.equal(hostPeek.open, true);
  assert.equal(hostPeek.askGone, true);
  assert.equal(hostPeek.openHref, "/compute/ocm/provider");
  assert.match(hostPeek.openLabel, /^Open( · \d+)?$/, "Host Open label honesty");
  await page.click("#step-host .tf-back");
  const backAskHost = await page.evaluate(() => document.body.dataset.step);
  assert.equal(backAskHost, "ask", "host Back → Ask");
  // P0: Community with 0 Macs skips model+ask → No Mac online
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-ask");
  await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => {
    providersOnline = 0;
    networkModels = new Set();
    updateRun();
  });
  await page.click("#change-engine");
  await page.click("#eng-community");
  const nomac = await page.evaluate(() => ({
    step: document.body.dataset.step,
    hostedNow: !!(document.getElementById("night-use-hosted")?.offsetParent),
    queue: !!(document.getElementById("queue-night")?.offsetParent || document.getElementById("queue-night-login")?.offsetParent),
    model: !!(document.getElementById("step-model")?.offsetParent),
    ask: !!(document.getElementById("prompt")?.offsetParent),
    q: document.querySelector("#step-night .tf-q")?.textContent || "",
    top: document.getElementById("top-state")?.textContent || "",
  }));
  assert.equal(nomac.step, "night", "0 Macs → night, not model/ask");
  assert.equal(nomac.hostedNow, true);
  assert.equal(nomac.queue, true);
  assert.equal(nomac.model, false);
  assert.equal(nomac.ask, false);
  assert.equal(nomac.q, "No Mac online.");
  assert.ok(!(nomac.top || "").match(/community · no Mac|hosted ·|hosted idle/), "top-state quiet on night");
  // Guest Ask + noMac: one primary Run (opens Night); hide Ask #login (Night has Log in for Queue).
  const guestNoMacAsk = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    loggedIn = false;
    providersOnline = 0;
    networkModels = new Set();
    networkCapacity = [];
    $("engine").value = "community";
    showTf("ask");
    updateRun();
    const run = document.getElementById("run-demo");
    const login = document.getElementById("login");
    return {
      step: document.body.dataset.step,
      run: vis(run),
      runLabel: (run?.textContent || "").trim(),
      login: vis(login),
      nightLogin: !!(document.getElementById("queue-night-login")),
    };
  });
  assert.equal(guestNoMacAsk.step, "ask", "guest noMac can paint Ask");
  assert.equal(guestNoMacAsk.run, true, "guest noMac Ask shows Run");
  assert.equal(guestNoMacAsk.runLabel, "Run", "guest noMac Ask Run label");
  assert.equal(guestNoMacAsk.login, false, "guest noMac Ask hides Log in");
  assert.equal(guestNoMacAsk.nightLogin, true, "Night Log in still in DOM");
  // P0-1: providers online but only non-SUB24 → No Mixture Mac. (not No Mac online.)
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-ask");
  await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => {
    providersOnline = 1;
    networkModels = new Set(["gemma3-27b"]);
    networkCapacity = [{ model: "gemma3-27b" }];
    updateRun();
  });
  await page.click("#change-engine");
  await page.click("#eng-mixture");
  const mixEmpty = await page.evaluate(() => ({
    step: document.body.dataset.step,
    q: document.querySelector("#step-night .tf-q")?.textContent || "",
    mixDim: document.getElementById("eng-mixture")?.classList.contains("is-dim"),
  }));
  assert.equal(mixEmpty.step, "night", "mixture no SUB24 → night");
  assert.equal(mixEmpty.q, "No Mixture Mac.", "Night H1 honest when Mac online wrong class");
  // provideBack stack: gate Provide → Back gate; Sponsor → Sponsor. Back pay; Ask Provide → Back ask
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-provide");
  const fromGate = await page.evaluate(() => ({
    step: document.body.dataset.step,
    back: document.getElementById("provide-name-back")?.getAttribute("data-back") || "",
    fineHidden: !!document.getElementById("provide-name-fine")?.hidden,
  }));
  assert.equal(fromGate.step, "provide-name");
  assert.equal(fromGate.back, "gate", "gate Provide → Back gate");
  assert.equal(fromGate.fineHidden, true, "no sponsor fine from gate Provide");
  await page.click("#provide-name-back");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "gate", "provide Back → gate");
  await page.click("#pick-pay");
  await page.click("#pay-sponsor");
  const fromSponsor = await page.evaluate(() => ({
    step: document.body.dataset.step,
    back: document.querySelector("#step-sponsor .tf-back")?.getAttribute("data-back") || "",
    title: document.querySelector("#step-sponsor .tf-q")?.textContent || "",
    network: !!(document.getElementById("sponsor-network")?.offsetParent),
  }));
  assert.equal(fromSponsor.step, "sponsor", "Sponsor → Sponsor.");
  assert.equal(fromSponsor.back, "pay", "Sponsor → Back pay");
  assert.equal(fromSponsor.title, "Sponsor.");
  assert.equal(fromSponsor.network, true, "Network door");
  await page.click("#step-sponsor .tf-back");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "pay", "sponsor Back → pay");
  const payAfterSponsor = await page.evaluate(() => ({
    sponsorFineHidden: !!document.getElementById("pay-sponsor-fine")?.hidden,
    topupFine: (document.getElementById("pay-topup-fine")?.textContent || "").trim(),
  }));
  assert.equal(payAfterSponsor.sponsorFineHidden, true, "Pay clears stale sponsor fine after Back");
  assert.equal(payAfterSponsor.topupFine, "Goes to credits.");
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-ask");
  await page.click("#ask-provide");
  const fromAsk = await page.evaluate(() => ({
    back: document.getElementById("provide-name-back")?.getAttribute("data-back") || "",
  }));
  assert.equal(fromAsk.back, "ask", "Ask Provide → Back ask");
  await page.click("#provide-name-back");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "ask", "provide Back → ask");
  // P1-4: progress hidden on credits + you
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-credits");
  assert.equal(await page.evaluate(() => !!document.getElementById("tf-progress")?.hidden), true, "credits progress hidden");
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { loggedIn = true; sessionLabel = "@test"; paintGateAuth(); showTf("you"); });
  assert.equal(await page.evaluate(() => !!document.getElementById("tf-progress")?.hidden), true, "you progress hidden");
  // ask hint after gate → Ask
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-ask");
  const hint = await page.evaluate(() => ({
    hint: document.getElementById("ask-hint")?.textContent || "",
    copyClass: document.getElementById("copy-skill-use")?.className || "",
    step: document.body.dataset.step,
  }));
  assert.equal(hint.step, "ask");
  assert.equal((hint.hint || "").trim(), "", "ask hint empty");
  assert.match(hint.copyClass, /tf-quiet/, "copy-skill-use quiet");
  // Provide via quiet ask link
  await page.click("#ask-provide");
  await page.click("#provide-next");
  const reg = await page.evaluate(() => ({
    step: document.body.dataset.step,
    next: document.getElementById("provide-next-line")?.textContent || "",
    copy: !!(document.getElementById("copy-skill-provide-reg")?.offsetParent),
  }));
  assert.equal(reg.step, "provide-reg");
  assert.equal((reg.next || "").trim(), "", "provide-next-line empty");
  assert.equal(reg.copy, true);

  // Pay / Credits intent doors
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-pay");
  const payStep = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      step: document.body.dataset.step,
      title: document.querySelector("#step-pay .tf-q")?.textContent || "",
      topup: vis(document.getElementById("pay-topup")),
      sponsor: vis(document.getElementById("pay-sponsor")),
      fine: (document.getElementById("pay-topup-fine")?.textContent || "").trim(),
      intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
      askGone: !vis(document.getElementById("step-ask")),
    };
  });
  assert.equal(payStep.step, "pay", "Pay → step-pay");
  assert.equal(payStep.title, "Pay.");
  assert.equal(payStep.topup, true);
  assert.equal(payStep.sponsor, true);
  assert.equal(payStep.fine, "Goes to credits.");
  assert.equal(payStep.intent, "pay");
  assert.equal(payStep.askGone, true, "Pay does not land on Ask");
  await page.click("#pay-topup");
  const afterTopup = await page.evaluate(() => ({
    step: document.body.dataset.step,
    intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
    amount: !!(document.getElementById("pack-5")?.offsetParent),
  }));
  assert.equal(afterTopup.step, "pay-buy", "Top up → Buy");
  assert.equal(afterTopup.intent, "pay");
  assert.equal(afterTopup.amount, true);
  await page.click("#pack-5");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "pay-buy", "pack stays on Buy");
  const methodLabels = await page.evaluate(() => ({
    usdc: document.getElementById("pay-usdc")?.textContent || "",
    dasha: document.getElementById("pay-dasha")?.textContent || "",
  }));
  assert.match(methodLabels.usdc, /USDC · \$4\.85/);
  assert.match(methodLabels.dasha, /\$dasha · \$4\.75/);
  assert.doesNotMatch(methodLabels.usdc + methodLabels.dasha, /%|off/i);
  // Force logged-out (auth may race); lock: no payable Send without login
  // USDC is hidden when !loggedIn — fire click via evaluate so handler still runs.
  await page.evaluate(() => {
    loggedIn = false; creditOrder = null; paintPayMethodAuth();
    document.getElementById("pay-usdc")?.click();
  });
  const unauthSend = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      step: document.body.dataset.step,
      sendVis: vis(document.getElementById("step-pay-send")),
      methodVis: vis(document.getElementById("step-pay-buy")),
      loginVis: vis(document.getElementById("pay-method-login")),
      waitText: (document.getElementById("pay-wait")?.textContent || "").trim(),
      sendLine: (document.getElementById("pay-send-line")?.textContent || "").trim(),
      posted: !!creditOrder,
    };
  });
  assert.equal(unauthSend.step, "pay-buy", "unauth USDC stays on pay-buy (no Send)");
  assert.equal(unauthSend.sendVis, false, "Send step not painted unauth");
  assert.equal(unauthSend.methodVis, true, "pay-buy still visible");
  assert.equal(unauthSend.loginVis, true, "Log in CTA on pay-buy");
  assert.notEqual(unauthSend.waitText, "Waiting…", "no Waiting… without session");
  assert.equal(unauthSend.posted, false, "no credit order without auth");
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-credits");
  await page.evaluate(() => { loggedIn = false; creditBalanceCents = null; paintCreditsBalance(); });
  const creditsAuth = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      balText: (document.getElementById("credits-balance")?.textContent || "").trim(),
      balHidden: !!document.getElementById("credits-balance")?.hidden,
      loginVis: vis(document.getElementById("credits-login")),
      fakeZero: /\$0/.test(document.getElementById("credits-balance")?.textContent || ""),
    };
  });
  assert.equal(creditsAuth.balHidden, true, "logged-out balance hidden");
  assert.equal(creditsAuth.fakeZero, false, "no $0 painted logged out");
  assert.equal(creditsAuth.loginVis, true, "Credits Log in when logged out");
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-pay");
  await page.click("#pay-sponsor");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "sponsor", "Sponsor → Sponsor.");
  await page.click("#sponsor-network");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "sponsor-buy", "Network → Amount");
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-credits");
  // Auth gate: Use/Top up only when logged in — force session for click-through.
  await page.evaluate(() => { loggedIn = true; creditBalanceCents = 0; paintCreditsBalance(); });
  const creditsStep = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      step: document.body.dataset.step,
      title: document.querySelector("#step-credits .tf-q")?.textContent || "",
      use: vis(document.getElementById("credits-use")),
      topup: vis(document.getElementById("credits-topup")),
      intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
      askGone: !vis(document.getElementById("step-ask")),
      fakeBal: /\$12/.test(document.getElementById("step-credits")?.innerHTML || ""),
    };
  });
  assert.equal(creditsStep.step, "credits", "Credits → step-credits");
  assert.equal(creditsStep.title, "Credits.");
  assert.equal(creditsStep.use, true);
  assert.equal(creditsStep.topup, true);
  assert.equal(creditsStep.intent, "credits");
  assert.equal(creditsStep.askGone, true);
  assert.equal(creditsStep.fakeBal, false, "no fake balance");
  await page.click("#credits-use");
  const afterUse = await page.evaluate(() => ({
    step: document.body.dataset.step,
    intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
  }));
  assert.equal(afterUse.step, "ask", "Use credits → Ask");
  assert.equal(afterUse.intent, "credits");
  // Quiet Ask credits meter: guest hidden; logged-in known balance shows $N; click → Credits
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-ask");
  await page.evaluate(() => { loggedIn = false; creditBalanceCents = null; paintAskCredits(); });
  const guestMeter = await page.evaluate(() => {
    const el = document.getElementById("ask-credits");
    const sep = document.getElementById("ask-credits-sep");
    return {
      hidden: !!el?.hidden,
      text: (el?.textContent || "").trim(),
      sepHidden: !!sep?.hidden,
    };
  });
  assert.equal(guestMeter.hidden, true, "guest ask-credits hidden");
  assert.equal(guestMeter.text, "", "guest ask-credits empty");
  assert.equal(guestMeter.sepHidden, true, "guest ask-credits-sep hidden");
  await page.evaluate(() => {
    loggedIn = true;
    creditBalanceCents = 500;
    paintAskCredits();
  });
  const inMeter = await page.evaluate(() => {
    const el = document.getElementById("ask-credits");
    return {
      hidden: !!el?.hidden,
      text: (el?.textContent || "").trim(),
      title: el?.getAttribute("title") || "",
      aria: el?.getAttribute("aria-label") || "",
    };
  });
  assert.equal(inMeter.hidden, false, "logged-in ask-credits visible");
  assert.equal(inMeter.text, "$5", "ask-credits shows $5");
  assert.equal(inMeter.title, "Credits");
  assert.equal(inMeter.aria, "Credits");
  await page.evaluate(() => document.getElementById("ask-credits")?.click());
  const fromMeter = await page.evaluate(() => ({
    step: document.body.dataset.step,
    intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
  }));
  assert.equal(fromMeter.step, "credits", "ask-credits click → Credits");
  assert.equal(fromMeter.intent, "credits");
  // X7: #answer-api hidden until first successful Answer; logged-in → Build + focus create key; guest → Log in
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { showTf("answer"); paintAnswerApi(); });
  const beforeAns = await page.evaluate(() => {
    const el = document.getElementById("answer-api");
    return { hidden: !!el?.hidden, text: (el?.textContent || "").trim() };
  });
  assert.equal(beforeAns.hidden, true, "answer-api hidden before first answer");
  await page.evaluate(() => {
    loggedIn = true;
    apiKeyCount = 0;
    sent = 1;
    paintAnswerApi();
  });
  const afterAns = await page.evaluate(() => {
    const el = document.getElementById("answer-api");
    return {
      hidden: !!el?.hidden,
      text: (el?.textContent || "").trim(),
      href: el?.getAttribute("href") || "",
    };
  });
  assert.equal(afterAns.hidden, false, "answer-api visible after sent>=1");
  assert.equal(afterAns.text, "API key");
  await page.evaluate(() => document.getElementById("answer-api")?.click());
  const toBuild = await page.evaluate(() => ({
    step: document.body.dataset.step,
    focused: document.activeElement?.id || "",
  }));
  assert.equal(toBuild.step, "build", "answer-api → Build");
  await page.evaluate(() => {
    showTf("answer");
    loggedIn = true;
    apiKeyCount = 2;
    sent = 1;
    paintAnswerApi();
  });
  assert.equal(
    await page.evaluate(() => !!document.getElementById("answer-api")?.hidden),
    true,
    "answer-api quiet when keys exist"
  );
  await page.evaluate(() => {
    loggedIn = false;
    apiKeyCount = 0;
    sent = 1;
    paintAnswerApi();
  });
  const guestApi = await page.evaluate(() => {
    const el = document.getElementById("answer-api");
    return {
      hidden: !!el?.hidden,
      text: (el?.textContent || "").trim(),
      href: el?.getAttribute("href") || "",
    };
  });
  assert.equal(guestApi.hidden, false, "guest answer-api after answer");

  // X5: #answer-credits only after rate/credits fail; hide on happy path / clear
  await page.evaluate(() => {
    lastAskFailKind = null;
    showTf("answer");
    paintAnswerMoney();
  });
  assert.equal(
    await page.evaluate(() => !!document.getElementById("answer-credits")?.hidden),
    true,
    "answer-credits hidden when no fail"
  );
  await page.evaluate(() => {
    lastAskFailKind = "credits";
    paintAnswerMoney();
  });
  const credNudge = await page.evaluate(() => {
    const el = document.getElementById("answer-credits");
    return { hidden: !!el?.hidden, text: (el?.textContent || "").trim() };
  });
  assert.equal(credNudge.hidden, false, "answer-credits visible on credits fail");
  assert.equal(credNudge.text, "Top up");
  await page.evaluate(() => document.getElementById("answer-credits")?.click());
  const toPay = await page.evaluate(() => ({
    step: document.body.dataset.step,
    intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
  }));
  assert.equal(toPay.step, "pay-buy", "Top up → pay-buy");
  assert.equal(toPay.intent, "pay");
  await page.evaluate(() => {
    lastAskFailKind = "rate";
    showTf("answer");
    paintAnswerMoney();
  });
  const rateNudge = await page.evaluate(() => {
    const el = document.getElementById("answer-credits");
    return { hidden: !!el?.hidden, text: (el?.textContent || "").trim() };
  });
  assert.equal(rateNudge.hidden, false, "answer-credits visible on rate fail");
  assert.equal(rateNudge.text, "Credits");
  await page.evaluate(() => document.getElementById("answer-credits")?.click());
  const toCredits = await page.evaluate(() => ({
    step: document.body.dataset.step,
    intent: document.body.dataset.intent || localStorage.getItem("dasha-compute-intent") || "",
  }));
  assert.equal(toCredits.step, "credits", "Credits nudge → Credits");
  assert.equal(toCredits.intent, "credits");
  await page.evaluate(() => {
    lastAskFailKind = "credits";
    paintAnswerMoney();
    clearAnswerMoney();
  });
  assert.equal(
    await page.evaluate(() => !!document.getElementById("answer-credits")?.hidden),
    true,
    "clearAnswerMoney hides nudge"
  );

  assert.equal(guestApi.text, "Log in");
  assert.match(guestApi.href, /login\?return=\/compute%23build/);
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.click("#pick-credits");
  await page.evaluate(() => { loggedIn = true; paintCreditsBalance(); document.getElementById("credits-topup")?.click(); });
  assert.equal(await page.evaluate(() => document.body.dataset.step), "pay-buy", "Credits Top up → Buy");

  // Gate first-paint auth · You profile
  await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { loggedIn = false; sessionLabel = ''; paintGateAuth(); showTf("gate"); });
  const guestGate = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      signin: vis(document.getElementById("gate-signin")),
      you: vis(document.getElementById("gate-you")),
      signinText: document.getElementById("gate-signin")?.textContent || "",
    };
  });
  assert.equal(guestGate.signin, true, "guest gate-signin visible");
  assert.equal(guestGate.you, false, "guest gate-you hidden");
  assert.equal(guestGate.signinText, "Log in");
  await page.evaluate(() => { loggedIn = true; sessionLabel = "@potter"; paintGateAuth(); showTf("gate"); });
  const inGate = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      signin: vis(document.getElementById("gate-signin")),
      you: vis(document.getElementById("gate-you")),
      youText: document.getElementById("gate-you")?.textContent || "",
    };
  });
  assert.equal(inGate.signin, false, "logged-in Log in hidden");
  assert.equal(inGate.you, true, "logged-in You visible");
  assert.equal(inGate.youText, "@potter", "You shows @handle");
  await page.click("#gate-you");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "you", "You → step-you");
  const youHub = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return {
      id: document.getElementById("you-id")?.textContent || "",
      macs: vis(document.getElementById("you-macs")),
      earn: vis(document.getElementById("you-earn")),
      credits: vis(document.getElementById("you-credits")),
      api: vis(document.getElementById("you-api")),
      logout: vis(document.getElementById("you-logout")),
    };
  });
  assert.equal(youHub.id, "@potter");
  assert.equal(youHub.macs, true);
  assert.equal(youHub.earn, true);
  assert.equal(youHub.credits, true);
  assert.equal(youHub.api, true);
  assert.equal(youHub.logout, true);
  await page.click("#you-earn");
  assert.equal(await page.evaluate(() => document.body.dataset.step), "earn", "Earnings → step-earn");
  const earnGuest = await page.evaluate(() => {
    loggedIn = false; earnLoaded = false; earnTotalUsdc = null; paintEarn();
    const bal = document.getElementById("earn-balance");
    const login = document.getElementById("earn-login");
    const vis = (el) => !!(el && !el.hidden && !el.closest("[hidden]") && el.offsetParent);
    return { balHidden: !vis(bal), login: vis(login), balText: bal?.textContent || "" };
  });
  assert.equal(earnGuest.balHidden, true, "guest earn no balance");
  assert.equal(earnGuest.login, true, "guest earn Log in");
  assert.equal(earnGuest.balText, "", "guest earn no fake $0 text");
  await page.evaluate(() => { loggedIn = true; earnLoaded = true; earnTotalUsdc = 0; earnTotalJobs = 0; paintEarn(); });
  const earnZero = await page.evaluate(() => document.getElementById("earn-balance")?.textContent || "");
  assert.match(earnZero, /\$0\.00 owed/, "logged-in loaded zero shows $0.00");
  await page.evaluate(() => document.querySelector("#step-earn .tf-back")?.click());
  assert.equal(await page.evaluate(() => document.body.dataset.step), "you", "Earn Back → you");
  await page.evaluate(() => document.querySelector("#step-you .tf-back")?.click());
  assert.equal(await page.evaluate(() => document.body.dataset.step), "gate", "You Back → gate");
  await page.evaluate(() => { location.hash = "you"; bootHash(); });
  assert.equal(await page.evaluate(() => document.body.dataset.step), "you", "hash #you boots You");
  await page.evaluate(() => { location.hash = "earn"; bootHash(); });
  assert.equal(await page.evaluate(() => document.body.dataset.step), "earn", "hash #earn boots Earn");
  await browser.close();
}

console.log("dasha-compute-typeform-first-paint: PASS");
