#!/usr/bin/env node
/**
 * Hosted denial fail-loud honesty — parallel to Mac midstream cut.
 * Hosted cut out. + Retry. SSE/JSON code hosted_cut.
 * Night mutes #night-use-hosted when hostedLive===false after auth.
 * Never settle / success face on Hosted fail.
 * Disk only. No wrangler. No Designer. No live marker pin (not shipped).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { computeApi } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function assertHostedDenialHonesty(html, label) {
  assert.match(html, /<!-- hosted-denial-honesty:2026-09-07 -->/, `${label} marker comment`);
  assert.match(html, /<!-- midstream-fail-honesty:2026-09-07 -->/, `${label} midstream sibling stays`);
  assert.match(html, /Hosted cut out\./, `${label} Hosted cut out.`);
  assert.match(html, /Try Community or Queue\./, `${label} Community/Queue note`);
  assert.match(html, /lastAskFailKind=['"]hosted_cut['"]/, `${label} lastAskFailKind hosted_cut`);
  assert.match(html, /error\?\.code===['"]hosted_cut['"]/, `${label} error.code hosted_cut`);
  assert.match(
    html,
    /hosted demo unavailable\|model request failed\|Workers AI\|AI binding/,
    `${label} hosted denial regex`,
  );
  assert.match(html, /const hostedCut=!community&&/, `${label} Hosted path only`);
  assert.match(
    html,
    /hostedCut\)\{\s*\/\/ Hosted denial[\s\S]*?const retry=\$\(['"]answer-retry['"]\); if\(retry\)\{retry\.hidden=false;retry\.removeAttribute\(['"]hidden['"]\)\}/,
    `${label} Retry on hosted denial branch`,
  );
  assert.match(html, /never settle\/success face/, `${label} never settle comment`);
  assert.match(html, /id=["']answer-retry["'][^>]*data-midstream-fail=["']1["']/, `${label} Retry stays`);
  assert.match(html, /\$\(['"]answer-retry['"]\)\?\.addEventListener\(['"]click['"]/, `${label} Retry click`);
  assert.match(
    html,
    /window\.__dashaAuthReady&&hostedLive===false/,
    `${label} Night mute after auth`,
  );
  assert.match(html, /hosted\.textContent='Hosted · —'/, `${label} Night Hosted · —`);
  assert.match(html, /hosted\.disabled=true/, `${label} Night Hosted disabled`);
  assert.match(html, /Hosted · unavailable/, `${label} Night aria unavailable`);
  assert.match(
    html,
    /night-use-hosted['"]\)\?\.addEventListener\(['"]click['"],\(\)=>\{if\(window\.__dashaAuthReady&&hostedLive===false\)return/,
    `${label} Night click does not setEngine into dead Run`,
  );
  assert.match(html, /if\(tfStep==='night'\)paintNightAuth\(\)/, `${label} re-paint Night after auth`);
  assert.match(html, /e\.code=err\?\.error\?\.code\|\|err\?\.code\|\|null/, `${label} JSON preserves code`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertHostedDenialHonesty(disk, 'disk');
assertHostedDenialHonesty(COMPUTE_PAGE_HTML, 'embed');

const servedRes = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get('x-dasha-edge'), 'compute');
assertHostedDenialHonesty(await servedRes.text(), 'worker.fetch');

assert.match(networkSrc, /code: 'hosted_cut'/);
assert.match(networkSrc, /type: 'server_error', code: 'hosted_cut'/);
assert.match(networkSrc, /error: 'hosted demo unavailable', code: 'hosted_cut'/);
assert.match(networkSrc, /error: 'model request failed; try again', code: 'hosted_cut'/);
assert.match(networkSrc, /settled: failed \? null : hostedSettledPayload/);
assert.match(networkSrc, /bumpHostedFactory\(env, \{ failed: true \}\)/);
assert.match(networkSrc, /failed: Boolean\(failed\), settled: failed \? null/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);

function chunksStream(parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function recordingLobby() {
  const bumps = [];
  return {
    bumps,
    LOBBY: {
      idFromName() { return 'public'; },
      get() {
        return {
          async fetch(request) {
            const url = new URL(request.url);
            if (url.pathname.replace(/\/$/, '') === '/compute/api/factory' && request.method === 'POST') {
              const body = await request.json().catch(() => ({}));
              bumps.push(body);
              return new Response(JSON.stringify({ ok: true }), {
                status: 202,
                headers: { 'content-type': 'application/json' },
              });
            }
            return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
          },
        };
      },
    },
  };
}

const origin = 'https://www.getdasha.com';
const secret = 'hosted-denial-honesty-secret';

{
  const { bumps, LOBBY } = recordingLobby();
  const env = { LOBBY_SESSION_SECRET: secret, LOBBY };
  const session = await createSessionToken(env, { xId: 'hosted-cut', handle: 'hosted_cut' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  }), env, origin);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'hosted demo unavailable');
  assert.equal(body.code, 'hosted_cut');
  assert.equal(bumps.length, 0, 'no factory bump when AI binding missing');
}

{
  const { bumps, LOBBY } = recordingLobby();
  const env = {
    LOBBY_SESSION_SECRET: secret,
    LOBBY,
    AI: { async run() { throw new Error('Workers AI binding failed'); } },
  };
  const session = await createSessionToken(env, { xId: 'hosted-502', handle: 'hosted_502' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  }), env, origin);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error, 'model request failed; try again');
  assert.equal(body.code, 'hosted_cut');
  assert.equal(bumps.length, 1);
  assert.equal(bumps[0].source, 'hosted-chat');
  assert.equal(bumps[0].failed, true);
  assert.equal(bumps[0].settled, undefined, 'no settle on Hosted fail');
}

{
  const { bumps, LOBBY } = recordingLobby();
  const env = {
    LOBBY_SESSION_SECRET: secret,
    LOBBY,
    AI: {
      async run(_model, input) {
        assert.equal(input?.stream, true);
        throw new Error('AI binding exploded');
      },
    },
  };
  const session = await createSessionToken(env, { xId: 'hosted-sse-throw', handle: 'hosted_sse_throw' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }), env, origin);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.code, 'hosted_cut');
  assert.equal(body.error, 'model request failed; try again');
  assert.equal(bumps[0]?.failed, true);
  assert.equal(bumps[0]?.settled, undefined);
}

{
  const { bumps, LOBBY } = recordingLobby();
  const env = {
    LOBBY_SESSION_SECRET: secret,
    LOBBY,
    AI: {
      async run(_model, input) {
        assert.equal(input?.stream, true);
        return chunksStream([{ error: { message: 'hosted demo unavailable' } }]);
      },
    },
  };
  const session = await createSessionToken(env, { xId: 'hosted-sse-err', handle: 'hosted_sse_err' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }), env, origin);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  const text = await res.text();
  assert.match(text, /"code":"hosted_cut"/);
  assert.match(text, /"type":"server_error"/);
  assert.match(text, /hosted demo unavailable/);
  assert.match(text, /data: \[DONE\]/);
  assert.doesNotMatch(text, /"finish_reason":"stop"/);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(bumps.length, 1);
  assert.equal(bumps[0].failed, true);
  assert.equal(bumps[0].settled, undefined, 'SSE fail never stamps settle');
}

{
  const { bumps, LOBBY } = recordingLobby();
  const env = {
    LOBBY_SESSION_SECRET: secret,
    LOBBY,
    AI: {
      async run(_model, input) {
        assert.equal(input?.stream, true);
        return {
          async *[Symbol.asyncIterator]() {
            yield { response: 'Hel' };
            throw new Error('Workers AI dropped');
          },
        };
      },
    },
  };
  const session = await createSessionToken(env, { xId: 'hosted-iter-cut', handle: 'hosted_iter_cut' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }), env, origin);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /"content":"Hel"/);
  assert.match(text, /"code":"hosted_cut"/);
  assert.match(text, /model request failed; try again/);
  assert.doesNotMatch(text, /"finish_reason":"stop"/);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(bumps[0]?.failed, true);
  assert.equal(bumps[0]?.settled, undefined);
}

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
    const painted = await page.evaluate(() => {
      providersOnline = 2;
      lastAskFailKind = 'hosted_cut';
      const note = providersOnline >= 1 ? '\nTry Community or Queue.' : '';
      $('answer-title').textContent = 'Answer.';
      $('answer').textContent = 'Hosted cut out.' + note;
      const retry = $('answer-retry');
      if (retry) { retry.hidden = false; retry.removeAttribute('hidden'); }
      showTf('answer');
      return {
        title: (document.getElementById('answer-title')?.textContent || '').trim(),
        answer: document.getElementById('answer')?.textContent || '',
        retryHidden: document.getElementById('answer-retry')?.hidden,
        kind: lastAskFailKind,
      };
    });
    assert.equal(painted.title, 'Answer.');
    assert.equal(painted.answer, 'Hosted cut out.\nTry Community or Queue.');
    assert.equal(painted.retryHidden, false);
    assert.equal(painted.kind, 'hosted_cut');

    const offline = await page.evaluate(() => {
      providersOnline = 0;
      const note = providersOnline >= 1 ? '\nTry Community or Queue.' : '';
      $('answer').textContent = 'Hosted cut out.' + note;
      return document.getElementById('answer')?.textContent || '';
    });
    assert.equal(offline, 'Hosted cut out.');

    const muted = await page.evaluate(() => {
      window.__dashaAuthReady = true;
      hostedLive = false;
      $('engine').value = 'community';
      showNightEmpty();
      const btn = document.getElementById('night-use-hosted');
      btn?.click();
      return {
        text: (btn?.textContent || '').trim(),
        disabled: btn?.disabled === true,
        aria: btn?.getAttribute('aria-label') || '',
        ariaDisabled: btn?.getAttribute('aria-disabled') || '',
        engine: document.getElementById('engine')?.value || '',
        step: document.body.dataset.step || '',
      };
    });
    assert.equal(muted.text, 'Hosted · —');
    assert.equal(muted.disabled, true);
    assert.equal(muted.aria, 'Hosted · unavailable');
    assert.equal(muted.ariaDisabled, 'true');
    assert.equal(muted.engine, 'community', 'muted Hosted does not setEngine(hosted)');
    assert.equal(muted.step, 'night');

    const optimistic = await page.evaluate(() => {
      window.__dashaAuthReady = false;
      hostedLive = false;
      paintNightAuth();
      const btn = document.getElementById('night-use-hosted');
      return {
        text: (btn?.textContent || '').trim(),
        disabled: btn?.disabled === true,
      };
    });
    assert.equal(optimistic.text, 'Hosted');
    assert.equal(optimistic.disabled, false, 'pre-auth optimistic Hosted stays');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-hosted-denial-honesty.test.mjs: PASS');
