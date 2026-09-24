import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './worker.mjs';
const prefix='/compute/releases/706918197b63';
const sha='706918197b633929b8963a27978bfab7dec5ed715fd8a83f32f04aa0d2152386';
for (const host of ['www.getdasha.com','lobby.getdasha.com']) {
 const request=path=>new Request(`https://${host}${path}`);
 const kit=await (await worker.fetch(request('/compute/kit.json'),{})).json();
 assert.equal(kit.url,`https://www.getdasha.com${prefix}/dasha-compute-open-alpha.tar.gz`);assert.equal(kit.sha256,sha);
 const manifest=await (await worker.fetch(request(prefix+'/release.json'),{})).json();assert.equal(manifest.sha256,sha);
 const sidecar=await (await worker.fetch(request(prefix+'/dasha-compute-open-alpha.tar.gz.sha256'),{})).text();assert.ok(sidecar.startsWith(sha));
 const archive=await worker.fetch(request(prefix+'/dasha-compute-open-alpha.tar.gz'),{});assert.equal(archive.status,200);
 const bytes=Buffer.from(await archive.arrayBuffer());assert.equal(bytes.length,272939);assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
 const html=await (await worker.fetch(request('/compute'),{})).text();assert.ok(!html.includes('https://www.getdasha.com/dasha-compute-open-alpha.tar.gz'));assert.ok(!html.includes('href="/dasha-compute-open-alpha.tar.gz"'));assert.ok(html.includes(`href="${prefix}/dasha-compute-open-alpha.tar.gz"`));
 const insecure=await worker.fetch(new Request(`http://${host}/compute/kit.json`),{});assert.equal(insecure.status,308);
 console.log(host,'versioned archive, manifests, CTA, setup/skill URLs and HTTPS redirect verified');
}
