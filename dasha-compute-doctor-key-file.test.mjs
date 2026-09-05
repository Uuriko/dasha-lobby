#!/usr/bin/env node
/** Live-queue doctor with no .dasha-provider-key must tell people to write the 0600 file, not DASHA_PROVIDER_KEY= on argv. Never POST verify. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');
assert.doesNotMatch(html, /DASHA_PROVIDER_KEY=/, 'HTML must not assign DASHA_PROVIDER_KEY= on argv');
assert.match(html, /\.dasha-provider-key/);
assert.match(html, /chmod 0600 \.dasha-provider-key/);
assert.match(html, /python3 provider\/agent\.py --doctor/);

const install = await readFile(join(root, 'dasha-compute-open-alpha/install.sh'), 'utf8');
assert.doesNotMatch(install, /DASHA_PROVIDER_KEY=\$DASHA_PROVIDER_KEY/, 'install doctor must not put the token on argv');
assert.match(install, /DASHA_PROVIDER_KEY_FILE/);
assert.match(install, /\.dasha-provider-key/);

const agent = join(root, 'dasha-compute-open-alpha/provider/agent.py');

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function doctor({ cwd, env, extraEnv }) {
  const childEnv = { ...env };
  delete childEnv.DASHA_PROVIDER_KEY;
  delete childEnv.DASHA_PROVIDER_KEY_FILE;
  Object.assign(childEnv, extraEnv);
  const child = spawn('python3', [agent, '--doctor'], { cwd, env: childEnv });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return new Promise((resolve) => child.once('close', (code) => resolve({ code, stdout, stderr, text: stdout + stderr })));
}

const hits = [];
const ollama = await listen((request, response) => {
  hits.push(`${request.method} ${request.url}`);
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ models: [{ name: 'qwen3:8b' }] }));
});
const { port } = ollama.address();
const cwd = await mkdtemp(join(tmpdir(), 'dasha-doctor-key-'));
const baseEnv = { ...process.env, OLLAMA_URL: `http://127.0.0.1:${port}`, DASHA_MODEL_MAP: 'qwen3-8b=qwen3:8b' };

{
  const result = await doctor({
    cwd,
    env: baseEnv,
    extraEnv: { DASHA_COORDINATOR_URL: `http://127.0.0.1:${port}/compute/api` },
  });
  assert.notEqual(result.code, 0, 'missing file must fail doctor');
  assert.match(result.stderr, /\.dasha-provider-key/);
  assert.match(result.stderr, /chmod 0600/);
  assert.doesNotMatch(result.text, /DASHA_PROVIDER_KEY=/);
  assert.equal(hits.some((row) => row.includes('/providers/verify')), false, 'missing file must not POST verify');
}

{
  const result = await doctor({
    cwd,
    env: baseEnv,
    extraEnv: {
      DASHA_COORDINATOR_URL: `http://127.0.0.1:${port}/compute/api`,
      DASHA_PROVIDER_KEY: 'dcp_must_not_use_env',
    },
  });
  assert.notEqual(result.code, 0, 'live doctor must ignore env token when the file is missing');
  assert.equal(hits.some((row) => row.includes('/providers/verify')), false, 'env token must not POST verify on live queue');
}

{
  await writeFile(join(cwd, '.dasha-provider-key'), 'dcp_unit_test_token\n', { mode: 0o600 });
  const result = await doctor({
    cwd,
    env: baseEnv,
    extraEnv: { DASHA_COORDINATOR_URL: `http://127.0.0.1:${port}/compute/api` },
  });
  assert.match(result.text, /Dasha Compute provider doctor/);
  assert.doesNotMatch(result.text, /DASHA_PROVIDER_KEY=/);
  assert.ok(hits.some((row) => row.includes('/providers/verify')), 'file present may verify against the stub');
}

ollama.close();
console.log('dasha-compute-doctor-key-file: PASS (missing .dasha-provider-key points at the 0600 file, never DASHA_PROVIDER_KEY= argv)');
