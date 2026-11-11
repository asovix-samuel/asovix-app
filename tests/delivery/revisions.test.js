// Customer self-service revisions: private link, free-round limits, paid extra rounds, evidence checks, privacy, and no auto-send.
// Scripted AI, in-memory database, captured email, scripted PayPal. All people and employers are fictional.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, fakeProvider, key, makeReq, makeRes } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { createCandidate } from '../../lib/delivery/service.js';
import { approveDraft, getDeliverablesView, sendDelivery, setMailerForTests } from '../../lib/delivery/writing/service.js';
import { ensureClientToken, revisionState, submitRevision } from '../../lib/delivery/revisions.js';
import { completeOrder, setPaypalDepsForTests } from '../../lib/delivery/paypalOrders.js';
import { handleDelivery } from '../../lib/delivery/api.js';
import { setAlertSinkForTests } from '../../lib/delivery/alerts.js';

let h, outbox, alerts, realFetch, paypalOrders;
beforeEach(async () => {
  h = await harness();
  outbox = []; alerts = []; paypalOrders = new Map();
  setMailerForTests(async (m) => { outbox.push(m); return { messageId: `<msg-${outbox.length}@test>` }; });
  setAlertSinkForTests((a) => alerts.push(a));
  process.env.DELIVERY_AUTOPILOT = 'on';
  process.env.DELIVERY_GAP_WAIT_MIN = '0';
  process.env.DELIVERY_RATE_LIMIT_DELAY_MS = '1';
  process.env.PAYPAL_CLIENT_ID = 'test-id'; process.env.PAYPAL_CLIENT_SECRET = 'test-secret'; process.env.PAYPAL_ENV = 'sandbox';
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const reply = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });
    if (u.includes('/v1/oauth2/token')) return reply({ access_token: 'tok', expires_in: 3000 });
    if (u.endsWith('/v2/checkout/orders') && init.method === 'POST') {
      const body = JSON.parse(init.body); const id = `REVORDER${paypalOrders.size + 1}00`;
      paypalOrders.set(id, body);
      return reply({ id, status: 'CREATED', links: [{ rel: 'payer-action', href: `https://paypal.test/pay/${id}` }] });
    }
    throw new Error(`unexpected fetch ${u}`);
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  setMailerForTests(null); setAlertSinkForTests(null); setPaypalDepsForTests(null);
  process.env.DELIVERY_AUTOPILOT = 'off';
});

async function delivered(over = {}) {
  const out = await createCandidate(h.db, {
    submissionKey: key(), name: 'Jordan Test', email: 'jordan.test@example.com', targetRole: 'Logistics Coordinator',
    location: 'Cork', goal: 'Move into a coordinator role', package: 'grad_cv', manualTest: true,
    jobAd: 'Graduate Logistics Coordinator, Cork. Coordinate dispatch, report weekly, use Excel. '.repeat(3),
    file: { name: 'jordan-cv.pdf', bytes: await makeCvPdf() }, ...over,
  }, h.schedule);
  await h.idle();
  const id = out.candidateId;
  const v = await getDeliverablesView(h.db, id);
  const firstEmail = v.email; // the email Samuel sees before the first delivery
  for (const d of v.drafts) await approveDraft(h.db, id, d.id, { override: true });
  await sendDelivery(h.db, id, { to: 'jordan.test@example.com', subject: 'Your CV', body: 'Here it is.' });
  const token = await ensureClientToken(h.db.query, id);
  return { id, token, firstEmail };
}
const cand = async (id) => (await h.db.query('SELECT status FROM candidates WHERE id = $1', [id]))[0];
const versions = async (id) => (await h.db.query('SELECT COALESCE(MAX(version),0)::int AS v FROM drafts WHERE candidate_id = $1', [id]))[0].v;
const deliveries = async () => (await h.db.query('SELECT COUNT(*)::int AS n FROM deliveries'))[0].n;
const requests = (id) => h.db.query('SELECT kind, status, paid FROM revision_requests WHERE candidate_id = $1 ORDER BY created_at', [id]);
async function resend(id) {
  const v = await getDeliverablesView(h.db, id);
  for (const d of v.drafts) await approveDraft(h.db, id, d.id, { override: true });
  await sendDelivery(h.db, id, { to: 'jordan.test@example.com', subject: 'Updated', body: 'Updated.' });
}

test('the delivery email contains the client’s private revision link', async () => {
  fakeProvider();
  const { token, firstEmail } = await delivered();
  assert.match(firstEmail.body, new RegExp(`/revise\\?t=${token}`));
  assert.match(token, /^[a-f0-9]{32}$/);
});

test('privacy: a token shows only its own client; unknown or malformed tokens reveal nothing', async () => {
  fakeProvider();
  const a = await delivered();
  const b = await delivered();
  await h.db.query("UPDATE candidates SET name = 'Alice Alpha', email = 'alice@example.com' WHERE id = $1", [a.id]);
  await h.db.query("UPDATE candidates SET name = 'Bruno Beta', email = 'bruno@example.com' WHERE id = $1", [b.id]);
  assert.notEqual(a.token, b.token);
  const sa = JSON.stringify(await revisionState(h.db, a.token));
  assert.match(sa, /Alice/);
  assert.doesNotMatch(sa, /Bruno|bruno@|alice@|example\.com/);
  assert.doesNotMatch(sa, new RegExp(a.id));
  for (const bad of ['', 'abc', 'g'.repeat(32), 'a'.repeat(32), `${a.token}x`, `' OR 1=1 --`]) {
    await assert.rejects(() => revisionState(h.db, bad), /does not look right/);
  }
  await assert.rejects(() => submitRevision(h.db, 'f'.repeat(32), { type: 'tone', text: 'Make it shorter please' }, h.schedule), /does not look right/);
});

test('before delivery the page is closed, and a request is refused', async () => {
  fakeProvider();
  const out = await createCandidate(h.db, {
    submissionKey: key(), name: 'Jordan Test', email: 'j@example.com', targetRole: 'Coordinator', location: 'Cork', goal: 'x', package: 'grad_cv', manualTest: true,
    file: { name: 'cv.pdf', bytes: await makeCvPdf() },
  }, h.schedule);
  await h.idle();
  const token = await ensureClientToken(h.db.query, out.candidateId);
  assert.equal((await revisionState(h.db, token)).stage, 'not_ready');
  await assert.rejects(() => submitRevision(h.db, token, { type: 'tone', text: 'Make it shorter please' }, h.schedule), /not been sent/);
});

test('a free wording change is rewritten automatically, lands in review, and is NOT sent to the client', async () => {
  fakeProvider();
  const { id, token } = await delivered();
  assert.equal(await deliveries(), 1);
  const sentBefore = outbox.length;
  const r = await submitRevision(h.db, token, { type: 'tone', text: 'Please make it shorter and more direct.' }, h.schedule);
  await h.idle();
  assert.equal(r.kind, 'accepted');
  assert.equal(await versions(id), 2);
  assert.equal((await cand(id)).status, 'in_review');
  assert.equal(await deliveries(), 1, 'no new delivery without approval');
  assert.equal(outbox.length, sentBefore, 'nothing emailed to the client');
  assert.ok(alerts.some((a) => /Ready for your review/.test(a.subject) && /Jordan/.test(a.text)));
  assert.equal((await revisionState(h.db, token)).stage, 'working');
  await resend(id);
  assert.deepEqual((await requests(id)).map((x) => x.status), ['done']);
});

test('free rounds are limited: the next request asks for payment instead', async () => {
  fakeProvider();
  const { id, token } = await delivered();
  await submitRevision(h.db, token, { type: 'tone', text: 'Please make it shorter and more direct.' }, h.schedule);
  await h.idle(); await resend(id);
  const s = await revisionState(h.db, token);
  assert.equal(s.stage, 'open');
  assert.equal(s.freeLeft, 0);
  const r = await submitRevision(h.db, token, { type: 'tone', text: 'Now please make it a bit warmer.' }, h.schedule);
  assert.equal(r.kind, 'pay');
  assert.match(r.url, /^https:\/\/paypal\.test\/pay\//);
  assert.equal(await versions(id), 2, 'not started until paid');
  const reqs = await requests(id);
  assert.deepEqual(reqs.map((x) => [x.status, x.paid]), [['done', false], ['awaiting_payment', true]]);
});

test('a paid extra round starts the revision automatically, with no order confirmation sent', async () => {
  fakeProvider();
  const { id, token } = await delivered();
  await submitRevision(h.db, token, { type: 'tone', text: 'Please make it shorter and more direct.' }, h.schedule);
  await h.idle(); await resend(id);
  const pay = await submitRevision(h.db, token, { type: 'tone', text: 'Now please make it a bit warmer.' }, h.schedule);
  const orderId = pay.url.split('/').pop();
  const rid = (await h.db.query("SELECT id FROM revision_requests WHERE status = 'awaiting_payment'"))[0].id;
  let confirmations = 0;
  setPaypalDepsForTests({
    get: async () => ({ id: orderId, status: 'COMPLETED', purchase_units: [{ reference_id: 'revision_fee', custom_id: `revision_fee;;;rv_${rid}`, amount: { currency_code: 'EUR', value: '15.00' } }] }),
    capture: async () => ({ alreadyCaptured: false, order: { id: orderId, status: 'COMPLETED', purchase_units: [{ reference_id: 'revision_fee', custom_id: `revision_fee;;;rv_${rid}`, amount: { currency_code: 'EUR', value: '15.00' }, payments: { captures: [{ amount: { currency_code: 'EUR', value: '15.00' } }] } }] } }),
    fulfil: async () => { confirmations++; return 'manual'; },
  });
  const done = await completeOrder(h.db, orderId, { via: 'webhook', schedule: h.schedule });
  await h.idle();
  assert.equal(done.status, 'done');
  assert.equal(confirmations, 0, 'a revision payment is not an order');
  assert.equal(await versions(id), 3);
  assert.equal((await cand(id)).status, 'in_review');
  // the same payment event arriving again does not start a second revision
  await completeOrder(h.db, orderId, { via: 'page', schedule: h.schedule });
  await h.idle();
  assert.equal(await versions(id), 3);
});

test('after the 7-day window, even the first change needs payment', async () => {
  fakeProvider();
  const { id, token } = await delivered();
  await h.db.query("UPDATE deliveries SET sent_at = now() - interval '9 days' WHERE candidate_id = $1", [id]);
  const s = await revisionState(h.db, token);
  assert.equal(s.inWindow, false);
  assert.equal(s.freeLeft, 0);
  const r = await submitRevision(h.db, token, { type: 'tone', text: 'Please make it shorter and more direct.' }, h.schedule);
  assert.equal(r.kind, 'pay');
});

test('only one request at a time, and requests that are too short or of an unknown type are refused', async () => {
  fakeProvider();
  const { token } = await delivered({ package: 'grad_package' }); // two free rounds
  await submitRevision(h.db, token, { type: 'tone', text: 'Please make it shorter and more direct.' }, h.schedule);
  await assert.rejects(() => submitRevision(h.db, token, { type: 'tone', text: 'Another change please, thanks.' }, h.schedule), /already working/);
  await h.idle();
  await assert.rejects(() => submitRevision(h.db, token, { type: 'tone', text: 'short' }, h.schedule), /a little more/);
  await assert.rejects(() => submitRevision(h.db, token, { type: 'hack', text: 'a long enough message here' }, h.schedule), /Choose what/);
});

test('corrections and new information go through the evidence process again before the rewrite', async () => {
  const p = fakeProvider();
  const { id, token } = await delivered();
  const callsBefore = p.seen.extract.length;
  const text = 'I also coordinated a three-person warehouse project in 2024 and reported results to the manager every Friday.';
  const r = await submitRevision(h.db, token, { type: 'new_info', text }, h.schedule);
  await h.idle();
  assert.equal(r.kind, 'accepted');
  assert.ok(p.seen.extract.length > callsBefore, 'the evidence was read again');
  const reread = p.seen.extract[p.seen.extract.length - 1];
  assert.match(JSON.stringify(reread), /three-person warehouse project/);
  assert.equal(await versions(id), 2);
  assert.equal((await cand(id)).status, 'in_review');
  assert.equal(await deliveries(), 1);
});

test('asking for another job is a new paid order, not a free revision', async () => {
  fakeProvider();
  const { id, token } = await delivered();
  const r = await submitRevision(h.db, token, { type: 'adapt' }, h.schedule);
  assert.equal(r.kind, 'buy');
  assert.equal(r.checkoutProduct, 'grad_cv');
  assert.equal((await requests(id)).length, 0);
});

test('the public route: works without a sign-in for its own token only, throttles rapid posts, refuses other sites', async () => {
  fakeProvider();
  const { token } = await delivered({ package: 'grad_package' });
  const call = async (opts) => { const res = makeRes(); await handleDelivery(makeReq(opts), res, { schedule: h.schedule }); return res; };
  const ok = await call({ path: ['revise', token] });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.firstName, 'Jordan');
  assert.equal((await call({ path: ['revise', 'a'.repeat(32)] })).statusCode, 404);
  const post1 = await call({ method: 'POST', path: ['revise', token], json: { type: 'tone', text: 'Please make it shorter and more direct.' } });
  assert.equal(post1.statusCode, 200);
  await h.idle();
  const post2 = await call({ method: 'POST', path: ['revise', token], json: { type: 'tone', text: 'And a little warmer please.' } });
  assert.equal(post2.statusCode, 429);
  const foreign = await call({ method: 'POST', path: ['revise', token], headers: { origin: 'https://evil.example' }, json: { type: 'tone', text: 'Please make it shorter and more direct.' } });
  assert.equal(foreign.statusCode, 403);
});
