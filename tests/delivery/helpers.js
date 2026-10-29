// Test harness: in-memory Postgres (PGlite), local file storage in a temp folder, and a scripted AI provider.
// No network, no real AI, no real Stripe. All people and employers are fictional.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { openMemoryDb, setDbForTests } from '../../lib/delivery/db.js';
import { setProviderForTests } from '../../lib/delivery/ai/provider.js';
import { hashPassword } from '../../lib/delivery/auth.js';

process.env.DELIVERY_LOCAL_FILES = mkdtempSync(join(tmpdir(), 'asovix-delivery-files-'));
process.env.DELIVERY_SESSION_SECRET = 'test-secret-test-secret-0123456789';
process.env.DELIVERY_PASSWORD_HASH = hashPassword('correct horse battery');
delete process.env.STRIPE_SECRET_KEY;
delete process.env.ANTHROPIC_API_KEY;

export async function harness() {
  const db = await openMemoryDb();
  setDbForTests(db);
  const jobs = [];
  return {
    db,
    schedule: (p) => jobs.push(p),
    idle: async () => { while (jobs.length) await jobs.shift(); },
  };
}

let n = 0;
export const key = () => `test-submission-${Date.now()}-${++n}`;

/** The extraction a good model would return for the Jordan Test PDF fixture. Quotes are verbatim from it. */
export function goodExtraction(overrides = {}) {
  return {
    profile: { full_name: 'JORDAN TEST', email: 'jordan.test@example.com', phone: null, location: 'Cork, Ireland' },
    roles: [
      { employer: 'Harbour Freight Ltd', title: 'Operations Coordinator', start_text: 'Jan 2021', end_text: 'Present', start_iso: '2021-01', end_iso: 'present', location: null,
        quote: 'Operations Coordinator, Harbour Freight Ltd, Jan 2021 - Present' },
      { employer: 'Lee Valley Distribution', title: 'Logistics Assistant', start_text: 'Mar 2019', end_text: 'Dec 2020', start_iso: '2019-03', end_iso: '2020-12', location: null,
        quote: 'Logistics Assistant, Lee Valley Distribution, Mar 2019 - Dec 2020' },
    ],
    education: [{ institution: 'University College Cork', qualification: 'BA Business Studies', dates_text: '2014 - 2018', quote: 'BA Business Studies, University College Cork, 2014 - 2018' }],
    certifications: [],
    listed_skills: [{ skill: 'Excel', quote: 'Excel, SAP, route planning, team scheduling' }],
    eligibility_statements: [],
    claims: [
      { category: 'role_skill', claim: 'Coordinated daily dispatch for a team of 6 drivers', status: 'source_documented', quote_origin: 'document',
        quote: 'Coordinated daily dispatch for a team of 6 drivers', confirmation_quote: null, ownership: 'individual', relevance: 'high', relevance_note: 'Direct dispatch experience.' },
      { category: 'contribution_results', claim: 'Reduced late deliveries by 18% over 2022', status: 'source_documented', quote_origin: 'document',
        quote: 'reduced late deliveries by 18% over 2022', confirmation_quote: null, ownership: 'individual', relevance: 'high', relevance_note: 'A measurable result.' },
      { category: 'contribution_results', claim: 'Delivered the warehouse relocation project on time', status: 'source_documented', quote_origin: 'document',
        quote: 'We delivered the warehouse relocation project on time.', confirmation_quote: null, ownership: 'team', relevance: 'medium', relevance_note: 'Project delivery.' },
      { category: 'communication', claim: 'Wrote weekly status updates for the regional manager', status: 'source_documented', quote_origin: 'document',
        quote: 'Wrote weekly status updates for the regional manager.', confirmation_quote: null, ownership: 'individual', relevance: 'medium', relevance_note: 'Written reporting.' },
      { category: 'coachability_learning', claim: 'Asked for feedback each quarter', status: 'source_documented', quote_origin: 'document',
        quote: 'asked for feedback each quarter', confirmation_quote: null, ownership: 'individual', relevance: 'low', relevance_note: 'Shows openness to feedback.' },
    ],
    contradictions: [],
    template_leftovers: [],
    missing_information: [],
    ...overrides,
  };
}

/** Scripted provider. `extract`/`questions` can be objects or functions of the input. Records every input it receives. */
export function fakeProvider(opts = {}) {
  const seen = { extract: [], questions: [] };
  const state = { extractFails: opts.extractFails || 0, questionFails: opts.questionFails || 0 };
  const provider = {
    name: 'fake', model: 'fake-model-1', seen, state,
    async extractEvidence(input) {
      seen.extract.push(input);
      if (opts.permanent) { const { PermanentAiError } = await import('../../lib/delivery/ai/provider.js'); throw new PermanentAiError('The API key was rejected.'); }
      if (state.extractFails-- > 0) throw new Error('503 overloaded');
      const data = typeof opts.extract === 'function' ? opts.extract(input) : (opts.extract || goodExtraction());
      return { data, usage: { inputTokens: 1000, outputTokens: 500 } };
    },
    async generateQuestions(input) {
      seen.questions.push(input);
      if (state.questionFails-- > 0) throw new Error('503 overloaded');
      if (typeof opts.questions === 'function') return { data: opts.questions(input), usage: { inputTokens: 200, outputTokens: 100 } };
      const ids = [
        ...input.findings.filter((f) => f.essential).map((f) => f.id),
        ...input.claims.filter((c) => c.status === 'needs_confirmation').map((c) => c.id),
      ];
      const data = ids.length ? { questions: [{ topic_key: 'main-gaps', text: 'Can you clarify the points we flagged?', why: 'They change what can be claimed.', linked_ids: ids }] } : { questions: [] };
      return { data, usage: { inputTokens: 200, outputTokens: 100 } };
    },
    async writeDeliverable(input) {
      seen.write = seen.write || [];
      seen.write.push(input);
      if (state.writeFails-- > 0) {
        if (opts.writePermanent) { const { PermanentAiError } = await import('../../lib/delivery/ai/provider.js'); throw new PermanentAiError('The API key was rejected.'); }
        throw new Error('503 overloaded');
      }
      const data = typeof opts.write === 'function' ? opts.write(input) : goodWriting(input);
      return { data, usage: { inputTokens: 3000, outputTokens: 1200 } };
    },
  };
  state.writeFails = opts.writeFails || 0;
  setProviderForTests(provider);
  return provider;
}

/** The evidence id the writer was given for the claim whose text matches `re`. */
export const evId = (input, re) => {
  const e = input.evidence.find((x) => re.test(x.claim));
  if (!e) throw new Error(`no evidence matching ${re}`);
  return e.id;
};

/** What a good writer returns for each deliverable, citing only real evidence. */
export function goodWriting(input) {
  const d = evId(input, /dispatch/), late = evId(input, /late deliveries/), wh = evId(input, /warehouse/), upd = evId(input, /status updates/);
  if (input.kind === 'cv') {
    return {
      headline: 'Logistics coordinator who keeps deliveries on time',
      summary: { text: 'Operations coordinator who reduced late deliveries by 18% over 2022 while coordinating daily dispatch for a team of 6 drivers.', evidence: [late, d] },
      key_skills: [{ skill: 'Excel', evidence: [] }, { skill: 'Dispatch coordination', evidence: [d] }],
      experience: [
        { role: 'r1', bullets: [{ text: 'Cut late deliveries by 18% over 2022', evidence: [late] }, { text: 'Coordinated daily dispatch for a team of 6 drivers', evidence: [d] }] },
        { role: 'r2', bullets: [{ text: 'Contributed to the team delivering a warehouse relocation on time', evidence: [wh] }] },
      ],
      high_leverage_lines: ['Cut late deliveries by 18% over 2022'],
      notes: ['Led with the late-delivery result: it is the strongest signal for this role.'],
    };
  }
  if (input.kind === 'linkedin') {
    return {
      headline: 'Logistics & Operations Coordinator | Dispatch planning | On-time delivery',
      about: { text: 'I coordinate daily dispatch for a team of 6 drivers.\n\nIn 2022 I reduced late deliveries by 18%.', evidence: [d, late] },
      experience: [{ role: 'r1', description: { text: 'I run daily dispatch and write weekly status updates for the regional manager.', evidence: [d, upd] } }],
      top_skills: ['Excel', 'Route planning'],
      notes: [],
    };
  }
  if (input.kind === 'cover_letter') {
    return {
      company: input.jobAd && /Northwind/.test(input.jobAd) ? 'Northwind Logistics' : '',
      role_title: 'Logistics Coordinator',
      greeting: 'Dear Hiring Manager,',
      paragraphs: [{ text: 'I reduced late deliveries by 18% over 2022 as an operations coordinator.', evidence: [late] }, { text: 'I coordinate daily dispatch for a team of 6 drivers and would bring that discipline to your team.', evidence: [d] }],
      sign_off: 'Kind regards,',
      notes: [],
    };
  }
  return {
    role_focus: 'Reliable on-time delivery.',
    likely_questions: [{ question: 'Tell me about a result you are proud of.', why_they_ask: 'Impact.', answer_outline: { text: 'Reduced late deliveries by 18% over 2022.', evidence: [late] } }],
    stories: [{ title: 'Late deliveries', situation_task: { text: 'Dispatch for a team of 6 drivers.', evidence: [d] }, action_result: { text: 'Late deliveries down 18% over 2022.', evidence: [late] } }],
    risks: [],
    notes: [],
  };
}

/** A minimal Node-style request for the API router. */
export function makeReq({ method = 'GET', path = [], headers = {}, json, multipart, cookie } = {}) {
  let body = Buffer.alloc(0);
  const h = { host: 'localhost:3000', ...headers };
  if (cookie) h.cookie = cookie;
  if (json !== undefined) { body = Buffer.from(JSON.stringify(json)); h['content-type'] = 'application/json'; }
  if (multipart) {
    const boundary = '----testboundary7MA4YWxkTrZu0gW';
    const parts = [];
    for (const [k, v] of Object.entries(multipart.fields || {})) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    if (multipart.file) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${multipart.file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
      parts.push(Buffer.from(multipart.file.bytes), Buffer.from('\r\n'));
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    body = Buffer.concat(parts);
    h['content-type'] = `multipart/form-data; boundary=${boundary}`;
  }
  const req = Readable.from(body.length ? [body] : []);
  req.method = method;
  req.headers = h;
  req.query = { path };
  return req;
}

export function makeRes() {
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(b) { this.body = b; return this; },
  };
  return res;
}
