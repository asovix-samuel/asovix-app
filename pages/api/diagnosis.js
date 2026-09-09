import { runDiagnosis } from '../../lib/diagnosis';
import { buildLeadRecord, notifyOwnerOfLead, sendDiagnosisToLead, persistLead } from '../../lib/leads';

// Diagnosis submission. Computes the diagnosis server-side (same pure function
// the client uses), captures the lead, then returns the result immediately —
// the candidate never waits on manual review.

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

  const { answers = {}, source, hp } = req.body || {};

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

  // The candidate gets their result whatever happens to delivery. Capture
  // failures are logged and surfaced to us, never to them as a dead end.
  let captured = true;
  try {
    await persistLead(record);
    await notifyOwnerOfLead(record);
  } catch (err) {
    captured = false;
    console.error('diagnosis: owner notification failed', err);
  }

  try {
    await sendDiagnosisToLead(record, diagnosis);
  } catch (err) {
    console.error('diagnosis: candidate email failed', err);
  }

  return res.status(200).json({ ok: true, captured, id: record.id, diagnosis });
}
