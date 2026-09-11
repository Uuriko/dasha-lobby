#!/usr/bin/env node
/**
 * /compute/ocm path-prefix proxy → ocm.getdasha.com
 * Asserts path strip + HTML rewrite (action="/signin" → /compute/ocm/signin)
 * + cookie Path + Location rewrite. /compute/api stays dasha-compute.
 */
import assert from 'node:assert/strict';
import {
  isComputeOcmPath,
  ocmUpstreamPath,
  ocmUpstreamUrl,
  rewriteOcmHtml,
  rewriteOcmLocation,
  rewriteOcmSetCookie,
  proxyComputeOcm,
  OCM_PREFIX,
} from './dasha-compute-ocm-proxy.mjs';
import {
  isOcmLoggedOutGate,
  polishOcmLoginHtml,
  OCM_LOGIN_SKIN_ID,
} from './dasha-compute-ocm-login-skin.mjs';
import worker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

assert.equal(isComputeOcmPath('/compute/ocm'), true);
assert.equal(isComputeOcmPath('/compute/ocm/'), true);
assert.equal(isComputeOcmPath('/compute/ocm/healthz'), true);
assert.equal(isComputeOcmPath('/compute/ocm/v1/models'), true);
assert.equal(isComputeOcmPath('/compute/api/healthz'), false);
assert.equal(isComputeOcmPath('/compute'), false);
assert.equal(isComputeOcmPath('/compute/'), false);

assert.equal(ocmUpstreamPath('/compute/ocm'), '/');
assert.equal(ocmUpstreamPath('/compute/ocm/'), '/');
assert.equal(ocmUpstreamPath('/compute/ocm/healthz'), '/healthz');
assert.equal(ocmUpstreamPath('/compute/ocm/provider'), '/provider');
assert.equal(ocmUpstreamPath('/compute/ocm/install.sh'), '/install.sh');
assert.equal(ocmUpstreamPath('/compute/ocm/healthz/'), '/healthz');
assert.equal(ocmUpstreamPath('/compute/ocm/v1/models'), '/v1/models');
assert.equal(ocmUpstreamPath('/compute/ocm/v1/models/'), '/v1/models');
assert.equal(ocmUpstreamPath('/compute/ocm/'), '/');
assert.equal(ocmUpstreamUrl('/compute/ocm/signin', '?x=1'), 'https://ocm.getdasha.com/signin?x=1');

assert.equal(
  rewriteOcmHtml('<form method="post" action="/signin"></form>'),
  '<form method="post" action="/compute/ocm/signin"></form>',
);
assert.equal(
  rewriteOcmHtml('<a href="/">Back</a><a href="/provider">Run</a>'),
  '<a href="/compute/ocm/">Back</a><a href="/compute/ocm/provider">Run</a>',
);
assert.match(rewriteOcmHtml('<link href="https://ocm.getdasha.com/x.css">'), /href="\/compute\/ocm\/x\.css"/);
assert.doesNotMatch(rewriteOcmHtml('https://api.ocm.getdasha.com/v1'), /\/compute\/ocm/);

assert.equal(rewriteOcmLocation('/?error=nope'), '/compute/ocm/?error=nope');
assert.equal(rewriteOcmLocation('/console'), '/compute/ocm/console');
assert.equal(rewriteOcmLocation('https://ocm.getdasha.com/console'), '/compute/ocm/console');
assert.equal(rewriteOcmLocation('https://example.com/x'), 'https://example.com/x');

assert.match(rewriteOcmSetCookie('ocm_session=abc; Path=/; HttpOnly; Secure'), /Path=\/compute\/ocm/);
assert.doesNotMatch(rewriteOcmSetCookie('ocm_session=abc; Path=/; Domain=ocm.getdasha.com; Secure'), /Domain=/);

const stubHtml = `<!DOCTYPE html><html><body><h1>Open-Compute Marketplace</h1>
<p class="sub">Alpha.</p>
<div class="row">
  <div class="card"><h3>Sign in</h3>
    <form method="post" action="/signin">
      <input id="k" type="password" name="key" placeholder="ocm_live_…" required>
      <button type="submit">Sign in</button>
    </form>
  </div>
  <div class="card"><h3>Create an account</h3>
    <form method="post" action="/signup">
      <input id="e" type="email" name="email" required>
      <button type="submit">Create account</button>
    </form>
  </div>
</div>
<a href="/">home</a></body></html>`;

const calls = [];
const stubFetch = async (href, init = {}) => {
  calls.push({ href: String(href), method: init.method || 'GET' });
  const u = new URL(href);
  if (u.pathname === '/healthz/') {
    return new Response(JSON.stringify({ error: { message: 'no route for GET /healthz/', type: 'invalid_request_error' } }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  if (u.pathname === '/provider') {
    return new Response('<!DOCTYPE html><html><head><style>html{-webkit-text-size-adjust:100%}</style></head><body><h1>Run a provider</h1><a href="/">console</a></body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  if (u.pathname === '/healthz') {
    // Live OCM: GET 200, HEAD 404 — proxy must force GET for HEAD.
    if ((init.method || 'GET') === 'HEAD') {
      return new Response(JSON.stringify({ error: { message: 'no route for HEAD /healthz', type: 'invalid_request_error' } }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    return new Response(JSON.stringify({ ok: true, service: 'ocm-gateway', hosts: 2 }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  if (u.pathname === '/v1/models') {
    return new Response(JSON.stringify({ object: 'list', data: [{ id: 'ocm-coder', object: 'model', owned_by: 'ocm' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  if (u.pathname === '/signin' && (init.method || 'GET') === 'GET') {
    return new Response(JSON.stringify({ error: { message: 'no route for GET /signin', type: 'invalid_request_error' } }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  if (u.pathname === '/signup' && (init.method || 'GET') === 'GET') {
    return new Response(JSON.stringify({ error: { message: 'no route for GET /signup', type: 'invalid_request_error' } }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  if (u.pathname === '/signin' && (init.method || 'GET') === 'POST') {
    return new Response(null, {
      status: 302,
      headers: {
        location: '/?error=That%20key%20is%20not%20valid',
        'set-cookie': 'ocm_session=x; Path=/; HttpOnly; SameSite=Strict; Secure',
      },
    });
  }
  return new Response(stubHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
};

assert.equal(isOcmLoggedOutGate(stubHtml), true);
assert.equal(isOcmLoggedOutGate('<html><body><h1>Run a provider</h1></body></html>'), false);
const skinned = polishOcmLoginHtml(rewriteOcmHtml(stubHtml));
assert.match(skinned, /id="dasha-ocm-login-skin"/);
assert.match(skinned, /dasha-ocm-gate/);
assert.match(skinned, /dasha-ocm-primary/);
assert.match(skinned, /dasha-ocm-secondary/);
assert.match(skinned, /#dcff00/);
assert.match(skinned, /<h1>Marketplace\.<\/h1>/);
assert.match(skinned, /Paste a developer key/);
assert.match(skinned, /href="\/compute"/);
assert.match(skinned, /action="\/compute\/ocm\/signin"/);
assert.match(skinned, /action="\/compute\/ocm\/signup"/);
assert.match(skinned, /name="key"/);
assert.match(skinned, /name="email"/);
assert.equal(polishOcmLoginHtml(skinned), skinned, 'skin is idempotent');
assert.equal(
  polishOcmLoginHtml('<html><body><h1>Run a provider</h1><a href="/">console</a></body></html>'),
  '<html><body><h1>Run a provider</h1><a href="/">console</a></body></html>',
);

const root = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm'), { fetch: stubFetch });
assert.equal(root.status, 200);
assert.equal(root.headers.get('x-dasha-edge'), 'compute-ocm');
const rootBody = await root.text();
assert.match(rootBody, /Marketplace\./);
assert.match(rootBody, /id="dasha-ocm-login-skin"/);
assert.match(rootBody, /dasha-ocm-primary/);
assert.match(rootBody, /action="\/compute\/ocm\/signin"/);
assert.match(rootBody, /action="\/compute\/ocm\/signup"/);
assert.match(rootBody, /name="key"/);
assert.doesNotMatch(rootBody, /action="\/signin"/);
assert.equal(calls[0].href, 'https://ocm.getdasha.com/');
assert.ok(OCM_LOGIN_SKIN_ID);

const provider = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm/provider'), { fetch: stubFetch });
assert.equal(provider.status, 200);
const providerHtml = await provider.text();
assert.match(providerHtml, /Run a provider/);
assert.doesNotMatch(providerHtml, /dasha-ocm-login-skin/);
assert.doesNotMatch(providerHtml, /dasha-ocm-primary/);
assert.equal(calls.at(-1).href, 'https://ocm.getdasha.com/provider');

const health = await proxyComputeOcm(new Request('https://lobby.getdasha.com/compute/ocm/healthz'), { fetch: stubFetch });
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { ok: true, service: 'ocm-gateway', hosts: 2 });
assert.equal(calls.at(-1).href, 'https://ocm.getdasha.com/healthz');
assert.equal(calls.at(-1).method, 'GET');

const healthSlash = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm/healthz/'), { fetch: stubFetch });
assert.equal(healthSlash.status, 200);
assert.deepEqual(await healthSlash.json(), { ok: true, service: 'ocm-gateway', hosts: 2 });
assert.equal(calls.at(-1).href, 'https://ocm.getdasha.com/healthz');

const healthHead = await proxyComputeOcm(new Request('https://lobby.getdasha.com/compute/ocm/healthz', { method: 'HEAD' }), { fetch: stubFetch });
assert.equal(healthHead.status, 200);
assert.equal(await healthHead.text(), '');
assert.equal(healthHead.headers.get('x-dasha-edge'), 'compute-ocm');
assert.equal(calls.at(-1).href, 'https://ocm.getdasha.com/healthz');
assert.equal(calls.at(-1).method, 'GET'); // forced GET upstream

const healthHeadSlash = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm/healthz/', { method: 'HEAD' }), { fetch: stubFetch });
assert.equal(healthHeadSlash.status, 200);
assert.equal(await healthHeadSlash.text(), '');
assert.equal(calls.at(-1).href, 'https://ocm.getdasha.com/healthz');
assert.equal(calls.at(-1).method, 'GET');

const models = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm/v1/models'), { fetch: stubFetch });
assert.equal(models.status, 200);
assert.match(JSON.stringify(await models.json()), /ocm-coder/);

const signin = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm/signin', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: 'key=ocm_live_fake',
}), { fetch: stubFetch });
assert.equal(signin.status, 302);
assert.equal(signin.headers.get('location'), '/compute/ocm/?error=That%20key%20is%20not%20valid');
const setCookie = signin.headers.get('set-cookie') || '';
assert.match(setCookie, /Path=\/compute\/ocm/);
assert.doesNotMatch(setCookie, /Domain=/);

const signinGet = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm/signin'), { fetch: stubFetch });
assert.equal(signinGet.status, 404);
const signupGet = await proxyComputeOcm(new Request('https://www.getdasha.com/compute/ocm/signup'), { fetch: stubFetch });
assert.equal(signupGet.status, 404);

// Worker integration (stub global fetch for OCM only)
const prevFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const href = String(input?.url || input);
  if (href.startsWith('https://ocm.getdasha.com')) return stubFetch(href, init);
  if (typeof prevFetch === 'function') return prevFetch(input, init);
  throw new Error('unexpected fetch ' + href);
};
try {
  const viaWorker = await worker.fetch(new Request('https://www.getdasha.com/compute/ocm'), {});
  assert.equal(viaWorker.status, 200);
  assert.equal(viaWorker.headers.get('x-dasha-edge'), 'compute-ocm');
  const viaBody = await viaWorker.text();
  assert.match(viaBody, /action="\/compute\/ocm\/signin"/);
  assert.match(viaBody, /dasha-ocm-login-skin/);
  assert.match(viaBody, /<h1>Marketplace\.<\/h1>/);

  const viaLobby = await worker.fetch(new Request('https://lobby.getdasha.com/compute/ocm/healthz'), {});
  assert.equal(viaLobby.status, 200);
  assert.equal((await viaLobby.json()).service, 'ocm-gateway');

  const viaSlash = await worker.fetch(new Request('https://www.getdasha.com/compute/ocm/healthz/'), {});
  assert.equal(viaSlash.status, 200);
  assert.equal((await viaSlash.json()).ok, true);

  const viaHead = await worker.fetch(new Request('https://lobby.getdasha.com/compute/ocm/healthz', { method: 'HEAD' }), {});
  assert.equal(viaHead.status, 200);
  assert.equal(await viaHead.text(), '');
  assert.equal(viaHead.headers.get('x-dasha-edge'), 'compute-ocm');

  const viaHeadSlash = await worker.fetch(new Request('https://www.getdasha.com/compute/ocm/healthz/', { method: 'HEAD' }), {});
  assert.equal(viaHeadSlash.status, 200);
  assert.equal(await viaHeadSlash.text(), '');

  const apiStill = await worker.fetch(new Request('https://www.getdasha.com/compute/api/healthz', {
    headers: { Origin: 'https://www.getdasha.com' },
  }), { AI: { run: async () => ({ response: 'ok' }) }, ALLOWED_ORIGINS: 'https://www.getdasha.com' });
  assert.equal(apiStill.status, 200);
  assert.deepEqual(await apiStill.json(), { ok: true, service: 'dasha-compute', version: '0.3.1' });

  const viaProvider = await worker.fetch(new Request('https://www.getdasha.com/compute/ocm/provider'), {});
  assert.equal(viaProvider.status, 200);
  assert.equal(viaProvider.headers.get('x-dasha-edge'), 'compute-ocm');
  const providerBody = await viaProvider.text();
  assert.match(providerBody, /Run a provider/);
  assert.match(providerBody, /href="\/compute\/ocm\/"/);
  assert.doesNotMatch(providerBody, /dasha-ocm-login-skin/);

  const viaSigninGet = await worker.fetch(new Request('https://www.getdasha.com/compute/ocm/signin'), {});
  assert.equal(viaSigninGet.status, 404);

  for (const path of ['/compute/marketplace', '/compute/marketplace/', '/compute/market', '/compute/Marketplace']) {
    const dest = potterHome308Dest(path);
    assert.equal(dest, 'https://www.getdasha.com/compute/ocm', path);
    const res = await worker.fetch(new Request(`https://www.getdasha.com${path}`), {});
    assert.equal(res.status, 308, path);
    assert.equal(res.headers.get('location'), 'https://www.getdasha.com/compute/ocm', path);
  }
  assert.equal(potterHome308Dest('/marketplace'), 'https://www.getdasha.com/compute/ocm');
  assert.equal(potterHome308Dest('/market'), 'https://www.getdasha.com/compute/ocm');
  assert.equal(potterHome308Dest('/ocm'), 'https://www.getdasha.com/compute');

  const computePage = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(computePage.status, 200);
  assert.equal(computePage.headers.get('x-dasha-edge'), 'compute');
  const pageHtml = await computePage.text();
  assert.doesNotMatch(pageHtml, /id=["']ocm-door["']/);
  assert.match(pageHtml, /id=["']ask-ocm["']/);
  assert.match(pageHtml, /href=["']\/compute\/ocm["']/);
  assert.match(pageHtml, />Marketplace</);
  assert.match(pageHtml, /id=["']ask-host["']/);
  assert.match(pageHtml, /href=["']\/compute\/ocm\/provider["']/);
  assert.match(pageHtml, />Host</);
  assert.doesNotMatch(pageHtml, /plugin\.jup\.ag/);
} finally {
  globalThis.fetch = prevFetch;
}

assert.equal(potterHome308Dest('/Compute/ocm'), 'https://www.getdasha.com/compute/ocm');
assert.equal(potterHome308Dest('/COMPUTE/ocm/healthz'), 'https://www.getdasha.com/compute/ocm/healthz');
assert.equal(potterHome308Dest('/compute/ocm'), null);
assert.equal(potterHome308Dest('/compute/ocm/healthz'), null);

console.log('dasha-compute-ocm-proxy: PASS (path map + login skin + marketplace→ocm + healthz slash/HEAD + HTML rewrite + cookie/Location + worker www/lobby + api untouched + door)');
