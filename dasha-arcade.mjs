import { ARCADE_HTML, ARCADE_CSS } from './dasha-arcade-page.mjs';
import { ARCADE_CLIENT_JS } from './dasha-arcade-client.mjs';
import { PORTRAIT_BASE64 } from './dasha-arcade-portrait.mjs';

const types = {
  '/arcade': 'text/html; charset=utf-8',
  '/arcade/style.css': 'text/css; charset=utf-8',
  '/arcade/play.js': 'text/javascript; charset=utf-8',
  '/arcade/portrait.jpg': 'image/jpeg',
};
let portrait;

/** A quiet entry beside in-room Play; never add a chess door or rewrite the home page. */
export function addArcadeLobbyLink(html) {
  if (!html.includes('id="forum-play-go"') || html.includes('href="/arcade"')) return html;
  return html.replace('<div class="forum-play-row">', '<div class="forum-play-row"><a href="/arcade" style="display:inline-flex;align-items:center;min-height:48px">Dasha Arcade →</a>');
}

export function arcadeResponse(request) {
  const url = new URL(request.url);
  if (url.pathname !== '/arcade/' && !Object.hasOwn(types, url.pathname)) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  if (url.pathname === '/arcade/') {
    return new Response(null, { status: 308, headers: { Location: '/arcade' + url.search, 'Cache-Control': 'public, max-age=300' } });
  }
  const headers = {
    'Content-Type': types[url.pathname],
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Dasha-Edge': 'arcade',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
  if (request.method === 'HEAD') return new Response(null, { headers });
  let body = url.pathname === '/arcade' ? ARCADE_HTML : url.pathname === '/arcade/style.css' ? ARCADE_CSS : ARCADE_CLIENT_JS;
  if (url.pathname === '/arcade/portrait.jpg') {
    portrait ??= Uint8Array.from(atob(PORTRAIT_BASE64), char => char.charCodeAt(0));
    body = portrait;
  }
  return new Response(body, { headers });
}
