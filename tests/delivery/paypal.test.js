import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderPayload, captureOrder, createPayPalOrder, packMeta, paymentProvider, toSession, unpackMeta } from '../../lib/paypal.js';
import { verifyStripeSession } from '../../lib/delivery/payments.js';
import { tokenOk } from '../../lib/delivery/intake.js';

const realFetch = globalThis.fetch;
let calls;
let orders; // fake PayPal: orderId -> { status, captured }

function fakePayPal() {
  calls = [];
  orders = new Map();
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ method: init.method || 'GET', path: u.pathname, body: init.body ? safe(init.body) : null });
    const reply = (status, json) => ({ ok: status < 300, status, json: async () => json });
    if (u.pathname === '/v1/oauth2/token') return reply(200, { access_token: 'tok', expires_in: 3600 });
    if (u.pathname === '/v2/checkout/orders' && init.method === 'POST') {
      const id = 'ORDER12345ABCDE67';
      const body = JSON.parse(init.body);
      orders.set(id, { status: 'CREATED', unit: body.purchase_units[0] });
      return reply(201, { id, links: [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` }] });
    }
    const cap = u.pathname.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)\/capture$/);
    if (cap) {
      const o = orders.get(cap[1]);
      if (!o) return reply(404, {});
      if (o.status === 'COMPLETED') return reply(422, { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] });
      if (o.status !== 'APPROVED') return reply(422, { details: [{ issue: 'ORDER_NOT_APPROVED' }] });
      o.status = 'COMPLETED';
      return reply(201, full(cap[1], o));
    }
    const get = u.pathname.match(/^\/v2\/checkout\/orders\/([A-Z0-9]+)$/);
    if (get) { const o = orders.get(get[1]); return o ? reply(200, full(get[1], o)) : reply(404, {}); }
    return reply(404, {});
  };
}
const safe = (b) => { try { return JSON.parse(b); } catch { return String(b); } };
const full = (id, o) => ({
  id, status: o.status,
  payer: { email_address: 'buyer@example.com', name: { given_name: 'Jordan', surname: 'Test' } },
  purchase_units: [{ reference_id: o.unit.reference_id, custom_id: o.unit.custom_id, amount: o.unit.amount, payments: { captures: [{ amount: o.unit.amount }] } }],
});

beforeEach(() => {
  process.env.PAYPAL_CLIENT_ID = 'test-id';
  process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
  process.env.PAYPAL_ENV = 'sandbox';
  fakePayPal();
});
afterEach(() => { globalThis.fetch = realFetch; delete process.env.PAYMENT_PROVIDER; });

test('paypal: the order charges exactly the catalogue price in euros and carries the product', () => {
  const p = buildOrderPayload({ product: 'cv_positioning', email: 'A@B.com', diagnosisId: 'dx_abc123', cvOnFile: true, source: 'diagnosis' });
  assert.equal(p.intent, 'CAPTURE');
  assert.deepEqual(p.purchase_units[0].amount, { currency_code: 'EUR', value: '65.00' });
  assert.equal(p.purchase_units[0].reference_id, 'cv_positioning');
  assert.deepEqual(unpackMeta(p.purchase_units[0].custom_id), { product: 'cv_positioning', diagnosisId: 'dx_abc123', cvOnFile: '1', source: 'diagnosis' });
  assert.equal(p.payment_source.paypal.email_address, 'a@b.com');
  assert.match(p.payment_source.paypal.experience_context.return_url, /\/success\?provider=paypal$/);
  assert.equal(buildOrderPayload({ product: 'nope' }), null);
  assert.ok(packMeta({ product: 'x', source: 'a;b c' }).length <= 127);
});

test('paypal: an unknown product or bad diagnosis id cannot be smuggled in', () => {
  const p = buildOrderPayload({ product: 'full_package', diagnosisId: 'not valid; drop', cvOnFile: true });
  assert.equal(unpackMeta(p.purchase_units[0].custom_id).diagnosisId, '');
  assert.equal(unpackMeta(p.purchase_units[0].custom_id).cvOnFile, '');
});

test('paypal: creating an order returns the PayPal page to send the buyer to', async () => {
  const o = await createPayPalOrder({ product: 'full_package' });
  assert.equal(o.id, 'ORDER12345ABCDE67');
  assert.match(o.url, /paypal\.com\/checkoutnow/);
  assert.equal(calls.find((c) => c.path === '/v2/checkout/orders').body.purchase_units[0].amount.value, '225.00');
});

test('paypal: payment is only taken on capture; a second capture reports "already" instead of paying or emailing twice', async () => {
  const { id } = await createPayPalOrder({ product: 'linkedin' });
  await assert.rejects(() => captureOrder(id), (e) => e.status === 402, 'not approved by the buyer yet: nothing is paid');
  orders.get(id).status = 'APPROVED';
  const first = await captureOrder(id);
  assert.equal(first.alreadyCaptured, false);
  const session = toSession(first.order);
  assert.equal(session.payment_status, 'paid');
  assert.equal(session.amount_total, 5500);
  assert.equal(session.currency, 'eur');
  assert.equal(session.customer_email, 'buyer@example.com');
  assert.equal(session.customer_details.name, 'Jordan Test');
  assert.equal(session.metadata.product, 'linkedin');
  const again = await captureOrder(id);
  assert.equal(again.alreadyCaptured, true);
});

test('paypal: a malformed order id never reaches PayPal', async () => {
  const before = calls.length;
  await assert.rejects(() => captureOrder('../../evil'), (e) => e.status === 400);
  assert.equal(calls.length, before);
});

test('paypal: the delivery workspace confirms payment with PayPal, sandbox is a test payment, unpaid is never "paid"', async () => {
  const { id } = await createPayPalOrder({ product: 'cv_positioning' });
  let v = await verifyStripeSession(id);
  assert.equal(v.provider, 'paypal');
  assert.equal(v.paymentStatus, 'not_paid');
  orders.get(id).status = 'APPROVED';
  await captureOrder(id);
  v = await verifyStripeSession(id);
  assert.equal(v.paymentStatus, 'manual_test', 'sandbox money is not real money');
  assert.equal(v.package, 'cv_positioning');
  process.env.PAYPAL_ENV = 'live';
  v = await verifyStripeSession(id);
  assert.equal(v.paymentStatus, 'verified_paid');
  delete process.env.PAYPAL_CLIENT_ID;
  v = await verifyStripeSession(id);
  assert.equal(v.paymentStatus, 'not_verified');
});

test('paypal: the client intake page accepts a PayPal order id as its key, and Stripe ids still work', () => {
  assert.equal(tokenOk('ORDER12345ABCDE67'), true);
  assert.equal(tokenOk('cs_test_a1B2c3D4e5F6g7H8i9J0'), true);
  assert.equal(tokenOk('nope'), false);
  assert.equal(tokenOk('../etc/passwd'), false);
});

test('paypal: the provider switch defaults to Stripe so the live site is unchanged until it is turned on', () => {
  assert.equal(paymentProvider(), 'stripe');
  process.env.PAYMENT_PROVIDER = 'paypal';
  assert.equal(paymentProvider(), 'paypal');
});
