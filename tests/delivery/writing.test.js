// Stage 2: writing from evidence, code checks, review, approval, delivery and revisions.
// Scripted AI, in-memory database, captured email. All people and employers are fictional.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { harness, fakeProvider, goodWriting, evId, goodExtraction, key, makeReq, makeRes } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { createCandidate, getCandidateView } from '../../lib/delivery/service.js';
import {
  approveDraft, getDeliverablesView, renderDraftFile, retryWriting, sendDelivery, setMailerForTests, startRevision, startWriting, updateDraft,
} from '../../lib/delivery/writing/service.js';
import { checkDraft } from '../../lib/delivery/writing/checks.js';
import { handleDelivery } from '../../lib/delivery/api.js';
import { SESSION_COOKIE, createSessionToken } from '../../lib/delivery/auth.js';

let h, outbox;
beforeEach(async () => {
  h = await harness();
  outbox = [];
  setMailerForTests(async (m) => { outbox.push(m); return { messageId: `<msg-${outbox.length}@test>` }; });
});
afterEach(() => setMailerForTests(null));

async function ready(pkg = 'cv_positioning', over = {}) {
  const out = await createCandidate(h.db, {
    submissionKey: key(), name: 'Jordan Test', email: 'jordan.test@example.com', targetRole: 'Logistics Coordinator',
    location: 'Cork', goal: 'Move into a coordinator role in a larger company', package: pkg, manualTest: true,
    file: { name: 'jordan-cv.pdf', bytes: await makeCvPdf() }, ...over,
  }, h.schedule);
  await h.idle();
  return out.candidateId;
}
async function write(id, opts = {}) {
  const out = await startWriting(h.db, id, opts, h.schedule);
  await h.idle();
  return out;
}
const view = (id) => getDeliverablesView(h.db, id);
const draftOf = async (id, kind) => (await view(id)).drafts.find((d) => d.kind === kind);

test('drafts are written from verified evidence only, pass every check, and the candidate moves to review', async () => {
  const p = fakeProvider();
  const id = await ready();
  assert.equal((await getCandidateView(h.db, id)).candidate.status, 'ready_for_positioning');
  const out = await write(id, { jobAd: 'Logistics Coordinator at Northwind Logistics, Cork.' });
  assert.equal(out.started, true);
  const v = await view(id);
  assert.equal(v.status, 'in_review');
  assert.equal(v.drafts.length, 1);
  const cv = v.drafts[0];
  assert.equal(cv.kind, 'cv');
  assert.equal(cv.status, 'draft');
  assert.deepEqual(cv.checks.filter((c) => c.level === 'error'), []);
  const input = p.seen.write[0];
  assert.ok(input.evidence.length >= 4);
  assert.ok(input.evidence.every((e) => e.status !== 'unsupported'), 'unsupported claims are never given to the writer');
  assert.equal(input.jobAd, 'Logistics Coordinator at Northwind Logistics, Cork.');
  assert.equal(cv.input_tokens, 3000);
});

test('each package writes exactly its deliverables', async () => {
  fakeProvider();
  const a = await ready('cv_linkedin_letter');
  await write(a);
  assert.deepEqual((await view(a)).drafts.map((d) => d.kind), ['cv', 'linkedin', 'cover_letter']);
  const b = await ready('full_package');
  await write(b);
  const vb = await view(b);
  assert.deepEqual(vb.drafts.map((d) => d.kind), ['cv', 'linkedin', 'cover_letter', 'interview_pack']);
  assert.equal(vb.drafts.find((d) => d.kind === 'interview_pack').clientFacing, false);
});

test('an invented figure, unknown evidence, an unknown role and generic phrases are caught as errors', async () => {
  fakeProvider({
    write: (input) => {
      const w = goodWriting(input);
      w.experience[0].bullets[0] = { text: 'Cut late deliveries by 25% over 2022', evidence: [evId(input, /late deliveries/)] };
      w.experience[0].bullets[1] = { text: 'Hardworking team player who planned routes', evidence: ['e99'] };
      w.experience.push({ role: 'r9', bullets: [{ text: 'Ran a depot', evidence: [evId(input, /dispatch/)] }] });
      w.headline = 'Coordinator with 7 years in logistics';
      return w;
    },
  });
  const id = await ready();
  await write(id);
  const cv = await draftOf(id, 'cv');
  const msgs = cv.checks.filter((c) => c.level === 'error').map((c) => c.message).join(' | ');
  assert.match(msgs, /25 not found in the evidence it cites/);
  assert.match(msgs, /does not exist \(e99\)/);
  assert.match(msgs, /hardworking/);
  assert.match(msgs, /team player/);
  assert.match(msgs, /role that is not in the verified record/);
  assert.match(msgs, /7 not found anywhere in the evidence/);
});

test('a team result written as a solo achievement is flagged for Samuel', async () => {
  fakeProvider({ write: (input) => { const w = goodWriting(input); w.experience[1].bullets[0].text = 'Delivered the warehouse relocation project on time'; return w; } });
  const id = await ready();
  await write(id);
  const cv = await draftOf(id, 'cv');
  assert.ok(cv.checks.some((c) => c.level === 'warning' && /team result/.test(c.message)));
});

test('a draft with errors cannot be approved by accident, but Samuel can approve anyway after checking', async () => {
  fakeProvider({ write: (input) => { const w = goodWriting(input); w.summary.text = 'Saved the company 40,000 euro.'; return w; } });
  const id = await ready();
  await write(id);
  const cv = await draftOf(id, 'cv');
  await assert.rejects(() => approveDraft(h.db, id, cv.id), /marked in red/);
  await approveDraft(h.db, id, cv.id, { override: true });
  assert.equal((await draftOf(id, 'cv')).status, 'approved');
});

test('edits are checked again: a hand-typed figure is caught, the fix clears it, and editing an approved draft un-approves it', async () => {
  fakeProvider();
  const id = await ready();
  await write(id);
  let cv = await draftOf(id, 'cv');
  await approveDraft(h.db, id, cv.id);
  const bad = structuredClone(cv.content);
  bad.experience[0].bullets[0].text = 'Cut late deliveries by 30% over 2022';
  const r1 = await updateDraft(h.db, id, cv.id, bad);
  assert.ok(r1.checks.some((c) => c.level === 'error' && /30/.test(c.message)));
  cv = await draftOf(id, 'cv');
  assert.equal(cv.status, 'draft', 'an edit takes the approval away');
  assert.equal(cv.edited, true);
  bad.experience[0].bullets[0].text = 'Reduced late deliveries by 18% across 2022';
  const r2 = await updateDraft(h.db, id, cv.id, bad);
  assert.deepEqual(r2.checks.filter((c) => c.level === 'error'), []);
  await assert.rejects(() => updateDraft(h.db, id, cv.id, { headline: 'only a headline' }), /does not fit/);
});

test('writing waits while an essential question is open', async () => {
  fakeProvider({ extract: goodExtraction({ missing_information: [{ title: 'Right to work in Ireland not stated', why_it_matters: 'The role requires it.', essential: true }] }) });
  const id = await ready();
  await assert.rejects(() => write(id), /Essential questions are still open/);
});

test('a failed draft is saved as failed with the reason, and Retry finishes it', async () => {
  fakeProvider({ writeFails: 1, writePermanent: true });
  const id = await ready();
  await write(id);
  let v = await view(id);
  assert.equal(v.drafts[0].status, 'failed');
  assert.match(v.drafts[0].error, /rejected/);
  assert.equal(v.status, 'ready_for_positioning');
  const again = await retryWriting(h.db, id, h.schedule);
  await h.idle();
  assert.equal(again.started, true);
  v = await view(id);
  assert.equal(v.drafts[0].status, 'draft');
  assert.equal(v.status, 'in_review');
});

test('transient AI errors are retried inside one draft without failing it', async () => {
  fakeProvider({ writeFails: 1 });
  const id = await ready();
  await write(id);
  assert.equal((await draftOf(id, 'cv')).status, 'draft');
});

test('the Word file uses the verified record for names, employers and dates, not the model', async () => {
  fakeProvider();
  const id = await ready();
  await write(id);
  const cv = await draftOf(id, 'cv');
  const f = await renderDraftFile(h.db, id, cv.id);
  assert.equal(f.filename, 'Jordan-Test-CV.docx');
  const xml = await (await JSZip.loadAsync(f.bytes)).file('word/document.xml').async('string');
  const text = xml.replace(/<[^>]+>/g, '');
  for (const s of ['Jordan Test', 'Harbour Freight Ltd', 'Operations Coordinator', 'Jan 2021', 'Lee Valley Distribution', 'BA Business Studies', 'Cut late deliveries by 18% over 2022']) {
    assert.ok(text.includes(s), `document contains ${s}`);
  }
});

test('nothing can be sent until every client document is approved; then one Send emails them once', async () => {
  fakeProvider();
  const id = await ready('full_package');
  await write(id, { jobAd: 'Logistics Coordinator, Northwind Logistics' });
  let v = await view(id);
  assert.equal(v.readyToSend, false);
  await assert.rejects(() => sendDelivery(h.db, id, v.email), /Approve every client document/);
  for (const d of v.drafts.filter((x) => x.clientFacing)) await approveDraft(h.db, id, d.id, { override: true });
  v = await view(id);
  assert.equal(v.readyToSend, true, 'the internal interview brief does not need approval to send');
  assert.match(v.email.body, /two free rounds/);
  const out = await sendDelivery(h.db, id, v.email);
  assert.deepEqual(out.files, ['Jordan-Test-CV.docx', 'Jordan-Test-LinkedIn-Profile.docx', 'Jordan-Test-Cover-Letter.docx']);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'jordan.test@example.com');
  assert.equal(outbox[0].attachments.length, 3, 'the interview prep brief is never emailed to the client');
  assert.ok(outbox[0].attachments.every((a) => a.content[0] === 0x50 && a.content[1] === 0x4b), 'real .docx files');
  v = await view(id);
  assert.equal(v.status, 'delivered');
  assert.equal(v.deliveries.length, 1);
  await assert.rejects(() => sendDelivery(h.db, id, v.email), /already been sent/);
  assert.equal(outbox.length, 1, 'a second press never emails twice');
  await assert.rejects(() => updateDraft(h.db, id, v.drafts[0].id, v.drafts[0].content), /already been sent/);
});

test('a failed email leaves nothing marked as sent, so Send can be pressed again', async () => {
  fakeProvider();
  const id = await ready();
  await write(id);
  const cv = await draftOf(id, 'cv');
  await approveDraft(h.db, id, cv.id);
  setMailerForTests(async () => { throw new Error('SMTP down'); });
  const v = await view(id);
  await assert.rejects(() => sendDelivery(h.db, id, v.email), /could not be sent/);
  assert.equal((await view(id)).deliveries.length, 0);
  setMailerForTests(async (m) => { outbox.push(m); return { messageId: 'x' }; });
  await sendDelivery(h.db, id, v.email);
  assert.equal(outbox.length, 1);
});

test('a revision writes a new version from the previous one plus the feedback, and counts against the allowance', async () => {
  const p = fakeProvider();
  const id = await ready();
  await write(id);
  const cv = await draftOf(id, 'cv');
  await approveDraft(h.db, id, cv.id);
  await sendDelivery(h.db, id, (await view(id)).email);
  await assert.rejects(() => startRevision(h.db, id, '  ', h.schedule), /Paste what the client asked/);
  await startRevision(h.db, id, 'Please put the dispatch line first.', h.schedule);
  await h.idle();
  const v = await view(id);
  assert.equal(v.version, 2);
  assert.equal(v.status, 'in_review');
  assert.equal(v.revisions.used, 1);
  assert.equal(v.revisions.allowance, 1);
  const last = p.seen.write.at(-1);
  assert.equal(last.revisionNote, 'Please put the dispatch line first.');
  assert.equal(last.previous.headline, cv.content.headline);
  assert.match(v.email.subject, /updated/);
});

test('cover letter: a company that is not in the job ad is an error', () => {
  const ctx = { evidence: [{ id: 'e1', claim: 'Reduced late deliveries by 18%', quote: 'reduced late deliveries by 18%', status: 'source_documented', ownership: 'individual' }], record: { roles: [] }, jobAd: 'Coordinator role at Northwind Logistics', package: 'cover_letter', sourceText: '' };
  const letter = { company: 'Contoso Freight', role_title: 'Coordinator', greeting: 'Dear Hiring Manager,', paragraphs: [{ text: 'I reduced late deliveries by 18%.', evidence: ['e1'] }], sign_off: 'Kind regards,', notes: [] };
  assert.ok(checkDraft('cover_letter', letter, ctx).some((c) => c.level === 'error' && /Contoso/.test(c.message)));
  letter.company = 'Northwind Logistics';
  assert.ok(!checkDraft('cover_letter', letter, ctx).some((c) => c.level === 'error'));
});

test('API: the new routes need a session, and a signed-in Samuel can write, approve, download and send', async () => {
  fakeProvider();
  const id = await ready();
  const call = async (opts) => { const res = makeRes(); await handleDelivery(makeReq(opts), res, { schedule: h.schedule }); return res; };
  for (const [method, path] of [['GET', ['candidates', id, 'deliverables']], ['POST', ['candidates', id, 'write']], ['POST', ['candidates', id, 'send']], ['GET', ['candidates', id, 'drafts', 'x', 'file']]]) {
    assert.equal((await call({ method, path })).statusCode, 401, `${method} ${path.join('/')}`);
  }
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken())}`;
  assert.equal((await call({ method: 'POST', path: ['candidates', id, 'write'], cookie, json: { jobAd: '' } })).statusCode, 202);
  await h.idle();
  const v = (await call({ method: 'GET', path: ['candidates', id, 'deliverables'], cookie })).body;
  const d = v.drafts[0];
  assert.equal((await call({ method: 'POST', path: ['candidates', id, 'drafts', d.id, 'approve'], cookie, json: {} })).statusCode, 200);
  const file = await call({ method: 'GET', path: ['candidates', id, 'drafts', d.id, 'file'], cookie });
  assert.equal(file.statusCode, 200);
  assert.match(file.headers['content-type'], /wordprocessingml/);
  const sent = await call({ method: 'POST', path: ['candidates', id, 'send'], cookie, json: v.email });
  assert.equal(sent.statusCode, 200);
  assert.equal(outbox.length, 1);
});

test('a client intake can carry the job ad, and it reaches the writer', async () => {
  const p = fakeProvider();
  const id = await ready('cv_positioning', { jobAd: 'Warehouse Coordinator, Northwind Logistics, Cork' });
  await write(id);
  assert.equal(p.seen.write[0].jobAd, 'Warehouse Coordinator, Northwind Logistics, Cork');
});
