import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
// Pass an installed Miniflare module URL/path; this check runs the actual workerd runtime.
if (!process.argv[2]) throw new Error('usage: node verify-workerd.mjs /absolute/path/to/miniflare/dist/src/index.js');
const { Miniflare }=await import(process.argv[2]);
let script=await readFile(new URL('./worker.mjs',import.meta.url),'utf8');
const mf=new Miniflare({modules:[{type:"ESModule",path:"entry.mjs",contents:"import worker from './worker.mjs'; export default worker;"},{type:"ESModule",path:"worker.mjs",contents:script}],compatibilityDate:'2026-08-06',compatibilityFlags:[],outboundService:()=>{throw Error('archive must never fetch upstream')}});
try {
 const prefix='/compute/releases/706918197b63';
 for(const host of ['www.getdasha.com','lobby.getdasha.com']) {
  const archive=await mf.dispatchFetch(`https://${host}${prefix}/dasha-compute-open-alpha.tar.gz`);assert.equal(archive.status,200);
  const bytes=Buffer.from(await archive.arrayBuffer());assert.equal(bytes.length,272939);assert.equal(createHash('sha256').update(bytes).digest('hex'),'706918197b633929b8963a27978bfab7dec5ed715fd8a83f32f04aa0d2152386');
  const kit=await (await mf.dispatchFetch(`https://${host}/compute/kit.json`)).json();assert.equal(kit.url,`https://www.getdasha.com${prefix}/dasha-compute-open-alpha.tar.gz`);assert.equal(kit.sha256,createHash('sha256').update(bytes).digest('hex'));
  const head=await mf.dispatchFetch(`https://${host}${prefix}/dasha-compute-open-alpha.tar.gz`,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  console.log(host,'workerd exact archive and HEAD passed; no outbound requests');
 }
} finally {await mf.dispose();}
