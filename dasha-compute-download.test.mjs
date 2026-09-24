import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import archive from './dasha-compute-download-archive.mjs';
import release from './dasha-compute-download-release.mjs';
import { computeDownloadResponse } from './dasha-compute-download.mjs';
const path='/compute/releases/706918197b63/dasha-compute-open-alpha.tar.gz';
const req=(path,method='GET')=>new Request('https://www.getdasha.com'+path,{method});
const never=()=>{throw Error('no runtime network dependency')};
test('embedded bytes match independently reviewed archive identity without fetching',async()=>{
 const response=await computeDownloadResponse(req(path),never);assert.equal(response.status,200);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,272939);assert.equal(createHash('sha256').update(bytes).digest('hex'),'706918197b633929b8963a27978bfab7dec5ed715fd8a83f32f04aa0d2152386');assert.equal(bytes.toString('base64'),archive);
});
test('corrupted, truncated, oversized and malformed embedded data fail closed',async()=>{
 const wrong=Buffer.from(archive,'base64');wrong[0]^=1;
 for(const encoded of [wrong.toString('base64'),Buffer.from('small').toString('base64'),Buffer.alloc(272940).toString('base64'),'invalid%']){
  const r=await computeDownloadResponse(req(path),never,release,encoded);assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'no-store');
 }
});
test('metadata, HEAD and unrelated paths remain correct',async()=>{
 const r=await computeDownloadResponse(req('/compute/kit.json'),never);const kit=await r.json();assert.equal(kit.sha256,release.manifest.sha256);assert.equal(kit.url,'https://www.getdasha.com'+path);
 const head=await computeDownloadResponse(req(path,'HEAD'),never);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),'272939');
 assert.equal((await computeDownloadResponse(req(path,'POST'),never)).status,405);
 assert.equal(await computeDownloadResponse(req('/client/faucet.js'),never),null);
});
