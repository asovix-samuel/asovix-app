import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

/* ── Inline icons ── */
const Ic = {
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 7"/></svg>,
};

const ORGS = ['Morgan McKinley', 'Osborne Recruitment', 'Noel Recruitment', 'CPL Healthcare', 'Teamwork.com', 'Ryanair Labs', 'Cork Airport', 'Capaciteam', 'AA Euro Group', 'MTU'];

const NEXT_STEPS = [
  { n: '1', t: 'Within minutes of ordering', d: 'Three interview-ready CVs land in your inbox — each communicating your real experience for a different angle of your target market.' },
  { n: '2', t: 'You know exactly which CV to send where', d: 'Your delivery email explains it: one for your primary target, one for the strongest adjacent role, one for broader opportunities.' },
  { n: '3', t: 'You apply with documents recruiters actually read', d: 'Save as PDF, match your LinkedIn headline, and target each application to the exact job title.' },
  { n: '4', t: 'Interviews — and free adjustments until then', d: 'Need a tweak? Reply to your email. We adjust free of charge, because the goal isn’t a document. It’s interviews.' },
];

const FAQS = [
  { q: 'Why not just use ChatGPT?', a: 'You can — and recruiters told us they can spot the result instantly. Asovix is built on 26 customer discovery interviews: 11 with hiring leaders at organisations like Morgan McKinley, CPL Healthcare and Ryanair Labs, and 16 with graduates. Every document is positioned around what those hiring leaders said actually gets people shortlisted — with a named founder accountable for every delivery and free adjustments until it works.' },
  { q: 'How fast do I get everything?', a: 'Communicate Your Value (€39): within minutes. Increase Recruiter Visibility (€119) and The Complete Positioning (€219) include personal review, so those arrive within 24 hours.' },
  { q: 'Is anything invented on my CV?', a: 'Never. We reposition your real experience — reframing it in the language hiring decisions are made in. Nothing is fabricated. Your CV has to survive an interview.' },
  { q: 'Will my CV pass application software?', a: 'Yes — clean structure, standard headings, keyword alignment. But software is the smaller battle: our research shapes what happens in the seconds after a human opens it.' },
  { q: 'What if I want changes?', a: 'Reply to your delivery email. Adjustments are free. We want you interviewing, not filing complaints.' },
  { q: 'Is this a subscription?', a: 'No. One payment, no renewals, ever. What you buy is yours.' },
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState('idle');
  const [openFaq, setOpenFaq] = useState(-1);
  const [buying, setBuying] = useState('');

  async function handleSubscribe(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubState('sending');
    try {
      const r = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubState(r.ok ? 'done' : 'error');
    } catch { setSubState('error'); }
  }

  async function buy(product) {
    setBuying(product);
    try {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      });
      const json = await r.json();
      if (json.url) window.location.href = json.url;
      else setBuying('');
    } catch { setBuying(''); }
  }

  return (
    <>
      <Head>
        <title>Asovix — Research-backed career positioning for graduates</title>
        <meta name="description" content="Built from 26 customer discovery interviews with hiring leaders at Morgan McKinley, CPL Healthcare, Ryanair Labs and more. We help graduates communicate their value — and get interviews." />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

        .nav { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(14px); background: rgba(6,11,22,0.75); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .navin { max-width: 1080px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 24px; color: #fff; }
        .logo em { color: #4D8DFF; font-style: italic; }
        .navlinks { display: flex; gap: 24px; align-items: center; }
        .navlinks a { font-size: 13.5px; color: #9FB0C8; text-decoration: none; transition: color 0.2s ease-out; }
        .navlinks a:hover { color: #fff; }
        .navcta { background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff !important; padding: 9px 18px; border-radius: 10px; font-weight: 600; box-shadow: 0 4px 20px rgba(59,125,240,0.35); }
        @media (max-width: 760px) { .navlinks a:not(.navcta) { display: none; } }

        .hero { position: relative; padding: 88px 0 56px; text-align: center; overflow: hidden; background-image: url(/hexpattern.svg); }
        .hero::before { content: ''; position: absolute; inset: -40% -20% auto; height: 130%; background: radial-gradient(ellipse 60% 55% at 50% 0%, rgba(46,109,228,0.28), transparent 70%); pointer-events: none; }
        .badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #7FA8F5; border: 1px solid rgba(77,141,255,0.35); background: rgba(46,109,228,0.12); padding: 7px 16px; border-radius: 100px; margin-bottom: 28px; animation: fadeUp 0.6s ease-out both; }
        h1 { font-family: 'DM Serif Display', serif; font-size: clamp(38px, 6vw, 62px); line-height: 1.08; color: #fff; max-width: 780px; margin: 0 auto 22px; animation: fadeUp 0.6s 0.08s ease-out both; }
        h1 .blue { background: linear-gradient(100deg, #4D8DFF, #7FB2FF); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .sub { font-size: 17px; color: #9FB0C8; line-height: 1.7; max-width: 660px; margin: 0 auto 36px; animation: fadeUp 0.6s 0.16s ease-out both; }
        .sub strong { color: #E6ECF5; }
        .ctarow { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; animation: fadeUp 0.6s 0.24s ease-out both; }
        .cta { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 15px 30px; border-radius: 12px; box-shadow: 0 8px 30px rgba(59,125,240,0.4); transition: transform 0.2s ease-out, box-shadow 0.2s ease-out; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .cta:hover { transform: translateY(-2px); }
        .ghost { display: inline-flex; align-items: center; gap: 8px; color: #C7D4E8; text-decoration: none; font-size: 15px; font-weight: 500; padding: 15px 26px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); transition: all 0.2s ease-out; }
        .ghost:hover { border-color: rgba(255,255,255,0.3); transform: translateY(-2px); }
        .trust { margin-top: 30px; font-size: 12.5px; color: #64748F; letter-spacing: 0.04em; animation: fadeUp 0.6s 0.32s ease-out both; }

        section { padding: 72px 0; }
        .kicker { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #4D8DFF; font-weight: 600; margin-bottom: 14px; text-align: center; }
        h2 { font-family: 'DM Serif Display', serif; font-size: clamp(28px, 4vw, 40px); color: #fff; text-align: center; margin-bottom: 14px; }
        .lead { font-size: 15.5px; color: #9FB0C8; text-align: center; max-width: 640px; margin: 0 auto 44px; line-height: 1.7; }
        .lead strong { color: #E6ECF5; }

        .statsbar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 760px; margin: 0 auto 40px; }
        .sbox { background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(77,141,255,0.25); border-radius: 16px; padding: 26px 16px; text-align: center; }
        .sbox b { display: block; font-family: 'DM Serif Display', serif; font-size: 40px; color: #4D8DFF; }
        .sbox span { font-size: 12.5px; color: #9FB0C8; letter-spacing: 0.04em; }
        @media (max-width: 620px) { .statsbar { grid-template-columns: 1fr; } }
        .orgs { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 28px; max-width: 860px; margin: 0 auto; }
        .orgs span { font-size: 14.5px; font-weight: 600; color: #8FA3BF; opacity: 0.85; }

        .split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 940px; margin: 0 auto; }
        .half { border-radius: 20px; padding: 34px 30px; }
        .half.problem { background: rgba(220,38,38,0.05); border: 1px solid rgba(248,113,113,0.2); }
        .half.solution { background: rgba(52,199,123,0.05); border: 1px solid rgba(52,199,123,0.25); }
        .half h3 { font-family: 'DM Serif Display', serif; font-size: 22px; color: #fff; margin-bottom: 14px; }
        .half p { font-size: 14px; color: #9FB0C8; line-height: 1.75; margin-bottom: 10px; }
        .half p strong { color: #E6ECF5; }
        @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }

        .founder { display: grid; grid-template-columns: 300px 1fr; gap: 44px; align-items: start; background: linear-gradient(135deg, rgba(46,109,228,0.12), rgba(46,109,228,0.03)); border: 1px solid rgba(77,141,255,0.3); border-radius: 24px; padding: 48px 44px; }
        .favatar { width: 130px; height: 130px; border-radius: 50%; background: linear-gradient(135deg, #4D8DFF, #1B3A6B); border: 2px solid rgba(255,255,255,0.3); overflow: hidden; margin: 0 auto 18px; }
        .favatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .fbadgebox { text-align: center; }
        .fname { font-size: 18px; font-weight: 700; color: #fff; }
        .frole { font-size: 12.5px; color: #7FA8F5; margin-top: 3px; letter-spacing: 0.06em; text-transform: uppercase; }
        .fstats { margin-top: 22px; display: grid; gap: 10px; }
        .fstat { background: rgba(6,11,22,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; }
        .fstat b { display: block; font-family: 'DM Serif Display', serif; font-size: 24px; color: #4D8DFF; }
        .fstat span { font-size: 11.5px; color: #9FB0C8; }
        .founder h2 { text-align: left; font-size: clamp(24px, 3vw, 32px); }
        .ftext p { font-size: 15px; color: #C7D4E8; line-height: 1.85; margin-bottom: 16px; }
        .ftext p strong { color: #fff; }
        .fsig { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 19px; color: #7FA8F5; margin-top: 6px; }
        @media (max-width: 820px) { .founder { grid-template-columns: 1fr; padding: 36px 26px; } }

        .rgallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .rgallery .rcard { display: block; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s ease-out, border-color 0.2s ease-out; }
        .rgallery .rcard:hover { transform: translateY(-4px); border-color: rgba(77,141,255,0.5); }
        .rgallery .rcard img { display: block; width: 100%; height: auto; }
        .rgallery .rcard:last-child { grid-column: 2 / 3; }
        @media (max-width: 980px) { .rgallery { grid-template-columns: repeat(2, 1fr); } .rgallery .rcard:last-child { grid-column: auto; } }
        @media (max-width: 640px) { .rgallery { grid-template-columns: 1fr; } }

        .timeline { max-width: 640px; margin: 0 auto; }
        .titem { display: flex; gap: 18px; padding: 0 0 28px 0; position: relative; }
        .titem::before { content: ''; position: absolute; left: 16px; top: 38px; bottom: 0; width: 2px; background: rgba(77,141,255,0.25); }
        .titem:last-child::before { display: none; }
        .tnum { width: 34px; height: 34px; border-radius: 50%; background: rgba(46,109,228,0.18); border: 1px solid rgba(77,141,255,0.4); color: #7FA8F5; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 1; }
        .tbody .tt { font-size: 15.5px; font-weight: 600; color: #fff; margin-bottom: 6px; padding-top: 5px; }
        .tbody .td { font-size: 13.5px; color: #9FB0C8; line-height: 1.65; }

        .pgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: stretch; }
        .pcard { position: relative; background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px 28px; display: flex; flex-direction: column; transition: transform 0.2s ease-out; }
        .pcard:hover { transform: translateY(-4px); }
        .pcard.hot { border-color: rgba(77,141,255,0.55); background: linear-gradient(180deg, rgba(46,109,228,0.14), rgba(46,109,228,0.03)); box-shadow: 0 10px 44px rgba(46,109,228,0.22); }
        .hotbadge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; padding: 5px 14px; border-radius: 100px; white-space: nowrap; }
        .pname { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .psub { font-size: 12.5px; color: #64748F; margin-bottom: 4px; }
        .pdel { font-size: 12px; color: #7FA8F5; margin-bottom: 18px; font-weight: 500; }
        .pprice { font-family: 'DM Serif Display', serif; font-size: 44px; color: #fff; margin-bottom: 4px; }
        .pprice span { font-size: 15px; color: #64748F; font-family: 'DM Sans', sans-serif; }
        .panchor { font-size: 12px; color: #7FE0A8; margin-bottom: 18px; line-height: 1.5; }
        .pfeat { list-style: none; margin-bottom: 26px; flex: 1; }
        .pfeat li { font-size: 13.5px; color: #C7D4E8; padding: 7px 0; line-height: 1.55; display: flex; gap: 9px; align-items: flex-start; }
        .pfeat li svg { flex-shrink: 0; margin-top: 3px; }
        .pbtn { display: block; width: 100%; text-align: center; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px; border-radius: 12px; transition: all 0.2s ease-out; cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; }
        .pbtn.primary { background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; box-shadow: 0 6px 24px rgba(59,125,240,0.4); }
        .pbtn.outline { border: 1px solid rgba(255,255,255,0.16); color: #C7D4E8; background: rgba(255,255,255,0.03); }
        .pbtn:disabled { opacity: 0.5; cursor: wait; }
        .nosub { text-align: center; margin-top: 26px; font-size: 13.5px; color: #7FE0A8; font-weight: 500; }
        @media (max-width: 840px) { .pgrid { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; } }

        .magnet { background: linear-gradient(135deg, rgba(46,109,228,0.16), rgba(46,109,228,0.05)); border: 1px solid rgba(77,141,255,0.3); border-radius: 24px; padding: 52px 40px; text-align: center; }
        .mform { display: flex; gap: 10px; max-width: 440px; margin: 28px auto 0; }
        .mform input { flex: 1; font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(6,11,22,0.6); color: #fff; outline: none; }
        .mform input:focus { border-color: #4D8DFF; }
        .mform button { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; padding: 14px 24px; border-radius: 12px; border: none; cursor: pointer; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; }
        .mform button:disabled { opacity: 0.5; }
        .mdone { margin-top: 28px; font-size: 15px; color: #7FE0A8; font-weight: 500; }
        .merr { margin-top: 14px; font-size: 13px; color: #F87171; }
        @media (max-width: 560px) { .mform { flex-direction: column; } }

        .b2b { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 48px 44px; }
        .b2b h2 { text-align: left; }
        .b2b .lead { text-align: left; margin: 0 0 24px; }
        .b2blist { list-style: none; margin-bottom: 28px; }
        .b2blist li { font-size: 14px; color: #C7D4E8; padding: 7px 0; display: flex; gap: 10px; }
        .b2blist li::before { content: '→'; color: #4D8DFF; font-weight: 700; }
        .stat { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 26px 18px; text-align: center; }
        .statn { font-family: 'DM Serif Display', serif; font-size: 34px; color: #4D8DFF; margin-bottom: 6px; }
        .statl { font-size: 13px; color: #9FB0C8; line-height: 1.5; }
        @media (max-width: 780px) { .b2b { grid-template-columns: 1fr; padding: 36px 28px; } }

        .faq { max-width: 680px; margin: 0 auto; }
        .fitem { border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; margin-bottom: 12px; background: rgba(255,255,255,0.025); overflow: hidden; }
        .fitem.open { border-color: rgba(77,141,255,0.35); }
        .fq { width: 100%; text-align: left; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; color: #fff; background: none; border: none; padding: 20px 22px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .fq span.chev { color: #4D8DFF; font-size: 13px; transition: transform 0.25s ease-out; }
        .fitem.open .fq span.chev { transform: rotate(180deg); }
        .fa { font-size: 14px; color: #9FB0C8; line-height: 1.75; padding: 0 22px 20px; }

        footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 44px 0; text-align: center; }
        .ftag { font-size: 13px; color: #64748F; margin: 10px 0 18px; }
        .flinks { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        .flinks a { font-size: 13px; color: #9FB0C8; text-decoration: none; }
        .flinks a:hover { color: #fff; }
        .fcopy { margin-top: 22px; font-size: 11.5px; color: #3D4A63; }
      `}</style>

      <nav className="nav">
        <div className="navin">
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="/logo.svg" alt="Asovix logo" width="30" height="33" style={{ display: 'block' }} />Asovix<em>.</em></div>
          <div className="navlinks">
            <a href="#research">The research</a>
            <a href="#founder">Founder</a>
            <a href="#results">Results</a>
            <a href="#pricing">Pricing</a>
            <Link href="/start" className="navcta">Get interview-ready</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="wrap">
          <div className="badge">Research-backed career positioning</div>
          <h1>We help graduates <span className="blue">get interviews.</span></h1>
          <p className="sub">
            We ran <strong>26 customer discovery interviews</strong> — including hiring leaders at
            Morgan McKinley, CPL Healthcare, Ryanair Labs and Osborne Recruitment. Their verdict was
            unanimous: qualified graduates fail because they can't <strong>communicate their value</strong>.
            Asovix fixes that.
          </p>
          <div className="ctarow">
            <Link href="/start" className="cta">Get interview-ready →</Link>
            <a href="#checklist" className="ghost">Get the free checklist first</a>
          </div>
          <div className="trust">One payment · No subscription · 200+ graduates helped · Cork, Ireland</div>
        </div>
      </header>

      {/* ── RESEARCH ── */}
      <section id="research" style={{ paddingTop: 30 }}>
        <div className="wrap">
          <div className="kicker">The evidence</div>
          <h2>Built using insights from hiring leaders.</h2>
          <p className="lead">Before building anything, we asked the people who actually shortlist, interview and hire.</p>
          <div className="statsbar">
            <div className="sbox"><b>26</b><span>customer discovery interviews</span></div>
            <div className="sbox"><b>11</b><span>hiring leaders interviewed</span></div>
            <div className="sbox"><b>10</b><span>organisations, across industries</span></div>
          </div>
          <div className="orgs">
            {ORGS.map((o) => <span key={o}>{o}</span>)}
          </div>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ── */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">The gap</div>
          <h2>Why qualified candidates still fail.</h2>
          <div className="split" style={{ marginTop: 40 }}>
            <div className="half problem">
              <h3>The problem our research found</h3>
              <p><strong>You already have the skills.</strong> Every careers adviser we interviewed said the same thing: graduates possess real, valuable, transferable skills — and consistently fail to recognise or articulate them.</p>
              <p>So applications go out sounding like everyone else's. Recruiters — who are filtering against expectations that never appear in the job description — see nothing to shortlist. Silence follows. Confidence drops. Repeat.</p>
            </div>
            <div className="half solution">
              <h3>How Asovix closes it</h3>
              <p><strong>Not with automation — with positioning.</strong> We take your real experience and reframe it around what our hiring-leader research says actually gets people shortlisted: communicated value, transferable skills, evidence of preparation.</p>
              <p>Intelligent tools help us do it in minutes instead of days. But the method is human, the research is real, and every delivery is accountable to a named founder — with free adjustments until it's right.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOUNDER ── */}
      <section id="founder" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="founder">
            <div className="fbadgebox">
              <div className="favatar"><img src="/founder.jpg" alt="Samuel Adu, Founder of Asovix" /></div>
              <div className="fname">Samuel Adu</div>
              <div className="frole">Founder, Asovix</div>
              <div className="fstats">
                <div className="fstat"><b>200+</b><span>graduates helped one-on-one</span></div>
                <div className="fstat"><b>26</b><span>customer discovery interviews</span></div>
                <div className="fstat"><b>Cork</b><span>built in Ireland, for Irish &amp; UK graduates</span></div>
              </div>
            </div>
            <div className="ftext">
              <div className="kicker" style={{ textAlign: 'left' }}>Meet the founder</div>
              <h2>Every feature here came from a real conversation. None came from assumptions.</h2>
              <p>
                Before Asovix was a company, it was me — sitting with graduates one-on-one, rewriting CVs,
                fixing LinkedIn profiles, preparing interviews. Over 200 of them. The same thing kept happening:
                <strong> same person, same experience, better communicated — suddenly, interviews.</strong>
              </p>
              <p>
                Then I went to the other side of the table: 26 discovery interviews — 16 with graduates,
                11 with recruiters, hiring managers and careers advisers at organisations from Morgan McKinley
                to Ryanair Labs. Their answers, not my assumptions, became <strong>the Asovix Method</strong>.
              </p>
              <p>
                Asovix exists because talented graduates shouldn't be invisible. If your applications are met
                with silence, it's not a qualification problem. It's a communication problem — and that's
                exactly what we fix.
              </p>
              <div className="fsig">— Samuel Adu, BSc Business Technology &amp; Communications</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RESULTS ── */}
      <section id="results" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">Real outcomes</div>
          <h2>Graduates who were being ignored. Until they weren't.</h2>
          <p className="lead">Nursing, cybersecurity, business, law, marketing — different fields, same turnaround.</p>
          <div className="rgallery">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <a key={n} href={`/results/card-${n}.jpg`} target="_blank" rel="noopener noreferrer" className="rcard">
                <img src={`/results/card-${n}.jpg`} alt={`Asovix graduate result ${n}`} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT HAPPENS ── */}
      <section id="next" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">From ignored to interviewed</div>
          <h2>Here's exactly how it happens.</h2>
          <p className="lead">Upload your CV, tell us your target role, pay once. Then:</p>
          <div className="timeline">
            {NEXT_STEPS.map((s) => (
              <div className="titem" key={s.n}>
                <div className="tnum">{s.n}</div>
                <div className="tbody">
                  <div className="tt">{s.t}</div>
                  <div className="td">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING: outcomes, not documents ── */}
      <section id="pricing" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">Pricing</div>
          <h2>One payment. No subscription. Interviews.</h2>
          <p className="lead">
            Subscription tools charge <strong>€20–50 every month</strong> and leave the thinking to you.
            Traditional CV writers charge <strong>€180–600</strong> and take a week.
            Asovix applies real hiring research to your experience — once.
          </p>
          <div className="pgrid">
            <div className="pcard hot">
              <div className="hotbadge">Most popular — delivered in minutes</div>
              <div className="pname">Communicate your value</div>
              <div className="psub">3 interview-ready CVs</div>
              <div className="pdel">Delivered within minutes</div>
              <div className="pprice">€39 <span>once</span></div>
              <div className="panchor">Less than one month of a CV subscription — and it's done for you.</div>
              <ul className="pfeat">
                <li>{Ic.check}Three CVs: primary target, adjacent role, broader angle</li>
                <li>{Ic.check}Positioned using the Asovix Method — built from 26 research interviews</li>
                <li>{Ic.check}Your real experience only — nothing invented</li>
                <li>{Ic.check}Word documents, straight to your inbox</li>
                <li>{Ic.check}Free adjustments until it's right</li>
              </ul>
              <Link href="/start" className="pbtn primary">Start now →</Link>
            </div>
            <div className="pcard">
              <div className="pname">Increase recruiter visibility</div>
              <div className="psub">3 CVs + full LinkedIn overhaul</div>
              <div className="pdel">CVs in minutes · LinkedIn within 24h</div>
              <div className="pprice">€119 <span>once</span></div>
              <div className="panchor">Recruiters check LinkedIn before they call. Make both tell the same story.</div>
              <ul className="pfeat">
                <li>{Ic.check}Everything in Communicate Your Value</li>
                <li>{Ic.check}Headline &amp; About section rewritten to convert</li>
                <li>{Ic.check}Keyword positioning for recruiter search</li>
                <li>{Ic.check}Personally reviewed before delivery</li>
              </ul>
              <button className="pbtn outline" onClick={() => buy('linkedin')} disabled={buying === 'linkedin'}>
                {buying === 'linkedin' ? 'Opening secure checkout…' : 'Get visible →'}
              </button>
            </div>
            <div className="pcard">
              <div className="pname">The complete positioning</div>
              <div className="psub">CVs + LinkedIn + cover letter, human-reviewed</div>
              <div className="pdel">Personally reviewed · within 24h</div>
              <div className="pprice">€219 <span>once</span></div>
              <div className="panchor">Less than standalone LinkedIn optimisation costs elsewhere — and this includes your CVs and cover letter too.</div>
              <ul className="pfeat">
                <li>{Ic.check}Human-reviewed CV set</li>
                <li>{Ic.check}Full LinkedIn overhaul</li>
                <li>{Ic.check}Custom cover letter</li>
                <li>{Ic.check}Arrive as the obvious hire</li>
              </ul>
              <button className="pbtn outline" onClick={() => buy('bundle')} disabled={buying === 'bundle'}>
                {buying === 'bundle' ? 'Opening secure checkout…' : 'Get the complete package →'}
              </button>
            </div>
          </div>
          <div className="nosub">One payment — never a subscription. Secured by Stripe.</div>
        </div>
      </section>

      {/* ── LEAD MAGNET ── */}
      <section id="checklist" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="magnet">
            <div className="kicker">Free download</div>
            <h2>Steal our hiring research. Free.</h2>
            <p className="lead" style={{ marginBottom: 0 }}>
              11 Hiring Leaders, 11 Hiring Insights: real lessons from recruiters and HR leaders —
              drawn directly from our 26 customer discovery interviews. See exactly what gets candidates
              silently rejected, before you spend a cent.
            </p>
            {subState === 'done' ? (
              <div className="mdone">Sent — check your inbox (and spam folder).</div>
            ) : (
              <form className="mform" onSubmit={handleSubscribe}>
                <input type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
                <button type="submit" disabled={subState === 'sending'}>{subState === 'sending' ? 'Sending…' : 'Send it to me'}</button>
              </form>
            )}
            {subState === 'error' && <div className="merr">Something went wrong — please try again.</div>}
          </div>
        </div>
      </section>

      {/* ── B2B ── */}
      <section id="recruiters" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="b2b">
            <div>
              <div className="kicker" style={{ textAlign: 'left' }}>For recruiters &amp; HR teams</div>
              <h2>Turn more CVs into placements.</h2>
              <p className="lead">Asovix helps recruitment teams improve candidate presentation and alignment — so clients say yes faster.</p>
              <ul className="b2blist">
                <li>Better-prepared candidates before they reach you</li>
                <li>Less time wasted on ineligible candidates</li>
                <li>Faster shortlists, fewer rejections</li>
              </ul>
              <a href="https://calendly.com/infoasovix/30min" className="cta" target="_blank" rel="noopener noreferrer">Book a 15-minute call →</a>
            </div>
            <div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="stat"><div className="statn">26</div><div className="statl">discovery interviews behind our method — and counting</div></div>
                <div className="stat"><div className="statn">B2B</div><div className="statl">volume packages for agencies, HR teams and universities</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">FAQ</div>
          <h2>Questions, answered honestly.</h2>
          <p className="lead">Anything else — email info@asovix.com or reply to any Asovix email.</p>
          <div className="faq">
            {FAQS.map((f, i) => (
              <div className={`fitem ${openFaq === i ? 'open' : ''}`} key={f.q}>
                <button className="fq" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i}>
                  {f.q}
                  <span className="chev">▼</span>
                </button>
                {openFaq === i && <div className="fa">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><img src="/logo.svg" alt="" width="26" height="29" style={{ display: 'block' }} />Asovix<em>.</em></div>
          <div className="ftag">The company that helps graduates get interviews.</div>
          <div className="flinks">
            <Link href="/start">Get interview-ready</Link>
            <a href="https://www.linkedin.com/company/asovix/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://calendly.com/infoasovix/30min" target="_blank" rel="noopener noreferrer">For recruiters</a>
            <a href="mailto:info@asovix.com">info@asovix.com</a>
            <a href="tel:+353834284320">+353 83 428 4320</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <div className="fcopy">© {new Date().getFullYear()} Asovix · Cork, Ireland</div>
        </div>
      </footer>
    </>
  );
}
