import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { QUESTIONS, runDiagnosis } from '../lib/diagnosis';
import {
  track, trackCta, trackBeginCheckout,
  trackDiagnosisStarted, trackDiagnosisStep, trackDiagnosisCompleted,
  trackDiagnosisResultViewed, trackServiceRecommended,
} from '../lib/analytics';

const TOTAL = QUESTIONS.length;

export default function Diagnosis() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ situation: [] });
  const [cvName, setCvName] = useState('');
  const [cvText, setCvText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [buying, setBuying] = useState('');
  const started = useRef(false);
  const topRef = useRef(null);

  const q = QUESTIONS[step];

  useEffect(() => {
    if (topRef.current) topRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step, result]);

  function begin() {
    if (!started.current) {
      started.current = true;
      trackDiagnosisStarted();
    }
  }

  function set(id, value) {
    begin();
    setError('');
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function toggleMulti(id, value) {
    begin();
    setError('');
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? a[id] : [];
      return { ...a, [id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }

  function canAdvance() {
    if (q.optional) return true;
    if (q.type === 'single') return !!answers[q.id];
    if (q.type === 'multi') return (answers[q.id] || []).length > 0;
    if (q.type === 'contact') {
      return (answers.firstName || '').trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((answers.email || '').trim());
    }
    return true;
  }

  function next() {
    if (!canAdvance()) {
      setError(q.type === 'contact' ? 'A first name and a valid email, and it is yours.' : 'Pick an option to continue.');
      return;
    }
    trackDiagnosisStep(step + 1, q.id);
    if (step < TOTAL - 1) setStep(step + 1);
  }

  async function handleCv(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const r = await fetch('/api/extract-cv', { method: 'POST', body: fd });
      const j = await r.json();
      if (j && j.text) {
        setCvText(j.text);
        setCvName(file.name);
        set('cvProvided', true);
      } else {
        setError("We couldn't read that file. You can carry on without it.");
      }
    } catch {
      setError("We couldn't read that file. You can carry on without it.");
    }
    setUploading(false);
  }

  async function submit() {
    if (!canAdvance()) {
      setError('A first name and a valid email, and it is yours.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = { ...answers, cvText, cvFilename: cvName };
    try {
      const r = await fetch('/api/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload, source: document.referrer || 'direct' }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      const dx = j.diagnosis || runDiagnosis(payload);
      trackDiagnosisCompleted(dx.topSignal);
      trackDiagnosisResultViewed(dx.topSignal);
      trackServiceRecommended(dx.recommended, dx.offer.price);
      track('generate_lead', { lead_type: 'diagnosis', method: 'diagnosis_flow' });
      setResult(dx);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  async function buy(productId, name, price) {
    setBuying(productId);
    trackCta('buy_from_diagnosis', 'diagnosis_result', productId);
    try {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productId }),
      });
      const j = await r.json();
      if (j.url) {
        trackBeginCheckout(productId, name, price);
        window.location.href = j.url;
      } else setBuying('');
    } catch { setBuying(''); }
  }

  const pct = result ? 100 : Math.round(((step) / TOTAL) * 100);

  return (
    <>
      <Head>
        <title>Career positioning check — Asovix</title>
        <meta name="description" content="A 2-minute check that shows what's stopping employers from seeing your value — and the one thing to fix first." />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
        ul { list-style: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

        .dnav { border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(6,11,22,0.75); backdrop-filter: blur(14px); position: sticky; top: 0; z-index: 40; }
        .dnavin { max-width: 720px; margin: 0 auto; padding: 0 20px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 9px; }
        .logo em { color: #4D8DFF; font-style: normal; }
        .dnavin a.exit { font-size: 13px; color: #64748F; text-decoration: none; }

        .dwrap { max-width: 720px; margin: 0 auto; padding: 30px 20px 90px; }

        .prog { height: 4px; background: rgba(255,255,255,0.07); border-radius: 100px; overflow: hidden; margin-bottom: 12px; }
        .progbar { height: 100%; background: linear-gradient(90deg, #3B7DF0, #7FB2FF); border-radius: 100px; transition: width 0.35s ease-out; }
        .progtxt { font-size: 11.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #64748F; font-weight: 600; margin-bottom: 30px; }

        .dq { font-family: 'DM Serif Display', serif; font-size: clamp(25px, 5.6vw, 34px); line-height: 1.22; color: #fff; margin-bottom: 10px; animation: fadeUp 0.35s ease-out both; }
        .dhelp { font-size: 14.5px; color: #9FB0C8; line-height: 1.65; margin-bottom: 26px; animation: fadeUp 0.35s 0.05s ease-out both; }

        .opts { display: grid; gap: 10px; animation: fadeUp 0.35s 0.1s ease-out both; }
        .opt { width: 100%; text-align: left; font-family: 'DM Sans', sans-serif; font-size: 15.5px; color: #C7D4E8; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 17px 18px; cursor: pointer; transition: all 0.15s ease-out; display: flex; align-items: center; gap: 13px; line-height: 1.4; }
        .opt:hover { border-color: rgba(77,141,255,0.45); background: rgba(46,109,228,0.08); }
        .opt.on { border-color: #4D8DFF; background: rgba(46,109,228,0.16); color: #fff; }
        .tick { width: 22px; height: 22px; border-radius: 7px; border: 1.5px solid rgba(255,255,255,0.22); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .opt.on .tick { background: #3B7DF0; border-color: #3B7DF0; }
        .tick svg { display: block; }

        .fld { width: 100%; font-family: 'DM Sans', sans-serif; font-size: 16px; padding: 16px 17px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.14); background: rgba(6,11,22,0.6); color: #fff; outline: none; margin-bottom: 12px; }
        .fld:focus { border-color: #4D8DFF; }
        .fld::placeholder { color: #4A5670; }
        .flab { font-size: 12.5px; color: #9FB0C8; margin-bottom: 7px; display: block; }

        .drop { border: 1px dashed rgba(77,141,255,0.4); border-radius: 16px; padding: 30px 20px; text-align: center; background: rgba(46,109,228,0.05); }
        .drop input { display: none; }
        .droplab { display: inline-block; font-size: 14.5px; font-weight: 600; color: #7FA8F5; cursor: pointer; padding: 12px 22px; border: 1px solid rgba(77,141,255,0.45); border-radius: 11px; }
        .dropnote { font-size: 12.5px; color: #64748F; margin-top: 13px; }
        .gotcv { font-size: 14px; color: #7FE0A8; }

        .navrow { display: flex; gap: 11px; margin-top: 26px; align-items: center; }
        .btn { flex: 1; font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600; padding: 17px 22px; border-radius: 13px; border: none; cursor: pointer; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; box-shadow: 0 8px 26px rgba(59,125,240,0.34); transition: transform 0.15s ease-out; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); }
        .btn:disabled { opacity: 0.55; cursor: wait; }
        .gbtn { font-family: 'DM Sans', sans-serif; font-size: 15px; padding: 17px 18px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.13); background: none; color: #9FB0C8; cursor: pointer; }
        .skip { background: none; border: none; color: #64748F; font-family: 'DM Sans', sans-serif; font-size: 13.5px; cursor: pointer; text-decoration: underline; margin-top: 16px; display: block; }
        .err { margin-top: 14px; font-size: 13.5px; color: #F87171; }
        .priv { margin-top: 18px; font-size: 12px; color: #4A5670; line-height: 1.6; }

        /* ── Result ── */
        .rkick { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #4D8DFF; font-weight: 600; margin-bottom: 12px; }
        .rhead { font-family: 'DM Serif Display', serif; font-size: clamp(26px, 5.4vw, 36px); line-height: 1.22; color: #fff; margin-bottom: 8px; }
        .rbasis { font-size: 13px; color: #64748F; margin-bottom: 30px; }
        .rblock { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 24px 24px; margin-bottom: 14px; }
        .rblock.hot { border-color: rgba(77,141,255,0.5); background: linear-gradient(180deg, rgba(46,109,228,0.15), rgba(46,109,228,0.03)); }
        .rlab { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #64748F; font-weight: 700; margin-bottom: 9px; }
        .rtxt { font-size: 15px; color: #C7D4E8; line-height: 1.7; }
        .rtxt strong { color: #fff; }
        .align { display: inline-block; font-size: 12.5px; font-weight: 600; color: #7FA8F5; background: rgba(46,109,228,0.14); border: 1px solid rgba(77,141,255,0.32); border-radius: 100px; padding: 5px 13px; margin-bottom: 11px; }
        .recname { font-family: 'DM Serif Display', serif; font-size: 27px; color: #fff; margin-bottom: 3px; }
        .recprice { font-size: 14px; color: #7FA8F5; margin-bottom: 14px; }
        .rbtn { display: block; width: 100%; text-align: center; font-family: 'DM Sans', sans-serif; font-size: 15.5px; font-weight: 600; padding: 16px; border-radius: 13px; border: none; cursor: pointer; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; box-shadow: 0 8px 26px rgba(59,125,240,0.34); text-decoration: none; }
        .rbtn:disabled { opacity: 0.55; cursor: wait; }
        .rlink { display: block; text-align: center; margin-top: 15px; font-size: 14px; color: #7FA8F5; text-decoration: none; }
        .sent { font-size: 13.5px; color: #7FE0A8; margin-top: 20px; text-align: center; }
      `}</style>

      <nav className="dnav">
        <div className="dnavin">
          <Link href="/" className="logo"><img src="/logo.svg" alt="" width="26" height="29" style={{ display: 'block' }} />Asovix<em>.</em></Link>
          <Link href="/" className="exit">{result ? 'Back to Asovix' : 'Exit'}</Link>
        </div>
      </nav>

      <div className="dwrap" ref={topRef}>
        {!result && (
          <>
            <div className="prog"><div className="progbar" style={{ width: `${pct}%` }} /></div>
            <div className="progtxt">{step + 1} of {TOTAL}</div>

            <div className="dq" key={`q${step}`}>{q.q}</div>
            {q.help && <p className="dhelp">{q.help}</p>}

            {q.type === 'single' && (
              <div className="opts">
                {q.options.map((o) => (
                  <button
                    key={o.v}
                    className={`opt ${answers[q.id] === o.v ? 'on' : ''}`}
                    onClick={() => { set(q.id, o.v); }}
                  >
                    <span className="tick">{answers[q.id] === o.v && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 7"/></svg>}</span>
                    {o.l}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'multi' && (
              <div className="opts">
                {q.options.map((o) => {
                  const on = (answers[q.id] || []).includes(o.v);
                  return (
                    <button key={o.v} className={`opt ${on ? 'on' : ''}`} onClick={() => toggleMulti(q.id, o.v)}>
                      <span className="tick">{on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 7"/></svg>}</span>
                      {o.l}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'text' && (
              <input
                className="fld"
                type="text"
                placeholder={q.placeholder}
                value={answers[q.id] || ''}
                onChange={(e) => set(q.id, e.target.value)}
                aria-label={q.q}
              />
            )}

            {q.type === 'file' && (
              <div className="drop">
                {cvName ? (
                  <div className="gotcv">✓ {cvName}</div>
                ) : (
                  <>
                    <label className="droplab">
                      {uploading ? 'Reading…' : 'Choose a file'}
                      <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleCv} disabled={uploading} />
                    </label>
                    <div className="dropnote">We read the text to spot under-sold evidence. Nothing is published.</div>
                  </>
                )}
              </div>
            )}

            {q.type === 'contact' && (
              <>
                <label className="flab" htmlFor="fn">First name</label>
                <input id="fn" className="fld" type="text" value={answers.firstName || ''} onChange={(e) => set('firstName', e.target.value)} placeholder="Your first name" autoComplete="given-name" />
                <label className="flab" htmlFor="em">Email</label>
                <input id="em" className="fld" type="email" value={answers.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="you@email.com" autoComplete="email" inputMode="email" />
                <label className="flab" htmlFor="li">LinkedIn URL <span style={{ color: '#4A5670' }}>(optional)</span></label>
                <input id="li" className="fld" type="url" value={answers.linkedin || ''} onChange={(e) => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…" />
                <p className="priv">We email you the diagnosis and may follow up once. No list-selling, no spam. See our <Link href="/privacy" style={{ color: '#7FA8F5' }}>privacy notice</Link>.</p>
              </>
            )}

            {error && <div className="err">{error}</div>}

            <div className="navrow">
              {step > 0 && <button className="gbtn" onClick={() => setStep(step - 1)}>← Back</button>}
              {step < TOTAL - 1 ? (
                <button className="btn" onClick={next}>Continue →</button>
              ) : (
                <button className="btn" onClick={submit} disabled={submitting}>
                  {submitting ? 'Working it out…' : 'Show me my diagnosis →'}
                </button>
              )}
            </div>

            {q.optional && step < TOTAL - 1 && (
              <button className="skip" onClick={() => { trackDiagnosisStep(step + 1, q.id + '_skipped'); setStep(step + 1); }}>
                Skip this
              </button>
            )}
          </>
        )}

        {result && (
          <>
            <div className="rkick">Your positioning diagnosis</div>
            <h1 className="rhead">{result.primaryIssue}</h1>
            <p className="rbasis">Based on your answers — a starting point, not a verdict.</p>

            <div className="rblock">
              <div className="rlab">Target</div>
              <div className="rtxt">{result.target}</div>
            </div>

            <div className="rblock">
              <div className="rlab">Evidence you have</div>
              <div className="rtxt">{result.evidence}</div>
            </div>

            <div className="rblock">
              <div className="rlab">Market alignment</div>
              <div className="align">{result.alignment.level}</div>
              <div className="rtxt">{result.alignment.note}</div>
            </div>

            <div className="rblock">
              <div className="rlab">Biggest gap</div>
              <div className="rtxt">{result.biggestGap}</div>
            </div>

            <div className="rblock">
              <div className="rlab">Next best action</div>
              <div className="rtxt">{result.nextAction}</div>
            </div>

            <div className="rblock hot" style={{ marginTop: 26 }}>
              <div className="rlab">Want Asovix to fix this with you?</div>
              <div className="recname">{result.offer.name}</div>
              <div className="recprice">€{result.offer.price} · one payment</div>
              <div className="rtxt" style={{ marginBottom: 18 }}>{result.offer.short}</div>
              <button
                className="rbtn"
                onClick={() => buy(result.offer.id, result.offer.name, result.offer.price)}
                disabled={buying === result.offer.id}
              >
                {buying === result.offer.id ? 'Opening secure checkout…' : `Get ${result.offer.name} →`}
              </button>
              <Link href="/#pricing" className="rlink" onClick={() => trackCta('see_all_pricing', 'diagnosis_result')}>
                Or see everything Asovix offers →
              </Link>
            </div>

            <div className="sent">A copy is on its way to your inbox.</div>
          </>
        )}
      </div>
    </>
  );
}
