/** Live overlay share HTML (2026-08-16).
 *  Wire: productEdge GET /simp → simpPageHtml(); DO GET /simp/r/:id → simpResultHtml();
 *        GET /?challenge=id → 308 challengeRedirectPath(); GET /quiz → 308 /simp.
 *  The pin comes from the generated bundle so /simp cannot drift to a fourth hardcoded hash.
 */
import { normalizeSimpSpotlight, quizTitle } from './dasha-simp-score.mjs';
import { SIMP_BOARD_SRI } from './dasha-lobby-static-gen.mjs';

export const WWW = 'https://www.getdasha.com';
export const LOBBY = 'https://lobby.getdasha.com';
export { SIMP_BOARD_SRI as LIVE_SIMP_BOARD_SRI };
export const SOCIAL_CARD = `${LOBBY}/og/dasha-social-card.png`;
export const RESULT_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
export const RETIRED_SEO_PATHS = new Set([
  '/airdrop', '/airdrop/', '/earn', '/earn/', '/claim', '/claim/', '/rally', '/rally/',
]);
const JUP =
  'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function challengeRedirectPath(search) {
  const raw = search instanceof URLSearchParams
    ? search.get('challenge')
    : new URLSearchParams(String(search || '').replace(/^\?/, '')).get('challenge');
  const id = String(raw || '');
  return RESULT_ID_RE.test(id) ? `/simp/r/${id}` : null;
}

export function isRetiredSeoPath(pathname) {
  return RETIRED_SEO_PATHS.has(String(pathname || ''));
}

export function quizRedirectPath() {
  return '/simp';
}

function ogBlock({ title, description, url, image, width, height }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  const img = escapeHtml(image);
  return [
    `<meta property="og:type" content="website"><meta property="og:site_name" content="getdasha"><meta property="og:url" content="${u}">`,
    `<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">`,
    `<meta property="og:image" content="${img}"><meta property="og:image:secure_url" content="${img}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="${width}"><meta property="og:image:height" content="${height}"><meta property="og:image:alt" content="${t}">`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@dash_eats"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${img}"><meta name="twitter:image:alt" content="${t}">`,
  ].join('\n');
}

export function simpPageHtml({ sri = SIMP_BOARD_SRI } = {}) {
  const title = '$dasha / Beat this';
  const description = 'How big of a Dasha simp are you?';
  const url = `${WWW}/simp`;
  const image = `${WWW}/og/simp`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="canonical" href="${url}">
<meta name="description" content="${description}">
<meta name="theme-color" content="#dfff00">
${ogBlock({ title, description, url, image, width: 1200, height: 630 })}
<style>:root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00;--hot:#ff3b81}html,body{margin:0;min-height:100%;background:var(--ink);color:var(--paper);font:16px/1.45 Arial,Helvetica,sans-serif}h1{margin:0 0 .5rem;font:900 clamp(3rem,12vw,6rem)/.9 "Arial Black",Arial,Helvetica,sans-serif}a{color:var(--acid)}.skip-link{position:absolute;left:-9999px;top:0;z-index:100;padding:12px 16px;background:var(--acid);color:var(--ink)!important;font-weight:900;text-decoration:none}.skip-link:focus{left:12px;top:12px;outline:3px solid var(--paper);outline-offset:2px}.dasha-slim{display:flex;align-items:center;gap:.65rem;padding:.45rem 1rem}.dasha-word{display:inline-flex;align-items:center;min-height:48px;color:#f4eddb;font:900 1.15rem/1 "Arial Black",Helvetica,Arial,sans-serif;letter-spacing:-.04em;text-decoration:none;text-transform:uppercase}.buy-dasha{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 1rem;background:#dfff00;color:#070608;font:900 1rem/1 "Arial Black",Helvetica,Arial,sans-serif;text-decoration:none;text-transform:uppercase}#dasha-quiz{margin-top:2rem;padding-top:1rem;border-top:1px solid var(--acid)}.simp-lede{margin:0 0 1.25rem;font:900 clamp(1.35rem,3.4vw,2rem)/1.15 "Arial Black",Helvetica,Arial,sans-serif}.simp-quiz-go{display:inline-flex;align-items:center;justify-content:center;min-height:56px;min-width:12rem;padding:0 1.25rem;border:0;background:#dfff00;color:#070608;font:900 1rem/1 "Arial Black",Helvetica,Arial,sans-serif;box-shadow:4px 4px 0 #ff3b81;cursor:pointer}footer.dasha-foot{margin:0;padding:1.5rem 1rem 2rem;font:900 1rem/1.3 Arial,Helvetica,sans-serif}footer.dasha-foot p{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;justify-content:center;margin:0}footer.dasha-foot a{display:inline-flex;align-items:center;min-height:48px;min-width:48px;padding:0 .4rem;color:var(--paper);text-decoration:none}footer.dasha-foot a:hover{color:var(--acid)}</style>
<body>
<a class="skip-link" href="#dasha-quiz">Skip to quiz</a>
<header class="dasha-slim"><a class="dasha-word" href="${WWW}/">$dasha</a><a class="buy-dasha" href="${JUP}" target="_blank" rel="noopener noreferrer">Buy $dasha</a></header>
<main>
<h1>Simp</h1>
<div id="dasha-quiz" class="dasha-quiz"><div id="dasha-simp-board"><p class="simp-lede">How big of a Dasha simp are you?</p>
<button type="button" class="simp-quiz-go" data-dasha-take-quiz>Take Quiz</button>
<noscript><p>Needs JavaScript.</p></noscript></div></div>
</main>
<script>(function(){var s=document.createElement('script');s.src='${LOBBY}/client/simp-board.js';s.integrity='${sri}';s.crossOrigin='anonymous';s.defer=true;document.head.appendChild(s)})();</script>
<footer class="dasha-foot"><p><a href="${WWW}/how-to-buy">How to buy</a> · <a href="${WWW}/privacy">Privacy</a></p></footer>
</body></html>`;
}

function simpMemberIdentity({ handle, rank, total }) {
  const clean = String(handle || '').replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) throw new Error('bad member handle');
  if (!Number.isInteger(rank) || rank < 2) throw new Error('bad member rank');
  if (!Number.isInteger(total) || total < 0) throw new Error('bad member total');
  return { clean, canonicalHandle: clean.toLowerCase() };
}

export function simpMemberHtml({ handle, rank, total, components, spotlight, holder, quiz, badges }) {
  const { clean, canonicalHandle } = simpMemberIdentity({ handle, rank, total });
  const identity = `@${clean} · #${rank} on the $dasha Simp Board`;
  const quizCorrect = Number(quiz?.correct);
  const quizTotal = Number(quiz?.total);
  const quizMark = Number.isInteger(quizCorrect) && Number.isInteger(quizTotal) && quizTotal > 0 && quizCorrect >= 0 && quizCorrect <= quizTotal
    ? `${quizTitle(quizCorrect, quizTotal)} · ${quizCorrect}/${quizTotal}`
    : '';
  const description = `${total} Simp Points${quizMark ? ` · ${quizMark}` : ''} · current measured rank.`;
  const componentParts = [
    ['linked_x', 'X'], ['quiz', 'Quiz'], ['creative', 'Create'], ['community', 'Community'],
    ['connector', 'Connect'], ['oss', 'OSS'], ['donate', 'Faucet'],
  ].map(([key, label]) => [label, Number(components?.[key])]).filter(([, points]) => Number.isInteger(points) && points > 0);
  const breakdown = componentParts.length && componentParts.reduce((sum, [, points]) => sum + points, 0) === total
    ? `<p class="breakdown" aria-label="Simp Point breakdown">${componentParts.map(([label, points]) => `${label} ${points}`).join(' · ')}</p>`
    : '';
  const earnedLabels = [
    ['maker', 'Maker'], ['remixer', 'Remixer'], ['helper', 'Helper'],
    ['lobby_regular', 'Lobby regular'], ['maintainer', 'Maintainer'],
  ].filter(([key]) => Array.isArray(badges) && badges.includes(key)).map(([, label]) => label);
  const earned = earnedLabels.length ? `<p class="earned" aria-label="Earned badges">${earnedLabels.join(' · ')}</p>` : '';
  const url = `${WWW}/simp/u/${canonicalHandle}`;
  const xProfile = `https://x.com/${canonicalHandle}`;
  const image = `${url}/card.png`;
  const profileJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: { '@type': 'Person', name: `@${clean}`, alternateName: clean, url, description, image, sameAs: [xProfile] },
  });
  const rowUrl = `${WWW}/simp#member-${canonicalHandle}`;
  const badgeUrl = `${url}/badge.svg`;
  const badgeAlt = `@${clean} is #${rank} on the $dasha Simp Board${holder === true ? ', holder check current' : ''}`;
  const badgeMarkdown = `[![${badgeAlt}](${badgeUrl})](${url})`;
  const shareText = `${identity}\n${description}\n$dasha`;
  const cardTitle = holder === true ? `${identity} · holder check current` : identity;
  const publicSpotlight = normalizeSimpSpotlight(spotlight?.url).spotlight;
  const spotlightLink = publicSpotlight
    ? `<a href="${escapeHtml(publicSpotlight.url)}" target="_blank" rel="noopener noreferrer nofollow ugc">${publicSpotlight.platform} Spotlight ↗</a> · `
    : '';
  const holderMark = holder === true ? `<span class="holder">Holder proof current</span> · <a href="${WWW}/chess">Rated chess</a> · <a href="${WWW}/lobby">500-char chat</a> · ` : '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${identity}</title>
<link rel="canonical" href="${url}">
<meta name="description" content="${description}">
<meta name="theme-color" content="#dfff00">
  ${ogBlock({ title: cardTitle, description, url, image, width: 600, height: 314 })}
<script type="application/ld+json">${profileJsonLd}</script>
<style>:root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00;--hot:#ff3b81}body{font:16px/1.45 Arial,Helvetica,sans-serif;background:var(--ink);color:var(--paper);max-width:32rem;margin:3rem auto;padding:0 1rem}h1{font:900 clamp(2.4rem,9vw,4rem)/.92 "Arial Black",Arial,Helvetica,sans-serif;margin:0 0 .8rem}.rank,.holder{color:var(--acid)}.holder{font-weight:900;text-transform:uppercase}.breakdown,.earned{color:var(--acid);font-weight:900}a{color:var(--acid)}.cta,.badge-copy{display:inline-flex;align-items:center;min-height:48px;padding:0 1rem;border:0;background:var(--acid);color:var(--ink);font-weight:900;text-decoration:none;cursor:pointer}.badge-copy{margin-top:.6rem}summary{min-height:48px;display:flex;align-items:center;color:var(--acid);font-weight:900;cursor:pointer}textarea{box-sizing:border-box;width:100%;min-height:5rem;padding:.7rem;border:1px solid var(--acid);background:#160f1d;color:var(--paper);resize:vertical}</style>
<body><main><p class="rank">Current measured rank</p><h1>${identity}</h1><p>${description}</p>${breakdown}${earned}<p><a class="cta" href="${rowUrl}">See the board</a> <button class="cta" id="dasha-member-share" type="button" data-title="${identity}" data-text="${escapeHtml(shareText)}" data-url="${url}" data-image="${image}">Share rank</button></p><p>${holderMark}${spotlightLink}<a href="${xProfile}" target="_blank" rel="noopener noreferrer">X profile ↗</a> · <a href="${WWW}/">Dasha home</a></p><details><summary>GitHub badge</summary><p><img src="${badgeUrl}" width="360" height="64" alt="${badgeAlt}"></p><label for="dasha-badge-markdown">Profile README Markdown</label><textarea id="dasha-badge-markdown" rows="3" readonly spellcheck="false">${escapeHtml(badgeMarkdown)}</textarea><button class="badge-copy" id="dasha-badge-copy" type="button">Copy badge</button></details></main>
<script>(function(){var b=document.getElementById('dasha-badge-copy'),t=document.getElementById('dasha-badge-markdown');if(!b||!t)return;var idle=b.textContent;function done(label){b.textContent=label;setTimeout(function(){b.textContent=idle},1800)}function select(){t.focus();t.select();done('Selected — copy')}b.addEventListener('click',function(){if(!navigator.clipboard||!navigator.clipboard.writeText)return select();b.disabled=true;Promise.race([navigator.clipboard.writeText(t.value),new Promise(function(_,reject){setTimeout(function(){reject(new Error('copy-timeout'))},800)})]).then(function(){done('Copied')}).catch(select).finally(function(){b.disabled=false})})}());</script>
<script>(function(){var b=document.getElementById('dasha-member-share');if(!b)return;var data={title:b.getAttribute('data-title'),text:b.getAttribute('data-text'),url:b.getAttribute('data-url')},card=null,image=b.getAttribute('data-image');if(navigator.share&&navigator.canShare&&typeof fetch==='function'&&typeof File==='function')fetch(image,{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('card');return r.blob()}).then(function(blob){if(blob.type==='image/png'&&blob.size>0&&blob.size<=1000000)card=new File([blob],'dasha-simp-${canonicalHandle}.png',{type:'image/png'})}).catch(function(){});function save(){try{var a=document.createElement('a');a.href=image;a.download='dasha-simp-${canonicalHandle}.png';a.hidden=true;document.body.appendChild(a);a.click();a.remove()}catch(error){}}function x(){save();window.open('https://x.com/intent/post?text='+encodeURIComponent(data.text+'\\n'+data.url),'_blank','noopener,noreferrer')}function send(payload){navigator.share(payload).catch(function(error){if(!error||error.name!=='AbortError')x()})}b.addEventListener('click',function(){if(!navigator.share)return x();var payload=data;try{if(card&&navigator.canShare({files:[card]}))payload={title:data.title,text:data.text,url:data.url,files:[card]}}catch(error){}send(payload)})}());</script>
</body></html>`;
}

export function simpMemberBadgeSvg({ handle, rank, total, holder }) {
  const { clean } = simpMemberIdentity({ handle, rank, total });
  const title = `@${clean} is #${rank} on the $dasha Simp Board`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="64" viewBox="0 0 360 64" role="img" aria-labelledby="title"><title id="title">${title}${holder === true ? ' · holder check current' : ''}</title><rect width="360" height="64" fill="#070608"/><rect x="2" y="2" width="356" height="60" fill="none" stroke="#dfff00" stroke-width="4"/><text x="16" y="26" fill="#dfff00" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="17" font-weight="900">$dasha SIMP${holder === true ? ' · HOLDER' : ''}</text><text x="16" y="49" fill="#f4eddb" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700">@${clean} · #${rank} · ${total} PTS</text></svg>`;
}

export function simpShareTitle({ title, correct, total } = {}) {
  const score = `${Number(correct)}/${Number(total)}`;
  const earned = String(title || '').trim() || quizTitle(Number(correct), Number(total));
  return `Beat my Simp — ${score}`;
}

export function simpResultHtml({ id, title, correct, total, sri = SIMP_BOARD_SRI }) {
  if (!RESULT_ID_RE.test(String(id || ''))) throw new Error('bad result id');
  const earned = String(title || '').trim() || quizTitle(Number(correct), Number(total));
  const identity = simpShareTitle({ title: earned, correct, total });
  const description = `${earned} · ${Number(correct)}/${Number(total)} · $dasha`;
  const url = `${WWW}/simp/r/${id}`;
  const image = `${WWW}/og/simp/${id}`;
  const shareText = `${identity}\n${description}\n${url}`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(identity)}</title>
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#dfff00">
${ogBlock({ title: identity, description, url, image, width: 1200, height: 630 })}
<style>:root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00;--hot:#ff3b81}body{font:16px/1.45 Arial,Helvetica,sans-serif;background:var(--ink);color:var(--paper);max-width:28rem;margin:3rem auto;padding:0 1rem}a{color:var(--acid)}h1{font-family:"Arial Black",Arial,Helvetica,sans-serif;font-weight:900;font-size:clamp(2rem,8vw,3.4rem);line-height:.95;margin:0 0 .75rem}.dasha-start,.dasha-share{display:inline-flex;align-items:center;justify-content:center;min-height:48px;background:var(--acid);color:var(--ink);border:0;padding:.55rem 1.1rem;font:900 1rem/1 "Arial Black",Arial,Helvetica,sans-serif;cursor:pointer;text-decoration:none}.dasha-start{margin:0 .6rem .75rem 0}</style>
<body>
<main>
<h1>${identity}</h1>
<div id="dasha-simp-board" data-simp-api="${LOBBY}" data-challenge="${escapeHtml(id)}"><button type="button" class="dasha-start" data-dasha-take-quiz>Start</button></div>
<button type="button" class="dasha-share" data-title="${identity}" data-text="${escapeHtml(shareText)}" data-url="${url}" data-image="${image}">Share</button>
<p><a href="${WWW}/">Back to Dasha</a></p>
</main>
<script>(function(){var s=document.createElement('script');s.src='${LOBBY}/client/simp-board.js';s.integrity='${sri}';s.crossOrigin='anonymous';s.defer=true;document.head.appendChild(s)})();</script>
<script>(function(){var b=document.querySelector('.dasha-share');if(!b)return;var title=b.getAttribute('data-title')||'',text=b.getAttribute('data-text')||'',url=b.getAttribute('data-url')||'',image=b.getAttribute('data-image'),card=null;if(navigator.share&&navigator.canShare&&typeof fetch==='function'&&typeof File==='function')fetch(image,{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('card');return r.blob()}).then(function(blob){if(blob.type==='image/png'&&blob.size>0&&blob.size<=1000000)card=new File([blob],'dasha-quiz-${id}.png',{type:'image/png'})}).catch(function(){});function withTimeout(p,ms){return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error('copy-timeout'))},ms)})])}function copy(){var fallback=function(){try{var t=document.createElement('textarea');t.value=text;t.setAttribute('readonly','');t.style.cssText='position:fixed;left:-9999px';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}catch(e){}};if(navigator.clipboard&&navigator.clipboard.writeText){withTimeout(navigator.clipboard.writeText(text),800).catch(fallback)}else fallback()}b.addEventListener('click',function(){if(!navigator.share)return copy();var payload={title:title,text:text,url:url};try{if(card&&navigator.canShare({files:[card]}))payload.files=[card]}catch(error){}navigator.share(payload).catch(function(err){if(!err||err.name!=='AbortError')copy()})});}());</script>
</body></html>`;
}

export function privacyPageHtml() {
  const title = 'Privacy — $dasha';
  const url = `${WWW}/privacy`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="canonical" href="${url}">
<meta name="description" content="What Dasha stores, and how to leave.">
<meta name="theme-color" content="#dfff00">
${ogBlock({ title, description: 'What Dasha stores, and how to leave.', url, image: SOCIAL_CARD, width: 1200, height: 630 })}
<style>:root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00}body{font:16px/1.45 Arial,Helvetica,sans-serif;background:var(--ink);color:var(--paper);max-width:36rem;margin:3rem auto;padding:0 1rem}a{color:var(--acid)}h1{font:900 clamp(2rem,8vw,3.4rem)/.95 "Arial Black",Arial,Helvetica,sans-serif}</style>
<body>
<main>
<h1>Privacy</h1>
<p>Updated August 16, 2026.</p>
<h2>What Dasha uses</h2>
<p>Linking X reads your X account ID, handle, display name, avatar, and verification type. The browser session lasts up to 30 days. Dasha does not store the X access token.</p>
<p>If you join the Simp Board or finish its scored quiz, Dasha stores your linked identity, score, badges, contribution links, referral milestones, and dated holder-badge status. The wallet address and balance used for an optional holder badge are checked once and are not retained.</p>
<h2>Control and deletion</h2>
<p>Unlink clears the signed browser session. Leave Board removes your profile, claims, active quiz state, linked result, holder challenge, chess rating, and your rows from retained season snapshots. Anonymous aggregate counts remain.</p>
<p>For access or deletion requests, use the repository's <a href="https://github.com/Uuriko/dasha-desk/security/advisories/new">private report</a>. Do not include wallet keys or seed phrases.</p>
<p><a href="${WWW}/">Back to Dasha</a></p>
</main>
</body></html>`;
}
