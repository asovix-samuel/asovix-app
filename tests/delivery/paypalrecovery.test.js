// Payment recovery: a paid customer is never lost, never charged twice, never served twice, and unverified events do nothing.
// PayPal and the confirmation sender are replaced with scripted fakes. No network.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, makeReq, makeRes } from './helpers.js';
import { handleDelivery } from '../../lib/delivery/api.js';
import { completeOrder, handleWebhook, recoverPayments, trackCreated, setPaypalDepsForTests, MAX_FULFIL_ATTEMPTS } from '../../lib/delivery/paypalOrders.js';
import { setAlertSinkForTests } from '../../lib/delivery/alerts.js';

let h, paypal, calls, alerts, fulfilResult;
const ID = 'ORDERAAAAA1';
const ID2 = 'ORDERBBBBB2';

const mk = (id, status, product = 'grad_cv') => ({
  id, status,
  purchase_units: [{
    reference_id: product, custom_id: `${product};;;ad_meta_test`, amount: { currency_code: 'EUR', value: '49.00' },
    payments: status === 'COMPLETED' ? { captures: [{ amount: { currency_code: 'EUR', value: '49.00' } }] } : undefined,
  }],
  payer: { email_address: 'buyer@example.com', name: { given_name: 'Test', surname: 'Buyer' } },
});

beforeEach(async () => {
  h = await harness();
  paypal = new Map(); calls = { capture: 0, fulfil: 0, verify: 0 }; alerts = []; fulfilResult = 'manual';
  process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST';
  setAlertSinkForTests((a) => alerts.push(a));
  setPaypalDepsForTests({
    get: async (id) => paypal.get(id) || null,
    capture: async (id) => {
      calls.capture++;
      const o = paypal.get(id);
      if (!o || o.status === 'CREATED') throw Object.assign(new Error('Payment not completed'), { status: 402 });
      if (o.status === 'COMPLETED') return { order: o, alreadyCaptured: true };
      o.status = 'COMPLETED';
      o.purchase_units[0].payments = { captures: [{ amount: { currency_code: 'EUR', value: '49.00' } }] };
      return { order: o, alreadyCaptured: false };
    },
    fulfil: async () => { calls.fulfil++; if (fulfilResult instanceof Error) throw fulfilResult; return fulfilResult; },
    verify: async (headers) => { calls.verify++; return headers['paypal-transmission-sig'] === 'good'; },
  });
});

const event = (id, type, resource) => JSON.stringify({ id, event_type: type, resource });
const good = { 'paypal-transmission-sig': 'good', 'paypal-transmission-id': 't1', 'paypal-cert-url': 'x' };
const row = async (id) => (await h.db.query('SELECT * FROM paypal_orders WHERE order_id = $1', [id]))[0];

test('a buyer who approves and closes the tab is still captured and served by the webhook', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv', source: 'ad_meta_test' });
  const r = await handleWebhook(h.db, good, event('WH-1', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(r.status, 200);
  assert.equal(calls.capture, 1);
  assert.equal(calls.fulfil, 1);
  assert.equal((await row(ID)).status, 'fulfilled');
});

test('the same webhook delivered twice, or two different events for one order, serve the customer once', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  await handleWebhook(h.db, good, event('WH-1', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  const again = await handleWebhook(h.db, good, event('WH-1', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(again.duplicate, true);
  const other = await handleWebhook(h.db, good, event('WH-2', 'PAYMENT.CAPTURE.COMPLETED', { id: 'CAP1', supplementary_data: { related_ids: { order_id: ID } } }));
  assert.equal(other.status, 200);
  assert.equal(calls.fulfil, 1);
  assert.equal((await h.db.query('SELECT COUNT(*)::int AS n FROM paypal_orders'))[0].n, 1);
});

test('the success page and the webhook racing each other fulfil exactly once', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  const [a, b, c] = await Promise.all([
    completeOrder(h.db, ID, { via: 'page' }),
    completeOrder(h.db, ID, { via: 'webhook' }),
    completeOrder(h.db, ID, { via: 'page' }),
  ]);
  assert.equal(calls.fulfil, 1);
  assert.equal([a, b, c].filter((x) => x.status === 'manual').length, 1);
});

test('an event PayPal did not sign does nothing, and nothing is recorded', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  const r = await handleWebhook(h.db, { 'paypal-transmission-sig': 'forged' }, event('WH-9', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(r.status, 401);
  assert.equal(calls.capture, 0);
  assert.equal(calls.fulfil, 0);
  assert.equal((await h.db.query('SELECT COUNT(*)::int AS n FROM paypal_events'))[0].n, 0);
});

test('without a webhook id configured, events are refused rather than trusted', async () => {
  delete process.env.PAYPAL_WEBHOOK_ID;
  const r = await handleWebhook(h.db, good, event('WH-1', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(r.status, 503);
  assert.equal(calls.capture, 0);
});

test('the public webhook route verifies, answers 200, and refuses a bad signature with 401', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  const call = async (headers, body) => {
    const res = makeRes();
    const req = makeReq({ method: 'POST', path: ['paypal-webhook'], headers });
    // makeReq only builds JSON bodies from an object; send the exact text PayPal would.
    const { Readable } = await import('node:stream');
    const raw = Readable.from([Buffer.from(body)]);
    raw.method = 'POST'; raw.headers = req.headers; raw.query = req.query;
    await handleDelivery(raw, res, { schedule: h.schedule });
    return res;
  };
  const bad = await call({ 'paypal-transmission-sig': 'nope' }, event('WH-5', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(bad.statusCode, 401);
  const ok = await call(good, event('WH-6', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(ok.statusCode, 200);
  assert.equal(calls.fulfil, 1);
});

test('paid but the confirmation fails: the owner is alerted, then the sweeper retries and finishes it without a second charge', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  fulfilResult = new Error('SMTP down');
  const first = await completeOrder(h.db, ID, { via: 'page' });
  assert.equal(first.status, 'recovering');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].subject, /paid but their confirmation/);
  assert.equal(paypal.get(ID).status, 'COMPLETED');
  // time passes, email works again
  await h.db.query("UPDATE paypal_orders SET created_at = now() - interval '30 minutes', last_checked_at = NULL WHERE order_id = $1", [ID]);
  fulfilResult = 'manual';
  const out = await recoverPayments(h.db);
  assert.equal(out.recovered, 1);
  assert.equal((await row(ID)).status, 'fulfilled');
  assert.equal(calls.fulfil, 2); // one failed attempt, one success
});

test('after the maximum number of failed confirmations the owner is told a human is needed', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  fulfilResult = new Error('SMTP down');
  for (let i = 0; i < MAX_FULFIL_ATTEMPTS + 1; i++) await completeOrder(h.db, ID, { via: 'sweeper' });
  assert.equal(calls.fulfil, MAX_FULFIL_ATTEMPTS);
  assert.ok(alerts.some((a) => /retries ran out/.test(a.subject)));
});

test('an abandoned checkout is never charged and is tidied away; an approved one is recovered', async () => {
  paypal.set(ID, mk(ID, 'CREATED'));
  paypal.set(ID2, mk(ID2, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  await trackCreated(h.db, { id: ID2, product: 'grad_package' });
  await h.db.query("UPDATE paypal_orders SET created_at = now() - interval '30 hours'");
  const out = await recoverPayments(h.db);
  assert.equal(out.abandoned, 1);
  assert.equal(out.recovered, 1);
  assert.equal((await row(ID)).status, 'abandoned');
  assert.equal(paypal.get(ID).status, 'CREATED'); // never captured
  assert.equal(calls.fulfil, 1);
});

test('an order captured before this system existed is not confirmed a second time', async () => {
  paypal.set(ID, mk(ID, 'COMPLETED'));
  const r = await completeOrder(h.db, ID, { via: 'page' });
  assert.equal(r.status, 'already');
  assert.equal(calls.fulfil, 0);
});

test('an order that is not one of our products is ignored, never captured', async () => {
  paypal.set(ID, mk(ID, 'APPROVED', 'something_else'));
  const r = await handleWebhook(h.db, good, event('WH-7', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(r.status, 200);
  assert.equal(calls.capture, 0);
  assert.equal(calls.fulfil, 0);
});

test('a failed payment event alerts the owner and takes no action', async () => {
  const r = await handleWebhook(h.db, good, event('WH-8', 'PAYMENT.CAPTURE.DENIED', { id: 'CAP9', amount: { value: '49.00', currency_code: 'EUR' } }));
  assert.equal(r.status, 200);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].subject, /denied/);
  assert.equal(calls.fulfil, 0);
});

test('if PayPal cannot be reached while processing, the webhook fails so PayPal retries, and the event can be processed later', async () => {
  paypal.set(ID, mk(ID, 'APPROVED'));
  await trackCreated(h.db, { id: ID, product: 'grad_cv' });
  let down = true;
  setPaypalDepsForTests({ capture: async (id) => { if (down) throw Object.assign(new Error('network'), { status: 502 }); const o = paypal.get(id); o.status = 'COMPLETED'; return { order: o, alreadyCaptured: false }; } });
  const first = await handleWebhook(h.db, good, event('WH-3', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(first.status, 500);
  down = false;
  const retry = await handleWebhook(h.db, good, event('WH-3', 'CHECKOUT.ORDER.APPROVED', { id: ID }));
  assert.equal(retry.status, 200);
  assert.equal(calls.fulfil, 1);
});
