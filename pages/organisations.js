import Head from 'next/head';
import Link from 'next/link';
import { trackCta } from '../lib/analytics';

const CAL = 'https://calendly.com/infoasovix/30min';

/* ── Inline icons — same line language as the homepage ── */
const Ic = {
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 7"/></svg>,
  agency: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.2"/><path d="M17.5 14.2A4 4 0 0 1 22 18v2"/><path d="M16 4.3a3.2 3.2 0 0 1 0 6.2"/></svg>,
  uni: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9l10-4.8L22 9l-10 4.8L2 9z"/><path d="M6.5 11.2V16c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-4.8"/></svg>,
  boot: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l-6-6 6-6"/><path d="M15 6l6 6-6 6"/></svg>,
  platform: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4" width="19" height="14" rx="2.2"/><path d="M8 21h8M12 18v3M7 9.5h4M7 13h7"/></svg>,
};

const TARGETS = [
  { ic: 'agency', t: 'Recruitment agencies', d: 'Turn more of the candidates you already have into interview-ready candidates.' },
  { ic: 'uni', t: 'Universities & employability teams', d: 'Personalised career support for more students, without a proportional increase in staff workload.' },
  { ic: 'boot', t: 'Training providers & bootcamps', d: 'You teach the skill. We help turn that skill into employment.' },
  { ic: 'platform', t: 'Career & opportunity platforms', d: 'You provide the opportunity. We help prepare the candidate.' },
];

const FLOW = [
  { n: '1', t: 'You provide the cohort', d: 'A group of candidates — typically 10 to 20 to begin with.' },
  { n: '2', t: 'We collect the evidence', d: 'Structured questioning that surfaces what each person has actually done.' },
  { n: '3', t: 'Candidate diagnosis', d: 'What they want, what they can prove, and where the gap between those sits.' },
  { n: '4', t: 'Employer-demand validation', d: 'What employers in their target market are actually hiring for right now.' },
  { n: '5', t: 'Positioning & asset optimisation', d: 'CV, LinkedIn and supporting material rebuilt around that evidence.' },
  { n: '6', t: 'Application & interview preparation', d: 'How to target applications, and how to hold the evidence up in the room.' },
  { n: '7', t: 'Outcome tracking', d: 'What happened next, reported back to you.' },
];

const DELIVERABLES = [
  'Candidate diagnosis for every person in the cohort',
  'Employer-demand analysis for their target market',
  'Positioning and career asset optimisation',
  'Application and interview preparation',
  'Per-candidate recommendations',
  'Outcome reporting',
];

export default function Organisations() {
  return (
    <>
      <Head>
        <title>Asovix for organisations — candidate positioning at scale</title>
        <meta name="description" content="Asovix helps recruitment agencies, universities, training providers and career platforms turn candidates into interview-ready candidates — at scale. Run a candidate pilot." />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
        a { color: inherit; }
        ul { list-style: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

        .nav { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(14px); background: rgba(6,11,22,0.75); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .navin { max-width: 1080px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 24px; color: #fff; text-decoration: none; }
        .logo em { color: #4D8DFF; font-style: normal; }
        .navlinks { display: flex; gap: 24px; align-items: center; }
        .navlinks a { font-size: 13.5px; color: #9FB0C8; text-decoration: none; transition: color 0.2s ease-out; }
        .navlinks a:hover { color: #fff; }
        .navcta { background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff !important; padding: 9px 18px; border-radius: 10px; font-weight: 600; box-shadow: 0 4px 20px rgba(59,125,240,0.35); }
        @media (max-width: 700px) { .navlinks a:not(.navcta) { display: none; } }

        .hero { position: relative; padding: 84px 0 52px; text-align: center; overflow: hidden; background-image: url(/hexpattern.svg); }
        .hero::before { content: ''; position: absolute; inset: -40% -20% auto; height: 130%; background: radial-gradient(ellipse 60% 55% at 50% 0%, rgba(46,109,228,0.28), transparent 70%); pointer-events: none; }
        .hero > * { position: relative; }
        .badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #7FA8F5; border: 1px solid rgba(77,141,255,0.35); background: rgba(46,109,228,0.12); padding: 7px 16px; border-radius: 100px; margin-bottom: 26px; animation: fadeUp 0.6s ease-out both; }
        h1 { font-family: 'DM Serif Display', serif; font-size: clamp(34px, 5.4vw, 56px); line-height: 1.1; color: #fff; max-width: 820px; margin: 0 auto 22px; animation: fadeUp 0.6s 0.08s ease-out both; }
        h1 .blue { background: linear-gradient(100deg, #4D8DFF, #7FB2FF); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .sub { font-size: 17px; color: #9FB0C8; line-height: 1.7; max-width: 680px; margin: 0 auto 34px; animation: fadeUp 0.6s 0.16s ease-out both; }
        .ctarow { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; animation: fadeUp 0.6s 0.24s ease-out both; }
        .cta { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 15px 30px; border-radius: 12px; box-shadow: 0 8px 30px rgba(59,125,240,0.4); transition: transform 0.2s ease-out; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .cta:hover { transform: translateY(-2px); }
        .ghost { display: inline-flex; align-items: center; gap: 8px; color: #C7D4E8; text-decoration: none; font-size: 15px; font-weight: 500; padding: 15px 26px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); transition: all 0.2s ease-out; }
        .ghost:hover { border-color: rgba(255,255,255,0.3); transform: translateY(-2px); }
        .trust { margin-top: 28px; font-size: 12.5px; color: #64748F; letter-spacing: 0.04em; }

        section { padding: 64px 0; }
        .kicker { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #4D8DFF; font-weight: 600; margin-bottom: 14px; text-align: center; }
        h2 { font-family: 'DM Serif Display', serif; font-size: clamp(26px, 3.8vw, 38px); color: #fff; text-align: center; margin-bottom: 14px; }
        .lead { font-size: 15.5px; color: #9FB0C8; text-align: center; max-width: 660px; margin: 0 auto 42px; line-height: 1.7; }

        .formula { display: flex; align-items: stretch; justify-content: center; gap: 12px; flex-wrap: wrap; max-width: 980px; margin: 0 auto; }
        .fbox { flex: 1 1 200px; background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.09); border-radius: 18px; padding: 26px 20px; text-align: center; font-size: 14.5px; color: #C7D4E8; line-height: 1.5; display: flex; align-items: center; justify-content: center; }
        .fbox.res { background: linear-gradient(180deg, rgba(46,109,228,0.18), rgba(46,109,228,0.04)); border-color: rgba(77,141,255,0.5); font-family: 'DM Serif Display', serif; font-size: 26px; color: #fff; }
        .fop { display: flex; align-items: center; font-size: 20px; color: #4D8DFF; font-weight: 700; padding: 0 2px; }
        @media (max-width: 820px) { .formula { flex-direction: column; } .fop { justify-content: center; padding: 4px 0; } }

        .tgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; max-width: 880px; margin: 0 auto; }
        .tcard { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px 26px; }
        .ticon { width: 46px; height: 46px; border-radius: 13px; background: rgba(46,109,228,0.14); border: 1px solid rgba(77,141,255,0.32); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
        .tname { font-size: 15.5px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .tdesc { font-size: 13.5px; color: #9FB0C8; line-height: 1.65; }
        @media (max-width: 780px) { .tgrid { grid-template-columns: 1fr; max-width: 460px; } }

        .timeline { max-width: 660px; margin: 0 auto; }
        .titem { display: flex; gap: 18px; padding: 0 0 26px 0; position: relative; }
        .titem::before { content: ''; position: absolute; left: 16px; top: 38px; bottom: 0; width: 2px; background: rgba(77,141,255,0.25); }
        .titem:last-child::before { display: none; }
        .titem:last-child { padding-bottom: 0; }
        .tnum { width: 34px; height: 34px; border-radius: 50%; background: rgba(46,109,228,0.18); border: 1px solid rgba(77,141,255,0.4); color: #7FA8F5; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 1; }
        .tbody .tt { font-size: 15.5px; font-weight: 600; color: #fff; margin-bottom: 6px; padding-top: 5px; }
        .tbody .td { font-size: 13.5px; color: #9FB0C8; line-height: 1.65; }

        .statsbar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 760px; margin: 0 auto; }
        .sbox { background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(77,141,255,0.25); border-radius: 16px; padding: 26px 16px; text-align: center; }
        .sbox b { display: block; font-family: 'DM Serif Display', serif; font-size: 38px; color: #4D8DFF; }
        .sbox span { font-size: 12.5px; color: #9FB0C8; letter-spacing: 0.04em; }
        @media (max-width: 620px) { .statsbar { grid-template-columns: 1fr; } }

        .pilot { max-width: 760px; margin: 0 auto; background: linear-gradient(180deg, rgba(46,109,228,0.14), rgba(46,109,228,0.03)); border: 1px solid rgba(77,141,255,0.55); border-radius: 24px; padding: 42px 38px; box-shadow: 0 10px 44px rgba(46,109,228,0.22); }
        .pilot h3 { font-family: 'DM Serif Display', serif; font-size: 26px; color: #fff; margin-bottom: 6px; text-align: center; }
        .pilot .scope { font-size: 13px; color: #7FA8F5; text-align: center; margin-bottom: 26px; letter-spacing: 0.04em; }
        .dlist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 20px; margin-bottom: 28px; }
        .dlist li { font-size: 13.5px; color: #C7D4E8; padding: 7px 0; line-height: 1.55; display: flex; gap: 9px; align-items: flex-start; }
        .dlist li svg { flex-shrink: 0; margin-top: 3px; }
        @media (max-width: 640px) { .dlist { grid-template-columns: 1fr; } .pilot { padding: 32px 24px; } }
        .pnote { font-size: 12.5px; color: #64748F; text-align: center; margin-top: 20px; line-height: 1.6; }

        footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 44px 0; text-align: center; }
        .ftag { font-size: 13px; color: #64748F; margin: 10px 0 18px; }
        .flinks { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        .flinks a { font-size: 13px; color: #9FB0C8; text-decoration: none; }
        .flinks a:hover { color: #fff; }
        .fcopy { margin-top: 22px; font-size: 11.5px; color: #3D4A63; }
      `}</style>

      <nav className="nav">
        <div className="navin">
          <Link href="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="Asovix logo" width="30" height="33" style={{ display: 'block' }} />Asovix<em>.</em>
          </Link>
          <div className="navlinks">
            <Link href="/">For individuals</Link>
            <a href="#how">How it works</a>
            <a href="#pilot" className="navcta" onClick={() => trackCta('run_a_pilot', 'nav', 'b2b')}>Run a candidate pilot</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="wrap">
          <div className="badge">Asovix for organisations</div>
          <h1>Your candidates are good enough. <span className="blue">Employers can&apos;t tell yet.</span></h1>
          <p className="sub">
            Asovix helps organisations position candidates for the jobs they are actually trying to get — at scale.
            You give us a cohort. We work out what each person wants, what they can prove and what employers are
            hiring for, then rebuild their positioning and report on what happens next.
          </p>
          <div className="ctarow">
            <a href="#pilot" className="cta" onClick={() => trackCta('run_a_pilot_hero', 'hero', 'b2b')}>Run a candidate pilot →</a>
            <a href={CAL} className="ghost" target="_blank" rel="noopener noreferrer" onClick={() => trackCta('talk_to_samuel_hero', 'hero', 'b2b')}>Talk to Samuel</a>
          </div>
          <div className="trust">Built on 26 customer discovery interviews · Cork, Ireland</div>
        </div>
      </header>

      {/* ── THE FORMULA ── */}
      <section style={{ paddingTop: 26 }}>
        <div className="wrap">
          <div className="kicker">The method</div>
          <h2>Positioning is not a rewrite. It&apos;s an equation.</h2>
          <p className="lead">Every candidate we work with is resolved against the same three inputs.</p>
          <div className="formula">
            <div className="fbox">What the candidate wants</div>
            <div className="fop">×</div>
            <div className="fbox">What the candidate can prove</div>
            <div className="fop">×</div>
            <div className="fbox">What employers are buying</div>
            <div className="fop">=</div>
            <div className="fbox res">Positioning</div>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">Who this is for</div>
          <h2>Four kinds of organisation. One shared problem.</h2>
          <p className="lead">You are already doing the hard part. The candidate still has to be legible to an employer.</p>
          <div className="tgrid">
            {TARGETS.map((t) => (
              <div className="tcard" key={t.t}>
                <div className="ticon">{Ic[t.ic]}</div>
                <div className="tname">{t.t}</div>
                <div className="tdesc">{t.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DELIVERY ── */}
      <section id="how" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">How it works</div>
          <h2>You give us candidates. We give you readiness — and the numbers.</h2>
          <p className="lead">Seven steps, run per candidate, reported per cohort.</p>
          <div className="timeline">
            {FLOW.map((f) => (
              <div className="titem" key={f.n}>
                <div className="tnum">{f.n}</div>
                <div className="tbody">
                  <div className="tt">{f.t}</div>
                  <div className="td">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVIDENCE ── */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">The evidence</div>
          <h2>The method came from the people who do the hiring.</h2>
          <p className="lead">
            Before building anything, we interviewed the people who shortlist, interview and hire — at organisations
            including Morgan McKinley, CPL Healthcare, Ryanair Labs and Osborne Recruitment.
          </p>
          <div className="statsbar">
            <div className="sbox"><b>26</b><span>customer discovery interviews</span></div>
            <div className="sbox"><b>11</b><span>hiring leaders interviewed</span></div>
            <div className="sbox"><b>30+</b><span>candidates worked with one-to-one</span></div>
          </div>
          <figure style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(77,141,255,0.3)', maxWidth: 1000, margin: '40px auto 0' }}>
            <img
              src="/founder-research.jpg"
              alt="Samuel Adu, founder of Asovix, with the Asovix site open on his laptop and printed client result cards in front of him"
              width="1600"
              height="1067"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </figure>
          <p className="lead" style={{ marginTop: 26, marginBottom: 0 }}>
            <Link href="/#results" style={{ color: '#7FA8F5', textDecoration: 'none' }}>See individual candidate outcomes →</Link>
          </p>
        </div>
      </section>

      {/* ── PILOT ── */}
      <section id="pilot" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">Start here</div>
          <h2>Run a candidate pilot.</h2>
          <p className="lead">The simplest way to find out whether this works for your candidates is to run it on a small group.</p>
          <div className="pilot">
            <h3>Asovix Candidate Optimisation Pilot</h3>
            <div className="scope">Typically 10–20 candidates</div>
            <ul className="dlist">
              {DELIVERABLES.map((d) => <li key={d}>{Ic.check}{d}</li>)}
            </ul>
            <div className="ctarow">
              <a href={CAL} className="cta" target="_blank" rel="noopener noreferrer" onClick={() => trackCta('run_a_pilot_cta', 'pilot', 'b2b')}>Run a candidate pilot →</a>
              <a href="mailto:info@asovix.com?subject=Asovix%20candidate%20pilot" className="ghost" onClick={() => trackCta('email_about_pilot', 'pilot', 'b2b')}>Email instead</a>
            </div>
            <p className="pnote">
              Scope and pricing are agreed after a short conversation — they depend on cohort size, the roles you are
              targeting and how much outcome reporting you need.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <Link href="/" className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="" width="26" height="29" style={{ display: 'block' }} />Asovix<em>.</em>
          </Link>
          <div className="ftag">Career positioning for people, and for the organisations behind them.</div>
          <div className="flinks">
            <Link href="/">For individuals</Link>
            <a href={CAL} target="_blank" rel="noopener noreferrer">Book a call</a>
            <a href="https://www.linkedin.com/company/asovix/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
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
