#!/usr/bin/env node
/**
 * Live home leftover chrome crawlers still see after style/script strip:
 *   <nav class="nav wrap"> $DASHA Lobby Faucet Mint How to buy Log in
 *   CSS-hidden <footer> Lobby / Faucet / Bounties / How to buy
 *   CSS-hidden <a class="skip-link"> Skip to content
 *   leftover Webflow boot (created-in-Webflow comment, generator, default favicon.ico, w-mod-js, jquery, webflow.js)
 *   leftover Studio/Desk CSS comment (DashaNav stays on lobby/studio/desk)
 *   leftover Webflow Commerce currency (__WEBFLOW_CURRENCY_SETTINGS / CommercePrice) after boot strip
 *   leftover HTML comment: RETIRED product's mark / Do not reintroduce a page-level icon (crawlers still see after style/script strip)
 *   leftover HTML comments: cherries-lecture / view-transition lecture / Dasha canonical URL (crawlers still see after style/script strip)
 *   leftover Sign in menu / leftover hamburger Webflow w-embed (empty w-embed w-script after style/script strip; leftover script removes #grok-door)
 *   leftover product CSS Webflow wrapper (remaining w-embed w-script after Sign in drop; empty leftover chrome after style/script strip; inner @view-transition + x-connect are product)
 *   leftover chrome-hide CSS lecture listing already-DOM-dropped #compute-door/footer/nav/skip/poster
 * DOM rewrite drops both navs, leftover home footer, leftover skip-link, leftover Webflow boot, leftover commerce currency, leftover RETIRED icon comment, leftover cherries-lecture / view-transition-lecture / canonical-URL HTML comments, leftover Sign in menu embed, leftover product CSS Webflow wrapper (unwrap, keep inner), and the door (not CSS-hide only). Cherries SVG stays. @view-transition stays. Canonical link stays. Product CSS + x-connect.js stay.
 * Quiz #simp-door stays. header.bar Chat+Buy stays. Product skip-links stay. Disk only. No Designer. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  attachLlmsHtmlLinks,
  hideHomeExtraChrome,
  stripDeadNav,
  stripHomeCompute,
  stripHomeDashaNav,
  stripHomeLeftoverSigninMenu,
  stripHomeOtherCoinWarning,
  stripHomeDashaNavHideCss,
  stripHomeDroppedSelectorCss,
  stripHomeWebflowBoot,
  stripSimpFromMenuAndFooter,
  unwrapHomeProductWembed,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripHomeDashaNav/);
assert.match(workerSrc, /out = stripHomeDashaNav\(out\);/);
assert.match(workerSrc, /out = stripSimpFromMenuAndFooter\(out\);/);
assert.match(workerSrc, /dropIdedElement\(out, 'compute-door'\)/);
assert.match(workerSrc, /dropClassedTag\(out, 'nav', 'dasha-nav'\)/);
assert.match(workerSrc, /dropClassedTag\(out, 'nav', 'nav'\)/);
assert.match(workerSrc, /dropAriaLabeledTag\(out, 'nav', 'Main navigation'\)/);
assert.match(workerSrc, /dropTagged\(out, 'footer'\)/);
assert.match(workerSrc, /dropClassedTag\(out, 'a', 'skip-link'\)/);
assert.match(workerSrc, /export function stripHomeWebflowBoot/);
assert.match(workerSrc, /out = stripHomeWebflowBoot\(out\);/);
assert.match(workerSrc, /export function stripHomeLeftoverSigninMenu/);
assert.match(workerSrc, /out = stripHomeLeftoverSigninMenu\(out\);/);
assert.match(workerSrc, /export function unwrapHomeProductWembed/);
assert.match(workerSrc, /export function stripHomeDashaNavHideCss/);
assert.match(workerSrc, /out = stripHomeDashaNavHideCss\(out\);/);
assert.match(workerSrc, /export function stripHomeDroppedSelectorCss/);
assert.match(workerSrc, /out = stripHomeDroppedSelectorCss\(out\);/);
assert.match(workerSrc, /out = unwrapHomeProductWembed\(out\);/);
assert.match(workerSrc, /RETIRED product/);
assert.match(workerSrc, /page-level icon/);
assert.match(workerSrc, /slot-machine cherries/);
assert.match(workerSrc, /Cross-document view transitions/);
assert.match(workerSrc, /Dasha canonical URL/);
assert.match(workerSrc, /__WEBFLOW_CURRENCY_SETTINGS/);
assert.match(
  workerSrc,
  /Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards\./,
);
assert.match(workerSrc, /path === '\/digest\.json'/);
assert.match(workerSrc, /applyDigestTape/);
assert.match(workerSrc, /<lastmod>2026-09-01<\/lastmod>/);

const DASHA_NAV = '<nav class="dasha-nav"><a href="/" aria-current="page" class="dasha-nav-link w--current">$dasha</a><a href="/lobby" class="dasha-nav-link">lobby</a><a href="/simp" class="dasha-nav-link">simp</a><a href="/bounties" class="dasha-nav-link">bounties</a><a href="/how-to-buy" class="dasha-nav-link">buy</a><a href="https://x.com/dash_eats" target="_blank" class="dasha-nav-link" rel="noopener noreferrer">@dash_eats</a></nav>';
const WRAP_NAV = '<nav class="nav wrap" aria-label="Main navigation"><a class="brand" href="#top">$<span>DASHA</span></a><div class="navlinks"><a href="/lobby">Lobby</a><a href="/faucet">Faucet</a><a href="#token" aria-label="Verify the full associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump">Mint</a><a href="/how-to-buy">How to buy</a><a class="login-link" href="/login" data-dasha-login-link>Log in</a></div></nav>';
const DOOR = '<section id="compute-door" aria-labelledby="compute-title"><h2 id="compute-title">Compute</h2><p><a href="/compute">Try the console</a></p></section>';
const PIXEL = '<img src="https://lobby.getdasha.com/r/px.gif?ref=home" width="1" height="1" alt="">';
const SKIP = '<a class="skip-link" href="#content">Skip to content</a>';
const WF_COMMENT = '<!-- This site was created in Webflow. https://webflow.com --><!-- Last Published: Thu Aug 27 2026 17:35:16 GMT+0000 (Coordinated Universal Time) -->';
const WF_GEN = '<meta content="Webflow" name="generator"/>';
const WF_ICO = '<link href="https://cdn.prod.website-files.com/img/favicon.ico" rel="shortcut icon" type="image/x-icon"/>';
const WF_MOD = '<script type="text/javascript">!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js"}(window,document);</script>';
const WF_JQ = '<script src="https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js?site=5f1458122ba25e70a3ff2bd0" type="text/javascript"></script>';
const WF_JS = '<script src="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/js/webflow.c57f7424.3889daa0fc78ae31.js" type="text/javascript"></script>';
const WF_CURRENCY = '<script type="text/javascript">window.__WEBFLOW_CURRENCY_SETTINGS = {"currencyCode":"USD","symbol":"$","decimal":".","fractionDigits":2,"group":",","template":"{{wf {\\"path\\":\\"symbol\\",\\"type\\":\\"PlainText\\"} }} {{wf {\\"path\\":\\"amount\\",\\"type\\":\\"CommercePrice\\"} }} {{wf {\\"path\\":\\"currencyCode\\",\\"type\\":\\"PlainText\\"} }}","hideDecimalForWholeNumbers":false};</script>';
const WF_STUDIO = '/* Home first paint is Buy $dasha. DashaNav stays on lobby/studio/desk. */';
const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const ICON_NOTE = '<!-- Dasha site icon: slot-machine cherries. Canonical source is dasha-favicon.svg in the project repo; regenerate the PNGs from it rather than editing them. -->';
const VIEW_TRANS = '<!-- Cross-document view transitions. Site-wide on purpose: without editing a generated embed another agent is mid-rewrite on. -->';
const CANON_NOTE = '<!-- Dasha canonical URL -->';
const WF_SIGNIN = `<div class="w-embed w-script"><style>
  .signin-menu{position:relative;display:flex;align-items:center}
  #grok-door{display:none!important}
</style>
<script>
(function(){
  function installSignin(){
    var door=document.getElementById("grok-door");
    if(door) door.remove();
    var current=document.querySelector("[data-dasha-login-link]");
    if(current && !document.querySelector("[data-dasha-signin-menu]")){
      var menu=document.createElement("details");
      menu.className="signin-menu";
      menu.setAttribute("data-dasha-signin-menu","");
      menu.innerHTML='<summary aria-label="Open sign in options">Sign in</summary>';
      current.replaceWith(menu);
    }
  }
  installSignin();
})();
</script></div>`;
const WF_PRODUCT_EMBED = `<div class="w-embed w-script"><style>@view-transition{navigation:auto}.dasha-hero{min-height:640px}</style>
<main class="dasha" id="top"><header class="dasha-hero wrap" id="content"><div><h1>$dasha</h1></div></header></main>
<script src="https://lobby.getdasha.com/client/x-connect.js" integrity="sha384-DD4R1qMUUftlIFJU3g7ZEourjvxcSYVEgduLdXUFYfTr8DlnmAVh+Hm0EVLU/hQY" crossorigin="anonymous" defer></script>
</div>`;
const RETIRED_ICON = `<!-- The site icon now comes from the site-wide head block (dasha-favicon.svg — cherries). The
     page-level <link rel="icon"> that used to sit here carried the RETIRED product's mark, and
     because page-level code is injected after site-level code, it silently overrode the new one.
     Do not reintroduce a page-level icon: it will win over the site icon again. -->`;

const LIVE = `<!doctype html>${WF_COMMENT}<html lang="en" data-wf-domain="www.getdasha.com" data-wf-page="5f1458136c15aa41639b8538" data-wf-site="5f1458122ba25e70a3ff2bd0"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
${WF_GEN}
${WF_ICO}
${ICON_NOTE}
${CHERRIES}
${VIEW_TRANS}
${CANON_NOTE}
${RETIRED_ICON}
<style>${WF_STUDIO}.dasha-nav{display:none!important}</style>
${WF_MOD}
${WF_CURRENCY}
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
${WF_SIGNIN}
${WF_PRODUCT_EMBED}
${SKIP}
${DASHA_NAV}
${WRAP_NAV}
${DOOR}
<section id="chat-door" aria-labelledby="chat-title"><h2 id="chat-title">Chat.</h2></section>
<section id="simp-door" aria-labelledby="simp-title"><h2 id="simp-title">Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section>
<section id="grwm" aria-label="Get ready with me"><p>GRWM</p></section>
<section id="grok-door" aria-labelledby="grok-title"><h2 id="grok-title">Sign in with Grok Bot.</h2></section>
<footer><div class="wrap"><p><a href="/simp">Simp</a> · <a href="/lobby">Lobby</a> · <a href="/privacy">Privacy</a></p></div></footer>
${PIXEL}
${WF_JQ}${WF_JS}
</body></html>`;

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

function navChunks(html) {
  return [...String(html).matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)].map((m) => m[0]);
}

function footerChunks(html) {
  return [...String(html).matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi)].map((m) => m[0]);
}

function hasSimpHref(chunk) {
  return /href=(["'])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/simp(?:[/?#][^"']*)?\1/i.test(chunk);
}

function visible(html) {
  let s = String(html);
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<[^>]+>/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

assert.match(LIVE, /<nav class="dasha-nav">/, 'fixture has leftover dasha-nav');
assert.match(LIVE, /id=["']compute-door["']/, 'fixture has leftover compute-door');
assert.ok(navChunks(LIVE).some(hasSimpHref), 'fixture nav links /simp');
assert.ok(footerChunks(LIVE).some(hasSimpHref), 'fixture footer links /simp');
assert.match(LIVE, /px\.gif/, 'fixture has px.gif');
assert.match(visible(LIVE), /Log in/, 'fixture wrap nav paints Log in after style/script strip');
assert.match(visible(LIVE), /Skip to content/, 'fixture skip-link paints after style/script strip');
assert.match(LIVE, /This site was created in Webflow/, 'fixture has leftover Webflow comment');
assert.match(LIVE, /name=["']generator["']/, 'fixture has leftover Webflow generator');
assert.match(LIVE, /cdn\.prod\.website-files\.com\/img\/favicon\.ico/, 'fixture has leftover Webflow favicon.ico');
assert.match(LIVE, /jquery-3\.5\.1/, 'fixture has leftover jquery');
assert.match(LIVE, /\/js\/webflow/, 'fixture has leftover webflow.js');
assert.match(LIVE, /lobby\/studio\/desk/, 'fixture has leftover Studio/Desk CSS comment');
assert.match(LIVE, /__WEBFLOW_CURRENCY_SETTINGS/, 'fixture has leftover Webflow commerce currency');
assert.match(LIVE, /CommercePrice/, 'fixture leftover commerce template paints CommercePrice');
assert.match(afterStyleScript(LIVE), /RETIRED product'?s mark/, 'fixture leftover RETIRED icon comment paints after style/script strip');
assert.match(afterStyleScript(LIVE), /Do not reintroduce a page-level icon/, 'fixture leftover page-level-icon comment paints after style/script strip');
assert.match(afterStyleScript(LIVE), /Dasha site icon: slot-machine cherries/, 'fixture leftover cherries lecture paints after style/script strip');
assert.match(afterStyleScript(LIVE), /another agent is mid-rewrite/, 'fixture leftover view-transition lecture paints after style/script strip');
assert.match(afterStyleScript(LIVE), /Dasha canonical URL/, 'fixture leftover canonical comment paints after style/script strip');
assert.match(LIVE, /data:image\/svg\+xml/, 'fixture keeps cherries SVG');
assert.match(afterStyleScript(LIVE), /class=["']w-embed w-script["']/, 'fixture leftover empty w-embed paints after style/script strip');
assert.match(LIVE, /signin-menu/, 'fixture has leftover Sign in menu');
assert.match(LIVE, /installSignin/, 'fixture leftover hamburger removes grok-door');
assert.match(LIVE, /id=["']grok-door["']/, 'fixture has grok-door product');
assert.equal((LIVE.match(/class=["']w-embed w-script["']/g) || []).length, 2, 'fixture has leftover + product w-embed');

const dropped = stripHomeDashaNav(LIVE);
assert.doesNotMatch(dropped, /<nav class="dasha-nav">/, 'stripHomeDashaNav drops the leftover nav');
assert.doesNotMatch(dropped, /<nav class="nav wrap"/, 'stripHomeDashaNav drops leftover wrap nav from the document');
assert.doesNotMatch(dropped, /aria-label=["']Main navigation["']/, 'drops Main navigation');
assert.doesNotMatch(dropped, /class=["']login-link["']/, 'drops leftover wrap-nav Log in');
assert.doesNotMatch(dropped, /data-dasha-login-link>/, 'drops leftover wrap-nav login link');
assert.doesNotMatch(dropped, />Log in</, 'no Log in label');
assert.doesNotMatch(dropped, /<footer\b/i, 'drops leftover home footer from the document');
assert.doesNotMatch(dropped, /class=["']skip-link["']/, 'drops leftover skip-link from the document');
assert.doesNotMatch(dropped, /Skip to content/, 'no Skip to content label');
assert.doesNotMatch(visible(dropped), /\$\s*DASHA\s+Lobby\s+Faucet\s+Mint\s+How to buy\s+Log in/i, 'wrap-nav labels gone after style/script strip');
assert.doesNotMatch(visible(dropped), /Skip to content/, 'skip-link label gone after style/script strip');
assert.match(dropped, /id=["']simp-door["']/, 'quiz door stays after nav drop');
assert.match(dropped, /<header class="bar">/, 'header.bar stays after wrap nav drop');
assert.match(dropped, /id=["']chat-door["']/, 'chat-door stays after wrap nav drop');
assert.ok(dropped.includes('<body>'), 'body stays after wrap nav drop');
assert.match(dropped, />Buy</, 'Buy stays after wrap nav drop');
assert.ok(dropped.length > 400 && dropped.includes('<body>'), 'wrap nav drop cannot blank the fixture');
assert.ok(dropped.length > LIVE.length * 0.4, 'wrap nav drop is per-element, not eat-the-page');


const booted = stripHomeWebflowBoot(LIVE);
assert.doesNotMatch(booted, /This site was created in Webflow/, 'drops leftover Webflow comment');
assert.doesNotMatch(booted, /Last Published:/, 'drops leftover Last Published comment');
assert.doesNotMatch(booted, /name=["']generator["']/, 'drops leftover Webflow generator');
assert.doesNotMatch(booted, /cdn\.prod\.website-files\.com\/img\/favicon\.ico/, 'drops leftover Webflow default favicon.ico');
assert.doesNotMatch(booted, /w-mod-/, 'drops leftover w-mod-js boot');
assert.doesNotMatch(booted, /jquery-3\.5\.1/, 'drops leftover jquery');
assert.doesNotMatch(booted, /\/js\/webflow/, 'drops leftover webflow.js');
assert.doesNotMatch(booted, /data-wf-page/, 'drops leftover data-wf-page');
assert.doesNotMatch(booted, /lobby\/studio\/desk/, 'drops leftover Studio/Desk CSS comment');
assert.doesNotMatch(booted, /\.dasha-nav\s*\{/, 'drops leftover dasha-nav hide CSS');
assert.doesNotMatch(booted, /__WEBFLOW_CURRENCY_SETTINGS/, 'drops leftover Webflow commerce currency');
assert.doesNotMatch(booted, /CommercePrice/, 'no leftover CommercePrice template');
assert.doesNotMatch(afterStyleScript(booted), /RETIRED product'?s mark/, 'drops leftover RETIRED icon comment');
assert.doesNotMatch(afterStyleScript(booted), /Do not reintroduce a page-level icon/, 'drops leftover page-level-icon comment');
assert.doesNotMatch(afterStyleScript(booted), /Dasha site icon: slot-machine cherries/, 'drops leftover cherries lecture comment');
assert.doesNotMatch(afterStyleScript(booted), /regenerate the PNGs/, 'drops leftover PNG lecture');
assert.doesNotMatch(afterStyleScript(booted), /Cross-document view transitions/, 'drops leftover view-transition lecture comment');
assert.doesNotMatch(afterStyleScript(booted), /another agent is mid-rewrite/, 'drops leftover agent-process lecture');
assert.doesNotMatch(afterStyleScript(booted), /Dasha canonical URL/, 'drops leftover canonical comment');
assert.match(booted, /data:image\/svg\+xml/, 'cherries SVG stays after leftover icon comment drop');
assert.match(booted, /@view-transition/, '@view-transition stays after leftover comment drop');
assert.match(booted, /<header class="bar">/, 'header.bar stays after Webflow boot drop');
assert.match(booted, /id=["']simp-door["']/, 'quiz door stays after Webflow boot drop');
assert.match(booted, /id=["']chat-door["']/, 'chat-door stays after Webflow boot drop');
assert.match(booted, />Buy</, 'Buy stays after Webflow boot drop');
assert.doesNotMatch(booted, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(booted.length > LIVE.length * 0.4, 'Webflow boot drop is per-tag, not eat-the-page');
assert.doesNotMatch(booted, /signin-menu/, 'drops leftover Sign in menu embed');
assert.doesNotMatch(booted, /installSignin/, 'drops leftover hamburger that removes grok-door');
assert.doesNotMatch(booted, /data-dasha-signin-menu/, 'drops leftover signin-menu attr');
assert.doesNotMatch(booted, /#grok-door\{display:none/, 'drops leftover grok-door hide');
assert.match(booted, /id=["']grok-door["']/, 'grok-door stays after leftover Sign in menu drop');
assert.match(booted, /x-connect\.js/, 'x-connect.js stays after leftover Sign in menu drop');
assert.match(booted, /@view-transition/, 'product CSS stays after leftover wrapper unwrap');
assert.match(booted, /<style>@view-transition/, 'product CSS style tag stays unwrapped');
assert.match(booted, /<main class="dasha"/, 'nested product main stays after unwrap');
assert.match(booted, /<h1>\$dasha<\/h1>/, 'nested product h1 stays after unwrap');
assert.doesNotMatch(booted, /class=["']w-embed w-script["']/, 'leftover + product Webflow wrappers gone');
assert.doesNotMatch(afterStyleScript(booted), /w-embed w-script/, 'no leftover w-embed chrome after style/script strip');


const signinGone = stripHomeLeftoverSigninMenu(LIVE);
assert.doesNotMatch(signinGone, /signin-menu/, 'stripHomeLeftoverSigninMenu drops leftover hamburger');
assert.doesNotMatch(signinGone, /installSignin/, 'drops leftover installSignin');
assert.match(signinGone, /id=["']grok-door["']/, 'grok-door stays');
assert.match(signinGone, /x-connect\.js/, 'product x-connect stays');
assert.match(signinGone, /@view-transition/, 'product CSS embed stays');
assert.match(signinGone, /class=["']w-embed w-script["']/, 'product wrapper still present until unwrap');
assert.doesNotMatch(afterStyleScript(signinGone), /signin-menu/, 'leftover Sign in class gone after style/script strip');
assert.ok(signinGone.length > LIVE.length * 0.4, 'signin drop is per-embed, not eat-the-page');

const unwrapped = unwrapHomeProductWembed(signinGone);
assert.doesNotMatch(unwrapped, /class=["']w-embed w-script["']/, 'unwrapHomeProductWembed drops leftover Webflow wrapper');
assert.match(unwrapped, /@view-transition/, 'unwrap keeps product CSS');
assert.match(unwrapped, /x-connect\.js/, 'unwrap keeps x-connect.js');
assert.match(unwrapped, /<main class="dasha"/, 'unwrap keeps nested product main (not first-div eat)');
assert.match(unwrapped, /<h1>\$dasha<\/h1>/, 'unwrap keeps nested product h1');
assert.match(unwrapped, /id=["']grok-door["']/, 'unwrap keeps grok-door');
assert.doesNotMatch(afterStyleScript(unwrapped), /w-embed w-script/, 'unwrapped leftover chrome gone after style/script strip');
assert.ok(unwrapped.length > LIVE.length * 0.4, 'unwrap is per-wrapper, not eat-the-page');

const menu = stripSimpFromMenuAndFooter(dropped);
assert.ok(!navChunks(menu).some(hasSimpHref), 'no href=/simp in remaining nav');
assert.ok(!footerChunks(menu).some(hasSimpHref), 'Potter lock: Simp out of footer');
assert.match(menu, /id=["']simp-door["']/, 'quiz door stays');
assert.match(menu, /href="\/simp">Take the quiz</, 'quiz door still links /simp');

const computeGone = stripHomeCompute(LIVE);
assert.doesNotMatch(computeGone, /id=["']compute-door["']/, 'stripHomeCompute drops the door, not CSS-hide only');

const painted = attachLlmsHtmlLinks(stripHomeOtherCoinWarning(stripDeadNav(LIVE)));
assert.doesNotMatch(painted, /<nav class="dasha-nav">/, 'home rewrite drops leftover dasha-nav');
assert.doesNotMatch(painted, /\.dasha-nav\s*\{/, 'home rewrite drops leftover dasha-nav hide CSS');
assert.doesNotMatch(painted, /<nav class="nav wrap"/, 'home rewrite drops leftover wrap nav');
assert.doesNotMatch(painted, /<nav class="nav"/, 'home rewrite drops leftover nav.nav');
assert.doesNotMatch(painted, /<footer\b/i, 'home rewrite drops leftover home footer');
assert.doesNotMatch(painted, /class=["']skip-link["']/, 'home rewrite drops leftover skip-link');
assert.doesNotMatch(painted, /Skip to content/, 'home rewrite has no Skip to content');
assert.doesNotMatch(painted, /This site was created in Webflow/, 'home rewrite drops leftover Webflow comment');
assert.doesNotMatch(painted, /name=["']generator["']/, 'home rewrite drops leftover Webflow generator');
assert.doesNotMatch(painted, /cdn\.prod\.website-files\.com\/img\/favicon\.ico/, 'home rewrite drops leftover Webflow favicon.ico');
assert.doesNotMatch(painted, /jquery-3\.5\.1/, 'home rewrite drops leftover jquery');
assert.doesNotMatch(painted, /\/js\/webflow/, 'home rewrite drops leftover webflow.js');
assert.doesNotMatch(painted, /w-mod-/, 'home rewrite drops leftover w-mod-js');
assert.doesNotMatch(painted, /lobby\/studio\/desk/, 'home rewrite drops leftover Studio/Desk claim');
assert.doesNotMatch(painted, /data-wf-page/, 'home rewrite drops leftover data-wf-page');
assert.doesNotMatch(painted, /__WEBFLOW_CURRENCY_SETTINGS/, 'home rewrite drops leftover Webflow commerce currency');
assert.doesNotMatch(painted, /CommercePrice/, 'home rewrite has no leftover CommercePrice');
assert.doesNotMatch(afterStyleScript(painted), /RETIRED product'?s mark/, 'home rewrite drops leftover RETIRED icon comment');
assert.doesNotMatch(afterStyleScript(painted), /Do not reintroduce a page-level icon/, 'home rewrite drops leftover page-level-icon comment');
assert.doesNotMatch(afterStyleScript(painted), /Dasha site icon: slot-machine cherries/, 'home rewrite drops leftover cherries lecture');
assert.doesNotMatch(afterStyleScript(painted), /Cross-document view transitions/, 'home rewrite drops leftover view-transition lecture');
assert.doesNotMatch(afterStyleScript(painted), /Dasha canonical URL/, 'home rewrite drops leftover canonical comment');
assert.match(painted, /data:image\/svg\+xml/, 'home rewrite keeps cherries SVG');
assert.doesNotMatch(painted, /signin-menu/, 'home rewrite drops leftover Sign in menu');
assert.doesNotMatch(painted, /installSignin/, 'home rewrite drops leftover hamburger');
assert.doesNotMatch(afterStyleScript(painted), /signin-menu/, 'rewrite leftover Sign in gone after style/script strip');
assert.doesNotMatch(painted, /class=["']w-embed w-script["']/, 'home rewrite unwraps leftover product CSS Webflow wrapper');
assert.doesNotMatch(afterStyleScript(painted), /w-embed w-script/, 'rewrite leftover w-embed gone after style/script strip');
assert.match(painted, /id=["']grok-door["']/, 'home rewrite keeps grok-door');
assert.match(painted, /x-connect\.js/, 'home rewrite keeps x-connect.js');
assert.match(painted, /@view-transition/, 'home rewrite keeps product view-transitions');
assert.match(painted, /<main class="dasha"/, 'home rewrite keeps nested product main');
assert.doesNotMatch(visible(painted), /\$\s*DASHA\s+Lobby\s+Faucet\s+Mint\s+How to buy\s+Log in/i, 'rewrite wrap-nav labels gone');
assert.doesNotMatch(visible(painted), /Skip to content/, 'rewrite skip-link labels gone');
assert.ok(!navChunks(painted).some(hasSimpHref), 'no href=/simp in any nav');
assert.ok(!footerChunks(painted).some(hasSimpHref), 'no href=/simp in footer');
assert.doesNotMatch(painted, /id=["']compute-door["']/, 'no compute-door element');
assert.doesNotMatch(painted, /px\.gif/, 'no px.gif');
assert.match(painted, /id=["']simp-door["']/, 'keeps quiz door');
assert.match(painted, /href="\/simp">Take the quiz</, 'quiz door still links /simp');
assert.match(painted, /id=["']chat-door["']/, 'keeps chat-door');
assert.match(painted, /id=["']dasha-home-faucet["']|id=["']dasha-faucet["']/, 'keeps faucet');
assert.match(painted, /<header class="bar">/, 'keeps header.bar');
assert.match(painted, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/, 'describedby /llms.txt');
assert.match(painted, /<link rel="describedby" href="\/llms-full\.txt" type="text\/plain">/, 'describedby /llms-full.txt');
assert.match(painted, /jup\.ag\/swap/, 'jup.ag');
assert.match(painted, new RegExp(MINT), 'mint');
assert.doesNotMatch(painted, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.doesNotMatch(painted, /Designer/, 'no Designer');
assert.doesNotMatch(painted, /href="\/studio/, 'no Studio door');

const paint = firstPaint(painted);
assert.match(paint, /\$<b>dasha<\/b>/, 'first paint $dasha');
assert.match(paint, /href="\/lobby">Chat</, 'first paint Chat');
assert.match(paint, />Buy</, 'first paint Buy');
assert.match(paint, /id=["']simp-door["']/, 'quiz on first paint');
assert.doesNotMatch(paint, /<nav class="dasha-nav">/, 'first paint has no leftover dasha-nav');
assert.doesNotMatch(paint, /<nav class="nav wrap"/, 'first paint has no leftover wrap nav');
assert.doesNotMatch(paint, /<footer\b/i, 'first paint has no leftover footer');
assert.doesNotMatch(paint, /Skip to content/, 'first paint has no Skip to content');
assert.doesNotMatch(visible(paint), /Log in/, 'first paint has no Log in');
assert.doesNotMatch(visible(paint), /Skip to content/, 'first paint visible has no Skip to content');

{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200);
  assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  const privacyHtml = await privacy.text();
  assert.match(privacyHtml, /<h1>Privacy<\/h1>/);
  assert.match(
    privacyHtml,
    /Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards\./,
  );
  assert.match(privacyHtml, /class=["']skip-link["']/, 'privacy product skip-link stays');
  assert.match(privacyHtml, /Skip to content/, 'privacy Skip to content stays');
  assert.match(privacyHtml, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
}

{
  const digest = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest.json'), {});
  assert.equal(digest.status, 200);
  assert.equal(digest.headers.get('x-dasha-edge'), 'digest-json');
  const pack = JSON.parse(await digest.text());
  assert.ok(pack.at);
  assert.ok(Array.isArray(pack.items));
}

function chromeHide(html) {
  const m = String(html).match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i);
  return m ? m[0] : '';
}

{
  const hide = chromeHide(painted);
  assert.match(hide, /id=["']dasha-home-chrome-hide["']/, 'chrome-hide style present');
  assert.doesNotMatch(hide, /#compute-door/, 'chrome-hide does not lecture dropped compute-door');
  assert.doesNotMatch(hide, /footer/, 'chrome-hide does not lecture dropped leftover footer');
  assert.doesNotMatch(hide, /\.navlinks/, 'chrome-hide does not lecture dropped .navlinks');
  assert.doesNotMatch(hide, /\.dasha-nav/, 'chrome-hide does not lecture dropped .dasha-nav');
  assert.doesNotMatch(hide, /nav\.nav/, 'chrome-hide does not lecture dropped nav.nav');
  assert.doesNotMatch(hide, /\.skip-link/, 'chrome-hide does not lecture dropped leftover skip-link');
  assert.doesNotMatch(hide, /\.compute/, 'chrome-hide does not lecture dropped .compute');
  assert.doesNotMatch(hide, /\.poster/, 'chrome-hide does not lecture dropped poster');
  assert.match(hide, /\.ticker/, 'Watch belt still hides ticker');
  assert.match(hide, /\.price/, 'Watch belt still hides price');
  assert.doesNotMatch(hide, /a\[href=["']\/chess/, 'chrome-hide CSS does not name /chess');
  assert.doesNotMatch(hide, /a\[href=["']\/studio/, 'chrome-hide CSS does not name /studio');
  assert.doesNotMatch(hide, /a\[href=["']\/dasha/, 'chrome-hide CSS does not name /dasha');
  assert.doesNotMatch(hide, /a\[href=["']\/desk/, 'chrome-hide CSS does not name /desk');
  assert.doesNotMatch(hide, /a\[href=["']\/compute/, 'chrome-hide CSS does not name /compute');
  assert.doesNotMatch(hide, /a\[href=["']\/verse/, 'chrome-hide CSS does not name /verse');
  assert.doesNotMatch(hide, /a\[href=["']\/learn/, 'chrome-hide CSS does not name /learn');
  assert.doesNotMatch(hide, /a\[href=["']\/graph/, 'chrome-hide CSS does not name /graph');
  assert.doesNotMatch(hide, /plugin\.jup\.ag/);
  assert.doesNotMatch(hide, /t\.me/);
}

{
  const hide = chromeHide(hideHomeExtraChrome('<html><head></head><body></body></html>'));
  assert.doesNotMatch(hide, /a\[href=/);
  assert.doesNotMatch(hide, /#compute-door/);
  assert.match(painted, /id=["']simp-door["']/, 'quiz #simp-door stays after hide');
}

console.log('dasha-home-chrome-leftover: PASS (dasha-nav + nav.nav wrap + home footer + skip-link + Webflow boot + leftover commerce currency + leftover RETIRED icon comment + leftover cherries-lecture / view-transition-lecture / canonical-URL comments + leftover Sign in menu w-embed + leftover product CSS Webflow wrapper unwrapped + compute-door DOM-stripped; chrome-hide CSS lecture of dropped selectors gone; Watch price/ticker belt stays; cherries SVG stays; @view-transition stays; product CSS + x-connect.js stay; quiz door stays; grok-door stays; privacy skip-link stays; chrome-hide CSS no retired hrefs; describedby; privacy; digest.json)');
