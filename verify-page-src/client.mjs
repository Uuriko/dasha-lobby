import * as ed from '@noble/ed25519';

const te = new TextEncoder();
const $ = (id) => document.getElementById(id);

function b64decode(b64) {
  const s = atob(String(b64 || ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function sha256Hex(text) {
  const dig = await crypto.subtle.digest('SHA-256', te.encode(String(text)));
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function pemToRaw(pem) {
  const b64 = String(pem || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = b64decode(b64);
  return der.slice(der.length - 32);
}
function canonical(r) {
  return {
    job_id: r.job_id == null ? null : String(r.job_id),
    engine: String(r.engine || ''),
    tokens: Math.max(0, Math.floor(Number(r.tokens) || 0)),
    cents: Math.max(0, Math.floor(Number(r.cents) || 0)),
    at: Math.max(0, Math.floor(Number(r.at) || 0)) || null,
    prev_hash: String(r.prev_hash || 'GENESIS'),
  };
}
async function verifySig(hexHash, sigB64, pem) {
  try {
    return await ed.verifyAsync(b64decode(sigB64), te.encode(hexHash), pemToRaw(pem));
  } catch { return false; }
}
async function verifyChain(receipts, pemById) {
  let prev = 'GENESIS';
  for (const r of receipts) {
    if (String(r.prev_hash || '') !== prev) return { ok: false, why: 'chain break at ' + r.job_id };
    const pem = pemById[r.signer];
    if (!pem) return { ok: false, why: 'unknown signer ' + (r.signer || 'none') };
    const hash = await sha256Hex(JSON.stringify(canonical(r)));
    if (hash !== r.hash) return { ok: false, why: 'hash mismatch at ' + r.job_id };
    if (!(await verifySig(r.hash, r.sig, pem))) return { ok: false, why: 'bad sig at ' + r.job_id };
    prev = r.hash;
  }
  return { ok: true, tip: prev };
}
async function verifyHeadsLog(heads, pemById) {
  let prev = 'GENESIS';
  for (const h of heads) {
    const hPrev = String(h.prev_head_hash || 'GENESIS');
    // Legacy pre-chain heads (2026-09-07) restart the chain; chained heads must link.
    if (hPrev !== 'GENESIS' && hPrev !== prev) return { ok: false, why: 'heads chain break at ts ' + h.ts };
    const body = { ts: Math.floor(Number(h.ts)), tip: String(h.tip), prev_head_hash: String(h.prev_head_hash || 'GENESIS') };
    const hash = await sha256Hex(JSON.stringify(body));
    if (hash !== h.hash) return { ok: false, why: 'head hash mismatch at ts ' + h.ts };
    const pem = pemById[h.signer];
    if (!pem) return { ok: false, why: 'unknown head signer ' + (h.signer || 'none') };
    if (!(await verifySig(h.hash, h.sig, pem))) return { ok: false, why: 'head bad sig at ts ' + h.ts };
    prev = h.hash;
  }
  return { ok: true };
}
async function ladder(chainSeg, heads, pemById) {
  const chain = await verifyChain(chainSeg, pemById);
  if (!chain.ok) return { tier: 'INVALID', why: chain.why };
  const log = await verifyHeadsLog(heads, pemById);
  if (!log.ok) return { tier: 'SELF-CONSISTENT', why: 'heads log broken: ' + log.why };
  const covering = heads.filter((h) => h.tip === chain.tip);
  if (!covering.length) return { tier: 'SELF-CONSISTENT', why: 'tip not covered by any head yet (heads publish as jobs settle)' };
  const freshest = Math.max(...covering.map((h) => Number(h.ts) || 0));
  const ageMin = Math.round((Date.now() - freshest) / 60000);
  if (Date.now() - freshest > 3600000) return { tier: 'SELF-CONSISTENT', why: 'coverage stale: freshest covering head is ' + ageMin + 'min old' };
  return { tier: 'ANCHORED', why: 'chain verifies; tip covered by a fresh head; heads log verifies' };
}

function render(verdict) {
  const el = $('verdict');
  el.className = 'verdict ' + verdict.tier.toLowerCase().replace(/[^a-z-]/g, '');
  if (verdict.tier === 'ANCHORED') {
    el.innerHTML = '<b>ANCHORED</b><p>The network\'s signed heads log saw this receipt within the hour. Verified independently.</p><p class="why">' + verdict.why + '</p>';
  } else if (verdict.tier === 'SELF-CONSISTENT') {
    el.innerHTML = '<b>SELF-CONSISTENT</b><p>The receipt itself is internally valid, but the network hasn\'t co-signed it recently.</p><p class="why">' + verdict.why + '</p>';
  } else {
    el.innerHTML = '<b>INVALID</b><p>This receipt failed verification: ' + verdict.why + '. If you expected it to pass, that is a finding - report it and we treat it as an incident.</p>';
  }
}

async function loadCtx() {
  const [keysRes, headsRes, chainRes] = await Promise.all([
    fetch('/keys.json', { cache: 'no-store' }),
    fetch('/heads', { cache: 'no-store' }),
    fetch('/compute/api/chain', { cache: 'no-store' }),
  ]);
  if (!keysRes.ok) throw new Error('keys.json unavailable (' + keysRes.status + ') - signing not configured yet');
  const keys = await keysRes.json();
  const pemById = {};
  for (const k of keys.keys || []) pemById[k.id] = k.spki_pem;
  const heads = headsRes.ok ? await headsRes.json() : [];
  const chain = chainRes.ok ? (await chainRes.json()).receipts || [] : [];
  return { pemById, heads, chain };
}

async function onVerify() {
  const el = $('verdict');
  el.className = 'verdict';
  el.textContent = 'verifying locally...';
  try {
    const pasted = JSON.parse($('receipt-in').value);
    const { pemById, heads, chain } = await loadCtx();
    let seg;
    if (chain.length && chain.some((r) => r.hash === pasted.hash)) {
      const idx = chain.findIndex((r) => r.hash === pasted.hash);
      seg = chain.slice(0, idx + 1); // walk back to GENESIS
    } else {
      seg = [pasted]; // standalone receipt: single-link chain
    }
    render(await ladder(seg, heads, pemById));
  } catch (e) {
    el.className = 'verdict invalid';
    el.innerHTML = '<b>INVALID</b><p>' + (e && e.message ? e.message : 'could not parse that receipt JSON') + '</p>';
  }
}

async function bootIndex() {
  const q = new URLSearchParams(location.search).get('id');
  try {
    const { pemById, heads, chain } = await loadCtx();
    const list = $('index');
    if (chain.length) {
      list.innerHTML = chain.slice(-20).reverse().map((r) =>
        '<li><a href="/verify?id=' + encodeURIComponent(r.id || r.hash) + '">' +
        (r.id || '(no id)') + '</a> · ' + r.engine + (r.model ? ' · ' + r.model : '') + ' · ' + r.tokens + ' tok · ' +
        (Number.isFinite(r.latency_ms) ? (r.latency_ms / 1000).toFixed(1) + 's · ' : '') + r.cents + '¢ · ' +
        (r.at ? new Date(r.at).toISOString() : '') + '</li>').join('');
    } else {
      list.innerHTML = '<li>No chained receipts yet - receipts join the chain as paid jobs settle.</li>';
    }
    if (q) {
      const found = chain.find((r) => r.id === q || r.hash === q);
      if (found) {
        $('receipt-in').value = JSON.stringify(found, null, 2);
        const idx = chain.findIndex((r) => r.hash === found.hash);
        render(await ladder(chain.slice(0, idx + 1), heads, pemById));
      }
    }
  } catch (e) {
    $('index').innerHTML = '<li>' + (e && e.message ? e.message : 'index unavailable') + '</li>';
  }
}

$('verify-btn').addEventListener('click', onVerify);
bootIndex();
