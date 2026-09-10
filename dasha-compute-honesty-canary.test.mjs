#!/usr/bin/env node
/**
 * Live Compute honesty / canary floor — Show HN / dogfood regression lock.
 *
 * Soft doctor + enroll-code primacy + Provide ≠ Host + public network honesty
 * + fail-loud unauth chat + quiet /which Ask/Provide doors.
 *
 * Live HTTPS only (www + lobby). Test-only. Worker source untouched.
 * No wrangler. No Designer. No plugin.jup.ag. No invented Mac counts.
 * Deterministic: tolerate providers_online 0 or ≥1; schema/honesty only.
 */
import assert from 'node:assert/strict';

const UA = 'dasha-compute-honesty-canary.test';
const HOSTS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
const TIMEOUT_MS = 12_000;
const CHAT_BODY = JSON.stringify({
  model: 'qwen3-8b',
  messages: [{ role: 'user', content: 'hi' }],
});

async function liveFetch(url, init = {}) {
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
    headers: { 'User-Agent': UA, ...init.headers },
  });
  return res;
}

async function liveGet(url, accept = '*/*') {
  return liveFetch(url, { headers: { Accept: accept } });
}

function assertJson(res, label) {
  const type = res.headers.get('content-type') || '';
  assert.match(type, /application\/json/i, `${label} JSON content-type`);
  assert.doesNotMatch(type, /text\/event-stream/i, `${label} not a silent stream`);
}

async function readJson(res, label) {
  assertJson(res, label);
  const text = await res.text();
  assert.doesNotMatch(text, /^\s*data:/i, `${label} not SSE`);
  let body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    assert.fail(`${label} JSON parse: ${err.message}`);
  }
  return body;
}

function assertComputeHonestyHtml(html, label) {
  assert.match(html, /id=["']provide-softdoctor["']/, `${label} #provide-softdoctor`);
  assert.match(
    html,
    /id=["']provide-softdoctor["'][^>]*>Doctor soft-warns · battery \/ Low Power \/ thermal \/ SIP · never fails solely · not attestation\.</,
    `${label} soft-doctor honesty copy`,
  );
  assert.match(html, /soft-warns/, `${label} soft-warn`);
  assert.match(html, /never fails solely/, `${label} never fails solely`);
  assert.match(html, /not attestation/, `${label} not attestation`);

  assert.match(html, /id=["']host-enroll-fine["']/, `${label} #host-enroll-fine`);
  assert.match(
    html,
    /id=["']host-enroll-fine["'][^>]*>Enroll code · never paste a provider token\.</,
    `${label} enroll-code primacy`,
  );
  assert.match(html, /never paste a provider token/, `${label} never paste provider token`);

  assert.match(
    html,
    /id=["']provide-ocm-fine["'][^>]*>Community kit · one Register → Setup · soft doctor warns only\.</,
    `${label} Community Register copy`,
  );
  assert.match(
    html,
    /id=["']provide-add-mac["'][^>]*title=["']Community Register · not Host \/ OCM enroll["']/,
    `${label} Provide ≠ Host title`,
  );
  assert.match(
    html,
    /id=["']ask-provide["'][^>]*aria-label=["']Provide · Join with a Mac["']/,
    `${label} Provide aria`,
  );
  assert.match(
    html,
    /id=["']ask-host["'][^>]*title=["']OCM host · enroll["'][^>]*aria-label=["']Host · OCM enroll["']/,
    `${label} Host aria`,
  );

  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
  assert.doesNotMatch(html, /~12 Macs|12 Macs online/i, `${label} no invented Mac count`);
}

function assertWhichComputeDoors(html, label) {
  assert.match(
    html,
    /<p>Compute\. <a href="https:\/\/www\.getdasha\.com\/compute#ask">(Ask|Use a Mac|Do)<\/a>( — Hosted when no Mac\.)?( ·)? <a href="https:\/\/www\.getdasha\.com\/compute#provide">Provide<\/a><\/p>/,
    `${label} quiet Compute Ask/Provide doors`,
  );
  assert.match(html, /href="https:\/\/www\.getdasha\.com\/compute#ask"/, `${label} /compute#ask`);
  assert.match(html, /href="https:\/\/www\.getdasha\.com\/compute#provide"/, `${label} /compute#provide`);
}

function assertHealth(body, label) {
  assert.equal(body.ok, true, `${label} ok:true`);
  assert.equal(body.service, 'dasha-compute', `${label} service`);
}

function assertNetworkHonesty(body, label) {
  assert.ok(body && typeof body === 'object', `${label} object`);
  assert.ok(
    Number.isInteger(body.providers_online) && body.providers_online >= 0,
    `${label} providers_online integer ≥0 (got ${body.providers_online})`,
  );
  assert.ok(Array.isArray(body.models_available), `${label} models_available array`);
  assert.ok(Array.isArray(body.capacity), `${label} capacity array`);

  if (body.providers_online >= 1) {
    assert.ok(body.models_available.length >= 1, `${label} models_available non-empty when online`);
    assert.ok(
      body.models_available.every((id) => typeof id === 'string' && id.trim()),
      `${label} model ids are non-empty strings`,
    );
  }

  for (const [i, row] of body.capacity.entries()) {
    assert.ok(row && typeof row === 'object', `${label} capacity[${i}] object`);
    const measured = row.measured_providers;
    if (measured === 0) {
      const tps = row.tokens_per_second;
      const invented = typeof tps === 'number' && Number.isFinite(tps) && tps > 0;
      assert.equal(invented, false, `${label} capacity[${i}] no invented tok/s when measured_providers=0`);
    }
  }
}

function assertAuthFailLoud(res, body, label) {
  assert.equal(res.status, 401, `${label} 401 not silent 200`);
  assert.notEqual(res.status, 200, `${label} not 200 stream`);
  assertJson(res, label);
  assert.equal(body?.error?.type, 'authentication_error', `${label} authentication_error`);
  assert.match(String(body?.error?.message || ''), /invalid API key|auth/i, `${label} fail-loud message`);
}

// --- 1–3. GET /compute soft-doctor + enroll primacy + Provide ≠ Host ---
for (const host of HOSTS) {
  const res = await liveGet(`${host}/compute`, 'text/html');
  assert.equal(res.status, 200, `${host} /compute 200`);
  assert.equal(res.headers.get('x-dasha-edge'), 'compute', `${host} /compute edge`);
  const html = await res.text();
  assertComputeHonestyHtml(html, `${host} /compute`);
}

// --- 4. GET /compute/api/health + /healthz ---
for (const host of HOSTS) {
  for (const path of ['/compute/api/health', '/compute/api/healthz']) {
    const res = await liveGet(`${host}${path}`, 'application/json');
    assert.equal(res.status, 200, `${host} ${path} 200`);
    assertHealth(await readJson(res, `${host} ${path}`), `${host} ${path}`);
  }
}

// --- 5. GET /compute/api/network honesty (0 or ≥1) ---
for (const host of HOSTS) {
  const res = await liveGet(`${host}/compute/api/network`, 'application/json');
  assert.equal(res.status, 200, `${host} /compute/api/network 200`);
  assertNetworkHonesty(await readJson(res, `${host} /compute/api/network`), `${host} /compute/api/network`);
}

// --- 6. Unauth POST /compute/api/v1/chat/completions fail-loud ---
for (const host of HOSTS) {
  for (const stream of [undefined, true]) {
    const payload = stream === true ? { ...JSON.parse(CHAT_BODY), stream: true } : JSON.parse(CHAT_BODY);
    const res = await liveFetch(`${host}/compute/api/v1/chat/completions`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const label = `${host} POST /compute/api/v1/chat/completions${stream ? ' stream' : ''}`;
    const body = await readJson(res, label);
    assertAuthFailLoud(res, body, label);
  }
}

// --- 7. /which quiet Compute Ask/Provide doors (assert only) ---
for (const host of HOSTS) {
  const res = await liveGet(`${host}/which`, 'text/html');
  assert.equal(res.status, 200, `${host} /which 200`);
  assertWhichComputeDoors(await res.text(), `${host} /which`);
}

console.log('dasha-compute-honesty-canary: PASS (live soft-doctor + enroll primacy + Provide≠Host + health/network honesty + fail-loud chat + /which doors)');
