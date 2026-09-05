import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = 'dasha-crew';
const output = join(root, 'dasha-worker-assets', `${source}.tar.gz`);
const temporary = `${output}.tmp`;
const mode = process.argv[2];

if (!['--write', '--check'].includes(mode)) {
  console.error('usage: node dasha-crew-kit-build.mjs --write|--check');
  process.exit(2);
}

const tar = spawnSync('tar', [
  '--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner',
  '--exclude=*/__pycache__', '--exclude=*.pyc', '--exclude=.env', '-czf', temporary, source,
], { cwd: root, stdio: 'inherit' });
if (tar.status !== 0) process.exit(tar.status || 1);

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const built = await readFile(temporary);
if (mode === '--write') {
  await rename(temporary, output);
  console.log(`dasha-crew-kit-build: wrote ${output} sha256=${digest(built)}`);
} else {
  const current = await readFile(output).catch(() => null);
  await rm(temporary, { force: true });
  if (!current || !built.equals(current)) {
    console.error('dasha-crew-kit-build: archive is out of sync; run --write');
    process.exit(1);
  }
  console.log(`dasha-crew-kit-build: check PASS sha256=${digest(built)}`);
}
