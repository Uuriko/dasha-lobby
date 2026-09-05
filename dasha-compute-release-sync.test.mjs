#!/usr/bin/env node
/** dasha-compute-release-sync.mjs: provenance triple verification + assets layout.
    Refuses inconsistent sources; --write lays out tar.gz + .sha256 + compute/release.json; --check catches staleness. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const script = join(root, 'dasha-compute-release-sync.mjs');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function makeSource(archiveBytes, { tamperSidecar = false, tamperBytes = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dasha-release-src-'));
  const digest = sha256(archiveBytes);
  await writeFile(join(dir, 'dasha-compute-open-alpha.tar.gz'), archiveBytes);
  await writeFile(join(dir, 'dasha-compute-open-alpha.tar.gz.sha256'), `${tamperSidecar ? '0'.repeat(64) : digest}  dasha-compute-open-alpha.tar.gz\n`);
  await writeFile(join(dir, 'release.json'), JSON.stringify({ artifact: 'dasha-compute-open-alpha.tar.gz', bytes: tamperBytes ? archiveBytes.byteLength + 1 : archiveBytes.byteLength, sha256: digest, version: '0.3.0' }));
  return { dir, digest };
}

function run(args) {
  return spawnSync('node', [script, ...args], { encoding: 'utf8' });
}

// 1. consistent source: --write lays out the full provenance triple, --check passes
{
  const archive = new TextEncoder().encode(`fixture-archive-${Date.now()}`);
  const { dir: src, digest } = await makeSource(archive);
  const assets = await mkdtemp(join(tmpdir(), 'dasha-release-assets-'));
  const write = run(['--write', '--source', src, '--assets', assets]);
  assert.equal(write.status, 0, write.stderr);
  assert.match(write.stdout, new RegExp(`sha256=${digest}`));
  const laid = await readFile(join(assets, 'dasha-compute-open-alpha.tar.gz'));
  assert.deepEqual(laid, Buffer.from(archive), 'archive bytes at assets root');
  assert.ok((await readFile(join(assets, 'dasha-compute-open-alpha.tar.gz.sha256'), 'utf8')).includes(digest), 'sidecar at assets root');
  assert.equal(JSON.parse(await readFile(join(assets, 'compute', 'release.json'), 'utf8')).sha256, digest, 'manifest under assets/compute/');
  const check = run(['--check', '--source', src, '--assets', assets]);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /check PASS/);
  await rm(src, { recursive: true, force: true });
  await rm(assets, { recursive: true, force: true });
}

// 2. tampered sidecar: refuse, write nothing
{
  const archive = new TextEncoder().encode('fixture-archive-sidecar');
  const { dir: src } = await makeSource(archive, { tamperSidecar: true });
  const assets = await mkdtemp(join(tmpdir(), 'dasha-release-assets-'));
  const write = run(['--write', '--source', src, '--assets', assets]);
  assert.notEqual(write.status, 0, 'tampered sidecar must be refused');
  assert.match(write.stderr, /does not match the archive digest/);
  await assert.rejects(readFile(join(assets, 'dasha-compute-open-alpha.tar.gz')), 'no archive written on refusal');
  await rm(src, { recursive: true, force: true });
  await rm(assets, { recursive: true, force: true });
}

// 3. tampered manifest bytes: refuse
{
  const archive = new TextEncoder().encode('fixture-archive-bytes');
  const { dir: src } = await makeSource(archive, { tamperBytes: true });
  const assets = await mkdtemp(join(tmpdir(), 'dasha-release-assets-'));
  const write = run(['--write', '--source', src, '--assets', assets]);
  assert.notEqual(write.status, 0, 'tampered manifest must be refused');
  assert.match(write.stderr, /bytes .* != archive/);
  await rm(src, { recursive: true, force: true });
  await rm(assets, { recursive: true, force: true });
}

// 4. stale assets: --check fails, --write repairs, --check passes
{
  const archive = new TextEncoder().encode('fixture-archive-fresh');
  const { dir: src } = await makeSource(archive);
  const assets = await mkdtemp(join(tmpdir(), 'dasha-release-assets-'));
  await mkdir(join(assets, 'compute'), { recursive: true });
  await writeFile(join(assets, 'dasha-compute-open-alpha.tar.gz'), 'stale-archive');
  await writeFile(join(assets, 'dasha-compute-open-alpha.tar.gz.sha256'), `${sha256('stale-archive')}  dasha-compute-open-alpha.tar.gz\n`);
  await writeFile(join(assets, 'compute', 'release.json'), JSON.stringify({ artifact: 'dasha-compute-open-alpha.tar.gz', bytes: 13, sha256: sha256('stale-archive') }));
  const stale = run(['--check', '--source', src, '--assets', assets]);
  assert.notEqual(stale.status, 0, 'stale assets must fail --check');
  assert.match(stale.stderr, /differs from source/);
  assert.equal(run(['--write', '--source', src, '--assets', assets]).status, 0);
  assert.equal(run(['--check', '--source', src, '--assets', assets]).status, 0, 'post-write check passes');
  await rm(src, { recursive: true, force: true });
  await rm(assets, { recursive: true, force: true });
}

// 5. missing assets triple: --check fails with a clear message
{
  const archive = new TextEncoder().encode('fixture-archive-missing');
  const { dir: src } = await makeSource(archive);
  const assets = await mkdtemp(join(tmpdir(), 'dasha-release-assets-'));
  const missing = run(['--check', '--source', src, '--assets', assets]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /triple incomplete or missing/);
  await rm(src, { recursive: true, force: true });
  await rm(assets, { recursive: true, force: true });
}

console.log('dasha-compute-release-sync: all assertions passed');
