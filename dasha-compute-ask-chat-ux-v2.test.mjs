#!/usr/bin/env node
/**
 * Ask chat UX v2 P0 — Stop / Regen / Copy / Edit / Enter / Markdown / New / states.
 * Disk == embed == worker.fetch. No wrangler. No Designer. Never plugin.jup.ag.
 *
 * A1 Stop · A2 Regen · A3 Copy · A4 Edit · A5 Keyboard · A6 Markdown · A7 New · A8 States
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./dasha-lobby-worker.mjs";
import { COMPUTE_PAGE_HTML } from "./dasha-compute-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, "dasha-compute.html"), "utf8");
assert.equal(disk, COMPUTE_PAGE_HTML, "embed matches dasha-compute.html");

function assertAskChatUxV2(html, label) {
  assert.match(html, /id=["']ask-thread["']/, `${label} #ask-thread`);
  assert.match(html, /id=["']prompt["']/, `${label} #prompt`);
  assert.match(html, /id=["']run-demo["']/, `${label} #run-demo`);
  assert.match(html, /id=["']ask-think["']/, `${label} think chip`);
  assert.match(html, /id=["']ask-run-chip["']/, `${label} run chip`);
  assert.match(html, /function stopAskRun\(/, `${label} A1 stopAskRun`);
  assert.match(html, /if\(askBusy\)\{stopAskRun\(\);return\}/, `${label} A1 Stop is primary click`);
  assert.match(html, /if\(askBusy\)\$\(['"]run-demo['"]\)\.textContent=['"]Stop['"]/, `${label} A1 Stop label`);
  assert.match(html, /runAbort=new AbortController\(\)/, `${label} A1 AbortController`);
  assert.match(html, /signal:runAbort\.signal/, `${label} A1 fetch signal`);
  assert.match(html, /setAskRunChip\(['"]stopped['"]\)/, `${label} A1 chip stopped`);
  assert.match(html, /commitAskLive\(['"]stopped['"]/, `${label} A1 keep partial`);
  assert.match(html, /function regenerateLastAsk\(/, `${label} A2 regenerate`);
  assert.match(html, /askAct\(['"]Regenerate['"],['"]regen['"]\)/, `${label} A2 Regen control`);
  assert.match(html, /function copyAskText\(/, `${label} A3 copy`);
  assert.match(html, /btn\.textContent=['"]Copied['"]/, `${label} A3 Copied`);
  assert.match(html, /function editLastUserAsk\(/, `${label} A4 edit`);
  assert.match(html, /if\(askEditAt>=0\)/, `${label} A4 truncate after`);
  assert.match(html, /event\.key===['"]Enter['"]&&!event\.shiftKey/, `${label} A5 Enter send`);
  assert.match(html, /Shift\+Enter newline/, `${label} A5 Shift+Enter documented`);
  assert.match(html, /Esc back only — never clear the Ask thread/, `${label} A5 Esc does not nuke`);
  assert.match(html, /function renderAskMarkdown\(/, `${label} A6 markdown`);
  assert.match(html, /data-open=['"]1['"]/, `${label} A6 stream-safe open fence`);
  assert.match(html, />New<\/button>/, `${label} A7 New control`);
  assert.match(html, /id=["']clear-chat["']/, `${label} A7 keeps #clear-chat`);
  assert.match(html, /function clearConversation\(/, `${label} A7 clear thread`);
  assert.match(html, /turn\.dataset\.state=state/, `${label} A8 per-turn state`);
  assert.match(html, /beginAskLive\(/, `${label} A8 thinking on send`);
  assert.match(html, /askLive\.state=['"]streaming['"]/, `${label} A8 streaming`);
  assert.match(html, /state:'complete'/, `${label} A8 complete`);
  assert.match(html, /commitAskLive\(['"]error['"]/, `${label} A8 error`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertAskChatUxV2(disk, "disk");
assertAskChatUxV2(COMPUTE_PAGE_HTML, "embed");

const served = await worker.fetch(new Request("https://www.getdasha.com/compute"), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get("x-dasha-edge"), "compute");
assertAskChatUxV2(await served.text(), "worker.fetch");

const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(new URL("./dasha-compute.html", import.meta.url).href, { waitUntil: "domcontentloaded" });

    const md = await page.evaluate(() => {
      const closed = renderAskMarkdown("**bold**\n\n- one\n- two\n\n```js\nconst x=1\n```", false);
      const open = renderAskMarkdown("intro\n```py\nprint(1)", true);
      return { closed, open };
    });
    assert.match(md.closed, /<strong>bold<\/strong>/, "A6 bold");
    assert.match(md.closed, /<ul><li>one<\/li><li>two<\/li><\/ul>/, "A6 lists");
    assert.match(md.closed, /<pre><code class="language-js">const x=1\n<\/code><\/pre>/, "A6 fence");
    assert.match(md.open, /<p>intro<\/p>/, "A6 stream preface");
    assert.match(md.open, /data-open="1"/, "A6 incomplete fence buffered");
    assert.match(md.open, /print\(1\)/, "A6 open fence keeps code");
    assert.doesNotMatch(md.open, /```/, "A6 does not leak raw fence");

    const kb = await page.evaluate(() => {
      showTf("ask");
      const prompt = $("prompt");
      const run = $("run-demo");
      run.hidden = false;
      run.removeAttribute("hidden");
      run.style.display = "";
      run.disabled = false;
      prompt.value = "hello";
      let ran = false;
      run.addEventListener("click", (event) => {
        ran = true;
        event.stopImmediatePropagation();
        event.preventDefault();
      }, { once: true, capture: true });
      prompt.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: false, bubbles: true, cancelable: true }));
      const afterEnter = prompt.value;
      prompt.value = "line";
      prompt.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }));
      const afterShift = prompt.value;
      conversation = [
        { role: "user", content: "Keep me." },
        { role: "assistant", content: "Still here." },
      ];
      threadRoute = "hosted";
      renderConversation();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      return {
        ran,
        afterEnter,
        afterShift,
        title: prompt.getAttribute("title") || "",
        thread: ($("ask-thread")?.textContent || "").trim(),
        step: document.body.dataset.step,
      };
    });
    assert.equal(kb.ran, true, "A5 Enter sends");
    assert.equal(kb.afterEnter, "hello", "A5 Enter does not insert newline");
    assert.equal(kb.afterShift, "line", "A5 Shift+Enter leaves text (browser newline)");
    assert.match(kb.title, /Shift\+Enter newline/, "A5 documented");
    assert.match(kb.thread, /Keep me/, "A5 Esc does not nuke thread");
    assert.equal(kb.step, "ask", "A5 stays on Ask");

    const neu = await page.evaluate(() => {
      $("engine").value = "community";
      $("model").value = "gemma3-27b";
      conversation = [
        { role: "user", content: "Old." },
        { role: "assistant", content: "Reply." },
      ];
      threadRoute = "community";
      renderConversation();
      showTf("ask");
      const before = {
        engine: $("engine").value,
        model: $("model").value,
        hasChat: document.body.classList.contains("has-chat"),
        label: ($("clear-chat")?.textContent || "").trim(),
      };
      $("clear-chat").click();
      return {
        before,
        after: {
          engine: $("engine").value,
          model: $("model").value,
          hasChat: document.body.classList.contains("has-chat"),
          threadHidden: $("ask-thread")?.hidden === true,
          thread: ($("ask-thread")?.textContent || "").trim(),
        },
      };
    });
    assert.equal(neu.before.label, "New", "A7 New label");
    assert.equal(neu.before.hasChat, true);
    assert.equal(neu.after.hasChat, false, "A7 resets has-chat");
    assert.equal(neu.after.threadHidden, true, "A7 clears #ask-thread");
    assert.equal(neu.after.thread, "", "A7 empty thread");
    assert.equal(neu.after.engine, "community", "A7 keeps engine");
    assert.equal(neu.after.model, "gemma3-27b", "A7 keeps model");

    const painted = await page.evaluate(() => {
      conversation = [
        { role: "user", content: "Write a sort." },
        { role: "assistant", content: "Use **sorted**.\n\n```py\nprint(1)\n```", state: "complete" },
      ];
      threadRoute = "hosted";
      $("engine").value = "hosted";
      renderConversation();
      showTf("ask");
      const asst = document.querySelector("#ask-thread .ask-turn.mac");
      const user = document.querySelector("#ask-thread .ask-turn.you");
      return {
        state: asst?.dataset.state || "",
        userState: user?.dataset.state || "",
        html: asst?.querySelector(".ask-said")?.innerHTML || "",
        copy: [...asst.querySelectorAll(".ask-act")].map((b) => b.dataset.act),
        edit: [...user.querySelectorAll(".ask-act")].map((b) => b.dataset.act),
        who: [...document.querySelectorAll("#ask-thread .ask-who")].map((el) => el.textContent.trim()),
      };
    });
    assert.equal(painted.state, "complete", "A8 complete");
    assert.equal(painted.userState, "complete");
    assert.match(painted.html, /<strong>sorted<\/strong>/, "A6 assistant markdown");
    assert.match(painted.html, /<pre>/, "A6 fenced code");
    assert.deepEqual(painted.copy, ["copy", "regen"], "A2+A3 last assistant actions");
    assert.deepEqual(painted.edit, ["edit"], "A4 last user Edit");
    assert.deepEqual(painted.who, ["You", "Hosted"]);

    const copied = await page.evaluate(async () => {
      const btn = document.querySelector('#ask-thread .ask-act[data-act="copy"]');
      let wrote = "";
      const orig = navigator.clipboard?.writeText;
      if (navigator.clipboard) {
        navigator.clipboard.writeText = async (v) => { wrote = String(v); };
      }
      btn.click();
      await new Promise((r) => setTimeout(r, 20));
      const label = btn.textContent.trim();
      if (orig) navigator.clipboard.writeText = orig;
      return { wrote, label };
    });
    assert.match(copied.wrote, /sorted/, "A3 copies plain text");
    assert.equal(copied.label, "Copied", "A3 Copied");

    const edited = await page.evaluate(() => {
      document.querySelector('#ask-thread .ask-act[data-act="edit"]').click();
      return {
        prompt: $("prompt").value,
        editAt: askEditAt,
      };
    });
    assert.equal(edited.prompt, "Write a sort.", "A4 fills composer");
    assert.equal(edited.editAt, 0, "A4 marks last user");

    await page.evaluate(() => {
      loggedIn = true;
      hostedLive = true;
      hostedChosenThisSession = true;
      $("engine").value = "hosted";
      $("login").hidden = true;
      $("run-demo").hidden = false;
      $("run-demo").removeAttribute("hidden");
      $("run-demo").style.display = "";
      $("run-demo").disabled = false;
      window.__dashaAuthReady = true;
    });

    const regen = await page.evaluate(async () => {
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        if (href.includes("/compute/api/chat")) {
          return new Response(
            `data: {"choices":[{"delta":{"content":"second pass"}}]}\n\n` +
            `data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n` +
            `data: [DONE]\n\n`,
            { status: 200, headers: { "content-type": "text/event-stream" } },
          );
        }
        return orig(url, opts);
      };
      document.querySelector('#ask-thread .ask-act[data-act="regen"]').click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const said = document.querySelector("#ask-thread .ask-turn.mac .ask-said")?.textContent || "";
        if (said.includes("second pass") && !askBusy) break;
        await new Promise((r) => setTimeout(r, 25));
      }
      window.fetch = orig;
      const saids = [...document.querySelectorAll("#ask-thread .ask-turn.mac .ask-said")].map((el) => el.textContent.trim());
      const users = [...document.querySelectorAll("#ask-thread .ask-turn.you .ask-said")].map((el) => el.textContent.trim());
      return { saids, users, busy: askBusy, step: document.body.dataset.step };
    });
    assert.deepEqual(regen.users, ["Write a sort."], "A2 reuses last user");
    assert.deepEqual(regen.saids, ["second pass"], "A2 replaces last assistant");
    assert.equal(regen.step, "ask", "A2 stays on Ask");

    const stop = await page.evaluate(async () => {
      conversation = [];
      threadRoute = "hosted";
      $("prompt").value = "Stream me.";
      loggedIn = true;
      hostedLive = true;
      hostedChosenThisSession = true;
      $("engine").value = "hosted";
      $("run-demo").hidden = false;
      $("run-demo").removeAttribute("hidden");
      $("run-demo").style.display = "";
      $("run-demo").disabled = false;
      const orig = window.fetch;
      let aborted = false;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        if (href.includes("/compute/api/chat")) {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "partial **keep**" } }] })}\n\n`));
              const kill = () => {
                aborted = !!opts.signal?.aborted;
                try { controller.close(); } catch {}
              };
              if (opts.signal?.aborted) { kill(); return; }
              if (opts.signal) opts.signal.addEventListener("abort", kill, { once: true });
            },
          });
          return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
        }
        return orig(url, opts);
      };
      $("run-demo").click();
      const started = Date.now();
      let thinking = "";
      let streaming = "";
      let primary = "";
      while (Date.now() - started < 2500) {
        thinking = document.querySelector('#ask-thread .ask-turn.mac')?.dataset.state || "";
        primary = ($("run-demo")?.textContent || "").trim();
        const said = document.querySelector("#ask-thread .ask-turn.mac .ask-said")?.textContent || "";
        if (said.includes("partial") || thinking === "streaming") {
          streaming = thinking;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      const during = {
        primary,
        state: document.querySelector("#ask-thread .ask-turn.mac")?.dataset.state || "",
        hasChat: document.body.classList.contains("has-chat"),
        step: document.body.dataset.step,
        blank: !(document.querySelector("#ask-thread")?.textContent || "").trim(),
      };
      $("run-demo").click();
      const stopStarted = Date.now();
      while (Date.now() - stopStarted < 2000) {
        if (!askBusy && (document.querySelector("#ask-thread .ask-turn.mac")?.dataset.state === "stopped")) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      window.fetch = orig;
      const asst = document.querySelector("#ask-thread .ask-turn.mac");
      return {
        during,
        after: {
          state: asst?.dataset.state || "",
          text: (asst?.querySelector(".ask-said")?.textContent || "").trim(),
          chip: $("ask-run-chip")?.dataset.state || "",
          primary: ($("run-demo")?.textContent || "").trim(),
          busy: askBusy,
          aborted,
          step: document.body.dataset.step,
        },
      };
    });
    assert.equal(stop.during.step, "ask", "A1 stays on Ask while streaming");
    assert.equal(stop.during.primary, "Stop", "A1 primary is Stop");
    assert.equal(stop.during.blank, false, "A8 never blank after send");
    assert.ok(stop.during.state === "thinking" || stop.during.state === "streaming", "A8 thinking/streaming");
    assert.equal(stop.after.state, "stopped", "A8 stopped");
    assert.match(stop.after.text, /partial/, "A1 partial kept");
    assert.equal(stop.after.chip, "stopped", "A1 chip stopped");
    assert.notEqual(stop.after.primary, "Stop", "A1 Stop leaves after abort");
    assert.equal(stop.after.step, "ask");

    const err = await page.evaluate(async () => {
      clearConversation();
      $("prompt").value = "Break.";
      loggedIn = true;
      hostedLive = true;
      hostedChosenThisSession = true;
      $("engine").value = "hosted";
      $("run-demo").hidden = false;
      $("run-demo").removeAttribute("hidden");
      $("run-demo").style.display = "";
      $("run-demo").disabled = false;
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        if (href.includes("/compute/api/chat")) {
          return new Response(JSON.stringify({ error: { message: "hosted demo unavailable", code: "hosted_cut" } }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        return orig(url, opts);
      };
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        if (!askBusy && document.querySelector('#ask-thread .ask-turn.mac[data-state="error"]')) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      window.fetch = orig;
      const asst = document.querySelector("#ask-thread .ask-turn.mac");
      return {
        state: asst?.dataset.state || "",
        text: (asst?.querySelector(".ask-said")?.textContent || "").trim(),
        chip: $("ask-run-chip")?.dataset.state || "",
        blank: !(document.querySelector("#ask-thread")?.textContent || "").trim(),
      };
    });
    assert.equal(err.state, "error", "A8 error");
    assert.ok(err.text.length > 0, "A8 error is not blank");
    assert.equal(err.blank, false, "A8 never blank after send");
    assert.equal(err.chip, "error", "A8 chip error");

    const truncated = await page.evaluate(async () => {
      conversation = [
        { role: "user", content: "First." },
        { role: "assistant", content: "One.", state: "complete" },
        { role: "user", content: "Second." },
        { role: "assistant", content: "Two.", state: "complete" },
      ];
      threadRoute = "hosted";
      renderConversation();
      showTf("ask");
      document.querySelector('#ask-thread .ask-act[data-act="edit"]').click();
      $("prompt").value = "Second rewritten.";
      loggedIn = true;
      hostedLive = true;
      hostedChosenThisSession = true;
      $("engine").value = "hosted";
      $("run-demo").hidden = false;
      $("run-demo").disabled = false;
      const orig = window.fetch;
      window.fetch = async (url, opts = {}) => {
        const href = String(url);
        if (href.includes("/compute/api/chat")) {
          return new Response(
            `data: {"choices":[{"delta":{"content":"rewritten ok"}}]}\n\n` +
            `data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n` +
            `data: [DONE]\n\n`,
            { status: 200, headers: { "content-type": "text/event-stream" } },
          );
        }
        return orig(url, opts);
      };
      $("run-demo").click();
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const said = [...document.querySelectorAll("#ask-thread .ask-turn.mac .ask-said")].map((el) => el.textContent.trim());
        if (said.includes("rewritten ok") && !askBusy) break;
        await new Promise((r) => setTimeout(r, 25));
      }
      window.fetch = orig;
      return {
        users: [...document.querySelectorAll("#ask-thread .ask-turn.you .ask-said")].map((el) => el.textContent.trim()),
        saids: [...document.querySelectorAll("#ask-thread .ask-turn.mac .ask-said")].map((el) => el.textContent.trim()),
      };
    });
    assert.deepEqual(truncated.users, ["First.", "Second rewritten."], "A4 truncates after last user");
    assert.deepEqual(truncated.saids, ["One.", "rewritten ok"], "A4 replaces later turns");
  } finally {
    await browser.close();
  }
}

console.log("dasha-compute-ask-chat-ux-v2: PASS");
