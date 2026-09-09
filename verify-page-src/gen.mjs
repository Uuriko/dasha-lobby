#!/usr/bin/env node
/** Generates ../dasha-verify-page.mjs (VERIFY_PAGE_HTML) from client.mjs bundle.
 *  Run: esbuild verify-page-src/client.mjs --bundle --minify --format=iife --outfile=verify-page-src/client.min.js
 *       node verify-page-src/gen.mjs
 *  (Standing-lane generator for the 992/993 ladder; not part of Codex's static-gen.) */
import { readFileSync, writeFileSync } from 'node:fs';

const client = readFileSync(new URL('./client.min.js', import.meta.url), 'utf8').replace(/<\/script>/gi, '<\\/script>');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verify a receipt · Dasha</title>
  <meta name="description" content="Every paid job on Dasha settles with a signed, chained receipt. Paste one here and verify it yourself - no account, no trust in us required.">
  <link rel="canonical" href="https://www.getdasha.com/verify">
  <link rel="describedby" href="/llms.txt" type="text/plain">
  <link rel="describedby" href="/llms-full.txt" type="text/plain">
  <meta property="og:type" content="website"><meta property="og:url" content="https://www.getdasha.com/verify"><meta property="og:title" content="Verify a receipt · Dasha"><meta property="og:description" content="Don't trust our invoice. Check it. Signed, chained receipts, verified client-side."><meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Verify a receipt · Dasha"><meta name="twitter:description" content="Don't trust our invoice. Check it."><meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
  <style>
    body{margin:0;background:#070608;color:#f4eddb;font:18px/1.45 Arial,Helvetica,sans-serif}
    main{max-width:40rem;margin:0 auto;padding:48px 20px}
    .kicker{color:#dfff00;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800}
    h1{font-size:clamp(30px,6vw,46px);line-height:1;letter-spacing:-.03em;text-transform:uppercase;margin:10px 0 16px}
    p.lede{color:#e6dcc4;margin:0 0 24px}
    textarea{width:100%;min-height:140px;background:#111009;color:#f4eddb;border:1px solid #33301f;border-radius:6px;font:13px/1.4 ui-monospace,Menlo,monospace;padding:10px;box-sizing:border-box}
    button{display:inline-flex;min-height:44px;align-items:center;padding:0 22px;background:#dfff00;color:#070608;font-weight:900;border:0;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;margin-top:12px}
    .verdict{margin:22px 0;padding:16px 18px;border-radius:8px;border:1px solid #33301f}
    .verdict b{font-size:15px;letter-spacing:.08em}
    .verdict p{margin:6px 0 0}
    .verdict .why{font-size:13px;color:#b7ad93;font-family:ui-monospace,Menlo,monospace}
    .verdict.anchored{border-color:#3f7a2a;background:#0c140a}.verdict.anchored b{color:#7ee787}
    .verdict.self-consistent{border-color:#8a6d1f;background:#171207}.verdict.self-consistent b{color:#e3b341}
    .verdict.invalid{border-color:#8a2f2f;background:#170b0b}.verdict.invalid b{color:#f47067}
    h2{font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:#e6dcc4;margin:34px 0 10px}
    ul{list-style:none;padding:0;margin:0;font-size:14px}
    li{padding:6px 0;border-bottom:1px solid #1c1a12}
    a{color:#dfff00}
    .faq div{margin:0 0 16px}
    .faq b{color:#e6dcc4}
    .faq p{margin:4px 0 0;color:#b7ad93;font-size:15px}
  </style>
</head>
<body>
<main>
  <div class="kicker">Dasha Compute · receipts</div>
  <h1>Don't trust our invoice. Check it.</h1>
  <p class="lede">Every paid job on Dasha settles with a signed receipt, chained to the one before it. Paste a receipt here - or click one in the index - and verify it yourself. No account. Nothing leaves your browser: verification runs entirely on this page against the published key and the public heads log.</p>
  <textarea id="receipt-in" placeholder='Paste receipt JSON here, e.g. {"id":"rcp_...","engine":"hosted",...}'></textarea>
  <button id="verify-btn">Verify</button>
  <div id="verdict" class="verdict" aria-live="polite"></div>
  <h2>Receipt index</h2>
  <ul id="index"><li>loading…</li></ul>
  <h2>FAQ</h2>
  <div class="faq">
    <div><b>What does a receipt prove?</b><p>The signer signed this exact record (engine, tokens, cents, time), and the sequence it sits in was not edited.</p></div>
    <div><b>What does ANCHORED add?</b><p>A receipt alone is the signer's word. Anchored means the network's own signed heads log covered it within the hour - a second, independent signature over the chain tip.</p></div>
    <div><b>What does it NOT prove?</b><p>That the named engine literally produced the output. That is the attestation layer (confidential compute), which we are building toward - and we would rather say that plainly than imply otherwise.</p></div>
    <div><b>Do I need an account?</b><p>No. Verification is client-side against the published key (/keys.json) and the public heads log (/heads).</p></div>
    <div><b>What if verification fails?</b><p>The page names the failed check. A failure on a real receipt is an incident - report it on <a href="https://t.me/+xB7S8mIQaKFiZjRh" target="_blank" rel="noopener noreferrer">Telegram</a>.</p></div>
  </div>
</main>
<script>${client}</script>
</body>
</html>
`;

const mod = '/** GENERATED by verify-page-src/gen.mjs - edit the source, regenerate. */\nexport const VERIFY_PAGE_HTML = ' + JSON.stringify(html) + ';\n';
writeFileSync(new URL('../dasha-verify-page.mjs', import.meta.url), mod);
console.log('wrote dasha-verify-page.mjs', mod.length, 'bytes');
