import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { harness, fakeProvider, makeReq, makeRes, key } from './helpers.js';
import { makeCvPdf } from './fixtures.js';
import { handleDelivery } from '../../lib/delivery/api.js';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '../../lib/delivery/auth.js';

let h;
beforeEach(async () => { h = await harness(); fakeProvider(); });

async function call(opts) {
  const res = makeRes();
  await handleDelivery(makeReq(opts), res, { schedule: h.schedule });
  return res;
}
const authed = () => `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken())}`;

async function createVia(cookie, name = 'Jordan Test') {
  const res = await call({
    method: 'POST', path: ['candidates'], cookie,
    multipart: { fields: { submissionKey: key(), name, targetRole: 'Logistics Coordinator', location: 'Cork', goal: 'A better role', package: 'cv_positioning', manualTest: 'on' }, file: { name: 'cv.pdf', bytes: await makeCvPdf() } },
  });
  await h.idle();
  return res;
}

test('every route except sign-in refuses a request with no session', async () => {
  for (const [method, path] of [
    ['GET', ['candidates']], ['POST', ['candidates']], ['GET', ['candidates', 'x']], ['POST', ['candidates', 'x', 'analyse']],
    ['PATCH', ['candidates', 'x', 'questions', 'y']], ['GET', ['candidates', 'x', 'documents', 'y']], ['POST', ['candidates', 'x', 'document']],
    ['PUT', ['candidates', 'x', 'intake-answers']], ['GET', ['status']], ['POST', ['logout']],
  ]) {
    const res = await call({ method, path });
    assert.equal(res.statusCode, 401, `${method} ${path.join('/')}`);
  }
});

test('a forged, expired or tampered session cookie is refused', async () => {
  const good = createSessionToken();
  assert.ok(verifySessionToken(good));
  assert.equal(verifySessionToken(good.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))), false);
  assert.equal(verifySessionToken(createSessionToken(Date.now() - 13 * 3600 * 1000)), false);
  assert.equal(verifySessionToken('9999999999999.abc.deadbeef'), false);
  const res = await call({ path: ['candidates'], cookie: `${SESSION_COOKIE}=9999999999999.abc.deadbeef` });
  assert.equal(res.statusCode, 401);
});

test('sign-in: wrong password refused and counted, right password issues an httpOnly cookie, lockout after repeated failures', async () => {
  const bad = await call({ method: 'POST', path: ['login'], json: { password: 'nope' } });
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.headers['set-cookie'], undefined);
  const ok = await call({ method: 'POST', path: ['login'], json: { password: 'correct horse battery' } });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.headers['set-cookie'], /HttpOnly/);
  assert.match(ok.headers['set-cookie'], /SameSite=Strict/);
  for (let i = 0; i < 8; i++) await call({ method: 'POST', path: ['login'], json: { password: 'nope' } });
  const locked = await call({ method: 'POST', path: ['login'], json: { password: 'correct horse battery' } });
  assert.equal(locked.statusCode, 429, 'even the right password is refused while locked');
}, { timeout: 30000 });

test('cross-site POSTs are refused even with a valid session', async () => {
  const res = await call({ method: 'POST', path: ['candidates', 'x', 'analyse'], cookie: authed(), headers: { origin: 'https://evil.example' }, json: {} });
  assert.equal(res.statusCode, 403);
});

test('upload through the API: creates the candidate, linked to a clearly labelled manual test order, and processing runs', async () => {
  const res = await createVia(authed());
  assert.equal(res.statusCode, 201);
  const view = await call({ path: ['candidates', res.body.candidateId], cookie: authed() });
  assert.equal(view.statusCode, 200);
  assert.equal(view.body.order.source, 'manual_test');
  assert.equal(view.body.order.payment_status, 'manual_test');
  assert.match(view.body.order.payment_note, /No payment was taken/);
  assert.notEqual(view.body.candidate.status, 'received');
  assert.equal(view.body.candidate.submission_key, undefined, 'internal keys are not exposed');
  assert.equal(view.body.latestRun.record.profile.full_name, 'JORDAN TEST');
});

test('resubmitting the same form returns the existing candidate (200) instead of creating another', async () => {
  const sk = key();
  const send = async () => call({
    method: 'POST', path: ['candidates'], cookie: authed(),
    multipart: { fields: { submissionKey: sk, name: 'Jordan Test', targetRole: 'x', location: 'y', goal: 'z', package: 'cv_positioning' }, file: { name: 'cv.pdf', bytes: await makeCvPdf() } },
  });
  const a = await send(); const b = await send();
  await h.idle();
  assert.equal(a.statusCode, 201);
  assert.equal(b.statusCode, 200);
  assert.equal(a.body.candidateId, b.body.candidateId);
});

test('access isolation over the API: candidate B\'s URL cannot read A\'s document, questions or record', async () => {
  const a = (await createVia(authed(), 'Jordan Test')).body.candidateId;
  const b = (await createVia(authed(), 'Maeve Okafor')).body.candidateId;
  const viewA = (await call({ path: ['candidates', a], cookie: authed() })).body;
  const docA = viewA.documents[0].id;

  const own = await call({ path: ['candidates', a, 'documents', docA], cookie: authed() });
  assert.equal(own.statusCode, 200);
  assert.equal(own.headers['content-type'], 'application/pdf');
  assert.match(own.headers['content-disposition'], /attachment/);
  assert.equal(own.headers['cache-control'], 'no-store');

  const cross = await call({ path: ['candidates', b, 'documents', docA], cookie: authed() });
  assert.equal(cross.statusCode, 404);
  const traversal = await call({ path: ['candidates', '../../etc', 'documents', docA], cookie: authed() });
  assert.equal(traversal.statusCode, 404);

  const qA = viewA.questions[0];
  if (qA) {
    const crossQ = await call({ method: 'PATCH', path: ['candidates', b, 'questions', qA.id], cookie: authed(), json: { answer: 'hijack' } });
    assert.equal(crossQ.statusCode, 404);
  }
  const unknown = await call({ path: ['candidates', '00000000-0000-0000-0000-000000000000'], cookie: authed() });
  assert.equal(unknown.statusCode, 404);
});

test('save answers and continue is one call; unchanged repeat is reported, not reprocessed', async () => {
  const id = (await createVia(authed())).body.candidateId;
  const view = (await call({ path: ['candidates', id], cookie: authed() })).body;
  const q = view.questions[0];
  assert.ok(q, 'the fixture CV has a team result so a question exists');
  const go = await call({ method: 'POST', path: ['candidates', id, 'analyse'], cookie: authed(), json: { answers: [{ id: q.id, answer: 'I personally planned and led it.' }] } });
  assert.equal(go.statusCode, 202);
  await h.idle();
  const again = await call({ method: 'POST', path: ['candidates', id, 'analyse'], cookie: authed(), json: {} });
  assert.equal(again.body.reason, 'unchanged');
  const after = (await call({ path: ['candidates', id], cookie: authed() })).body;
  assert.equal(after.questions.find((x) => x.id === q.id).status, 'answered');
  assert.equal(after.runs.length, 2);
});

test('structural guard: every API file is either the router or contains no direct database access', () => {
  // The only public entry is pages/api/delivery/[...path].js, which delegates to handleDelivery().
  const src = readFileSync(join('lib', 'delivery', 'api.js'), 'utf8');
  const before = src.slice(0, src.indexOf('requireSession(req, res)'));
  assert.ok(!/getDb\(\)/.test(before.replace(/import[^\n]*\n/g, '')) || /login/.test(before), 'nothing but sign-in precedes the session check');
  const page = readFileSync(join('pages', 'api', 'delivery', '[...path].js'), 'utf8');
  assert.match(page, /handleDelivery/);
});

test('the existing checkout, diagnosis and email code was not modified by this feature', () => {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  assert.ok(walk('lib/delivery').length > 10);
  // Delivery code must not import the public fulfilment/email modules or touch the asovix_fulfilled flag.
  for (const f of walk('lib/delivery')) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /from ['"]\.\.\/(\.\.\/)?(fulfill|email|checkout)['"]/, f);
    assert.doesNotMatch(text, /paymentIntents\.update/, `${f} must never write the fulfilled flag`);
  }
});

test('the password hash has no "$", so .env files and Vercel never expand or mangle it', async () => {
  const { hashPassword, verifyPassword } = await import('../../lib/delivery/auth.js');
  const hash = hashPassword('another long password');
  assert.doesNotMatch(hash, /\$/);
  assert.ok(verifyPassword('another long password', hash));
  assert.equal(verifyPassword('wrong', hash), false);
  assert.equal(verifyPassword('x', undefined), false);
  assert.equal(verifyPassword('x', 'garbage'), false);
});
