// Code checks the model's market analysis against the advert text. A pattern survives only through quotes
// that really appear in the advert they are attributed to, and the counts are recomputed here.
import { loose } from '../evidence/normalize.js';

const MIN_QUOTE = 6;

export function verifyMarket(out, adverts) {
  const textOf = new Map(adverts.map((a) => [a.id, loose(a.text || '')]));
  const quoteOk = (id, quote) => textOf.has(id) && loose(quote || '').length >= MIN_QUOTE && textOf.get(id).includes(loose(quote));

  let dropped = 0;
  const patterns = [];
  for (const p of out.patterns || []) {
    const ev = (p.evidence || []).filter((e) => quoteOk(e.advert_id, e.quote));
    dropped += (p.evidence || []).length - ev.length;
    const ids = [...new Set(ev.map((e) => e.advert_id))];
    if (ids.length) patterns.push({ ...p, evidence: ev, advert_ids: ids, advert_count: ids.length });
  }
  patterns.sort((a, b) => b.advert_count - a.advert_count);
  patterns.forEach((p, i) => { p.id = `P${i + 1}`; });

  const known = new Set(adverts.map((a) => a.id));
  const judged = (out.adverts || []).filter((a) => known.has(a.id)).map((a) => ({
    ...a,
    blockers: (a.blockers || []).filter((b) => {
      const ok = quoteOk(a.id, b.quote);
      if (!ok) dropped += 1;
      return ok;
    }),
  }));
  return { adverts: judged, patterns, summary: out.summary || '', caveats: out.caveats || [], quotes_dropped_as_unverifiable: dropped };
}

/** The market data as the writer sees it: short, counted, and honest about the sample size. */
export function marketForPrompt(market, advertCount) {
  if (!market || !market.patterns || !market.patterns.length) return '';
  const lines = market.patterns.slice(0, 18).map((p) => `${p.id} ${p.name} [${p.kind}; ${p.importance}; ${p.advert_count}/${advertCount} adverts]`);
  const blockers = [...new Set((market.adverts || []).flatMap((a) => (a.blockers || []).map((b) => b.requirement)))].slice(0, 8);
  return [
    `MARKET RESEARCH: what employers hiring for this target ask for, counted from ${advertCount} real adverts.`,
    market.summary ? `Summary: ${market.summary}` : '',
    'Patterns (most common first):',
    ...lines,
    blockers.length ? `Hard requirements that could block this candidate: ${blockers.join('; ')}` : '',
    (market.caveats || []).length ? `Caveats: ${market.caveats.join(' ')}` : '',
  ].filter(Boolean).join('\n');
}
