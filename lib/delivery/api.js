// ── Delivery API: one router behind pages/api/delivery/[...path].js ──
//
// One serverless function instead of ten (Vercel limits how many a project may have).
// Every route except login is behind requireSession(); the candidate id in the URL
// scopes every read and write, so one candidate's data can never be reached through another's.

import Busboy from 'busboy';
import { LIMITS } from './config.js';
import {
  clearedSessionCookie, createSessionToken, loginLocked, recordLoginFailure, requireSession,
  resetLoginFailures, sessionCookie, verifyPassword,
} from './auth.js';
import { getDb } from './db.js';
import { aiConfigured } from './ai/provider.js';
import { storageKind } from './storage.js';
import { paypalConfigured } from '../paypal.js';
import { intakeState, submitAnswers, submitIntake } from './intake.js';
import {
  ServiceError, addQuestion, createCandidate, getCandidateView, getDocumentForDownload, listCandidates,
  readDocumentBytes, replaceDocument, saveIntakeAnswers, startProcessing, updateQuestion,
} from './service.js';

const send = (res, status, body) => res.status(status).json(body);

async function readJson(req, max = 300 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw new ServiceError(413, 'That request is too large.');
    chunks.push(c);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) {
    throw new ServiceError(400, 'The request was not valid JSON.');
  }
}

/** Multipart form with at most one file. Returns { fields, file: { name, bytes } | null }. */
function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: LIMITS.maxFileBytes + 1, fields: 30, fieldSize: 64 * 1024 } });
    } catch (e) {
      return reject(new ServiceError(400, 'Send the form as multipart/form-data.'));
    }
    const fields = {};
    let file = null;
    let tooBig = false;
    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', (d) => chunks.push(d));
      stream.on('limit', () => { tooBig = true; });
      stream.on('end', () => { file = { name: info.filename || 'cv', bytes: new Uint8Array(Buffer.concat(chunks)) }; });
    });
    bb.on('error', (e) => reject(new ServiceError(400, `Upload failed: ${e.message}`)));
    bb.on('close', () => {
      if (tooBig) return reject(new ServiceError(400, `The file is larger than ${LIMITS.maxFileBytes / 1024 / 1024} MB.`));
      resolve({ fields, file });
    });
    req.pipe(bb);
  });
}

export function readiness() {
  return {
    ai: aiConfigured(),
    storage: storageKind(),
    stripeCheck: !!process.env.STRIPE_SECRET_KEY || paypalConfigured(),
    database: !!process.env.DATABASE_URL ? 'postgres' : (process.env.NODE_ENV === 'production' ? 'missing' : 'local'),
  };
}

export async function handleDelivery(req, res, { schedule } = {}) {
  const path = [].concat(req.query.path || []);
  const [a, b, c, d] = path;
  try {
    // ---- sign-in (the only route that does not need a session) ----
    if (a === 'login' && req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      const hash = process.env.DELIVERY_PASSWORD_HASH;
      if (!hash || !process.env.DELIVERY_SESSION_SECRET) return send(res, 503, { error: 'Sign-in has not been set up yet (see DELIVERY-SETUP.md).' });
      const db = await getDb();
      if (await loginLocked(db)) return send(res, 429, { error: 'Too many failed attempts. Wait 15 minutes and try again.' });
      const body = await readJson(req, 4096);
      if (!verifyPassword(String(body.password || ''), hash)) {
        await recordLoginFailure(db);
        await new Promise((r) => setTimeout(r, 600));
        return send(res, 401, { error: 'That password is not right.' });
      }
      await resetLoginFailures(db);
      res.setHeader('Set-Cookie', sessionCookie(createSessionToken()));
      return send(res, 200, { ok: true });
    }

    // ---- client intake: the only public routes. Scoped to one paid order by its Stripe session id; see intake.js ----
    if (a === 'intake' && b) {
      res.setHeader('Cache-Control', 'no-store');
      const origin = req.headers.origin;
      if (req.method !== 'GET' && origin && req.headers.host && new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'That request came from the wrong place.' });
      const db = await getDb();
      if (!c && req.method === 'GET') return send(res, 200, await intakeState(db, b));
      if (!c && req.method === 'POST') {
        const { fields, file } = await readMultipart(req);
        return send(res, 200, await submitIntake(db, b, fields, file, schedule));
      }
      if (c === 'answers' && req.method === 'POST') {
        const body = await readJson(req);
        return send(res, 200, await submitAnswers(db, b, body.answers, schedule));
      }
      return send(res, 404, { error: 'Not found.' });
    }

    if (!requireSession(req, res)) return;
    const db = await getDb();

    if (a === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', clearedSessionCookie());
      return send(res, 200, { ok: true });
    }
    if (a === 'status' && req.method === 'GET') return send(res, 200, readiness());

    if (a === 'candidates' && !b) {
      if (req.method === 'GET') return send(res, 200, { candidates: await listCandidates(db) });
      if (req.method === 'POST') {
        const { fields, file } = await readMultipart(req);
        const out = await createCandidate(db, {
          submissionKey: fields.submissionKey, name: fields.name, email: fields.email, targetRole: fields.targetRole,
          location: fields.location, goal: fields.goal, package: fields.package, intakeAnswers: fields.intakeAnswers,
          stripeSessionId: fields.stripeSessionId, manualTest: fields.manualTest === 'on' || fields.manualTest === 'true', file,
        }, schedule);
        return send(res, out.duplicate ? 200 : 201, out);
      }
    }

    if (a === 'candidates' && b) {
      const id = b;
      if (!c && req.method === 'GET') return send(res, 200, await getCandidateView(db, id));

      if (c === 'analyse' && req.method === 'POST') {
        const body = await readJson(req);
        // "Save answers and continue" is one step: nothing is analysed until everything is saved.
        if (typeof body.intakeAnswers === 'string') await saveIntakeAnswers(db, id, body.intakeAnswers);
        for (const ans of Array.isArray(body.answers) ? body.answers.slice(0, 50) : []) {
          if (ans && typeof ans.id === 'string') await updateQuestion(db, id, ans.id, { answer: String(ans.answer ?? '') });
        }
        const out = await startProcessing(db, id, 'rerun', schedule);
        return send(res, out.started ? 202 : 200, out);
      }
      if (c === 'intake-answers' && req.method === 'PUT') {
        const body = await readJson(req);
        await saveIntakeAnswers(db, id, String(body.text || ''));
        return send(res, 200, { ok: true });
      }
      if (c === 'questions' && !d && req.method === 'POST') {
        const body = await readJson(req);
        return send(res, 201, { id: await addQuestion(db, id, body.text, !!body.essential) });
      }
      if (c === 'questions' && d && req.method === 'PATCH') {
        const body = await readJson(req);
        await updateQuestion(db, id, d, { text: body.text, answer: body.answer, dismissed: !!body.dismissed, reopen: !!body.reopen });
        return send(res, 200, { ok: true });
      }
      if (c === 'document' && req.method === 'POST') {
        const { file } = await readMultipart(req);
        if (!file) throw new ServiceError(400, 'Attach a file.');
        return send(res, 201, { id: await replaceDocument(db, id, file) });
      }
      if (c === 'documents' && d && req.method === 'GET') {
        const doc = await getDocumentForDownload(db, id, d);
        if (!doc) return send(res, 404, { error: 'Document not found.' });
        const bytes = await readDocumentBytes(doc);
        res.setHeader('Content-Type', doc.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${doc.filename.replace(/[^\w.\- ]+/g, '_')}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send(Buffer.from(bytes));
        return;
      }
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (err) {
    if (err instanceof ServiceError) return send(res, err.status, { error: err.message });
    if (err && (['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(err.code) || /timeout exceeded when trying to connect|Connection terminated/i.test(String(err.message)) || (err.errors && err.errors[0] && err.errors[0].code === 'ETIMEDOUT'))) {
      console.error('delivery api: database unreachable:', err.code || err.message);
      return send(res, 503, { error: 'The workspace cannot reach its database right now. This is usually the network you are on blocking database traffic (try a phone hotspot) or a Supabase outage. Nothing was lost.' });
    }
    console.error('delivery api error:', err);
    return send(res, 500, { error: 'Something went wrong on the server. Nothing was lost; try again.' });
  }
}
