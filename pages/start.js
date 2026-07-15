import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const STEPS = ['Upload', 'Brief', 'Payment'];

export default function Start() {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const [form, setForm] = useState({
    fileName: '', cvText: '', jd: '', name: '', email: '',
    phone: '', role: '', target: '', challenge: '', location: 'UK',
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
          name: form.name, email: form.email, phone: form.phone,
          role: form.role, target: form.target, location: form.location,
          challenge: form.challenge, jd: form.jd, cvText: form.cvText,
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

  const canProceedStep2 = form.name.trim() && form.email.trim();

  return (
    <>
      <Head>
        <title>Get your 3 tailored CVs — Asovix</title>
        <meta name="description" content="Upload your CV, tell us your target, and get 3 professionally positioned, ATS-ready CVs in minutes." />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
        input, textarea { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <style jsx global>{`
        .header { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(14px); background: rgba(6,11,22,0.75); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #fff; text-decoration: none; }
        .logo em { color: #4D8DFF; font-style: italic; }
        .badge { font-size: 10px; background: rgba(46,109,228,0.14); color: #7FA8F5; padding: 4px 10px; border-radius: 20px; font-weight: 600; letter-spacing: 0.08em; border: 1px solid rgba(77,141,255,0.3); }
        .main { max-width: 560px; margin: 0 auto; padding: 36px 16px 72px; }
        .steps { display: flex; align-items: center; margin-bottom: 30px; }
        .si { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4A5A75; }
        .si.on { color: #7FA8F5; font-weight: 600; }
        .si.done { color: #9FB0C8; }
        .sd { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; flex-shrink: 0; }
        .si.on .sd { border-color: #3B7DF0; background: #3B7DF0; color: #fff; }
        .si.done .sd { border-color: #3B7DF0; background: rgba(46,109,228,0.16); color: #7FA8F5; }
        .sl { flex: 1; height: 1px; background: rgba(255,255,255,0.1); margin: 0 8px; }
        .sl.done { background: #3B7DF0; opacity: .5; }
        .card { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 22px; margin-bottom: 14px; }
        .ct { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 14px; }
        .opt { font-size: 12px; color: #64748F; font-weight: 400; }
        .uz { border: 1.5px dashed rgba(255,255,255,0.2); border-radius: 12px; padding: 30px 20px; text-align: center; cursor: pointer; transition: all .2s ease-out; }
        .uz:hover { border-color: #4D8DFF; background: rgba(46,109,228,0.07); }
        .uz.filled { border-style: solid; border-color: #3B7DF0; background: rgba(46,109,228,0.1); }
        .uz-icon { font-size: 28px; margin-bottom: 10px; }
        .uz-label { font-size: 13px; color: #9FB0C8; }
        .uz-label strong { color: #7FA8F5; }
        .uz-sub { font-size: 11px; color: #4A5A75; margin-top: 4px; }
        .fbadge { display: inline-flex; align-items: center; gap: 6px; background: #3B7DF0; color: #fff; font-size: 11px; padding: 4px 12px; border-radius: 20px; margin-top: 10px; }
        .fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .f { display: flex; flex-direction: column; gap: 4px; }
        .f.full { grid-column: 1 / -1; }
        .f label { font-size: 10px; color: #64748F; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
        .f input, .f textarea { font-size: 13px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(6,11,22,0.6); color: #fff; width: 100%; outline: none; transition: border-color .2s ease-out; }
        .f input:focus, .f textarea:focus { border-color: #4D8DFF; }
        .f textarea { resize: vertical; min-height: 75px; }
        .rgrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .rc { border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px; cursor: pointer; transition: all .2s ease-out; text-align: center; position: relative; }
        .rc:hover { border-color: #4D8DFF; }
        .rc.sel { border-color: #3B7DF0; background: rgba(46,109,228,0.12); }
        .rc.sel::after { content: '✓'; position: absolute; top: 4px; right: 7px; font-size: 10px; color: #7FA8F5; font-weight: 700; }
        .rcl { font-size: 13px; font-weight: 600; color: #fff; }
        .rcs { font-size: 10px; color: #64748F; margin-top: 2px; }
        .btn { width: 100%; padding: 14px; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: transform .2s ease-out, box-shadow .2s ease-out; margin-top: 4px; box-shadow: 0 6px 22px rgba(59,125,240,0.35); }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(59,125,240,0.5); }
        .btn:active { transform: scale(0.99); }
        .btn:disabled { opacity: .35; cursor: not-allowed; transform: none; }
        .gbtn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; padding: 11px 16px; font-size: 13px; color: #9FB0C8; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-right: 8px; transition: all .2s ease-out; }
        .gbtn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .nav { display: flex; align-items: center; margin-top: 8px; }
        .divider { height: 1px; background: rgba(255,255,255,0.07); margin: 12px 0; }
        .pr { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .pl { font-size: 13px; color: #64748F; }
        .pv { font-size: 13px; color: #E6ECF5; font-weight: 500; }
        .ptotal { font-family: 'DM Serif Display', serif; font-size: 24px; color: #7FA8F5; }
        .cvc { background: rgba(255,255,255,0.03); border-radius: 10px; padding: 11px 13px; display: flex; align-items: center; gap: 10px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.07); }
        .cvn { font-size: 13px; font-weight: 600; color: #fff; }
        .cvd { font-size: 11px; color: #64748F; }
        .note { font-size: 11px; color: #4A5A75; text-align: center; margin-top: 10px; line-height: 1.6; }
        .err { background: rgba(220,38,38,0.1); border: 1px solid rgba(248,113,113,0.4); color: #F87171; font-size: 12px; padding: 10px 12px; border-radius: 10px; margin-top: 8px; }
        .pill { display: inline-flex; align-items: center; gap: 5px; background: rgba(46,109,228,0.14); color: #7FA8F5; font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 20px; margin-bottom: 12px; border: 1px solid rgba(77,141,255,0.3); }
      `}</style>

      <div className="header">
        <Link href="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: 9 }}><img src="/logo.svg" alt="" width="26" height="29" style={{ display: 'block' }} />Asovix<em>.</em></Link>
        <div className="badge">AI CV OPTIMISATION</div>
      </div>

      <div className="main">
        <div className="steps">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const isOn = step === n;
            const isDone = step > n;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div className={`si ${isOn ? 'on' : ''} ${isDone ? 'done' : ''}`}>
                  <div className="sd">{isDone ? '✓' : n}</div>
                  <span>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`sl ${step > n ? 'done' : ''}`} style={{ flex: 1 }} />}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <>
            <div className="card">
              <div className="ct">Upload your current CV</div>
              <div
                className={`uz ${form.fileName ? 'filled' : ''}`}
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}
              >
                <div className="uz-icon">📄</div>
                <div className="uz-label"><strong>Click to upload</strong> or drag and drop</div>
                <div className="uz-sub">PDF, Word or plain text · Max 5MB</div>
                {form.fileName && <div className="fbadge">📄 {form.fileName}</div>}
                {uploading && <div style={{ marginTop: 8, fontSize: 12, color: '#7FA8F5' }}>Reading your CV...</div>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
            </div>
            <div className="card">
              <div className="ct">Job description <span className="opt">(optional — makes CVs sharper)</span></div>
              <div className="f">
                <textarea value={form.jd} onChange={e => set('jd', e.target.value)} placeholder="Paste a job description here for a more targeted output..." />
              </div>
            </div>
            <button className="btn" onClick={() => setStep(2)}>Continue →</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="card">
              <div className="ct">Tell us about you</div>
              <div className="fgrid">
                <div className="f"><label>Full name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" /></div>
                <div className="f"><label>Email *</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" /></div>
                <div className="f"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+353 or +44..." /></div>
                <div className="f"><label>Current role</label><input value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Registered Nurse" /></div>
                <div className="f full"><label>Target role / sector</label><input value={form.target} onChange={e => set('target', e.target.value)} placeholder="e.g. Cybersecurity analyst, FP&A, NHS nursing..." /></div>
                <div className="f full"><label>Biggest career challenge</label><textarea value={form.challenge} onChange={e => set('challenge', e.target.value)} placeholder="e.g. Not getting callbacks, breaking into a new sector..." /></div>
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
            {!canProceedStep2 && error && <div className="err">Please enter your name and email to continue.</div>}
            <div className="nav">
              <button className="gbtn" onClick={() => setStep(1)}>← Back</button>
              <button className="btn" style={{ flex: 1, marginTop: 0 }} onClick={() => { if (canProceedStep2) setStep(3); else setError('required'); }}>Continue →</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="card">
              <div className="pill">✦ What you get</div>
              <div className="cvc"><span style={{ fontSize: 18 }}>🎯</span><div><div className="cvn">CV 1 — Primary Target</div><div className="cvd">Laser-focused on your target role & sector</div></div></div>
              <div className="cvc"><span style={{ fontSize: 18 }}>🔀</span><div><div className="cvn">CV 2 — Adjacent Opportunity</div><div className="cvd">A neighbouring role your background supports</div></div></div>
              <div className="cvc"><span style={{ fontSize: 18 }}>🌐</span><div><div className="cvn">CV 3 — Broader Positioning</div><div className="cvd">Transferable-skills angle — more doors open</div></div></div>
              <div className="divider" />
              <div className="pr"><span className="pl">3 fully optimised CVs</span><span className="pv">€39</span></div>
              <div className="pr"><span className="pl">ATS optimised for your market</span><span className="pv">Included</span></div>
              <div className="pr"><span className="pl">Delivered to your email</span><span className="pv">Instantly</span></div>
              <div className="divider" />
              <div className="pr"><span className="pl" style={{ fontWeight: 600, color: '#E6ECF5' }}>Total</span><span className="ptotal">€39</span></div>
            </div>
            <div className="card">
              <div className="ct">Pay securely</div>
              <p style={{ fontSize: 13, color: '#9FB0C8', lineHeight: 1.6, marginBottom: 4 }}>
                Your CVs will be generated immediately after payment and delivered to <strong style={{ color: '#fff' }}>{form.email}</strong> as Word documents.
              </p>
              {error && <div className="err">{error}</div>}
              <button className="btn" disabled={submitting} onClick={handleCheckout}>
                {submitting ? '⏳ Redirecting to payment...' : '🔒 Pay €39 — Get My CVs'}
              </button>
              <div className="note">Secured by Stripe · Card, Apple Pay, Google Pay accepted</div>
            </div>
            <div className="nav"><button className="gbtn" onClick={() => setStep(2)}>← Back</button></div>
          </>
        )}
      </div>
    </>
  );
}
