import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, fakeProvider, makeReq, makeRes } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { handleDelivery } from '../../lib/delivery/api.js';
import { setPaymentLookupForTests } from '../../lib/delivery/payments.js';

let h;
const TOKEN = 'cs_test_a1B2c3D4e5F6g7H8i9J0';
beforeEach(async () => {
  h = await harness();
  fakeProvider();
  setPaymentLookupForTests({ retrieve: async (id) => ({ id, payment_status: 'paid', livemode: false, amount_total: 9900, currency: 'gbp', customer_email: 'client@example.com', product: 'cv_positioning' }) });
});

async function call(opts) {
  const res = makeRes();
  await handleDelivery(makeReq(opts), res, { schedule: h.schedule });
  return res;
}
const submit = async (token = TOKEN, fields = {}) =>
  call({
    method: 'POST', path: ['intake', token],
    multipart: { fields: { name: 'Jordan Test', targetRole: 'Logistics Coordinator', location: 'Cork', goal: 'A better role', ...fields }, file: { name: 'cv.pdf', bytes: await makeCvPdf() } },
  });

test('intake: a paid order sees the form with its email, and needs no sign-in', async () => {
  const r = await call({ path: ['intake', TOKEN] });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.stage, 'form');
  assert.equal(r.body.email, 'client@example.com');
});

test('intake: a link that is not a Stripe session id is refused, and an unpaid order cannot submit', async () => {
  assert.equal((await call({ path: ['intake', 'not-a-session'] })).statusCode, 404);
  setPaymentLookupForTests({ retrieve: async (id) => ({ id, payment_status: 'unpaid', livemode: true, product: 'cv_positioning' }) });
  const state = await call({ path: ['intake', TOKEN] });
  assert.equal(state.body.stage, 'unpaid');
  const res = await submit();
  assert.equal(res.statusCode, 402);
  assert.equal((await h.db.query('SELECT COUNT(*)::int AS n FROM candidates'))[0].n, 0);
});

test('intake: submitting creates exactly one candidate linked to the paid order, starts the reading, and a repeat does nothing new', async () => {
  const first = await submit();
  assert.equal(first.statusCode, 200);
  await h.idle();
  const again = await submit();
  await h.idle();
  assert.equal(again.statusCode, 200);
  const rows = await h.db.query('SELECT c.name, c.email, c.package, o.payment_status FROM candidates c JOIN orders o ON o.id = c.order_id');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, 'client@example.com');
  assert.equal(rows[0].package, 'cv_positioning');
  assert.equal(rows[0].payment_status, 'manual_test');
});

async function openQuestion(candidateName, text) {
  const c = (await h.db.query('SELECT id FROM candidates WHERE name = $1', [candidateName]))[0];
  const id = crypto.randomUUID();
  await h.db.query("INSERT INTO questions (id, candidate_id, topic_key, text, why, essential, status) VALUES ($1,$2,'t-' || $1,$3,'internal reason',TRUE,'open')", [id, c.id, text]);
  await h.db.query("UPDATE candidates SET status = 'awaiting_information' WHERE id = $1", [c.id]);
  return { id, candidateId: c.id };
}

test('intake: the client sees only plain question text, answers it, and the analysis restarts with the answer', async () => {
  await submit();
  await h.idle();
  const q = await openQuestion('Jordan Test', 'How many drivers did you manage?');
  const state = await call({ path: ['intake', TOKEN] });
  assert.equal(state.body.stage, 'questions');
  assert.ok(state.body.questions.some((x) => x.id === q.id && x.text === 'How many drivers did you manage?'));
  for (const x of state.body.questions) assert.deepEqual(Object.keys(x).sort(), ['id', 'text']);
  assert.ok(!JSON.stringify(state.body).includes('internal reason'), 'the internal reason for a question is not shown to the client');
  const res = await call({ method: 'POST', path: ['intake', TOKEN, 'answers'], json: { answers: [{ id: q.id, answer: 'Six drivers, every day.' }] } });
  await h.idle();
  assert.equal(res.statusCode, 200);
  const row = (await h.db.query('SELECT status, answer FROM questions WHERE id = $1', [q.id]))[0];
  assert.equal(row.status, 'answered');
  assert.equal(row.answer, 'Six drivers, every day.');
  const runs = await h.db.query('SELECT COUNT(*)::int AS n FROM runs WHERE candidate_id = $1', [q.candidateId]);
  assert.equal(runs[0].n, 2, 'the answer started a second analysis');
});

test('intake: an answer sent to the wrong order is ignored', async () => {
  await submit();
  await submit('cs_test_Z9y8X7w6V5u4T3s2R1q0', { name: 'Other Person' });
  await h.idle();
  const theirs = await openQuestion('Other Person', 'A private question for someone else');
  const res = await call({ method: 'POST', path: ['intake', TOKEN, 'answers'], json: { answers: [{ id: theirs.id, answer: 'hacked' }] } });
  assert.equal(res.statusCode, 200);
  const row = (await h.db.query('SELECT status, answer FROM questions WHERE id = $1', [theirs.id]))[0];
  assert.equal(row.status, 'open');
  assert.equal(row.answer, null);
});

test('intake: a cross-site POST is refused', async () => {
  const res = await call({ method: 'POST', path: ['intake', TOKEN], headers: { origin: 'https://evil.example' }, json: {} });
  assert.equal(res.statusCode, 403);
});

test('intake: the old rule still holds, every other delivery route needs a session', async () => {
  for (const [method, path] of [['GET', ['candidates']], ['GET', ['status']], ['POST', ['candidates']]]) {
    assert.equal((await call({ method, path })).statusCode, 401);
  }
});
