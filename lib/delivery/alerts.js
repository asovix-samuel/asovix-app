// ── Owner alerts ──
//
// One short email to Samuel when something needs him: a payment that did not go through, an order that is stuck,
// AI work that failed. Throttled per key (default once every 6 hours) so a repeating fault is one email, not hundreds.
// Never puts secrets or full CV text in an email.

import { mailReady, sendDeliveryEmail } from './mail.js';

let sink = null;
/** Tests capture alerts instead of emailing. */
export function setAlertSinkForTests(fn) { sink = fn; }

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** True at most once per `everyMs` for this key (shared across all server instances, because it lives in the database). */
export async function claimEvery(db, key, everyMs) {
  const r = await db.query(
    `INSERT INTO alerts (key, last_sent, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET last_sent = now(), count = alerts.count + 1
     WHERE alerts.last_sent < now() - ($2 || ' milliseconds')::interval
     RETURNING key`, [key, String(everyMs)]);
  return r.length > 0;
}

export async function alertOwner(db, key, subject, text, { everyMs = SIX_HOURS, tag = 'Asovix alert' } = {}) {
  let first;
  try {
    first = (await claimEvery(db, key, everyMs)) ? [{ key }] : [];
  } catch (e) {
    console.error('alerts: could not record', key, e.message);
    first = [{ key }]; // if we cannot throttle, still tell the owner
  }
  if (!first.length) return { sent: false, throttled: true };
  const body = `${text}\n\nOpen the workspace: ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.asovix.com'}/delivery`;
  if (sink) { sink({ key, subject, text: body }); return { sent: true, sink: true }; }
  const to = process.env.OWNER_EMAIL;
  if (!to || !mailReady()) { console.error('ALERT (not emailed: no OWNER_EMAIL or SMTP):', subject); return { sent: false, reason: 'mail not configured' }; }
  try {
    await sendDeliveryEmail({ to, subject: `[${tag}] ${subject}`, text: body });
    return { sent: true };
  } catch (e) {
    console.error('alerts: email failed:', e.message);
    return { sent: false, reason: e.message };
  }
}
