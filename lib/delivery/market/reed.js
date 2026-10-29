// ── Job advert feed: Reed.co.uk's official jobseeker API ──
//
// Used for market research only (what employers ask for). Needs REED_API_KEY (free, from reed.co.uk/developers).
// Nothing is scraped: this is the board's own API. Adverts are stored with a link back to the original.

const BASE = 'https://www.reed.co.uk/api/1.0';
const TIMEOUT_MS = 15000;

export const reedConfigured = () => Boolean(process.env.REED_API_KEY);

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&pound;/g, '£').replace(/&euro;/g, '€')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** HTML advert text to plain text with line breaks kept where the advert had them. */
export function stripHtml(html) {
  return decode(String(html || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|ul|ol|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '* ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "Part-time stock assistant, retail or customer service" becomes ["part-time stock assistant", "retail", "customer service"]. */
export function searchTerms(role) {
  const parts = String(role || '').split(/,|\/|\bor\b|\band\b/i).map((s) => s.trim()).filter((s) => s.length >= 3);
  const unique = [...new Set(parts.map((p) => p.toLowerCase()))];
  return unique.slice(0, 3);
}

async function get(path, params, fetchImpl) {
  const url = `${BASE}${path}${params ? `?${new URLSearchParams(params)}` : ''}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.REED_API_KEY}:`).toString('base64')}`, Accept: 'application/json' },
      signal: ctl.signal,
    });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Reed rejected the API key.'), { permanent: true });
    if (!r.ok) throw new Error(`Reed answered ${r.status}.`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const salaryText = (j) => {
  const lo = j.minimumSalary, hi = j.maximumSalary;
  if (!lo && !hi) return '';
  const cur = j.currency === 'GBP' || !j.currency ? '£' : `${j.currency} `;
  return lo && hi && lo !== hi ? `${cur}${lo} - ${cur}${hi}` : `${cur}${lo || hi}`;
};

/**
 * Finds up to `limit` current adverts for the target role near the location, with their full text.
 * Several search terms are interleaved so the sample is not 10 copies of one search, and no employer
 * contributes more than 2 adverts.
 */
export async function findAdverts({ role, location, limit = 10, fetchImpl = globalThis.fetch } = {}) {
  if (!reedConfigured()) throw Object.assign(new Error('REED_API_KEY is not set.'), { permanent: true });
  const terms = searchTerms(role);
  if (!terms.length) throw Object.assign(new Error('The target role is too short to search for.'), { permanent: true });

  const perTerm = [];
  for (const kw of terms) {
    const data = await get('/search', { keywords: kw, locationName: String(location || ''), distancefromlocation: '15', resultsToTake: '20' }, fetchImpl);
    perTerm.push(Array.isArray(data.results) ? data.results : []);
  }
  const picked = [];
  const seen = new Set();
  const perEmployer = new Map();
  for (let i = 0; picked.length < limit && perTerm.some((r) => i < r.length); i++) {
    for (const results of perTerm) {
      const j = results[i];
      if (!j || seen.has(j.jobId)) continue;
      const emp = String(j.employerName || '').toLowerCase();
      if ((perEmployer.get(emp) || 0) >= 2) continue;
      seen.add(j.jobId);
      perEmployer.set(emp, (perEmployer.get(emp) || 0) + 1);
      picked.push(j);
      if (picked.length >= limit) break;
    }
  }

  const adverts = [];
  for (const j of picked) {
    let text = stripHtml(j.jobDescription);
    try {
      const detail = await get(`/jobs/${j.jobId}`, null, fetchImpl);
      if (detail && detail.jobDescription) text = stripHtml(detail.jobDescription);
    } catch (e) {
      if (e.permanent) throw e; // the search snippet is still usable if a single detail call fails
    }
    if (text.length < 200) continue; // too short to learn anything from
    adverts.push({
      id: `A${adverts.length + 1}`, source: 'reed', ext_id: String(j.jobId), title: j.jobTitle || '', company: j.employerName || '',
      location: j.locationName || '', link: j.jobUrl || `https://www.reed.co.uk/jobs/${j.jobId}`, salary: salaryText(j), posted: j.date || '', text,
    });
  }
  return adverts;
}
