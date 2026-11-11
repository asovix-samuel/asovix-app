import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, fakeProvider, key, makeReq, makeRes } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { createCandidate } from '../../lib/delivery/service.js';
import { setPaymentLookupForTests } from '../../lib/delivery/payments.js';
import { setAdvertFinderForTests } from '../../lib/delivery/market/service.js';
import { afterAnalysis } from '../../lib/delivery/market/after.js';
import { sendReminders, setNotifyMailerForTests } from '../../lib/delivery/notify.js';
import { intakeState, submitIntake } from '../../lib/delivery/intake.js';
import { handleDelivery } from '../../lib/delivery/api.js';

let h, outbox;
const TOKEN = 'cs_test_Aa1Bb2Cc3Dd4Ee5Ff6Gg';
const LONG = (t) => `${t}\n\nAbout the role: we need someone reliable who can coordinate daily dispatch and keep records accurate. You will work in a busy warehouse team and keep customers informed. Experience of dispatch coordination is an advantage but full training is given.`;
const adverts = (n) => Array.from({ length: n }, (_, i) => ({ id: `A${i + 1}`, source: 'reed', ext_id: String(i), title: `Coordinator ${i}`, company: `Firm ${i}`, location: 'Cork', link: '', salary: '', posted: '', text: LONG(`Coordinator ${i}`) }));

beforeEach(async () => {
  h = await harness();
  outbox = [];
  setNotifyMailerForTests(async (m) => { outbox.push(m); return { messageId: 'x' }; });
  process.env.REED_API_KEY = 'k';
  setAdvertFinderForTests(async () => adverts(5));
  setPaymentLookupForTests({ retrieve: async (id) => ({ id, payment_status: 'paid', livemode: true, amount_total: 6500, currency: 'eur', customer_email: 'jordan.test@example.com', product: 'cv_positioning' }) });
});
afterEach(() => { setNotifyMailerForTests(null); setAdvertFinderForTests(null); delete process.env.REED_API_KEY; delete process.env.CRON_SECRET; });

async function paidClient(over = {}) {
  const out = await createCandidate(h.db, {
    submissionKey: key(), name: 'Jordan Test', email: 'jordan.test@example.com', targetRole: 'Logistics Coordinator', location: 'Cork',
    goal: 'A coordinator role', package: 'cv_positioning', stripeSessionId: TOKEN, file: { name: 'jordan-cv.pdf', bytes: await makeCvPdf() }, ...over,
  }, h.schedule);
  await h.idle();
  return out.candidateId;
}
const questionsOf = (id) => h.db.query("SELECT topic_key, text, status, manual FROM questions WHERE candidate_id = $1 AND topic_key LIKE 'mkt-%'", [id]);

test('after the analysis: the market is researched, the client is asked about the gaps, and emailed their link once', async () => {
  const provider = fakeProvider();
  const id = await paidClient();
  const qs = await questionsOf(id);
  assert.equal(qs.length, 1, 'one valid question: the invented pattern and the duplicate topic were dropped');
  assert.match(qs[0].text, /Employers for this kind of role look for/);
  assert.equal(qs[0].manual, true, 'kept across re-analysis');
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'jordan.test@example.com');
  assert.ok(outbox[0].text.includes(`/intake?session_id=${TOKEN}`));
  assert.match(outbox[0].subject, /few quick questions/);
  assert.equal(provider.seen.marketQuestions.length, 1);
  await afterAnalysis(h.db, id);
  assert.equal(outbox.length, 1, 'never emailed twice');
  assert.equal((await questionsOf(id)).length, 1);
});

test('the client sees the market questions on the intake page and nothing internal', async () => {
  fakeProvider();
  await submitIntake(h.db, TOKEN, { name: 'Jordan Test', email: 'jordan.test@example.com', targetRole: 'Logistics Coordinator', location: 'Cork', goal: 'A coordinator role' }, { name: 'jordan-cv.pdf', bytes: await makeCvPdf() }, h.schedule);
  await h.idle();
  const s = await intakeState(h.db, TOKEN);
  assert.equal(s.stage, 'questions');
  assert.ok(s.questions.some((x) => /Employers for this kind of role/.test(x.text)));
  assert.ok(!JSON.stringify(s).includes('invented'));
});

test('without the advert feed nothing is researched or asked; a test order is asked but never emailed', async () => {
  fakeProvider();
  delete process.env.REED_API_KEY;
  const a = await paidClient();
  assert.equal((await questionsOf(a)).length, 0);
  assert.equal(outbox.length, 0);
  process.env.REED_API_KEY = 'k';
  const b = await createCandidate(h.db, { submissionKey: key(), name: 'Test Two', email: 'two@example.com', targetRole: 'Logistics Coordinator', location: 'Cork', goal: 'x', package: 'cv_positioning', manualTest: true, file: { name: 'cv.pdf', bytes: await makeCvPdf() } }, h.schedule);
  await h.idle();
  assert.equal((await questionsOf(b.candidateId)).length, 1);
  assert.equal(outbox.length, 0, 'manual test orders never email anyone');
});

test('reminders: a buyer who paid and never started gets one nudge, only after 24 hours, never for test orders', async () => {
  fakeProvider();
  const addOrder = (ref, email, over = '') => h.db.query(`INSERT INTO orders (id, source, stripe_session_id, package, payment_status, customer_email, created_at) VALUES ($1,'paypal',$2,'cv_positioning','verified_paid',$3, now() - interval '${over || '2 days'}')`, [`o-${ref}`, ref, email]);
  await addOrder('OLDPAIDORDER12345', 'late@example.com');
  await addOrder('FRESHORDER1234567', 'fresh@example.com', '2 hours');
  await h.db.query("INSERT INTO orders (id, source, stripe_session_id, package, payment_status, customer_email, created_at) VALUES ('o-t','manual_test','TESTORDER12345678','cv_positioning','manual_test','t@example.com', now() - interval '3 days')");
  const first = await sendReminders(h.db);
  assert.equal(first.notStarted, 1);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'late@example.com');
  assert.ok(outbox[0].text.includes('/intake?session_id=OLDPAIDORDER12345'));
  const again = await sendReminders(h.db);
  assert.equal(again.notStarted, 0);
  assert.equal(outbox.length, 1, 'one reminder only');
});

test('reminders: a client with open questions who went quiet gets one nudge; one who answered everything gets none', async () => {
  fakeProvider();
  const id = await paidClient();
  assert.equal((await sendReminders(h.db)).quiet, 0, 'not yet 24 hours');
  outbox.length = 0;
  await h.db.query("UPDATE candidates SET updated_at = now() - interval '2 days', questions_email_sent_at = now() - interval '2 days' WHERE id = $1", [id]);
  const r = await sendReminders(h.db);
  assert.equal(r.quiet, 1);
  assert.match(outbox[0].subject, /Still need a few answers/);
  assert.equal((await sendReminders(h.db)).quiet, 0, 'only once');
  const other = await paidClient({ submissionKey: key(), stripeSessionId: undefined, manualTest: true });
  assert.ok(other);
  await h.db.query("UPDATE questions SET status = 'answered', answer = 'x' WHERE candidate_id = $1", [id]);
  await h.db.query("UPDATE candidates SET reminder_sent_at = NULL, updated_at = now() - interval '3 days' WHERE id = $1", [id]);
  outbox.length = 0;
  assert.equal((await sendReminders(h.db)).quiet, 0, 'nothing left to ask, so no nudge');
});

test('reminders: a failed send is not marked as sent, so the next run tries again', async () => {
  fakeProvider();
  await h.db.query("INSERT INTO orders (id, source, stripe_session_id, package, payment_status, customer_email, created_at) VALUES ('o-f','paypal','FAILORDER123456789','cv_positioning','verified_paid','f@example.com', now() - interval '2 days')");
  setNotifyMailerForTests(async () => { throw new Error('smtp down'); });
  const bad = await sendReminders(h.db);
  assert.equal(bad.failed, 1);
  setNotifyMailerForTests(async (m) => { outbox.push(m); return {}; });
  const good = await sendReminders(h.db);
  assert.equal(good.notStarted, 1);
});

test('the daily route needs CRON_SECRET: closed without it, closed to a wrong one, and no session is involved', async () => {
  fakeProvider();
  const call = async (headers) => { const res = makeRes(); await handleDelivery(makeReq({ method: 'GET', path: ['cron', 'reminders'], headers }), res, { schedule: h.schedule }); return res; };
  assert.equal((await call({})).statusCode, 503);
  process.env.CRON_SECRET = 'cron-secret-for-tests-0123456789';
  assert.equal((await call({})).statusCode, 401);
  assert.equal((await call({ authorization: 'Bearer wrong' })).statusCode, 401);
  const ok = await call({ authorization: 'Bearer cron-secret-for-tests-0123456789' });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(Object.keys(ok.body).sort(), ['failed', 'notStarted', 'orders', 'payments', 'quiet', 'skipped']);
});
