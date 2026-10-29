// ── Delivery workspace: application logic that touches storage ──
//
// Every function takes the database handle and a candidate id, and only ever reads or
// writes rows belonging to that candidate. That is what keeps candidates isolated:
// there is no query anywhere that mixes two candidates' facts, files or answers.
//
// Progress is saved at every step (run.step, run.evidence_checkpoint, heartbeat), so
// a run that times out or fails is RESUMED from where it stopped rather than restarted,
// and a new run after missing answers builds on the saved candidate state.

import { createHash, randomUUID } from 'node:crypto';
import { LIMITS, PACKAGES, PROMPT_VERSION } from './config.js';
import { PermanentAiError, getProvider } from './ai/provider.js';
import { ExtractionError, MIME, extractDocument, sniffKind } from './parsing/extract.js';
import { runPipeline } from './pipeline.js';
import { verifyStripeSession } from './payments.js';
import { deleteFile, loadFile, saveFile, storageNameFor } from './storage.js';

export class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const UUID = /^[0-9a-f-]{36}$/i;
const clean = (s, max) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const one = async (q, sql, params) => (await q(sql, params))[0];
const modelName = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// ---------------------------------------------------------------- status
async function setStatus(q, id, to, detail, latestRunId) {
  const cur = await one(q, 'SELECT status FROM candidates WHERE id = $1', [id]);
  if (!cur) return;
  await q('UPDATE candidates SET status = $2, status_detail = $3, updated_at = now(), latest_run_id = COALESCE($4, latest_run_id) WHERE id = $1', [id, to, detail, latestRunId || null]);
  if (cur.status !== to) await q('INSERT INTO status_events (candidate_id, from_status, to_status, note) VALUES ($1,$2,$3,$4)', [id, cur.status, to, detail]);
}

/** Awaiting information while an essential question is open, or an answer has not yet been through an analysis. */
async function settledStatus(q, candidateId) {
  const last = await one(q, "SELECT started_at FROM runs WHERE candidate_id = $1 AND status = 'succeeded' ORDER BY started_at DESC LIMIT 1", [candidateId]);
  const openEssential = (await one(q, "SELECT COUNT(*)::int AS n FROM questions WHERE candidate_id = $1 AND status = 'open' AND essential", [candidateId])).n;
  const unanalysed = last
    ? (await one(q, "SELECT COUNT(*)::int AS n FROM questions WHERE candidate_id = $1 AND status = 'answered' AND answered_at > $2", [candidateId, last.started_at])).n
    : 0;
  if (openEssential > 0) return { status: 'awaiting_information', detail: `${openEssential} essential question${openEssential === 1 ? '' : 's'} still open.` };
  if (unanalysed > 0) return { status: 'awaiting_information', detail: `${unanalysed} new answer${unanalysed === 1 ? '' : 's'} saved. Continue the analysis to include them.` };
  return { status: 'ready_for_positioning', detail: 'No essential information outstanding.' };
}

async function refreshStatus(q, candidateId) {
  const c = await requireCandidate(q, candidateId);
  if (c.status !== 'awaiting_information' && c.status !== 'ready_for_positioning') return;
  const s = await settledStatus(q, candidateId);
  if (s.status !== c.status || s.detail !== c.status_detail) await setStatus(q, candidateId, s.status, s.detail);
}

export async function requireCandidate(q, id) {
  if (!UUID.test(String(id))) throw new ServiceError(404, 'Candidate not found.');
  const c = await one(q, 'SELECT * FROM candidates WHERE id = $1', [id]);
  if (!c) throw new ServiceError(404, 'Candidate not found.');
  return c;
}

// ---------------------------------------------------------------- intake
/**
 * input: { submissionKey, name, email, targetRole, location, goal, package, intakeAnswers,
 *          stripeSessionId, manualTest, file: { name, bytes } }
 * The same submissionKey always returns the same candidate, so a double click or a retried
 * request can never create (or process) a candidate twice.
 */
export async function createCandidate(db, input, schedule) {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(input.submissionKey || ''))) throw new ServiceError(400, 'Missing submission key. Reload the form and try again.');
  const dup = await one(db.query, 'SELECT id FROM candidates WHERE submission_key = $1', [input.submissionKey]);
  if (dup) return { candidateId: dup.id, duplicate: true };

  const name = clean(input.name, 120), targetRole = clean(input.targetRole, 200), location = clean(input.location, 120), goal = clean(input.goal, 2000);
  const email = clean(input.email, 200) || null;
  if (!name) throw new ServiceError(400, 'Candidate name is required.');
  if (!targetRole) throw new ServiceError(400, 'Target role is required.');
  if (!location) throw new ServiceError(400, 'Location is required.');
  if (!goal) throw new ServiceError(400, "The client's goal is required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError(400, 'That email address does not look right.');
  let pkg = PACKAGES[input.package] ? input.package : null;
  if (!pkg) throw new ServiceError(400, 'Choose a package.');

  const bytes = input.file && input.file.bytes;
  if (!bytes || !bytes.length) throw new ServiceError(400, 'Attach the client’s original CV.');
  if (bytes.length > LIMITS.maxFileBytes) throw new ServiceError(400, `The file is larger than ${LIMITS.maxFileBytes / 1024 / 1024} MB.`);
  const kind = sniffKind(bytes, input.file.name);
  if (!kind) throw new ServiceError(400, 'Upload the original CV as a PDF or Word (.docx) file. Other types, and files renamed to look like these, are refused.');

  // Order link. Stripe is the only existing record of orders. "Paid" only if Stripe confirms it.
  let orderId = null;
  const sessionId = clean(input.stripeSessionId, 250);
  if (sessionId && input.manualTest) throw new ServiceError(400, 'Choose either a Stripe session or a manual test record, not both.');
  if (sessionId) {
    const known = await one(db.query, 'SELECT id FROM orders WHERE stripe_session_id = $1', [sessionId]);
    if (known) {
      const used = await one(db.query, 'SELECT name FROM candidates WHERE order_id = $1', [known.id]);
      if (used) throw new ServiceError(409, `That order is already linked to ${used.name}.`);
      orderId = known.id;
    } else {
      const info = await verifyStripeSession(sessionId);
      orderId = randomUUID();
      await db.query(
        'INSERT INTO orders (id, source, stripe_session_id, package, amount_cents, currency, customer_email, payment_status, payment_note, confirmation_flag, verified_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [orderId, info.provider || 'stripe', info.stripeSessionId, info.package, info.amountCents, info.currency, info.customerEmail, info.paymentStatus, info.note, info.confirmationFlag, info.paymentStatus === 'verified_paid' ? new Date() : null],
      );
      if (info.package) pkg = info.package; // what was actually bought wins over the form
    }
  } else if (input.manualTest) {
    orderId = randomUUID();
    await db.query('INSERT INTO orders (id, source, package, payment_status, payment_note) VALUES ($1,$2,$3,$4,$5)', [orderId, 'manual_test', pkg, 'manual_test', 'Manual test record. No payment was taken.']);
  }

  const candidateId = randomUUID();
  const docId = randomUUID();
  const storageName = storageNameFor(docId, kind);
  await saveFile(candidateId, storageName, bytes); // the original is stored BEFORE any row refers to it
  try {
    await db.tx(async (q) => {
      await q(
        'INSERT INTO candidates (id, submission_key, name, email, target_role, location, goal, package, intake_answers, order_id, status, job_ad) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [candidateId, input.submissionKey, name, email, targetRole, location, goal, pkg, clean(input.intakeAnswers, 20000), orderId, 'received', clean(input.jobAd, 20000)],
      );
      await q('INSERT INTO documents (id, candidate_id, filename, mime, size_bytes, sha256, storage_name) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [docId, candidateId, clean(input.file.name.replace(/[\\/]/g, '_'), 200), MIME[kind], bytes.length, createHash('sha256').update(bytes).digest('hex'), storageName]);
      await q('INSERT INTO status_events (candidate_id, from_status, to_status, note) VALUES ($1,$2,$3,$4)', [candidateId, null, 'received', 'Submission received']);
    });
  } catch (err) {
    await deleteFile(candidateId, storageName).catch(() => {});
    const winner = await one(db.query, 'SELECT id FROM candidates WHERE submission_key = $1', [input.submissionKey]);
    if (winner) return { candidateId: winner.id, duplicate: true }; // lost a race with an identical submission
    throw err;
  }
  if (schedule) await startProcessing(db, candidateId, 'intake', schedule);
  return { candidateId, duplicate: false };
}

export async function replaceDocument(db, candidateId, file) {
  await requireCandidate(db.query, candidateId);
  const kind = file && file.bytes && sniffKind(file.bytes, file.name);
  if (!kind || !file.bytes.length || file.bytes.length > LIMITS.maxFileBytes) throw new ServiceError(400, 'Upload a PDF or Word (.docx) file under 4 MB.');
  const docId = randomUUID();
  const storageName = storageNameFor(docId, kind);
  await saveFile(candidateId, storageName, file.bytes);
  await db.tx(async (q) => {
    await q('UPDATE documents SET active = FALSE WHERE candidate_id = $1', [candidateId]);
    await q('INSERT INTO documents (id, candidate_id, filename, mime, size_bytes, sha256, storage_name) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [docId, candidateId, clean(file.name.replace(/[\\/]/g, '_'), 200), MIME[kind], file.bytes.length, createHash('sha256').update(file.bytes).digest('hex'), storageName]);
  });
  return docId;
}

/** The candidate id is part of the lookup: a document id belonging to anyone else matches nothing. */
export async function getDocumentForDownload(db, candidateId, documentId) {
  if (!UUID.test(String(candidateId)) || !UUID.test(String(documentId))) return null;
  return (await one(db.query, 'SELECT * FROM documents WHERE id = $1 AND candidate_id = $2', [documentId, candidateId])) || null;
}
export const readDocumentBytes = (doc) => loadFile(doc.candidate_id, doc.storage_name);

// ---------------------------------------------------------------- reading
export async function listCandidates(db) {
  await recoverInterrupted(db);
  return db.query(`
    SELECT c.id, c.name, c.target_role, c.location, c.package, c.status, c.status_detail, c.created_at, c.updated_at,
           o.payment_status, o.source AS order_source,
           (SELECT COUNT(*)::int FROM questions q WHERE q.candidate_id = c.id AND q.status = 'open') AS open_questions
    FROM candidates c LEFT JOIN orders o ON o.id = c.order_id
    ORDER BY c.updated_at DESC`);
}

export async function getCandidateView(db, candidateId) {
  await recoverInterrupted(db);
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  const { submission_key, ...candidate } = c; // eslint-disable-line no-unused-vars
  const order = c.order_id ? (await one(q, 'SELECT * FROM orders WHERE id = $1', [c.order_id])) || null : null;
  const documents = await q('SELECT id, filename, mime, size_bytes, active, extraction_status, extraction_error, page_count, warnings, created_at FROM documents WHERE candidate_id = $1 ORDER BY created_at', [candidateId]);
  const runs = await q('SELECT id, trigger, status, step, attempts, error, provider, model, input_tokens, output_tokens, cost_usd, started_at, finished_at, duration_ms FROM runs WHERE candidate_id = $1 ORDER BY started_at DESC LIMIT 20', [candidateId]);
  const latest = c.latest_run_id ? await one(q, 'SELECT * FROM runs WHERE id = $1 AND candidate_id = $2', [c.latest_run_id, candidateId]) : undefined;
  const claims = latest ? await q('SELECT cl.*, d.filename AS source_filename FROM claims cl LEFT JOIN documents d ON d.id = cl.document_id AND d.candidate_id = cl.candidate_id WHERE cl.run_id = $1 AND cl.candidate_id = $2 ORDER BY cl.position', [latest.id, candidateId]) : [];
  const findings = latest ? await q("SELECT * FROM findings WHERE run_id = $1 AND candidate_id = $2 ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END", [latest.id, candidateId]) : [];
  const questions = await q("SELECT * FROM questions WHERE candidate_id = $1 AND status != 'superseded' ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END, essential DESC, created_at", [candidateId]);
  const pendingAnswers = latest ? (await one(q, "SELECT COUNT(*)::int AS n FROM questions WHERE candidate_id = $1 AND status = 'answered' AND answered_at > $2", [candidateId, latest.started_at])).n : 0;
  const events = await q('SELECT at, from_status, to_status, note FROM status_events WHERE candidate_id = $1 ORDER BY id DESC LIMIT 12', [candidateId]);
  const { record, evidence_checkpoint, ...latestRun } = latest || {}; // eslint-disable-line no-unused-vars
  const next = await nextAction(q, candidateId);
  return {
    candidate, order, documents, runs,
    running: runs[0] ? runs[0].status === 'running' : false,
    latestRun: latest ? { ...latestRun, record } : null,
    claims, findings, questions, pendingAnswers, events, next,
  };
}

// ---------------------------------------------------------------- processing (resumable)
const activeDocs = (q, candidateId) => q('SELECT * FROM documents WHERE candidate_id = $1 AND active ORDER BY created_at', [candidateId]);
const answeredQuestions = (q, candidateId) => q("SELECT id, text, answer, linked_keys FROM questions WHERE candidate_id = $1 AND status = 'answered' AND answer IS NOT NULL AND answer != '' ORDER BY created_at, id", [candidateId]);

export async function inputHash(q, candidateId) {
  const c = await requireCandidate(q, candidateId);
  const payload = {
    v: PROMPT_VERSION,
    model: modelName(),
    c: [c.name, c.email, c.target_role, c.location, c.goal, c.intake_answers],
    d: (await activeDocs(q, candidateId)).map((d) => d.sha256).sort(),
    a: (await answeredQuestions(q, candidateId)).map((x) => [x.id, x.text, x.answer]),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** What the "Continue" button will do right now, so the UI can label it truthfully. */
export async function nextAction(q, candidateId) {
  const hash = await inputHash(q, candidateId);
  const run = await one(q, 'SELECT status, attempts FROM runs WHERE candidate_id = $1 AND input_hash = $2', [candidateId, hash]);
  if (!run) return { kind: 'start', attemptsLeft: LIMITS.maxRunAttempts };
  if (run.status === 'running') return { kind: 'running', attemptsLeft: 0 };
  if (run.status === 'succeeded') return { kind: 'unchanged', attemptsLeft: 0 };
  return { kind: run.attempts >= LIMITS.maxRunAttempts ? 'limit' : 'resume', attemptsLeft: Math.max(0, LIMITS.maxRunAttempts - run.attempts) };
}

/** A run whose heartbeat stopped (function timed out, restarted) is marked failed, and stays resumable. */
export async function recoverInterrupted(db) {
  const stale = await db.query("UPDATE runs SET status = 'failed', error = $1, finished_at = now() WHERE status = 'running' AND heartbeat_at < now() - ($2 || ' milliseconds')::interval RETURNING id, candidate_id", [
    'Interrupted: the process stopped before this finished. Progress up to the last completed step is saved. Press Continue to resume.', String(LIMITS.staleRunMs)]);
  for (const r of stale) {
    const c = await one(db.query, 'SELECT status FROM candidates WHERE id = $1', [r.candidate_id]);
    if (c && (c.status === 'extracting' || c.status === 'received')) await setStatus(db.query, r.candidate_id, 'failed', 'Interrupted before finishing. Progress is saved; press Continue to resume.');
  }
}

/**
 * Starts (or resumes) the analysis for the candidate's CURRENT inputs.
 * schedule(promise) keeps the work alive after the HTTP response (waitUntil on Vercel).
 */
export async function startProcessing(db, candidateId, trigger, schedule) {
  await recoverInterrupted(db);
  const q = db.query;
  await requireCandidate(q, candidateId);
  if (await one(q, "SELECT 1 AS x FROM runs WHERE candidate_id = $1 AND status = 'running'", [candidateId])) {
    return { started: false, reason: 'running', message: 'An analysis is already running for this candidate.' };
  }
  const hash = await inputHash(q, candidateId);
  const existing = await one(q, 'SELECT * FROM runs WHERE candidate_id = $1 AND input_hash = $2', [candidateId, hash]);
  let runId;
  if (existing) {
    if (existing.status === 'succeeded') return { started: false, reason: 'unchanged', message: 'Nothing has changed since the last analysis, so there is nothing new to process.' };
    if (existing.status === 'running') return { started: false, reason: 'running', message: 'An analysis is already running for this candidate.' };
    if (existing.attempts >= LIMITS.maxRunAttempts) {
      return { started: false, reason: 'retry_limit', message: `This has failed ${existing.attempts} times with the same input. Change something (replace the file, edit an answer) or check the error shown before trying again.` };
    }
    // Atomic claim: only one caller can move failed -> running.
    const claimed = await one(q, "UPDATE runs SET status = 'running', attempts = attempts + 1, error = NULL, finished_at = NULL, heartbeat_at = now(), trigger = $2 WHERE id = $1 AND status = 'failed' RETURNING id", [existing.id, trigger === 'intake' ? 'intake' : 'resume']);
    if (!claimed) return { started: false, reason: 'running', message: 'An analysis is already running for this candidate.' };
    runId = existing.id;
  } else {
    runId = randomUUID();
    try {
      await q("INSERT INTO runs (id, candidate_id, input_hash, trigger, status) VALUES ($1,$2,$3,$4,'running')", [runId, candidateId, hash, trigger]);
    } catch (err) {
      if (err && err.code === '23505' || /duplicate key|unique/i.test(String(err && err.message))) {
        return { started: false, reason: 'running', message: 'An identical analysis was just started.' };
      }
      throw err;
    }
  }
  await setStatus(q, candidateId, 'extracting', existing ? 'Resuming from the last saved step.' : 'Reading the documents and extracting evidence.');
  const job = executeRun(db, runId).catch(() => {});
  if (schedule) schedule(job);
  return { started: true, runId };
}

async function ensureExtracted(q, candidateId, doc) {
  if (doc.extraction_status === 'done') return { id: doc.id, filename: doc.filename, segments: doc.segments };
  const bytes = await loadFile(candidateId, doc.storage_name);
  const kind = sniffKind(bytes, doc.filename);
  try {
    if (!kind) throw new ExtractionError('The stored file is not a readable PDF or DOCX.');
    const ex = await extractDocument(bytes, kind);
    await q("UPDATE documents SET extraction_status = 'done', extraction_error = NULL, page_count = $3, segments = $4::jsonb, warnings = $5::jsonb WHERE id = $1 AND candidate_id = $2",
      [doc.id, candidateId, ex.pageCount, JSON.stringify(ex.segments), JSON.stringify(ex.warnings)]);
    return { id: doc.id, filename: doc.filename, segments: ex.segments };
  } catch (err) {
    if (err instanceof ExtractionError) await q("UPDATE documents SET extraction_status = 'failed', extraction_error = $3 WHERE id = $1 AND candidate_id = $2", [doc.id, candidateId, err.message]);
    throw err;
  }
}

const beat = (q, runId, step) => q('UPDATE runs SET heartbeat_at = now(), step = COALESCE($2, step) WHERE id = $1', [runId, step || null]);

export async function executeRun(db, runId) {
  const q = db.query;
  const t0 = Date.now();
  let provider = null;
  const run = await one(q, 'SELECT * FROM runs WHERE id = $1', [runId]);
  const candidateId = run.candidate_id;
  try {
    const c = await requireCandidate(q, candidateId);
    await beat(q, runId, 'extract');
    const docs = [];
    for (const d of await activeDocs(q, candidateId)) docs.push(await ensureExtracted(q, candidateId, d));

    provider = await getProvider();
    const answered = (await answeredQuestions(q, candidateId)).map((x) => ({ text: x.text, answer: x.answer, linkedKeys: x.linked_keys || [] }));
    const result = await runPipeline(
      {
        candidate: { name: c.name, email: c.email, targetRole: c.target_role, location: c.location, goal: c.goal },
        documents: docs, intakeAnswers: c.intake_answers, answered,
      },
      provider,
      {
        checkpoint: run.evidence_checkpoint || null,
        onStep: (step) => beat(q, runId, step),
        onCheckpoint: (data) => q('UPDATE runs SET evidence_checkpoint = $2::jsonb, heartbeat_at = now() WHERE id = $1', [runId, JSON.stringify(data)]),
        onCall: async (call) => {
          await q('INSERT INTO ai_calls (id, run_id, candidate_id, operation, attempt, model, input_tokens, output_tokens, cost_usd, latency_ms, success, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
            [randomUUID(), runId, candidateId, call.operation, call.attempt, call.model, call.usage.inputTokens, call.usage.outputTokens, call.costUsd, call.latencyMs, call.success, call.error]);
          await beat(q, runId);
        },
      },
    );
    await persistSuccess(db, candidateId, runId, result, provider, Date.now() - t0, docs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const u = await usageTotals(q, runId);
    await q("UPDATE runs SET status = 'failed', error = $2, provider = $3, model = $4, input_tokens = $5, output_tokens = $6, cost_usd = $7, finished_at = now(), duration_ms = COALESCE(duration_ms, 0) + $8 WHERE id = $1",
      [runId, message.slice(0, 800), provider && provider.name, provider && provider.model, u.input, u.output, u.cost, Date.now() - t0]);
    const retryable = !(err instanceof ExtractionError || err instanceof PermanentAiError);
    await setStatus(q, candidateId, 'failed', `${message.slice(0, 400)}${retryable ? ' Progress is saved; press Continue to resume.' : ''}`);
  }
}

async function usageTotals(q, runId) {
  const r = await one(q, 'SELECT SUM(input_tokens)::int AS i, SUM(output_tokens)::int AS o, SUM(cost_usd) AS c FROM ai_calls WHERE run_id = $1 AND success', [runId]);
  return { input: r.i, output: r.o, cost: r.c };
}

async function persistSuccess(db, candidateId, runId, r, provider, attemptMs, docs) {
  const u = await usageTotals(db.query, runId);
  await db.tx(async (q) => {
    for (const [i, cl] of r.claims.entries()) {
      await q('INSERT INTO claims (id, run_id, candidate_id, category, claim, status, status_reason, relevance, relevance_note, ownership, document_id, source_page, source_section, source_quote, source_kind, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
        [randomUUID(), runId, candidateId, cl.category, cl.claim, cl.status, cl.statusReason, cl.relevance, cl.relevanceNote, cl.ownership,
          cl.location && docs.some((d) => d.id === cl.location.documentId) ? cl.location.documentId : null,
          cl.location ? cl.location.page : null, cl.location ? cl.location.section : null, cl.quote, cl.sourceKind, i]);
    }
    for (const f of r.findings) {
      await q('INSERT INTO findings (id, run_id, candidate_id, fkey, kind, severity, essential, addressed, title, detail, evidence, origin) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)',
        [randomUUID(), runId, candidateId, f.key, f.kind, f.severity, f.essential, f.addressed, f.title, f.detail, JSON.stringify(f.evidence), f.origin]);
    }
    await reconcileQuestions(q, candidateId, runId, r);
    await q("UPDATE runs SET status = 'succeeded', step = 'done', provider = $2, model = $3, input_tokens = $4, output_tokens = $5, cost_usd = $6, finished_at = now(), duration_ms = COALESCE(duration_ms, 0) + $7, record = $8::jsonb, error = NULL WHERE id = $1",
      [runId, provider.name, provider.model, u.input, u.output, u.cost, attemptMs, JSON.stringify(r.record)]);
    const s = await settledStatus(q, candidateId);
    await setStatus(q, candidateId, s.status, s.detail, runId);
  });
}

async function reconcileQuestions(q, candidateId, runId, r) {
  const existing = await q('SELECT * FROM questions WHERE candidate_id = $1', [candidateId]);
  const byTopic = new Map(existing.map((x) => [x.topic_key, x]));
  const drafted = new Set();
  for (const d of r.questions) {
    drafted.add(d.topicKey);
    const ex = byTopic.get(d.topicKey);
    if (!ex) {
      await q("INSERT INTO questions (id, candidate_id, topic_key, text, why, linked_keys, essential, status, created_run_id) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'open',$8)",
        [randomUUID(), candidateId, d.topicKey, d.text, d.why, JSON.stringify(d.linkedKeys), d.essential, runId]);
    } else if (ex.status === 'answered' || ex.status === 'dismissed') {
      continue; // never re-ask what the client has answered or Samuel has dismissed
    } else {
      await q("UPDATE questions SET text = $2, why = $3, linked_keys = $4::jsonb, essential = $5, status = 'open', updated_at = now() WHERE id = $1",
        [ex.id, ex.edited ? ex.text : d.text, d.why, JSON.stringify(d.linkedKeys), d.essential]);
    }
  }
  for (const ex of existing) {
    if (ex.status === 'open' && !ex.manual && !ex.edited && !drafted.has(ex.topic_key)) {
      await q("UPDATE questions SET status = 'superseded', updated_at = now() WHERE id = $1", [ex.id]);
    }
  }
}

// ---------------------------------------------------------------- questions & answers
async function requireQuestion(q, candidateId, questionId) {
  const row = UUID.test(String(questionId)) ? await one(q, 'SELECT * FROM questions WHERE id = $1 AND candidate_id = $2', [questionId, candidateId]) : null;
  if (!row) throw new ServiceError(404, 'Question not found.');
  return row;
}

/** patch: { text?, answer?, dismissed?, reopen? }. Saving never starts an analysis; "Continue" does. */
export async function updateQuestion(db, candidateId, questionId, patch) {
  const q = db.query;
  await requireCandidate(q, candidateId);
  const row = await requireQuestion(q, candidateId, questionId);
  let { text, status, answer, edited, answered_at } = row;
  if (typeof patch.text === 'string') {
    const t = clean(patch.text, 1000);
    if (!t) throw new ServiceError(400, 'A question cannot be empty.');
    if (t !== row.text) { text = t; edited = true; }
  }
  if (typeof patch.answer === 'string') {
    const a = clean(patch.answer, 8000);
    if (a) { answer = a; status = 'answered'; if (a !== row.answer) answered_at = new Date(); }
    else { answer = null; status = 'open'; answered_at = null; }
  }
  if (patch.dismissed) status = 'dismissed';
  if (patch.reopen) status = 'open';
  await q('UPDATE questions SET text = $2, status = $3, answer = $4, edited = $5, answered_at = $6, updated_at = now() WHERE id = $1', [questionId, text, status, answer, edited, answered_at]);
  await refreshStatus(q, candidateId);
}

export async function addQuestion(db, candidateId, text, essential) {
  const q = db.query;
  await requireCandidate(q, candidateId);
  const t = clean(text, 1000);
  if (!t) throw new ServiceError(400, 'Write the question first.');
  const id = randomUUID();
  await q("INSERT INTO questions (id, candidate_id, topic_key, text, why, essential, status, manual, edited) VALUES ($1,$2,$3,$4,$5,$6,'open',TRUE,TRUE)", [id, candidateId, `manual-${id.slice(0, 8)}`, t, 'Added by Samuel.', !!essential]);
  await refreshStatus(q, candidateId);
  return id;
}

export async function saveIntakeAnswers(db, candidateId, text) {
  await requireCandidate(db.query, candidateId);
  await db.query('UPDATE candidates SET intake_answers = $2, updated_at = now() WHERE id = $1', [candidateId, clean(text, 20000)]);
}
