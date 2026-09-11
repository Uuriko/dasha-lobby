/** /bag exit estimate. Jupiter quote, not mark. Worker fetches. Estimate only. */

export const HERS_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const WSOL = 'So11111111111111111111111111111111111111112';
export const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DASHA_DECIMALS = 6;
export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;
export const SLIPPAGE_BPS = 50;
export const JUP_QUOTE = 'https://lite-api.jup.ag/swap/v1/quote';
export const JUP_QUOTE_FALLBACK = 'https://quote-api.jup.ag/v6/quote';
export const JUP_TIMEOUT_MS = 3500;
export const EXIT_ROUTE = `https://jup.ag/swap?sell=${HERS_MINT}&buy=${WSOL}`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, HEAD, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '86400',
};

export function isBagExitPath(pathname) {
  const p = String(pathname || '');
  return p === '/bag/api/exit' || p === '/bag/api/exit/';
}

export function jupiterQuoteUrl(base, { inputMint, outputMint, amount, slippageBps = SLIPPAGE_BPS } = {}) {
  const u = new URL(base);
  u.searchParams.set('inputMint', inputMint);
  u.searchParams.set('outputMint', outputMint);
  u.searchParams.set('amount', String(amount));
  u.searchParams.set('slippageBps', String(slippageBps));
  return u.toString();
}

export function amountToRaw(ui, decimals = DASHA_DECIMALS) {
  const t = String(ui ?? '').trim().replace(/,/g, '');
  if (!t || t === '.' || !/^[0-9]+(\.[0-9]*)?$/.test(t)) return '';
  const parts = t.split('.');
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').slice(0, decimals).padEnd(decimals, '0');
  const raw = `${whole}${frac}`.replace(/^0+/, '') || '0';
  if (raw === '0') return '';
  if (raw.length > 18) return '';
  return raw;
}

export function rawToUi(raw, decimals) {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '') || '0';
  if (decimals <= 0) return digits.replace(/^0+/, '') || '0';
  const pad = digits.padStart(decimals + 1, '0');
  const i = pad.length - decimals;
  const whole = pad.slice(0, i).replace(/^0+(?=\d)/, '');
  const frac = pad.slice(i).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

export function haircutRaw(outAmount, slippageBps = SLIPPAGE_BPS, otherAmountThreshold) {
  const threshold = String(otherAmountThreshold ?? '').trim();
  if (/^[0-9]+$/.test(threshold)) return threshold;
  const out = String(outAmount ?? '').trim();
  if (!/^[0-9]+$/.test(out)) return '';
  try {
    const n = BigInt(out);
    const bps = BigInt(Number(slippageBps) || 0);
    if (bps < 0n) return out;
    return String(n - (n * bps) / 10000n);
  } catch {
    return '';
  }
}

export function quoteFeeLabel(quote) {
  const fee = quote && quote.platformFee;
  if (fee && (fee.amount || fee.feeBps)) {
    const bps = fee.feeBps != null ? `${fee.feeBps} bps` : '';
    const amt = fee.amount != null ? String(fee.amount) : '';
    return ['Jupiter platform fee', bps, amt].filter(Boolean).join(' ');
  }
  return 'Jupiter quote fee 0';
}

export function parseJupQuote(quote, { decimals, slippageBps = SLIPPAGE_BPS } = {}) {
  if (!quote || quote.outAmount == null) return null;
  const out = String(quote.outAmount);
  if (!/^[0-9]+$/.test(out) || out === '0') return null;
  const bps = Number(quote.slippageBps);
  const slip = Number.isFinite(bps) ? bps : slippageBps;
  const cut = haircutRaw(out, slip, quote.otherAmountThreshold);
  const impact = quote.priceImpactPct != null && quote.priceImpactPct !== ''
    ? String(quote.priceImpactPct)
    : '';
  return {
    outRaw: out,
    outUi: rawToUi(out, decimals),
    haircutRaw: cut,
    haircutUi: cut ? rawToUi(cut, decimals) : '',
    slippageBps: slip,
    priceImpactPct: impact,
    fee: quoteFeeLabel(quote),
  };
}

export function exitReceiptMarkdown(row) {
  const lines = [
    '# $dasha exit',
    `asOf: ${row.asOf}`,
    `mint: ${row.mint}`,
    `amount: ${row.amount} $dasha`,
  ];
  if (row.mark) lines.push(`mark: ${row.mark}`);
  lines.push(`exit: ${row.exitSol} SOL after ${row.slippageBps} bps haircut`);
  if (row.exitUsd) lines.push(`exitUsd: ${row.exitUsd}`);
  lines.push(`fee: ${row.fee}`);
  lines.push(`slippage: ${row.slippageBps} bps`);
  if (row.impact) lines.push(`impact: ${row.impact}`);
  lines.push(`route: ${row.route}`);
  lines.push('mark price ≠ exit');
  return lines.join('\n');
}

export function exitReceiptJson(row) {
  return JSON.stringify({
    asOf: row.asOf,
    mint: row.mint,
    amount: row.amount,
    mark: row.mark || null,
    exitSol: row.exitSol,
    exitUsd: row.exitUsd || null,
    fee: row.fee,
    slippageBps: row.slippageBps,
    impact: row.impact || null,
    route: row.route,
    note: 'mark price ≠ exit',
  }, null, 2);
}

function jsonResponse(status, body, head = false) {
  return new Response(head ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-dasha-edge': 'bag-exit',
      ...CORS,
    },
  });
}

async function amountFromRequest(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('amount');
  if (q != null && String(q).trim()) return String(q);
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (body && body.amount != null) return String(body.amount);
    } catch {
      return '';
    }
  }
  return '';
}

async function fetchOneQuote(fetchImpl, outputMint, amountRaw, timeoutMs) {
  const args = {
    inputMint: HERS_MINT,
    outputMint,
    amount: amountRaw,
    slippageBps: SLIPPAGE_BPS,
  };
  const urls = [
    jupiterQuoteUrl(JUP_QUOTE, args),
    jupiterQuoteUrl(JUP_QUOTE_FALLBACK, args),
  ];
  for (const href of urls) {
    let timer;
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const req = Promise.resolve(fetchImpl(href, {
        method: 'GET',
        headers: { accept: 'application/json', 'user-agent': 'dasha-lobby' },
        signal,
      }));
      const dead = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        const fail = () => reject(signal.reason || new Error('timeout'));
        if (signal.aborted) fail();
        else signal.addEventListener('abort', fail, { once: true });
      });
      dead.catch(() => {});
      const res = await Promise.race([req, dead]);
      clearTimeout(timer);
      if (!res || !res.ok) continue;
      const data = await res.json();
      if (data && data.outAmount) return data;
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function quoteExit(amountUi, fetchImpl, timeoutMs = JUP_TIMEOUT_MS) {
  const amount = String(amountUi ?? '').trim();
  const amountRaw = amountToRaw(amount);
  if (!amountRaw) return { status: 400, body: { error: 'bad amount' } };
  const [solQuote, usdcQuote] = await Promise.all([
    fetchOneQuote(fetchImpl, WSOL, amountRaw, timeoutMs),
    fetchOneQuote(fetchImpl, USDC, amountRaw, timeoutMs),
  ]);
  const sol = parseJupQuote(solQuote, { decimals: SOL_DECIMALS });
  if (!sol) {
    return { status: 200, body: { ok: false, error: 'Quote quiet.', mint: HERS_MINT } };
  }
  const usd = parseJupQuote(usdcQuote, { decimals: USDC_DECIMALS });
  const asOf = new Date().toISOString();
  const row = {
    asOf,
    mint: HERS_MINT,
    amount,
    exitSol: sol.haircutUi || sol.outUi,
    exitUsd: usd ? (usd.haircutUi || usd.outUi) : '',
    fee: sol.fee,
    slippageBps: sol.slippageBps,
    impact: sol.priceImpactPct,
    route: EXIT_ROUTE,
  };
  return {
    status: 200,
    body: {
      ok: true,
      mint: HERS_MINT,
      amount,
      amountRaw,
      asOf,
      slippageBps: sol.slippageBps,
      fee: sol.fee,
      impact: sol.priceImpactPct,
      sol: {
        outUi: sol.outUi,
        haircutUi: sol.haircutUi,
      },
      usdc: usd ? { outUi: usd.outUi, haircutUi: usd.haircutUi } : null,
      route: EXIT_ROUTE,
      receiptMd: exitReceiptMarkdown(row),
      receiptJson: exitReceiptJson(row),
    },
  };
}

export async function bagExitApi(request, env = {}, fetchImpl) {
  const url = new URL(request.url);
  if (!isBagExitPath(url.pathname)) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        'x-dasha-edge': 'bag-exit',
      },
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
    return jsonResponse(405, { error: 'method' });
  }
  const fetchFn = fetchImpl || env.fetch || globalThis.fetch;
  const found = await quoteExit(await amountFromRequest(request), fetchFn);
  return jsonResponse(found.status, found.body, request.method === 'HEAD');
}
