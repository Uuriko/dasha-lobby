/**
 * Compute prepaid credits - card (Stripe Checkout) rail. Sits beside the crypto rail
 * in dasha-compute-credits.mjs ("Card/Stripe deferred" until now). Card pays face price;
 * USDC/$dasha keep their discounts. Dark until env keys land (CF secrets, never repo):
 *   STRIPE_SECRET_KEY     - creates Checkout Sessions + reads them back
 *   STRIPE_WEBHOOK_SECRET - verifies the checkout.session.completed webhook
 * No Stripe key in repo, no card data touches Dasha - buyers pay on stripe.com.
 */

const STRIPE_API = 'https://api.stripe.com';

export function stripeConfigured(env) {
  return Boolean(String(env?.STRIPE_SECRET_KEY || '').trim());
}

export function stripeWebhookConfigured(env) {
  return Boolean(String(env?.STRIPE_WEBHOOK_SECRET || '').trim());
}

function stripeKey(env) {
  const key = String(env?.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('stripe unset');
  return key;
}

/** Create a Checkout Session for one credit pack. order_id ties session -> order row. */
export async function createCardCheckoutSession(env, { orderId, pack, successUrl, cancelUrl, fetchImpl } = {}) {
  const key = stripeKey(env);
  const cents = Math.floor(Number(pack?.cents) || 0);
  if (!(cents > 0)) return { ok: false, error: 'bad pack', status: 400 };
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', String(successUrl));
  params.set('cancel_url', String(cancelUrl));
  params.set('client_reference_id', String(orderId));
  params.set('metadata[order_id]', String(orderId));
  params.set('payment_intent_data[metadata][order_id]', String(orderId));
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(cents));
  params.set('line_items[0][price_data][product_data][name]', `Dasha Compute credits ($${(cents / 100).toFixed(0)} pack)`);
  let res;
  const doFetch = fetchImpl || globalThis.fetch;
  try {
    res = await doFetch(`${STRIPE_API}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `dasha-credit-${orderId}`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 160), status: 502, provider: 'stripe' };
  }
  let data = null;
  try { data = await res.json(); } catch { /* fall through */ }
  if (!res.ok) {
    return { ok: false, error: String(data?.error?.message || `stripe ${res.status}`).slice(0, 160), status: 502, provider: 'stripe' };
  }
  if (!data?.id || !data?.url) return { ok: false, error: 'stripe session missing url', status: 502, provider: 'stripe' };
  return { ok: true, session_id: String(data.id), url: String(data.url) };
}

/** Read a session back (return-from-Stripe polling; webhook is the durable path). */
export async function retrieveCardSession(env, sessionId, fetchImpl) {
  const key = stripeKey(env);
  const id = String(sessionId || '').trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return { ok: false, error: 'bad session id', status: 400 };
  const doFetch = fetchImpl || globalThis.fetch;
  let res;
  try {
    res = await doFetch(`${STRIPE_API}/v1/checkout/sessions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 160), status: 502, provider: 'stripe' };
  }
  let data = null;
  try { data = await res.json(); } catch { /* fall through */ }
  if (!res.ok) return { ok: false, error: String(data?.error?.message || `stripe ${res.status}`).slice(0, 160), status: 502, provider: 'stripe' };
  return { ok: true, session: data };
}

/** A settled session must match the stored order exactly - id, order metadata, amount, currency. */
export function sessionSettlesOrder(session, order, pack) {
  if (!session || typeof session !== 'object') return { ok: false, error: 'no session' };
  if (String(session.id || '') !== String(order?.stripe_session_id || '')) return { ok: false, error: 'session mismatch' };
  if (String(session?.metadata?.order_id || '') !== String(order?.id || '')) return { ok: false, error: 'order mismatch' };
  if (String(session.payment_status || '') !== 'paid') return { ok: false, error: 'unpaid', pending: true };
  const cents = Math.floor(Number(pack?.cents) || 0);
  if (Number(session.amount_total) !== cents) return { ok: false, error: 'amount mismatch' };
  if (String(session.currency || '').toLowerCase() !== 'usd') return { ok: false, error: 'currency mismatch' };
  return { ok: true };
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify Stripe-Signature (t=...,v1=...) over the RAW body. Constant-time compare,
 * 5-minute timestamp tolerance against replay.
 */
export async function verifyStripeSignature(secret, rawBody, header, { now = Date.now(), toleranceSec = 300 } = {}) {
  const key = String(secret || '').trim();
  if (!key) return { ok: false, error: 'webhook unset', status: 503 };
  const parts = {};
  for (const piece of String(header || '').split(',')) {
    const eq = piece.indexOf('=');
    if (eq > 0) {
      const k = piece.slice(0, eq).trim();
      (parts[k] ||= []).push(piece.slice(eq + 1).trim());
    }
  }
  const ts = Number(parts.t?.[0]);
  const sigs = parts.v1 || [];
  if (!Number.isFinite(ts) || !sigs.length) return { ok: false, error: 'bad signature header', status: 400 };
  if (Math.abs(now / 1000 - ts) > toleranceSec) return { ok: false, error: 'stale signature', status: 400 };
  const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${ts}.${rawBody}`)));
  const match = sigs.some((sig) => sig.length === expected.length && [...sig].every((ch, i) => ch === expected[i]));
  if (!match) return { ok: false, error: 'bad signature', status: 400 };
  return { ok: true };
}
