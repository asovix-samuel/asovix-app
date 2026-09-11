import { runDiagnosis } from '../../lib/diagnosis';
import {
  buildLeadRecord, notifyOwnerOfLead, sendDiagnosisToLead, persistLead, prepareCvAttachment,
} from '../../lib/leads';

// Diagnosis submission. Computes the diagnosis server-side (the same pure
// function the client uses), captures the lead — including the original CV
// file — then returns the result immediately.

// Room for an attached CV. Next's default body limit is 1MB, which most CV
// files exceed once base64-encoded; Vercel's own ceiling is 4.5MB.
export const config = { api: { bodyParser: { sizeLimit: '4.5mb' } } };

// Basic in-memory throttle. Serverless instances are short-lived so this is a
// speed bump against accidental double-submits and casual spam, not a security
// control. Real abuse protection would need a shared store.
const recent = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 3;

function throttled(key) {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 500) {
    for (const [k, v] of recent) {
      if (!v.length || now - v[v.length - 1] > WINDOW_MS) recent.delete(k);
    }
  }
  return hits.length > MAX_PER_WINDOW;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { answers = {}, cvFile, source, hp } = req.body || {};

  // Honeypot — real users never fill a hidden field.
  if (hp) return res.status(200).json({ ok: true, diagnosis: runDiagnosis(answers) });

  const email = (answers.email || '').trim().toLowerCase();
  const firstName = (answers.firstName || '').trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!firstName) return res.status(400).json({ error: 'Your first name is required.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (throttled(ip + '|' + email)) {
    return res.status(429).json({ error: 'That came through already — check your inbox.' });
  }

  const diagnosis = runDiagnosis({ ...answers, email, firstName });

  const record = buildLeadRecord({
    answers: { ...answers, email, firstName },
    diagnosis,
    source: source || req.headers.referer || 'direct',
    cvFilename: answers.cvFilename || '',
    cvExcerpt: (answers.cvText || '').slice(0, 1500),
  });

  const { attachment, reason } = prepareCvAttachment(cvFile, { firstName, leadId: record.id });
  record.cvAttached = !!attachment;
  if (!attachment && answers.cvProvided) {
    record.cvAttachError = reason || 'file was too large to send with the diagnosis';
  }

  // The lead must never be lost because of the file. If the mail server
  // rejects the message with the CV attached, send it again without, and say why.
  let captured = true;
  try {
    await persistLead(record);
    await notifyOwnerOfLead(record, undefined, { attachment });
  } catch (err) {
    console.error('diagnosis: owner notification failed', err);
    if (attachment) {
      record.cvAttached = false;
      record.cvAttachError = 'the mail server rejected the attachment';
      try {
        await notifyOwnerOfLead(record);
      } catch (err2) {
        captured = false;
        console.error('diagnosis: retry without CV also failed', err2);
      }
    } else {
      captured = false;
    }
  }

  // Sent after the owner email so it knows whether the CV really arrived.
  let emailed = true;
  try {
    await sendDiagnosisToLead(record, diagnosis);
  } catch (err) {
    emailed = false;
    console.error('diagnosis: candidate email failed', err);
  }

  return res.status(200).json({
    ok: true,
    captured,
    emailed,
    id: record.id,
    cvAttached: captured && record.cvAttached,
    diagnosis,
  });
}
