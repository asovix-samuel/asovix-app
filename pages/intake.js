import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Seo } from '../lib/seo';

// Client intake: opened from the confirmation page after a manual (full-service) order is paid.
// Talks only to /api/delivery/intake/<stripe session id>, which can reach this client's own order and nothing else.
const API = '/api/delivery/intake/';

export default function Intake() {
  const [sid, setSid] = useState(null);
  const [state, setState] = useState(null); // { stage, ... } from the server
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', targetRole: '', location: '', goal: '', extra: '', jobAd: '' });
  const [answers, setAnswers] = useState({});
  const fileRef = useRef();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function load(id) {
    try {
      const r = await fetch(API + encodeURIComponent(id));
      const json = await r.json().catch(() => ({}));
      if (!r.ok) { setError(json.error || 'Something went wrong. Please try again.'); return; }
      setError('');
      setState(json);
      if (json.stage === 'form' && json.email) setForm((f) => (f.email ? f : { ...f, email: json.email }));
    } catch {
      setError('We could not reach Asovix just now. Check your connection and try again.');
    }
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('session_id');
    if (!id) { setError('This page needs the link from your order confirmation. Open it from there.'); return; }
    setSid(id);
    load(id);
  }, []);

  // While we are reading the CV, check back every few seconds.
  useEffect(() => {
    if (!sid || !state || state.stage !== 'working') return undefined;
    const t = setInterval(() => load(sid), 4000);
    return () => clearInterval(t);
  }, [sid, state && state.stage]);

  async function sendDetails(e) {
    e.preventDefault();
    const file = fileRef.current && fileRef.current.files[0];
    if (!file) { setError('Please attach your current CV (PDF or Word).'); return; }
    if (file.size > 4 * 1024 * 1024) { setError('That file is over 4 MB. Please send a smaller version.'); return; }
    setBusy(true); setError('');
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    data.append('file', file);
    try {
      const r = await fetch(API + encodeURIComponent(sid), { method: 'POST', body: data });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) setError(json.error || 'Something went wrong. Please try again.');
      else setState(json);
    } catch {
      setError('We could not send that. Check your connection and try again.');
    }
    setBusy(false);
  }

  async function sendAnswers(e) {
    e.preventDefault();
    const list = Object.entries(answers).map(([id, answer]) => ({ id, answer })).filter((a) => a.answer.trim());
    if (!list.length) { setError('Write an answer to at least one question, even a short one.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch(API + encodeURIComponent(sid) + '/answers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: list }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) setError(json.error || 'Something went wrong. Please try again.');
      else { setState(json); setAnswers({}); }
    } catch {
      setError('We could not send that. Check your connection and try again.');
    }
    setBusy(false);
  }

  const stage = state && state.stage;
  const step = stage === 'form' ? 1 : stage === 'questions' || stage === 'working' ? 2 : 3;

  return (
    <>
      <Seo title="Tell Asovix about you" description="Share your CV and goals so we can start your order." path="/intake" robots="noindex,nofollow" />
      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
        .header { background: rgba(6,11,22,0.75); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0 24px; height: 60px; display: flex; align-items: center; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #fff; text-decoration: none; }
        .logo em { color: #4D8DFF; font-style: italic; }
        .main { max-width: 560px; margin: 0 auto; padding: 40px 16px 64px; }
        h1 { font-family: 'DM Serif Display', serif; font-size: 30px; color: #fff; margin-bottom: 10px; }
        .sub { font-size: 15px; color: #9FB0C8; line-height: 1.7; margin-bottom: 24px; }
        .steps { display: flex; gap: 8px; margin-bottom: 26px; font-size: 12px; color: #64748F; }
        .steps span { flex: 1; padding-top: 8px; border-top: 3px solid rgba(255,255,255,0.1); }
        .steps span.on { border-color: #4D8DFF; color: #E6ECF5; }
        .card { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 22px; margin-bottom: 16px; }
        label { display: block; font-size: 13px; font-weight: 600; color: #fff; margin: 16px 0 6px; }
        .hint { font-size: 12px; color: #64748F; font-weight: 400; margin-top: 2px; line-height: 1.5; }
        input[type=text], input[type=email], textarea { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; padding: 12px 14px; font: inherit; font-size: 15px; color: #fff; }
        textarea { min-height: 96px; resize: vertical; line-height: 1.5; }
        input[type=file] { width: 100%; font-size: 14px; color: #9FB0C8; padding: 10px 0; }
        input:focus, textarea:focus { outline: 2px solid #4D8DFF; outline-offset: 1px; }
        button.go { width: 100%; margin-top: 22px; background: #3B7DF0; color: #fff; border: 0; border-radius: 12px; padding: 15px; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
        button.go:disabled { opacity: 0.55; cursor: default; }
        .err { background: rgba(220,38,38,0.1); border: 1px solid rgba(248,113,113,0.4); color: #F87171; font-size: 14px; padding: 12px 14px; border-radius: 10px; line-height: 1.6; margin-bottom: 16px; }
        .center { text-align: center; padding: 34px 20px; }
        .spinner { display: inline-block; width: 26px; height: 26px; border: 3px solid rgba(77,141,255,0.25); border-top-color: #4D8DFF; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 14px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        a.back { display: inline-block; margin-top: 8px; font-size: 13px; color: #7FA8F5; text-decoration: none; }
        @media (max-width: 480px) { h1 { font-size: 26px; } .main { padding-top: 28px; } }
      `}</style>

      <div className="header">
        <Link href="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/logo.svg" alt="" width="26" height="29" style={{ display: 'block' }} />Asovix<em>.</em>
        </Link>
      </div>

      <div className="main">
        {!state && !error && <div className="center"><span className="spinner" /><p className="sub">Loading your order…</p></div>}
        {error && <div className="err" role="alert">{error}</div>}

        {state && (stage === 'form' || stage === 'questions' || stage === 'working' || stage === 'complete' || stage === 'received') && (
          <div className="steps" aria-hidden="true">
            <span className={step >= 1 ? 'on' : ''}>1. Your details</span>
            <span className={step >= 2 ? 'on' : ''}>2. A few questions</span>
            <span className={step >= 3 ? 'on' : ''}>3. Done</span>
          </div>
        )}

        {stage === 'unpaid' && (<><h1>We could not find your payment.</h1><p className="sub">{state.message}</p></>)}
        {stage === 'retry' && (<><h1>One moment.</h1><p className="sub">{state.message}</p><button className="go" onClick={() => load(sid)}>Try again</button></>)}

        {stage === 'form' && (
          <form onSubmit={sendDetails}>
            <h1>Tell us about you.</h1>
            <p className="sub">This takes about five minutes. The more specific you are, the stronger your documents will be. We only use what you tell us, and we never invent anything.</p>
            <div className="card">
              <label htmlFor="name">Your full name</label>
              <input id="name" type="text" required autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              <label htmlFor="email">Email we should reply to</label>
              <input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              <label htmlFor="role">The job you want</label>
              <input id="role" type="text" required placeholder="e.g. Part-time stock assistant" value={form.targetRole} onChange={(e) => set('targetRole', e.target.value)} />
              <label htmlFor="loc">Where you want to work</label>
              <input id="loc" type="text" required placeholder="e.g. Manchester" value={form.location} onChange={(e) => set('location', e.target.value)} />
              <label htmlFor="goal">What do you want from this?
                <div className="hint">For example: more interviews, a better role, a career change, or work that fits around study.</div>
              </label>
              <textarea id="goal" required value={form.goal} onChange={(e) => set('goal', e.target.value)} />
              <label htmlFor="jobad">A job ad you are aiming for <span className="hint">(optional, but it helps a lot)</span>
                <div className="hint">Paste the full text of one job you would love to get. We position you for that kind of role.</div>
              </label>
              <textarea id="jobad" value={form.jobAd} onChange={(e) => set('jobAd', e.target.value)} />
              <label htmlFor="extra">Anything else we should know? <span className="hint">(optional)</span>
                <div className="hint">Days you can work, courses you are on, anything you are proud of, anything you worry an employer might ask.</div>
              </label>
              <textarea id="extra" value={form.extra} onChange={(e) => set('extra', e.target.value)} />
              <label htmlFor="cv">Your current CV
                <div className="hint">PDF or Word, up to 4 MB. If you do not have one, upload anything you have written about your work history.</div>
              </label>
              <input id="cv" type="file" required accept=".pdf,.docx,application/pdf" ref={fileRef} />
            </div>
            <button className="go" disabled={busy}>{busy ? 'Sending…' : 'Send my details'}</button>
          </form>
        )}

        {stage === 'working' && (
          <div className="card center">
            <span className="spinner" />
            <h1 style={{ fontSize: 24 }}>Reading your CV{state.firstName ? `, ${state.firstName}` : ''}…</h1>
            <p className="sub" style={{ marginBottom: 0 }}>This usually takes a minute or two. Keep this page open; it will update by itself.</p>
          </div>
        )}

        {stage === 'questions' && (
          <form onSubmit={sendAnswers}>
            <h1>A few quick questions{state.firstName ? `, ${state.firstName}` : ''}.</h1>
            <p className="sub">We read your CV and these are the gaps we need you to fill. Short, honest answers are perfect. Numbers and dates help most. If you do not know, say so.</p>
            <div className="card">
              {state.questions.map((q, i) => (
                <div key={q.id}>
                  <label htmlFor={'q' + q.id}>{i + 1}. {q.text}</label>
                  <textarea id={'q' + q.id} value={answers[q.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                </div>
              ))}
            </div>
            <button className="go" disabled={busy}>{busy ? 'Sending…' : 'Send my answers'}</button>
          </form>
        )}

        {(stage === 'complete' || stage === 'received') && (
          <div className="card center">
            <h1 style={{ fontSize: 26 }}>Thank you{state.firstName ? `, ${state.firstName}` : ''}.</h1>
            <p className="sub" style={{ marginBottom: 0 }}>We have everything we need to start. Samuel will prepare your documents and send them to your email. If we need anything else we will email you. Check your spam folder if you do not hear from us within 24 hours.</p>
          </div>
        )}

        <Link href="/" className="back">← Back to Asovix</Link>
      </div>
    </>
  );
}
