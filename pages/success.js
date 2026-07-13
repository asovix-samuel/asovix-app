import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Success() {
  // generating | sent | already | failed
  const [state, setState] = useState('generating');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) { setState('failed'); return; }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const json = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok && (json.status === 'done' || json.status === 'already')) {
          setState(json.status === 'already' ? 'already' : 'sent');
        } else {
          setState('failed');
        }
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Head>
        <title>Payment successful — Asovix</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
      `}</style>

      <style jsx>{`
        .header { background: rgba(6,11,22,0.75); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0 24px; height: 60px; display: flex; align-items: center; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #fff; text-decoration: none; }
        .logo em { color: #4D8DFF; font-style: italic; }
        .main { max-width: 480px; margin: 0 auto; padding: 56px 16px; text-align: center; }
        .icon { width: 68px; height: 68px; background: rgba(46,109,228,0.14); border: 1px solid rgba(77,141,255,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 22px; font-size: 28px; }
        h1 { font-family: 'DM Serif Display', serif; font-size: 30px; color: #fff; margin-bottom: 12px; }
        .sub { font-size: 15px; color: #9FB0C8; line-height: 1.7; margin-bottom: 28px; }
        .card { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 22px; margin-bottom: 16px; text-align: left; }
        .ct { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 12px; }
        .row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 13px; color: #9FB0C8; line-height: 1.5; }
        .num { width: 20px; height: 20px; border-radius: 50%; background: #3B7DF0; color: #fff; font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .tip { font-size: 12px; color: #64748F; line-height: 1.9; }
        a.back { display: inline-block; margin-top: 12px; font-size: 13px; color: #7FA8F5; text-decoration: none; }
        a.back:hover { text-decoration: underline; }
        .spinner { display: inline-block; width: 26px; height: 26px; border: 3px solid rgba(77,141,255,0.25); border-top-color: #4D8DFF; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .err { background: rgba(220,38,38,0.1); border: 1px solid rgba(248,113,113,0.4); color: #F87171; font-size: 13px; padding: 14px; border-radius: 10px; line-height: 1.6; text-align: left; }
      `}</style>

      <div className="header">
        <Link href="/" className="logo">Asovix<em>.</em></Link>
      </div>

      <div className="main">
        {state === 'generating' && (
          <>
            <div className="icon"><span className="spinner" /></div>
            <h1>Payment confirmed.</h1>
            <p className="sub">
              Your three CVs are being generated <strong style={{ color: '#fff' }}>right now</strong> — this
              takes about a minute. Keep this page open.
            </p>
          </>
        )}

        {(state === 'sent' || state === 'already') && (
          <>
            <div className="icon">✓</div>
            <h1>Your CVs are on the way.</h1>
            <p className="sub">
              All three CVs have been generated and emailed to you.
              {state === 'already' ? ' (This order was already fulfilled.)' : ''}
            </p>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="icon">!</div>
            <h1>Payment received.</h1>
            <div className="err" style={{ marginBottom: 20 }}>
              Automatic delivery hit a snag — but your payment is safe and we've been alerted.
              Your CVs will be delivered to your email shortly. If nothing arrives within a few
              hours, reply to any Asovix email or contact info@asovix.com.
            </div>
          </>
        )}

        <div className="card">
          <div className="ct">Check your email for three CVs:</div>
          <div className="row"><div className="num">1</div><span><strong style={{ color: '#E6ECF5' }}>CV 1 — Primary Target</strong> — laser-focused on the role you told us you want</span></div>
          <div className="row"><div className="num">2</div><span><strong style={{ color: '#E6ECF5' }}>CV 2 — Adjacent Opportunity</strong> — a neighbouring role your background credibly supports</span></div>
          <div className="row"><div className="num">3</div><span><strong style={{ color: '#E6ECF5' }}>CV 3 — Broader Positioning</strong> — transferable-skills angle that opens more doors</span></div>
        </div>

        <div className="card">
          <div className="ct">Quick tips before you apply</div>
          <p className="tip">
            💡 Save each CV as a PDF before attaching to applications<br />
            💡 Match your LinkedIn headline to whichever CV you're sending<br />
            💡 Tailor the subject line of each application to the exact job title<br />
            💡 Check your spam folder if the email doesn't arrive within 5 minutes
          </p>
        </div>

        <Link href="/" className="back">← Back to Asovix</Link>
      </div>
    </>
  );
}
