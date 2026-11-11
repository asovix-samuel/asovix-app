import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// Private page for a client to change their delivered documents. The link carries a random token (?t=...) that is the only key.
// Nothing about any other client can be reached from here, and nothing on this page is indexed.

const API = '/api/delivery/revise/';

export default function Revise() {
  const [token, setToken] = useState(null);
  const [state, setState] = useState(null);
  const [type, setType] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load(t) {
    try {
      const r = await fetch(API + encodeURIComponent(t));
      const json = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(json.error || 'Something went wrong. Please try again.'); return; }
      setErr(''); setState(json);
    } catch { setErr('We could not reach Asovix just now. Check your connection and try again.'); }
  }
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || '';
    setToken(t);
    if (t) load(t); else setErr('This link does not look right. Open it from your delivery email.');
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await fetch(API + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, text }) });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(json.error || 'Something went wrong. Please try again.'); setBusy(false); return; }
      if (json.kind === 'pay' && json.url) { window.location.href = json.url; return; }
      if (json.kind === 'buy') {
        const c = await fetch('/api/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: json.checkoutProduct, src: json.source }) });
        const cj = await c.json().catch(() => ({}));
        if (cj.url) { window.location.href = cj.url; return; }
        setErr('Checkout is not available right now. Please email info@asovix.com.');
        setBusy(false); return;
      }
      setMsg(json.message || 'Thank you.'); setText(''); setType('');
      await load(token);
    } catch { setErr('We could not reach Asovix just now. Please try again.'); }
    setBusy(false);
  }

  const askText = type === 'tone' ? 'What would you like changed in the wording or tone?'
    : type === 'correction' ? 'What is wrong, and what is the correct version?'
    : type === 'new_info' ? 'What would you like us to add? Include dates, numbers and results if you have them.'
    : '';

  return (
    <>
      <Head>
        <title>Update your documents | Asovix</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="page">
        <header><Link href="/" className="logo">Asovix<span>.</span></Link></header>
        <main>
          <h1>Update your documents</h1>
          {err && <div className="err" role="alert">{err}</div>}
          {msg && <div className="ok">{msg}</div>}

          {state && state.stage === 'not_ready' && <div className="card"><p>{state.message}</p></div>}
          {state && state.stage === 'working' && <div className="card"><p>{state.message}</p></div>}

          {state && state.stage === 'open' && (
            <form className="card" onSubmit={submit}>
              <p className="lead">Hi {state.firstName}. {state.freeLeft > 0
                ? `You have ${state.freeLeft} free ${state.freeLeft === 1 ? 'change' : 'changes'} left until ${new Date(state.windowEnds).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}.`
                : `Your free changes are used up, so an extra round is €${state.extraRoundPrice}. We start it automatically once it is paid.`}</p>
              <fieldset>
                <legend>What would you like to do?</legend>
                {state.types.map((t) => (
                  <label key={t.id} className={'opt' + (type === t.id ? ' on' : '')}>
                    <input type="radio" name="type" value={t.id} checked={type === t.id} onChange={() => setType(t.id)} /> {t.label}
                    {t.id === 'adapt' && <small> (a new job-specific CV, €{state.adaptPrice})</small>}
                  </label>
                ))}
              </fieldset>
              {type && type !== 'adapt' && (
                <>
                  <label htmlFor="text" className="q">{askText}</label>
                  <textarea id="text" required minLength={10} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
                  <div className="hint">We only use facts you give us or that are already in your CV, so everything stays true and defensible.</div>
                </>
              )}
              {type === 'adapt' && <div className="hint">You will order a new job-specific CV and paste the new advert on the next page.</div>}
              <button className="go" disabled={busy || !type || (type !== 'adapt' && text.trim().length < 10)}>
                {busy ? 'Working…' : type === 'adapt' ? 'Continue to order' : state.freeLeft > 0 ? 'Send my request' : `Pay €${state.extraRoundPrice} and send`}
              </button>
              <div className="hint center">Your documents: {(state.documents || []).join(', ') || 'your CV'}. Updated documents arrive by email once checked.</div>
            </form>
          )}
        </main>
      </div>
      <style jsx global>{`body { margin: 0; background: #060B16; color: #E6ECF5; font-family: 'DM Sans', sans-serif; }`}</style>
      <style jsx>{`
        .page { max-width: 640px; margin: 0 auto; padding: 0 16px 60px; }
        header { padding: 18px 0; }
        header :global(a) { font-family: 'DM Serif Display', serif; font-size: 24px; color: #fff; text-decoration: none; }
        header :global(a span) { color: #4D8DFF; }
        h1 { font-family: 'DM Serif Display', serif; font-size: 34px; color: #fff; margin: 8px 0 18px; }
        .card { background: #0C1426; border: 1px solid #1B2A47; border-radius: 16px; padding: 22px; }
        .lead { color: #C7D4E8; line-height: 1.6; margin: 0 0 14px; }
        fieldset { border: 0; padding: 0; margin: 0 0 14px; }
        legend { font-weight: 600; color: #fff; margin-bottom: 8px; }
        .opt { display: block; padding: 12px 14px; border: 1px solid #1B2A47; border-radius: 12px; margin-bottom: 8px; cursor: pointer; color: #E6ECF5; }
        .opt.on { border-color: #4D8DFF; background: rgba(77,141,255,.08); }
        .opt small { color: #9FB0C8; }
        .q { display: block; font-weight: 600; color: #fff; margin: 10px 0 6px; }
        textarea { width: 100%; box-sizing: border-box; min-height: 130px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 12px; color: #fff; font: inherit; }
        .hint { color: #9FB0C8; font-size: 13px; margin-top: 8px; line-height: 1.5; }
        .center { text-align: center; }
        .go { width: 100%; margin-top: 16px; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; border: 0; border-radius: 12px; padding: 15px; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
        .go:disabled { opacity: .5; cursor: default; }
        .err { background: rgba(220,38,38,.1); border: 1px solid rgba(248,113,113,.4); color: #F87171; padding: 12px 14px; border-radius: 10px; margin-bottom: 14px; }
        .ok { background: rgba(111,214,156,.1); border: 1px solid rgba(111,214,156,.35); color: #6fd69c; padding: 12px 14px; border-radius: 10px; margin-bottom: 14px; }
      `}</style>
    </>
  );
}
