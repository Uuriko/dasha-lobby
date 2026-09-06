#!/usr/bin/env node
/**
 * Prefer MLX — Provide kit / doctor / skill / Setup UI soft path.
 * Ollama ≥0.33.1 recommend + internal SSD warn + engine badge.
 * No invented Ollama MLX env flags. Doctor never fails solely for missing MLX.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { PROVIDE_SKILL_MD, USE_SKILL_MD } from './dasha-compute-skills.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');

assert.match(html, /id=["']provide-prefer-mlx["'][^>]*>Prefer MLX when you can · Ollama ≥0\.33\.1 · models on internal SSD\.</);
assert.match(html, /id=["']step-provide-done["'][\s\S]*?id=["']provide-tto["'][\s\S]*?id=["']provide-prefer-mlx["']/);
assert.match(html, /mlx=\$\(['"]provide-prefer-mlx['"]\)/);
assert.match(html, /if\(mlx\)mlx\.hidden=true/);
assert.match(html, /href=["']\/privacy["']/, 'compute footer quiet Privacy link');
assert.match(html, /tokens_per_second/);
assert.match(html, /measured_providers/);
assert.match(html, /function formatTokPerSec/);
assert.match(html, /ownMacTps/);
assert.match(html, /doctor soft-hints if missing/);
assert.match(COMPUTE_PAGE_HTML, /tokens_per_second/);
assert.match(COMPUTE_PAGE_HTML, /measured_providers/);
assert.match(COMPUTE_PAGE_HTML, /function formatTokPerSec/);
assert.match(COMPUTE_PAGE_HTML, /ownMacTps/);
assert.match(COMPUTE_PAGE_HTML, /doctor soft-hints if missing/);
assert.doesNotMatch(html, /OLLAMA_USE_MLX|OLLAMA_FLASH_ATTENTION/);

const provideDisk = await readFile(join(root, 'dasha-compute-skills/PROVIDE.md'), 'utf8');
const useDisk = await readFile(join(root, 'dasha-compute-skills/USE.md'), 'utf8');
assert.equal(PROVIDE_SKILL_MD, provideDisk);
assert.equal(USE_SKILL_MD, useDisk);
assert.match(PROVIDE_SKILL_MD, /Prefer MLX \(Apple Silicon, optional\)/);
assert.match(PROVIDE_SKILL_MD, /Prefer MLX when you can/);
assert.match(PROVIDE_SKILL_MD, /Ollama ≥0\.33\.1/);
assert.match(PROVIDE_SKILL_MD, /internal SSD/);
assert.match(PROVIDE_SKILL_MD, /structured-output/);
assert.match(PROVIDE_SKILL_MD, /\*-mlx/);
assert.match(PROVIDE_SKILL_MD, /never fails solely for missing MLX/);
assert.match(PROVIDE_SKILL_MD, /sub-24GB/);
assert.doesNotMatch(PROVIDE_SKILL_MD, /OLLAMA_USE_MLX|OLLAMA_FLASH_ATTENTION/);
assert.match(USE_SKILL_MD, /Prefer MLX when you can \(providers\)/);
assert.match(USE_SKILL_MD, /Ollama ≥0\.33\.1/);

const install = await readFile(join(root, 'dasha-compute-open-alpha/install.sh'), 'utf8');
assert.match(install, /Prefer MLX when you can/);
assert.match(install, /Ollama ≥0\.33\.1/);
assert.match(install, /internal SSD/);
const readme = await readFile(join(root, 'dasha-compute-open-alpha/README.md'), 'utf8');
assert.match(readme, /## Prefer MLX \(Apple Silicon\)/);
assert.match(readme, /Ollama ≥0\.33\.1/);
assert.match(readme, /internal SSD/);
assert.match(readme, /structured output/i);
assert.doesNotMatch(readme, /OLLAMA_USE_MLX|OLLAMA_FLASH_ATTENTION/);

const agentSrc = await readFile(join(root, 'dasha-compute-open-alpha/provider/agent.py'), 'utf8');
assert.match(agentSrc, /def prefer_mlx_report/);
assert.match(agentSrc, /def ollama_version_info/);
assert.match(agentSrc, /def parse_ollama_version/);
assert.match(agentSrc, /OLLAMA_MLX_MIN = \(0, 33, 1\)/);
assert.match(agentSrc, /Prefer MLX when you can/);
assert.match(agentSrc, /prefer_mlx_report\(\)/);
assert.match(agentSrc, /internal SSD/);
assert.match(agentSrc, /structured-output capable/);
assert.match(agentSrc, /api\/version/);
assert.doesNotMatch(agentSrc, /OLLAMA_USE_MLX|OLLAMA_FLASH_ATTENTION/);
assert.match(agentSrc, /tokens_per_second/);
assert.match(agentSrc, /benchmark soft · run dasha-compute benchmark so measured tok\/s can show on Ask/);
assert.match(agentSrc, /def model_billions/);
assert.match(agentSrc, /def size_soft_report/);
assert.match(agentSrc, /def keepalive_soft_report/);
assert.match(agentSrc, /api\/ps/);
assert.match(agentSrc, /never fails doctor/);
assert.match(PROVIDE_SKILL_MD, /soft-hints when a mapped model looks ≥27B/);
assert.match(PROVIDE_SKILL_MD, /Ollama `\/api\/ps`/);
assert.match(PROVIDE_SKILL_MD, /Never fails solely for size or keep-alive/);
assert.match(readme, /mapped ≥27B tags and cold `\/api\/ps` keep-alive/);
assert.match(readme, /never fails solely for those/);

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
  const child = spawn('python3', [join(root, 'dasha-compute-open-alpha/provider/agent.py'), '--doctor'], { cwd, env: childEnv });
  let stdout = '', stderr = '';
  child.stdout.on('data', (c) => { stdout += c; });
  child.stderr.on('data', (c) => { stderr += c; });
  return new Promise((resolve) => child.once('close', (code) => resolve({ code, stdout, stderr, text: stdout + stderr })));
}

async function withDoctor({ version, models, ps, modelMap }, run) {
  const ollama = await listen((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') {
      res.end(JSON.stringify({ models }));
      return;
    }
    if (req.url === '/api/version') {
      res.end(JSON.stringify({ version }));
      return;
    }
    if (req.url === '/api/ps') {
      if (ps === 'fail') {
        res.statusCode = 500;
        res.end('{"error":"ps down"}');
        return;
      }
      res.end(JSON.stringify(ps ?? {}));
      return;
    }
    res.end('{}');
  });
  const { port } = ollama.address();
  const cwd = await mkdtemp(join(tmpdir(), 'dasha-prefer-mlx-'));
  await writeFile(join(cwd, '.dasha-provider-key'), 'dcp_prefer_mlx_token\n', { mode: 0o600 });
  const coord = await listen((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url?.includes('/providers/verify') || req.url?.includes('/healthz')) {
      res.end(JSON.stringify({ name: 'prefer-mlx-mac', ok: true }));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  const cport = coord.address().port;
  try {
    return await run({
      cwd,
      env: { ...process.env, OLLAMA_URL: `http://127.0.0.1:${port}`, DASHA_MODEL_MAP: modelMap || 'qwen3-8b=qwen3:8b' },
      extraEnv: {
        DASHA_COORDINATOR_URL: `http://127.0.0.1:${cport}/compute/api`,
        DASHA_PROVIDER_ID: 'prefer-mlx-mac',
      },
    });
  } finally {
    ollama.close();
    coord.close();
  }
}

const result = await withDoctor(
  { version: '0.33.1', models: [{ name: 'qwen3:8b' }, { name: 'gemma4:12b-mlx' }] },
  (opts) => doctor(opts),
);
assert.equal(result.code, 0, `doctor should pass without MLX requirement: ${result.text}`);
assert.match(result.stdout, /mlx\s+hint · Prefer MLX when you can/);
assert.match(result.stdout, /ollama mlx tags:.*gemma4:12b-mlx|Prefer MLX when you can/);
assert.match(result.stdout, /Ollama still works/);
assert.match(result.stdout, /0\.33\.1/);
assert.match(result.stdout, /internal SSD/);
assert.match(result.stdout, /MLX \/ structured-output capable/);
assert.doesNotMatch(result.text, /OLLAMA_USE_MLX|OLLAMA_FLASH_ATTENTION/);

const older = await withDoctor(
  { version: '0.32.0', models: [{ name: 'qwen3:8b' }] },
  (opts) => doctor(opts),
);
assert.equal(older.code, 0, `doctor soft-warns older ollama, still exits 0: ${older.text}`);
assert.match(older.stdout, /older than 0\.33\.1|soft · 0\.32\.0/);
assert.match(older.stdout, /internal SSD/);
assert.doesNotMatch(older.text, /OLLAMA_USE_MLX|OLLAMA_FLASH_ATTENTION/);

const large = await withDoctor(
  { version: '0.33.1', models: [{ name: 'gemma3:27b' }], modelMap: 'gemma3-27b=gemma3:27b', ps: { models: [{ name: 'gemma3:27b' }] } },
  (opts) => doctor(opts),
);
assert.equal(large.code, 0, `doctor never fails solely for ≥27B size: ${large.text}`);
assert.match(large.stdout, /size\s+soft · gemma3-27b→gemma3:27b \(~27B\)/);
assert.match(large.stdout, /never fails doctor/);
assert.doesNotMatch(large.stderr, /models\s+failed/);

const cold = await withDoctor(
  { version: '0.33.1', models: [{ name: 'qwen3:8b' }], ps: { models: [] } },
  (opts) => doctor(opts),
);
assert.equal(cold.code, 0, `doctor never fails solely for cold keep-alive: ${cold.text}`);
assert.match(cold.stdout, /keepalive soft · mapped model not loaded \(qwen3:8b\)/);
assert.match(cold.stdout, /OLLAMA_KEEP_ALIVE=-1/);

const hot = await withDoctor(
  { version: '0.33.1', models: [{ name: 'qwen3:8b' }], ps: { models: [{ name: 'qwen3:8b' }] } },
  (opts) => doctor(opts),
);
assert.equal(hot.code, 0, `doctor keep-alive ok when \/api\/ps shows mapped model: ${hot.text}`);
assert.match(hot.stdout, /keepalive ok · mapped model\(s\) loaded in Ollama/);

const psDown = await withDoctor(
  { version: '0.33.1', models: [{ name: 'qwen3:8b' }], ps: 'fail' },
  (opts) => doctor(opts),
);
assert.equal(psDown.code, 0, `doctor never fails solely when \/api\/ps is unread: ${psDown.text}`);
assert.match(psDown.stdout, /keepalive soft · could not read Ollama \/api\/ps/);

console.log('dasha-compute-prefer-mlx: PASS (0.33.1 detect + SSD warn + engine badge; soft older; size ≥27B + keepalive \/api\/ps never fail solely; no invented env flags)');
