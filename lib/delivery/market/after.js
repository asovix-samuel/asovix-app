// ── What happens when a client's evidence analysis finishes ──
//
// If there are no essential questions left, research the market (Reed feed), then ask the client about the gaps
// and email them the link. Every step is best effort: a failure here never breaks the analysis or the writing.
import { reedConfigured } from './reed.js';
import { latestMarket, runMarketNow } from './service.js';
import { askMarketGaps } from './questions.js';
import { emailClientQuestions } from '../notify.js';

export async function afterAnalysis(db, candidateId) {
  try {
    const q = db.query;
    if (!reedConfigured()) return;
    const c = (await q('SELECT status FROM candidates WHERE id = $1', [candidateId]))[0];
    if (!c || c.status !== 'ready_for_positioning') return;
    if (await latestMarket(q, candidateId)) return; // already researched (or tried); a button re-runs it
    await runMarketNow(db, candidateId);
    const added = await askMarketGaps(db, candidateId);
    if (added) await emailClientQuestions(db, candidateId, added);
  } catch (e) {
    console.error('after-analysis skipped:', e && e.message);
  }
}
