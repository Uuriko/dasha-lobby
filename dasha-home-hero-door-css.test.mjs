#!/usr/bin/env node
/**
 * Leftover after mint-lede / hero actions / door-actions DOM-strip + wrap-nav CSS DRY.
 * Live / 200 still serializes leftover `.mint-lede` / `.actions` / `.door-actions`
 * / `.door .copy-link` CSS in the unlabeled home product <style> after those
 * nodes were already stripped. Humans see it in view-source.
 * Mixed @media keeps .dasha-hero / .pill / .contract. Do not strip .pill
 * (simp-door uses class="pill primary"). Keep .copy (contract copy button).
 * Repair #dasha-home h1/h2/label stay. Watch price/ticker remount belt stays.
 * Product skip-links stay.
 * Distinct leftover vs wrap-nav .nav/.brand/.login-link/.navlinks.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  hideHomeExtraChrome,
  stripDeadNav,
  stripHomeDroppedSelectorCss,
  stripHomeWebflowBoot,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const REPAIR = `#dasha-home h1,
#dasha-home h2 { color: var(--ink, #F2EDE7); }
#dasha-home #tool label { color: var(--ink, #F2EDE7); }`;
const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const VIEW_CSS = '<style>@view-transition{navigation:auto}</style>';
const HERODOOR = `.pill{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px}
.pill.primary{background:var(--acid);color:var(--ink)!important}
.dasha-hero{min-height:640px}
h1{margin:18px 0 12px}.stroke{color:var(--acid)}.mint-lede{margin:0 0 8px;max-width:46ch;color:rgba(244,237,219,.82);font-size:15px;font-weight:700;line-height:1.4}.mint-lede code{display:block;margin:8px 0;word-break:break-all;color:var(--paper)!important;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace}.mint-lede a{color:var(--acid)!important;font-weight:900;text-underline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:16px;margin:22px 0}
.door{border:1px solid var(--line);padding:38px}.door-line{margin:0}.contract{border:1px solid var(--line);padding:38px}.copy{flex:0 0 auto;margin-left:auto;border:0;background:var(--acid);color:var(--ink);font-weight:900;padding:10px 12px;cursor:pointer}
:focus-visible{outline:3px solid var(--acid);outline-offset:4px}.door-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.door-actions .pill:not(.primary){background:var(--ink);color:var(--paper)!important}
.door .copy-link{border:0;cursor:pointer;font:inherit}
@media(max-width:800px){.dasha-hero{grid-template-columns:1fr;padding-top:45px}.contract,.door{grid-template-columns:1fr}.section-title{margin-bottom:28px}section{padding:58px 0}}
@media(max-width:480px){.wrap{width:min(100% - 22px,1180px)}.pill{padding:0 17px}.dasha-hero{min-height:auto}.contract,.door{padding:24px}.ca{font-size:12px}}
.price{margin:22px 0 0}.ticker{position:relative}`;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripHomeDroppedSelectorCss/);
assert.match(workerSrc, /out = stripHomeDroppedSelectorCss\(out\);/);
assert.match(workerSrc, /Leftover hero\/door CSS after mint-lede\/actions\/door-actions\/copy-link DOM-strip/);
assert.match(workerSrc, /Keep \.copy \(contract\)/);
assert.match(workerSrc, /Do not strip \.pill/);
assert.match(
  (workerSrc.match(/const style = '<style id="dasha-home-chrome-hide">[\s\S]*?<\/style>';/) || [''])[0],
  /\.price,#price,\.ticker.*#spark\{display:none!important\}/,
  'Watch belt selector list stays',
);

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
${CHERRIES}
<link rel="stylesheet" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css">
${VIEW_CSS}
<style>
${REPAIR}
</style>
<style>
${HERODOOR}
</style>
<link rel="canonical" href="https://www.getdasha.com/">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section class="dasha-hero"><h1 class="stroke">$dasha</h1></section><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section class="contract"><h2>Contract</h2><button type="button" class="copy">Copy</button></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section><svg id="cherries"></svg></main>
<script src="https://lobby.getdasha.com/client/x-connect.js"></script>
<script src="https://lobby.getdasha.com/client/faucet.js"></script>
</body></html>`;

assert.match(LIVE, /\.mint-lede\{/, 'fixture leftover .mint-lede CSS paints in live <style>');
assert.match(LIVE, /\.mint-lede code\{/, 'fixture leftover .mint-lede code CSS paints');
assert.match(LIVE, /\.mint-lede a\{/, 'fixture leftover .mint-lede a CSS paints');
assert.match(LIVE, /\.actions\{display:flex/, 'fixture leftover .actions CSS paints');
assert.match(LIVE, /\.door-actions\{/, 'fixture leftover .door-actions CSS paints');
assert.match(LIVE, /\.door-actions \.pill:not\(\.primary\)\{/, 'fixture leftover .door-actions pill CSS paints');
assert.match(LIVE, /\.door \.copy-link\{/, 'fixture leftover .door .copy-link CSS paints');
assert.doesNotMatch(LIVE, /class=["']mint-lede["']/, 'fixture mint-lede already DOM-stripped');
assert.doesNotMatch(LIVE, /class=["']actions["']/, 'fixture .actions already DOM-stripped');
assert.doesNotMatch(LIVE, /class=["']door-actions["']/, 'fixture .door-actions already DOM-stripped');
assert.doesNotMatch(LIVE, /class=["']copy-link["']/, 'fixture .copy-link already DOM-stripped');
assert.match(LIVE, /class=["']pill primary["']/, 'fixture simp-door pill stays in DOM');
assert.match(LIVE, /class=["']copy["']/, 'fixture contract .copy stays in DOM');
assert.match(LIVE, /#dasha-home h1/, 'fixture keeps repair h1 rule');
assert.match(LIVE, /#dasha-home #tool label/, 'fixture keeps repair label rule');
assert.match(LIVE, /\.price\{/, 'fixture keeps Watch price CSS');
assert.match(LIVE, /\.ticker\{/, 'fixture keeps Watch ticker CSS');

const gone = stripHomeDroppedSelectorCss(LIVE);
assert.doesNotMatch(gone, /\.mint-lede/, 'drops leftover .mint-lede CSS');
assert.doesNotMatch(gone, /(?<![\w-])\.actions\s*\{/, 'drops leftover .actions CSS');
assert.doesNotMatch(gone, /\.door-actions/, 'drops leftover .door-actions CSS');
assert.doesNotMatch(gone, /\.copy-link/, 'drops leftover .copy-link CSS');
assert.match(gone, /\.copy\{flex:0 0 auto/, 'contract .copy CSS stays');
assert.match(gone, /class=["']copy["']/, 'contract .copy class stays');
assert.match(gone, /\.pill\{display:inline-flex/, 'pill product CSS stays');
assert.match(gone, /\.pill\.primary\{/, 'pill.primary stays');
assert.match(gone, /class=["']pill primary["']/, 'simp-door pill class stays');
assert.match(gone, /@media\(max-width:800px\)\{\.dasha-hero\{/, 'mixed 800px media keeps .dasha-hero');
assert.match(gone, /\.contract,\.door\{grid-template-columns:1fr\}/, 'mixed 800px media keeps .contract');
assert.match(gone, /@media\(max-width:480px\)\{/, 'mixed 480px media stays');
assert.match(gone, /\.pill\{padding:0 17px\}/, 'mixed 480px media keeps .pill');
assert.match(gone, /\.dasha-hero\{min-height:auto\}/, 'mixed 480px media keeps .dasha-hero');
assert.match(gone, /\.contract,\.door\{padding:24px\}/, 'mixed 480px media keeps .contract');
assert.match(gone, /#dasha-home h1/, 'repair h1 rule stays');
assert.match(gone, /#dasha-home h2/, 'repair h2 rule stays');
assert.match(gone, /#dasha-home #tool label/, 'repair label rule stays');
assert.match(gone, /var\(--ink, #F2EDE7\)/, 'repair color stays');
assert.match(gone, /\.price\{/, 'Watch price CSS stays');
assert.match(gone, /\.ticker\{/, 'Watch ticker CSS stays');
assert.match(gone, /data:image\/svg\+xml/, 'cherries SVG stays');
assert.match(gone, /@view-transition/, '@view-transition stays');
assert.match(gone, /rel="canonical"/, 'canonical stays');
assert.match(gone, /johns-awesome/, 'johns-awesome stays');
assert.match(gone, /id=["']chat-door["']/, 'chat-door stays');
assert.match(gone, /id=["']simp-door["']/, 'simp-door stays');
assert.match(gone, /id=["']grok-door["']/, 'grok-door stays');
assert.match(gone, /x-connect\.js/, 'x-connect.js stays');
assert.match(gone, /faucet\.js/, 'faucet.js stays');
assert.match(gone, /<header class="bar">/, 'header.bar stays');
assert.match(gone, />Buy</, 'Buy stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'hero-door CSS drop is per-rule, not eat-the-page');
assert.ok(gone.length > 400 && gone.includes('<body>'), 'hero-door CSS drop cannot blank the fixture');

const other = stripHomeDroppedSelectorCss('<html><head><style>.mint-lede{margin:0}.actions{display:flex}.door-actions{gap:12px}.door .copy-link{border:0}.pill{padding:0 22px}.copy{cursor:pointer}</style></head><body><p>privacy skip</p></body></html>');
assert.match(other, /\.mint-lede\{margin:0\}/, 'non-home pages keep .mint-lede CSS');
assert.match(other, /\.actions\{display:flex\}/, 'non-home pages keep .actions CSS');
assert.match(other, /\.door-actions\{gap:12px\}/, 'non-home pages keep .door-actions CSS');
assert.match(other, /\.door \.copy-link\{border:0\}/, 'non-home pages keep .copy-link CSS');
assert.match(other, /\.pill\{padding:0 22px\}/, 'non-home pages keep .pill CSS');
assert.match(other, /\.copy\{cursor:pointer\}/, 'non-home pages keep .copy CSS');

const booted = stripHomeWebflowBoot(LIVE);
assert.doesNotMatch(booted, /\.mint-lede/, 'stripHomeWebflowBoot drops leftover .mint-lede CSS');
assert.doesNotMatch(booted, /(?<![\w-])\.actions\s*\{/, 'boot drops leftover .actions CSS');
assert.doesNotMatch(booted, /\.door-actions/, 'boot drops leftover .door-actions CSS');
assert.doesNotMatch(booted, /\.copy-link/, 'boot drops leftover .copy-link CSS');
assert.match(booted, /\.copy\{flex:0 0 auto/, 'boot keeps .copy');
assert.match(booted, /\.pill\{display:inline-flex/, 'boot keeps .pill');
assert.match(booted, /class=["']pill primary["']/, 'boot keeps simp-door pill');
assert.match(booted, /#dasha-home h1/, 'boot keeps repair h1');
assert.doesNotMatch(booted, /#dasha-home\s+#tool\s+label/, 'boot drops leftover #tool label');
assert.match(booted, /#dasha-home h2/, 'boot keeps repair h2');
assert.match(booted, /\.price\{/, 'boot keeps Watch price CSS');
assert.match(booted, /\.ticker\{/, 'boot keeps Watch ticker CSS');
assert.match(booted, /@view-transition/, 'boot keeps @view-transition');
assert.match(booted, /id=["']chat-door["']/, 'boot keeps chat-door');
assert.match(booted, /id=["']simp-door["']/, 'boot keeps simp-door');
assert.match(booted, /id=["']grok-door["']/, 'boot keeps grok-door');
assert.match(booted, /x-connect\.js/, 'boot keeps x-connect.js');
assert.match(booted, /faucet\.js/, 'boot keeps faucet.js');
assert.match(booted, /johns-awesome/, 'boot keeps johns-awesome');
assert.doesNotMatch(booted, /plugin\.jup\.ag/, 'boot no plugin.jup.ag');

const rewritten = stripDeadNav(LIVE);
assert.doesNotMatch(rewritten, /\.mint-lede/, 'stripDeadNav drops leftover .mint-lede CSS');
assert.doesNotMatch(rewritten, /(?<![\w-])\.actions\s*\{/, 'rewrite drops leftover .actions CSS');
assert.doesNotMatch(rewritten, /\.door-actions/, 'rewrite drops leftover .door-actions CSS');
assert.doesNotMatch(rewritten, /\.copy-link/, 'rewrite drops leftover .copy-link CSS');
assert.match(rewritten, /\.copy\{flex:0 0 auto/, 'rewrite keeps .copy');
assert.match(rewritten, /class=["']pill primary["']/, 'rewrite keeps simp-door pill');
assert.match(rewritten, /#dasha-home h1/, 'rewrite keeps repair h1');
assert.doesNotMatch(rewritten, /#dasha-home\s+#tool\s+label/, 'rewrite drops leftover #tool label');
assert.match(rewritten, /#dasha-home h2/, 'rewrite keeps repair h2');
assert.match(rewritten, /@view-transition/, 'rewrite keeps @view-transition');
assert.match(rewritten, /id=["']chat-door["']/, 'rewrite keeps chat-door');
assert.match(rewritten, /id=["']simp-door["']/, 'rewrite keeps simp-door');
assert.match(rewritten, /id=["']grok-door["']/, 'rewrite keeps grok-door');
assert.match(rewritten, /<header class="bar">/, 'rewrite keeps header.bar');
assert.match(rewritten, />Buy</, 'rewrite keeps Buy');
assert.match(rewritten, /jup\.ag\/swap/, 'rewrite keeps jup.ag');
assert.doesNotMatch(rewritten, /id=["']compute-door["']/, 'rewrite no compute-door');
assert.doesNotMatch(rewritten, /plugin\.jup\.ag/, 'rewrite no plugin.jup.ag');
{
  const hide = (rewritten.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.match(hide, /id=["']dasha-home-chrome-hide["']/, 'Watch chrome-hide stays');
  assert.match(hide, /\.ticker/, 'Watch belt still hides ticker');
  assert.match(hide, /\.price/, 'Watch belt still hides price');
  assert.match(hide, /#spark/, 'Watch belt still hides #spark');
  assert.doesNotMatch(hide, /\.mint-lede/, 'chrome-hide does not re-lecture dropped .mint-lede');
  assert.doesNotMatch(hide, /\.door-actions/, 'chrome-hide does not re-lecture dropped .door-actions');
  assert.doesNotMatch(hide, /\.copy-link/, 'chrome-hide does not re-lecture dropped .copy-link');
  assert.doesNotMatch(hide, /(?<![\w-])\.actions/, 'chrome-hide does not re-lecture dropped .actions');
}

{
  const hide = hideHomeExtraChrome('<html><head></head><body id="dasha-home"></body></html>');
  const belt = (hide.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.match(belt, /\.price,#price,\.ticker,\.ticker-loop,\.price-main,\.price-now,\.price-chg,\.price-note,#price-now,#price-chg,#price-note,#spark\{display:none!important\}/);
  assert.doesNotMatch(belt, /\.mint-lede/);
  assert.doesNotMatch(belt, /\.door-actions/);
  assert.doesNotMatch(belt, /\.copy-link/);
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-dasha-edge'), 'html-security');
  const html = await home.text();
  assert.doesNotMatch(html, /\.mint-lede/, 'served home no leftover .mint-lede CSS');
  assert.doesNotMatch(html, /(?<![\w-])\.actions\s*\{/, 'served home no leftover .actions CSS');
  assert.doesNotMatch(html, /\.door-actions/, 'served home no leftover .door-actions CSS');
  assert.doesNotMatch(html, /\.copy-link/, 'served home no leftover .copy-link CSS');
  assert.match(html, /class=["']pill primary["']/, 'served simp-door pill stays');
  assert.match(html, /#dasha-home h1/, 'served repair h1 stays');
  assert.doesNotMatch(html, /#dasha-home\s+#tool\s+label/, 'served leftover #tool label gone');
  assert.match(html, /#dasha-home h2/, 'served repair h2 stays');
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, 'served Watch chrome-hide stays');
  assert.match(html, /\.ticker/, 'served Watch ticker hide stays');
  assert.match(html, /\.price/, 'served Watch price hide stays');
  assert.match(html, /#spark/, 'served Watch #spark hide stays');
  assert.match(html, /data:image\/svg\+xml/, 'served cherries SVG');
  assert.match(html, /@view-transition/, 'served @view-transition');
  assert.match(html, /rel="canonical"/, 'served canonical');
  assert.match(html, /johns-awesome/, 'served johns-awesome');
  assert.match(html, /id=["']chat-door["']/, 'served chat-door');
  assert.match(html, /id=["']simp-door["']/, 'served simp-door');
  assert.match(html, /id=["']grok-door["']/, 'served grok-door');
  assert.match(html, /id=["']dasha-home-faucet["']/, 'served HOME_FAUCET_MOUNT');
  assert.match(html, /x-connect\.js/, 'served x-connect.js');
  assert.match(html, /faucet\.js/, 'served faucet.js');
  assert.match(html, /<header class="bar">/, 'served header.bar');
  assert.match(html, />Buy</, 'served Buy');
  assert.match(html, /Chat/, 'served Chat');
  assert.match(html, /\$dasha/, 'served $dasha');
  assert.match(html, /jup\.ag\/swap/, 'served jup.ag');
  assert.match(html, new RegExp(MINT), 'served mint');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'served no plugin.jup.ag');
  assert.doesNotMatch(html, /id=["']compute-door["']/, 'served no compute-door');
}

{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, 'privacy product skip-link stays');
}

{
  const bounties = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties'), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /class=["']skip-link["']/, 'bounties product skip-link stays');
}

{
  const contribute = await edgeWorker.fetch(new Request('https://www.getdasha.com/contribute'), {});
  assert.equal(contribute.status, 200);
  const html = await contribute.text();
  assert.match(html, /class=["']skip-link["']/, 'contribute product skip-link stays');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-home-hero-door-css: PASS (leftover .mint-lede/.actions/.door-actions/.copy-link CSS dropped; mixed @media .dasha-hero/.pill/.contract stay; .copy + repair h1/label + Watch price/ticker belt stay)');
