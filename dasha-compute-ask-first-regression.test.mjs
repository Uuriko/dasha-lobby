#!/usr/bin/env node
/**
 * Consolidated gate-first regression — intent form first paint + honesty Hosted label.
 * Source (disk + embed + worker.fetch) + cheap live Mozilla curls.
 * Live assertGateFirstCore only (pre-deploy may lag); honesty Hosted + quiet Marketplace locked on disk/worker.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { USE_SKILL_MD } from "./dasha-compute-skills.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const useDisk = readFileSync(join(root, "dasha-compute-skills/USE.md"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");
assert.equal(USE_SKILL_MD, useDisk, "USE skill module matches USE.md");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

function assertAskFirstCore(html, label) {
  // Cold gate-first — Start.
  assert.match(html, /<body[^>]*data-step=["']gate["']/, `${label} body data-step=gate`);
  assert.match(html, /id=["']step-gate["'][^>]*data-tf=["']gate["'](?![^>]*hidden)/, `${label} gate not hidden`);
  assert.match(html, /id=["']step-ask["'][^>]*hidden/, `${label} ask hidden first paint`);
  assert.match(html, /else showTf\(['"]gate['"]\)/, `${label} bootHash → gate`);
  assert.match(html, /id=["']pick-ask["'][^>]*>Ask</, `${label} pick-ask`);
  assert.match(html, /id=["']pick-pay["'][^>]*>Pay</, `${label} pick-pay`);
  assert.match(html, /id=["']pick-credits["'][^>]*>Credits</, `${label} pick-credits`);
  assert.doesNotMatch(html, /id=["']ask-example["']/, `${label} no ask-example`);
  assert.doesNotMatch(html, /say something strange/, `${label} no strange`);
  assert.match(html, /id=["']ask-starter["'][^>]*>Welcome note</, `${label} Welcome note`);
  // Multi starters (X6) — soft on live until edge catches up
  if (/id=["']ask-starters["']/.test(html)) {
    assert.match(html, /id=["']ask-starter-2["'][^>]*>Summarize this</, `${label} Summarize this`);
    assert.match(html, /id=["']ask-starter-3["'][^>]*>Draft a curl</, `${label} Draft a curl`);
  }
  assert.match(html, /title=["']Top up or sponsor["']/, `${label} Pay top-up`);
  assert.match(html, /title=["']Use prepaid["']/, `${label} Credits prepaid`);
  // Pay / Credits intent doors (not goAskFromGate-only)
  assert.match(html, /id=["']step-pay["'][^>]*data-tf=["']pay["']/, `${label} step-pay`);
  assert.match(html, /id=["']step-credits["'][^>]*data-tf=["']credits["']/, `${label} step-credits`);
  assert.match(html, /id=["']step-pay["'][^>]*hidden/, `${label} step-pay hidden first paint`);
  assert.match(html, /id=["']step-credits["'][^>]*hidden/, `${label} step-credits hidden first paint`);
  assert.match(html, /<h1 class=["']tf-q["']>Pay\.<\/h1>/, `${label} Pay H1`);
  assert.match(html, /<h1 class=["']tf-q["']>Credits\.<\/h1>/, `${label} Credits H1`);
  assert.match(html, /id=["']pay-topup["'][^>]*>Top up</, `${label} pay Top up`);
  assert.match(html, /id=["']pay-sponsor["'][^>]*>Sponsor</, `${label} pay Sponsor`);
  assert.match(html, /id=["']credits-use["'][^>]*>Use credits</, `${label} credits Use credits`);
  assert.match(html, /id=["']credits-topup["'][^>]*>Top up</, `${label} credits Top up`);
  assert.match(html, /Goes to credits\./, `${label} Goes to credits fine`);
  assert.match(html, /id=["']pay-usdc["']/, `${label} USDC method`);
  assert.match(html, /id=["']pay-dasha["']/, `${label} dasha method`);
  assert.match(html, /pick-pay['"]\)\.addEventListener\(['"]click['"],\(\)=>\{setComputeIntent\(['"]pay['"]\);showTf\(['"]pay['"]\)/, `${label} pick-pay → showTf pay`);
  assert.match(html, /pick-credits['"]\)\.addEventListener\(['"]click['"],\(\)=>\{setComputeIntent\(['"]credits['"]\);showTf\(['"]credits['"]\)/, `${label} pick-credits → showTf credits`);
  assert.doesNotMatch(html, /pick-pay['"]\)\.addEventListener\(['"]click['"],\(\)=>goAskFromGate\(['"]pay['"]\)/, `${label} pick-pay not goAskFromGate-only`);
  assert.doesNotMatch(html, /pick-credits['"]\)\.addEventListener\(['"]click['"],\(\)=>goAskFromGate\(['"]credits['"]\)/, `${label} pick-credits not goAskFromGate-only`);
  // pay-buy compress + guest Run hide (live may still serve pay-amount/method until edge catches up)
  if (/id=["']step-pay-buy["']/.test(html)) {
    assert.match(html, /id=["']step-pay-buy["']/, `${label} pay-buy step`);
    assert.match(html, /showTf\(['"]pay-buy['"]\)/, `${label} Top up → pay-buy`);
    assert.match(html, /path=\['pay','pay-buy','pay-send','pay-done'\]/, `${label} pay progress path`);
    assert.match(html, /run\.hidden=true/, `${label} guest Ask hides Run when Mac available`);
    assert.match(html, /else if\(noMac\)\{/, `${label} guest noMac keeps Run`);
    // Soft on live until hop DOWN: guest noMac hides Ask #login (Night has Log in).
    if (/else if\(noMac\)\{[\s\S]*?loginBtn\.hidden=true/.test(html) || !String(label).startsWith("live")) {
      assert.match(html, /else if\(noMac\)\{[\s\S]*?loginBtn\.hidden=true/, `${label} guest noMac hides Ask Log in`);
    }
  } else if (!String(label).startsWith("live")) {
    assert.fail(`${label} missing pay-buy`);
  } else {
    assert.match(html, /id=["']step-pay-amount["']/, `${label} live lag pay-amount`);
    assert.match(html, /path=\['pay','pay-amount','pay-method','pay-send','pay-done'\]/, `${label} live lag pay progress`);
  }
  // Soft on live until deploy: accept old credits path or new gate|credits|you hide.
  if (/step===['"]gate['"]\|\|step===['"]credits['"]\|\|step===['"]you['"]/.test(html)) {
    assert.doesNotMatch(html, /path=\['credits'\]/, `${label} no credits progress path`);
  } else if (!String(label).startsWith("live")) {
    assert.doesNotMatch(html, /path=\['credits'\]/, `${label} no credits progress path`);
    assert.match(html, /step===['"]gate['"]\|\|step===['"]credits['"]\|\|step===['"]you['"]/, `${label} hide progress gate|credits|you`);
  }
  assert.doesNotMatch(html, /Stripe|\$0\.00|card number/i, `${label} no fake pay chrome`);
  assert.match(html, /option value=["']hosted["'] selected/, `${label} hosted selected`);

  // Quiet doors Provide · Marketplace · Host
  assert.match(html, /id=["']ask-provide["'][^>]*>Provide</, `${label} ask-provide`);
  assert.match(html, /id=["']ask-ocm["'][^>]*>Marketplace</, `${label} ask-ocm Marketplace`);
  assert.match(html, /id=["']ask-host["'][^>]*>Host</, `${label} ask-host Host`);
  assert.match(html, /class=["']ask-door-sep["']/, `${label} door separators`);

  // Quiet Marketplace never paints · N on #ask-ocm
  assert.match(html, /askOcm\.textContent=['"]Marketplace['"]/, `${label} askOcm plain Marketplace`);
  assert.doesNotMatch(
    html,
    /askOcm\.textContent=\(ocmHosts|askOcm\.textContent=`Marketplace ·/,
    `${label} askOcm never · N template`
  );
  assert.doesNotMatch(html, /\['ocm-door','ask-ocm'\]/, `${label} no joint ocm label loop`);
  assert.match(
    html,
    /hostOpen\.textContent=\(ocmHosts!=null&&ocmHosts>0\)\?`Open · \$\{ocmHosts\}`:'Open'/,
    `${label} host peek Open · N`
  );
  if (/Console · \$\{ocmHosts\}/.test(html)) {
    assert.match(html, /Console · \$\{ocmHosts\}/, `${label} peek Console · N count`);
    assert.match(html, /open\.textContent=\(ocmHosts!=null&&ocmHosts>0\)\?`Console · \$\{ocmHosts\}`:'Console'/, `${label} market-open Console`);
  } else if (!String(label).startsWith("live")) {
    assert.fail(`${label} missing Console · N`);
  } else {
    assert.match(html, /Open · \$\{ocmHosts\}/, `${label} live lag Open · N`);
  }
  assert.match(html, /id=["']market-open["'][^>]*href=["']\/compute\/ocm["']/, `${label} market-open href`);

  // Market + Host peeks; ask-host is button (no hard leave)
  assert.match(html, /id=["']step-market["']/, `${label} step-market`);
  assert.match(html, /id=["']step-host["']/, `${label} step-host`);
  assert.match(html, /<button[^>]*id=["']ask-host["']/, `${label} ask-host button`);
  assert.doesNotMatch(html, /id=["']ask-host["'][^>]*href=/, `${label} ask-host no href leave`);
  assert.match(
    html,
    /id=["']host-run["'][^>]*href=["']\/compute\/ocm\/provider["']/,
    `${label} host-run → /compute/ocm/provider`
  );
  assert.match(html, /showTf\(['"]host['"]\)/, `${label} showTf('host')`);
  assert.match(html, /showTf\(['"]market['"]\)/, `${label} showTf('market')`);

  // Provide Done → Ask, never gate
  assert.match(
    html,
    /provide-done-gate['"]\)\.addEventListener\(['"]click['"],\(\)=>\{cameFromHow=false;cameFromGate=false;setEngine\(['"]hosted['"],true\)/,
    `${label} Provide Done → hosted Ask`
  );
  assert.doesNotMatch(
    html,
    /provide-done-gate['"]\)\.addEventListener\(['"]click['"],\(\)=>showTf\(['"]gate['"]\)/,
    `${label} Provide Done not gate`
  );
  assert.match(
    html,
    /tf-done['"]\)\.addEventListener\(['"]click['"],\(\)=>\{(?:clearAnswerMoney\(\);)?cameFromHow=false;cameFromGate=false;showTf\(['"]ask['"]\)/,
    `${label} Answer Done → Ask`
  );

  // Locks
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
  assert.doesNotMatch(html, /Designer/, `${label} no Designer`);
}

function assertAskFirstHonesty(html, label) {
  assert.match(html, /function paintAskEngine\(/, `${label} paintAskEngine`);
  assert.match(
    html,
    /id=["']change-engine["'][^>]*>Hosted</,
    `${label} #change-engine first paint Hosted`
  );
  assert.match(html, /aria-label=["']Change engine["']/, `${label} change-engine aria`);
  assert.match(html, /btn\.textContent=['"]Hosted['"]/, `${label} paintAskEngine Hosted branch`);
  assert.match(html, /paintAskEngine\(\)/, `${label} paintAskEngine called`);
  // Quiet Marketplace — no · N on ask-ocm; count on peek Open only
  assert.doesNotMatch(html, /id=["']ocm-door["']/, `${label} no gate Marketplace primary`);
  assert.doesNotMatch(
    html,
    /askOcm\.textContent=\(ocmHosts|Marketplace · \$\{ocmHosts\}/,
    `${label} no Marketplace · N template`
  );
}

function assertAskCreditsMeter(html, label) {
  assert.match(html, /id=["']ask-credits["']/, `${label} ask-credits meter`);
  assert.match(html, /id=["']ask-credits-sep["']/, `${label} ask-credits-sep`);
  assert.match(html, /function paintAskCredits\(/, `${label} paintAskCredits`);
  assert.match(
    html,
    /ask-credits['"]\)\?\.addEventListener\(['"]click['"],\(\)=>\{setComputeIntent\(['"]credits['"]\);showTf\(['"]credits['"]\)/,
    `${label} ask-credits → credits`
  );
}


function assertProvideTto(html, label) {
  assert.match(html, /id=["']provide-tto["']/, `${label} provide-tto`);
  assert.match(html, /id=["']provide-tto["'][^>]*>About 15–30 min to online\.</, `${label} provide-tto copy`);
  assert.match(html, /id=["']provide-prefer-mlx["'][^>]*>Prefer MLX when you can · Ollama ≥0\.33\.1 · models on internal SSD\.</, `${label} provide-prefer-mlx`);
  assert.match(html, /id=["']how-floor-fine["'][^>]*>Local Macs \+ Hosted floor\.</, `${label} how-floor-fine`);
  assert.match(html, /id=["']step-provide-done["'][\s\S]*?id=["']provide-tto["'][\s\S]*?id=["']provide-prefer-mlx["']/, `${label} prefer-mlx adjacent`);
  assert.match(html, /id=["']step-provide-done["'][\s\S]*?id=["']provide-tto["']/, `${label} provide-tto on Setup`);
  {
    const gateSec = html.match(/<section[^>]*id=["']step-gate["'][^>]*>[\s\S]*?<\/section>/);
    assert.ok(gateSec, `${label} gate section present`);
    assert.doesNotMatch(gateSec[0], /provide-tto/, `${label} provide-tto not on gate`);
    assert.doesNotMatch(gateSec[0], /provide-prefer-mlx/, `${label} prefer-mlx not on gate`);
  }
}

function assertAskStarters(html, label) {
  assert.match(html, /id=["']ask-starters["']/, `${label} ask-starters`);
  assert.match(html, /id=["']ask-starter["'][^>]*>Welcome note</, `${label} Welcome note`);
  assert.match(html, /id=["']ask-starter-2["'][^>]*>Summarize this</, `${label} Summarize this`);
  assert.match(html, /id=["']ask-starter-3["'][^>]*>Draft a curl</, `${label} Draft a curl`);
  assert.match(html, /data-prompt=["']Write a short welcome for a new teammate\.["']/, `${label} Welcome prompt`);
  assert.match(html, /querySelectorAll\(['"]#ask-starters \[data-prompt\]['"]\)/, `${label} starter wiring`);
}

function assertAskFirst(html, label) {
  assertAskFirstCore(html, label);
  assertAskStarters(html, label);
  assertAskFirstHonesty(html, label);
  assertAskCreditsMeter(html, label);
  assertProvideTto(html, label);
}


function assertGateYou(html, label) {
  assert.match(html, /id=["']gate-signin["']/, `${label} gate-signin`);
  assert.match(html, /id=["']gate-you["']/, `${label} gate-you`);
  assert.match(html, /id=["']step-you["'][^>]*data-tf=["']you["']/, `${label} step-you`);
  assert.match(html, /function paintGateAuth\(/, `${label} paintGateAuth`);
  assert.match(html, /id===['"]you['"]\|\|id===['"]account['"]/, `${label} #you|#account`);
  assert.match(html, /\/auth\/logout/, `${label} logout`);
  assert.doesNotMatch(html, /id=["']pick-you["']/, `${label} no fifth primary You`);
  assert.match(html, /id=["']you-macs["'][^>]*>Macs</, `${label} Macs`);
  assert.match(html, /id=["']you-logout["'][^>]*>Log out</, `${label} Log out`);
  // Earnings door — soft on live pre-deploy lag
  if (/id=["']you-earn["']/.test(html) || !String(label).startsWith("live")) {
    assert.match(html, /id=["']you-earn["'][^>]*>Earnings</, `${label} Earnings`);
    assert.match(html, /id=["']step-earn["'][^>]*data-tf=["']earn["']/, `${label} step-earn`);
    assert.match(html, /function paintEarn\(/, `${label} paintEarn`);
    assert.match(html, /id===['"]earn['"]\|\|id===['"]earnings['"]/, `${label} #earn|#earnings`);
    assert.doesNotMatch(html, /\$0\.00 owed/, `${label} no hard-coded fake \$0`);
  }
}

function assertCreditsAuthGate(html, label) {
  assert.match(html, /id=["']pay-method-login["']/, `${label} pay-method-login`);
  assert.match(html, /id=["']credits-login["']/, `${label} credits-login`);
  assert.match(html, /function paintPayMethodAuth\(/, `${label} paintPayMethodAuth`);
  assert.match(html, /Auth gate: never paint payable Send/, `${label} auth gate comment`);
  assert.doesNotMatch(html, /if\(!loggedIn\)\{\s*showTf\(['"]pay-send['"]\)/, `${label} no Send without login`);
  if (/showTf\(['"]pay-buy['"]\)/.test(html)) {
    assert.match(html, /if\(!loggedIn\)\{[\s\S]*?showTf\(['"]pay-buy['"]\)/, `${label} unauth stays pay-buy`);
  } else if (!String(label).startsWith("live")) {
    assert.match(html, /if\(!loggedIn\)\{[\s\S]*?showTf\(['"]pay-buy['"]\)/, `${label} unauth stays pay-buy`);
  } else {
    assert.match(html, /if\(!loggedIn\)\{[\s\S]*?showTf\(['"]pay-method['"]\)/, `${label} live lag unauth pay-method`);
  }
  assert.doesNotMatch(html, /% off|5% off|10% off/, `${label} no % off`);
  assert.match(html, /CREDIT_DISCOUNTS=\{usdc:0\.03,dasha:0\.05\}/, `${label} discounts 0.03\/0.05`);
  assert.doesNotMatch(html, /catch\(e\)\{\s*showTf\(['"]pay-send['"]\)/, `${label} catch never pay-send`);
  assert.match(html, /Never open pay-send unless loggedIn AND order created/, `${label} order gate`);
}

assertAskFirst(disk, "disk");
assertCreditsAuthGate(disk, "disk");
assertGateYou(disk, "disk");
assertAskFirst(COMPUTE_PAGE_HTML, "embed");
assertCreditsAuthGate(COMPUTE_PAGE_HTML, "embed");
assertGateYou(COMPUTE_PAGE_HTML, "embed");

// USE.md / USE_SKILL Ask-first lockstep
assert.match(useDisk, /Ask \(Hosted\)|Ask → Hosted Ask/, "USE.md Ask (Hosted)");
assert.match(useDisk, /quiet Provide \/ Marketplace \/ Host/, "USE.md quiet doors");
assert.match(useDisk, /cold boot → Start\./, "USE.md cold boot gate-first");
assert.match(useDisk, /Ask \/ Provide \/ Pay \/ Credits/, "USE.md gate choices");
assert.match(useDisk, /Pay → Top up|Pay → Pay\./, "USE.md Pay door");
assert.match(useDisk, /Credits → Use credits|Credits → Credits\./, "USE.md Credits door");
assert.doesNotMatch(useDisk, /pick Ask \(or Pay \/ Credits\)\. Then Ask/, "USE.md Pay/Credits not straight Ask");
assert.doesNotMatch(useDisk, /say something strange/, "USE.md no strange");
assert.doesNotMatch(useDisk, /help you Use /, "USE.md no leftover Use verb");
assert.match(useDisk, /content":"hello"/, "USE.md curl hello");
{
  const chatPy = readFileSync(join(root, "dasha-compute-open-alpha/examples/chat.py"), "utf8");
  assert.match(chatPy, /"content": "hello"/, "kit chat.py hello");
  assert.doesNotMatch(chatPy, /Make the timeline stranger/, "kit chat.py no novelty");
}
{
  const m = disk.match(/const USE_SKILL="((?:\\.|[^"\\])*)"/);
  assert.ok(m, "USE_SKILL embed present");
  const embed = JSON.parse('"' + m[1] + '"');
  assert.equal(embed, useDisk, "page USE_SKILL === USE.md");
}

// Worker-served page (local ship tree)
const page = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(page.status, 200, "worker /compute 200");
assert.equal(page.headers.get("x-dasha-edge"), "compute", "worker edge=compute");
const served = await page.text();
assertAskFirst(served, "worker.fetch");
assertCreditsAuthGate(served, "worker.fetch");

// llms-full Ask-first in worker source
const lobby = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
assert.match(
  lobby,
  /Compute: Start\. \(Ask \/ Provide \/ Pay \/ Credits\)\. Pay → Top up USDC\/\$dasha \/ Sponsor\b/,
  "llms-full gate-first Compute line in worker"
);

async function live(path, { expectEdge, expectBody, method = "GET" } = {}) {
  const res = await fetch(`https://www.getdasha.com${path}`, {
    method,
    headers: { "user-agent": UA },
    redirect: "manual",
  });
  assert.equal(res.status, 200, `live ${path} 200`);
  if (expectEdge) {
    assert.equal(res.headers.get("x-dasha-edge"), expectEdge, `live ${path} edge`);
  }
  if (expectBody) {
    const text = await res.text();
    expectBody(text, path);
  } else {
    await res.arrayBuffer();
  }
  return res;
}

await live("/compute", {
  expectEdge: "compute",
  expectBody(text, path) {
    if (/id=["']step-pay-buy["']/.test(text) || /id=["']step-pay-amount["']/.test(text)) {
      assertAskFirstCore(text, `live ${path}`);
      assertAskFirstHonesty(text, `live ${path}`);
      assert.doesNotMatch(text, /say something strange/, `live ${path} no strange`);
      if (/id=["']pay-method-login["']/.test(text)) assertCreditsAuthGate(text, `live ${path}`);
      if (/id=["']gate-signin["']/.test(text)) assertGateYou(text, `live ${path}`);
      if (/id=["']ask-credits["']/.test(text)) assertAskCreditsMeter(text, `live ${path}`);
      if (/id=["']ask-starters["']/.test(text)) assertAskStarters(text, `live ${path}`);
    } else if (/id=["']step-pay["']/.test(text)) {
      // pre-deploy lag — Pay/Credits doors live without Solana top-up steps yet
      assert.match(text, /id=["']pick-pay["']/, `live ${path} pick-pay`);
      assert.match(text, /id=["']pick-credits["']/, `live ${path} pick-credits`);
      assert.match(text, /Goes to credits\./, `live ${path} Goes to credits`);
      assert.doesNotMatch(text, /say something strange/, `live ${path} no strange`);
      assertAskFirstHonesty(text, `live ${path}`);
    } else if (/id=["']pick-ask["']/.test(text)) {
      // pre-deploy lag — gate still live without Pay/Credits steps
      assert.match(text, /id=["']pick-pay["']/, `live ${path} pick-pay`);
      assert.match(text, /id=["']pick-credits["']/, `live ${path} pick-credits`);
      assert.doesNotMatch(text, /say something strange/, `live ${path} no strange`);
      assertAskFirstHonesty(text, `live ${path}`);
    } else if (text.includes("function paintAskEngine(")) {
      assert.match(text, /id=["']change-engine["'][^>]*>Hosted</, `live ${path} #change-engine Hosted`);
      assert.match(text, /btn\.textContent=['"]Hosted['"]/, `live ${path} paintAskEngine Hosted`);
    }
  },
});
await live("/compute/skill/use.md", {
  expectEdge: "compute-skill-use",
  expectBody(text) {
    assert.match(text, /Ask \(Hosted\)|Ask → Hosted Ask/);
    assert.match(text, /quiet Provide \/ Marketplace \/ Host/);
    if (/Start\./.test(text)) {
      assert.match(text, /Ask \/ Provide \/ Pay \/ Credits/);
      assert.doesNotMatch(text, /say something strange/);
      if (/Pay →/.test(text)) assert.match(text, /Pay → Top up|Pay → Pay\./);
    }
  },
});
await live("/compute/skill/ocm-host.md", { expectEdge: "compute-skill-ocm-host" });
await live("/privacy", { expectEdge: "privacy" });
await live("/llms-full.txt", {
  expectEdge: "llms-full",
  expectBody(text) {
    if (/Compute: Start\./.test(text)) {
      assert.match(text, /Compute: Start\. \(Ask \/ Provide \/ Pay \/ Credits\)/);
    } else if (/Compute: What do you want\?/.test(text)) {
      // pre-deploy lag — prior gate copy still live
      assert.match(text, /Compute: What do you want\? \(Ask \/ Provide \/ Pay \/ Credits\)/);
    } else {
      assert.match(text, /Compute: Ask\. Provide\. Marketplace\. Build\./);
    }
  },
});
await live("/dasha-compute-open-alpha.tar.gz");
await live("/compute/ocm/provider", { expectEdge: "compute-ocm" });

console.log("dasha-compute-ask-first-regression: PASS");
