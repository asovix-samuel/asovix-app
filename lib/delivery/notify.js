// ── Automatic emails to the CLIENT: new questions, and one gentle reminder ──
//
// Only ever sent to the address the client gave us, only for a verified paid order, and only once each
// (the sent time is stored). A failed send is retried at the next daily run. Nothing here emails anyone else.
import { mailReady, sendDeliveryEmail } from './mail.js';

const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'https://www.asovix.com';
export const intakeLink = (token) => `${APP()}/intake?session_id=${encodeURIComponent(token)}`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

let mailer = sendDeliveryEmail;
let ready = mailReady;
/** Tests capture outgoing mail. Pass null to restore. */
export function setNotifyMailerForTests(fn) { mailer = fn || sendDeliveryEmail; ready = fn ? () => true : mailReady; }

const SIGN = 'Thanks,\nSamuel\nAsovix';

/** The client's intake link: the payment reference of their paid order. Test orders and unpaid ones get no emails. */
async function paidOrderFor(q, candidateId) {
  const r = await q("SELECT o.stripe_session_id AS token FROM candidates c JOIN orders o ON o.id = c.order_id WHERE c.id = $1 AND o.payment_status = 'verified_paid' AND o.source <> 'manual_test'", [candidateId]);
  return r[0] ? r[0].token : null;
}

/** After the market research found gaps: ask the client the new questions, once. */
export async function emailClientQuestions(db, candidateId, count) {
  const q = db.query;
  if (!count || !ready()) return false;
  const c = (await q('SELECT id, name, email, questions_email_sent_at FROM candidates WHERE id = $1', [candidateId]))[0];
  if (!c || c.questions_email_sent_at || !EMAIL.test(c.email || '')) return false;
  const token = await paidOrderFor(q, candidateId);
  if (!token) return false;
  await mailer({
    to: c.email,
    subject: 'A few quick questions to make your CV stronger',
    text: `Hi ${first(c.name)},\n\nThanks for your details. I've now looked at real, current job adverts for the role you want, and I have ${count} short question${count === 1 ? '' : 's'} about things employers keep asking for. Your answers decide what goes at the top of your CV, so short, honest ones are perfect. If you haven't done something, just say so.\n\nAnswer here (about 5 minutes, works on your phone):\n${intakeLink(token)}\n\n${SIGN}`,
  });
  await q('UPDATE candidates SET questions_email_sent_at = now() WHERE id = $1', [candidateId]);
  await q('INSERT INTO status_events (candidate_id, from_status, to_status, note) SELECT id, status, status, $2 FROM candidates WHERE id = $1', [candidateId, `Emailed the client ${count} market question${count === 1 ? '' : 's'}.`]);
  return true;
}

/**
 * The daily run: one gentle reminder, once, to
 *  1. a buyer who paid but never filled in the form (24 hours to 14 days after paying), and
 *  2. a client with open questions who has gone quiet for 24 hours.
 * Returns { notStarted, quiet, failed } counts.
 */
export async function sendReminders(db, { limit = 25 } = {}) {
  const q = db.query;
  const out = { notStarted: 0, quiet: 0, failed: 0, skipped: 0 };
  if (!ready()) return { ...out, skipped: -1 };

  const unpaidForm = await q(`SELECT o.id, o.customer_email AS email, o.stripe_session_id AS token FROM orders o
    WHERE o.payment_status = 'verified_paid' AND o.source <> 'manual_test' AND o.customer_email IS NOT NULL AND o.reminder_sent_at IS NULL
      AND o.created_at < now() - interval '24 hours' AND o.created_at > now() - interval '14 days'
      AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.order_id = o.id) ORDER BY o.created_at LIMIT $1`, [limit]);
  for (const o of unpaidForm) {
    if (!EMAIL.test(o.email || '')) { out.skipped += 1; continue; }
    try {
      await mailer({
        to: o.email,
        subject: 'Your Asovix order: one step left',
        text: `Hi,\n\nThanks for your order. To start, I just need your CV and a few details about the job you want. It takes about 5 minutes and works on your phone:\n${intakeLink(o.token)}\n\nIf you'd rather send your CV by email, just reply to this message.\n\n${SIGN}`,
      });
      await q('UPDATE orders SET reminder_sent_at = now() WHERE id = $1', [o.id]);
      out.notStarted += 1;
    } catch (e) { out.failed += 1; console.error('reminder failed (not started):', e && e.message); }
  }

  const quiet = await q(`SELECT c.id, c.name, c.email, o.stripe_session_id AS token FROM candidates c JOIN orders o ON o.id = c.order_id
    WHERE c.status IN ('awaiting_information','ready_for_positioning') AND c.reminder_sent_at IS NULL
      AND o.payment_status = 'verified_paid' AND o.source <> 'manual_test' AND c.email IS NOT NULL
      AND EXISTS (SELECT 1 FROM questions x WHERE x.candidate_id = c.id AND x.status = 'open')
      AND GREATEST(c.updated_at, COALESCE(c.questions_email_sent_at, c.updated_at)) < now() - interval '24 hours'
      AND c.updated_at > now() - interval '14 days' ORDER BY c.updated_at LIMIT $1`, [limit]);
  for (const c of quiet) {
    if (!EMAIL.test(c.email || '')) { out.skipped += 1; continue; }
    try {
      await mailer({
        to: c.email,
        subject: 'Still need a few answers for your CV',
        text: `Hi ${first(c.name)},\n\nJust a gentle nudge. I'm ready to build your CV, and I'm waiting on a few short answers from you. Even rough ones help, and if you haven't done something, just say so:\n${intakeLink(c.token)}\n\n${SIGN}`,
      });
      await q('UPDATE candidates SET reminder_sent_at = now() WHERE id = $1', [c.id]);
      await q('INSERT INTO status_events (candidate_id, from_status, to_status, note) SELECT id, status, status, $2 FROM candidates WHERE id = $1', [c.id, 'Sent the client one gentle reminder.']);
      out.quiet += 1;
    } catch (e) { out.failed += 1; console.error('reminder failed (quiet):', e && e.message); }
  }
  return out;
}
