import { useState, useRef } from 'react';
import Head from 'next/head';

const STEPS = ['Upload', 'Brief', 'Payment'];

export default function Home() {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const [form, setForm] = useState({
    fileName: '',
    cvText: '',
    jd: '',
    name: '',
    email: '',
    phone: '',
    role: '',
    target: '',
    challenge: '',
    location: 'UK',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  async function handleFileUpload(file) {
    if (!file) return;
    setUploading(true);
    setError('');
    const data = new FormData();
    data.append('cv', file);
    try {
      const r = await fetch('/api/extract-cv', { method: 'POST', body: data });
      const json = await r.json();
      set('cvText', json.text || '');
      set('fileName', file.name);
    } catch {
      setError('Could not read your file. Please try a .txt version.');
    }
    setUploading(false);
  }

  async function handleCheckout() {
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          target: form.target,
          location: form.location,
          challenge: form.challenge,
          jd: form.jd,
          cvText: form.cvText,
        }),
      });
      const json = await r.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setError(json.error || 'Payment failed to initialise. Please try again.');
        setSubmitting(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const canProceedStep1 = !uploading;
  const canProceedStep2 = form.name.trim() && form.email.trim();

  return (
    <>
      <Head>
        <title>Asovix — AI CV Optimisation</title>
        <meta name="description" content="Get 3 professionally optimised, ATS-ready CVs tailored to the UK job market in minutes." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F7F8FA; color: #1a1a1a; }
        input, textarea, select { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <style jsx>{`
        .header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 0 24px; height: 56px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #1B3A6B; }
        .logo em { font-style: italic; }
        .badge { font-size: 10px; background: #EEF2F8; color: #1B3A6B; padding: 3px 8px; border-radius: 20px; font-weight: 500; letter-spacing: .04em; }
        .main { max-width: 560px; margin: 0 auto; padding: 32px 16px 64px; }
        .steps { display: flex; align-items: center; margin-bottom: 28px; }
        .si { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #aaa; }
        .si.on { color: #1B3A6B; font-weight: 500; }
        .si.done { color: #555; }
        .sd { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; flex-shrink: 0; }
        .si.on .sd { border-color: #1B3A6B; background: #1B3A6B; color: #fff; }
        .si.done .sd { border-color: #1B3A6B; background: #EEF2F8; color: #1B3A6B; }
        .sl { flex: 1; height: 1px; background: #e5e7eb; margin: 0 8px; }
        .sl.done { background: #1B3A6B; opacity: .4; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 14px; }
        .ct { font-size: 14px; font-weight: 500; color: #1a1a1a; margin-bottom: 14px; }
        .opt { font-size: 12px; color: #aaa; font-weight: 400; }
        .uz { border: 1.5px dashed #d1d5db; border-radius: 8px; padding: 28px 20px; text-align: center; cursor: pointer; transition: all .15s; }
        .uz:hover, .uz.drag { border-color: #1B3A6B; background: #F0F4FA; }
        .uz.filled { border-style: solid; border-color: #1B3A6B; background: #F0F4FA; }
        .uz-icon { font-size: 28px; margin-bottom: 10px; }
        .uz-label { font-size: 13px; color: #555; }
        .uz-label strong { color: #1B3A6B; }
        .uz-sub { font-size: 11px; color: #aaa; margin-top: 4px; }
        .fbadge { display: inline-flex; align-items: center; gap: 6px; background: #1B3A6B; color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 20px; margin-top: 8px; }
        .fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .f { display: flex; flex-direction: column; gap: 4px; }
        .f.full { grid-column: 1 / -1; }
        .f label { font-size: 10px; color: #888; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
        .f input, .f textarea, .f select { font-size: 13px; padding: 9px 11px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; color: #1a1a1a; width: 100%; outline: none; transition: border-color .15s; }
        .f input:focus, .f textarea:focus { border-color: #1B3A6B; background: #fff; }
        .f textarea { resize: vertical; min-height: 75px; }
        .rgrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .rc { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; cursor: pointer; transition: all .15s; text-align: center; position: relative; }
        .rc:hover { border-color: #1B3A6B; }
        .rc.sel { border-color: #1B3A6B; background: #F0F4FA; }
        .rc.sel::after { content: '✓'; position: absolute; top: 4px; right: 6px; font-size: 10px; color: #1B3A6B; font-weight: 600; }
        .rcl { font-size: 13px; font-weight: 500; color: #1a1a1a; }
        .rcs { font-size: 10px; color: #888; margin-top: 2px; }
        .btn { width: 100%; padding: 13px; background: #1B3A6B; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: opacity .15s; margin-top: 4px; }
        .btn:hover { opacity: .88; }
        .btn:disabled { opacity: .35; cursor: not-allowed; }
        .gbtn { background: none; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 16px; font-size: 13px; color: #555; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-right: 8px; }
        .gbtn:hover { background: #f9fafb; }
        .nav { display: flex; align-items: center; margin-top: 8px; }
        .divider { height: 1px; background: #f0f0f0; margin: 12px 0; }
        .pr { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .pl { font-size: 13px; color: #888; }
        .pv { font-size: 13px; color: #1a1a1a; font-weight: 500; }
        .ptotal { font-size: 22px; font-weight: 500; color: #1B3A6B; }
        .cvc { background: #f9fafb; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; margin-bottom: 8px; border: 1px solid #f0f0f0; }
        .cvn { font-size: 13px; font-weight: 500; color: #1a1a1a; }
        .cvd { font-size: 11px; color: #888; }
        .note { font-size: 11px; color: #aaa; text-align: center; margin-top: 8px; line-height: 1.6; }
        .err { background: #fff1f1; border: 1px solid #fca5a5; color: #dc2626; font-size: 12px; padding: 10px 12px; border-radius: 8px; margin-top: 8px; }
        .stripe-btn { width: 100%; padding: 13px; background: #635BFF; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 12px; transition: opacity .15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .stripe-btn:hover { opacity: .9; }
        .stripe-btn:disabled { opacity: .4; cursor: not-allowed; }
        .pill { display: inline-flex; align-items: center; gap: 5px; background: #EEF2F8; color: #1B3A6B; font-size: 11px; font-weight: 500; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; }
        .tip { font-size: 11px; color: #aaa; line-height: 1.7; }
      `}</style>

      <div className="header">
        <div className="logo">Asovix<em>.</em></div>
        <div className="badge">AI CV OPTIMISATION</div>
      </div>

      <div className="main">

        {/* STEPS BAR */}
        <div className="steps">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const isOn = step === n;
            const isDone = step > n;
            return (
              <>
                <div key={label} className={`si ${isOn ? 'on' : ''} ${isDone ? 'done' : ''}`}>
                  <div className="sd">{isDone ? '✓' : n}</div>
                  <span>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div key={`l${i}`} className={`sl ${step > n ? 'done' : ''}`} />}
              </>
            );
          })}
        </div>

        {/* STEP 1 — UPLOAD */}
        {step === 1 && (
          <>
            <div className="card">
              <div className="ct">Upload your current CV</div>
              <div
                className={`uz ${form.fileName ? 'filled' : ''}`}
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
                onDragLeave={e => e.currentTarget.classList.remove('drag')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag'); handleFileUpload(e.dataTransfer.files[0]); }}
              >
                <div className="uz-icon">📄</div>
                <div className="uz-label"><strong>Click to upload</strong> or drag and drop</div>
                <div className="uz-sub">PDF, Word or plain text · Max 5MB</div>
                {form.fileName && <div className="fbadge">📄 {form.fileName}</div>}
                {uploading && <div style={{ marginTop: 8, fontSize: 12, color: '#1B3A6B' }}>Reading your CV...</div>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
            </div>

            <div className="card">
              <div className="ct">Job description <span className="opt">(optional — makes CVs sharper)</span></div>
              <div className="f">
                <textarea
                  value={form.jd}
                  onChange={e => set('jd', e.target.value)}
                  placeholder="Paste a job description here for a more targeted output..."
                />
              </div>
            </div>

            <button className="btn" disabled={!canProceedStep1} onClick={() => setStep(2)}>
              {uploading ? 'Reading CV...' : 'Continue →'}
            </button>
          </>
        )}

        {/* STEP 2 — BRIEF */}
        {step === 2 && (
          <>
            <div className="card">
              <div className="ct">Tell us about you</div>
              <div className="fgrid">
                <div className="f"><label>Full name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" /></div>
                <div className="f"><label>Email *</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" /></div>
                <div className="f"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+353 or +44..." /></div>
                <div className="f"><label>Current / most recent role</label><input value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Financial Analyst" /></div>
                <div className="f full"><label>Target role / sector</label><input value={form.target} onChange={e => set('target', e.target.value)} placeholder="e.g. FP&A in UK finance, Paraplanner, Business Development" /></div>
                <div className="f full"><label>Biggest career challenge right now</label><textarea value={form.challenge} onChange={e => set('challenge', e.target.value)} placeholder="e.g. Not getting callbacks, breaking into a new sector..." /></div>
              </div>
            </div>

            <div className="card">
              <div className="ct">Where are you applying?</div>
              <div className="rgrid">
                {[['UK', '🇬🇧 UK', 'Remote or on-site'], ['Ireland', '🇮🇪 Ireland', 'Remote or on-site'], ['UK and Ireland', 'Both', 'UK + Ireland']].map(([val, label, sub]) => (
                  <div key={val} className={`rc ${form.location === val ? 'sel' : ''}`} onClick={() => set('location', val)}>
                    <div className="rcl">{label}</div>
                    <div className="rcs">{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {!canProceedStep2 && <div className="err">Please enter your name and email to continue.</div>}

            <div className="nav">
              <button className="gbtn" onClick={() => setStep(1)}>← Back</button>
              <button className="btn" style={{ flex: 1, marginTop: 0 }} disabled={!canProceedStep2} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </>
        )}

        {/* STEP 3 — PAYMENT */}
        {step === 3 && (
          <>
            <div className="card">
              <div className="pill">✦ What you get</div>
              <div className="cvc"><span style={{ fontSize: 18 }}>📊</span><div><div className="cvn">CV 1 — Finance / FP&A / Analyst</div><div className="cvd">For analyst, FP&A, and finance ops roles</div></div></div>
              <div className="cvc"><span style={{ fontSize: 18 }}>🏦</span><div><div className="cvn">CV 2 — Paraplanner / Advisory / Wealth</div><div className="cvd">For wealth management & paraplanner roles</div></div></div>
              <div className="cvc"><span style={{ fontSize: 18 }}>💼</span><div><div className="cvn">CV 3 — Sales / Advisory / Consultancy</div><div className="cvd">For sales, BD & client growth roles</div></div></div>

              <div className="divider" />
              <div className="pr"><span className="pl">3 fully optimised CVs</span><span className="pv">€15.00</span></div>
              <div className="pr"><span className="pl">ATS optimised for UK market</span><span className="pv">Included</span></div>
              <div className="pr"><span className="pl">Delivered to your email</span><span className="pv">Instantly</span></div>
              <div className="divider" />
              <div className="pr"><span className="pl" style={{ fontWeight: 500, color: '#1a1a1a' }}>Total</span><span className="ptotal">€15.00</span></div>
            </div>

            <div className="card">
              <div className="ct">Pay securely with Stripe</div>
              <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 4 }}>
                Your CVs will be generated by Claude AI immediately after payment and delivered to <strong style={{ color: '#1a1a1a' }}>{form.email}</strong> as Word documents.
              </p>

              {error && <div className="err">{error}</div>}

              <button className="stripe-btn" disabled={submitting} onClick={handleCheckout}>
                {submitting ? '⏳ Redirecting to Stripe...' : '🔒 Pay €15 — Get My CVs'}
              </button>

              <div className="note">
                Secured by Stripe · Card, Apple Pay, Google Pay accepted<br />
                CVs sent to {form.email} within seconds of payment
              </div>
            </div>

            <div className="nav">
              <button className="gbtn" onClick={() => setStep(2)}>← Back</button>
            </div>
          </>
        )}

        {/* Footer tip */}
        {step < 3 && (
          <p className="tip" style={{ marginTop: 16, textAlign: 'center' }}>
            🇬🇧 UK market positioning · ATS optimised · 3 targeted CVs · Delivered instantly
          </p>
        )}

      </div>
    </>
  );
}
