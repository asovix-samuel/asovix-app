import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const PAINS = [
  { emoji: '📭', title: '"I apply everywhere and hear nothing back."', body: "It's not your experience — 70%+ of CVs are rejected by ATS software before a human ever reads them." },
  { emoji: '🔁', title: '"I send the same CV to every job."', body: 'Recruiters spend 6 seconds per CV. A generic CV positions you for nothing — and it shows.' },
  { emoji: '🌍', title: '"My experience doesn\'t translate here."', body: 'International students and career-changers lose interviews to positioning, not ability. We bridge the gap.' },
];

const TESTIMONIALS = [
  {
    quote: "Samuel was really great at providing assistance on my CV. After discussing what roles I was interested in, he was able to tailor my CV to it. Based on that I was able to get up to 3 job interviews with his help.",
    name: 'Helsa Okoro',
    role: 'International Purchasing Analyst at Verizon',
    outcome: '3 interviews',
  },
  {
    quote: "Everything changed after Samuel reached out. The CV and cover letter he created were the best I've ever had, and I'm now excited to apply for roles with confidence.",
    name: 'Conor Byrne',
    role: 'Legal Secretary & Client Support',
    outcome: 'Best CV ever',
  },
  {
    quote: "Asovix completely transformed my CV and LinkedIn profile. I started getting noticed by recruiters and secured job offers I never thought possible.",
    name: 'Adejomi Karunwi',
    role: 'Registered Psychiatric Nurse (RPN), BSc',
    outcome: 'Job offers secured',
  },
  {
    quote: "Asovix helped me reposition my CV and LinkedIn for the cybersecurity field. I now have a clear direction, stronger profile positioning and more confidence.",
    name: 'Thomas Ariyibi',
    role: 'BSc (Hons) Cybersecurity',
    outcome: 'Clear direction',
  },
  {
    quote: "Four months ago I had no clue how LinkedIn worked. Now I've connected with 600+ people, improved my profile massively, increased my visibility, and secured employment opportunities.",
    name: 'Ayomitide Alade',
    role: 'Graduate, International Business with French',
    outcome: '600+ connections',
  },
];

const NEXT_STEPS = [
  { n: '1', t: 'Within minutes of paying', d: 'Three tailored, ATS-ready CVs land in your inbox as Word documents — each positioned for a different angle of your target market.' },
  { n: '2', t: 'Your email tells you which CV to use where', d: 'CV 1 for your primary target role, CV 2 for the strongest adjacent role, CV 3 for broader opportunities. No guesswork.' },
  { n: '3', t: 'Save as PDF and start applying', d: 'Match your LinkedIn headline to whichever CV you send, and tailor each application subject line to the exact job title.' },
  { n: '4', t: 'Need a tweak? Just reply', d: 'Adjustments are free — reply to your delivery email. When you\'re ready, upgrade your LinkedIn so recruiters start coming to you.' },
];

const FAQS = [
  {
    q: 'How fast do I get my CVs?',
    a: 'The Instant AI CV package is generated and emailed to you within minutes of payment. LinkedIn Optimisation and the Full Career Bundle are crafted with AI + human review and delivered within 24 hours.',
  },
  {
    q: 'Are the CVs really tailored to me?',
    a: 'Yes. We work from your actual CV and brief. Nothing is invented — your genuine experience is repositioned the way hiring managers in your target sector actually read CVs. You get three angles: your primary target role, a strong adjacent role, and a broader transferable-skills version.',
  },
  {
    q: 'Will they pass ATS systems?',
    a: 'Every CV is built ATS-first: clean structure, standard section headings, no tables or graphics that break parsers, and keyword alignment with your target roles and job description.',
  },
  {
    q: 'Is this a subscription?',
    a: 'No — one payment, no renewals, ever. Most CV tools charge €20–50 per month and make you do the work yourself. Asovix is done for you, once.',
  },
  {
    q: "What if I want changes?",
    a: 'Reply to your delivery email and we will make adjustments free of charge. We want you interviewing, not filing complaints.',
  },
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState('idle');
  const [openFaq, setOpenFaq] = useState(-1);

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
    } catch {
      setSubState('error');
    }
  }

  return (
    <>
      <Head>
        <title>Asovix — Qualified but not getting callbacks? We fix your positioning.</title>
        <meta name="description" content="70% of CVs are rejected by software before a human reads them. Asovix repositions your real experience — 3 tailored, ATS-ready CVs in your inbox in minutes. One payment, no subscription." />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

        .nav { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(14px); background: rgba(6,11,22,0.75); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .navin { max-width: 1080px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 24px; color: #fff; letter-spacing: 0.02em; }
        .logo em { color: #4D8DFF; font-style: italic; }
        .navlinks { display: flex; gap: 26px; align-items: center; }
        .navlinks a { font-size: 13.5px; color: #9FB0C8; text-decoration: none; transition: color 0.2s ease-out; }
        .navlinks a:hover { color: #fff; }
        .navcta { background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff !important; padding: 9px 18px; border-radius: 10px; font-weight: 600; box-shadow: 0 4px 20px rgba(59,125,240,0.35); transition: transform 0.2s ease-out, box-shadow 0.2s ease-out !important; }
        .navcta:hover { transform: translateY(-1px); box-shadow: 0 6px 26px rgba(59,125,240,0.5); }
        @media (max-width: 720px) { .navlinks a:not(.navcta) { display: none; } }

        .hero { position: relative; padding: 88px 0 64px; text-align: center; overflow: hidden; background-image: url(/hexpattern.svg); }
        .hero::before { content: ''; position: absolute; inset: -40% -20% auto; height: 130%; background: radial-gradient(ellipse 60% 55% at 50% 0%, rgba(46,109,228,0.28), transparent 70%); pointer-events: none; }
        .badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #7FA8F5; border: 1px solid rgba(77,141,255,0.35); background: rgba(46,109,228,0.12); padding: 7px 16px; border-radius: 100px; margin-bottom: 28px; animation: fadeUp 0.6s ease-out both; }
        h1 { font-family: 'DM Serif Display', serif; font-size: clamp(36px, 5.6vw, 60px); line-height: 1.1; letter-spacing: -0.01em; color: #fff; max-width: 800px; margin: 0 auto 22px; animation: fadeUp 0.6s 0.08s ease-out both; }
        h1 .blue { background: linear-gradient(100deg, #4D8DFF, #7FB2FF); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .sub { font-size: 17px; color: #9FB0C8; line-height: 1.7; max-width: 620px; margin: 0 auto 36px; animation: fadeUp 0.6s 0.16s ease-out both; }
        .sub strong { color: #E6ECF5; }
        .ctarow { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; animation: fadeUp 0.6s 0.24s ease-out both; }
        .cta { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 15px 30px; border-radius: 12px; box-shadow: 0 8px 30px rgba(59,125,240,0.4); transition: transform 0.2s ease-out, box-shadow 0.2s ease-out; }
        .cta:hover { transform: translateY(-2px); box-shadow: 0 12px 38px rgba(59,125,240,0.55); }
        .cta:active { transform: scale(0.98); }
        .ghost { display: inline-flex; align-items: center; gap: 8px; color: #C7D4E8; text-decoration: none; font-size: 15px; font-weight: 500; padding: 15px 26px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); transition: all 0.2s ease-out; }
        .ghost:hover { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); transform: translateY(-2px); }
        .trust { margin-top: 30px; font-size: 12.5px; color: #64748F; letter-spacing: 0.04em; animation: fadeUp 0.6s 0.32s ease-out both; }

        section { padding: 76px 0; }
        .kicker { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #4D8DFF; font-weight: 600; margin-bottom: 14px; text-align: center; }
        h2 { font-family: 'DM Serif Display', serif; font-size: clamp(28px, 4vw, 40px); color: #fff; text-align: center; margin-bottom: 14px; letter-spacing: -0.01em; }
        .lead { font-size: 15.5px; color: #9FB0C8; text-align: center; max-width: 580px; margin: 0 auto 44px; line-height: 1.7; }

        .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .card3 { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 28px 24px; transition: transform 0.2s ease-out, border-color 0.2s ease-out; }
        .card3:hover { transform: translateY(-4px); border-color: rgba(77,141,255,0.35); }
        .card3 .emoji { font-size: 26px; margin-bottom: 14px; }
        .card3 .t { font-size: 15.5px; font-weight: 600; color: #fff; margin-bottom: 8px; line-height: 1.45; }
        .card3 .d { font-size: 13.5px; color: #9FB0C8; line-height: 1.65; }
        @media (max-width: 720px) { .grid3 { grid-template-columns: 1fr; } }

        .steps3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .step { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 30px 26px; transition: transform 0.2s ease-out, border-color 0.2s ease-out; }
        .step:hover { transform: translateY(-4px); border-color: rgba(77,141,255,0.35); }
        .stepn { width: 34px; height: 34px; border-radius: 10px; background: rgba(46,109,228,0.18); border: 1px solid rgba(77,141,255,0.4); color: #7FA8F5; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
        .stept { font-size: 16.5px; font-weight: 600; color: #fff; margin-bottom: 8px; }
        .stepd { font-size: 13.5px; color: #9FB0C8; line-height: 1.65; }
        @media (max-width: 720px) { .steps3 { grid-template-columns: 1fr; } }

        .tgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .tcard { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; transition: transform 0.2s ease-out, border-color 0.2s ease-out; }
        .tcard:hover { transform: translateY(-3px); border-color: rgba(77,141,255,0.35); }
        .toutcome { align-self: flex-start; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #7FE0A8; background: rgba(52,199,123,0.12); border: 1px solid rgba(52,199,123,0.3); padding: 5px 12px; border-radius: 100px; margin-bottom: 16px; }
        .tquote { font-size: 14.5px; color: #C7D4E8; line-height: 1.75; flex: 1; }
        .tquote::before { content: '“'; color: #4D8DFF; font-family: 'DM Serif Display', serif; font-size: 22px; margin-right: 2px; }
        .tname { margin-top: 18px; font-size: 14px; font-weight: 600; color: #fff; }
        .trole { font-size: 12.5px; color: #64748F; margin-top: 2px; }
        @media (max-width: 720px) { .tgrid { grid-template-columns: 1fr; } }

        .rgallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .rgallery .rcard { display: block; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s ease-out, border-color 0.2s ease-out, box-shadow 0.2s ease-out; }
        .rgallery .rcard:hover { transform: translateY(-4px) scale(1.01); border-color: rgba(77,141,255,0.5); box-shadow: 0 14px 44px rgba(46,109,228,0.25); }
        .rgallery .rcard img { display: block; width: 100%; height: auto; }
        .rgallery .rcard:last-child { grid-column: 2 / 3; }
        @media (max-width: 980px) { .rgallery { grid-template-columns: repeat(2, 1fr); } .rgallery .rcard:last-child { grid-column: auto; } }
        @media (max-width: 640px) { .rgallery { grid-template-columns: 1fr; } }

        .pgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: stretch; }
        .pcard { position: relative; background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px 28px; display: flex; flex-direction: column; transition: transform 0.2s ease-out, border-color 0.2s ease-out, box-shadow 0.2s ease-out; }
        .pcard:hover { transform: translateY(-4px); }
        .pcard.hot { border-color: rgba(77,141,255,0.55); background: linear-gradient(180deg, rgba(46,109,228,0.14), rgba(46,109,228,0.03)); box-shadow: 0 10px 44px rgba(46,109,228,0.22); }
        .hotbadge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; padding: 5px 14px; border-radius: 100px; box-shadow: 0 4px 14px rgba(59,125,240,0.45); white-space: nowrap; }
        .pname { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 6px; }
        .pdel { font-size: 12px; color: #7FA8F5; margin-bottom: 18px; font-weight: 500; }
        .pprice { font-family: 'DM Serif Display', serif; font-size: 42px; color: #fff; margin-bottom: 4px; }
        .pprice span { font-size: 15px; color: #64748F; font-family: 'DM Sans', sans-serif; }
        .panchor { font-size: 12px; color: #7FE0A8; margin-bottom: 18px; line-height: 1.5; }
        .pfeat { list-style: none; margin-bottom: 26px; flex: 1; }
        .pfeat li { font-size: 13.5px; color: #C7D4E8; padding: 7px 0; line-height: 1.55; display: flex; gap: 9px; align-items: flex-start; }
        .pfeat li::before { content: '✓'; color: #4D8DFF; font-weight: 700; flex-shrink: 0; }
        .pbtn { display: block; text-align: center; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px; border-radius: 12px; transition: all 0.2s ease-out; }
        .pbtn.primary { background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; box-shadow: 0 6px 24px rgba(59,125,240,0.4); }
        .pbtn.primary:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(59,125,240,0.55); }
        .pbtn.outline { border: 1px solid rgba(255,255,255,0.16); color: #C7D4E8; background: rgba(255,255,255,0.03); }
        .pbtn.outline:hover { border-color: rgba(255,255,255,0.32); background: rgba(255,255,255,0.06); }
        .nosub { text-align: center; margin-top: 26px; font-size: 13.5px; color: #7FE0A8; font-weight: 500; }
        @media (max-width: 840px) { .pgrid { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; } }

        .timeline { max-width: 640px; margin: 0 auto; }
        .titem { display: flex; gap: 18px; padding: 0 0 28px 0; position: relative; }
        .titem::before { content: ''; position: absolute; left: 16px; top: 38px; bottom: 0; width: 2px; background: rgba(77,141,255,0.25); }
        .titem:last-child::before { display: none; }
        .tnum { width: 34px; height: 34px; border-radius: 50%; background: rgba(46,109,228,0.18); border: 1px solid rgba(77,141,255,0.4); color: #7FA8F5; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 1; }
        .tbody .tt { font-size: 15.5px; font-weight: 600; color: #fff; margin-bottom: 6px; padding-top: 5px; }
        .tbody .td { font-size: 13.5px; color: #9FB0C8; line-height: 1.65; }

        .magnet { background: linear-gradient(135deg, rgba(46,109,228,0.16), rgba(46,109,228,0.05)); border: 1px solid rgba(77,141,255,0.3); border-radius: 24px; padding: 52px 40px; text-align: center; }
        .magnet h2 { margin-bottom: 10px; }
        .mform { display: flex; gap: 10px; max-width: 440px; margin: 28px auto 0; }
        .mform input { flex: 1; font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(6,11,22,0.6); color: #fff; outline: none; transition: border-color 0.2s ease-out; }
        .mform input:focus { border-color: #4D8DFF; }
        .mform button { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; padding: 14px 24px; border-radius: 12px; border: none; cursor: pointer; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; box-shadow: 0 6px 22px rgba(59,125,240,0.4); transition: transform 0.2s ease-out; }
        .mform button:hover { transform: translateY(-1px); }
        .mform button:disabled { opacity: 0.5; cursor: not-allowed; }
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
        .fitem { border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; margin-bottom: 12px; background: rgba(255,255,255,0.025); overflow: hidden; transition: border-color 0.2s ease-out; }
        .fitem.open { border-color: rgba(77,141,255,0.35); }
        .fq { width: 100%; text-align: left; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; color: #fff; background: none; border: none; padding: 20px 22px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .fq span.chev { color: #4D8DFF; font-size: 13px; transition: transform 0.25s ease-out; }
        .fitem.open .fq span.chev { transform: rotate(180deg); }
        .fa { font-size: 14px; color: #9FB0C8; line-height: 1.75; padding: 0 22px 20px; }

        footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 44px 0; text-align: center; }
        .ftag { font-size: 13px; color: #64748F; margin: 10px 0 18px; }
        .flinks { display: flex; gap: 22px; justify-content: center; }
        .flinks a { font-size: 13px; color: #9FB0C8; text-decoration: none; transition: color 0.2s ease-out; }
        .flinks a:hover { color: #fff; }
        .fcopy { margin-top: 22px; font-size: 11.5px; color: #3D4A63; }
      `}</style>

      <nav className="nav">
        <div className="navin">
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="/logo.svg" alt="Asovix logo" width="30" height="33" style={{ display: 'block' }} />Asovix<em>.</em></div>
          <div className="navlinks">
            <a href="#results">Results</a>
            <a href="#pricing">Pricing</a>
            <a href="#next">What happens next</a>
            <a href="#recruiters">For recruiters</a>
            <Link href="/start" className="navcta">Get my CVs</Link>
          </div>
        </div>
      </nav>

      {/* ── Q1: WHAT IS THIS — pain first, then value ── */}
      <header className="hero">
        <div className="wrap">
          <div className="badge">✦ AI Career Positioning</div>
          <h1>You're qualified. So why is <span className="blue">nobody calling back?</span></h1>
          <p className="sub">
            Because <strong>70%+ of CVs are rejected by software</strong> before a human ever reads them —
            and the ones that get through have 6 seconds to land. Asovix repositions your <strong>real</strong> experience
            the way hiring managers actually read: <strong>3 tailored, ATS-ready CVs in your inbox within minutes.</strong>
          </p>
          <div className="ctarow">
            <Link href="/start" className="cta">Fix my CV now — €35.99 →</Link>
            <a href="#checklist" className="ghost">Free CV checklist first</a>
          </div>
          <div className="trust">One payment · No subscription · Trusted by 200+ job seekers · Cork, Ireland 🇮🇪</div>
        </div>
      </header>

      {/* Pain resonance */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="grid3">
            {PAINS.map((p) => (
              <div className="card3" key={p.title}>
                <div className="emoji">{p.emoji}</div>
                <div className="t">{p.title}</div>
                <div className="d">{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Q2: WILL MY PROBLEM BE SOLVED — proof ── */}
      <section id="results">
        <div className="wrap">
          <div className="kicker">Real outcomes</div>
          <h2>People with your exact problem, solved.</h2>
          <p className="lead">Nurses, cybersecurity grads, business students, international graduates — same pain, real names, real results.</p>
          <div className="rgallery">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <a key={n} href={`/results/card-${n}.jpg`} target="_blank" rel="noopener noreferrer" className="rcard">
                <img src={`/results/card-${n}.jpg`} alt={`Asovix client result ${n} — real outcome`} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — the mechanism */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">How it works</div>
          <h2>Three steps. A few minutes.</h2>
          <p className="lead">No calls, no back-and-forth, no waiting a week for a freelancer.</p>
          <div className="steps3">
            <div className="step">
              <div className="stepn">1</div>
              <div className="stept">Upload your CV</div>
              <div className="stepd">PDF, Word or plain text. Paste the job description you're targeting for an even sharper result.</div>
            </div>
            <div className="step">
              <div className="stepn">2</div>
              <div className="stept">Tell us your target</div>
              <div className="stepd">Your target role, location (UK / Ireland), and your biggest career challenge. Takes 2 minutes.</div>
            </div>
            <div className="step">
              <div className="stepn">3</div>
              <div className="stept">Get 3 CVs in minutes</div>
              <div className="stepd">Your real experience, repositioned three ways: primary target, adjacent opportunity, and broader angle — delivered to your inbox.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Q3: HOW MUCH — value > price ── */}
      <section id="pricing">
        <div className="wrap">
          <div className="kicker">Pricing</div>
          <h2>Pay once. Own it forever.</h2>
          <p className="lead">Most CV tools charge €20–50 every month and leave the work to you. Human CV writers charge €180–600 and take a week. Asovix is done for you, in minutes, for one payment.</p>
          <div className="pgrid">
            <div className="pcard hot">
              <div className="hotbadge">⚡ Instant — Most popular</div>
              <div className="pname">Instant AI CVs</div>
              <div className="pdel">Delivered in minutes</div>
              <div className="pprice">€35.99 <span>one-time</span></div>
              <div className="panchor">Less than one month of a CV subscription — no renewals, ever.</div>
              <ul className="pfeat">
                <li>3 tailored, ATS-ready CVs</li>
                <li>Primary target + adjacent role + broader angle</li>
                <li>Built from your real CV — nothing invented</li>
                <li>Word documents, straight to your inbox</li>
                <li>Free adjustments by reply</li>
              </ul>
              <Link href="/start" className="pbtn primary">Start now →</Link>
            </div>
            <div className="pcard">
              <div className="pname">LinkedIn Optimisation</div>
              <div className="pdel">AI + human review · 24 hours</div>
              <div className="pprice">€49.99 <span>one-time</span></div>
              <div className="panchor">Two months of LinkedIn Premium — but your profile actually converts.</div>
              <ul className="pfeat">
                <li>Complete profile overhaul</li>
                <li>Headline & About section rewritten to convert</li>
                <li>Keyword positioning for recruiter search</li>
                <li>More profile views, more recruiter InMails</li>
              </ul>
              <a href="https://www.paypal.com/ncp/payment/U68CRAET6LY4A" className="pbtn outline" target="_blank" rel="noopener noreferrer">Order LinkedIn →</a>
            </div>
            <div className="pcard">
              <div className="pname">Full Career Bundle</div>
              <div className="pdel">AI + human review · 24 hours</div>
              <div className="pprice">€99.99 <span>one-time</span></div>
              <div className="panchor">Half the price of a traditional CV writer — CV, LinkedIn and cover letter included.</div>
              <ul className="pfeat">
                <li>ATS-optimised CV (human-reviewed)</li>
                <li>Full LinkedIn overhaul</li>
                <li>Custom cover letter</li>
                <li>The complete positioning package</li>
              </ul>
              <a href="https://www.paypal.com/ncp/payment/E92BY5TRZ6ZTQ" className="pbtn outline" target="_blank" rel="noopener noreferrer">Order bundle →</a>
            </div>
          </div>
          <div className="nosub">✓ One payment — never a subscription. What you buy is yours.</div>
        </div>
      </section>

      {/* ── Q4: WHAT DO I DO NEXT ── */}
      <section id="next">
        <div className="wrap">
          <div className="kicker">After you buy</div>
          <h2>Here's exactly what happens next.</h2>
          <p className="lead">No mystery, no waiting around wondering. This is the path from payment to interviews.</p>
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

      {/* Lead magnet */}
      <section id="checklist" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="magnet">
            <div className="kicker">Free download</div>
            <h2>Not ready yet? Start with the free CV checklist.</h2>
            <p className="lead" style={{ marginBottom: 0 }}>
              The 15-point Asovix CV Checklist — the exact standards we apply to every client CV.
              Fix the mistakes that get you auto-rejected, free.
            </p>
            {subState === 'done' ? (
              <div className="mdone">✓ Sent! Check your inbox (and spam folder) for your checklist.</div>
            ) : (
              <form className="mform" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                />
                <button type="submit" disabled={subState === 'sending'}>
                  {subState === 'sending' ? 'Sending…' : 'Send it to me'}
                </button>
              </form>
            )}
            {subState === 'error' && <div className="merr">Something went wrong — please try again.</div>}
          </div>
        </div>
      </section>

      {/* B2B */}
      <section id="recruiters">
        <div className="wrap">
          <div className="b2b">
            <div>
              <div className="kicker" style={{ textAlign: 'left' }}>For recruiters & HR teams</div>
              <h2>Turn more CVs into placements.</h2>
              <p className="lead">
                Asovix helps recruitment teams improve candidate alignment, eligibility clarity,
                and presentation — so clients say yes faster.
              </p>
              <ul className="b2blist">
                <li>Better-prepared candidates before they reach you</li>
                <li>Less time wasted on ineligible candidates</li>
                <li>Faster shortlists, fewer rejections</li>
              </ul>
              <a href="https://calendly.com/infoasovix/30min" className="cta" target="_blank" rel="noopener noreferrer">Book a 15-minute call →</a>
            </div>
            <div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="stat"><div className="statn">6 sec</div><div className="statl">average time a hiring manager spends on a CV — we make them count</div></div>
                <div className="stat"><div className="statn">B2B</div><div className="statl">volume packages for agencies, HR teams and universities</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="wrap">
          <div className="kicker">FAQ</div>
          <h2>Questions, answered.</h2>
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
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="/logo.svg" alt="Asovix logo" width="30" height="33" style={{ display: 'block' }} />Asovix<em>.</em></div>
          <div className="ftag">AI Career Positioning · The best-positioned candidate gets noticed.</div>
          <div className="flinks">
            <Link href="/start">Get my CVs</Link>
            <a href="https://www.linkedin.com/company/asovix/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://calendly.com/infoasovix/30min" target="_blank" rel="noopener noreferrer">For recruiters</a>
            <a href="mailto:info@asovix.com">info@asovix.com</a>
          </div>
          <div className="fcopy">© {new Date().getFullYear()} Asovix · Cork, Ireland</div>
        </div>
      </footer>
    </>
  );
}
