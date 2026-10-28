// Proves the real Postgres database works with the delivery schema. Synthetic rows only, removed afterwards.
//   node --env-file=.env.local scripts/delivery-check-db.mjs
import { randomUUID } from 'node:crypto';
import { getDb } from '../lib/delivery/db.js';

if (!process.env.DATABASE_URL) { console.log('DATABASE_URL is not set.'); process.exit(1); }
const host = new URL(process.env.DATABASE_URL.replace(/^postgres(ql)?:/, 'http:')).host;
console.log('connecting to:', host.replace(/^[^@]*@/, ''));
const t0 = Date.now();
const db = await getDb();
console.log('connected + schema created:', Date.now() - t0, 'ms, driver:', db.kind);

const tables = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('orders','candidates','documents','runs','claims','findings','questions','ai_calls','status_events','login_failures') ORDER BY 1")).map((r) => r.table_name);
console.log('tables present (' + tables.length + '/10):', tables.join(', '));

const id = randomUUID();
await db.tx(async (q) => {
  await q("INSERT INTO candidates (id, submission_key, name, target_role, location, goal, package, status) VALUES ($1,$2,'Synthetic Check','Test role','Cork','Test goal','other','received')", [id, 'check-' + id]);
  await q("INSERT INTO runs (id, candidate_id, input_hash, trigger, status, evidence_checkpoint) VALUES ($1,$2,'h','intake','running',$3::jsonb)", [randomUUID(), id, JSON.stringify({ ok: true, n: 1 })]);
});
const row = (await db.query('SELECT c.name, r.evidence_checkpoint AS cp FROM candidates c JOIN runs r ON r.candidate_id = c.id WHERE c.id = $1', [id]))[0];
console.log('write + read back (incl. JSONB):', row && row.name === 'Synthetic Check' && row.cp.ok === true ? 'ok' : 'FAILED');

// Transactions roll back on error.
let rolled = false;
try { await db.tx(async (q) => { await q("UPDATE candidates SET name = 'CHANGED' WHERE id = $1", [id]); throw new Error('boom'); }); } catch { rolled = true; }
const after = (await db.query('SELECT name FROM candidates WHERE id = $1', [id]))[0];
console.log('transaction rollback:', rolled && after.name === 'Synthetic Check' ? 'ok' : 'FAILED');

// Duplicate guard: same (candidate, input hash) cannot be inserted twice.
let blocked = false;
try { await db.query("INSERT INTO runs (id, candidate_id, input_hash, trigger, status) VALUES ($1,$2,'h','intake','running')", [randomUUID(), id]); } catch (e) { blocked = e.code === '23505'; }
console.log('duplicate-run guard:', blocked ? 'ok' : 'FAILED');

await db.query('DELETE FROM candidates WHERE id = $1', [id]);
const left = (await db.query('SELECT COUNT(*)::int AS n FROM candidates WHERE id = $1', [id]))[0].n;
console.log('cleanup:', left === 0 ? 'ok (test rows removed)' : 'FAILED');
await db.close();
