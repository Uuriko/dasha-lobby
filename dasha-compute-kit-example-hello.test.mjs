#!/usr/bin/env node
/**
 * Live Worker 5eccb256: Provide kit examples/chat.py ASK-FIRST hello.
 * API/curl examples use "hello" — never novelty “Make the timeline stranger…”.
 * Locks source + published archive (if present) + cheap live kit extract.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";
import { USE_SKILL_MD } from "./dasha-compute-skills.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

function assertHelloExample(text, label) {
  assert.match(text, /"content": "hello"/, `${label} content hello`);
  assert.doesNotMatch(text, /Make the timeline stranger/, `${label} no novelty prompt`);
  assert.doesNotMatch(text, /say something strange/, `${label} no strange`);
}

function extractKitChat(archivePath) {
  return execFileSync("tar", ["-xOf", archivePath, "dasha-compute-open-alpha/examples/chat.py"], {
    encoding: "utf8",
  });
}

const chat = readFileSync(join(root, "dasha-compute-open-alpha/examples/chat.py"), "utf8");
assertHelloExample(chat, "source examples/chat.py");

const readme = readFileSync(join(root, "dasha-compute-open-alpha/README.md"), "utf8");
assert.match(readme, /"content":"hello"/, "kit README curl hello");
assert.doesNotMatch(readme, /Make the timeline stranger/, "kit README no novelty");

const askFirst = readFileSync(join(root, "ASK-FIRST.md"), "utf8");
assert.match(askFirst, /examples\/chat\.py/, "ASK-FIRST names kit chat.py");
assert.match(askFirst, /hello/, "ASK-FIRST hello");
assert.doesNotMatch(askFirst, /say something strange/, "ASK-FIRST no strange");

const html = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(html, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");
assert.match(html, /content":"hello"/, "compute page curl hello");
assert.doesNotMatch(html, /Make the timeline stranger/, "compute page no novelty");
assert.match(USE_SKILL_MD, /content":"hello"/, "USE skill curl hello");
assert.doesNotMatch(USE_SKILL_MD, /Make the timeline stranger/, "USE skill no novelty");

const archives = [
  join(root, "dasha-worker-assets/dasha-compute-open-alpha.tar.gz"),
  join(root, "dasha-compute-open-alpha.tar.gz"),
];
for (const kit of archives) {
  if (!existsSync(kit)) continue;
  const packed = extractKitChat(kit);
  assert.equal(packed, chat, `${kit} chat.py must match source`);
  assertHelloExample(packed, kit);
}

const live = await fetch("https://www.getdasha.com/dasha-compute-open-alpha.tar.gz", {
  headers: { "user-agent": UA },
});
assert.equal(live.status, 200, "live kit 200");
const bytes = Buffer.from(await live.arrayBuffer());
const tmp = join(mkdtempSync(join(tmpdir(), "dasha-kit-hello-")), "dasha-compute-open-alpha.tar.gz");
writeFileSync(tmp, bytes);
assertHelloExample(extractKitChat(tmp), "live kit examples/chat.py");

console.log("dasha-compute-kit-example-hello: PASS");
