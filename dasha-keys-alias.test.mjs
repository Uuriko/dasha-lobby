import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';

test('/compute/api/keys.json is served by the same handler as /keys.json', async () => {
  const a = await worker.fetch(new Request('https://www.getdasha.com/keys.json'), {});
  const b = await worker.fetch(new Request('https://www.getdasha.com/compute/api/keys.json'), {});
  assert.equal(b.status, a.status);
  assert.equal(await b.text(), await a.text());
});
