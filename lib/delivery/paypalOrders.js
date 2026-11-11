// ── PayPal payment recovery ──
//
// Money is only taken when the order is captured. That used to happen only when the buyer landed back on /success, so a buyer
// who approved on PayPal and closed the tab was never charged and never served. Now every checkout is remembered, and three
// independent paths finish it: the success page, PayPal's own webhook, and a sweeper for anything still unfinished.
//
// All three call completeOrder(), which is safe to run any number of times at once:
//   - capturing twice is refused by PayPal (we treat "already captured" as fine);
//   - fulfilment is claimed with an atomic UPDATE, so exactly one caller sends the confirmation;
//   - a webhook event id is stored, so a repeated delivery does nothing.

import { PAYPAL_ORDER_ID, captureOrder, getOrder, toSession, unpackMeta, verifyWebhook } from '../paypal.js';
import { PRODUCTS } from '../checkout.js';
import { alertOwner } from './alerts.js';

export const MAX_FULFIL_ATTEMPTS = 5;

async function realFulfil(session) {
  const { fulfillOrder } = await import('../fulfill.js');
  return fulfillOrder(null, session);
}
const defaults = { capture: captureOrder, get: getOrder, verify: verifyWebhook, fulfil: realFulfil };
let deps = { ...defaults };
/** Tests replace the PayPal calls and the confirmation sender; pass null to restore the real ones. */
export function setPaypalDepsForTests(d) { deps = d ? { ...deps, ...d } : { ...defaults }; }

export async function trackCreated(db, { id, product, source }) {
  if (!PAYPAL_ORDER_ID.test(String(id))) return;
  await db.query('INSERT INTO paypal_orders (order_id, product, source) VALUES ($1, $2, $3) ON CONFLICT (order_id) DO NOTHING',
    [id, product || null, String(source || '').slice(0, 30) || null]);
}

/** The product id if this PayPal order is one of ours, else ''. */
function ourProduct(order) {
  const unit = (order && order.purchase_units && order.purchase_units[0]) || {};
  const product = unpackMeta(unit.custom_id).product || unit.reference_id || '';
  return PRODUCTS[product] ? product : '';
}

/**
 * Captures (if needed) and fulfils one order. Returns { status, order? } where status is one of
 *   'manual' | 'done'  fulfilled now          'already'  fulfilled earlier
 *   'recovering'       paid, confirmation failed or in progress; retried automatically, owner alerted
 *   'unpaid'           not approved/completed  'ignored'  not one of our products
 */
export async function completeOrder(db, orderId, { via = 'page' } = {}) {
  if (!PAYPAL_ORDER_ID.test(String(orderId))) return { status: 'ignored' };
  const fresh = await db.query('INSERT INTO paypal_orders (order_id, source) VALUES ($1, $2) ON CONFLICT (order_id) DO NOTHING RETURNING order_id', [orderId, `via_${via}`]);
  const justInserted = fresh.length > 0;
  let row = (await db.query('SELECT * FROM paypal_orders WHERE order_id = $1', [orderId]))[0];

  if (row.fulfilled_at) return { status: 'already', order: await deps.get(orderId) };

  // An order we never recorded must be one of our own products before we touch it.
  if (justInserted) {
    const peek = await deps.get(orderId);
    if (!peek || !ourProduct(peek)) {
      await db.query("UPDATE paypal_orders SET status = 'abandoned', last_error = 'not one of our products' WHERE order_id = $1", [orderId]);
      return { status: 'ignored' };
    }
  }

  let cap;
  try {
    cap = await deps.capture(orderId);
  } catch (e) {
    if (e.status === 402) {
      await db.query("UPDATE paypal_orders SET last_error = 'not completed on PayPal', last_checked_at = now() WHERE order_id = $1", [orderId]);
      return { status: 'unpaid' };
    }
    throw e; // PayPal unreachable: let the caller fail so a webhook is retried by PayPal
  }
  const order = cap.order;
  await db.query("UPDATE paypal_orders SET status = CASE WHEN status IN ('created','approved') THEN 'captured' ELSE status END, captured_at = COALESCE(captured_at, now()), product = COALESCE(product, $2) WHERE order_id = $1",
    [orderId, ourProduct(order) || null]);

  // An order captured before this system existed: do not send its confirmation a second time.
  if (justInserted && cap.alreadyCaptured) {
    await db.query("UPDATE paypal_orders SET fulfilled_at = now(), status = 'fulfilled', fulfilment_result = 'legacy' WHERE order_id = $1", [orderId]);
    return { status: 'already', order };
  }

  const claim = await db.query(
    `UPDATE paypal_orders SET fulfil_claimed_at = now(), fulfil_attempts = fulfil_attempts + 1
     WHERE order_id = $1 AND fulfilled_at IS NULL AND fulfil_attempts < $2
       AND (fulfil_claimed_at IS NULL OR fulfil_claimed_at < now() - interval '3 minutes')
     RETURNING fulfil_attempts`, [orderId, MAX_FULFIL_ATTEMPTS]);
  if (!claim.length) {
    row = (await db.query('SELECT fulfilled_at, fulfil_attempts FROM paypal_orders WHERE order_id = $1', [orderId]))[0];
    if (row.fulfilled_at) return { status: 'already', order };
    if (row.fulfil_attempts >= MAX_FULFIL_ATTEMPTS) await giveUp(db, orderId, order);
    return { status: 'recovering', order }; // another caller is on it, or we ran out of attempts
  }

  let result; let err;
  try { result = await deps.fulfil(toSession(order)); } catch (e) { err = e; result = 'failed'; }
  if (result === 'failed') {
    await db.query('UPDATE paypal_orders SET fulfil_claimed_at = NULL, last_error = $2 WHERE order_id = $1', [orderId, String((err && err.message) || 'confirmation could not be sent').slice(0, 300)]);
    await alertOwner(db, `fulfil:${orderId}`, 'A customer has paid but their confirmation did not send',
      `PayPal order ${orderId} (${toSession(order).amount_total / 100} EUR) was captured, but the confirmation email did not go out. It will be retried automatically.`);
    return { status: 'recovering', order };
  }
  await db.query("UPDATE paypal_orders SET fulfilled_at = now(), status = 'fulfilled', fulfilment_result = $2, last_error = NULL WHERE order_id = $1", [orderId, result]);
  return { status: result, order };
}

async function giveUp(db, orderId, order) {
  await alertOwner(db, `giveup:${orderId}`, 'A paid order needs you: automatic retries ran out',
    `PayPal order ${orderId} was paid (${order ? toSession(order).amount_total / 100 : '?'} EUR) but the confirmation could not be sent after ${MAX_FULFIL_ATTEMPTS} tries. Please contact the customer.`, { everyMs: 24 * 3600 * 1000 });
}

/** A PayPal webhook delivery. Returns { status: <http status>, ... }. Unverified events do nothing at all. */
export async function handleWebhook(db, headers, rawBody) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return { status: 503, error: 'Webhook is not set up yet (PAYPAL_WEBHOOK_ID).' };
  let event;
  try { event = JSON.parse(rawBody); } catch (e) { return { status: 400, error: 'Not valid JSON.' }; }
  if (!event || typeof event.id !== 'string' || typeof event.event_type !== 'string') return { status: 400, error: 'Not a PayPal event.' };
  let verified = false;
  try { verified = await deps.verify(headers, event); } catch (e) { return { status: 502, error: 'Could not verify with PayPal.' }; }
  if (!verified) return { status: 401, error: 'Signature not verified.' };

  const fresh = await db.query('INSERT INTO paypal_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id', [event.id, event.event_type]);
  if (!fresh.length) return { status: 200, duplicate: true };

  const res = event.resource || {};
  try {
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        if (res.id) await completeOrder(db, res.id, { via: 'webhook' });
        break;
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const oid = res.supplementary_data && res.supplementary_data.related_ids && res.supplementary_data.related_ids.order_id;
        if (oid) await completeOrder(db, oid, { via: 'webhook' });
        break;
      }
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
      case 'PAYMENT.CAPTURE.PENDING':
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        const kind = event.event_type.replace('PAYMENT.CAPTURE.', '').toLowerCase();
        const amt = res.amount ? `${res.amount.value} ${res.amount.currency_code}` : 'unknown amount';
        await alertOwner(db, `capture:${event.event_type}:${res.id || event.id}`, `A payment was ${kind}`,
          `PayPal reported a payment ${kind} (${amt}), capture ${res.id || '?'}. Check the order in PayPal and in the workspace before doing any more work for this customer.`, { everyMs: 60 * 1000 });
        break;
      }
      default: break; // other event types are accepted and ignored
    }
  } catch (e) {
    await db.query('DELETE FROM paypal_events WHERE event_id = $1', [event.id]); // so PayPal's retry can try again
    console.error('paypal webhook: processing failed, PayPal will retry:', e.message);
    return { status: 500, error: 'Processing failed; please retry.' };
  }
  return { status: 200 };
}

/**
 * Finishes anything left half-done: approved-but-never-captured checkouts, paid-but-unconfirmed orders.
 * Safe to run as often as you like. Called by the scheduled job.
 */
export async function recoverPayments(db) {
  const rows = await db.query(
    `SELECT order_id, created_at FROM paypal_orders
     WHERE fulfilled_at IS NULL AND status NOT IN ('abandoned')
       AND created_at > now() - interval '3 days' AND created_at < now() - interval '10 minutes'
       AND (last_checked_at IS NULL OR last_checked_at < now() - interval '10 minutes')
     ORDER BY created_at LIMIT 25`);
  const out = { checked: 0, recovered: 0, abandoned: 0, stillFailing: 0 };
  for (const r of rows) {
    out.checked++;
    await db.query('UPDATE paypal_orders SET last_checked_at = now() WHERE order_id = $1', [r.order_id]);
    let o;
    try { o = await deps.get(r.order_id); } catch (e) { continue; }
    if (!o) continue;
    if (o.status === 'APPROVED' || o.status === 'COMPLETED') {
      const res = await completeOrder(db, r.order_id, { via: 'sweeper' });
      if (res.status === 'manual' || res.status === 'done') out.recovered++;
      else if (res.status === 'recovering') out.stillFailing++;
    } else if (o.status === 'VOIDED' || (o.status === 'CREATED' && Date.now() - new Date(r.created_at).getTime() > 24 * 3600 * 1000)) {
      await db.query("UPDATE paypal_orders SET status = 'abandoned' WHERE order_id = $1", [r.order_id]);
      out.abandoned++;
    }
  }
  return out;
}
