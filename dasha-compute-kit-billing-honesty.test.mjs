#!/usr/bin/env node
/**
 * Live Worker c4f477c9: kit README/THREAT must not claim live has no billing.
 * Local free; live prepaid credits ($0.05/job); self-route free; Hosted 3 free/10 min.
 * Locks source + published archive (if present) + cheap live kit extract.
 * Keeps ASK-FIRST hello from Worker 5eccb256 / PR #31.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

function extractKitFile(archivePath, rel) {
  return execFileSync("tar", ["-xOf", archivePath, `dasha-compute-open-alpha/${rel}`], {
    encoding: "utf8",
  });
}

function assertKitBillingHonesty(readme, threat, label) {
  assert.doesNotMatch(readme, /Neither mode has billing/, `${label} README no neither-mode-has-billing`);
  assert.doesNotMatch(readme, /no billing yet/, `${label} README no no-billing-yet`);
  assert.match(readme, /Local mode has no billing/, `${label} README local free`);
  assert.match(readme, /prepaid credits \(\$0\.05\/job\)/, `${label} README live prepaid $0.05/job`);
  assert.match(readme, /self-route \(own Mac\) stays free/, `${label} README self-route free`);
  assert.match(readme, /Hosted Ask is 3 free \/ 10 min/, `${label} README Hosted 3 free/10 min`);
  assert.match(readme, /Self-hosting and self-routing remain free/, `${label} README self-hosting free`);
  assert.match(
    readme,
    /Live already meters prepaid USDC\/`\$dasha` credits/,
    `${label} README live already meters`,
  );

  assert.doesNotMatch(
    threat,
    /encrypted memory isolation, billing ledger, tax handling/,
    `${label} THREAT no bundled no-billing-ledger claim`,
  );
  assert.doesNotMatch(
    threat,
    /Future balances and metering records, which do not exist in this release/,
    `${label} THREAT no missing-balances claim`,
  );
  assert.match(threat, /The local coordinator has no billing ledger/, `${label} THREAT local no ledger`);
  assert.match(threat, /Live getdasha\.com uses prepaid credits/, `${label} THREAT live prepaid`);
  assert.match(
    threat,
    /Live prepaid credit balances on getdasha\.com/,
    `${label} THREAT live balances exist`,
  );
  assert.match(threat, /Local mode has no balances or metering records/, `${label} THREAT local no balances`);
}

function assertHelloExample(text, label) {
  assert.match(text, /"content": "hello"/, `${label} content hello`);
  assert.doesNotMatch(text, /Make the timeline stranger/, `${label} no novelty prompt`);
}

const readme = readFileSync(join(root, "dasha-compute-open-alpha/README.md"), "utf8");
const threat = readFileSync(join(root, "dasha-compute-open-alpha/THREAT_MODEL.md"), "utf8");
assertKitBillingHonesty(readme, threat, "source");
assert.match(readme, /"content":"hello"/, "source README curl hello");

const chat = readFileSync(join(root, "dasha-compute-open-alpha/examples/chat.py"), "utf8");
assertHelloExample(chat, "source examples/chat.py");

const archives = [
  join(root, "dasha-worker-assets/dasha-compute-open-alpha.tar.gz"),
  join(root, "dasha-compute-open-alpha.tar.gz"),
];
for (const kit of archives) {
  if (!existsSync(kit)) continue;
  const packedReadme = extractKitFile(kit, "README.md");
  const packedThreat = extractKitFile(kit, "THREAT_MODEL.md");
  assert.equal(packedReadme, readme, `${kit} README must match source`);
  assert.equal(packedThreat, threat, `${kit} THREAT must match source`);
  assertKitBillingHonesty(packedReadme, packedThreat, kit);
  assertHelloExample(extractKitFile(kit, "examples/chat.py"), `${kit} chat.py`);
}

const live = await fetch("https://www.getdasha.com/dasha-compute-open-alpha.tar.gz", {
  headers: { "user-agent": UA },
});
assert.equal(live.status, 200, "live kit 200");
const bytes = Buffer.from(await live.arrayBuffer());
const digest = createHash("sha256").update(bytes).digest("hex");
const tmp = join(mkdtempSync(join(tmpdir(), "dasha-kit-billing-")), "dasha-compute-open-alpha.tar.gz");
writeFileSync(tmp, bytes);
assertKitBillingHonesty(
  extractKitFile(tmp, "README.md"),
  extractKitFile(tmp, "THREAT_MODEL.md"),
  "live kit",
);
assertHelloExample(extractKitFile(tmp, "examples/chat.py"), "live kit examples/chat.py");

console.log(`dasha-compute-kit-billing-honesty: PASS sha256=${digest}`);
