import { useCallback, useEffect, useState } from 'react';
import { when } from './labels';

// Stage 2 screen: write drafts from the verified evidence, review and edit them, approve, send, revise.
// Nothing reaches the client until Samuel presses Send on fully approved documents.

const DRAFT_STATUS = {
  pending: { label: 'Queued', tone: 'neutral' },
  writing: { label: 'Writing…', tone: 'busy' },
  draft: { label: 'To review', tone: 'warn' },
  approved: { label: 'Approved', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
};

const LABELS = {
  headline: 'Headline', summary: 'Professional summary', key_skills: 'Key skills', skill: 'Skill', experience: 'Experience', bullets: 'Bullets',
  about: 'About', description: 'Description', top_skills: 'Skills to pin', company: 'Company', role_title: 'Role', greeting: 'Greeting',
  paragraphs: 'Paragraphs', sign_off: 'Sign-off', role_focus: 'What they are hiring to solve', likely_questions: 'Likely questions',
  question: 'Question', why_they_ask: 'Why they ask', answer_outline: 'Answer outline', stories: 'STAR stories', title: 'Title',
  situation_task: 'Situation / task', action_result: 'Action / result', risks: 'Concerns', concern: 'Concern', how_to_address: 'How to address',
};
const HIDDEN = new Set(['evidence', 'notes', 'high_leverage_lines', 'role']);
// The database does not keep key order, so fields are shown in reading order.
const ORDER = ['headline', 'summary', 'key_skills', 'about', 'company', 'role_title', 'greeting', 'paragraphs', 'sign_off', 'experience', 'top_skills',
  'role_focus', 'likely_questions', 'stories', 'risks', 'question', 'why_they_ask', 'answer_outline', 'title', 'situation_task', 'action_result',
  'concern', 'how_to_address', 'bullets', 'description'];
const rank = (k) => { const i = ORDER.indexOf(k); return i < 0 ? 99 : i; };
const label = (k) => LABELS[k] || String(k).replace(/_/g, ' ');

function Pill({ tone, children, title }) {
  return <span className={`dl-pill tone-${tone}`} title={title}>{children}</span>;
}

function Cites({ ids, evidence }) {
  if (!ids || !ids.length) return null;
  return (
    <span className="dl-cites">
      {ids.map((id) => {
        const e = evidence.find((x) => x.id === id);
        return <span key={id} className={`dl-cite${e ? '' : ' bad'}`} title={e ? `${e.claim}\n\nSource: “${e.quote}”` : 'Unknown evidence id'}>{id}</span>;
      })}
    </span>
  );
}

/** A generic editor: every string can be edited; evidence ids are shown beside the text they back. */
function Field({ value, path, onChange, evidence, roles, depth = 0, k }) {
  const set = (v) => onChange(path, v);
  if (typeof value === 'string') {
    const long = value.length > 90 || /summary|about|paragraph|text|answer|description|situation|action/.test(path.join('.'));
    return long
      ? <textarea className="dl-ta" value={value} onChange={(e) => set(e.target.value)} rows={Math.min(10, Math.max(2, Math.ceil(value.length / 95)))} />
      : <input className="dl-in" value={value} onChange={(e) => set(e.target.value)} />;
  }
  if (Array.isArray(value)) {
    return (
      <div className="dl-arr">
        {value.map((item, i) => (
          <div key={i} className="dl-arr-item">
            <Field value={item} path={[...path, i]} onChange={onChange} evidence={evidence} roles={roles} depth={depth + 1} k={k} />
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    // { text, evidence } pair: the text with its citations
    if (typeof value.text === 'string' && Array.isArray(value.evidence)) {
      return (
        <div className="dl-cited">
          <Field value={value.text} path={[...path, 'text']} onChange={onChange} evidence={evidence} roles={roles} depth={depth + 1} />
          <Cites ids={value.evidence} evidence={evidence} />
        </div>
      );
    }
    if (typeof value.skill === 'string') {
      return <div className="dl-cited"><Field value={value.skill} path={[...path, 'skill']} onChange={onChange} evidence={evidence} roles={roles} /><Cites ids={value.evidence} evidence={evidence} /></div>;
    }
    const role = value.role && roles.find((r) => r.id === value.role);
    return (
      <div className={depth ? 'dl-sub-block' : ''}>
        {value.role && <p className="dl-role">{role ? role.label : `${value.role} (not in the record)`}</p>}
        {Object.entries(value).filter(([key]) => !HIDDEN.has(key)).sort(([a], [b]) => rank(a) - rank(b)).map(([key, v]) => (
          <div key={key} className="dl-field">
            <span>{label(key)}</span>
            <Field value={v} path={[...path, key]} onChange={onChange} evidence={evidence} roles={roles} depth={depth + 1} k={key} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function setIn(obj, path, v) {
  if (!path.length) return v;
  const [h, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  copy[h] = setIn(obj[h], rest, v);
  return copy;
}

function DraftCard({ d, view, id, act, busy, postJson }) {
  const [content, setContent] = useState(d.content);
  const [open, setOpen] = useState(d.status !== 'approved');
  useEffect(() => { setContent(d.content); }, [d.id, d.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = DRAFT_STATUS[d.status] || DRAFT_STATUS.pending;
  const errors = (d.checks || []).filter((c) => c.level === 'error');
  const warnings = (d.checks || []).filter((c) => c.level === 'warning');
  const dirty = JSON.stringify(content) !== JSON.stringify(d.content);
  const sent = view.deliveries.some((x) => x.version === d.version);
  const onChange = (path, v) => setContent((c) => setIn(c, path, v));

  return (
    <div className="dl-card">
      <div className="dl-between">
        <div>
          <p className="dl-eyebrow">{d.clientFacing ? 'For the client' : 'Internal'} · version {d.version}{d.edited ? ' · edited' : ''}</p>
          <h3 className="dl-h3">{d.label}</h3>
          <div className="dl-row">
            <Pill tone={st.tone}>{st.label}</Pill>
            {d.content && <span className="dl-muted">{errors.length} problem{errors.length === 1 ? '' : 's'} · {warnings.length} note{warnings.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
        <div className="dl-row">
          {d.content && <a className="dl-btn small" href={`/api/delivery/candidates/${id}/drafts/${d.id}/file`}>Download .docx</a>}
          {d.content && <button className="dl-btn small" onClick={() => setOpen((o) => !o)}>{open ? 'Collapse' : 'Open'}</button>}
        </div>
      </div>
      {d.status === 'failed' && <div className="dl-banner tone-bad" style={{ marginTop: 12 }}>{d.error}</div>}
      {d.content && open && (
        <>
          {(d.content.notes || []).length > 0 && (
            <div className="dl-banner tone-blue" style={{ marginTop: 14 }}>
              <strong>Writer’s notes</strong>
              <ul className="dl-ul">{d.content.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              {(d.content.high_leverage_lines || []).length > 0 && <><strong>The lines that matter most</strong><ul className="dl-ul">{d.content.high_leverage_lines.map((n, i) => <li key={i}>{n}</li>)}</ul></>}
            </div>
          )}
          {(errors.length > 0 || warnings.length > 0) && (
            <div className="dl-checks">
              {errors.map((c, i) => <div key={`e${i}`} className="dl-check tone-bad"><strong>{c.where}:</strong> {c.message}</div>)}
              {warnings.map((c, i) => <div key={`w${i}`} className="dl-check tone-warn"><strong>{c.where}:</strong> {c.message}</div>)}
            </div>
          )}
          <p className="dl-muted" style={{ margin: '14px 0' }}>Hover an <span className="dl-cite">e1</span> tag to see the evidence a line rests on. Edits are checked again when you save.</p>
          <fieldset disabled={sent} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field value={content} path={[]} onChange={onChange} evidence={view.evidence} roles={view.roles} />
          </fieldset>
          {!sent && (
            <div className="dl-row" style={{ marginTop: 8 }}>
              <button className="dl-btn" disabled={!dirty || !!busy} onClick={() => act(`save-${d.id}`, () => postJson(`candidates/${id}/drafts/${d.id}`, { content }, 'PATCH'))}>
                {busy === `save-${d.id}` ? 'Saving…' : 'Save edits'}
              </button>
              {dirty && <button className="dl-link" onClick={() => setContent(d.content)}>Undo changes</button>}
              {d.status === 'draft' && !dirty && (errors.length === 0
                ? <button className="dl-btn primary" disabled={!!busy} onClick={() => act(`approve-${d.id}`, () => postJson(`candidates/${id}/drafts/${d.id}/approve`, {}))}>Approve</button>
                : <button className="dl-btn" disabled={!!busy} onClick={() => { if (window.confirm('This draft still has problems marked in red. Approve it anyway because you have checked them yourself?')) act(`approve-${d.id}`, () => postJson(`candidates/${id}/drafts/${d.id}/approve`, { override: true })); }}>Approve anyway</button>)}
              {d.status === 'approved' && <button className="dl-btn" disabled={!!busy} onClick={() => act(`unapprove-${d.id}`, () => postJson(`candidates/${id}/drafts/${d.id}/approve`, { unapprove: true }))}>Undo approval</button>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Deliverables({ id, api, postJson, onChanged }) {
  const [view, setView] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [jobAd, setJobAd] = useState(null);
  const [mail, setMail] = useState(null);
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    try {
      const v = await api(`candidates/${id}/deliverables`);
      setView(v); setErr('');
      setJobAd((cur) => (cur === null ? v.jobAd : cur));
      setMail((cur) => (cur === null || !v.readyToSend ? v.email : cur));
    } catch (e) { setErr(e.message); }
  }, [id, api]);
  useEffect(() => { load(); }, [load]);
  const writing = view && (view.status === 'writing' || view.drafts.some((d) => d.status === 'pending' || d.status === 'writing'));
  useEffect(() => {
    if (!writing) return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [writing, load]);

  async function act(name, fn) {
    setBusy(name); setNote('');
    try {
      const out = await fn();
      if (out && out.started === false && out.message) setNote(out.message);
      await load();
      if (onChanged) onChanged();
    } catch (e) { setNote(e.message); } finally { setBusy(''); }
  }

  if (err && !view) return <div className="dl-banner tone-bad" role="alert">{err}</div>;
  if (!view) return <div className="dl-skel" />;

  const failed = view.drafts.filter((d) => d.status === 'failed');
  const lastDelivery = view.deliveries[0];
  const sentLatest = lastDelivery && lastDelivery.version === view.version;
  const overAllowance = view.revisions.used >= view.revisions.allowance;
  const windowOver = view.revisions.windowEnds && new Date(view.revisions.windowEnds) < new Date();

  return (
    <>
      {note && <div className="dl-banner tone-bad" role="alert">{note}</div>}

      {!sentLatest && (
        <div className="dl-card">
          <p className="dl-eyebrow">{view.packageLabel}</p>
          <p className="dl-sub" style={{ marginBottom: 14 }}>
            Writes {view.planned.map((p) => p.label).join(', ')} from the verified evidence only. Every line cites the evidence it rests on, and code checks every figure.
          </p>
          <label className="dl-field"><span>Job ad (optional, but it makes the positioning and the cover letter much sharper)</span>
            <textarea className="dl-ta" value={jobAd || ''} onChange={(e) => setJobAd(e.target.value)} placeholder="Paste the full job ad the client is targeting" rows={5} />
          </label>
          {view.evidenceStale && <div className="dl-banner tone-warn">The evidence has changed since these drafts were written. Write a new version to use it.</div>}
          <div className="dl-row">
            <button className="dl-btn primary" disabled={!view.canWrite || writing || !!busy} onClick={() => act('write', () => postJson(`candidates/${id}/write`, { jobAd: jobAd || '' }))}>
              {writing ? <><span className="dl-spin" /> Writing…</> : view.version ? 'Write a fresh version' : 'Write drafts'}
            </button>
            {failed.length > 0 && !writing && <button className="dl-btn" disabled={!!busy} onClick={() => act('retry', () => postJson(`candidates/${id}/write/retry`, {}))}>Retry {failed.length} failed</button>}
            {!view.canWrite && !writing && <span className="dl-muted">Available once the analysis has no essential questions open.</span>}
          </div>
        </div>
      )}

      {view.drafts.map((d) => <DraftCard key={d.id} d={d} view={view} id={id} act={act} busy={busy} postJson={postJson} />)}

      {view.readyToSend && mail && (
        <div className="dl-card">
          <p className="dl-eyebrow">Send to the client</p>
          {!view.mailReady && <div className="dl-banner tone-warn">Email is not set up on the server (SMTP_USER / SMTP_PASS). Download the files and send them yourself, or add those settings in Vercel.</div>}
          <label className="dl-field"><span>To</span><input className="dl-in" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} /></label>
          <label className="dl-field"><span>Subject</span><input className="dl-in" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} /></label>
          <label className="dl-field"><span>Message</span><textarea className="dl-ta" rows={14} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} /></label>
          <p className="dl-muted" style={{ marginBottom: 12 }}>Attached: {view.drafts.filter((d) => d.clientFacing).map((d) => d.filename).join(', ')}</p>
          <button className="dl-btn primary" disabled={!view.mailReady || !!busy} onClick={() => { if (window.confirm(`Email ${view.drafts.filter((d) => d.clientFacing).length} document(s) to ${mail.to}?`)) act('send', () => postJson(`candidates/${id}/send`, mail)); }}>
            {busy === 'send' ? 'Sending…' : 'Send to client'}
          </button>
        </div>
      )}

      {view.deliveries.length > 0 && (
        <div className="dl-card">
          <p className="dl-eyebrow">Delivered</p>
          {view.deliveries.map((x) => (
            <p key={x.id} className="dl-sub" style={{ margin: '0 0 6px' }}>Version {x.version} sent to {x.sent_to} on {when(x.sent_at)}. {x.files.join(', ')}</p>
          ))}
          {sentLatest && (
            <>
              <p className="dl-sub" style={{ marginTop: 12 }}>
                Free revisions used: {view.revisions.used} of {view.revisions.allowance}. Window {windowOver ? 'ended' : 'ends'} {when(view.revisions.windowEnds)}.
                {(overAllowance || windowOver) && <strong> This revision is outside the free allowance (€15 for a minor revision; a different role is a new €65 job).</strong>}
              </p>
              <label className="dl-field"><span>What the client asked to change</span>
                <textarea className="dl-ta" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Paste their reply, or summarise the changes" />
              </label>
              <button className="dl-btn" disabled={!feedback.trim() || writing || !!busy} onClick={() => act('revise', async () => { const o = await postJson(`candidates/${id}/revise`, { feedback }); setFeedback(''); setMail(null); return o; })}>Write revision</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
