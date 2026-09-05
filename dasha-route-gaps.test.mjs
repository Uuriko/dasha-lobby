import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';

const env = {
  AI: {},
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  X_CLIENT_ID: 'route-gap-x-client',
  X_CLIENT_SECRET: 'route-gap-x-secret',
  LOBBY_SESSION_SECRET: 'route-gap-session-secret',
};

const getStart = await worker.fetch(new Request('https://lobby.getdasha.com/oauth/x/start'), env);
assert.equal(getStart.status, 200, 'X start GET');
assert.equal(getStart.headers.get('content-type'), 'text/html; charset=utf-8');
assert.match(await getStart.text(), /Connect X/);

const headStart = await worker.fetch(new Request('https://lobby.getdasha.com/oauth/x/start', { method: 'HEAD' }), env);
assert.equal(headStart.status, 200, 'X start HEAD');
assert.equal(headStart.headers.get('content-type'), 'text/html; charset=utf-8');
assert.equal(await headStart.text(), '');

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const method of ['GET', 'HEAD']) {
    const response = await worker.fetch(new Request(`https://${host}/compute/api/healthz`, { method }), env);
    assert.equal(response.status, 200, `${host} healthz ${method}`);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    if (method === 'GET') {
      assert.deepEqual(await response.json(), { ok: true, service: 'dasha-compute', version: '0.3.0' });
    } else {
      assert.equal(await response.text(), '');
    }
  }
}

console.log('dasha-route-gaps: PASS (X start GET/HEAD; www+lobby compute healthz GET/HEAD)');
