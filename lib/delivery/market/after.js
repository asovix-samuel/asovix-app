// ── What happens when a client's evidence analysis finishes ──
//
// If there are no essential questions left, research the market (Reed feed), then ask the client about the gaps
// and email them the link. Every step is best effort: a failure here never breaks the analysis or the writing.
import { reedConfigured } from './reed.js';
import { latestMarket, runMarketNow } from './service.js';
import { askMarketGaps } from './questions.js';
import { emailClientQuestions } from '../notify.js';

export async function afterAnalysis(db, candidateId, schedule) {
  try {
    const q = db.query;
    const c = (await q('SELECT status FROM candidates WHERE id = $1', [candidateId]))[0];
    if (reedConfigured() && c && c.status === 'ready_for_positioning' && !(await latestMarket(q, candidateId))) {
      await runMarketNow(db, candidateId);
      const added = await askMarketGaps(db, candidateId);
      if (added) await emailClientQuestions(db, candidateId, added);
    }
  } catch (e) {
    console.error('after-analysis market step skipped:', e && e.message);
  }
  // Hand over to the autopilot: it writes the documents (or waits for the client) without anyone pressing Continue.
  try {
    const { advance } = await import('../autopilot.js');
    await advance(db, candidateId, schedule);
  } catch (e) {
    console.error('after-analysis autopilot skipped:', e && e.message);
  }
}
