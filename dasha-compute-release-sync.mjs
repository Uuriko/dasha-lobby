#!/usr/bin/env node
/** Sync the provenance Compute release (dasha-desk artifacts/dasha-compute) into dasha-worker-assets.
 *
 * The edge Worker serves /dasha-compute-open-alpha.tar.gz from the ASSETS binding
 * (run_worker_first falls through to assets), so syncing this directory plus a wrangler
 * deploy publishes the kit. The .sha256 sidecar and /compute/release.json are the
 * provenance probes watch.mjs (dasha-desk) requires on the edge.
 *
 *   node dasha-compute-release-sync.mjs --write                      # fetch from dasha-desk@main, write assets
 *   node dasha-compute-release-sync.mjs --check                      # verify assets match the source
 *   node dasha-compute-release-sync.mjs --write --source <dir>       # use a local artifact directory
 *   node dasha-compute-release-sync.mjs --check --assets <dir>       # verify a different assets directory
 *
 * Refuses to write anything unless archive, sidecar, and release.json all agree.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const REMOTE = 'https://raw.githubusercontent.com/Uuriko/dasha-desk/main/artifacts/dasha-compute';
const FILES = {
  archive: 'dasha-compute-open-alpha.tar.gz',
  sidecar: 'dasha-compute-open-alpha.tar.gz.sha256',
  manifest: 'release.json',
};

const args = process.argv.slice(2);
const mode = args[0];
if (!['--write', '--check'].includes(mode)) {
  console.error('usage: node dasha-compute-release-sync.mjs --write|--check [--source <dir>] [--assets <dir>]');
  process.exit(2);
}
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const source = option('--source');
const assets = option('--assets') || join(root, 'dasha-worker-assets');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function loadTriple() {
  if (source) {
    return {
      archive: await readFile(join(source, FILES.archive)),
      sidecar: await readFile(join(source, FILES.sidecar), 'utf8'),
      manifest: await readFile(join(source, FILES.manifest), 'utf8'),
    };
  }
  const triple = {};
  for (const [key, name] of Object.entries(FILES)) {
    const res = await fetch(`${REMOTE}/${name}`);
    if (!res.ok) {
      console.error(`dasha-compute-release-sync: fetch ${REMOTE}/${name} -> HTTP ${res.status}`);
      process.exit(1);
    }
    triple[key] = key === 'archive' ? new Uint8Array(await res.arrayBuffer()) : await res.text();
  }
  return triple;
}

function verify({ archive, sidecar, manifest }) {
  const digest = sha256(archive);
  if (!sidecar.includes(digest)) return { ok: false, why: `sidecar ${FILES.sidecar} does not match the archive digest ${digest}` };
  let data;
  try { data = JSON.parse(manifest); } catch { return { ok: false, why: `${FILES.manifest}: not JSON` }; }
  if (data.sha256 !== digest) return { ok: false, why: `${FILES.manifest}: sha256 ${data.sha256} != archive ${digest}` };
  if (Number(data.bytes) !== archive.byteLength) return { ok: false, why: `${FILES.manifest}: bytes ${data.bytes} != archive ${archive.byteLength}` };
  return { ok: true, digest };
}

async function writeAssets(triple) {
  await mkdir(join(assets, 'compute'), { recursive: true });
  const writes = [
    [join(assets, FILES.archive), triple.archive],
    [join(assets, FILES.sidecar), triple.sidecar],
    [join(assets, 'compute', FILES.manifest), triple.manifest],
  ];
  for (const [path, contents] of writes) {
    const temporary = `${path}.tmp`;
    await writeFile(temporary, contents);
    try {
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw new Error(`rename failed for ${path}: ${error.message}`);
    }
  }
}

async function checkAssets(triple) {
  const current = {
    archive: await readFile(join(assets, FILES.archive)).catch(() => null),
    sidecar: await readFile(join(assets, FILES.sidecar), 'utf8').catch(() => null),
    manifest: await readFile(join(assets, 'compute', FILES.manifest), 'utf8').catch(() => null),
  };
  if (!current.archive || current.sidecar == null || current.manifest == null) return { ok: false, why: `${assets}: provenance triple incomplete or missing` };
  const want = verify(triple);
  if (!want.ok) return want;
  if (!Buffer.from(current.archive).equals(Buffer.from(triple.archive))) return { ok: false, why: `${FILES.archive}: assets archive differs from source` };
  if (current.sidecar !== triple.sidecar) return { ok: false, why: `${FILES.sidecar}: assets sidecar differs from source` };
  if (current.manifest !== triple.manifest) return { ok: false, why: `compute/${FILES.manifest}: assets manifest differs from source` };
  return { ok: true, digest: want.digest };
}

const triple = await loadTriple();
const verdict = verify(triple);
if (!verdict.ok) {
  console.error(`dasha-compute-release-sync: source refused - ${verdict.why}`);
  process.exit(1);
}
if (mode === '--write') {
  await writeAssets(triple);
  console.log(`dasha-compute-release-sync: wrote ${assets} sha256=${verdict.digest}`);
} else {
  const check = await checkAssets(triple);
  if (!check.ok) {
    console.error(`dasha-compute-release-sync: check FAIL - ${check.why}; run --write`);
    process.exit(1);
  }
  console.log(`dasha-compute-release-sync: check PASS sha256=${check.digest}`);
}
