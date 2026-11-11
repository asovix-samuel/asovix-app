// Automatic order progression: reading, writing and "ready for review" with nobody pressing Continue.
// Also: retries with back-off and a ceiling, a concurrency cap, the payment gate, the kill switch, stuck-order recovery,
// and the guarantee that nothing is ever sent to a client without the owner's approval.
// Scripted AI, in-memory database, captured email. All people and employers are fictional.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, fakeProvider, key, goodExtraction } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { createCandidate } from '../../lib/delivery/service.js';
import { approveDraft, getDeliverablesView, sendDelivery, setMailerForTests } from '../../lib/delivery/writing/service.js';
import { advance, sweep, runningJobs } from '../../lib/delivery/autopilot.js';
import { setAlertSinkForTests } from '../../lib/delivery/alerts.js';

let h, outbox, alerts;
beforeEach(async () => {
  h = await harness();
  outbox = []; alerts = [];
  setMailerForTests(async (m) => { outbox.push(m); return { messageId: `<msg-${outbox.length}@test>` }; });
  setAlertSinkForTests((a) => alerts.push(a));
  process.env.DELIVERY_AUTOPILOT = 'on';
  delete process.env.DELIVERY_MAX_CONCURRENT;
  process.env.DELIVERY_RATE_LIMIT_DELAY_MS = '1';
  process.env.DELIVERY_GAP_WAIT_MIN = '0'; // most tests do not care about the optional-question window
});
afterEach(() => { setMailerForTests(null); setAlertSinkForTests(null); process.env.DELIVERY_AUTOPILOT = 'off'; });

const JOB_AD = 'Graduate Logistics Coordinator at Northwind Logistics, Cork. Coordinate dispatch, report weekly, use Excel. '.repeat(3);

async function make(over = {}) {
  const out = await createCandidate(h.db, {
    submissionKey: key(), name: 'Jordan Test', email: 'jordan.test@example.com', targetRole: 'Logistics Coordinator',
    location: 'Cork', goal: 'Move into a coordinator role', package: 'grad_cv', manualTest: true, jobAd: JOB_AD,
    file: { name: 'jordan-cv.pdf', bytes: await makeCvPdf() }, ...over,
  }, h.schedule);
  await h.idle();
  return out.candidateId;
}
const cand = async (id) => (await h.db.query('SELECT * FROM candidates WHERE id = $1', [id]))[0];
const drafts = (id) => h.db.query('SELECT kind, status, attempts FROM drafts WHERE candidate_id = $1 ORDER BY created_at', [id]);
const age = (id, mins) => h.db.query("UPDATE candidates SET updated_at = now() - ($2 || ' minutes')::interval WHERE id = $1", [id, String(mins)]);

test('a new order goes from CV upload to "ready for your review" with no button pressed, and nothing is sent to the client', async () => {
  fakeProvider();
  const id = await make();
  assert.equal((await cand(id)).status, 'in_review');
  const d = await drafts(id);
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, 'cv');
  assert.equal(d[0].status, 'draft');
  assert.equal((await h.db.query('SELECT COUNT(*)::int AS n FROM deliveries'))[0].n, 0);
  assert.equal(outbox.length, 0, 'no email to the client');
  const review = alerts.filter((a) => /Ready for your review/.test(a.subject));
  assert.equal(review.length, 1);
  assert.match(review[0].text, /Nothing is sent to the client until you approve/);
});

test('optional questions get a short window for the client to answer, then writing goes ahead anyway', async () => {
  fakeProvider();
  process.env.DELIVERY_AUTOPILOT = 'off';
  const id = await make();
  process.env.DELIVERY_AUTOPILOT = 'on';
  process.env.DELIVERY_GAP_WAIT_MIN = '45';
  assert.equal((await h.db.query("SELECT COUNT(*)::int AS n FROM questions WHERE candidate_id = $1 AND status = 'open' AND essential = FALSE", [id]))[0].n, 1);
  assert.deepEqual(await advance(h.db, id, h.schedule), { action: 'wait_client_gap' });
  assert.equal((await drafts(id)).length, 0);
  await h.db.query("UPDATE questions SET created_at = now() - interval '2 hours' WHERE candidate_id = $1", [id]);
  const r = await advance(h.db, id, h.schedule); await h.idle();
  assert.equal(r.action, 'write');
  assert.equal((await cand(id)).status, 'in_review');
});

test('essential questions are never skipped: the order waits for the client', async () => {
  fakeProvider({ extract: () => goodExtraction() });
  const id = await make();
  await h.db.query("UPDATE candidates SET status = 'awaiting_information', updated_at = now() WHERE id = $1", [id]);
  const r = await advance(h.db, id, h.schedule);
  assert.deepEqual(r, { action: 'wait_client' });
  assert.equal((await drafts(id)).length === 0 || (await cand(id)).status === 'awaiting_information', true);
});

test('the review notice is sent once, however many times the autopilot looks again', async () => {
  fakeProvider();
  const id = await make();
  await advance(h.db, id, h.schedule); await advance(h.db, id, h.schedule); await sweep(h.db, h.schedule);
  assert.equal(alerts.filter((a) => /Ready for your review/.test(a.subject)).length, 1);
});

test('the full package writes all its documents automatically', async () => {
  fakeProvider();
  const id = await make({ package: 'grad_package' });
  assert.equal((await cand(id)).status, 'in_review');
  assert.deepEqual((await drafts(id)).map((x) => x.kind), ['cv', 'linkedin', 'cover_letter']);
});

test('the kill switch stops all automatic work', async () => {
  fakeProvider();
  process.env.DELIVERY_AUTOPILOT = 'off';
  const id = await make();
  assert.equal((await cand(id)).status, 'ready_for_positioning');
  assert.deepEqual(await advance(h.db, id, h.schedule), { action: 'off' });
  assert.deepEqual(await sweep(h.db, h.schedule), { skipped: 'autopilot off' });
  assert.equal((await drafts(id)).length, 0);
});

test('a failed AI reading is retried automatically after a back-off, and finishes the order', async () => {
  const p = fakeProvider({ extractFails: 5 }); // all four tries inside the first run fail; the next run gets through
  const id = await make();
  assert.equal((await cand(id)).status, 'failed');
  assert.deepEqual(await advance(h.db, id, h.schedule), { action: 'backoff' }); // too soon
  await age(id, 10);
  const out = await sweep(h.db, h.schedule);
  await h.idle();
  assert.equal(out.started, 1);
  assert.equal((await cand(id)).status, 'in_review');
  assert.ok(p.seen.extract.length >= 3);
});

test('retries have a ceiling: after the maximum, it stops and the owner is told', async () => {
  const p = fakeProvider({ extractFails: 999 });
  const id = await make();
  for (let i = 0; i < 6; i++) { await age(id, 120); await sweep(h.db, h.schedule); await h.idle(); }
  const calls = p.seen.extract.length;
  for (let i = 0; i < 3; i++) { await age(id, 120); await sweep(h.db, h.schedule); await h.idle(); }
  assert.equal(p.seen.extract.length, calls, 'no further AI calls once the ceiling is reached');
  assert.equal((await cand(id)).status, 'failed');
  assert.ok(alerts.some((a) => /failed repeatedly/.test(a.subject)));
});

test('a draft whose worker died is recovered and written again', async () => {
  fakeProvider();
  const id = await make();
  // Simulate: the writing worker died an hour ago, leaving the draft stuck in "writing".
  await h.db.query("UPDATE drafts SET status = 'writing', updated_at = now() - interval '60 minutes' WHERE candidate_id = $1", [id]);
  await h.db.query("UPDATE candidates SET status = 'writing', updated_at = now() - interval '60 minutes' WHERE id = $1", [id]);
  const out = await sweep(h.db, h.schedule);
  await h.idle();
  assert.ok(out.started >= 1);
  assert.equal((await cand(id)).status, 'in_review');
  assert.equal((await drafts(id))[0].status, 'draft');
});

test('writing that keeps failing stops after the ceiling and tells the owner', async () => {
  const p = fakeProvider();
  p.writeDeliverable = async () => { throw new Error('503 overloaded'); };
  const id = await make();
  for (let i = 0; i < 8; i++) { await age(id, 120); await sweep(h.db, h.schedule); await h.idle(); }
  assert.notEqual((await cand(id)).status, 'in_review');
  assert.ok(alerts.some((a) => /Writing failed repeatedly/.test(a.subject)));
  const total = (await drafts(id))[0].attempts;
  assert.ok(total <= 3, `attempts capped at 3, got ${total}`);
});

test('an order whose payment is not verified is never worked on, until it is', async () => {
  fakeProvider();
  process.env.DELIVERY_AUTOPILOT = 'off';
  const id = await make();
  process.env.DELIVERY_AUTOPILOT = 'on';
  await h.db.query("UPDATE orders SET payment_status = 'not_verified' WHERE id = (SELECT order_id FROM candidates WHERE id = $1)", [id]);
  assert.deepEqual(await advance(h.db, id, h.schedule), { action: 'hold_unpaid' });
  assert.equal((await drafts(id)).length, 0);
  assert.ok(alerts.some((a) => /payment not verified/.test(a.subject)));
  await h.db.query("UPDATE orders SET payment_status = 'verified_paid' WHERE id = (SELECT order_id FROM candidates WHERE id = $1)", [id]);
  await advance(h.db, id, h.schedule); await h.idle();
  assert.equal((await cand(id)).status, 'in_review');
});

test('only a limited number of AI jobs run at once; the rest wait their turn', async () => {
  fakeProvider();
  process.env.DELIVERY_AUTOPILOT = 'off';
  const a = await make(); const b = await make();
  process.env.DELIVERY_AUTOPILOT = 'on';
  process.env.DELIVERY_MAX_CONCURRENT = '1';
  await h.db.query("INSERT INTO runs (id, candidate_id, input_hash, trigger, status) VALUES ($1, $2, 'x-busy', 'test', 'running')", [crypto.randomUUID(), a]);
  assert.equal(await runningJobs(h.db.query), 1);
  assert.deepEqual(await advance(h.db, b, h.schedule), { action: 'queued' });
  assert.equal((await drafts(b)).length, 0);
  await h.db.query("DELETE FROM runs WHERE input_hash = 'x-busy'");
  const r = await advance(h.db, b, h.schedule); await h.idle();
  assert.equal(r.action, 'write');
  assert.equal((await cand(b)).status, 'in_review');
});

test('documents are never emailed before payment is verified; a hand-added record needs an explicit yes', async () => {
  fakeProvider();
  const id = await make();
  const v = await getDeliverablesView(h.db, id);
  for (const d of v.drafts) await approveDraft(h.db, id, d.id, { override: true });
  const mail = { to: 'jordan.test@example.com', subject: 'Your CV', body: 'Here it is.' };
  await h.db.query("UPDATE orders SET payment_status = 'not_verified' WHERE id = (SELECT order_id FROM candidates WHERE id = $1)", [id]);
  await assert.rejects(() => sendDelivery(h.db, id, mail), /Payment is not verified/);
  assert.equal(outbox.length, 0);
  await h.db.query("UPDATE orders SET payment_status = 'verified_paid' WHERE id = (SELECT order_id FROM candidates WHERE id = $1)", [id]);
  const sent = await sendDelivery(h.db, id, mail);
  assert.equal(sent.ok, true);
  assert.equal(outbox.length, 1);

  // A record with no order at all: refused unless the owner explicitly confirms.
  const hand = await make({ manualTest: false });
  const v2 = await getDeliverablesView(h.db, hand);
  for (const d of v2.drafts) await approveDraft(h.db, hand, d.id, { override: true });
  await assert.rejects(() => sendDelivery(h.db, hand, mail), /no paid order linked/);
  assert.equal(outbox.length, 1);
  assert.equal((await sendDelivery(h.db, hand, { ...mail, allowUnlinked: true })).ok, true);
});
