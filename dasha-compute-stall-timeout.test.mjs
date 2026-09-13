import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {COMPUTE_PAGE_HTML} from './dasha-compute-page.mjs';
const html=readFileSync(new URL('./dasha-compute.html',import.meta.url),'utf8');
assert.equal(html,COMPUTE_PAGE_HTML);
// Compile every inline script, then exercise the actual request functions with a clock.
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const functions=html.slice(html.indexOf('async function api('),html.indexOf('function defaultAskEngine('));
let now=0,tick=null,requests=[];
const context=vm.createContext({AbortController,Error,Date:{now:()=>now},setInterval:f=>(tick=f,1),clearInterval:()=>{tick=null},setTimeout,clearTimeout,
  API:'https://test.invalid',activeJob:'job_test',runAbort:new AbortController(),
  networkModels:new Set(['qwen3-4b','gemma3-27b']),
  winningMeasuredCapacity:()=>({model:'qwen3-4b',tps:46.53}),
  fetch:async(url,options)=>{requests.push({url,options});return {ok:true,status:204}}});
vm.runInContext(functions,context);
const select={value:'gemma3-27b'};context.select=select;
vm.runInContext('preferAdvertisedCommunityModel(select)',context);
assert.equal(select.value,'qwen3-4b');
vm.runInContext('startRunWatch()',context);
now=89999;tick();assert.equal(context.runAbort.signal.aborted,false);
now=90000;tick();assert.equal(context.runAbort.signal.aborted,true);
assert.match(context.runAbort.signal.reason.message,/90 seconds/);
assert.equal(requests.length,1);assert.equal(requests[0].options.method,'DELETE');
assert.match(requests[0].url,/job_test$/);
// Progress extends the initial deadline; no-content heartbeats do not.
now=0;requests=[];context.runAbort=new AbortController();
vm.runInContext('startRunWatch()',context);
now=80000;vm.runInContext('noteRunProgress()',context);
now=124999;tick();assert.equal(context.runAbort.signal.aborted,false);
now=125000;tick();assert.equal(context.runAbort.signal.aborted,true);
assert.match(context.runAbort.signal.reason.message,/Reply stalled/);
// Cleanup cannot later abort a completed run.
now=0;context.runAbort=new AbortController();vm.runInContext('startRunWatch();clearRunWatch()',context);
assert.equal(tick,null);assert.equal(context.runAbort.signal.aborted,false);
// Job polling inherits cancellation and keeps it through body reading.
context.runAbort.abort(Error('cancelled'));
await vm.runInContext("api('/compute/api/jobs/job_test')",context);
assert.equal(requests.at(-1).options.signal.aborted,true);
console.log('PASS: fastest default, 90s first-token limit, 45s stalled reply, exact-job cancellation, cleanup, polling abort, script syntax, embedded page parity');
