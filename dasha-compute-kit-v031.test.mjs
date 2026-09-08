#!/usr/bin/env node
/** Kit v0.3.1 (tasks 19+20): `dasha-compute earnings` verb, doctor version-check, kit.json manifest, advertise version. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const kit = join(root, 'dasha-compute-open-alpha');

const version = (await readFile(join(kit, 'VERSION'), 'utf8')).trim();
assert.equal(version, '0.3.1', 'kit VERSION pins 0.3.1');

const install = await readFile(join(kit, 'install.sh'), 'utf8');
assert.match(install, /install -m 644 VERSION "\$APP_DIR\/VERSION"/, 'install.sh ships VERSION beside agent.py');

const cli = await readFile(join(kit, 'provider/dasha-compute'), 'utf8');
assert.match(cli, /earnings\) shift; run_agent --earnings "\$@"/, 'shell wrapper exposes earnings verb');
assert.match(cli, /status\|doctor\|earnings\|benchmark/, 'usage line lists earnings');

const agentSrc = await readFile(join(kit, 'provider/agent.py'), 'utf8');
assert.match(agentSrc, /--earnings/); assert.match(agentSrc, /--watch/); assert.match(agentSrc, /--json/);
assert.match(agentSrc, /KIT_JSON_URL = "https:\/\/www\.getdasha\.com\/compute\/kit\.json"/);
assert.match(agentSrc, /earnings-cache\.json/);
assert.match(agentSrc, /"version": KIT_VERSION/, 'advertise payload carries kit version');
assert.match(agentSrc, /HARD WARN · .*obsolete/, 'doctor hard-warns obsolete kits');
assert.match(agentSrc, /operator-settled during alpha/, 'settlement note honest');

// --- behavioral: agent.py --earnings against a stub coordinator ---
function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function run(args, env) {
  return new Promise((resolve) => {
    const child = spawn('python3', [join(kit, 'provider/agent.py'), ...args], { env: { ...process.env, ...env } });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}
const dir = await mkdtemp(join(tmpdir(), 'dasha-kit-'));
const keyFile = join(dir, 'key'); await writeFile(keyFile, 'test-token');
const payload = { providers: [{ id: 'mac_test1', name: 'Test Mac', usdc_cents: 123, dasha_cents: 246, jobs: 7, completion_tokens: 9000 }], total_usdc_cents: 123, pref: { method: 'usdc', wallet: 'wallet123' }, pending: [{ id: 'p1', status: 'paid', usdc_cents: 50, payout_cents: 50, paid_at: 1757000000 }] };

const okServer = await listen((req, res) => {
  assert.match(req.url, /^\/compute\/api\/provider\/earnings\?provider_id=mac_test1/, 'CLI passes provider_id');
  assert.equal(req.headers.authorization, 'Bearer test-token', 'CLI sends Bearer provider token');
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(payload));
});
const base = `http://127.0.0.1:${okServer.address().port}/compute/api`;
let r = await run(['--earnings'], { DASHA_COORDINATOR_URL: base, DASHA_PROVIDER_ID: 'mac_test1', DASHA_PROVIDER_KEY_FILE: keyFile, HOME: dir });
assert.equal(r.code, 0, r.err);
assert.match(r.out, /pending    \$1\.23 USDC/, 'prints pending balance');
assert.match(r.out, /settled    \$0\.50 across 1 payout\(s\) - last paid 2025-09-04/, 'prints settled + last payout date');
assert.match(r.out, /jobs       7 served/, 'prints jobs served');
assert.match(r.out, /payout     usdc -> wallet123/, 'prints payout preference');
assert.match(r.out, /operator-settled during alpha/);
r = await run(['--earnings', '--json'], { DASHA_COORDINATOR_URL: base, DASHA_PROVIDER_ID: 'mac_test1', DASHA_PROVIDER_KEY_FILE: keyFile, HOME: dir });
const parsed = JSON.parse(r.out);
assert.equal(parsed.cached, false); assert.equal(parsed.total_usdc_cents, 123);
okServer.close();

const rejectServer = await listen((req, res) => { res.statusCode = 401; res.end('{"error":"login required"}'); });
r = await run(['--earnings'], { DASHA_COORDINATOR_URL: `http://127.0.0.1:${rejectServer.address().port}/compute/api`, DASHA_PROVIDER_ID: 'mac_test1', DASHA_PROVIDER_KEY_FILE: keyFile, HOME: dir });
assert.equal(r.code, 1);
assert.match(r.err, /re-enroll from the Provide page/, 'bad token points at re-enroll');
rejectServer.close();

// --- server-side pins ---
const net = await readFile(join(root, 'dasha-compute-network.mjs'), 'utf8');
assert.match(net, /Kit CLI `dasha-compute earnings`[\s\S]*?searchParams\.get\('provider_id'\)/, 'earnings accepts Bearer provider token');
assert.match(net, /provider\.kitVersion = kitVersion/, 'poll stores kit version');
assert.match(net, /kit_versions/, '/api/network exposes version skew');
assert.match(net, /kit_version: provider\.kitVersion \|\| null/, 'owner provider list shows kit_version');

const worker = await readFile(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.match(worker, /const COMPUTE_KIT_JSON = \{[\s\S]*?version: '0\.3\.0'[\s\S]*?min_version: '0\.3\.0'/, 'kit.json manifest present (still 0.3.0 until tar refresh)');
assert.match(worker, /sha256: '4f48b0221dded4a6817da3baa1c04cd29b8edd5ec0ecc5771485aa170310edcf'/, 'kit.json sha256 pins the live tar');
assert.match(worker, /isComputeKitJsonPath/);

console.log('dasha-compute-kit-v031: PASS');
