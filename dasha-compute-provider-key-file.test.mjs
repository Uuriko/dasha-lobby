#!/usr/bin/env node
/** Provide setup paste hands the one-time token through a 0600 file, not DASHA_PROVIDER_KEY= on argv. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');
assert.doesNotMatch(html, /DASHA_PROVIDER_KEY=/, 'HTML must not contain DASHA_PROVIDER_KEY= as a command assignment');
assert.match(html, /\.dasha-provider-key/);
assert.match(html, /chmod 0600 \.dasha-provider-key/);
assert.match(html, /DASHA_COORDINATOR_URL=/);
assert.match(html, /DASHA_PROVIDER_ID=/);
assert.match(html, /DASHA_MODEL_MAP=/);
assert.match(html, /\.\/install\.sh/);

const help = execFileSync('sh', [join(root, 'dasha-compute-open-alpha/install.sh'), '--help'], { encoding: 'utf8' });
assert.match(help, /\.dasha-provider-key/);
assert.match(help, /DASHA_PROVIDER_KEY_FILE/);
assert.match(help, /DASHA_PROVIDER_ID=/);
assert.match(help, /DASHA_MODEL_MAP=/);
assert.match(help, /\.\/install\.sh/);
assert.doesNotMatch(help, /DASHA_PROVIDER_KEY=/);

const install = readFileSync(join(root, 'dasha-compute-open-alpha/install.sh'), 'utf8');
assert.match(install, /rm -f "\$KEY_FILE"/);
assert.match(install, /install -m 600 "\$KEY_FILE" "\$STORED_KEY"/);
assert.match(install, /DASHA_PROVIDER_KEY_FILE=/);
assert.match(install, /security add-generic-password/);
assert.doesNotMatch(install, /DASHA_PROVIDER_KEY=\$DASHA_PROVIDER_KEY/);
assert.doesNotMatch(install, /DASHA_PROVIDER_KEY=\$TOKEN/);
assert.match(install, /DASHA_PROVIDER_KEY= DASHA_COORDINATOR_URL=/);

const runProvider = readFileSync(join(root, 'dasha-compute-open-alpha/provider/run-provider'), 'utf8');
assert.match(runProvider, /unset DASHA_PROVIDER_KEY/);
assert.match(runProvider, /DASHA_PROVIDER_KEY_FILE/);
assert.doesNotMatch(runProvider, /DASHA_PROVIDER_KEY=\$\(/);
assert.doesNotMatch(runProvider, /export DASHA_PROVIDER_KEY(?:\s|$)/m);

const wrapper = readFileSync(join(root, 'dasha-compute-open-alpha/provider/dasha-compute'), 'utf8');
assert.match(wrapper, /unset DASHA_PROVIDER_KEY/);
assert.doesNotMatch(wrapper, /DASHA_PROVIDER_KEY=\$\(/);
assert.doesNotMatch(wrapper, /DASHA_PROVIDER_KEY=\$DASHA_PROVIDER_KEY/);

console.log('dasha-compute-provider-key-file: PASS (paste + help keep the token off argv)');
