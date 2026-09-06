import { CHAIN_REGISTRY, buildAcquisitionRoute } from './dasha-multichain-policy.mjs';
import { multichainHtml, MULTICHAIN_CSS } from './dasha-multichain-page.mjs';

const PATHS = new Set(['/multichain', '/multichain/', '/multichain/style.css', '/.well-known/dasha-chains.json']);
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Dasha-Edge': 'multichain',
};

/** Pure GET/HEAD surface. No wallet, provider API, transaction, or session is invoked. */
export function multichainResponse(request) {
  const url = new URL(request.url);
  if (!PATHS.has(url.pathname)) return null;
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { ...SECURITY_HEADERS, Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  if (url.pathname === '/multichain/') {
    return new Response(null, { status: 308, headers: { ...SECURITY_HEADERS, Location: '/multichain' + url.search, 'Cache-Control': 'public, max-age=300' } });
  }
  let body, mime, status = 200;
  if (url.pathname === '/.well-known/dasha-chains.json') {
    body = JSON.stringify(CHAIN_REGISTRY, null, 2) + '\n';
    mime = 'application/json';
  } else if (url.pathname === '/multichain/style.css') {
    body = MULTICHAIN_CSS;
    mime = 'text/css';
  } else {
    const from = url.searchParams.get('from') ?? 'base';
    const via = url.searchParams.get('via') ?? 'sol';
    let error = url.searchParams.getAll('from').length > 1 || url.searchParams.getAll('via').length > 1;
    try { buildAcquisitionRoute(from, via); } catch { error = true; }
    status = error ? 400 : 200;
    body = multichainHtml(error ? { error: true } : { from, via });
    mime = 'text/html';
  }
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': mime + '; charset=utf-8', 'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store' },
  });
}

/** Add discovery only to the rendered canonical How to Buy page. */
export function addMultichainHowtoLink(html) {
  if (!html.includes('https://www.getdasha.com/how-to-buy') || html.includes('href="/multichain"')) return html;
  return html.replace(/(<p class="lede">[\s\S]*?<\/p>)/i, '$1<p><a href="/multichain">Starting on Base, Ethereum, or another chain? See the steps →</a></p>');
}
