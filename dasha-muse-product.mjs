/** Muse product IA — Worker HTML. Paper / type-led Compute marketing.
 * Home lives at /start so Webflow keeps apex /. Start CTA → /compute.
 * System display stack only. Jupiter on jup.ag. No invented Mac counts.
 */
export const MUSE_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const MUSE_WSOL = 'So11111111111111111111111111111111111111112';
export const MUSE_JUP = `https://jup.ag/swap?sell=${MUSE_WSOL}&buy=${MUSE_MINT}`;
export const MUSE_START_HREF = '/compute';
export const MUSE_PROVIDE_HREF = '/compute#provide';

export const MUSE_FACES = {
  start: {
    path: '/start',
    edge: 'muse-start',
    title: 'Dasha — Macs, working together.',
    description: 'Share capacity. Run AI workloads.',
    eyebrow: 'AI work, routed to Apple silicon',
    h1a: 'Macs,',
    h1b: 'working together.',
    lede: 'Share capacity. Run AI workloads.',
  },
  providers: {
    path: '/providers',
    edge: 'muse-providers',
    title: 'Providers — Your Mac. On your terms.',
    description: 'Connect it. Choose availability.',
    eyebrow: 'Providers',
    h1a: 'Your Mac.',
    h1b: 'On your terms.',
    lede: 'Connect it. Choose availability.',
    cta: { href: MUSE_PROVIDE_HREF, label: 'Connect a Mac ↓' },
  },
  developers: {
    path: '/developers',
    edge: 'muse-developers',
    title: 'Developers — Send work. Get results.',
    description: 'One path from request to response.',
    eyebrow: 'Developers',
    h1a: 'Send work.',
    h1b: 'Get results.',
    lede: 'One path from request to response.',
    cta: { href: MUSE_START_HREF, label: 'Run a job ↓' },
  },
  network: {
    path: '/network',
    edge: 'muse-network',
    title: 'Network — Capacity meets demand.',
    description: 'Macs join. Requests route. Results return.',
    eyebrow: 'Network',
    h1a: 'Capacity',
    h1b: 'meets demand.',
    lede: 'Macs join. Requests route. Results return.',
  },
};

const FACE_BY_PATH = new Map(
  Object.entries(MUSE_FACES).flatMap(([kind, face]) => [
    [face.path, kind],
    [`${face.path}/`, kind],
    [`${face.path}/index.html`, kind],
  ]),
);

export function museProductKind(pathname) {
  return FACE_BY_PATH.get(String(pathname || '')) || null;
}

export function isMuseProductPath(pathname) {
  return museProductKind(pathname) != null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function navHtml(active) {
  const items = [
    ['/start', 'Home', 'start'],
    ['/compute', 'Compute', 'compute'],
    ['/providers', 'Providers', 'providers'],
    ['/developers', 'Developers', 'developers'],
    ['/network', 'Network', 'network'],
  ];
  const links = items
    .map(([href, label, key]) => {
      const on = key === active ? ' aria-current="page"' : '';
      return `<a class="muse-tab" href="${href}"${on}>${label}</a>`;
    })
    .join('');
  return `<div class="muse-chrome"><nav class="muse-pill" aria-label="Product">${links}</nav><a class="muse-start" href="${MUSE_START_HREF}">Start</a></div>`;
}

function buyHtml() {
  return `<a class="muse-buy" href="/how-to-buy">Buy $dasha</a>`;
}

function orbitalHtml() {
  return `<aside class="muse-orbit" aria-hidden="true">
  <div class="muse-ring"></div>
  <div class="muse-ring muse-ring-2"></div>
  <span class="muse-node n1"><i></i></span>
  <span class="muse-node n2"><i></i></span>
  <span class="muse-node n3"><i></i></span>
  <span class="muse-node n4"><i></i></span>
  <span class="muse-label req">request →</span>
  <span class="muse-label res">← result</span>
  <div class="muse-hub"><strong>Work moves.</strong><em>Value returns.</em></div>
</aside>`;
}

function homeExtra() {
  return `<section class="muse-ways" aria-label="Two ways in">
  <p class="muse-kicker">Two ways in</p>
  <div class="muse-pair">
    <a class="muse-cta" href="${MUSE_PROVIDE_HREF}">Connect a Mac</a>
    <a class="muse-cta" href="${MUSE_START_HREF}">Run a job</a>
  </div>
</section>
<section class="muse-sides" aria-label="Choose a side">
  <h2>In. Across. Back.</h2>
  <p>Choose a side.</p>
  <p class="muse-fine"><a href="/providers">Connect a Mac →</a> <a href="/developers">Run a job →</a> <a href="/network">See the network →</a></p>
</section>
<div class="muse-acid-band" aria-hidden="true"></div>`;
}

const MUSE_CSS = `:root{--ink:#070608;--paper:#f4eddb;--muted:#5c5852;--acid:#dfff00;--hot:#ff3b81}
*{box-sizing:border-box}html{background:var(--paper)}
body{margin:0;color:var(--ink);font:16px/1.45 Arial,Helvetica,sans-serif;background:
  radial-gradient(circle at 86% 28%,rgba(223,255,0,.18),transparent 36rem),
  radial-gradient(circle,rgba(7,6,8,.07) 1px,transparent 1px) 0 0/22px 22px,
  var(--paper)}
a{color:inherit}.skip{position:absolute;left:-9999px}.skip:focus{left:12px;top:12px;z-index:9;background:var(--acid);color:var(--ink);padding:10px;font-weight:900}
.muse-shell{width:min(1180px,calc(100% - 32px));margin:auto;padding:22px 0 64px}
.muse-chrome{display:flex;align-items:center;justify-content:center;gap:14px;padding:18px 0 8px;position:relative;z-index:2}
.muse-pill{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding:6px;border-radius:999px;background:rgba(255,255,255,.72);border:1px solid rgba(7,6,8,.08)}
.muse-tab{min-height:40px;padding:0 16px;border-radius:999px;text-decoration:none;font:700 14px/40px Arial,Helvetica,sans-serif;color:var(--ink)}
.muse-tab[aria-current=page]{background:#efe8d6}
.muse-start{min-height:48px;padding:0 22px;border-radius:999px;background:var(--ink);color:var(--paper);font:900 14px/48px Arial,Helvetica,sans-serif;text-decoration:none}
.muse-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.9fr);gap:28px;align-items:center;min-height:calc(100svh - 140px);padding:36px 0 24px}
.muse-kicker{margin:0 0 14px;color:var(--muted);font:700 13px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.04em}
.muse-kicker::before{content:"";display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:var(--acid);vertical-align:middle}
.muse-hero h1{margin:0;font:900 clamp(48px,8vw,104px)/.88 "Arial Black",Helvetica,Arial,sans-serif;letter-spacing:-.05em}
.muse-hero h1 span{color:var(--muted)}
.muse-lede{margin:22px 0 0;font:400 22px/1.35 Arial,Helvetica,sans-serif;max-width:22ch}
.muse-cta{display:inline-flex;align-items:center;min-height:48px;padding:0 18px;border-radius:999px;background:var(--acid);color:var(--ink);font-weight:900;text-decoration:none}
.muse-orbit{position:relative;min-height:420px}
.muse-ring{position:absolute;inset:12%;border:1px solid rgba(7,6,8,.12);border-radius:50%}
.muse-ring-2{inset:24%}
.muse-hub{position:absolute;left:50%;top:50%;width:168px;height:168px;margin:-84px 0 0 -84px;border-radius:36px;background:var(--ink);color:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px}
.muse-hub strong,.muse-hub em{font:900 16px/1.15 "Arial Black",Helvetica,Arial,sans-serif;font-style:normal}
.muse-node{position:absolute;width:56px;height:56px;border-radius:18px;background:#fff;border:1px solid rgba(7,6,8,.08);display:flex;align-items:center;justify-content:center}
.muse-node i{display:block;width:22px;height:16px;border:2px solid var(--ink);border-radius:3px;position:relative}
.muse-node i::after{content:"";position:absolute;left:5px;right:5px;bottom:-5px;height:2px;background:var(--ink)}
.n1{left:50%;top:0;margin-left:-28px}.n2{right:0;top:50%;margin-top:-28px}.n3{left:50%;bottom:0;margin-left:-28px}.n4{left:0;top:50%;margin-top:-28px}
.muse-label{position:absolute;font:700 12px/1 Arial,Helvetica,sans-serif;color:var(--muted)}
.muse-label.req{right:8%;top:18%}.muse-label.res{left:8%;bottom:18%}
.muse-ways,.muse-sides{padding:28px 0}
.muse-ways h2,.muse-sides h2{margin:0 0 10px;font:900 clamp(36px,6vw,72px)/.9 "Arial Black",Helvetica,Arial,sans-serif;letter-spacing:-.04em}
.muse-pair{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
.muse-fine{display:flex;flex-wrap:wrap;gap:16px;color:var(--muted)}
.muse-acid-band{height:88px;margin:36px -16px 0;background:var(--acid);border-radius:28px 28px 0 0}
.muse-foot{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;padding-top:28px;color:var(--muted);font-size:13px}
.muse-foot code{font:12px/1.4 ui-monospace,Menlo,monospace;color:var(--ink)}
.muse-buy{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;background:var(--acid);color:var(--ink);font-weight:900;text-decoration:none;box-shadow:4px 4px 0 var(--hot)}
.solo .muse-hero{grid-template-columns:1fr;min-height:calc(100svh - 180px);align-content:center}
:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
@media(max-width:860px){.muse-hero{grid-template-columns:1fr;min-height:0}.muse-orbit{min-height:300px;margin-top:12px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

export function musePageHtml(kind) {
  const face = MUSE_FACES[kind];
  if (!face) return '';
  const home = kind === 'start';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(face.title)}</title>
<meta name="description" content="${escapeHtml(face.description)}">
<link rel="canonical" href="https://www.getdasha.com${face.path}">
<meta name="theme-color" content="#f4eddb">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.getdasha.com${face.path}">
<meta property="og:title" content="${escapeHtml(face.title)}">
<meta property="og:description" content="${escapeHtml(face.description)}">
<meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(face.title)}">
<meta name="twitter:description" content="${escapeHtml(face.description)}">
<meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<style>
${MUSE_CSS}
</style>
</head>
<body class="${home ? 'muse-home' : 'solo'}">
<a class="skip" href="#dasha-page">Skip to content</a>
<div class="muse-shell">
${navHtml(kind)}
<main id="dasha-page">
  <section class="muse-hero">
    <div>
      <p class="muse-kicker">${escapeHtml(face.eyebrow)}</p>
      <h1>${escapeHtml(face.h1a)} <span>${escapeHtml(face.h1b)}</span></h1>
      <p class="muse-lede">${escapeHtml(face.lede)}</p>
      ${face.cta ? `<p><a class="muse-cta" href="${face.cta.href}">${escapeHtml(face.cta.label)}</a></p>` : ''}
    </div>
    ${home ? orbitalHtml() : ''}
  </section>
  ${kind === 'start' ? homeExtra() : kind === 'network' ? `<p class="muse-fine"><a href="/providers">Connect a Mac →</a> <a href="/developers">Run a job →</a></p>` : ''}
</main>
<footer class="muse-foot">
  <span>Dasha routes work to Apple silicon.</span>
  <code>${MUSE_MINT}</code>
  ${buyHtml()}
  <a href="${MUSE_JUP}" target="_blank" rel="noopener noreferrer">Jupiter ↗</a>
</footer>
</div>
</body>
</html>
`;
}

export function museProductPageHtml(pathname) {
  const kind = museProductKind(pathname);
  return kind ? musePageHtml(kind) : '';
}
