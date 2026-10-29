import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { harness, fakeProvider, key } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { createCandidate } from '../../lib/delivery/service.js';
import { stripHtml, searchTerms, findAdverts, reedConfigured } from '../../lib/delivery/market/reed.js';
import { verifyMarket, marketForPrompt } from '../../lib/delivery/market/verify.js';
import { getMarketView, parsePasted, setAdvertFinderForTests, startMarket } from '../../lib/delivery/market/service.js';
import { getDeliverablesView, startWriting, setMailerForTests } from '../../lib/delivery/writing/service.js';
import { buildWritingPrompt } from '../../lib/delivery/writing/prompts.js';

let h;
beforeEach(async () => { h = await harness(); delete process.env.REED_API_KEY; setMailerForTests(async () => ({ messageId: 'x' })); });
afterEach(() => { setAdvertFinderForTests(null); setMailerForTests(null); delete process.env.REED_API_KEY; });

const LONG = (t) => `${t}\n\nAbout the role: we need someone reliable who can coordinate daily dispatch and keep records accurate. You will work in a busy warehouse team and keep customers informed. Experience of dispatch coordination is an advantage but full training is given.`;
const adverts = (n) => Array.from({ length: n }, (_, i) => ({ id: `A${i + 1}`, source: 'reed', ext_id: String(i), title: `Coordinator ${i}`, company: `Firm ${i}`, location: 'Cork', link: '', salary: '', posted: '', text: LONG(`Coordinator number ${i} at Firm ${i}`) }));

async function ready() {
  const out = await createCandidate(h.db, {
    submissionKey: key(), name: 'Jordan Test', email: 'jordan.test@example.com', targetRole: 'Logistics Coordinator, dispatch or warehouse', location: 'Cork',
    goal: 'A coordinator role', package: 'cv_positioning', manualTest: true, file: { name: 'jordan-cv.pdf', bytes: await makeCvPdf() },
  }, h.schedule);
  await h.idle();
  return out.candidateId;
}

test('reed: plain text from HTML, and a multi-part target becomes up to three searches', () => {
  assert.equal(stripHtml('<p>Hello &amp; welcome</p><ul><li>One</li><li>Two&nbsp;items</li></ul><script>x()</script>'), 'Hello & welcome\n* One\n* Two items');
  assert.deepEqual(searchTerms('Part-time stock assistant, retail or customer service'), ['part-time stock assistant', 'retail', 'customer service']);
  assert.deepEqual(searchTerms('x'), []);
});

test('reed: finds adverts across terms, no employer more than twice, full text from the detail call, short ones skipped', async () => {
  process.env.REED_API_KEY = 'test-key';
  assert.equal(reedConfigured(), true);
  const calls = [];
  const job = (id, emp, kw) => ({ jobId: id, employerName: emp, jobTitle: `${kw} ${id}`, locationName: 'Cork', jobDescription: 'short snippet', jobUrl: `https://www.reed.co.uk/jobs/${id}`, minimumSalary: 20000, maximumSalary: 24000, currency: 'GBP', date: '01/10/2026' });
  const fakeFetch = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    const u = new URL(url);
    const ok = (json) => ({ ok: true, status: 200, json: async () => json });
    if (u.pathname.endsWith('/search')) {
      const kw = u.searchParams.get('keywords');
      return ok({ results: [job(`${kw[0]}1`, 'Same Co', kw), job(`${kw[0]}2`, 'Same Co', kw), job(`${kw[0]}3`, 'Same Co', kw), job(`${kw[0]}4`, `Other ${kw[0]}`, kw)] });
    }
    const id = u.pathname.split('/').pop();
    return ok({ jobDescription: id === 'w4' ? '<p>tiny</p>' : `<p>${LONG(`Advert ${id}`).replace(/\n/g, '<br>')}</p>` });
  };
  const found = await findAdverts({ role: 'logistics coordinator, dispatch or warehouse', location: 'Cork', limit: 10, fetchImpl: fakeFetch });
  assert.ok(found.length >= 3);
  const perEmployer = {};
  for (const a of found) perEmployer[a.company] = (perEmployer[a.company] || 0) + 1;
  assert.ok(Object.values(perEmployer).every((n) => n <= 2), 'no employer more than twice');
  assert.ok(found.every((a) => a.text.length >= 200 && a.id.startsWith('A') && a.link.startsWith('https://www.reed.co.uk/jobs/')));
  assert.equal(found[0].salary, '£20000 - £24000');
  assert.equal(calls[0].auth, `Basic ${Buffer.from('test-key:').toString('base64')}`, 'the key is sent as basic auth, never in the URL');
  assert.ok(!calls.some((c) => c.url.includes('test-key')));
});

test('reed: a rejected key is a permanent error, and no key means no search', async () => {
  await assert.rejects(() => findAdverts({ role: 'coordinator', location: 'Cork' }), /REED_API_KEY/);
  process.env.REED_API_KEY = 'bad';
  await assert.rejects(() => findAdverts({ role: 'coordinator', location: 'Cork', fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) }), /rejected the API key/);
});

test('verify: a pattern only survives through quotes that are really in the advert, and counts are recomputed', () => {
  const ads = adverts(3);
  const out = {
    adverts: [{ id: 'A1', fit: 'core', fit_reason: '', blockers: [{ requirement: 'Ten years', quote: 'ten years of experience required' }] }, { id: 'A9', fit: 'core', blockers: [] }],
    patterns: [
      { name: 'Dispatch', kind: 'responsibility', importance: 'required', evidence: [{ advert_id: 'A1', quote: 'coordinate daily dispatch' }, { advert_id: 'A2', quote: 'coordinate daily dispatch' }, { advert_id: 'A3', quote: 'not in the advert at all' }] },
      { name: 'Made up', kind: 'skill', importance: 'common', evidence: [{ advert_id: 'A1', quote: 'a quote that does not exist' }] },
    ],
    summary: 's', caveats: [],
  };
  const v = verifyMarket(out, ads);
  assert.equal(v.patterns.length, 1);
  assert.equal(v.patterns[0].advert_count, 2, 'counted by code, not by the model');
  assert.equal(v.patterns[0].id, 'P1');
  assert.equal(v.adverts.length, 1, 'an advert id the model invented is dropped');
  assert.deepEqual(v.adverts[0].blockers, [], 'a blocker without a verbatim quote is dropped');
  assert.equal(v.quotes_dropped_as_unverifiable, 3);
  assert.match(marketForPrompt(v, 3), /P1 Dispatch \[responsibility; required; 2\/3 adverts\]/);
});

test('pasted adverts are split on --- lines, with an optional "Title | Company" first line', () => {
  const p = parsePasted(`Stock Assistant | Tesco\n${LONG('Stock role')}\n---\n${LONG('Second')}\n---\ntoo short`);
  assert.equal(p.length, 2);
  assert.equal(p[0].title, 'Stock Assistant');
  assert.equal(p[0].company, 'Tesco');
  assert.equal(p[0].source, 'pasted');
});

test('market research from pasted adverts: verified patterns are stored and shown, the invented one is dropped', async () => {
  const provider = fakeProvider();
  const id = await ready();
  const pasted = adverts(4).map((a) => `${a.title} | ${a.company}\n${a.text}`).join('\n---\n');
  const r = await startMarket(h.db, id, { pasted }, h.schedule);
  assert.equal(r.started, true);
  await h.idle();
  const m = await getMarketView(h.db.query, id);
  assert.equal(m.status, 'done');
  assert.equal(m.source, 'pasted');
  assert.equal(m.adverts.length, 4);
  assert.ok(m.patterns.some((p) => p.name === 'Dispatch coordination' && p.count === 4));
  assert.ok(!m.patterns.some((p) => p.name === 'Invented requirement'));
  assert.equal(provider.seen.market[0].target.role, 'Logistics Coordinator, dispatch or warehouse');
  assert.ok(provider.seen.market[0].profile.includes('Role:'), 'the candidate profile is given to the analyst');
  const again = await startMarket(h.db, id, { pasted }, h.schedule);
  assert.equal(again.started, true, 'a finished run may be refreshed');
  await h.idle();
});

test('market research needs a feed or pasted adverts, and a thin paste is refused', async () => {
  fakeProvider();
  const id = await ready();
  await assert.rejects(() => startMarket(h.db, id, {}, h.schedule), /No advert feed/);
  await assert.rejects(() => startMarket(h.db, id, { pasted: 'one short advert' }, h.schedule), /at least 3 adverts/);
});

test('when the feed finds too few adverts, the run fails with a plain reason instead of guessing', async () => {
  fakeProvider();
  process.env.REED_API_KEY = 'k';
  setAdvertFinderForTests(async () => adverts(2));
  const id = await ready();
  await startMarket(h.db, id, {}, h.schedule);
  await h.idle();
  const m = await getMarketView(h.db.query, id);
  assert.equal(m.status, 'failed');
  assert.match(m.error, /Only 2 usable adverts/);
});

test('writing uses the market research: it reaches the writer and the prompt, and the feed runs first automatically', async () => {
  const provider = fakeProvider();
  process.env.REED_API_KEY = 'k';
  let found = 0;
  setAdvertFinderForTests(async () => { found += 1; return adverts(5); });
  const id = await ready();
  await startWriting(h.db, id, {}, h.schedule);
  await h.idle();
  assert.equal(found, 1, 'adverts were fetched once, before writing');
  const input = provider.seen.write[0];
  assert.ok(input.market && input.market.analysis.patterns.length >= 1, 'the writer receives the research');
  const prompt = buildWritingPrompt(input);
  assert.match(prompt, /MARKET RESEARCH/);
  assert.match(prompt, /Dispatch coordination \[responsibility; required; 5\/5 adverts\]/);
  const v = await getDeliverablesView(h.db, id);
  assert.equal(v.market.status, 'done');
  assert.equal(v.status, 'in_review');
  await startWriting(h.db, id, {}, h.schedule);
  await h.idle();
  assert.equal(found, 1, 'a second version does not search again');
});

test('a broken advert feed never stops the writing', async () => {
  const provider = fakeProvider();
  process.env.REED_API_KEY = 'k';
  setAdvertFinderForTests(async () => { throw new Error('Reed is down'); });
  const id = await ready();
  await startWriting(h.db, id, {}, h.schedule);
  await h.idle();
  const v = await getDeliverablesView(h.db, id);
  assert.equal(v.status, 'in_review', 'drafts were still written');
  assert.equal(v.market.status, 'failed');
  assert.equal(provider.seen.write[0].market, null);
  assert.ok(!buildWritingPrompt(provider.seen.write[0]).includes('MARKET RESEARCH'));
});
