// ── Client intake (the only part of the delivery system a client can reach) ──
//
// A client who has paid opens /intake?session_id=<their Stripe checkout session id>. That id is the key:
// it is long, random and only ever shown to the buyer, and it is re-checked with Stripe on every submit.
// The client can see and change ONLY their own order: their form, their questions, their answers.
// They never see the evidence ledger, findings, issues or anything about other candidates.
import { createHash } from 'node:crypto';
import { LIMITS, PACKAGES, isProd } from './config.js';
import { SESSION_ID, verifyStripeSession } from './payments.js';
import { PAYPAL_ORDER_ID } from '../paypal.js';
import { ServiceError, createCandidate, startProcessing, updateQuestion } from './service.js';
import { mailReady, sendDeliveryEmail } from './mail.js';

const DEMO = /^demo-[A-Za-z0-9]{8,40}$/; // local development only, never accepted in production
const MAX_ROUNDS = 3; // a client is never asked to answer more than this many rounds of questions

export function tokenOk(token) {
  const t = String(token || '');
  return SESSION_ID.test(t) || PAYPAL_ORDER_ID.test(t) || (!isProd() && DEMO.test(t));
}
const submissionKeyFor = (token) => 'intake-' + createHash('sha256').update(String(token)).digest('hex').slice(0, 40);
const isDemo = (token) => DEMO.test(String(token));

async function checkPayment(token) {
  if (isDemo(token)) return { ok: true, email: null, package: 'full_package', demo: true };
  const info = await verifyStripeSession(token);
  if (info.paymentStatus === 'verified_paid' || info.paymentStatus === 'manual_test') {
    return { ok: true, email: info.customerEmail, package: info.package, demo: false };
  }
  if (info.paymentStatus === 'not_verified') {
    return { ok: false, retry: true, message: 'We could not confirm your payment just now. Please try again in a minute.' };
  }
  return { ok: false, message: 'We could not find a completed payment for this link. If you have paid, email info@asovix.com and we will sort it straight away.' };
}

async function findCandidate(db, token) {
  const rows = await db.query('SELECT id, name, status, package FROM candidates WHERE submission_key = $1', [submissionKeyFor(token)]);
  return rows[0] || null;
}

/** What the client should see right now. Plain words only. */
export async function intakeState(db, token) {
  if (!tokenOk(token)) throw new ServiceError(404, 'This link does not look right. Open it from your confirmation page or email.');
  const c = await findCandidate(db, token);
  if (!c) {
    const pay = await checkPayment(token);
    if (!pay.ok) return { stage: pay.retry ? 'retry' : 'unpaid', message: pay.message };
    return { stage: 'form', email: pay.email || '', package: PACKAGES[pay.package] || null };
  }
  const firstName = c.name.split(/\s+/)[0];
  const running = (await db.query("SELECT 1 AS x FROM runs WHERE candidate_id = $1 AND status = 'running'", [c.id])).length > 0;
  if (running || c.status === 'received' || c.status === 'extracting') return { stage: 'working', firstName };
  const rounds = (await db.query("SELECT COUNT(*)::int AS n FROM runs WHERE candidate_id = $1 AND status = 'succeeded'", [c.id]))[0].n;
  const open = await db.query("SELECT id, text FROM questions WHERE candidate_id = $1 AND status = 'open' ORDER BY essential DESC, created_at LIMIT $2", [c.id, LIMITS.maxQuestions + 2]);
  if (c.status === 'awaiting_information' && open.length && rounds < MAX_ROUNDS) return { stage: 'questions', firstName, questions: open };
  if (c.status === 'failed') return { stage: 'received', firstName }; // Samuel sees the failure in his workspace; the client is simply told we have their details
  return { stage: 'complete', firstName };
}

export async function submitIntake(db, token, fields, file, schedule) {
  if (!tokenOk(token)) throw new ServiceError(404, 'This link does not look right.');
  const existing = await findCandidate(db, token);
  if (existing) return intakeState(db, token); // a double click or retry never creates a second candidate
  const pay = await checkPayment(token);
  if (!pay.ok) throw new ServiceError(pay.retry ? 503 : 402, pay.message);
  const email = String(fields.email || '').trim() || pay.email || '';
  let made;
  try {
    made = await createCandidate(db, {
      submissionKey: submissionKeyFor(token),
      name: fields.name, email, targetRole: fields.targetRole, location: fields.location, goal: fields.goal,
      package: pay.package || 'other',
      intakeAnswers: fields.extra ? `Extra detail from the client at intake:\n${String(fields.extra)}` : '',
      stripeSessionId: pay.demo ? '' : token, manualTest: pay.demo, file,
    }, schedule);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 409) throw new ServiceError(409, 'This order has already been started. If that was not you, email info@asovix.com.');
    throw e;
  }
  if (made && !made.duplicate) alertOwner(fields, schedule);
  return intakeState(db, token);
}

/** Best effort: tell Samuel a client has just completed intake. Never blocks or fails the client's request. */
function alertOwner(fields, schedule) {
  if (!mailReady() || !process.env.OWNER_EMAIL) return;
  const job = sendDeliveryEmail({
    to: process.env.OWNER_EMAIL,
    subject: `New client intake: ${String(fields.name || '').slice(0, 80)}`,
    text: `${String(fields.name || 'A client').slice(0, 80)} has just sent their CV and details through the intake page.
Target: ${String(fields.targetRole || '').slice(0, 120)} (${String(fields.location || '').slice(0, 80)}).
They will appear in your delivery workspace now; the first reading of their CV starts automatically.`,
  }).catch(() => {});
  if (schedule) schedule(job);
}

export async function submitAnswers(db, token, answers, schedule) {
  if (!tokenOk(token)) throw new ServiceError(404, 'This link does not look right.');
  const c = await findCandidate(db, token);
  if (!c) throw new ServiceError(404, 'We have not received your details yet.');
  let saved = 0;
  for (const a of Array.isArray(answers) ? answers.slice(0, 30) : []) {
    if (!a || typeof a.id !== 'string' || typeof a.answer !== 'string' || !a.answer.trim()) continue;
    // only this candidate's OPEN questions can be answered through this link
    const own = await db.query("SELECT 1 AS x FROM questions WHERE id = $1 AND candidate_id = $2 AND status = 'open'", [a.id, c.id]);
    if (!own.length) continue;
    await updateQuestion(db, c.id, a.id, { answer: a.answer });
    saved += 1;
  }
  if (saved) await startProcessing(db, c.id, 'rerun', schedule);
  return intakeState(db, token);
}
