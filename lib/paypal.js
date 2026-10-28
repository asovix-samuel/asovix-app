// ── PayPal checkout (REST Orders v2) ──
//
// Same shape as the Stripe flow: the site creates an order, sends the buyer to PayPal, and PayPal sends
// them back to /success?token=<order id>. Payment is only TAKEN when we capture the order server-side
// (see /api/fulfill), so "paid" always means PayPal itself confirmed it. Capturing twice is refused by
// PayPal, which is what keeps the confirmation emails from being sent twice.
//
// Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV ('live' or 'sandbox', default sandbox).

import { PRODUCTS } from './checkout.js';

export const PAYPAL_ORDER_ID = /^[A-Z0-9]{10,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DX_RE = /^dx_[a-z0-9_]{4,40}$/i;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://www.asovix.com';
const base = () => (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
export const paymentProvider = () => (process.env.PAYMENT_PROVIDER === 'paypal' ? 'paypal' : 'stripe');

let tokenCache = { value: null, until: 0 };
async function accessToken() {
  if (tokenCache.value && Date.now() < tokenCache.until) return tokenCache.value;
  if (!paypalConfigured()) throw Object.assign(new Error('PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).'), { status: 503 });
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.access_token) throw Object.assign(new Error('PayPal rejected the credentials.'), { status: 502 });
  tokenCache = { value: json.access_token, until: Date.now() + Math.max(60, (json.expires_in || 300) - 60) * 1000 };
  return tokenCache.value;
}

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await accessToken();
  const r = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

/** custom_id travels with the order (PayPal allows 127 characters): product;diagnosis;cvOnFile;source */
export function packMeta({ product, diagnosisId, cvOnFile, source }) {
  const dx = diagnosisId && DX_RE.test(String(diagnosisId)) ? String(diagnosisId) : '';
  return [product, dx, dx && cvOnFile ? '1' : '', String(source || '').replace(/[;\s]/g, '').slice(0, 30)].join(';').slice(0, 127);
}
export function unpackMeta(customId) {
  const [product = '', diagnosisId = '', cv = '', source = ''] = String(customId || '').split(';');
  return { product, diagnosisId, cvOnFile: cv === '1' ? '1' : '', source };
}

/** Pure: exactly what is sent to PayPal, or null for an unknown product. */
export function buildOrderPayload({ product, email, diagnosisId, cvOnFile, source } = {}) {
  const p = PRODUCTS[product];
  if (!p) return null;
  const trimmed = String(email || '').trim();
  return {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: product,
      custom_id: packMeta({ product, diagnosisId, cvOnFile, source }),
      description: p.name.slice(0, 127),
      amount: { currency_code: 'EUR', value: (p.amount / 100).toFixed(2) },
    }],
    payment_source: {
      paypal: {
        ...(EMAIL_RE.test(trimmed) ? { email_address: trimmed.toLowerCase() } : {}),
        experience_context: {
          brand_name: 'Asovix',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          return_url: `${appUrl()}/success?provider=paypal`,
          cancel_url: `${appUrl()}/?cancelled=true`,
        },
      },
    },
  };
}

/** Creates the order and returns { id, url } where url is the PayPal page to send the buyer to. */
export async function createPayPalOrder(opts) {
  const body = buildOrderPayload(opts);
  if (!body) throw Object.assign(new Error('Unknown product'), { status: 400 });
  const r = await api('/v2/checkout/orders', { method: 'POST', body, headers: { 'PayPal-Request-Id': `asovix-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` } });
  if (!r.ok) throw Object.assign(new Error(`PayPal could not create the order (${r.status}).`), { status: 502, detail: r.json });
  const link = (r.json.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!link) throw Object.assign(new Error('PayPal did not return a payment link.'), { status: 502 });
  return { id: r.json.id, url: link.href };
}

/**
 * Takes the payment for an order the buyer approved. Returns { order, alreadyCaptured }.
 * Throws with status 402 if it is not completed.
 */
export async function captureOrder(orderId) {
  if (!PAYPAL_ORDER_ID.test(String(orderId))) throw Object.assign(new Error('Invalid order id'), { status: 400 });
  const cap = await api(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST', body: {} });
  if (cap.ok && cap.json.status === 'COMPLETED') return { order: cap.json, alreadyCaptured: false };
  const issues = (cap.json.details || []).map((d) => d.issue);
  if (cap.status === 422 && issues.includes('ORDER_ALREADY_CAPTURED')) {
    const got = await api(`/v2/checkout/orders/${orderId}`);
    if (got.ok && got.json.status === 'COMPLETED') return { order: got.json, alreadyCaptured: true };
  }
  throw Object.assign(new Error('Payment not completed'), { status: 402 });
}

/** Read-only lookup, used by the delivery workspace to confirm an order is really paid. */
export async function getOrder(orderId) {
  if (!PAYPAL_ORDER_ID.test(String(orderId))) return null;
  const r = await api(`/v2/checkout/orders/${orderId}`);
  return r.ok ? r.json : null;
}

/** A PayPal order in the Stripe-session shape that fulfillOrder() already understands. */
export function toSession(order) {
  const unit = (order.purchase_units || [])[0] || {};
  const capture = (((unit.payments || {}).captures || [])[0]) || {};
  const amount = capture.amount || unit.amount || {};
  const payer = order.payer || {};
  const name = [payer.name && payer.name.given_name, payer.name && payer.name.surname].filter(Boolean).join(' ');
  const email = payer.email_address || null;
  return {
    id: order.id,
    payment_status: order.status === 'COMPLETED' ? 'paid' : 'unpaid',
    livemode: process.env.PAYPAL_ENV === 'live',
    amount_total: Math.round(parseFloat(amount.value || '0') * 100),
    currency: String(amount.currency_code || 'EUR').toLowerCase(),
    customer_email: email,
    customer_details: { name: name || null, email },
    metadata: { product: unpackMeta(unit.custom_id).product || unit.reference_id || '', diagnosisId: unpackMeta(unit.custom_id).diagnosisId, cvOnFile: unpackMeta(unit.custom_id).cvOnFile, source: unpackMeta(unit.custom_id).source },
  };
}
