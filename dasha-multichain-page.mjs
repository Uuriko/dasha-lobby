import { CHAIN_REGISTRY, SOURCE_NETWORKS, ARRIVAL_ASSETS, buildAcquisitionRoute } from './dasha-multichain-policy.mjs';

const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const external = (href, label, primary = false) => '<a class="' + (primary ? 'button' : 'text-link') + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' ↗</a>';

export function multichainHtml({ from = 'base', via = 'sol', error = false } = {}) {
  const route = error ? null : buildAcquisitionRoute(from, via);
  const sourceOptions = Object.entries(SOURCE_NETWORKS).map(([id, name]) => '<option value="' + id + '"' + (id === from ? ' selected' : '') + '>' + name + '</option>').join('');
  const assetOptions = Object.entries(ARRIVAL_ASSETS).map(([id, asset]) => '<option value="' + id + '"' + (id === via ? ' selected' : '') + '>' + asset.symbol + ' on Solana</option>').join('');
  const bridge = route?.kind === 'bridge-then-swap';
  const originInstruction = from === 'other' ? 'your source network' : SOURCE_NETWORKS[from];
  const routeBody = !route ? '<p role="alert">Choose one of the listed networks and SOL or USDC on Solana, then show your steps.</p>' : `
    <div class="route-label"><span>Your route</span><span>${bridge ? 'Two separate steps' : 'Already on Solana'}</span></div>
    <h2>${bridge ? esc(route.sourceLabel) + ' → Solana → $dasha' : esc(route.arrivalSymbol) + ' → $dasha'}</h2>
    <ol class="steps">
      ${bridge ? `<li><span class="number">01</span><div><h3>Bring ${esc(route.arrivalSymbol)} to Solana</h3>
        <p>Open Jupiter’s bridge. Choose ${esc(originInstruction)} as the source, Solana as the destination, and ${esc(route.arrivalSymbol)} as the output. Enter a Solana wallet you control.</p>
        <p class="quiet">Choose these settings again on Jupiter. It checks availability and shows the quote, fees, and provider terms.</p>
        ${external(route.bridgeUrl, 'Open Jupiter bridge', true)}
        <p class="footnote">This step receives ${esc(route.arrivalSymbol)}. The $dasha swap is separate.</p>
      </div></li>` : ''}
      <li><span class="number">${bridge ? '02' : '01'}</span><div>
        <h3>${bridge ? 'After arrival, swap for $dasha' : 'Swap for $dasha'}</h3>
        <p>${bridge ? 'Confirm the ' + esc(route.arrivalSymbol) + ' is available in your Solana wallet. Then open the swap below.' : 'Open Jupiter with ' + esc(route.arrivalSymbol) + ' selected as the sell asset.'} The buy token is the full mint shown here.</p>
        ${external(route.swapUrl, 'Swap ' + route.arrivalSymbol + ' for $dasha', !bridge)}
        <p class="footnote">Keep SOL available for Solana network fees. Review the final amount and slippage on Jupiter.</p>
      </div></li>
    </ol>
    <p class="route-note">This page shows the steps. It does not check your wallet or confirm a transfer.</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Get $dasha from another chain</title>
<meta name="description" content="Choose your starting network, bring SOL or USDC to Solana, and swap for the exact $dasha mint.">
<link rel="canonical" href="https://www.getdasha.com/multichain"><link rel="stylesheet" href="/multichain/style.css"></head>
<body><a class="skip" href="#main">Skip to route</a>
<header><a class="wordmark" href="/">$dasha</a><nav aria-label="Main"><a href="/lobby">Lobby</a><a href="/how-to-buy">How to buy</a></nav></header>
<main id="main"><div class="intro"><p class="eyebrow">Dasha across chains</p><h1>Start elsewhere.<br>Arrive with $dasha.</h1>
<p>The final token stays on Solana. Choose where you’re starting.</p></div>
<div class="workspace"><section class="controls" aria-labelledby="choose"><h2 id="choose">Start with your network</h2>
<form action="/multichain" method="get"><label for="from">Where are your funds?</label><select name="from" id="from">${sourceOptions}</select>
<label for="via">Asset to use on Solana</label><select name="via" id="via">${assetOptions}</select><button class="button" type="submit">Show my steps</button></form>
<section class="identity" aria-labelledby="mint-title"><p class="eyebrow">Final destination · Solana</p><h3 id="mint-title">The exact $dasha mint</h3>
<code tabindex="0" aria-label="Canonical Dasha mint">${CHAIN_REGISTRY.canonical.mint}</code>
<p class="footnote">Select the full address to copy it.</p>${external(CHAIN_REGISTRY.canonical.explorer, 'View on Solscan')}
</section></section>
<section class="route" aria-label="Acquisition steps">${routeBody}</section></div>
<section class="network-note"><h2>Which chain is $dasha on?</h2>
<p>The project’s token registry currently lists the Solana mint above. A Base representation has not been configured. Starting with funds on another chain still ends with $dasha on Solana.</p>
<a href="/.well-known/dasha-chains.json">View token registry</a></section></main>
<footer><a href="/">Home</a><a href="/lobby">Join the room</a><a href="/privacy">Privacy</a><span>Explore Dasha without a wallet.</span></footer>
</body></html>`;
}

export const MULTICHAIN_CSS = `
:root{color-scheme:dark;--paper:#f5f2e8;--ink:#171714;--acid:#dfff00;--line:#45463c;--muted:#babbae;font-family:Arial,Helvetica,sans-serif;font-size:16px}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--paper)}a{color:inherit;text-underline-offset:.25em}
header,main,footer{width:min(1120px,calc(100% - 48px));margin-inline:auto}header{min-height:96px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid var(--line)}
.wordmark{font-size:2rem;font-weight:900;letter-spacing:-.07em;text-decoration:none}nav{display:flex;flex-wrap:wrap;gap:24px}nav a,footer a{display:inline-flex;align-items:center;min-height:48px;font-size:.9rem}
.skip{position:absolute;left:16px;top:-100px;background:var(--acid);color:var(--ink);padding:16px;z-index:10}.skip:focus{top:8px}
.intro{padding:40px 0 30px}.eyebrow{text-transform:uppercase;letter-spacing:.11em;font-weight:700;font-size:.8rem;color:var(--acid)}
h1{font-size:clamp(2.1rem,5.4vw,4.25rem);line-height:1.04;letter-spacing:-.055em;margin:14px 0 18px}h1 br{display:none}
p{line-height:1.55;margin:0 0 18px}h2{font-size:1.3rem;line-height:1.25;letter-spacing:-.02em;margin:0 0 24px}h3{font-size:1.15rem;line-height:1.35;margin:0 0 12px}
.intro>p:last-child{color:var(--muted);margin:0}.workspace{display:grid;grid-template-columns:minmax(250px,.8fr) minmax(0,1.35fr);border:1px solid var(--line)}
.controls{padding:32px;background:#22231d}.route{padding:32px;border-left:1px solid var(--line)}form{display:grid;gap:12px}label{font-size:.95rem;font-weight:700}select{font:inherit;min-width:0;width:100%;min-height:52px;padding:12px 36px 12px 14px;background:var(--paper);color:var(--ink);border:1px solid var(--paper);border-radius:0;margin-bottom:8px}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:14px 22px;background:var(--acid);color:var(--ink);border:1px solid var(--acid);font:700 1rem/1.3 Arial,Helvetica,sans-serif;text-align:center;text-decoration:none;cursor:pointer}.button:hover{background:#eefc81;border-color:#eefc81}
:focus-visible{outline:3px solid #91bfff;outline-offset:5px}.identity{margin-top:32px;padding-top:28px;border-top:1px solid var(--line)}.identity h3{font-size:1rem}code{display:block;overflow-wrap:anywhere;user-select:all;font:1rem/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;padding:14px;background:var(--paper);color:var(--ink)}
.footnote{font-size:.85rem;color:var(--muted);margin:12px 0 16px}.text-link{display:inline-block;font-weight:700;line-height:1.6;padding-block:10px}.route-label{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--muted);margin-bottom:18px}.route h2{font-size:clamp(1.5rem,3vw,2rem);overflow-wrap:anywhere}
.steps{list-style:none;margin:0;padding:0}.steps li{display:grid;grid-template-columns:32px minmax(0,1fr);gap:16px;padding:28px 0;border-top:1px solid var(--line)}.steps li:last-child{padding-bottom:0}.number{font:700 .9rem/1.5 ui-monospace,monospace;color:var(--acid)}.quiet,.route-note{color:var(--muted);font-size:.95rem}.route-note{border-top:1px solid var(--line);padding-top:20px;margin:12px 0 0}
.network-note{max-width:760px;padding:32px 0 44px}.network-note h2{margin-bottom:12px}.network-note p{color:var(--muted)}footer{border-top:1px solid var(--line);padding-block:16px 28px;display:flex;align-items:center;flex-wrap:wrap;gap:12px 24px}footer span{margin-left:auto;color:var(--muted);font-size:.9rem}
@media(max-width:720px){header,main,footer{width:calc(100% - 32px)}header{min-height:80px;gap:16px}nav{gap:14px}.intro{padding-top:28px}h1 br{display:block}.workspace{grid-template-columns:minmax(0,1fr)}.controls,.route{padding:24px}.route{border-left:0;border-top:1px solid var(--line)}.steps li{grid-template-columns:24px minmax(0,1fr);gap:12px}footer span{margin-left:0;width:100%}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;
