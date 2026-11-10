import { useState, useEffect } from 'react';
import Link from 'next/link';
import { trackCta, trackBeginCheckout, track } from '../lib/analytics';
import { OFFERS } from '../lib/offers';
import { Seo } from '../lib/seo';

// Landing page for the graduate / international-student campaign.
// Ads point here with ?src=<creative>. The src tag travels through checkout and is stored on the order,
// so revenue can be matched to the ad that earned it.

const PROOF = [
  { n: 'Donal', big: '7 interviews', t: 'His CV said "phone sales". The real work was ~150 outbound calls a day and 20–50 sales a week. Figures as reported by him.' },
  { n: 'Michelle', big: '3 interviews', t: 'Same degree as her class. Her hospital hours and project work were the difference: Stryker, Alcon and DePuy. Her own result.' },
];

const STEPS = [
  ['1', 'Pay and send your CV', 'Takes about two minutes. No account to create.'],
  ['2', 'Tell us the job you want', 'Paste one real job advert. We position you for that role, not for "jobs in general".'],
  ['3', 'We find the evidence you missed', 'A few specific questions about your projects, work and results. Nothing is invented.'],
  ['4', 'Your CV arrives by email', 'Word and PDF, written for that role. One free revision within 7 days.'],
];

export default function Graduates() {
  const [buying, setBuying] = useState('');
  const [err, setErr] = useState('');
  const [src, setSrc] = useState('');

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const s = (p.get('src') || p.get('utm_content') || p.get('utm_source') || '').replace(/[^a-z0-9_]/gi, '').slice(0, 24);
      setSrc(s);
      track('graduates_view', { src: s || 'direct' });
    } catch (e) { /* analytics must never break the page */ }
  }, []);

  async function buy(productId) {
    const offer = OFFERS[productId];
    setBuying(productId);
    setErr('');
    trackCta(`buy_${productId}`, 'graduates', productId);
    try {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productId, src: src || 'graduates' }),
      });
      const json = await r.json();
      if (json.url) {
        trackBeginCheckout(productId, offer.name, offer.price);
        window.location.href = json.url;
      } else { setBuying(''); setErr('Checkout is not available right now. Please email info@asovix.com and we will sort it straight away.'); }
    } catch (e) { setBuying(''); setErr('Checkout is not available right now. Please email info@asovix.com and we will sort it straight away.'); }
  }

  return (
    <>
      <Seo
        title="CV help for graduates and international students | Asovix"
        description="A CV built from your real evidence and positioned for one specific job. €49, one payment, Word and PDF by email."
        path="/graduates"
      />
      <div className="page">
        <header className="top">
          <Link href="/" className="logo">Asovix<span>.</span></Link>
        </header>

        <section className="hero">
          <div className="kicker">FOR GRADUATES AND INTERNATIONAL STUDENTS</div>
          <h1>Applying everywhere. Hearing nothing back.</h1>
          <p className="lead">Employers decide in seconds. Most graduate CVs list what you studied, not what you can prove. We find the evidence you already have and position it for the one job you want.</p>
          <button className="cta" onClick={() => buy('grad_cv')} disabled={!!buying}>
            {buying === 'grad_cv' ? 'Opening checkout…' : 'Get my CV positioned: €49'}
          </button>
          <div className="small">One payment. No subscription. Word and PDF by email.</div>
        </section>

        <section className="sec">
          <h2>The problem is rarely your experience</h2>
          <div className="two">
            <div className="card">
              <div className="label bad">WHAT MOST CVS SAY</div>
              <p>"Responsible for customer service."<br />"Worked on a group project."<br />"Good communication skills."</p>
            </div>
            <div className="card">
              <div className="label good">WHAT EMPLOYERS WANT TO SEE</div>
              <p>What you did, how many, how often, and what changed. In the words the job advert uses.</p>
            </div>
          </div>
          <p className="muted">Asovix matches your genuine experience to what employers are actually asking for. We never invent anything: if your CV could not survive the interview, we do not write it.</p>
        </section>

        <section className="sec">
          <h2>How it works</h2>
          <div className="steps">
            {STEPS.map(([n, t, d]) => (
              <div className="step" key={n}><div className="num">{n}</div><div><div className="st">{t}</div><div className="sd">{d}</div></div></div>
            ))}
          </div>
        </section>

        <section className="sec" id="price">
          <h2>Choose your starting point</h2>
          <div className="two">
            <div className="card price">
              <div className="pname">Graduate CV Positioning</div>
              <div className="pp">€49 <span>once</span></div>
              <ul>
                <li>One CV for one target job</li>
                <li>Built from your real evidence</li>
                <li>Keywords from the actual advert</li>
                <li>Word and PDF by email</li>
                <li>One free revision within 7 days</li>
              </ul>
              <button className="cta" onClick={() => buy('grad_cv')} disabled={!!buying}>{buying === 'grad_cv' ? 'Opening checkout…' : 'Get the CV: €49'}</button>
            </div>
            <div className="card price hot">
              <div className="badge">FULL APPLICATION</div>
              <div className="pname">Graduate Application Package</div>
              <div className="pp">€149 <span>once</span></div>
              <ul>
                <li>Everything in the CV service</li>
                <li>LinkedIn profile rebuilt to match</li>
                <li>Cover letter for one application</li>
                <li>One consistent story across all three</li>
                <li>Two free revision rounds within 7 days</li>
              </ul>
              <button className="cta" onClick={() => buy('grad_package')} disabled={!!buying}>{buying === 'grad_package' ? 'Opening checkout…' : 'Get the full package: €149'}</button>
            </div>
          </div>
          {err && <div className="err">{err}</div>}
          <div className="small center">Secure checkout by PayPal, with or without a PayPal account. We cannot promise interviews or a job. We do promise your CV will show an employer what you are good at, and one free revision if it does not.</div>
        </section>

        <section className="sec">
          <h2>What the work finds</h2>
          <div className="two">
            {PROOF.map((p) => (
              <div className="card" key={p.n}>
                <div className="big">{p.big}</div>
                <div className="pn">{p.n}</div>
                <p>{p.t}</p>
              </div>
            ))}
          </div>
          <div className="small center">Individual outcomes, shared with permission. Not averages, and not a promise of the same. Asovix has worked one-to-one with 30+ candidates.</div>
        </section>

        <section className="sec final">
          <h2>Your experience is already there. Make it visible.</h2>
          <button className="cta" onClick={() => buy('grad_cv')} disabled={!!buying}>Get my CV positioned: €49</button>
          <div className="small">Questions? <a href="mailto:info@asovix.com">info@asovix.com</a></div>
        </section>

        <footer className="foot">Asovix · Cork, Ireland · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></footer>
      </div>

      <style jsx global>{`
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; margin: 0; }
      `}</style>
      <style jsx>{`
        .page { max-width: 880px; margin: 0 auto; padding: 0 16px 40px; }
        .top { padding: 18px 0; }
        .top :global(a) { font-family: 'DM Serif Display', serif; font-size: 24px; color: #fff; text-decoration: none; }
        .top :global(a span) { color: #4D8DFF; }
        .hero { padding: 36px 0 28px; }
        .kicker { font-size: 12px; letter-spacing: 0.14em; color: #7FA8F5; margin-bottom: 14px; }
        h1 { font-family: 'DM Serif Display', serif; font-size: clamp(34px, 7vw, 56px); line-height: 1.08; color: #fff; margin: 0 0 16px; max-width: 760px; }
        .lead { font-size: 18px; line-height: 1.6; color: #C7D4E8; max-width: 640px; margin: 0 0 24px; }
        .cta { display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; border: 0; border-radius: 10px; padding: 15px 24px; font-size: 16px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .cta:disabled { opacity: 0.6; cursor: default; }
        .small { font-size: 13px; color: #9FB0C8; margin-top: 12px; line-height: 1.55; }
        .center { text-align: center; max-width: 640px; margin: 16px auto 0; }
        .sec { padding: 34px 0; border-top: 1px solid #14203A; }
        h2 { font-family: 'DM Serif Display', serif; font-size: clamp(26px, 4.5vw, 36px); color: #fff; margin: 0 0 20px; }
        .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card { background: #0C1426; border: 1px solid #1B2A47; border-radius: 14px; padding: 22px; }
        .card p { color: #C7D4E8; line-height: 1.65; margin: 8px 0 0; }
        .label { font-size: 11px; letter-spacing: 0.14em; margin-bottom: 4px; }
        .bad { color: #F87171; } .good { color: #7FE0A8; }
        .muted { color: #9FB0C8; line-height: 1.65; margin-top: 18px; }
        .steps { display: grid; gap: 14px; }
        .step { display: flex; gap: 14px; align-items: flex-start; }
        .num { flex: none; width: 32px; height: 32px; border-radius: 50%; background: #1B2A47; color: #7FA8F5; display: grid; place-items: center; font-weight: 700; }
        .st { color: #fff; font-weight: 600; } .sd { color: #9FB0C8; line-height: 1.55; margin-top: 2px; }
        .price { display: flex; flex-direction: column; position: relative; }
        .price.hot { border-color: #4D8DFF; }
        .badge { position: absolute; top: -11px; left: 18px; background: #4D8DFF; color: #060B16; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 99px; }
        .pname { font-weight: 600; color: #fff; font-size: 17px; }
        .pp { font-family: 'DM Serif Display', serif; font-size: 44px; color: #fff; margin: 6px 0 12px; }
        .pp span { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #9FB0C8; }
        ul { list-style: none; padding: 0; margin: 0 0 20px; flex: 1; }
        li { color: #C7D4E8; padding: 7px 0 7px 24px; position: relative; line-height: 1.45; }
        li::before { content: '✓'; position: absolute; left: 0; color: #4D8DFF; font-weight: 700; }
        .big { font-family: 'DM Serif Display', serif; font-size: 34px; color: #7FE0A8; }
        .pn { color: #fff; font-weight: 600; }
        .err { margin-top: 14px; color: #F87171; text-align: center; }
        .final { text-align: center; }
        .final h2 { max-width: 560px; margin-left: auto; margin-right: auto; }
        .foot { border-top: 1px solid #14203A; padding-top: 18px; color: #64748F; font-size: 13px; text-align: center; }
        .foot :global(a), .small :global(a) { color: #9FB0C8; }
        @media (max-width: 680px) { .two { grid-template-columns: 1fr; } .cta { width: 100%; } }
      `}</style>
    </>
  );
}
