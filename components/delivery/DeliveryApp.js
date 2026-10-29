import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PACKAGES } from '../../lib/delivery/config';
import { CATEGORY, CLAIM_STATUS, KIND, PAYMENT, STATUS, money, secs, when } from './labels';
import { css } from './styles';
import Deliverables from './Deliverables';

// ── tiny fetch helper: always same-origin, always JSON errors surfaced as messages ──
async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(`/api/delivery/${path}`, { credentials: 'same-origin', ...opts });
  } catch (e) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  if (res.status === 401 && !path.startsWith('login')) {
    window.location.href = '/delivery/login';
    throw new Error('Signed out.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Something went wrong (${res.status}).`);
  return body;
}
const postJson = (path, data, method = 'POST') => api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

function Pill({ tone, children, title }) {
  return <span className={`dl-pill tone-${tone}`} title={title}>{children}</span>;
}

function Shell({ children, signedIn }) {
  const router = useRouter();
  async function signOut() {
    try { await api('logout', { method: 'POST' }); } catch (e) { /* leaving anyway */ }
    router.push('/delivery/login');
  }
  return (
    <div className="dl-wrap">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <header className="dl-top">
        <Link href="/delivery" className="dl-brand">Asovix<em>.</em><small>Delivery · private</small></Link>
        {signedIn && (
          <nav className="dl-nav">
            <Link href="/delivery">Candidates</Link>
            <Link href="/delivery/new">New candidate</Link>
            <button className="dl-link" onClick={signOut}>Sign out</button>
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}

// ───────────────────────────── sign-in ─────────────────────────────
function Login() {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await postJson('login', { password: pw });
      window.location.href = '/delivery';
    } catch (e2) {
      setErr(e2.message); setBusy(false);
    }
  }
  return (
    <div style={{ maxWidth: 420, margin: '60px auto' }}>
      <h1 className="dl-h1">Delivery workspace</h1>
      <p className="dl-sub">Private. Sign in to continue.</p>
      <form className="dl-card" onSubmit={submit}>
        <label className="dl-field"><span>Password</span>
          <input className="dl-in" type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <div className="dl-banner tone-bad" role="alert">{err}</div>}
        <button className="dl-btn primary" disabled={busy || !pw} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

// ───────────────────────────── list ─────────────────────────────
function List() {
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(null);

  const load = useCallback(async () => {
    try { setRows((await api('candidates')).candidates); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => {
    load();
    api('status').then(setReady).catch(() => {});
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <div className="dl-between">
        <div><h1 className="dl-h1">Candidates</h1><p className="dl-sub">Each candidate’s evidence, open questions and delivery status.</p></div>
        <Link href="/delivery/new" className="dl-btn primary">New candidate</Link>
      </div>
      <Readiness ready={ready} />
      {err && <div className="dl-banner tone-bad" role="alert">{err} <button className="dl-link" onClick={load}>Retry</button></div>}
      {!rows && !err && <><div className="dl-skel" /><div className="dl-skel" /><div className="dl-skel" /></>}
      {rows && rows.length === 0 && <div className="dl-card"><p className="dl-sub" style={{ margin: 0 }}>No candidates yet. Add the first one with their original CV.</p></div>}
      {rows && rows.length > 0 && (
        <div className="dl-card" style={{ padding: '18px 8px' }}>
          <table className="dl-list">
            <thead><tr><th>Candidate</th><th className="hide-sm">Package</th><th className="hide-sm">Order</th><th>Status</th><th className="hide-sm">Updated</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const st = STATUS[r.status] || STATUS.received;
                const pay = r.payment_status ? PAYMENT[r.payment_status] : null;
                return (
                  <tr key={r.id} className="click" onClick={() => router.push(`/delivery/${r.id}`)}>
                    <td><Link href={`/delivery/${r.id}`} className="dl-name">{r.name}</Link><div className="dl-muted">{r.target_role} · {r.location}</div></td>
                    <td className="hide-sm">{PACKAGES[r.package] || r.package}</td>
                    <td className="hide-sm">{pay ? <Pill tone={pay.tone}>{pay.label}</Pill> : <span className="dl-muted">No order linked</span>}</td>
                    <td><Pill tone={st.tone}>{st.label}</Pill>{r.open_questions > 0 && <div className="dl-muted" style={{ marginTop: 6 }}>{r.open_questions} open question{r.open_questions === 1 ? '' : 's'}</div>}</td>
                    <td className="hide-sm dl-muted">{when(r.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Readiness({ ready }) {
  if (!ready) return null;
  const issues = [];
  if (!ready.ai) issues.push('AI is not configured (ANTHROPIC_API_KEY missing). Analysis will fail until it is added.');
  if (ready.storage === 'none') issues.push('File storage is not configured. CV uploads will fail.');
  if (ready.database === 'missing') issues.push('The database is not configured.');
  if (!ready.stripeCheck) issues.push('Payment checks are off (no Stripe or PayPal keys set). Linked orders will show as “not verified”.');
  if (!issues.length) return null;
  return <div className="dl-banner tone-warn">{issues.map((i) => <div key={i}>{i}</div>)}</div>;
}

// ───────────────────────────── new candidate ─────────────────────────────
function NewCandidate() {
  const router = useRouter();
  const [submissionKey] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [orderMode, setOrderMode] = useState('none');
  const lock = useRef(false);

  async function submit(e) {
    e.preventDefault();
    if (lock.current) return; // a second click while the first is in flight does nothing
    lock.current = true; setBusy(true); setErr('');
    try {
      const fd = new FormData(e.currentTarget);
      fd.set('submissionKey', submissionKey);
      if (orderMode !== 'stripe') fd.delete('stripeSessionId');
      if (orderMode !== 'test') fd.delete('manualTest');
      const res = await api('candidates', { method: 'POST', body: fd });
      router.push(`/delivery/${res.candidateId}`);
    } catch (e2) {
      setErr(e2.message); setBusy(false); lock.current = false;
    }
  }

  return (
    <>
      <h1 className="dl-h1">New candidate</h1>
      <p className="dl-sub">Upload the original CV exactly as the client sent it. The analysis starts automatically and nothing is sent to the client.</p>
      <form className="dl-card" onSubmit={submit}>
        <div className="dl-grid2">
          <label className="dl-field"><span>Candidate name</span><input className="dl-in" name="name" required maxLength={120} /></label>
          <label className="dl-field"><span>Email (optional)</span><input className="dl-in" name="email" type="email" maxLength={200} /></label>
          <label className="dl-field"><span>Target role</span><input className="dl-in" name="targetRole" required maxLength={200} placeholder="e.g. Logistics Coordinator" /></label>
          <label className="dl-field"><span>Location</span><input className="dl-in" name="location" required maxLength={120} placeholder="e.g. Cork, Ireland" /></label>
        </div>
        <label className="dl-field"><span>Client’s goal</span><textarea className="dl-ta" name="goal" required maxLength={2000} placeholder="What do they want from this job move, in their words?" /></label>
        <label className="dl-field"><span>Original CV (PDF or Word)</span><input className="dl-in" name="file" type="file" accept=".pdf,.docx" required /><small>Up to 4 MB. Read in full, including tables and any appended pages.</small></label>
        <label className="dl-field"><span>Purchased package</span>
          <select className="dl-sel" name="package" defaultValue="cv_positioning">
            {Object.entries(PACKAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <small>If you link a paid order below, the package that was actually bought is used.</small>
        </label>
        <label className="dl-field"><span>Existing answers from the candidate (optional)</span><textarea className="dl-ta" name="intakeAnswers" maxLength={20000} placeholder="Anything the client has already told you by email or call. It is treated as their own unverified words." /></label>

        <div className="dl-field">
          <span>Order</span>
          <div className="dl-row" style={{ marginBottom: 10 }}>
            {[['none', 'No order yet'], ['stripe', 'Link a paid order (Stripe or PayPal)'], ['test', 'Manual test record']].map(([v, l]) => (
              <label key={v} style={{ fontSize: 14, color: '#dbe5f5' }}><input type="radio" name="orderMode" checked={orderMode === v} onChange={() => setOrderMode(v)} /> {l}</label>
            ))}
          </div>
          {orderMode === 'stripe' && <><input className="dl-in" name="stripeSessionId" placeholder="PayPal order id, or cs_live_… (from the order alert email)" /><small>Checked with the payment provider from the server. If it cannot confirm it is paid, it is saved as “not verified”, never as paid.</small></>}
          {orderMode === 'test' && <><input type="hidden" name="manualTest" value="true" /><small>Saved as a clearly labelled TEST record. No payment is implied.</small></>}
        </div>

        {err && <div className="dl-banner tone-bad" role="alert">{err}</div>}
        <button className="dl-btn primary" type="submit" disabled={busy}>{busy ? <><span className="dl-spin" /> Uploading and starting…</> : 'Add candidate and start analysis'}</button>
      </form>
    </>
  );
}

// ───────────────────────────── candidate detail ─────────────────────────────
function Detail({ id }) {
  const [view, setView] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('evidence');
  const [drafts, setDrafts] = useState({}); // question id -> { text, answer }
  const [intake, setIntake] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const v = await api(`candidates/${id}`);
      setView((prev) => {
        if (!prev && ['ready_for_positioning', 'writing', 'in_review', 'delivered'].includes(v.candidate.status)) setTab('deliverables');
        return v;
      });
      setErr('');
      setIntake((cur) => (cur === null ? v.candidate.intake_answers : cur));
    } catch (e) { setErr(e.message); }
  }, [id]);

  const working = view && (view.running || view.candidate.status === 'extracting' || view.candidate.status === 'received');
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!working) return undefined;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [working, load]);

  if (err && !view) return <div className="dl-banner tone-bad" role="alert">{err} <button className="dl-link" onClick={load}>Retry</button></div>;
  if (!view) return <><div className="dl-skel" /><div className="dl-skel" /><div className="dl-skel" /></>;

  const { candidate: c, order, latestRun: run, claims, findings, questions, documents, next } = view;
  const st = STATUS[c.status] || STATUS.received;
  const openQs = questions.filter((q) => q.status === 'open');
  const draft = (q) => drafts[q.id] || {};
  const dirty = questions.filter((q) => drafts[q.id] && ((drafts[q.id].answer ?? q.answer ?? '') !== (q.answer ?? '') || (drafts[q.id].text ?? q.text) !== q.text));
  const intakeDirty = intake !== null && intake !== c.intake_answers;

  async function act(name, fn) {
    setBusy(name); setNote('');
    try { await fn(); await load(); } catch (e) { setNote(e.message); } finally { setBusy(''); }
  }
  const saveQuestion = (q) => act(`save-${q.id}`, async () => {
    const d = draft(q);
    await postJson(`candidates/${id}/questions/${q.id}`, { text: d.text ?? q.text, answer: d.answer ?? q.answer ?? '' }, 'PATCH');
    setDrafts((p) => { const n = { ...p }; delete n[q.id]; return n; });
  });
  const dismiss = (q) => act(`dismiss-${q.id}`, () => postJson(`candidates/${id}/questions/${q.id}`, { dismissed: true }, 'PATCH'));
  const reopen = (q) => act(`reopen-${q.id}`, () => postJson(`candidates/${id}/questions/${q.id}`, { reopen: true, answer: '' }, 'PATCH'));
  const addQ = () => {
    const text = window.prompt('Write the question for the client:');
    if (text && text.trim()) act('add', () => postJson(`candidates/${id}/questions`, { text }));
  };
  const analyse = () => act('analyse', async () => {
    const answers = dirty.filter((q) => (drafts[q.id].answer ?? q.answer ?? '') !== (q.answer ?? '')).map((q) => ({ id: q.id, answer: drafts[q.id].answer ?? '' }));
    for (const q of dirty) {
      if ((drafts[q.id].text ?? q.text) !== q.text) await postJson(`candidates/${id}/questions/${q.id}`, { text: drafts[q.id].text }, 'PATCH');
    }
    const out = await postJson(`candidates/${id}/analyse`, { answers, ...(intakeDirty ? { intakeAnswers: intake } : {}) });
    setDrafts({});
    if (!out.started) setNote(out.message || 'Nothing to do.');
  });
  const replaceFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    act('replace', async () => {
      const fd = new FormData(); fd.append('file', f);
      await api(`candidates/${id}/document`, { method: 'POST', body: fd });
    });
    e.target.value = '';
  };

  const label = { start: 'Run analysis', resume: `Resume analysis (${next.attemptsLeft} attempt${next.attemptsLeft === 1 ? '' : 's'} left)`, running: 'Analysis running…', unchanged: 'Up to date', limit: 'Retry limit reached' }[next.kind];
  const canGo = ['start', 'resume'].includes(next.kind) || ((dirty.length > 0 || intakeDirty) && next.kind !== 'running');

  return (
    <>
      <div className="dl-between">
        <div>
          <p className="dl-eyebrow"><Link href="/delivery" className="dl-link">← Candidates</Link></p>
          <h1 className="dl-h1">{c.name}</h1>
          <p className="dl-sub" style={{ marginBottom: 12 }}>{c.target_role} · {c.location} · {PACKAGES[c.package] || c.package}</p>
          <div className="dl-row">
            <Pill tone={st.tone}>{st.label}</Pill>
            {order ? <Pill tone={PAYMENT[order.payment_status].tone} title={order.payment_note}>{PAYMENT[order.payment_status].label}</Pill> : <span className="dl-muted">No order linked</span>}
          </div>
        </div>
        <button className="dl-btn primary" onClick={analyse} disabled={!canGo || !!busy}>
          {busy === 'analyse' || next.kind === 'running' ? <><span className="dl-spin" /> {busy === 'analyse' ? 'Saving…' : 'Analysis running…'}</> : (dirty.length || intakeDirty ? 'Save answers and continue analysis' : label)}
        </button>
      </div>

      {c.status_detail && <div className={`dl-banner tone-${st.tone === 'busy' ? 'blue' : st.tone}`} style={{ marginTop: 16 }} role={c.status === 'failed' ? 'alert' : undefined}>
        {working && <span className="dl-spin" style={{ marginRight: 8, verticalAlign: -3 }} />}{c.status_detail}
        {c.status === 'failed' && next.kind === 'limit' && <div style={{ marginTop: 6 }}>The retry limit for this exact input has been reached. Replace the file or change an answer to try again.</div>}
      </div>}
      {view.pendingAnswers > 0 && !dirty.length && <div className="dl-banner tone-warn">{view.pendingAnswers} saved answer{view.pendingAnswers === 1 ? ' is' : 's are'} not in the analysis yet. Press “{label}”.</div>}
      {note && <div className="dl-banner tone-bad" role="alert">{note}</div>}
      {order && order.payment_note && <div className="dl-banner tone-neutral">{order.payment_note}{order.confirmation_flag && <div style={{ marginTop: 4 }}>{order.confirmation_flag}</div>}</div>}

      {run && (
        <div className="dl-card">
          <p className="dl-eyebrow">Last analysis</p>
          <dl className="dl-kv">
            <dt>Finished</dt><dd>{when(run.finished_at)}</dd>
            <dt>Took</dt><dd>{secs(run.duration_ms) || '—'} · {run.attempts} attempt{run.attempts === 1 ? '' : 's'}</dd>
            <dt>Model</dt><dd>{run.model || '—'}</dd>
            <dt>Tokens</dt><dd>{run.input_tokens != null ? `${run.input_tokens.toLocaleString()} in · ${run.output_tokens.toLocaleString()} out` : 'not reported'}</dd>
            <dt>Cost</dt><dd>{money(run.cost_usd) || 'not recorded (set model prices to see cost)'}</dd>
          </dl>
        </div>
      )}

      <div className="dl-tabs" role="tablist">
        {[['deliverables', 'Deliverables'], ['evidence', 'Evidence', claims.length], ['issues', 'Issues', findings.filter((f) => !f.addressed).length], ['questions', 'Questions', openQs.length], ['record', 'Candidate record'], ['files', 'Files & activity']].map(([k, l, n]) => (
          <button key={k} role="tab" className="dl-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n != null && <span>{n}</span>}</button>
        ))}
      </div>

      {tab === 'deliverables' && <Deliverables id={id} api={api} postJson={postJson} onChanged={load} />}
      {tab === 'evidence' && <Evidence claims={claims} hasRun={!!run} working={working} />}
      {tab === 'issues' && <Issues findings={findings} hasRun={!!run} />}
      {tab === 'questions' && (
        <Questions {...{ questions, drafts, setDrafts, draft, saveQuestion, dismiss, reopen, addQ, busy, intake, setIntake, c }} />
      )}
      {tab === 'record' && <RecordView record={run && run.record} />}
      {tab === 'files' && <Files {...{ documents, id, replaceFile, busy, runs: view.runs, events: view.events }} />}
    </>
  );
}

function Evidence({ claims, hasRun, working }) {
  const [filter, setFilter] = useState('all');
  if (!hasRun) return <div className="dl-card dl-sub">{working ? 'Reading the documents and extracting evidence…' : 'No evidence yet. Run the analysis.'}</div>;
  if (!claims.length) return <div className="dl-card dl-sub">No claims were saved.</div>;
  const shown = claims.filter((c) => filter === 'all' || c.status === filter);
  const counts = (s) => claims.filter((c) => c.status === s).length;
  return (
    <div className="dl-card">
      <p className="dl-sub" style={{ marginTop: 0 }}>“Source-documented” means the document says it, not that it has been independently verified.</p>
      <div className="dl-row" style={{ marginBottom: 6 }}>
        <button className="dl-btn small" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} style={filter === 'all' ? { borderColor: '#4d8dff' } : null}>All {claims.length}</button>
        {Object.entries(CLAIM_STATUS).map(([k, v]) => counts(k) > 0 && <button key={k} className="dl-btn small" onClick={() => setFilter(k)} style={filter === k ? { borderColor: '#4d8dff' } : null}>{v.label} {counts(k)}</button>)}
      </div>
      {Object.entries(CATEGORY).map(([cat, catLabel]) => {
        const rows = shown.filter((c) => c.category === cat);
        if (!rows.length) return null;
        return (
          <div key={cat}>
            <div className="dl-cat">{catLabel}</div>
            {rows.map((c) => {
              const s = CLAIM_STATUS[c.status];
              return (
                <div className="dl-claim" key={c.id}>
                  <div>
                    <h4>{c.claim}</h4>
                    <div className="dl-row" style={{ gap: 8 }}>
                      <Pill tone={s.tone} title={s.hint}>{s.label}</Pill>
                      <span className="dl-muted">Relevance to role: <b style={{ color: '#dbe5f5' }}>{c.relevance}</b></span>
                    </div>
                    {c.relevance_note && <p className="dl-muted" style={{ margin: '8px 0 0' }}>{c.relevance_note}</p>}
                    {c.status_reason && <p style={{ margin: '8px 0 0', fontSize: 13.5, color: c.status === 'unsupported' ? '#f08a8a' : '#f0b35e' }}>{c.status_reason}</p>}
                  </div>
                  <div className="dl-src">
                    {c.source_quote ? <q>“{c.source_quote}”</q> : <span className="dl-muted">No source text.</span>}
                    <div className="where">
                      {c.source_kind === 'answer' ? 'Client’s own answer (unverified)' : c.source_filename
                        ? `${c.source_filename}${c.source_page ? ` · page ${c.source_page}` : ''}${c.source_section ? ` · ${c.source_section}` : ''}`
                        : 'Not found in the documents'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Issues({ findings, hasRun }) {
  if (!hasRun) return <div className="dl-card dl-sub">Issues appear after the first analysis.</div>;
  if (!findings.length) return <div className="dl-card dl-sub">No contradictions, gaps or template leftovers were found.</div>;
  return (
    <div className="dl-card">
      {findings.map((f) => (
        <div key={f.id} className={`dl-finding ${f.addressed ? 'done' : ''}`}>
          <div className="dl-row" style={{ gap: 8, marginBottom: 6 }}>
            <Pill tone={f.severity === 'high' ? 'bad' : f.severity === 'medium' ? 'warn' : 'neutral'}>{KIND[f.kind] || f.kind}</Pill>
            {f.essential && !f.addressed && <Pill tone="bad">Essential</Pill>}
            {f.addressed && <Pill tone="good">Addressed by a client answer</Pill>}
            <span className="dl-muted">{f.origin === 'code' ? 'Checked by code' : 'Found by AI, quotes verified'}</span>
          </div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{f.title}</div>
          {f.detail && <p style={{ margin: '4px 0 8px', fontSize: 14, lineHeight: 1.5 }}>{f.detail}</p>}
          {(f.evidence || []).map((e, i) => (
            <div className="dl-src" key={i} style={{ marginTop: 6 }}>
              <q>“{e.quote}”</q>
              {(e.page || e.section) && <div className="where">{e.page ? `page ${e.page}` : ''}{e.page && e.section ? ' · ' : ''}{e.section || ''}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Questions({ questions, drafts, setDrafts, draft, saveQuestion, dismiss, reopen, addQ, busy, intake, setIntake, c }) {
  const set = (q, patch) => setDrafts((p) => ({ ...p, [q.id]: { ...(p[q.id] || {}), ...patch } }));
  const open = questions.filter((q) => q.status === 'open');
  const closed = questions.filter((q) => q.status !== 'open');
  return (
    <>
      <div className="dl-card">
        <div className="dl-between"><p className="dl-sub" style={{ margin: 0 }}>Only questions that change accuracy or positioning. Edit the wording, then record the client’s answer. “Continue analysis” folds the answers in.</p>
          <button className="dl-btn small" onClick={addQ}>Add a question</button></div>
        {open.length === 0 && <p className="dl-muted" style={{ marginBottom: 0 }}>No open questions.</p>}
        {open.map((q) => <QuestionCard key={q.id} {...{ q, set, draft, saveQuestion, dismiss, busy }} />)}
      </div>
      <div className="dl-card">
        <label className="dl-field" style={{ marginBottom: 0 }}><span>Answers the client gave at intake</span>
          <textarea className="dl-ta" value={intake ?? ''} onChange={(e) => setIntake(e.target.value)} placeholder="Notes or emails from the client. Their own words, treated as unverified." />
          <small>Included in the next analysis{intake !== c.intake_answers ? ' (unsaved: press Save answers and continue analysis)' : ''}.</small>
        </label>
      </div>
      {closed.length > 0 && (
        <div className="dl-card">
          <p className="dl-eyebrow">Answered or dismissed</p>
          {closed.map((q) => (
            <div key={q.id} className="dl-finding">
              <div className="dl-row" style={{ gap: 8 }}><Pill tone={q.status === 'answered' ? 'good' : 'neutral'}>{q.status === 'answered' ? 'Answered' : 'Dismissed'}</Pill><span style={{ color: '#fff' }}>{q.text}</span></div>
              {q.answer && <div className="dl-src" style={{ marginTop: 8 }}><q>{q.answer}</q></div>}
              <button className="dl-link" style={{ marginTop: 6, fontSize: 13 }} onClick={() => reopen(q)}>Reopen</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function QuestionCard({ q, set, draft, saveQuestion, dismiss, busy }) {
  const d = draft(q);
  return (
    <div className="dl-finding">
      <div className="dl-row" style={{ gap: 8, marginBottom: 8 }}>
        {q.essential ? <Pill tone="bad">Essential</Pill> : <Pill tone="neutral">Helpful</Pill>}
        {q.manual && <span className="dl-muted">Added by you</span>}
      </div>
      <textarea className="dl-ta" style={{ minHeight: 60, color: '#fff', fontWeight: 600 }} value={d.text ?? q.text} onChange={(e) => set(q, { text: e.target.value })} aria-label="Question" />
      {q.why && <p className="dl-muted" style={{ margin: '6px 0 10px' }}>Why: {q.why}</p>}
      <textarea className="dl-ta" value={d.answer ?? q.answer ?? ''} onChange={(e) => set(q, { answer: e.target.value })} placeholder="The client’s answer, in their words…" aria-label="Client answer" />
      <div className="dl-row" style={{ marginTop: 8 }}>
        <button className="dl-btn small" onClick={() => saveQuestion(q)} disabled={!!busy || (d.text === undefined && d.answer === undefined)}>{busy === `save-${q.id}` ? 'Saving…' : 'Save'}</button>
        <button className="dl-btn small" onClick={() => dismiss(q)} disabled={!!busy}>Not needed</button>
      </div>
    </div>
  );
}

function RecordView({ record }) {
  if (!record) return <div className="dl-card dl-sub">The structured record appears after the first analysis.</div>;
  const src = (s) => <span className="dl-muted"> {s.filename}{s.page ? ` · p.${s.page}` : ''}{s.section ? ` · ${s.section}` : ''}</span>;
  const p = record.profile || {};
  return (
    <div className="dl-card">
      <dl className="dl-kv" style={{ marginBottom: 16 }}>
        <dt>Name in document</dt><dd>{p.full_name || '—'}</dd><dt>Email</dt><dd>{p.email || '—'}</dd><dt>Phone</dt><dd>{p.phone || '—'}</dd><dt>Location</dt><dd>{p.location || '—'}</dd>
      </dl>
      <div className="dl-cat">Roles</div>
      {record.roles.length === 0 && <p className="dl-muted">None found.</p>}
      {record.roles.map((r, i) => <div className="dl-finding" key={i}><b style={{ color: '#fff' }}>{r.title}</b> at {r.employer}<div className="dl-muted">{r.start_text || 'no start date'} to {r.end_text || 'no end date'}{src(r.source)}</div></div>)}
      <div className="dl-cat">Education</div>
      {record.education.length === 0 && <p className="dl-muted">None found.</p>}
      {record.education.map((e, i) => <div className="dl-finding" key={i}>{e.qualification}, {e.institution}<div className="dl-muted">{e.dates_text || 'no dates'}{src(e.source)}</div></div>)}
      {record.certifications.length > 0 && <><div className="dl-cat">Certifications</div>{record.certifications.map((e, i) => <div className="dl-finding" key={i}>{e.name}<div className="dl-muted">{e.date_text || 'no date'}{src(e.source)}</div></div>)}</>}
      {record.listedSkills.length > 0 && <><div className="dl-cat">Skills listed (not demonstrated)</div><p>{record.listedSkills.map((s) => s.skill).join(' · ')}</p></>}
      {record.eligibility.length > 0 && <><div className="dl-cat">Eligibility statements</div>{record.eligibility.map((e, i) => <div className="dl-finding" key={i}>{e.statement}{src(e.source)}</div>)}</>}
      {record.droppedUngrounded > 0 && <p className="dl-muted">{record.droppedUngrounded} item(s) were discarded because they could not be found in the document.</p>}
    </div>
  );
}

function Files({ documents, id, replaceFile, busy, runs, events }) {
  return (
    <>
      <div className="dl-card">
        <p className="dl-eyebrow">Original files (private)</p>
        {documents.map((d) => (
          <div className="dl-finding" key={d.id}>
            <div className="dl-between">
              <div><b style={{ color: '#fff' }}>{d.filename}</b> {!d.active && <span className="dl-muted">(replaced)</span>}
                <div className="dl-muted">{(d.size_bytes / 1024).toFixed(0)} KB{d.page_count ? ` · ${d.page_count} pages` : ''} · added {when(d.created_at)}</div></div>
              <a className="dl-btn small" href={`/api/delivery/candidates/${id}/documents/${d.id}`}>Download</a>
            </div>
            {d.extraction_status === 'failed' && <div className="dl-banner tone-bad" style={{ marginTop: 8 }}>{d.extraction_error}</div>}
            {(d.warnings || []).map((w, i) => <div className="dl-banner tone-warn" style={{ marginTop: 8 }} key={i}>{w}</div>)}
          </div>
        ))}
        <label className="dl-btn small" style={{ marginTop: 12 }}>{busy === 'replace' ? 'Uploading…' : 'Replace with another file'}<input type="file" accept=".pdf,.docx" onChange={replaceFile} style={{ display: 'none' }} /></label>
      </div>
      <div className="dl-card">
        <p className="dl-eyebrow">Runs</p>
        {runs.map((r) => (
          <div key={r.id} className="dl-finding"><div className="dl-row" style={{ gap: 8 }}><Pill tone={r.status === 'succeeded' ? 'good' : r.status === 'failed' ? 'bad' : 'busy'}>{r.status}</Pill><span className="dl-muted">{when(r.started_at)} · {r.attempts} attempt(s) · step: {r.step}{r.duration_ms != null ? ` · ${secs(r.duration_ms)}` : ''}{r.cost_usd != null ? ` · ${money(r.cost_usd)}` : ''}</span></div>{r.error && <div style={{ color: '#f08a8a', fontSize: 13.5, marginTop: 6 }}>{r.error}</div>}</div>
        ))}
        {runs.length === 0 && <p className="dl-muted">No runs yet.</p>}
      </div>
      <div className="dl-card">
        <p className="dl-eyebrow">Status history</p>
        {events.map((e, i) => <div key={i} className="dl-muted" style={{ padding: '4px 0' }}>{when(e.at)} · {STATUS[e.to_status] ? STATUS[e.to_status].label : e.to_status}{e.note ? ` — ${e.note}` : ''}</div>)}
      </div>
    </>
  );
}

// ───────────────────────────── entry ─────────────────────────────
export default function DeliveryApp({ slug }) {
  const [a] = slug;
  if (a === 'login') return <Shell signedIn={false}><Login /></Shell>;
  if (a === 'new') return <Shell signedIn><NewCandidate /></Shell>;
  if (a) return <Shell signedIn><Detail id={a} /></Shell>;
  return <Shell signedIn><List /></Shell>;
}
