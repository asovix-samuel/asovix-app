// ── The founder's home screen: four numbers and the orders that need a person ──
//
// Read-only. Built from the tables that already exist. Nothing here changes a candidate, a draft or a payment.
// Buckets: 'approve' (documents ready for Samuel), 'attention' (something failed or is blocked), 'progress' (the system or the
// client is working), 'done' (sent).

import { PACKAGES } from './config.js';

export const STAGES = ['Paid', 'Details received', 'Writing', 'Your approval', 'Sent'];

export function describe(row) {
  const open = row.open_questions || 0;
  const unpaid = row.payment_status && !['verified_paid', 'manual_test'].includes(row.payment_status);
  if (unpaid) return { stage: 0, bucket: 'attention', text: 'Payment is not confirmed. Nothing is done until PayPal confirms it.' };
  switch (row.status) {
    case 'delivered':
      return { stage: 4, bucket: 'done', text: 'Sent to the client.' };
    case 'in_review': {
      const failed = row.drafts_failed || 0;
      return { stage: 3, bucket: 'approve', text: failed ? `Documents ready to review. ${failed} could not be written and need a retry.` : 'Documents are ready for you to review and approve.' };
    }
    case 'writing':
      return { stage: 2, bucket: 'progress', text: 'Writing the documents now.' };
    case 'failed':
      return { stage: 1, bucket: 'attention', text: 'Reading the CV failed after automatic retries. Open it to check the file.' };
    case 'awaiting_information':
      return { stage: 1, bucket: 'progress', text: open ? `Waiting for the client to answer ${open} question${open === 1 ? '' : 's'}.` : 'Checking the details.' };
    case 'ready_for_positioning':
      return (row.drafts_failed || 0) > 0
        ? { stage: 2, bucket: 'attention', text: 'Writing failed after automatic retries. Open it to retry.' }
        : { stage: 2, bucket: 'progress', text: 'Everything needed is in. Writing starts automatically.' };
    default:
      return { stage: 1, bucket: 'progress', text: 'Reading the CV now.' };
  }
}

export async function getOverview(db) {
  const rows = await db.query(`
    SELECT c.id, c.name, c.target_role, c.location, c.package, c.status, c.updated_at, c.created_at,
           o.payment_status, o.amount_cents, o.currency,
           (SELECT COUNT(*)::int FROM questions q WHERE q.candidate_id = c.id AND q.status = 'open') AS open_questions,
           (SELECT COUNT(*)::int FROM drafts d WHERE d.candidate_id = c.id AND d.status = 'failed'
              AND d.version = (SELECT MAX(version) FROM drafts WHERE candidate_id = c.id)) AS drafts_failed
    FROM candidates c LEFT JOIN orders o ON o.id = c.order_id
    ORDER BY c.updated_at DESC`);
  const waiting = await db.query(`
    SELECT o.id, o.package, o.amount_cents, o.currency, o.created_at, o.customer_email
    FROM orders o LEFT JOIN candidates c ON c.order_id = o.id
    WHERE c.id IS NULL AND o.payment_status = 'verified_paid' ORDER BY o.created_at DESC`);
  const unserved = await db.query(`
    SELECT order_id, product, captured_at, fulfil_attempts FROM paypal_orders
    WHERE fulfilled_at IS NULL AND status = 'captured' AND captured_at < now() - interval '15 minutes'`);
  const rev = await db.query(`
    SELECT COALESCE(currency, 'eur') AS currency, COALESCE(SUM(amount_cents), 0)::int AS cents, COUNT(*)::int AS n,
           COALESCE(SUM(amount_cents) FILTER (WHERE created_at > now() - interval '30 days'), 0)::int AS cents30
    FROM orders WHERE payment_status = 'verified_paid' GROUP BY COALESCE(currency, 'eur')`);

  const items = rows.map((r) => {
    const d = describe(r);
    return {
      kind: 'order', id: r.id, name: r.name, subtitle: `${r.target_role} · ${r.location}`,
      package: PACKAGES[r.package] || r.package, amountCents: r.amount_cents, currency: r.currency || 'eur',
      isTest: r.payment_status === 'manual_test', stage: d.stage, bucket: d.bucket, text: d.text, updatedAt: r.updated_at,
    };
  });
  for (const w of waiting) {
    items.push({
      kind: 'waiting', id: w.id, name: w.customer_email || 'New customer', subtitle: 'Paid, details not sent yet',
      package: PACKAGES[w.package] || w.package || 'Order', amountCents: w.amount_cents, currency: w.currency || 'eur', isTest: false,
      stage: 0, bucket: 'progress', text: 'Paid. Waiting for the client to send their CV. A reminder goes out automatically.', updatedAt: w.created_at,
    });
  }
  for (const u of unserved) {
    items.push({
      kind: 'payment', id: u.order_id, name: 'A paid order', subtitle: 'Confirmation not sent', package: PACKAGES[u.product] || u.product || 'Order',
      isTest: false, stage: 0, bucket: 'attention', text: 'The customer has paid but their confirmation email did not go out. It is being retried automatically.', updatedAt: u.captured_at,
    });
  }
  const real = items.filter((i) => !i.isTest);
  const count = (b) => real.filter((i) => i.bucket === b).length;
  const r0 = rev[0] || { cents: 0, n: 0, cents30: 0, currency: 'eur' };
  return {
    stages: STAGES,
    items: items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    tiles: {
      revenue: { cents: r0.cents, currency: r0.currency, orders: r0.n, cents30: r0.cents30 },
      inProgress: count('progress'),
      awaitingApproval: count('approve'),
      needAttention: count('attention'),
      sent: count('done'),
    },
  };
}
