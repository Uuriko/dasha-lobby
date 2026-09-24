import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { computeDownloadResponse } from './dasha-compute-download.mjs';
const body = new TextEncoder().encode('verified archive fixture');
const config = { commit: 'a'.repeat(40), manifest: { artifact:'dasha-compute-open-alpha.tar.gz', bytes:body.length, sha256:createHash('sha256').update(body).digest('hex'), version:'0.3.0' } };
const req = (path, method='GET') => new Request(`https://www.getdasha.com${path}`, {method,headers:{Authorization:'secret',Cookie:'private'}});
test('pins and verifies archive; forwards no credentials or query', async()=>{
 let called=0;
 const r=await computeDownloadResponse(req('/compute/releases/706918197b63/dasha-compute-open-alpha.tar.gz?token=private'),async(url,options)=>{called++;assert.equal(url,`https://raw.githubusercontent.com/Uuriko/dasha-desk/${config.commit}/artifacts/dasha-compute/dasha-compute-open-alpha.tar.gz`);assert.equal(options.headers,undefined);assert.equal(options.redirect,'error');return new Response(body);},config);
 assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),body);assert.equal(called,1);
});
test('wrong hash, truncated, oversized and unavailable archives fail closed',async()=>{
 for(const reply of [()=>new Response(new Uint8Array(body.length)),()=>new Response(body.slice(1)),()=>new Response(new Uint8Array(body.length+1)),()=>new Response('',{status:404}),()=>{throw Error('offline')}]){
  const r=await computeDownloadResponse(req('/compute/releases/706918197b63/dasha-compute-open-alpha.tar.gz'),reply,config);assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'no-store');
 }
});
test('metadata matches archive; HEAD has no body; unrelated routes untouched',async()=>{
 const never=()=>{throw Error('metadata must not fetch')};
 const manifest=await computeDownloadResponse(req('/compute/releases/706918197b63/release.json'),never,config);assert.deepEqual(await manifest.json(),config.manifest);
 const kit=await computeDownloadResponse(req('/compute/kit.json'),never,config);assert.equal((await kit.json()).sha256,config.manifest.sha256);
 const sidecar=await computeDownloadResponse(req('/compute/releases/706918197b63/dasha-compute-open-alpha.tar.gz.sha256'),never,config);assert.ok((await sidecar.text()).startsWith(config.manifest.sha256));
 assert.equal(await (await computeDownloadResponse(req('/compute/kit.json','HEAD'),never,config)).text(),'');
 assert.equal((await computeDownloadResponse(req('/compute/kit.json','POST'),never,config)).status,405);
 assert.equal(await computeDownloadResponse(req('/client/faucet.js'),never,config),null);
 assert.equal((await computeDownloadResponse(req('/compute/kit.json'),never,{commit:'invalid',manifest:config.manifest})).status,503);
});
