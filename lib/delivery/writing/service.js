// ── Stage 2: writing, review, approval and delivery for ONE candidate ──
//
// Flow: ready_for_positioning → [Write drafts] → writing → in_review → [approve each] → [Send] → delivered
//       delivered → [Revise with the client's feedback] → writing → in_review → … (a new version each time)
//
// Every query is scoped by candidate id, like stage 1. Drafts are written one deliverable at a time and
// saved as each finishes, so a timeout loses at most the one in progress, and "Retry" picks up the rest.
// Nothing is ever emailed to a client without Samuel pressing Send on fully approved drafts.
import { randomUUID } from 'node:crypto';
import { LIMITS, PACKAGES } from '../config.js';
import { PermanentAiError, estimateCost, getProvider } from '../ai/provider.js';
import { ServiceError, requireCandidate } from '../service.js';
import { mailReady, sendDeliveryEmail } from '../mail.js';
import { KINDS, KIND_LABELS, REVISION_WINDOW_DAYS, clientFacing, deliverablesFor, revisionAllowance } from './plan.js';
import { SCHEMAS } from './schemas.js';
import { checkDraft, hasErrors, incompleteReason } from './checks.js';
import { fileNameFor, renderDocx } from './render.js';
import { renderPdf } from './renderPdf.js';
import { ensureMarket, getMarketView, marketForWriting } from '../market/service.js';

const UUID = /^[0-9a-f-]{36}$/i;
const one = async (q, sql, params) => (await q(sql, params))[0];
const clean = (s, max) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const MAX_DRAFT_ATTEMPTS = 3;

let mailer = sendDeliveryEmail;
let mailReadyCheck = mailReady;
/** Tests capture outgoing mail instead of sending it. Pass null to restore. */
export function setMailerForTests(fn) {
  mailer = fn || sendDeliveryEmail;
  mailReadyCheck = fn ? () => true : mailReady;
}

async function setStatus(q, id, to, detail) {
  const cur = await one(q, 'SELECT status FROM candidates WHERE id = $1', [id]);
  if (!cur) return;
  await q('UPDATE candidates SET status = $2, status_detail = $3, updated_at = now() WHERE id = $1', [id, to, detail]);
  if (cur.status !== to) await q('INSERT INTO status_events (candidate_id, from_status, to_status, note) VALUES ($1,$2,$3,$4)', [id, cur.status, to, detail]);
}

// ---------------------------------------------------------------- context
/** The verified evidence from the candidate's latest successful analysis, numbered e1, e2... for the writer. */
async function evidenceFor(q, candidateId, runId) {
  const rows = await q("SELECT category, claim, status, ownership, relevance, source_quote FROM claims WHERE run_id = $1 AND candidate_id = $2 AND status != 'unsupported' ORDER BY position", [runId, candidateId]);
  return rows.map((r, i) => ({ id: `e${i + 1}`, category: r.category, claim: r.claim, status: r.status, ownership: r.ownership, relevance: r.relevance, quote: r.source_quote || '' }));
}

async function writingContext(q, c) {
  const run = c.latest_run_id ? await one(q, "SELECT id, record, status FROM runs WHERE id = $1 AND candidate_id = $2", [c.latest_run_id, c.id]) : null;
  if (!run || run.status !== 'succeeded' || !run.record) throw new ServiceError(409, 'Finish the evidence analysis first: there is no completed analysis to write from.');
  const evidence = await evidenceFor(q, c.id, run.id);
  if (!evidence.length) throw new ServiceError(409, 'The analysis found no usable evidence to write from.');
  const docs = await q('SELECT segments FROM documents WHERE candidate_id = $1 AND active', [c.id]);
  const answers = await q("SELECT answer FROM questions WHERE candidate_id = $1 AND status = 'answered'", [c.id]);
  const sourceText = [
    ...docs.flatMap((d) => (d.segments || []).map((s) => s.text)),
    c.intake_answers || '',
    ...answers.map((a) => a.answer || ''),
  ].join('\n');
  return {
    runId: run.id,
    record: run.record,
    evidence,
    sourceText,
    jobAd: c.job_ad || '',
    market: await marketForWriting(q, c.id),
    candidate: { name: c.name, email: c.email, targetRole: c.target_role, location: c.location, goal: c.goal, package: c.package },
  };
}

async function latestVersion(q, candidateId) {
  return (await one(q, 'SELECT COALESCE(MAX(version), 0)::int AS v FROM drafts WHERE candidate_id = $1', [candidateId])).v;
}

/** A draft whose writer stopped (function timed out) is marked failed so it can be retried. */
async function recoverStale(q, candidateId) {
  const stale = await q("UPDATE drafts SET status = 'failed', error = $2, updated_at = now() WHERE candidate_id = $1 AND status = 'writing' AND updated_at < now() - ($3 || ' milliseconds')::interval RETURNING id",
    [candidateId, 'Interrupted before it finished. Press Retry.', String(LIMITS.staleRunMs)]);
  if (stale.length) await settle(q, candidateId);
}

/** After writing stops: in review if anything was written; otherwise back to ready with the reason. */
async function settle(q, candidateId) {
  const v = await latestVersion(q, candidateId);
  const rows = await q('SELECT kind, status, error FROM drafts WHERE candidate_id = $1 AND version = $2', [candidateId, v]);
  if (rows.some((r) => r.status === 'pending' || r.status === 'writing')) return;
  const done = rows.filter((r) => r.status === 'draft' || r.status === 'approved').length;
  const failed = rows.filter((r) => r.status === 'failed');
  if (done) {
    await setStatus(q, candidateId, 'in_review', failed.length
      ? `${done} draft${done === 1 ? '' : 's'} ready to review; ${failed.length} failed (press Retry).`
      : `Draft${done === 1 ? '' : 's'} ready to review.`);
  } else {
    await setStatus(q, candidateId, 'ready_for_positioning', `Writing failed: ${(failed[0] && failed[0].error) || 'unknown error'}. Press Retry.`);
  }
}

// ---------------------------------------------------------------- reading
export async function getDeliverablesView(db, candidateId) {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  await recoverStale(q, candidateId);
  const version = await latestVersion(q, candidateId);
  const drafts = version ? await q('SELECT * FROM drafts WHERE candidate_id = $1 AND version = $2', [candidateId, version]) : [];
  drafts.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  const deliveries = await q('SELECT id, version, sent_to, subject, files, sent_at, revision_due_at FROM deliveries WHERE candidate_id = $1 ORDER BY version DESC', [candidateId]);
  let evidence = [], roles = [];
  try {
    const ctx = await writingContext(q, c);
    evidence = ctx.evidence;
    roles = (ctx.record.roles || []).map((r, i) => ({ id: `r${i + 1}`, label: `${r.title} · ${r.employer}${r.start_text || r.end_text ? ` (${[r.start_text, r.end_text].filter(Boolean).join(' – ')})` : ''}` }));
  } catch (e) { /* not ready yet */ }
  const firstDelivery = deliveries[deliveries.length - 1];
  const revisionsUsed = firstDelivery ? (await one(q, 'SELECT COUNT(DISTINCT version)::int AS n FROM drafts WHERE candidate_id = $1 AND version > $2', [candidateId, firstDelivery.version])).n : 0;
  const allowance = revisionAllowance(c.package);
  const evidenceStale = drafts.length > 0 && drafts.some((d) => d.evidence_run_id && d.evidence_run_id !== c.latest_run_id);
  return {
    status: c.status,
    package: c.package,
    packageLabel: PACKAGES[c.package] || c.package,
    planned: deliverablesFor(c.package).map((k) => ({ kind: k, label: KIND_LABELS[k] })),
    jobAd: c.job_ad || '',
    market: await getMarketView(q, candidateId),
    version,
    drafts: drafts.map((d) => ({ ...d, label: KIND_LABELS[d.kind], clientFacing: clientFacing(d.kind), filename: fileNameFor(d.kind, c.name) })),
    evidence,
    roles,
    evidenceStale,
    deliveries,
    revisions: { used: revisionsUsed, allowance, windowEnds: deliveries[0] ? deliveries[0].revision_due_at : null },
    canWrite: ['ready_for_positioning', 'in_review', 'delivered'].includes(c.status),
    readyToSend: readyToSend(drafts, deliveries, version),
    email: defaultEmail(c, drafts, deliveries),
    mailReady: mailReadyCheck(),
  };
}

function readyToSend(drafts, deliveries, version) {
  if (!drafts.length || deliveries.some((d) => d.version === version)) return false;
  const facing = drafts.filter((d) => clientFacing(d.kind));
  return facing.length > 0 && facing.every((d) => d.status === 'approved');
}

function defaultEmail(c, drafts, deliveries) {
  const first = c.name.split(/\s+/)[0];
  const facing = drafts.filter((d) => clientFacing(d.kind));
  const isRevision = deliveries.length > 0;
  const list = facing.map((d) => `- ${KIND_LABELS[d.kind]}`).join('\n');
  const extraRound = revisionAllowance(c.package) > 1;
  const subject = isRevision ? `Your updated Asovix documents, ${first}` : `Your Asovix ${facing.length > 1 ? 'documents are' : `${KIND_LABELS[facing[0]?.kind || 'cv']} is`} ready, ${first}`;
  const body = isRevision
    ? `Hi ${first},

Here are your updated documents, with the changes you asked for:
${list}

If anything still doesn't feel right, just reply to this email.

Best of luck with your applications,
Samuel
Asovix`
    : `Hi ${first},

Your documents for ${c.target_role} roles are attached:
${list}

Everything in them comes from your own experience and answers. It's positioned so a recruiter sees, in the first few seconds, why you're worth an interview.

A few tips:
- Use this version for ${c.target_role} applications. If you apply for a different kind of role, tell me and we'll talk about adjusting it.
- Check your contact details and dates one last time before you send it anywhere.
- Apply soon and apply consistently. Positioning works best with volume.

You have ${extraRound ? 'two free rounds' : 'one free round'} of minor revisions within ${REVISION_WINDOW_DAYS} days. Just reply to this email with what you'd like changed.

Rooting for you,
Samuel
Asovix`;
  return { to: c.email || '', subject, body };
}

// ---------------------------------------------------------------- writing
/**
 * Starts a new version of drafts for the candidate's package (or `kinds`).
 * opts: { jobAd?, revisionNote?, kinds? }
 */
export async function startWriting(db, candidateId, opts = {}, schedule) {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  await recoverStale(q, candidateId);
  if (typeof opts.jobAd === 'string') await q('UPDATE candidates SET job_ad = $2, updated_at = now() WHERE id = $1', [candidateId, clean(opts.jobAd, 20000)]);
  if (await one(q, "SELECT 1 AS x FROM drafts WHERE candidate_id = $1 AND status IN ('pending','writing')", [candidateId])) {
    return { started: false, reason: 'running', message: 'Drafts are already being written for this candidate.' };
  }
  if (c.status === 'awaiting_information') throw new ServiceError(409, 'Essential questions are still open. Get the answers (or dismiss the questions) and finish the analysis before writing.');
  if (!['ready_for_positioning', 'in_review', 'delivered'].includes(c.status)) throw new ServiceError(409, 'This candidate is not ready for writing yet.');
  const fresh = await requireCandidate(q, candidateId);
  const ctx = await writingContext(q, fresh); // validates there is evidence to write from
  const kinds = (Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds.filter((k) => KINDS.includes(k)) : deliverablesFor(c.package));
  if (!kinds.length) throw new ServiceError(400, 'This package has nothing to write. Choose what to write.');
  const note = clean(opts.revisionNote, 8000);
  const version = (await latestVersion(q, candidateId)) + 1;
  try {
    await db.tx(async (t) => {
      for (const kind of kinds) {
        await t("INSERT INTO drafts (id, candidate_id, version, kind, evidence_run_id, status, revision_note) VALUES ($1,$2,$3,$4,$5,'pending',$6)",
          [randomUUID(), candidateId, version, kind, ctx.runId, note || null]);
      }
    });
  } catch (err) {
    if (/duplicate key|unique/i.test(String(err && err.message))) return { started: false, reason: 'running', message: 'Writing was just started.' };
    throw err;
  }
  await setStatus(q, candidateId, 'writing', note ? 'Writing a revision from the client’s feedback.' : `Writing ${kinds.map((k) => KIND_LABELS[k]).join(', ')}.`);
  const job = executeWriting(db, candidateId, version).catch((e) => console.error('writing job failed:', e));
  if (schedule) schedule(job);
  return { started: true, version };
}

/** Retries the failed drafts of the latest version. */
export async function retryWriting(db, candidateId, schedule) {
  const q = db.query;
  await requireCandidate(q, candidateId);
  await recoverStale(q, candidateId);
  const version = await latestVersion(q, candidateId);
  const failed = await q("SELECT id, attempts FROM drafts WHERE candidate_id = $1 AND version = $2 AND status = 'failed'", [candidateId, version]);
  if (!failed.length) return { started: false, reason: 'nothing', message: 'Nothing has failed, so there is nothing to retry.' };
  if (failed.every((d) => d.attempts >= MAX_DRAFT_ATTEMPTS)) throw new ServiceError(409, `These drafts have failed ${MAX_DRAFT_ATTEMPTS} times. Check the error, then write a new version.`);
  await q("UPDATE drafts SET status = 'pending', error = NULL, updated_at = now() WHERE candidate_id = $1 AND version = $2 AND status = 'failed' AND attempts < $3", [candidateId, version, MAX_DRAFT_ATTEMPTS]);
  await setStatus(q, candidateId, 'writing', 'Retrying the drafts that failed.');
  const job = executeWriting(db, candidateId, version).catch((e) => console.error('writing job failed:', e));
  if (schedule) schedule(job);
  return { started: true, version };
}

export async function executeWriting(db, candidateId, version) {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  await ensureMarket(db, candidateId); // real adverts first, when the feed is set up; never blocks writing
  const ctx = await writingContext(q, c);
  const previousVersion = version - 1;
  let provider;
  try {
    provider = await getProvider();
  } catch (err) {
    await q("UPDATE drafts SET status = 'failed', error = $3, updated_at = now() WHERE candidate_id = $1 AND version = $2 AND status = 'pending'", [candidateId, version, err.message.slice(0, 600)]);
    return settle(q, candidateId);
  }
  for (const kind of KINDS) {
    // Atomic claim: only one worker can move this draft from pending to writing.
    const d = await one(q, "UPDATE drafts SET status = 'writing', attempts = attempts + 1, updated_at = now() WHERE candidate_id = $1 AND version = $2 AND kind = $3 AND status = 'pending' RETURNING *", [candidateId, version, kind]);
    if (!d) continue;
    try {
      const prev = d.revision_note && previousVersion > 0 ? await one(q, 'SELECT content FROM drafts WHERE candidate_id = $1 AND version = $2 AND kind = $3', [candidateId, previousVersion, kind]) : null;
      let out;
      let gap = '';
      const tries = Math.max(3, LIMITS.aiAttempts);
      for (let attempt = 1; ; attempt++) {
        try {
          out = await provider.writeDeliverable({ kind, candidate: ctx.candidate, record: ctx.record, evidence: ctx.evidence, jobAd: ctx.jobAd, market: ctx.market, revisionNote: d.revision_note || '', previous: prev && prev.content });
          // The model sometimes leaves a whole section out. Ask again rather than hand Samuel half a document.
          gap = incompleteReason(kind, out.data);
          if (gap && attempt < tries) throw new Error(`incomplete draft: ${gap}`);
          break;
        } catch (e) {
          if (e instanceof PermanentAiError || attempt >= tries) throw e;
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      const checks = checkDraft(kind, out.data, ctx);
      if (gap) checks.unshift({ level: 'error', where: 'Draft', message: `${gap} Write this one again, or add the missing part by hand.` });
      await q("UPDATE drafts SET status = 'draft', content = $2::jsonb, checks = $3::jsonb, error = NULL, model = $4, input_tokens = $5, output_tokens = $6, cost_usd = $7, updated_at = now() WHERE id = $1",
        [d.id, JSON.stringify(out.data), JSON.stringify(checks), provider.model, out.usage?.inputTokens ?? null, out.usage?.outputTokens ?? null, out.usage ? estimateCost(out.usage) : null]);
    } catch (err) {
      await q("UPDATE drafts SET status = 'failed', error = $2, updated_at = now() WHERE id = $1", [d.id, String(err && err.message || err).slice(0, 600)]);
    }
  }
  await settle(q, candidateId);
}

// ---------------------------------------------------------------- review
async function requireDraft(q, candidateId, draftId) {
  const d = UUID.test(String(draftId)) ? await one(q, 'SELECT * FROM drafts WHERE id = $1 AND candidate_id = $2', [draftId, candidateId]) : null;
  if (!d) throw new ServiceError(404, 'Draft not found.');
  return d;
}

async function requireLatest(q, candidateId, d) {
  if (d.version !== (await latestVersion(q, candidateId))) throw new ServiceError(409, 'This is an older version. Work on the latest one.');
  if (await one(q, 'SELECT 1 AS x FROM deliveries WHERE candidate_id = $1 AND version = $2', [candidateId, d.version])) {
    throw new ServiceError(409, 'This version has already been sent to the client. Write a revision to change it.');
  }
}

/** Samuel's edits. The content must keep its shape; every check runs again on the edited text. */
export async function updateDraft(db, candidateId, draftId, content) {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  const d = await requireDraft(q, candidateId, draftId);
  await requireLatest(q, candidateId, d);
  if (d.status !== 'draft' && d.status !== 'approved') throw new ServiceError(409, 'Only a finished draft can be edited.');
  const parsed = SCHEMAS[d.kind].safeParse(content);
  if (!parsed.success) throw new ServiceError(400, `That edit does not fit the document's layout (${parsed.error.issues[0]?.path?.join('.') || 'top level'}).`);
  const ctx = await writingContext(q, c);
  const checks = checkDraft(d.kind, parsed.data, ctx);
  await q("UPDATE drafts SET content = $2::jsonb, checks = $3::jsonb, edited = TRUE, status = 'draft', approved_at = NULL, updated_at = now() WHERE id = $1", [d.id, JSON.stringify(parsed.data), JSON.stringify(checks)]);
  return { checks };
}

export async function approveDraft(db, candidateId, draftId, { override = false, unapprove = false } = {}) {
  const q = db.query;
  await requireCandidate(q, candidateId);
  const d = await requireDraft(q, candidateId, draftId);
  await requireLatest(q, candidateId, d);
  if (unapprove) {
    await q("UPDATE drafts SET status = 'draft', approved_at = NULL, updated_at = now() WHERE id = $1 AND status = 'approved'", [d.id]);
    return { ok: true };
  }
  if (d.status !== 'draft' && d.status !== 'approved') throw new ServiceError(409, 'Only a finished draft can be approved.');
  if (hasErrors(d.checks) && !override) throw new ServiceError(400, 'This draft still has problems marked in red. Fix them, or choose "Approve anyway" if you have checked them yourself.');
  await q("UPDATE drafts SET status = 'approved', approved_at = now(), updated_at = now() WHERE id = $1", [d.id]);
  return { ok: true };
}

export async function renderDraftFile(db, candidateId, draftId, format = 'docx') {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  const d = await requireDraft(q, candidateId, draftId);
  if (!d.content) throw new ServiceError(409, 'This draft has no content yet.');
  const run = await one(q, 'SELECT record FROM runs WHERE id = $1 AND candidate_id = $2', [d.evidence_run_id, candidateId]);
  const rctx = { candidate: { name: c.name, email: c.email, location: c.location, targetRole: c.target_role }, record: (run && run.record) || {} };
  if (format === 'pdf') return { filename: fileNameFor(d.kind, c.name, 'pdf'), bytes: await renderPdf(d.kind, d.content, rctx), mime: 'application/pdf' };
  return { filename: fileNameFor(d.kind, c.name), bytes: await renderDocx(d.kind, d.content, rctx), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

// ---------------------------------------------------------------- delivery
/** Emails the approved client-facing documents of the latest version. Only ever on Samuel's explicit Send. */
export async function sendDelivery(db, candidateId, { to, subject, body } = {}) {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  const version = await latestVersion(q, candidateId);
  const drafts = version ? await q('SELECT * FROM drafts WHERE candidate_id = $1 AND version = $2', [candidateId, version]) : [];
  const deliveries = await q('SELECT version FROM deliveries WHERE candidate_id = $1', [candidateId]);
  if (deliveries.some((d) => d.version === version)) throw new ServiceError(409, 'This version has already been sent.');
  if (!readyToSend(drafts, deliveries, version)) throw new ServiceError(409, 'Approve every client document before sending.');
  const recipient = clean(to || c.email, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new ServiceError(400, 'Add a valid email address for the client.');
  const subj = clean(subject, 200), text = clean(body, 20000);
  if (!subj || !text) throw new ServiceError(400, 'Write a subject and a message.');
  if (!mailReadyCheck()) throw new ServiceError(503, 'Email is not set up on the server (SMTP_USER and SMTP_PASS). Download the files and send them yourself, or add the settings in Vercel.');

  const facing = drafts.filter((d) => clientFacing(d.kind)).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  const attachments = [];
  // Every client document goes out as Word (to edit) and PDF (to send to employers).
  for (const d of facing) {
    for (const format of ['docx', 'pdf']) attachments.push(await renderDraftFile(db, candidateId, d.id, format).then((f) => ({ filename: f.filename, content: f.bytes })));
  }

  // Reserve the send first: the unique (candidate, version) row means a double click can never email twice.
  const deliveryId = randomUUID();
  const due = new Date(Date.now() + REVISION_WINDOW_DAYS * 24 * 3600 * 1000);
  try {
    await q('INSERT INTO deliveries (id, candidate_id, version, sent_to, subject, body, files, revision_due_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
      [deliveryId, candidateId, version, recipient, subj, text, JSON.stringify(attachments.map((a) => `${a.filename} (${a.content.length} bytes)`)), due]);
  } catch (err) {
    if (/duplicate key|unique/i.test(String(err && err.message))) throw new ServiceError(409, 'This version is already being sent.');
    throw err;
  }
  let info;
  try {
    info = await mailer({ to: recipient, subject: subj, text, attachments, replyTo: process.env.SMTP_USER });
  } catch (err) {
    await q('DELETE FROM deliveries WHERE id = $1', [deliveryId]);
    throw new ServiceError(502, `The email could not be sent (${String(err.message || err).slice(0, 200)}). Nothing was sent; try again.`);
  }
  await q('UPDATE deliveries SET message_id = $2 WHERE id = $1', [deliveryId, info && info.messageId || null]);
  const dueText = due.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  await setStatus(q, candidateId, 'delivered', `Sent to ${recipient}. Free revision window until ${dueText}.`);
  return { ok: true, sentTo: recipient, files: attachments.map((a) => a.filename), revisionDueAt: due };
}

/** A revision is a new version written from the previous one plus the client's feedback. */
export async function startRevision(db, candidateId, feedback, schedule) {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  const note = clean(feedback, 8000);
  if (!note) throw new ServiceError(400, 'Paste what the client asked to change.');
  const version = await latestVersion(q, candidateId);
  const kinds = (await q('SELECT kind FROM drafts WHERE candidate_id = $1 AND version = $2', [candidateId, version])).map((r) => r.kind);
  const out = await startWriting(db, candidateId, { revisionNote: note, kinds: kinds.length ? kinds : deliverablesFor(c.package) }, schedule);
  return out;
}
