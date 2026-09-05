#!/usr/bin/env node
/**
 * Lock #setup on /compute ↔ PROVIDE.md core install commands.
 * Setup (pre-register) keeps agent --doctor; skill post-install verify is dasha-compute doctor.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { PROVIDE_SKILL_MD } from "./dasha-compute-skills.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const htmlDisk = readFileSync(join(root, "dasha-compute.html"), "utf8");
const provideDisk = readFileSync(join(root, "dasha-compute-skills/PROVIDE.md"), "utf8");
assert.equal(htmlDisk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");
assert.equal(provideDisk, PROVIDE_SKILL_MD, "PROVIDE skill embed matches disk");

const SETUP_CRITICAL = [
  "curl -fLO https://www.getdasha.com/dasha-compute-open-alpha.tar.gz",
  "tar -xzf dasha-compute-open-alpha.tar.gz",
  "cd dasha-compute-open-alpha",
  "ollama pull qwen3:8b",
  "python3 provider/agent.py --doctor",
];

const PROVIDE_CRITICAL = [
  "curl -fLO https://www.getdasha.com/dasha-compute-open-alpha.tar.gz",
  "tar -xzf dasha-compute-open-alpha.tar.gz",
  "cd dasha-compute-open-alpha",
  "ollama pull qwen3:8b",
  "./install.sh",
  "dasha-compute doctor",
  "dasha-compute status",
];

function extractSetup(html) {
  const m = html.match(/<pre class="setup" id="setup"[^>]*>([\s\S]*?)<\/pre>/);
  assert.ok(m, "#setup pre present");
  return m[1]
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

function extractProvideInstall(md) {
  const fences = [...md.matchAll(/```bash\n([\s\S]*?)```/g)].map((x) => x[1]);
  assert.ok(fences.length >= 1, "PROVIDE.md has bash fences");
  return fences.join("\n");
}

const setup = extractSetup(COMPUTE_PAGE_HTML);
const provideBash = extractProvideInstall(PROVIDE_SKILL_MD);

for (const line of SETUP_CRITICAL) {
  assert.ok(setup.includes(line), `#setup missing: ${line}`);
}
for (const line of PROVIDE_CRITICAL) {
  assert.ok(provideBash.includes(line), `PROVIDE.md bash missing: ${line}`);
}

// First-hour honesty: skill verify must not re-run cwd agent --doctor after install.sh moved the key.
assert.doesNotMatch(
  PROVIDE_SKILL_MD,
  /Verify[\s\S]*?```bash\nDASHA_MODEL_MAP=[\s\S]*?python3 provider\/agent\.py --doctor/,
  "post-install verify must not use cwd agent --doctor"
);
assert.doesNotMatch(PROVIDE_SKILL_MD, /size your Mac/);
assert.doesNotMatch(PROVIDE_SKILL_MD, /→ Register this Mac/);
assert.match(PROVIDE_SKILL_MD, /→ Register\./);
assert.match(PROVIDE_SKILL_MD, /copy the Setup command on the page/);

const kitReadme = readFileSync(join(root, "dasha-compute-open-alpha/README.md"), "utf8");
assert.doesNotMatch(kitReadme, /size your Mac/);
assert.doesNotMatch(kitReadme, /Register this Mac/);
assert.doesNotMatch(kitReadme, /\*\*Build\*\* tab/);
assert.match(kitReadme, /name the Mac/);
assert.match(kitReadme, /choose \*\*Register\*\*/);

// defaultSetup() in page JS must match the static #setup body (pre-register).
const ds = COMPUTE_PAGE_HTML.match(/function defaultSetup\(\)\{\s*return `([\s\S]*?)`;\s*\}/);
assert.ok(ds, "defaultSetup present");
const defaultBody = ds[1].replace(/\\n/g, "\n").replace(/\\`/g, "`").replace(/\\\\/g, "\\");
assert.equal(defaultBody, setup, "defaultSetup === #setup body");

console.log("dasha-compute-provide-setup-parity: PASS");
