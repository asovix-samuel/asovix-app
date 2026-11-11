// ── Autopilot: moves every paid order forward without anyone pressing Continue ──
//
// One idempotent function, advance(), looks at where a client is and does the single next thing:
//   reading the CV  ->  (questions wait for the client)  ->  writing the documents  ->  tell Samuel it is ready to review.
// Nothing here approves or sends anything to a client: the final approval stays with Samuel.
// It is called (a) straight after the evidence analysis finishes, (b) by the scheduled sweep, and (c) opportunistically
// whenever the site is in use, so a failed job is picked up again without a person noticing.
//
// Safeguards: only orders whose payment is verified are worked on; at most DELIVERY_MAX_CONCURRENT AI jobs run at once
// (the rest wait their turn); every retry has a back-off and a ceiling; a person is emailed when something is stuck.
// Kill switch: set DELIVERY_AUTOPILOT=off in Vercel and everything goes back to manual buttons.

import { LIMITS } from './config.js';
import { nextAction, recoverInterrupted, startProcessing } from './service.js';
import { retryWriting, startWriting, recoverStale } from './writing/service.js';
import { alertOwner, claimEvery } from './alerts.js';
import { processRevisionQueue, rewriteAnalysed } from './revisions.js';

export const autopilotOn = () => String(process.env.DELIVERY_AUTOPILOT || 'on').toLowerCase() !== 'off';
export const maxConcurrent = () => Math.max(1, Number(process.env.DELIVERY_MAX_CONCURRENT) || 3);

const PAID = ['verified_paid', 'manual_test'];
const BACKOFF_MIN = [0, 3, 10, 30]; // minutes to wait before the 1st, 2nd, 3rd, 4th automatic retry
// How long to let the client answer the OPTIONAL questions (they are usually still on the intake page) before writing anyway.
const gapWaitMin = () => { const v = Number(process.env.DELIVERY_GAP_WAIT_MIN); return Number.isFinite(v) && process.env.DELIVERY_GAP_WAIT_MIN !== undefined && process.env.DELIVERY_GAP_WAIT_MIN !== '' ? v : 45; };
const NEEDS_CLIENT_ALERT_HOURS = 72;
const STUCK_MIN = 30;
const TEN_YEARS = 10 * 365 * 24 * 3600 * 1000;

const minutesSince = (t) => (Date.now() - new Date(t).getTime()) / 60000;

/** How many candidates have AI work in flight right now. */
export async function runningJobs(q) {
  const r = await q(`SELECT COUNT(*)::int AS n FROM (
      SELECT candidate_id FROM runs WHERE status = 'running' AND heartbeat_at > now() - ($1 || ' milliseconds')::interval
      UNION SELECT candidate_id FROM drafts WHERE status IN ('pending','writing') AND updated_at > now() - ($1 || ' milliseconds')::interval
    ) t`, [String(LIMITS.staleRunMs)]);
  return r[0].n;
}

async function needsYou(db, c, key, subject, text) {
  await alertOwner(db, `${key}:${c.id}`, subject, `${c.name} (${c.package}): ${text}`, { everyMs: 12 * 3600 * 1000 });
  return { action: 'needs_you' };
}

/**
 * Looks at one client and starts the next step if there is one. Returns { action, started? }.
 * Safe to call at any time, from anywhere, any number of times.
 */
export async function advance(db, candidateId, schedule, { force = false } = {}) {
  if (!autopilotOn() && !force) return { action: 'off' };
  const q = db.query;
  const c = (await q('SELECT c.*, o.payment_status FROM candidates c LEFT JOIN orders o ON o.id = c.order_id WHERE c.id = $1', [candidateId]))[0];
  if (!c) return { action: 'gone' };
  const age = minutesSince(c.updated_at);

  // Payment gate: an order linked to a payment that is not verified is never worked on.
  if (c.order_id && !PAID.includes(c.payment_status)) {
    await alertOwner(db, `unpaid:${c.id}`, 'Work is on hold: payment not verified',
      `${c.name} (${c.package}) has an order whose payment is "${c.payment_status}". Nothing will be done until PayPal confirms it.`, { everyMs: 24 * 3600 * 1000 });
    return { action: 'hold_unpaid' };
  }

  switch (c.status) {
    case 'received':
    case 'extracting':
    case 'failed': {
      const na = await nextAction(q, c.id);
      if (na.kind === 'running' || na.kind === 'unchanged') return { action: 'wait' };
      if (na.kind === 'limit') {
        return needsYou(db, c, 'ai-failed', 'Reading a CV failed repeatedly',
          'The AI could not read this CV after several automatic tries. Open the order: replace the file or check the error.');
      }
      const tries = LIMITS.maxRunAttempts - na.attemptsLeft;
      if (c.status !== 'received' && age < BACKOFF_MIN[Math.min(tries, BACKOFF_MIN.length - 1)]) return { action: 'backoff' };
      if ((await runningJobs(q)) >= maxConcurrent()) return { action: 'queued' };
      const r = await startProcessing(db, c.id, 'resume', schedule);
      return { action: 'analyse', started: !!r.started };
    }

    case 'awaiting_information': {
      // Waiting on the client. Nothing to start; just make sure a very long silence reaches Samuel.
      if (age > NEEDS_CLIENT_ALERT_HOURS * 60) {
        await alertOwner(db, `quiet:${c.id}`, 'A client has not answered their questions',
          `${c.name} (${c.package}) has been waiting on their own answers for over ${NEEDS_CLIENT_ALERT_HOURS} hours. An automatic reminder has been sent; you may want to message them.`, { everyMs: 48 * 3600 * 1000 });
      }
      return { action: 'wait_client' };
    }

    case 'ready_for_positioning': {
      const version = (await q('SELECT COALESCE(MAX(version), 0)::int AS v FROM drafts WHERE candidate_id = $1', [c.id]))[0].v;
      if (version === 0) {
        // Optional questions the client has not answered yet: give them a short window, then write with what we have.
        const gap = await q("SELECT created_at FROM questions WHERE candidate_id = $1 AND status = 'open' AND essential = FALSE ORDER BY created_at DESC LIMIT 1", [c.id]);
        if (gap.length && minutesSince(gap[0].created_at) < gapWaitMin()) return { action: 'wait_client_gap' };
        if ((await runningJobs(q)) >= maxConcurrent()) return { action: 'queued' };
        try {
          const r = await startWriting(db, c.id, {}, schedule);
          return { action: 'write', started: !!r.started };
        } catch (e) {
          return needsYou(db, c, 'write-blocked', 'Could not start writing', String(e && e.message || e).slice(0, 300));
        }
      }
      if (await rewriteAnalysed(db, c.id, schedule)) return { action: 'revise', started: true };
      return retryOrWait(db, c, schedule, age);
    }

    case 'writing': {
      await recoverStale(q, c.id); // a draft whose worker died is marked failed, then retried below
      const after = (await q('SELECT status FROM candidates WHERE id = $1', [c.id]))[0];
      if (after.status === 'writing') return { action: 'wait' };
      return retryOrWait(db, c, schedule, age);
    }

    case 'in_review':
      return retryOrWait(db, c, schedule, age);

    default:
      return { action: 'done' };
  }
}

/** In review (or back to ready after a failed write): retry failed drafts with back-off, else tell Samuel it is ready. */
async function retryOrWait(db, c, schedule, age) {
  const q = db.query;
  const v = (await q('SELECT COALESCE(MAX(version), 0)::int AS v FROM drafts WHERE candidate_id = $1', [c.id]))[0].v;
  const drafts = v ? await q('SELECT kind, status, attempts, error FROM drafts WHERE candidate_id = $1 AND version = $2', [c.id, v]) : [];
  const failed = drafts.filter((d) => d.status === 'failed');
  const ready = drafts.filter((d) => d.status === 'draft' || d.status === 'approved');
  const retryable = failed.filter((d) => d.attempts < 3);
  if (retryable.length) {
    const tries = Math.max(...retryable.map((d) => d.attempts));
    if (age < BACKOFF_MIN[Math.min(tries, BACKOFF_MIN.length - 1)]) return { action: 'backoff' };
    if ((await runningJobs(q)) >= maxConcurrent()) return { action: 'queued' };
    try {
      const r = await retryWriting(db, c.id, schedule);
      return { action: 'retry_write', started: !!r.started };
    } catch (e) {
      return needsYou(db, c, 'write-failed', 'Writing failed repeatedly', String(e && e.message || e).slice(0, 300));
    }
  }
  if (failed.length && !ready.length) {
    return needsYou(db, c, 'write-failed', 'Writing failed repeatedly',
      `The AI could not write the documents after several automatic tries (${String(failed[0].error || 'unknown error').slice(0, 200)}). Open the order and press Retry, or check the AI settings.`);
  }
  if (ready.length) {
    const warn = failed.length ? ` ${failed.length} document${failed.length === 1 ? '' : 's'} could not be written and need a retry.` : '';
    await alertOwner(db, `review:${c.id}:${v}`, `Ready for your review: ${c.name}`,
      `${c.name} (${c.package}): ${ready.length} document${ready.length === 1 ? ' is' : 's are'} ready for you to review and approve.${warn} Nothing is sent to the client until you approve it.`, { everyMs: TEN_YEARS, tag: 'Asovix' });
    return { action: 'review_ready' };
  }
  return { action: 'wait' };
}

/**
 * Picks up everything that needs a push. Called by the scheduled job and (throttled) whenever the site is in use.
 * Starts at most the free capacity's worth of AI jobs per call.
 */
export async function sweep(db, schedule) {
  if (!autopilotOn()) return { skipped: 'autopilot off' };
  await recoverInterrupted(db);
  await processRevisionQueue(db, schedule).catch((e) => console.error('revision queue:', e && e.message));
  const rows = await db.query(
    `SELECT c.id FROM candidates c LEFT JOIN orders o ON o.id = c.order_id
     WHERE c.status <> 'delivered' AND COALESCE(o.payment_status, 'manual_test') IN ('verified_paid','manual_test')
     ORDER BY c.created_at LIMIT 100`);
  const out = { looked: 0, started: 0, needsYou: 0, queued: 0, stuck: 0 };
  for (const r of rows) {
    out.looked++;
    const res = await advance(db, r.id, schedule);
    if (res.started) out.started++;
    if (res.action === 'needs_you') out.needsYou++;
    if (res.action === 'queued') out.queued++;
  }
  // Anything "working" for too long with nothing actually running is stuck: tell Samuel once.
  const stuck = await db.query(
    `SELECT c.id, c.name, c.package, c.status FROM candidates c
     WHERE c.status IN ('received','extracting','writing') AND c.updated_at < now() - ($1 || ' minutes')::interval
       AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.candidate_id = c.id AND r.status = 'running' AND r.heartbeat_at > now() - ($2 || ' milliseconds')::interval)
       AND NOT EXISTS (SELECT 1 FROM drafts d WHERE d.candidate_id = c.id AND d.status IN ('pending','writing') AND d.updated_at > now() - ($2 || ' milliseconds')::interval)`,
    [String(STUCK_MIN), String(LIMITS.staleRunMs)]);
  for (const s of stuck) {
    out.stuck++;
    await alertOwner(db, `stuck:${s.id}`, 'An order looks stuck',
      `${s.name} (${s.package}) has been "${s.status}" for over ${STUCK_MIN} minutes with nothing running. The system will keep retrying; open the order if it does not move.`, { everyMs: 6 * 3600 * 1000 });
  }
  return out;
}

/** Run the sweep at most once every few minutes, whenever something else touches the site. Never throws. */
export async function maybeSweep(db, schedule, everyMs = 3 * 60 * 1000) {
  try {
    if (!autopilotOn()) return;
    if (!(await claimEvery(db, 'sweep', everyMs))) return;
    const job = sweep(db, schedule).catch((e) => console.error('sweep failed:', e && e.message));
    if (schedule) schedule(job);
  } catch (e) { console.error('maybeSweep skipped:', e && e.message); }
}
