import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { QUESTIONS, runDiagnosis, CONTACT_EMAIL } from '../lib/diagnosis';
import { Seo, breadcrumbLd } from '../lib/seo';
import {
  track, trackCta, trackBeginCheckout,
  trackDiagnosisStarted, trackDiagnosisStep, trackDiagnosisCompleted,
  trackDiagnosisResultViewed, trackServiceRecommended, trackCvUploaded, trackCtaClicked,
} from '../lib/analytics';

const TOTAL = QUESTIONS.length;

// The extracted text powers the diagnosis; the original file goes privately to
// Samuel with the lead, so a candidate is never asked for the same CV twice.
const MAX_ATTACH_BYTES = 3 * 1024 * 1024;

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

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
  const [cvFile, setCvFile] = useState(null);
  const [cvNote, setCvNote] = useState('');
  const [leadId, setLeadId] = useState('');
  const [cvOnFile, setCvOnFile] = useState(false);
  const [emailed, setEmailed] = useState(true);
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
    setCvNote('');
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const [r, b64] = await Promise.all([
        fetch('/api/extract-cv', { method: 'POST', body: fd }),
        file.size <= MAX_ATTACH_BYTES ? readAsBase64(file).catch(() => null) : Promise.resolve(null),
      ]);
      const j = await r.json();
      if (j && j.text) {
        setCvText(j.text);
        setCvName(file.name);
        set('cvProvided', true);
        setCvFile(b64 ? { name: file.name, type: file.type, data: b64 } : null);
        if (!b64) {
          setCvNote('This file is over 3MB, so it will be read for your diagnosis but not kept. Samuel may ask you for a smaller copy.');
        }
        trackCvUploaded((file.name.split('.').pop() || '').toLowerCase(), Math.round(file.size / 1024));
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
        body: JSON.stringify({ answers: payload, cvFile, source: document.referrer || 'direct' }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      const dx = j.diagnosis || runDiagnosis(payload);
      setLeadId(j.id || '');
      setCvOnFile(!!j.cvAttached);
      setEmailed(j.emailed !== false);
      trackDiagnosisCompleted(dx.topSignal);
      trackDiagnosisResultViewed(dx.topSignal);
      trackServiceRecommended(dx.recommended, dx.offer.price, dx.next && dx.next.tier);
      track('generate_lead', { lead_type: 'diagnosis', method: 'diagnosis_flow' });
      setResult(dx);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  async function buy(productId, name, price, kind = 'buy_now') {
    setBuying(productId);
    trackCta('buy_from_diagnosis', 'diagnosis_result', productId);
    ctaClick(kind, productId);
    try {
      // Pre-fills Stripe with the email we already have, and ties the purchase
      // back to this diagnosis so the CV is never requested again.
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productId, email: answers.email, diagnosisId: leadId, cvOnFile }),
      });
      const j = await r.json();
      if (j.url) {
        trackBeginCheckout(productId, name, price);
        window.location.href = j.url;
      } else setBuying('');
    } catch { setBuying(''); }
  }

  function ctaClick(kind, productId) {
    trackCtaClicked(kind, productId, result && result.next ? result.next.tier : '');
  }

  const pct = result ? 100 : Math.round(((step) / TOTAL) * 100);

  const nextStep = result && result.next ? result.next : null;
  const talkHref = result
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Question about ${result.offer.name}`)}`
    : '';
  let afterPay = 'Samuel prepares everything by hand and delivers it by email within 24 hours of having what he needs.';
  if (result && result.offer.id === 'interview_prep') {
    afterPay = 'Samuel emails you within 24 hours to schedule your mock interview.';
  } else if (result && result.offer.id === 'full_package') {
    afterPay = 'Your documents are delivered by email within 24 hours of Samuel having what he needs, and your mock interview is scheduled around you.';
  }

  return (
    <>
      <Seo
        title="Why Am I Not Getting Interviews? Free Positioning Check — Asovix"
        description="A free 2-minute check for job seekers in Ireland. Answer seven questions and see what is stopping employers from responding — and the one thing to fix first."
        path="/diagnosis"
        jsonLd={[breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Career positioning check', path: '/diagnosis' }])]}
      />

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

        .vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
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
        .explain { margin-top: 54px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.07); }
        .explain h2 { font-family: 'DM Serif Display', serif; font-size: 21px; color: #fff; margin-bottom: 14px; }
        .explain p { font-size: 14.5px; color: #9FB0C8; line-height: 1.75; margin-bottom: 13px; }
        .priv { margin-top: 18px; font-size: 12px; color: #4A5670; line-height: 1.6; }

        /* ── Result ── */
        .rkick { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #4D8DFF; font-weight: 600; margin-bottom: 12px; }
        .rhead { font-family: 'DM Serif Display', serif; font-size: clamp(26px, 5.4vw, 36px); line-height: 1.22; color: #fff; margin-bottom: 8px; }
        .rbasis { font-size: 13px; color: #64748F; margin-bottom: 30px; }
        .rsec { margin-bottom: 22px; }
        .rstep { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #4D8DFF; font-weight: 700; margin-bottom: 10px; }
        .rsmall { font-size: 13.5px; color: #9FB0C8; margin-top: 10px; }
        .rhint { font-size: 13px; color: #9FB0C8; text-align: center; margin: 12px 0 18px; line-height: 1.6; }
        .rbtn2 { display: block; width: 100%; text-align: center; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; padding: 15px; border-radius: 13px; cursor: pointer; background: rgba(255,255,255,0.04); color: #E6ECF5; border: 1px solid rgba(255,255,255,0.18); }
        .rbtn2:disabled { opacity: 0.55; cursor: wait; }
        .rlinkbtn { display: block; width: 100%; margin-top: 12px; background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #7FA8F5; cursor: pointer; padding: 8px; }
        .rlinkbtn:disabled { opacity: 0.55; cursor: wait; }
        .rstepslab { font-size: 12px; color: #64748F; font-weight: 600; margin: 24px 0 8px; }
        .rsteps { list-style: decimal; padding-left: 20px; }
        .rsteps li { font-size: 13.5px; color: #C7D4E8; line-height: 1.65; margin-bottom: 6px; }
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

      {result && (
        <Head>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
      )}

      <nav className="dnav">
        <div className="dnavin">
          <Link href="/" className="logo"><img src="/logo.svg" alt="" width="26" height="29" style={{ display: 'block' }} />Asovix<em>.</em></Link>
          <Link href="/" className="exit">{result ? 'Back to Asovix' : 'Exit'}</Link>
        </div>
      </nav>

      <div className="dwrap" ref={topRef}>
        <h1 className="vh">
          Career positioning check — find out why employers in Ireland aren&apos;t responding
        </h1>

        {!result && (
          <>
            <div className="prog"><div className="progbar" style={{ width: `${pct}%` }} /></div>
            <div className="progtxt">{step + 1} of {TOTAL}</div>

            <h2 className="dq" key={`q${step}`}>{q.q}</h2>
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
                  <>
                    <div className="gotcv">✓ {cvName}</div>
                    {cvNote && <div className="dropnote">{cvNote}</div>}
                  </>
                ) : (
                  <>
                    <label className="droplab">
                      {uploading ? 'Reading…' : 'Choose a file'}
                      <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleCv} disabled={uploading} />
                    </label>
                    <div className="dropnote">We read it to spot under-sold evidence, and a copy goes privately to Samuel so you're never asked for it twice. Never published.</div>
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
                <p className="priv">We email you your diagnosis and may follow up once. If you shared a CV, it's kept privately for up to 12 months. No list-selling, no spam. See our <Link href="/privacy" style={{ color: '#7FA8F5' }}>privacy notice</Link>.</p>
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

            {/* Crawlable explanation. Below the form and only on the first step,
                so it gives search engines something real to read without putting
                anything between the visitor and the first question. */}
            {step === 0 && (
              <section className="explain">
                <h2>What this check looks at</h2>
                <p>
                  Most people who aren&apos;t getting interviews assume the problem is their experience.
                  Usually it isn&apos;t. It&apos;s that nothing on the page connects the experience they
                  already have to the role an employer is trying to fill.
                </p>
                <p>
                  This check resolves your answers against the three things that decide positioning:
                  what you want, what you can prove, and what employers are actually hiring for. It takes
                  about two minutes and needs no payment.
                </p>
                <p>
                  You&apos;ll get a named primary issue, where the biggest gap sits, the next action worth
                  taking, and one recommended service if you want help with it. It&apos;s based only on what
                  you tell us, so treat it as a starting point rather than a verdict.
                </p>
              </section>
            )}
          </>
        )}

        {result && (
          <>
            <div className="rkick">Your positioning diagnosis</div>
            <p className="rbasis">Based on your answers — a starting point, not a verdict.</p>

            <div className="rsec">
              <div className="rstep">1 · What we found</div>
              <h2 className="rhead">{result.primaryIssue}</h2>
              <p className="rtxt">{result.biggestGap}</p>
            </div>

            <div className="rblock">
              <div className="rstep">2 · Why it matters</div>
              <div className="align">Market alignment: {result.alignment.level}</div>
              <p className="rtxt">{result.alignment.note}</p>
              <p className="rtxt rsmall"><strong>Next best action:</strong> {result.nextAction}</p>
            </div>

            <div className="rblock hot">
              <div className="rstep">3 · What Asovix recommends</div>
              <div className="recname">{result.offer.name}</div>
              <div className="recprice">€{result.offer.price} · one payment</div>
              <p className="rtxt">{nextStep ? nextStep.reason : result.offer.short}</p>
            </div>

            <div className="rblock">
              <div className="rstep">4 · What happens next</div>

              {nextStep && nextStep.tier === 'high' ? (
                <>
                  {nextStep.primary === 'book' ? (
                    <a className="rbtn" href={nextStep.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={() => ctaClick('book_call', result.offer.id)}>
                      Book a call with Samuel →
                    </a>
                  ) : (
                    <a className="rbtn" href={talkHref} onClick={() => ctaClick('talk_to_samuel', result.offer.id)}>
                      Talk it through with Samuel →
                    </a>
                  )}
                  <p className="rhint">
                    {emailed
                      ? 'Or just reply to the diagnosis email we’ve sent you — it goes straight to him.'
                      : `Or email ${CONTACT_EMAIL} — it goes straight to him.`}
                  </p>
                  <button
                    className="rbtn2"
                    onClick={() => buy(result.offer.id, result.offer.name, result.offer.price, 'buy_now')}
                    disabled={buying === result.offer.id}
                  >
                    {buying === result.offer.id ? 'Opening secure checkout…' : `Ready now? Start ${result.offer.name} — €${result.offer.price}`}
                  </button>
                  {nextStep.downsell && (
                    <button
                      className="rlinkbtn"
                      onClick={() => buy(nextStep.downsell.id, nextStep.downsell.name, nextStep.downsell.price, 'buy_smaller')}
                      disabled={buying === nextStep.downsell.id}
                    >
                      {buying === nextStep.downsell.id ? 'Opening secure checkout…' : `Or start smaller with ${nextStep.downsell.name} — €${nextStep.downsell.price} →`}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="rbtn"
                    onClick={() => buy(result.offer.id, result.offer.name, result.offer.price, 'buy_now')}
                    disabled={buying === result.offer.id}
                  >
                    {buying === result.offer.id ? 'Opening secure checkout…' : `Start ${result.offer.name} — €${result.offer.price} →`}
                  </button>
                  <a className="rlink" href={talkHref} onClick={() => ctaClick('talk_to_samuel', result.offer.id)}>
                    Questions first? Email Samuel →
                  </a>
                </>
              )}

              <div className="rstepslab">{nextStep && nextStep.tier === 'high' ? 'If you go ahead' : 'How it works'}</div>
              <ol className="rsteps">
                <li>You pay once, securely, through Stripe.</li>
                <li>{cvOnFile ? 'We already have your CV — nothing to send again.' : 'You reply to the confirmation email with your CV and target role.'}</li>
                <li>{afterPay}</li>
              </ol>

              <Link href="/#pricing" className="rlink" onClick={() => ctaClick('see_all_services', result.offer.id)}>
                See everything Asovix offers →
              </Link>
            </div>

            {emailed && <div className="sent">A copy of this diagnosis is in your inbox.</div>}
          </>
        )}
      </div>
    </>
  );
}
