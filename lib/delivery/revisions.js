// ── Customer self-service revisions ──
//
// After documents are delivered, the client uses a private link (a random 32-character token, one per client) to:
//   - ask for a change of tone or wording            -> rewritten from the same verified evidence;
//   - correct something or add information           -> goes through the evidence process again (quotes verified), then rewritten;
//   - ask for the same CV adapted to another job     -> a new job-specific order (paid);
//   - and once the free rounds are used up, or the 7-day window has passed, pay the existing extra-round price.
// Every rewrite goes through the same checks and lands in Samuel's review queue. Nothing here emails the client documents:
// delivery still needs the owner's approval.
//
// Privacy: the token is the only key. Every query is scoped to the one candidate it belongs to, and the response never
// contains an email address, another client's data, or any internal id.

import { randomBytes, randomUUID } from 'node:crypto';
import { PACKAGES } from './config.js';
import { PRODUCTS } from '../checkout.js';
import { REVISION_WINDOW_DAYS, KIND_LABELS, clientFacing, revisionAllowance } from './writing/plan.js';
import { ServiceError, saveIntakeAnswers, startProcessing } from './service.js';
import { startRevision } from './writing/service.js';
import { alertOwner } from './alerts.js';

const TOKEN = /^[a-f0-9]{32}$/;
export const REVISION_TYPES = {
  tone: { label: 'Change the wording or tone', evidence: false },
  correction: { label: 'Correct something', evidence: true },
  new_info: { label: 'Add new information', evidence: true },
  adapt: { label: 'Adapt it for another job', evidence: false },
};
const MIN_TEXT = 10;
const MAX_TEXT = 4000;
const clean = (s, n) => String(s || '').replace(/\u0000/g, '').trim().slice(0, n);

export const newToken = () => randomBytes(16).toString('hex');

/** The private link token for a client; created the first time it is needed. */
export async function ensureClientToken(q, candidateId) {
  const row = (await q('SELECT client_token FROM candidates WHERE id = $1', [candidateId]))[0];
  if (!row) throw new ServiceError(404, 'Candidate not found.');
  if (row.client_token) return row.client_token;
  const token = newToken();
  const set = await q('UPDATE candidates SET client_token = $2 WHERE id = $1 AND client_token IS NULL RETURNING client_token', [candidateId, token]);
  return set.length ? token : (await q('SELECT client_token FROM candidates WHERE id = $1', [candidateId]))[0].client_token;
}

export const reviseLink = (token) => `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.asovix.com'}/revise?t=${token}`;

async function byToken(db, token) {
  if (!TOKEN.test(String(token || ''))) throw new ServiceError(404, 'This link does not look right. Open it from your delivery email.');
  const c = (await db.query('SELECT id, name, package, status FROM candidates WHERE client_token = $1', [token]))[0];
  if (!c) throw new ServiceError(404, 'This link does not look right. Open it from your delivery email.');
  return c;
}

/** Everything the revision page needs, and nothing else. */
export async function revisionState(db, token) {
  const c = await byToken(db, token);
  const q = db.query;
  const deliveries = await q('SELECT version, sent_at FROM deliveries WHERE candidate_id = $1 ORDER BY version', [c.id]);
  const firstName = c.name.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0];
  const base = { firstName, package: PACKAGES[c.package] || c.package, types: Object.entries(REVISION_TYPES).map(([id, t]) => ({ id, label: t.label })) };
  if (!deliveries.length) return { ...base, stage: 'not_ready', message: 'Your documents have not been sent yet. This page opens when they arrive.' };

  const windowEnds = new Date(new Date(deliveries[0].sent_at).getTime() + REVISION_WINDOW_DAYS * 24 * 3600 * 1000);
  const open = (await q("SELECT id, kind, status FROM revision_requests WHERE candidate_id = $1 AND status IN ('analysing','queued','awaiting_payment','started') ORDER BY created_at DESC LIMIT 1", [c.id]))[0];
  const usedFree = (await q("SELECT COUNT(*)::int AS n FROM revision_requests WHERE candidate_id = $1 AND paid = FALSE AND status IN ('analysing','queued','started','done')", [c.id]))[0].n;
  const allowance = revisionAllowance(c.package);
  const inWindow = Date.now() <= windowEnds.getTime();
  const freeLeft = inWindow ? Math.max(0, allowance - usedFree) : 0;
  const docs = (await q('SELECT DISTINCT kind FROM drafts WHERE candidate_id = $1', [c.id])).map((d) => d.kind).filter(clientFacing).map((k) => KIND_LABELS[k]);
  const working = open && open.status !== 'awaiting_payment';
  return {
    ...base,
    stage: working ? 'working' : 'open',
    documents: docs,
    freeLeft, allowance, windowEnds, inWindow,
    extraRoundPrice: PRODUCTS.revision_fee.amount / 100,
    adaptPrice: PRODUCTS.grad_cv.amount / 100,
    message: working ? 'We are working on your changes. You will get an email with the updated documents.' : '',
  };
}

function compose(type, text) {
  const label = REVISION_TYPES[type].label;
  return `The client asked: ${label}.\n${text}`;
}

/** Records a revision request. Free while rounds remain, otherwise returns a payment link. */
export async function submitRevision(db, token, { type, text } = {}, schedule) {
  const c = await byToken(db, token);
  const t = REVISION_TYPES[type];
  if (!t) throw new ServiceError(400, 'Choose what you would like to do.');
  if (type === 'adapt') {
    return { kind: 'buy', message: 'Adapting your CV for a different job is a new job-specific CV. It takes about two minutes to order, and you paste the new advert on the next page.', checkoutProduct: 'grad_cv', url: '/api/create-checkout', source: 'rv_adapt' };
  }
  const note = clean(text, MAX_TEXT);
  if (note.length < MIN_TEXT) throw new ServiceError(400, 'Tell us a little more about what you would like changed.');

  const state = await revisionState(db, token);
  if (state.stage === 'not_ready') throw new ServiceError(409, state.message);
  if (state.stage === 'working') throw new ServiceError(409, 'We are already working on your last request. You will get an email when it is ready.');

  const id = randomUUID().replace(/-/g, '').slice(0, 12);
  if (state.freeLeft > 0) {
    await db.query("INSERT INTO revision_requests (id, candidate_id, kind, text, paid, status) VALUES ($1,$2,$3,$4,FALSE,$5)", [id, c.id, type, note, t.evidence ? 'analysing' : 'queued']);
    await kick(db, id, schedule);
    return { kind: 'accepted', message: 'Thank you. We are updating your documents now and will email them to you.' };
  }
  // No free round left (or the window has passed): the client pays for an extra round, then it is processed automatically.
  await db.query("INSERT INTO revision_requests (id, candidate_id, kind, text, paid, status) VALUES ($1,$2,$3,$4,TRUE,'awaiting_payment')", [id, c.id, type, note]);
  const { createPayPalOrder } = await import('../paypal.js');
  const order = await createPayPalOrder({ product: 'revision_fee', source: `rv_${id}` });
  await db.query('UPDATE revision_requests SET paypal_order_id = $2 WHERE id = $1', [id, order.id]);
  return { kind: 'pay', message: `You have used your free changes. An extra round is €${state.extraRoundPrice}. After you pay, we update your documents automatically.`, url: order.url };
}

/** Moves one request on: evidence-type requests re-read the new information first; others go straight to rewriting. */
async function kick(db, requestId, schedule) {
  const r = (await db.query('SELECT * FROM revision_requests WHERE id = $1', [requestId]))[0];
  if (!r) return;
  if (REVISION_TYPES[r.kind].evidence) {
    const c = (await db.query('SELECT intake_answers FROM candidates WHERE id = $1', [r.candidate_id]))[0];
    const stamp = new Date().toISOString().slice(0, 10);
    const add = `Update from the client after delivery (${stamp}, ${REVISION_TYPES[r.kind].label.toLowerCase()}):\n${r.text}`;
    await saveIntakeAnswers(db, r.candidate_id, [c.intake_answers, add].filter(Boolean).join('\n\n'));
    await db.query("UPDATE revision_requests SET status = 'analysing' WHERE id = $1", [requestId]);
    const out = await startProcessing(db, r.candidate_id, 'rerun', schedule);
    if (!out.started && out.reason === 'unchanged') await rewrite(db, r, schedule);
    return; // when the re-reading finishes, the autopilot calls rewriteAnalysed()
  }
  await rewrite(db, r, schedule);
}

async function rewrite(db, r, schedule) {
  const claimed = await db.query("UPDATE revision_requests SET status = 'started', started_at = now() WHERE id = $1 AND status IN ('queued','analysing') RETURNING id", [r.id]);
  if (!claimed.length) return;
  try {
    await startRevision(db, r.candidate_id, compose(r.kind, r.text), schedule);
  } catch (e) {
    await db.query("UPDATE revision_requests SET status = 'queued' WHERE id = $1", [r.id]); // try again on the next sweep
    throw e;
  }
}

/** The autopilot calls this when a candidate's evidence has just been re-read: rewrite for any request waiting on it. */
export async function rewriteAnalysed(db, candidateId, schedule) {
  const rows = await db.query("SELECT * FROM revision_requests WHERE candidate_id = $1 AND status = 'analysing' ORDER BY created_at LIMIT 1", [candidateId]);
  if (!rows.length) return false;
  await rewrite(db, rows[0], schedule);
  return true;
}

/** Called after a payment is confirmed: the request is now free to run. */
export async function markRevisionPaid(db, source, schedule) {
  const m = /^rv_([a-f0-9]{12})$/.exec(String(source || ''));
  if (!m) return false;
  const r = (await db.query("UPDATE revision_requests SET status = 'queued' WHERE id = $1 AND status = 'awaiting_payment' RETURNING id", [m[1]]))[0];
  if (!r) return false;
  await kick(db, m[1], schedule);
  return true;
}

/** Safety net, run by the sweep: anything queued that has not started yet is started. */
export async function processRevisionQueue(db, schedule) {
  const rows = await db.query(
    `SELECT r.* FROM revision_requests r JOIN candidates c ON c.id = r.candidate_id
     WHERE r.status = 'queued' AND c.status IN ('delivered','in_review','ready_for_positioning') ORDER BY r.created_at LIMIT 10`);
  let n = 0;
  for (const r of rows) {
    try { await rewrite(db, r, schedule); n++; } catch (e) {
      await alertOwner(db, `revision:${r.id}`, 'A revision could not start', `Revision request ${r.id} could not be started: ${String(e.message || e).slice(0, 200)}`);
    }
  }
  return n;
}

/** When the owner sends the updated documents, the request that caused them is finished. */
export async function finishRevisionRequests(q, candidateId) {
  await q("UPDATE revision_requests SET status = 'done' WHERE candidate_id = $1 AND status = 'started'", [candidateId]);
}
