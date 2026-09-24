import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
const prefix=`.reconciliation-test-${process.pid}-`;
const adapter=prefix+'bundle.mjs';
const paths=[];
try {
  const bundle=readFileSync(resolve(here,'worker.mjs'),'utf8');
  // Production tree-shakes these test exports. The only helper reintroduced
  // clears an existing rate-limit map; runtime implementations stay untouched.
  const extra='\nexport { ComputeNetwork, computeApi, PROVIDER_ANOMALY_THRESHOLD, USAGE_REVIEW_PREFIX, accrueProviderEarn, HOSTED_FACTORY_BUMP_PATH, openaiErrorBody };\nexport function resetHostedRatesForTests() { hostedRates.clear(); }\n';
  paths.push(resolve(root,adapter));writeFileSync(paths.at(-1),bundle+extra);
  const names=['dasha-compute-usage-divergence.test.mjs','dasha-compute-factory-forge.test.mjs','dasha-compute-hosted-chat-usage-sse.test.mjs','dasha-compute-v1-chat-usage-sse.test.mjs','dasha-compute-guest-key.test.mjs','dasha-full-audit.test.mjs'];
  for(const name of names){
    const text=readFileSync(resolve(root,name),'utf8')
      .replaceAll("from './dasha-compute-network.mjs'",`from './${adapter}'`)
      .replaceAll("from './dasha-compute-provider-earn.mjs'",`from './${adapter}'`)
      .replaceAll("from './dasha-lobby-worker.mjs'",`from './${adapter}'`);
    paths.push(resolve(root,prefix+name));writeFileSync(paths.at(-1),text);
  }
  const result=spawnSync(process.execPath,['--test',...paths.slice(1)],{cwd:root,stdio:'inherit'});
  process.exitCode=result.status??1;
} finally {for(const path of paths){try{unlinkSync(path);}catch{}}}
