#!/usr/bin/env node
/**
 * LIVE Worker + kit 43df0883 (0.3.1): Provide / Host skill
 * OLLAMA_KEEP_ALIVE + advertise≠URLError docs (PR-mirror).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { PROVIDE_SKILL_MD, OCM_HOST_SKILL_MD } from './dasha-compute-skills.mjs';
import worker from './dasha-lobby-worker.mjs';

const LIVE_KIT_SHA256 = '43df0883a900058320ceca36bf029b82d2495b2f2f17086495d31219cc3fec24';
const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const provideDisk = readFileSync(join(root, 'dasha-compute-skills/PROVIDE.md'), 'utf8');
const hostDisk = readFileSync(join(root, 'dasha-compute-skills/OCM-HOST.md'), 'utf8');
const readme = readFileSync(join(root, 'dasha-compute-open-alpha/README.md'), 'utf8');
const agentSrc = readFileSync(join(root, 'dasha-compute-open-alpha/provider/agent.py'), 'utf8');

assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');
assert.equal(PROVIDE_SKILL_MD, provideDisk, 'PROVIDE skill embed matches disk');
assert.equal(OCM_HOST_SKILL_MD, hostDisk, 'Host skill embed matches disk');

assert.match(PROVIDE_SKILL_MD, /OLLAMA_KEEP_ALIVE=-1/);
assert.match(PROVIDE_SKILL_MD, /a shell export alone is not enough for the macOS app/);
assert.match(PROVIDE_SKILL_MD, /Advertising\/heartbeat OK while mid-Ask fails with `provider inference failed: URLError`/);
assert.match(PROVIDE_SKILL_MD, /Soft doctor does not block advertise alone/);
assert.match(PROVIDE_SKILL_MD, /Host power \/ thermal \/ SIP \(soft\)/);
assert.match(PROVIDE_SKILL_MD, /never claims Secure Enclave, TEE, Nitro/);
assert.match(PROVIDE_SKILL_MD, /curl -sS http:\/\/127\.0\.0\.1:11434\/api\/ps/);

{
  const m = html.match(/const PROVIDE_SKILL="((?:\\.|[^"\\])*)"/);
  assert.ok(m, 'PROVIDE_SKILL string present');
  const embed = JSON.parse('"' + m[1] + '"');
  assert.equal(embed, provideDisk, 'Copy AI skill body matches PROVIDE.md');
}

assert.match(OCM_HOST_SKILL_MD, /Enrolled ≠ advertising already live — never invent Mac counts/);
assert.match(OCM_HOST_SKILL_MD, /enrolled there is \*\*not\*\* the same as Community `providers_online` advertising/);
assert.match(OCM_HOST_SKILL_MD, /ocm_enroll_/);
assert.doesNotMatch(OCM_HOST_SKILL_MD, /sudo OCM_HOST_TOKEN=/);

assert.match(readme, /OLLAMA_KEEP_ALIVE=-1/);
assert.match(readme, /a shell `export` alone is not enough for the macOS app/);
assert.match(readme, /Heartbeat advertising can succeed while a mid-Ask \*\*`URLError`\*\*/);
assert.match(readme, /soft doctor lines do not block advertise alone/);
assert.match(readme, /never claims enclave or hardware attestation/);

assert.match(agentSrc, /def keepalive_soft_report/);
assert.match(agentSrc, /OLLAMA_KEEP_ALIVE=-1/);
assert.match(agentSrc, /def power_soft_report/);
assert.match(agentSrc, /def thermal_soft_report/);
assert.match(agentSrc, /def sip_soft_report/);
assert.match(agentSrc, /never claims Secure Enclave|not network attestation|never attestation/);
assert.match(agentSrc, /raise RuntimeError\("empty completion"\)/);

const archives = [
  join(root, 'dasha-worker-assets/dasha-compute-open-alpha.tar.gz'),
  join(root, 'dasha-compute-open-alpha.tar.gz'),
];
function extractKitFile(archivePath, rel) {
  return execFileSync('tar', ['-xOf', archivePath, `dasha-compute-open-alpha/${rel}`], { encoding: 'utf8' });
}
for (const kit of archives) {
  if (!existsSync(kit)) continue;
  assert.equal(extractKitFile(kit, 'README.md'), readme, `${kit} README must match source`);
  assert.equal(extractKitFile(kit, 'provider/agent.py'), agentSrc, `${kit} agent.py must match source`);
  assert.match(extractKitFile(kit, 'README.md'), /OLLAMA_KEEP_ALIVE=-1/);
  assert.match(extractKitFile(kit, 'README.md'), /URLError/);
}

async function assertSkillRoute(host, path, body, edge) {
  const res = await worker.fetch(new Request(`https://${host}${path}`), {});
  assert.equal(res.status, 200, `${host}${path} status`);
  assert.equal(res.headers.get('x-dasha-edge'), edge, `${host}${path} edge`);
  assert.equal(await res.text(), body, `${host}${path} body`);
}

await assertSkillRoute('www.getdasha.com', '/compute/skill/provide.md', PROVIDE_SKILL_MD, 'compute-skill-provide');
await assertSkillRoute('lobby.getdasha.com', '/compute/skill/provide.md', PROVIDE_SKILL_MD, 'compute-skill-provide');
await assertSkillRoute('www.getdasha.com', '/compute/skill/ocm-host.md', OCM_HOST_SKILL_MD, 'compute-skill-ocm-host');
await assertSkillRoute('lobby.getdasha.com', '/compute/skill/ocm-host.md', OCM_HOST_SKILL_MD, 'compute-skill-ocm-host');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const liveProvide = await fetch('https://www.getdasha.com/compute/skill/provide.md', { headers: { 'user-agent': UA } });
assert.equal(liveProvide.status, 200, 'live provide skill 200');
assert.equal(await liveProvide.text(), PROVIDE_SKILL_MD, 'tree PROVIDE skill matches live Worker');

const liveHost = await fetch('https://www.getdasha.com/compute/skill/ocm-host.md', { headers: { 'user-agent': UA } });
assert.equal(liveHost.status, 200, 'live host skill 200');
assert.equal(await liveHost.text(), OCM_HOST_SKILL_MD, 'tree Host skill matches live Worker');

const liveKit = await fetch('https://www.getdasha.com/dasha-compute-open-alpha.tar.gz', { headers: { 'user-agent': UA } });
assert.equal(liveKit.status, 200, 'live kit 200');
const bytes = Buffer.from(await liveKit.arrayBuffer());
const digest = createHash('sha256').update(bytes).digest('hex');
assert.equal(digest, LIVE_KIT_SHA256, 'live kit sha256');
const tmp = join(mkdtempSync(join(tmpdir(), 'dasha-kit-keepalive-')), 'dasha-compute-open-alpha.tar.gz');
writeFileSync(tmp, bytes);
assert.equal(extractKitFile(tmp, 'README.md'), readme, 'source README matches live kit');
assert.equal(extractKitFile(tmp, 'provider/agent.py'), agentSrc, 'source agent.py matches live kit');

assert.doesNotMatch([PROVIDE_SKILL_MD, OCM_HOST_SKILL_MD, readme, agentSrc, html].join('\n'), /plugin\.jup\.ag/);

console.log(`dasha-compute-keepalive-advertise: PASS sha256=${digest}`);
