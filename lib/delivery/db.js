// ── Durable storage: Postgres ──
//
// Production: DATABASE_URL (Supabase / Neon / any Postgres; use the pooled
// connection string on serverless). Local development with no DATABASE_URL:
// an embedded Postgres (PGlite) saved in .delivery-data/, so the workspace runs
// on Samuel's computer with no setup and the same SQL as production.
//
// This is the only module that opens a database connection.

import { isProd } from './config.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('stripe','paypal','manual_test')),
  stripe_session_id TEXT UNIQUE,
  package TEXT,
  amount_cents INTEGER,
  currency TEXT,
  customer_email TEXT,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('verified_paid','not_verified','not_paid','manual_test')),
  payment_note TEXT,
  confirmation_flag TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check CHECK (source IN ('stripe','paypal','manual_test'));
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  submission_key TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  target_role TEXT NOT NULL,
  location TEXT NOT NULL,
  goal TEXT NOT NULL,
  package TEXT NOT NULL,
  intake_answers TEXT NOT NULL DEFAULT '',
  order_id TEXT REFERENCES orders(id),
  status TEXT NOT NULL CHECK (status IN ('received','extracting','awaiting_information','ready_for_positioning','failed','writing','in_review','delivered')),
  status_detail TEXT,
  latest_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending','done','failed')),
  extraction_error TEXT,
  page_count INTEGER,
  segments JSONB,
  warnings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  input_hash TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
  step TEXT NOT NULL DEFAULT 'extract',
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  evidence_checkpoint JSONB,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DOUBLE PRECISION,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  record JSONB,
  UNIQUE (candidate_id, input_hash)
);
CREATE TABLE IF NOT EXISTS ai_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DOUBLE PRECISION,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL,
  error TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  claim TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('source_documented','client_confirmed','needs_confirmation','unsupported')),
  status_reason TEXT,
  relevance TEXT NOT NULL CHECK (relevance IN ('high','medium','low','none')),
  relevance_note TEXT,
  ownership TEXT,
  document_id TEXT,
  source_page INTEGER,
  source_section TEXT,
  source_quote TEXT,
  source_kind TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  fkey TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high','medium','low')),
  essential BOOLEAN NOT NULL DEFAULT FALSE,
  addressed BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT NOT NULL,
  detail TEXT,
  evidence JSONB,
  origin TEXT NOT NULL CHECK (origin IN ('code','ai'))
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  topic_key TEXT NOT NULL,
  text TEXT NOT NULL,
  why TEXT,
  linked_keys JSONB NOT NULL DEFAULT '[]',
  essential BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('open','answered','dismissed','superseded')),
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  manual BOOLEAN NOT NULL DEFAULT FALSE,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS status_events (
  id BIGSERIAL PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT
);
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check CHECK (status IN ('received','extracting','awaiting_information','ready_for_positioning','failed','writing','in_review','delivered'));
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS job_ad TEXT NOT NULL DEFAULT '';
-- Stage 2: what we write for the client. One row per deliverable per version; a new version is a fresh set.
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cv','linkedin','cover_letter','interview_pack')),
  evidence_run_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','writing','draft','approved','failed')),
  content JSONB,
  checks JSONB NOT NULL DEFAULT '[]',
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  revision_note TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DOUBLE PRECISION,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, version, kind)
);
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  sent_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  files JSONB NOT NULL DEFAULT '[]',
  message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision_due_at TIMESTAMPTZ NOT NULL,
  UNIQUE (candidate_id, version)
);
CREATE INDEX IF NOT EXISTS idx_drafts_cand ON drafts(candidate_id);
CREATE TABLE IF NOT EXISTS login_failures (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_cand ON documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_runs_cand ON runs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_claims_run ON claims(run_id);
CREATE INDEX IF NOT EXISTS idx_findings_run ON findings(run_id);
CREATE INDEX IF NOT EXISTS idx_questions_cand ON questions(candidate_id);
`;

/**
 * Wraps a driver in { query(sql, params) -> rows[], tx(fn) }.
 * `exec` runs a multi-statement script (used for the schema).
 */
function wrapPg(pool) {
  const q = (client) => async (sql, params = []) => (await client.query(sql, params)).rows;
  return {
    kind: 'pg',
    query: q(pool),
    exec: (sql) => pool.query(sql),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(q(client));
        await client.query('COMMIT');
        return out;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch (e) { /* connection already gone */ }
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

export function wrapPglite(pg) {
  const q = (client) => async (sql, params = []) => (await client.query(sql, params)).rows;
  return {
    kind: 'pglite',
    query: q(pg),
    exec: (sql) => pg.exec(sql),
    tx: (fn) => pg.transaction(async (t) => fn(q(t))),
    close: () => pg.close(),
  };
}

const g = globalThis;

export async function getDb() {
  if (g.__deliveryDb) return g.__deliveryDb;
  // Share one in-flight connection so concurrent first requests don't each open one.
  if (!g.__deliveryDbPromise) {
    g.__deliveryDbPromise = (async () => {
      let db;
      if (process.env.DATABASE_URL) {
        const { default: pg } = await import('pg');
        const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);
        const pool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          max: 3,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 8000,
          ssl: local ? false : { rejectUnauthorized: false },
        });
        db = wrapPg(pool);
      } else if (!isProd()) {
        const { PGlite } = await import('@electric-sql/pglite');
        const { mkdirSync } = await import('node:fs');
        const dir = process.env.DELIVERY_LOCAL_DB || './.delivery-data/pg';
        mkdirSync(dir, { recursive: true }); // PGlite does not create missing parent folders
        db = wrapPglite(new PGlite(dir));
      } else {
        throw new Error('DATABASE_URL is not set. The delivery workspace needs a Postgres database (see DELIVERY-SETUP.md).');
      }
      await db.exec(SCHEMA);
      g.__deliveryDb = db;
      return db;
    })().catch((err) => { g.__deliveryDbPromise = null; throw err; });
  }
  return g.__deliveryDbPromise;
}

/** Tests inject an in-memory PGlite. */
export async function openMemoryDb() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = wrapPglite(new PGlite());
  await db.exec(SCHEMA);
  return db;
}

/** Tests inject their own database. */
export function setDbForTests(db) {
  g.__deliveryDb = db || undefined;
  g.__deliveryDbPromise = db ? Promise.resolve(db) : null;
}
