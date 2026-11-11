// The founder's home screen: revenue counts only verified real payments; the four numbers add up; the session is required.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, fakeProvider, key, makeReq, makeRes } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { createCandidate } from '../../lib/delivery/service.js';
import { getOverview, describe } from '../../lib/delivery/overview.js';
import { handleDelivery } from '../../lib/delivery/api.js';
import { SESSION_COOKIE, createSessionToken } from '../../lib/delivery/auth.js';

let h;
beforeEach(async () => { h = await harness(); fakeProvider(); });

const make = async (over = {}) => (await createCandidate(h.db, {
  submissionKey: key(), name: 'Jordan Test', email: 'j@example.com', targetRole: 'Coordinator', location: 'Cork', goal: 'x', package: 'grad_cv', manualTest: true,
  file: { name: 'cv.pdf', bytes: await makeCvPdf() }, ...over,
}, h.schedule));

test('describe puts each situation in the right bucket', () => {
  assert.equal(describe({ status: 'in_review', payment_status: 'verified_paid' }).bucket, 'approve');
  assert.equal(describe({ status: 'failed', payment_status: 'verified_paid' }).bucket, 'attention');
  assert.equal(describe({ status: 'writing', payment_status: 'verified_paid' }).bucket, 'progress');
  assert.equal(describe({ status: 'delivered', payment_status: 'verified_paid' }).bucket, 'done');
  assert.equal(describe({ status: 'in_review', payment_status: 'not_verified' }).bucket, 'attention');
  assert.equal(describe({ status: 'awaiting_information', payment_status: 'verified_paid', open_questions: 2 }).bucket, 'progress');
});

test('revenue counts only verified real payments, never test records or unverified ones', async () => {
  await make(); await h.idle();
  await h.db.query("INSERT INTO orders (id, source, package, amount_cents, currency, payment_status) VALUES ('o1','paypal','grad_cv',4900,'eur','verified_paid'), ('o2','paypal','grad_package',14900,'eur','verified_paid'), ('o3','paypal','grad_cv',4900,'eur','not_verified')");
  const o = await getOverview(h.db);
  assert.equal(o.tiles.revenue.cents, 19800);
  assert.equal(o.tiles.revenue.orders, 2);
});

test('a paid order whose client has not sent details yet, and a paid order with no confirmation, are shown', async () => {
  await h.db.query("INSERT INTO orders (id, source, package, amount_cents, currency, payment_status, customer_email) VALUES ('o9','paypal','grad_cv',4900,'eur','verified_paid','buyer@example.com')");
  await h.db.query("INSERT INTO paypal_orders (order_id, product, status, captured_at) VALUES ('ORDERZZZZ99','grad_cv','captured', now() - interval '2 hours')");
  const o = await getOverview(h.db);
  assert.ok(o.items.some((i) => i.kind === 'waiting' && i.bucket === 'progress'));
  assert.ok(o.items.some((i) => i.kind === 'payment' && i.bucket === 'attention'));
  assert.equal(o.tiles.needAttention, 1);
});

test('test records are kept out of the four numbers', async () => {
  await make(); await h.idle();
  const o = await getOverview(h.db);
  assert.equal(o.items.filter((i) => i.isTest).length, 1);
  assert.equal(o.tiles.inProgress + o.tiles.awaitingApproval + o.tiles.needAttention + o.tiles.sent, 0);
});

test('the overview needs a sign-in', async () => {
  const anon = makeRes(); await handleDelivery(makeReq({ path: ['overview'] }), anon, { schedule: h.schedule });
  assert.equal(anon.statusCode, 401);
  const ok = makeRes(); await handleDelivery(makeReq({ path: ['overview'], cookie: `${SESSION_COOKIE}=${createSessionToken()}` }), ok, { schedule: h.schedule });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.body.tiles);
});
