import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, fakeProvider, key } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { createCandidate, getCandidateView, ServiceError } from '../../lib/delivery/service.js';
import { setPaymentLookupForTests, verifyStripeSession } from '../../lib/delivery/payments.js';

let h;
beforeEach(async () => { h = await harness(); fakeProvider(); setPaymentLookupForTests(null); });

const SESSION = 'cs_live_a1B2c3D4e5F6g7H8i9J0';
const session = (over = {}) => ({ id: SESSION, payment_status: 'paid', livemode: true, amount_total: 6500, currency: 'eur', customer_email: 'pay@example.com', product: 'cv_positioning', confirmation_flag: 'true', ...over });

async function intakeWith(sessionId, over = {}) {
  return createCandidate(h.db, {
    submissionKey: key(), name: 'Jordan Test', targetRole: 'x', location: 'y', goal: 'z', package: 'other', stripeSessionId: sessionId,
    file: { name: 'cv.pdf', bytes: await makeCvPdf() }, ...over,
  }, h.schedule);
}

test('only a live session Stripe reports as paid is shown as verified paid; the package comes from what was bought', async () => {
  setPaymentLookupForTests({ retrieve: async () => session() });
  const out = await intakeWith(SESSION);
  await h.idle();
  const view = await getCandidateView(h.db, out.candidateId);
  assert.equal(view.order.payment_status, 'verified_paid');
  assert.equal(view.order.amount_cents, 6500);
  assert.equal(view.candidate.package, 'cv_positioning', 'overrides the "other" chosen on the form');
});

test('the website\'s asovix_fulfilled flag is shown as a confirmation-email note, never as delivery', async () => {
  setPaymentLookupForTests({ retrieve: async () => session() });
  const out = await intakeWith(SESSION);
  await h.idle();
  const view = await getCandidateView(h.db, out.candidateId);
  assert.match(view.order.confirmation_flag, /NOT delivery/);
  assert.notEqual(view.candidate.status, 'ready_for_positioning' + '_delivered');
});

test('unpaid, test-mode, unreachable and unconfigured lookups are never reported as paid', async () => {
  setPaymentLookupForTests({ retrieve: async () => session({ payment_status: 'unpaid' }) });
  assert.equal((await verifyStripeSession(SESSION)).paymentStatus, 'not_paid');
  setPaymentLookupForTests({ retrieve: async () => session({ livemode: false }) });
  const t = await verifyStripeSession('cs_test_a1B2c3D4e5F6g7H8i9J0');
  assert.equal(t.paymentStatus, 'manual_test');
  assert.match(t.note, /TEST-mode/);
  setPaymentLookupForTests({ retrieve: async () => { throw new Error('network down'); } });
  assert.equal((await verifyStripeSession(SESSION)).paymentStatus, 'not_verified');
  setPaymentLookupForTests({ retrieve: async () => null });
  assert.equal((await verifyStripeSession(SESSION)).paymentStatus, 'not_verified');
  setPaymentLookupForTests(null);
  const none = await verifyStripeSession(SESSION);
  assert.equal(none.paymentStatus, 'not_verified');
  assert.match(none.note, /STRIPE_SECRET_KEY/);
  assert.equal((await verifyStripeSession('not-a-session')).paymentStatus, 'not_verified');
});

test('the same order cannot be attached to two candidates', async () => {
  setPaymentLookupForTests({ retrieve: async () => session() });
  await intakeWith(SESSION);
  await h.idle();
  await assert.rejects(() => intakeWith(SESSION), (e) => e instanceof ServiceError && e.status === 409 && /already linked/.test(e.message));
});

test('a Stripe session and a manual test record cannot be combined', async () => {
  await assert.rejects(() => intakeWith(SESSION, { manualTest: true }), /either/);
});
