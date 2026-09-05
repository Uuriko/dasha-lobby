import assert from 'node:assert/strict';
import edgeWorker, { potterHome308Dest, potterHome308Response } from './dasha-lobby-worker.mjs';

assert.equal(potterHome308Dest('/index.html'), 'https://www.getdasha.com/');
assert.equal(potterHome308Dest('/index.html/'), 'https://www.getdasha.com/');
assert.equal(potterHome308Dest('/'), null);
assert.equal(potterHome308Dest('/privacy'), null);
assert.equal(potterHome308Dest('/compute'), null);

for (const path of ['/index.html', '/index.html/']) {
  const res = potterHome308Response(
    new Request(`https://www.getdasha.com${path}`),
    new URL(`https://www.getdasha.com${path}`),
  );
  assert.ok(res, `${path} 308`);
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/', path);
}

const fetchRes = await edgeWorker.fetch(new Request('https://www.getdasha.com/index.html'), {});
assert.equal(fetchRes.status, 308);
assert.equal(fetchRes.headers.get('location'), 'https://www.getdasha.com/');

const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
assert.equal(privacy.status, 200);
assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
assert.match(await privacy.text(), /<h1>Privacy<\/h1>/);

const compute = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(compute.status, 200);
assert.equal(compute.headers.get('x-dasha-edge'), 'compute');

const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308);
assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');

console.log('dasha-index-html: PASS (/index.html 308 home; / privacy compute stay)');
