// ── Market research for ONE candidate: real adverts in, verified patterns out ──
//
// Adverts come from the Reed feed or are pasted by Samuel. The model proposes patterns; code verifies
// every quote against the advert text. The result is stored per candidate and fed to the writer, so
// the CV uses the words employers use, and the gaps become questions instead of inventions.
import { randomUUID } from 'node:crypto';
import { LIMITS } from '../config.js';
import { PermanentAiError, estimateCost, getProvider } from '../ai/provider.js';
import { ServiceError, requireCandidate } from '../service.js';
import { findAdverts, reedConfigured } from './reed.js';
import { verifyMarket } from './verify.js';

const one = async (q, sql, params) => (await q(sql, params))[0];
const clean = (s, max) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const MAX_ADVERT_CHARS = 9000;
const MAX_ADVERTS = 12;

let finder = findAdverts;
/** Tests replace the advert feed. Pass null to restore. */
export function setAdvertFinderForTests(fn) { finder = fn || findAdverts; }

/** Pasted adverts: separate each with a line containing only --- . First line may be "Title | Company". */
export function parsePasted(text) {
  return String(text || '').split(/^\s*-{3,}\s*$/m).map((b) => b.trim()).filter((b) => b.length >= 120).slice(0, MAX_ADVERTS).map((b, i) => {
    const lines = b.split('\n');
    const head = lines[0].length <= 120 && lines.length > 1 ? lines[0] : '';
    const [title, company] = head.split('|').map((s) => s.trim());
    return { id: `A${i + 1}`, source: 'pasted', ext_id: '', title: title || '', company: company || '', location: '', link: '', salary: '', posted: '', text: clean(head ? lines.slice(1).join('\n') : b, MAX_ADVERT_CHARS) };
  });
}

export async function latestMarket(q, candidateId) {
  const row = await one(q, 'SELECT * FROM market_research WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1', [candidateId]);
  return row || null;
}

/** For the writer: the latest finished research, or null. */
export async function marketForWriting(q, candidateId) {
  const row = await one(q, "SELECT adverts, analysis FROM market_research WHERE candidate_id = $1 AND status = 'done' ORDER BY created_at DESC LIMIT 1", [candidateId]);
  return row && row.analysis ? { adverts: row.adverts || [], analysis: row.analysis } : null;
}

export async function getMarketView(q, candidateId) {
  const row = await latestMarket(q, candidateId);
  const base = { feedReady: reedConfigured() };
  if (!row) return { ...base, status: 'none' };
  const stale = row.status === 'running' && Date.now() - new Date(row.updated_at).getTime() > LIMITS.staleRunMs;
  const analysis = row.analysis || {};
  return {
    ...base,
    status: stale ? 'failed' : row.status,
    source: row.source,
    error: stale ? 'Interrupted before it finished. Run it again.' : row.error,
    adverts: (row.adverts || []).map((a) => ({ id: a.id, title: a.title, company: a.company, location: a.location, link: a.link, salary: a.salary })),
    fit: Object.fromEntries((analysis.adverts || []).map((a) => [a.id, { fit: a.fit, reason: a.fit_reason, blockers: (a.blockers || []).map((b) => b.requirement) }])),
    patterns: (analysis.patterns || []).slice(0, 25).map((p) => ({ id: p.id, name: p.name, kind: p.kind, importance: p.importance, count: p.advert_count })),
    summary: analysis.summary || '',
    caveats: analysis.caveats || [],
    createdAt: row.created_at,
  };
}

/** Records a new research run. pasted = text of adverts separated by --- lines (optional; otherwise the Reed feed is used). */
async function createRun(db, candidateId, { pasted } = {}) {
  const q = db.query;
  const c = await requireCandidate(q, candidateId);
  const run = await latestMarket(q, candidateId);
  if (run && run.status === 'running' && Date.now() - new Date(run.updated_at).getTime() < LIMITS.staleRunMs) {
    return { started: false, reason: 'running', message: 'Market research is already running for this candidate.' };
  }
  const usePasted = typeof pasted === 'string' && pasted.trim().length > 0;
  let adverts = [];
  if (usePasted) {
    adverts = parsePasted(pasted);
    if (adverts.length < 3) throw new ServiceError(400, 'Paste at least 3 adverts, each at least a few lines long, with a line containing only --- between them.');
  } else if (!reedConfigured()) {
    throw new ServiceError(503, 'No advert feed is set up (REED_API_KEY). Paste 8 to 10 adverts instead, separated by lines containing only ---.');
  }
  const id = randomUUID();
  await q("INSERT INTO market_research (id, candidate_id, status, source, query, adverts) VALUES ($1,$2,'running',$3,$4,$5::jsonb)",
    [id, candidateId, usePasted ? 'pasted' : 'reed', `${c.target_role} | ${c.location}`, JSON.stringify(adverts)]);
  return { started: true, id, candidate: c };
}

/** Starts market research in the background (schedule keeps it alive after the HTTP response). */
export async function startMarket(db, candidateId, opts = {}, schedule) {
  const r = await createRun(db, candidateId, opts);
  if (!r.started) return r;
  const job = executeMarket(db, r.id, candidateId, r.candidate).catch((e) => console.error('market job failed:', e));
  if (schedule) schedule(job);
  return { started: true, id: r.id };
}

async function fail(q, id, message) {
  await q("UPDATE market_research SET status = 'failed', error = $2, updated_at = now() WHERE id = $1", [id, String(message).slice(0, 500)]);
}

export async function executeMarket(db, id, candidateId, candidate) {
  const q = db.query;
  try {
    let row = await one(q, 'SELECT * FROM market_research WHERE id = $1', [id]);
    let adverts = row.adverts || [];
    if (row.source === 'reed') {
      adverts = await finder({ role: candidate.target_role, location: candidate.location, limit: 10 });
      if (adverts.length < 3) return fail(q, id, `Only ${adverts.length} usable advert${adverts.length === 1 ? '' : 's'} found for "${candidate.target_role}" near ${candidate.location}. Paste adverts by hand, or widen the target.`);
      await q('UPDATE market_research SET adverts = $2::jsonb, updated_at = now() WHERE id = $1', [id, JSON.stringify(adverts)]);
    }
    const provider = await getProvider();
    const run = candidate.latest_run_id ? await one(q, 'SELECT record FROM runs WHERE id = $1 AND candidate_id = $2', [candidate.latest_run_id, candidateId]) : null;
    const rec = (run && run.record) || {};
    const profile = [
      ...(rec.roles || []).map((r) => `Role: ${r.title} at ${r.employer} (${[r.start_text, r.end_text].filter(Boolean).join(' - ')})`),
      ...(rec.education || []).map((e) => `Education: ${e.qualification}, ${e.institution}`),
      `Goal: ${clean(candidate.goal, 400)}`,
    ].join('\n');
    const out = await provider.analyseMarket({
      target: { role: candidate.target_role, location: candidate.location }, profile,
      adverts: adverts.map((a) => ({ id: a.id, title: a.title, company: a.company, location: a.location, text: clean(a.text, MAX_ADVERT_CHARS) })),
    });
    const analysis = verifyMarket(out.data, adverts);
    if (!analysis.patterns.length) return fail(q, id, 'The analysis found no requirement it could back with a verbatim quote from the adverts. Try again, or use different adverts.');
    const u = out.usage || {};
    await q("UPDATE market_research SET status = 'done', analysis = $2::jsonb, error = NULL, model = $3, input_tokens = $4, output_tokens = $5, cost_usd = $6, updated_at = now() WHERE id = $1",
      [id, JSON.stringify(analysis), provider.model, u.inputTokens ?? null, u.outputTokens ?? null, out.usage ? estimateCost(out.usage) : null]);
  } catch (err) {
    await fail(q, id, err instanceof PermanentAiError || err.permanent ? err.message : `${err.message || err}. Try again.`);
  }
}

/** Used before writing: if there is no finished research and the feed is set up, do it now. Never blocks writing. */
export async function ensureMarket(db, candidateId) {
  try {
    const q = db.query;
    if (await marketForWriting(q, candidateId)) return;
    if (!reedConfigured()) return;
    const r = await createRun(db, candidateId, {});
    if (!r.started) return;
    await executeMarket(db, r.id, candidateId, r.candidate);
  } catch (e) {
    console.error('market research skipped:', e && e.message);
  }
}
