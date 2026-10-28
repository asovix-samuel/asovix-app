// End-to-end demonstration against the REAL database, storage and Claude, with a synthetic candidate.
//   node --env-file=.env.local scripts/delivery-demo.mjs 1        intake + first analysis
//   node --env-file=.env.local scripts/delivery-demo.mjs 2        (new process) answers + continued analysis
//   node --env-file=.env.local scripts/delivery-demo.mjs 3        (new process) final state
//   node --env-file=.env.local scripts/delivery-demo.mjs cleanup  removes the synthetic candidate and file
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { getDb } from '../lib/delivery/db.js';
import { createCandidate, getCandidateView, startProcessing, updateQuestion } from '../lib/delivery/service.js';
import { deleteFile } from '../lib/delivery/storage.js';
import { makePdf } from '../tests/delivery/fixtures.js';

const STATE = process.env.DEMO_STATE || './.delivery-demo-state.json';
const phase = process.argv[2];
const db = await getDb();
const jobs = [];
const schedule = (p) => jobs.push(p);
const line = (...a) => console.log(a.join(' '));
const show = async (id) => {
  const v = await getCandidateView(db, id);
  line(`  status: ${v.candidate.status}  (${v.candidate.status_detail || ''})`);
  if (v.latestRun) {
    const r = v.latestRun;
    line(`  last run: ${r.status}, ${r.attempts} attempt(s), ${r.duration_ms} ms, model ${r.model}, tokens ${r.input_tokens}/${r.output_tokens}, cost ${r.cost_usd ?? 'not priced'}`);
  }
  return v;
};

if (phase === '1') {
  const page1 = [
    'AOIFE SYNTHETIC', 'aoife.synthetic@example.com | Cork', 'PROFILE',
    'Site coordinator with 10 years of experience in construction.', '[Insert career objective]',
    'EXPERIENCE',
    'Project Assistant, Cork Build Ltd, 2019 - 2021',
    'Prepared weekly progress reports for the project manager.',
    'Site Coordinator, Harbour Works Ltd, Jun 2020 - Present',
    'Scheduled subcontractors across three sites.',
    'We completed a 2M euro school build on schedule.',
    'Intern, Lee Civil',
  ].join('\n');
  const page2 = ['EDUCATION', 'BEng Civil Engineering, Munster University', 'SKILLS', 'Excel, AutoCAD, health and safety',
    'Took on feedback from the site engineer and completed a CSCS card course in 2021.'].join('\n');
  const bytes = await makePdf([page1, page2]);
  const key = 'demo-' + Date.now();
  line('1) INTAKE: uploading synthetic CV (2 pages), target role Site Engineer, Dublin');
  const out = await createCandidate(db, {
    submissionKey: key, name: 'Aoife Synthetic', email: 'aoife.synthetic@example.com', targetRole: 'Site Engineer', location: 'Dublin, Ireland',
    goal: 'Move from coordination into a site engineer role on larger projects', package: 'cv_positioning', manualTest: true,
    file: { name: 'aoife-synthetic-cv.pdf', bytes },
  }, schedule);
  writeFileSync(STATE, JSON.stringify({ id: out.candidateId, key }));
  line('   candidate saved; analysis started (runs inside this process, like a request on Vercel)');
  const t0 = Date.now();
  await Promise.all(jobs);
  line(`2) ANALYSIS finished in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const v = await show(out.candidateId);
  line('\nEVIDENCE LEDGER');
  for (const c of v.claims) line(`  [${c.status}] ${c.category}: ${c.claim}  — ${c.source_filename || 'no doc'} p.${c.source_page ?? '-'} ${c.source_section ?? ''}${c.status_reason ? '  (' + c.status_reason + ')' : ''}`);
  line('\nISSUES');
  for (const f of v.findings) line(`  [${f.severity}${f.essential ? ', ESSENTIAL' : ''}, ${f.origin}] ${f.title}`);
  line('\nQUESTIONS');
  for (const q of v.questions) line(`  [${q.status}${q.essential ? ', essential' : ''}] ${q.text}`);
} else if (phase === '2') {
  const { id } = JSON.parse(readFileSync(STATE, 'utf8'));
  line('RESTARTED PROCESS: reading saved state from the database');
  let v = await show(id);
  line(`  saved: ${v.claims.length} claims, ${v.findings.length} issues, ${v.questions.length} questions, ${v.documents.length} document(s)`);
  const open = v.questions.filter((q) => q.status === 'open');
  const answers = [
    [/intern|Lee Civil/i, 'The internship at Lee Civil was Jul 2018 to Sep 2018, a summer placement during my degree.'],
    [/years of experience|10 years|total/i, 'The 10 years was a typo. I have about 5 years in total, since 2019.'],
    [/overlap|Project Assistant|part-time|fit together/i, 'The Project Assistant job was part-time and ended in Dec 2020, then I started as Site Coordinator in Jun 2020 alongside it.'],
    [/school|2 million|individual role|contribution/i, 'I personally scheduled all subcontractors and tracked the budget for the school build.'],
    [/setting out|surveying|technical|levels|drawings/i, 'I have set out foundations and taken levels on the school build under the site engineer, about 6 months of it.'],
    [/autocad/i, 'I use AutoCAD weekly to mark up site layout drawings.'],
    [/objective|placeholder|template/i, 'Please drop the objective line; I will not use one.'],
  ];
  line('\n3) SAVING ANSWERS for the open questions');
  for (const q of open) {
    const a = answers.find(([re]) => re.test(q.text)) || [null, 'Please see the CV; I can send more detail by email.'];
    await updateQuestion(db, id, q.id, { answer: a[1] });
    line(`  answered: ${q.text.slice(0, 80)}`);
  }
  v = await show(id);
  line(`  (saved answers not yet analysed: ${v.pendingAnswers}; button now says: ${v.next.kind})`);
  line('\n4) CONTINUE ANALYSIS with the answers');
  const s = await startProcessing(db, id, 'rerun', schedule);
  line('  started:', s.started, s.reason || '');
  const t0 = Date.now();
  await Promise.all(jobs);
  line(`  finished in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  v = await show(id);
  for (const c of v.claims.filter((x) => x.status === 'client_confirmed')) line(`  [client_confirmed] ${c.claim}`);
  line('  open questions now:', v.questions.filter((q) => q.status === 'open').length);
  line('\n5) Pressing Continue again with nothing changed:');
  const again = await startProcessing(db, id, 'rerun', schedule);
  line('  started:', again.started, '-', again.message);
} else if (phase === '3') {
  const { id } = JSON.parse(readFileSync(STATE, 'utf8'));
  line('SECOND RESTART: final saved state');
  const v = await show(id);
  line('CLAIMS');
  for (const c of v.claims) line(`  [${c.status}] ${c.claim}`);
  line('ISSUES (addressed = resolved by a client answer)');
  for (const f of v.findings) line(`  [${f.addressed ? 'addressed' : 'OPEN'}${f.essential ? ', essential' : ''}] ${f.title}`);
  line('OPEN QUESTIONS');
  for (const q of v.questions.filter((x) => x.status === 'open')) line(`  [${q.essential ? 'essential' : 'helpful'}] ${q.text}`);
  line(`  runs: ${v.runs.length}; claims: ${v.claims.length}; answered questions: ${v.questions.filter((q) => q.status === 'answered').length}; status history:`);
  for (const e of v.events.slice().reverse()) line(`    ${e.to_status}${e.note ? ' — ' + e.note : ''}`);
  const rows = await db.query('SELECT COUNT(*)::int AS n FROM ai_calls WHERE candidate_id = $1', [id]);
  line(`  AI calls recorded: ${rows[0].n}`);
} else if (phase === 'cleanup') {
  const { id } = JSON.parse(readFileSync(STATE, 'utf8'));
  const docs = await db.query('SELECT storage_name FROM documents WHERE candidate_id = $1', [id]);
  for (const d of docs) await deleteFile(id, d.storage_name);
  await db.query('DELETE FROM candidates WHERE id = $1', [id]);
  await db.query("DELETE FROM orders WHERE source = 'manual_test' AND id NOT IN (SELECT order_id FROM candidates WHERE order_id IS NOT NULL)");
  if (existsSync(STATE)) unlinkSync(STATE);
  line('synthetic candidate, file and test order removed');
}
await db.close();
