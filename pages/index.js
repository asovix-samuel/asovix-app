import { useState, useEffect } from 'react';
import Link from 'next/link';
import { track, trackCta, trackBeginCheckout, trackDiagnosisClick, trackPricingViewed } from '../lib/analytics';
import { V } from '../lib/diagnosis';
import { OFFERS } from '../lib/offers';
import { Seo, organizationLd, websiteLd, serviceLd } from '../lib/seo';

/* ── Inline icons ── */
const Ic = {
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 7"/></svg>,
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h14M13 6l6 6-6 6"/></svg>,
  // Persona glyphs — same line language as the check above, drawn for Asovix.
  intl: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.4 2.6 3.7 5.7 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.7-3.7-9S9.6 5.6 12 3z"/></svg>,
  young: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17.5l5.5-5.5 3.5 3.5L21 6.5"/><path d="M15 6.5h6v6"/></svg>,
  swap: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5h12M12.5 5l3.5 3.5-3.5 3.5"/><path d="M20 15.5H8M11.5 12L8 15.5l3.5 3.5"/></svg>,
  grad: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4D8DFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9l10-4.8L22 9l-10 4.8L2 9z"/><path d="M6.5 11.2V16c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-4.8"/></svg>,
};

const ORGS = ['Morgan McKinley', 'Osborne Recruitment', 'Noel Recruitment', 'CPL Healthcare', 'Teamwork.com', 'Ryanair Labs', 'Cork Airport', 'Capaciteam', 'AA Euro Group', 'MTU'];

const NEXT_STEPS = [
  { n: '1', t: 'You choose the service and pay', d: 'Stripe takes your name, email and card. No long form to wade through before you have even decided.' },
  { n: '2', t: 'We ask the questions that find your evidence', d: 'This is where the actual work happens. Most people are sitting on evidence they have already dismissed as not worth mentioning.' },
  { n: '3', t: 'Your documents arrive, positioned for one target', d: 'Written in the language of the roles you are actually going for, and structured so the relevance is obvious in the first ten seconds.' },
  { n: '4', t: 'You apply — with a revision round in hand', d: 'One free minor revision within 7 days of delivery. Bundle orders include an extra round.' },
];

/* ── Who this is for ── */
const AUDIENCE = [
  {
    ic: 'intl',
    t: 'International students',
    pain: 'I keep applying. Nobody explains why I\u2019m not getting shortlisted.',
    fix: 'Make employers understand your value in this market.',
  },
  {
    ic: 'young',
    t: 'Young professionals',
    pain: 'I have experience. My applications still go nowhere.',
    fix: 'Turn scattered experience into one strong professional story.',
  },
  {
    ic: 'swap',
    t: 'Career switchers',
    pain: 'I know my experience is relevant. Employers don\u2019t see the connection.',
    fix: 'Translate what you\u2019ve done into the language of your next industry.',
  },
  {
    ic: 'grad',
    t: 'Graduates',
    pain: 'Every job wants experience. How am I supposed to get experience?',
    fix: 'Find the evidence you already have and turn it into a credible first case.',
  },
];

/* ── Client evidence: result first, story on demand ── */
const PROOF = [
  {
    id: 'donal',
    name: 'Donal Ojiekhudu',
    ctx: 'Graduate sales · SDR and BDR roles',
    beforeLab: 'His CV said',
    before: '\u201cPhone sales.\u201d',
    evLab: 'What was actually there',
    ev: ['~150 outbound calls a day', '20\u201350 sales a week', '80\u2013150 doors a day', '10\u201320 new customers a week'],
    num: '7',
    numLab: 'interviews',
    caveat: 'Figures as reported by him.',
    story: [
      'Elsewhere on that same CV: door-to-door for Vodafone. Purchase-to-Pay at Eli Lilly, with responsibility for the French market. SAP. Oracle. He had managed a choir.',
      'Almost none of it was on the page \u2014 not because he was hiding it, but because nobody had ever told him it counted. We added nothing that was not already true. That is the job most days: not writing, asking.',
    ],
  },
  {
    id: 'michelle',
    name: 'Michelle Amuodi',
    ctx: 'Biomedical engineering placement',
    beforeLab: 'Before',
    before: 'Same degree as everyone in her class.',
    evLab: 'What we uncovered',
    ev: ['~150 hospital hours', 'Biomedical engineering project', 'Student Inc experience'],
    num: '3',
    numLab: 'interviews \u2014 Stryker, Alcon and DePuy. She accepted DePuy.',
    caveat: 'Her own result, not an Asovix average.',
    story: [
      'She applied to about five placements. She also told us that Stryker looked at her LinkedIn before the interview \u2014 and again after it. That is not a theory about LinkedIn. That is what she observed.',
      'I am not going to tell you the positioning was the only reason. An employer made that call, not me. But it is the question I keep coming back to.',
    ],
  },
  {
    id: 'ryan',
    name: 'Ryan Crosbie',
    ctx: 'Mechanic apprenticeship',
    beforeLab: 'He called it',
    before: '\u201cMy tired old CV.\u201d',
    evLab: 'What we rebuilt it around',
    ev: ['His actual work experience', 'Interests and background', 'What the employer was hiring for'],
    num: 'Same day',
    numLab: 'the employer made contact. Offer within a week.',
    caveat: 'His words, from his own public recommendation.',
    story: [
      '\u201cAfter submitting the new CV, I was contacted by the employer within the same day and was offered the position within a week of applying.\u201d',
      'He got the apprenticeship, with Ford. I did not write that recommendation. He did. And he was not a graduate \u2014 the method is not degree-dependent.',
    ],
  },
  {
    id: 'chuks',
    name: 'Chuks',
    ctx: 'Graduated, months into applying',
    beforeLab: 'Before',
    before: 'He had nearly stopped applying.',
    evLab: 'What changed',
    ev: ['Context', 'Evidence', 'Keywords', 'Positioning'],
    num: 'Hired',
    numLab: 'secured a role in Manchester.',
    caveat: 'His words \u2014 including the criticism.',
    story: [
      'The experience and the qualifications were real. The CV was not communicating them. He said afterwards that the work significantly lifted his callbacks.',
      'He also told me the structure of another CV he had was better than mine. He was right \u2014 and it is the most useful thing a client has ever said to me. Formatting is commoditised. Context, evidence and positioning are what actually move the decision.',
    ],
  },
];

/* ── Offers ── */
const SERVICES = [
  {
    id: 'focused_cv',
    name: 'Focused CV',
    sub: 'Single-page CV — lighter scope',
    del: 'Entry-level, part-time and in-person roles',
    price: OFFERS.focused_cv.price,
    anchor: 'For retail, hospitality, warehouse and similar roles, where a manager decides in seconds.',
    feat: [
      'One page, built to be scanned rather than studied',
      'Your real experience, tightened and prioritised',
      'Clean structure, no clutter, nothing to decode',
      'Deliberately not the full method — and priced accordingly',
    ],
    cta: 'Choose Focused CV',
  },
  {
    id: 'cv_positioning',
    name: 'CV Positioning',
    sub: 'Full evidence extraction and positioning',
    del: 'Career-level and graduate roles',
    price: OFFERS.cv_positioning.price,
    hot: 'Our core method',
    anchor: 'The difference is where the work happens: we go looking for evidence before writing a single line.',
    feat: [
      'We interrogate your history for evidence you have written off',
      'Positioned for one specific target role, in that industry’s language',
      'Structured so your relevance lands in the first ten seconds',
      'Nothing invented — your CV has to survive the interview',
    ],
    cta: 'Choose CV Positioning',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Positioning',
    sub: 'Headline, About and experience rebuilt',
    del: 'The profile they check before and after they meet you',
    price: OFFERS.linkedin.price,
    anchor: 'Everyone has the degree. This is where an employer decides what makes you the pick.',
    feat: [
      'Headline and About written to answer “why you”',
      'Keyword positioning for how recruiters actually search',
      'Experience rewritten to match the story your CV tells',
    ],
    cta: 'Choose LinkedIn',
  },
];

const SERVICES_TWO = [
  {
    id: 'interview_prep',
    name: 'Interview Preparation',
    sub: 'Tailored mock interview + written feedback',
    del: 'Scheduled with you after purchase',
    price: OFFERS.interview_prep.price,
    anchor: 'The person getting the offer is rarely the one who prepared fifty answers.',
    feat: [
      'A mock interview built around your target role, not a generic question list',
      'Structured, evidence-based feedback you can act on',
      'We build the few pieces of evidence you keep coming back to',
    ],
    cta: 'Choose Interview Prep',
  },
  {
    id: 'cover_letter',
    name: 'Cover Letter',
    sub: 'Add-on only',
    del: 'Added to a CV Positioning or bundle order',
    price: OFFERS.cover_letter.price,
    addon: true,
    anchor: 'Written for one specific application — not a template with the company name swapped in.',
    feat: [
      'Built from the same evidence base as your CV',
      'Targeted at one role, one employer',
      'Not sold on its own',
    ],
  },
];

const BUNDLES = [
  {
    id: 'cv_linkedin',
    name: 'CV + LinkedIn',
    sub: 'CV Positioning + LinkedIn Positioning',
    del: 'The two things an employer checks',
    price: OFFERS.cv_linkedin.price,
    anchor: '€10 less than buying both separately.',
    feat: [
      'Everything in CV Positioning',
      'Everything in LinkedIn Positioning',
      'One consistent story in both places',
      'One extra free revision round',
    ],
    cta: 'Choose CV + LinkedIn',
  },
  {
    id: 'cv_linkedin_letter',
    name: 'CV + LinkedIn + Cover Letter',
    sub: 'The full application set',
    del: 'Everything you send, written as one argument',
    price: OFFERS.cv_linkedin_letter.price,
    anchor: 'Three documents that agree with each other, built from one evidence base.',
    feat: [
      'Everything in CV + LinkedIn',
      'A cover letter for one specific application',
      'One consistent argument end to end',
      'One extra free revision round',
    ],
    cta: 'Choose this set',
  },
  {
    id: 'full_package',
    name: 'Full Career Positioning',
    sub: 'Documents + interview preparation',
    del: 'From the application to the room',
    price: OFFERS.full_package.price,
    hot: 'Everything we do',
    anchor: 'Positioning gets you the interview. This covers what happens inside it.',
    feat: [
      'Everything in CV + LinkedIn + Cover Letter',
      'Tailored mock interview and structured feedback',
      'One consistent story on paper and in person',
      'One extra free revision round',
    ],
    cta: 'Choose the full package',
  },
];

const FAQS = [
  { q: 'What is the difference between the Focused CV and CV Positioning?', a: 'Scope, not care. The Focused CV (€45) is a single page for entry-level, part-time or in-person work — retail, hospitality, warehouse — where a manager scans it in seconds. CV Positioning (€65) is our core method: we go looking for evidence across your whole history, work out what your target industry needs to see, and build the document around that. For career-level or graduate roles, you want CV Positioning.' },
  { q: 'Why not just use ChatGPT?', a: 'You can — and recruiters told us they can spot the result instantly. Asovix is built on 26 customer discovery interviews: 11 with hiring leaders at organisations like Morgan McKinley, CPL Healthcare and Ryanair Labs, and 16 with graduates. Every document is positioned around what those hiring leaders said actually gets people shortlisted, with a named founder accountable for every delivery. The part that matters is not the writing. It is the asking.' },
  { q: 'How fast do I get everything?', a: 'Documents are personally prepared and delivered within 24 hours of us having what we need from you. Interview Preparation is a live session — we email you within 24 hours to schedule it around you.' },
  { q: 'What if I need changes after delivery?', a: 'You get one free minor revision within 7 days of delivery. Additional minor revisions, or any requested after 7 days, are €15. If your target role changes and the document needs new evidence, that is a major rework — a new CV Positioning job at €65, not a revision. Bundle orders (€110 and above) include one extra free revision round.' },
  { q: 'Is anything invented on my CV?', a: 'Never. We reposition your real experience — reframing it in the language hiring decisions are made in. Nothing is fabricated. Your CV has to survive an interview.' },
  { q: 'Will my CV pass application software?', a: 'Yes — clean structure, standard headings, keyword alignment. But software is the smaller battle: our research shapes what happens in the seconds after a human opens it.' },
  { q: 'Do you guarantee interviews?', a: 'No — and be wary of anyone who does. Hiring decisions are made by employers, on factors nobody outside the room controls. What we are accountable for is the quality of the positioning: by the end, an employer reading your CV and LinkedIn can tell what you are good at and why it matters to the role you are targeting.' },
  { q: 'Is this a subscription?', a: 'No. One payment, no renewals, ever. What you buy is yours.' },
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState('idle');
  const [openFaq, setOpenFaq] = useState(-1);
  const [openStory, setOpenStory] = useState('');
  const [showSticky, setShowSticky] = useState(false);
  const [buying, setBuying] = useState('');

  // Sticky mobile CTA: visible only in the band between the end of the hero and
  // the start of pricing. Below pricing it stays hidden, so it can never sit on
  // top of the buy buttons or the footer. One scroll handler, no observers, so
  // the behaviour is the same everywhere and easy to reason about.
  useEffect(() => {
    const onScroll = () => {
      const hero = document.querySelector('.hero');
      const pricing = document.querySelector('#pricing');
      if (!hero || !pricing) return;
      const pastHero = hero.getBoundingClientRect().bottom <= 0;
      const reachedPricing = pricing.getBoundingClientRect().top <= window.innerHeight;
      setShowSticky(pastHero && !reachedPricing);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Fire pricing_viewed once, the first time the pricing section is on screen.
  useEffect(() => {
    const pricing = document.querySelector('#pricing');
    if (!pricing || typeof IntersectionObserver === 'undefined') return;
    let fired = false;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !fired) { fired = true; trackPricingViewed('homepage'); }
    }, { threshold: 0.25 });
    obs.observe(pricing);
    return () => obs.disconnect();
  }, []);

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
      if (r.ok) track('generate_lead', { lead_type: 'free_checklist', method: 'homepage_form' });
    } catch { setSubState('error'); }
  }

  async function buy(productId) {
    const offer = [...SERVICES, ...SERVICES_TWO, ...BUNDLES].find((o) => o.id === productId);
    setBuying(productId);
    trackCta(`buy_${productId}`, 'pricing', productId);
    try {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productId }),
      });
      const json = await r.json();
      if (json.url) {
        trackBeginCheckout(productId, offer ? offer.name : productId, offer ? offer.price : 0);
        window.location.href = json.url;
      } else setBuying('');
    } catch { setBuying(''); }
  }

  /* One pricing card, used for services, add-ons and bundles alike. */
  const offerCard = (o) => (
    <div className={`pcard${o.hot ? ' hot' : ''}`} key={o.id}>
      {o.hot && <div className="hotbadge">{o.hot}</div>}
      <div className="pname">{o.name}</div>
      <div className="psub">{o.sub}</div>
      <div className="pdel">{o.del}</div>
      <div className="pprice">€{o.price} <span>once</span></div>
      <div className="panchor">{o.anchor}</div>
      <ul className="pfeat">
        {o.feat.map((f) => <li key={f}>{Ic.check}{f}</li>)}
      </ul>
      {o.addon ? (
        <div className="paddon">Added to your order — just ask</div>
      ) : (
        <button
          className={`pbtn ${o.hot ? 'primary' : 'outline'}`}
          onClick={() => buy(o.id)}
          disabled={buying === o.id}
        >
          {buying === o.id ? 'Opening secure checkout…' : `${o.cta} →`}
        </button>
      )}
    </div>
  );

  return (
    <>
      <Seo
        title="Asovix — Career Positioning for Job Seekers in Ireland"
        description="You know you can do the job — employers just can't see it yet. Asovix helps job seekers in Ireland position their real experience for the roles they actually want."
        path="/"
        jsonLd={[organizationLd(), websiteLd(), serviceLd(OFFERS)]}
      />

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

        /* flex-wrap + centre: whatever is left over on the final row self-centres, at any card count */
        .rgallery { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
        .rgallery .rcard { flex: 0 1 calc((100% - 32px) / 3); display: block; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s ease-out, border-color 0.2s ease-out; }
        .rgallery .rcard:hover { transform: translateY(-4px); border-color: rgba(77,141,255,0.5); }
        .rgallery .rcard img { display: block; width: 100%; height: auto; }
        @media (max-width: 980px) { .rgallery .rcard { flex-basis: calc((100% - 16px) / 2); } }
        @media (max-width: 640px) { .rgallery .rcard { flex-basis: 100%; } }

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
        .pgrid.two { grid-template-columns: repeat(2, 1fr); max-width: 720px; margin: 0 auto; }
        .pgroup { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #4D8DFF; font-weight: 600; margin: 44px 0 18px; text-align: center; }
        .paddon { font-size: 13px; color: #7FA8F5; text-align: center; padding: 13px; border: 1px dashed rgba(77,141,255,0.35); border-radius: 12px; }
        .revbox { max-width: 720px; margin: 34px auto 0; background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px 30px; }
        .revbox h3 { font-family: 'DM Serif Display', serif; font-size: 20px; color: #fff; margin-bottom: 14px; }
        .revlist { list-style: none; }
        .revlist li { font-size: 13.5px; color: #C7D4E8; padding: 7px 0; line-height: 1.6; display: flex; gap: 9px; align-items: flex-start; }
        .revlist li svg { flex-shrink: 0; margin-top: 3px; }
        .audp { font-size: 14px; color: #9FB0C8; line-height: 1.7; margin-bottom: 12px; }
        .audf { font-size: 14px; color: #C7D4E8; line-height: 1.7; }
        .audf strong { color: #fff; }
        .proofstrip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; max-width: 940px; margin: 34px auto 0; }
        .pfcard { background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(77,141,255,0.25); border-radius: 16px; padding: 20px 14px; text-align: center; }
        .pfnum { font-family: 'DM Serif Display', serif; font-size: clamp(24px, 3.2vw, 32px); color: #4D8DFF; line-height: 1.1; }
        .pflab { font-size: 12px; color: #9FB0C8; margin-top: 6px; line-height: 1.45; }
        .pfsrc { font-size: 10.5px; color: #4A5670; margin-top: 8px; letter-spacing: 0.03em; }
        .prooffoot { text-align: center; font-size: 11.5px; color: #4A5670; margin-top: 16px; line-height: 1.6; max-width: 640px; margin-left: auto; margin-right: auto; }
        @media (max-width: 700px) { .proofstrip { grid-template-columns: repeat(2, 1fr); } }

        .engine { display: flex; align-items: stretch; justify-content: center; gap: 12px; flex-wrap: wrap; max-width: 1000px; margin: 0 auto; }
        .ebox { flex: 1 1 190px; background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.09); border-radius: 18px; padding: 24px 20px; text-align: center; }
        .ebox.res { background: linear-gradient(180deg, rgba(46,109,228,0.18), rgba(46,109,228,0.04)); border-color: rgba(77,141,255,0.5); }
        .ename { font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #7FA8F5; font-weight: 700; margin-bottom: 10px; }
        .ebox.res .ename { color: #fff; }
        .edesc { font-size: 13.5px; color: #9FB0C8; line-height: 1.6; }
        .eop { display: flex; align-items: center; justify-content: center; font-size: 20px; color: #4D8DFF; font-weight: 700; }
        @media (max-width: 860px) { .engine { flex-direction: column; } .eop { padding: 2px 0; } }

        .midcta { text-align: center; background: linear-gradient(135deg, rgba(46,109,228,0.16), rgba(46,109,228,0.04)); border: 1px solid rgba(77,141,255,0.3); border-radius: 24px; padding: 44px 30px; max-width: 800px; margin: 0 auto; }
        .midcta h2 { margin-bottom: 10px; }
        .midcta .lead { margin-bottom: 26px; }

        .sticky { position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 60; display: none; }
        .sticky a { display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px; border-radius: 14px; box-shadow: 0 10px 34px rgba(6,11,22,0.6), 0 6px 22px rgba(59,125,240,0.4); }
        @media (max-width: 760px) { .sticky.on { display: block; } body { padding-bottom: 0; } }

        .photoband { position: relative; border-radius: 24px; overflow: hidden; border: 1px solid rgba(77,141,255,0.3); max-width: 1000px; margin: 46px auto 0; }
        .photoband img { display: block; width: 100%; height: auto; }
        .photocap { position: absolute; left: 0; right: 0; bottom: 0; padding: 54px 30px 26px; background: linear-gradient(to top, rgba(6,11,22,0.94), rgba(6,11,22,0.55) 58%, transparent); font-family: 'DM Serif Display', serif; font-size: clamp(16px, 2.3vw, 26px); color: #fff; text-align: center; line-height: 1.35; }
        @media (max-width: 560px) { .photocap { padding: 34px 16px 16px; } }

        .audgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; max-width: 880px; margin: 0 auto; }
        .audcard { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 30px 28px; }
        .audicon { width: 46px; height: 46px; border-radius: 13px; background: rgba(46,109,228,0.14); border: 1px solid rgba(77,141,255,0.32); display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
        .audname { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #7FA8F5; font-weight: 700; margin-bottom: 12px; }
        .audpain { font-family: 'DM Serif Display', serif; font-size: clamp(17px, 2vw, 20px); line-height: 1.45; color: #fff; margin-bottom: 16px; }
        .audfix { font-size: 13.5px; color: #9FB0C8; line-height: 1.6; display: flex; gap: 9px; align-items: flex-start; }
        .audfix svg { flex-shrink: 0; margin-top: 3px; }
        @media (max-width: 780px) { .audgrid { grid-template-columns: 1fr; max-width: 460px; } }

        .rgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; max-width: 940px; margin: 0 auto; align-items: start; }
        .rcase { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px 26px; }
        .rname { font-size: 16px; font-weight: 700; color: #fff; }
        .rctx { font-size: 12px; color: #64748F; margin-bottom: 20px; letter-spacing: 0.03em; }
        .rlab { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #64748F; font-weight: 700; margin-bottom: 8px; }
        .rbefore { font-family: 'DM Serif Display', serif; font-size: 20px; color: #9FB0C8; line-height: 1.4; margin-bottom: 20px; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
        .chip { font-size: 12.5px; color: #C7D4E8; background: rgba(46,109,228,0.12); border: 1px solid rgba(77,141,255,0.3); border-radius: 100px; padding: 6px 13px; }
        .rres { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 18px; }
        .rnum { font-family: 'DM Serif Display', serif; font-size: clamp(34px, 4.4vw, 46px); line-height: 1; color: #4D8DFF; }
        .rreslab { font-size: 13px; color: #C7D4E8; margin-top: 7px; line-height: 1.55; }
        .rmore { margin-top: 18px; background: none; border: none; padding: 0; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; color: #7FA8F5; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
        .rmore .chev { font-size: 10px; transition: transform 0.25s ease-out; }
        .rmore.open .chev { transform: rotate(180deg); }
        .rstory { margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; }
        .rstory p { font-size: 13.5px; color: #9FB0C8; line-height: 1.75; margin-bottom: 10px; }
        .rcav { font-size: 11.5px; color: #64748F; margin-top: 14px; letter-spacing: 0.03em; }
        @media (max-width: 840px) { .rgrid { grid-template-columns: 1fr; max-width: 520px; } }

        .orgcta { display: flex; gap: 12px; flex-wrap: wrap; }

        @media (max-width: 840px) { .pgrid.two { grid-template-columns: 1fr; max-width: 420px; } }

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
            <a href="#how">How it works</a>
            <a href="#results">Results</a>
            <a href="#pricing">Pricing</a>
            <Link href="/organisations" onClick={() => trackCta('for_organisations', 'nav')}>For organisations</Link>
            <Link href="/diagnosis" className="navcta" onClick={() => trackDiagnosisClick('nav')}>{V.stickyCta}</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="wrap">
          <div className="badge">Research-backed career positioning</div>
          <h1>You know you can do the job. <span className="blue">Employers can&apos;t see it yet.</span></h1>
          <p className="sub">{V.heroSub}</p>
          <div className="ctarow">
            <Link href="/diagnosis" className="cta" onClick={() => trackDiagnosisClick('hero')}>{V.heroCta} →</Link>
            <a href="#how" className="ghost" onClick={() => trackCta('see_how_it_works', 'hero')}>{V.heroSecondary}</a>
          </div>
          <div className="trust">2-minute career positioning check · No payment required</div>
        </div>
      </header>

      {/* ── PROOF STRIP ── */}
      <section style={{ paddingTop: 10, paddingBottom: 0 }}>
        <div className="wrap">
          <div className="proofstrip">
            <div className="pfcard">
              <div className="pfnum">7</div>
              <div className="pflab">interviews for one candidate</div>
              <div className="pfsrc">Donal · his figures</div>
            </div>
            <div className="pfcard">
              <div className="pfnum">3</div>
              <div className="pflab">interviews — Stryker, Alcon, DePuy</div>
              <div className="pfsrc">Michelle · her result</div>
            </div>
            <div className="pfcard">
              <div className="pfnum">Same day</div>
              <div className="pflab">employer contact after a rewrite</div>
              <div className="pfsrc">Ryan · his own recommendation</div>
            </div>
            <div className="pfcard">
              <div className="pfnum">30+</div>
              <div className="pflab">candidates worked with one-to-one</div>
              <div className="pfsrc">Asovix</div>
            </div>
          </div>
          <p className="prooffoot">
            Individual client outcomes, reported by the candidates themselves — not averages, and not a promise of
            the same. No employer named here endorses Asovix.
          </p>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section style={{ paddingTop: 58 }}>
        <div className="wrap">
          <div className="kicker">The gap</div>
          <h2>Your experience may not be the problem.<br />Your positioning might be.</h2>
          <p className="lead" style={{ marginBottom: 0 }}>
            Employers can&apos;t hire what they can&apos;t see. If your CV, LinkedIn and applications don&apos;t clearly
            connect your evidence to the role they&apos;re hiring for, strong experience can still get ignored.
          </p>
        </div>
      </section>

      {/* ── POSITIONING ENGINE ── */}
      <section id="how" style={{ paddingTop: 46 }}>
        <div className="wrap">
          <div className="kicker">The Asovix positioning engine</div>
          <h2>Three inputs. One answer.</h2>
          <p className="lead">Every candidate we work with is resolved against the same equation.</p>
          <div className="engine">
            <div className="ebox">
              <div className="ename">What you want</div>
              <div className="edesc">The roles, companies and career direction you&apos;re targeting.</div>
            </div>
            <div className="eop">×</div>
            <div className="ebox">
              <div className="ename">What you can prove</div>
              <div className="edesc">Your actual experience, achievements, projects, skills and evidence.</div>
            </div>
            <div className="eop">×</div>
            <div className="ebox">
              <div className="ename">What employers are buying</div>
              <div className="edesc">Current job descriptions, requirements, keywords and market demand.</div>
            </div>
            <div className="eop">=</div>
            <div className="ebox res">
              <div className="ename">Your positioning</div>
              <div className="edesc">How your CV, LinkedIn, applications and interview story should present you.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section id="whoitsfor" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">Who we work with</div>
          <h2>Different situations. The same frustration.</h2>
          <p className="lead">One of these is probably you.</p>
          <div className="audgrid">
            {AUDIENCE.map((a) => (
              <div className="audcard" key={a.t}>
                <div className="audicon">{Ic[a.ic]}</div>
                <div className="audname">{a.t}</div>
                <div className="audpain">&ldquo;{a.pain}&rdquo;</div>
                <div className="audfix">{Ic.arrow}<span>{a.fix}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MID-PAGE DIAGNOSIS CTA ── */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="midcta">
            <div className="kicker">Start here</div>
            <h2>Which one is costing you?</h2>
            <p className="lead">
              Seven quick questions. We tell you what your answers point to, and the one thing to fix first.
            </p>
            <Link href="/diagnosis" className="cta" onClick={() => trackDiagnosisClick('mid_page')}>{V.heroCta} →</Link>
            <div className="trust" style={{ marginTop: 20 }}>2 minutes · No payment required</div>
          </div>
        </div>
      </section>

      {/* ── PROOF: result first, story on demand ── */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">What the work actually finds</div>
          <h2>The value was already there.</h2>
          <p className="lead">Four of ours, shared with their permission. Nothing invented — only uncovered.</p>
          <div className="rgrid">
            {PROOF.map((c) => (
              <div className="rcase" key={c.id}>
                <div className="rname">{c.name}</div>
                <div className="rctx">{c.ctx}</div>

                <div className="rlab">{c.beforeLab}</div>
                <div className="rbefore">{c.before}</div>

                <div className="rlab">{c.evLab}</div>
                <div className="chips">
                  {c.ev.map((e) => <span className="chip" key={e}>{e}</span>)}
                </div>

                <div className="rres">
                  <div className="rnum">{c.num}</div>
                  <div className="rreslab">{c.numLab}</div>
                </div>

                <button
                  className={`rmore ${openStory === c.id ? 'open' : ''}`}
                  onClick={() => setOpenStory(openStory === c.id ? '' : c.id)}
                  aria-expanded={openStory === c.id}
                >
                  {openStory === c.id ? 'Hide the story' : 'Read the full story'}
                  <span className="chev">▼</span>
                </button>

                {openStory === c.id && (
                  <div className="rstory">
                    {c.story.map((para, i) => <p key={i}>{para}</p>)}
                  </div>
                )}

                <div className="rcav">{c.caveat}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTS ── */}
      <section id="results" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">Real outcomes</div>
          <h2>People who were being ignored. Until they weren't.</h2>
          <p className="lead">Nursing, engineering, finance, business, law, marketing, cybersecurity — different fields, same turnaround.</p>
          <div className="rgallery">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
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
          <p className="lead">Pick the service that fits, pay once, and the work starts. Then:</p>
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

      {/* ── PRICING ── */}
      <section id="pricing" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="kicker">Pricing</div>
          <h2>One payment. No subscription. No templates.</h2>
          <p className="lead">
            Subscription tools charge <strong>€20–50 every month</strong> and leave the thinking to you.
            Large CV services charge <strong>€100–180+</strong> for a rewrite. What you are paying for here
            is the evidence work — done on one person, by hand, once.
          </p>

          <div className="pgroup">Individual services</div>
          <div className="pgrid">{SERVICES.map(offerCard)}</div>
          <div className="pgrid two" style={{ marginTop: 18 }}>{SERVICES_TWO.map(offerCard)}</div>

          <div className="pgroup">Bundles</div>
          <div className="pgrid">{BUNDLES.map(offerCard)}</div>

          <div className="revbox">
            <h3>Revisions, in plain terms</h3>
            <ul className="revlist">
              <li>{Ic.check}One free minor revision within 7 days of delivery.</li>
              <li>{Ic.check}Additional minor revisions, or any requested after 7 days: €15 flat.</li>
              <li>{Ic.check}A major rework — different target role, new evidence needed — is treated as a new CV Positioning job at €65, not a revision.</li>
              <li>{Ic.check}Bundle orders (€110 and above) include one extra free revision round.</li>
            </ul>
          </div>

          <div className="nosub">One payment — never a subscription. Secured by Stripe.</div>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <Link href="/diagnosis" style={{ fontSize: 14, color: '#7FA8F5', textDecoration: 'none' }} onClick={() => trackDiagnosisClick('pricing')}>
              Not sure which one you need? Get your diagnosis first →
            </Link>
          </div>
        </div>
      </section>

      {/* ── RESEARCH ── */}
      <section id="research" style={{ paddingTop: 30 }}>
        <div className="wrap">
          <div className="kicker">The evidence</div>
          <h2>Built from what candidates struggle with — and what employers actually look for.</h2>
          <p className="lead">Asovix was developed through 26+ discovery conversations with candidates, recruiters and hiring leaders — which is how we learned where strong candidates lose visibility.</p>
          <div className="statsbar">
            <div className="sbox"><b>26</b><span>customer discovery interviews</span></div>
            <div className="sbox"><b>11</b><span>hiring leaders interviewed</span></div>
            <div className="sbox"><b>10</b><span>organisations, across industries</span></div>
          </div>
          <p className="prooffoot" style={{ marginBottom: 18 }}>Research conversations have included professionals from these organisations. They are not clients or partners, and none of them endorse Asovix.</p>
          <div className="orgs">
            {ORGS.map((o) => <span key={o}>{o}</span>)}
          </div>
          <figure className="photoband">
            <img
              src="/founder-research.jpg"
              alt="Samuel Adu, founder of Asovix, at a table with the Asovix site open on his laptop and printed client result cards spread in front of him"
              width="1600"
              height="1067"
            />
            <figcaption className="photocap">Built from real conversations. Tested on real careers.</figcaption>
          </figure>
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
                <div className="fstat"><b>30+</b><span>candidates helped one-on-one</span></div>
                <div className="fstat"><b>26</b><span>customer discovery interviews</span></div>
                <div className="fstat"><b>Cork</b><span>built in Ireland, for Irish &amp; UK job seekers</span></div>
              </div>
            </div>
            <div className="ftext">
              <div className="kicker" style={{ textAlign: 'left' }}>Meet the founder</div>
              <h2>Every feature here came from a real conversation. None came from assumptions.</h2>
              <p>
                Before Asovix was a company, it was me — sitting with people one-on-one, rewriting CVs,
                fixing LinkedIn profiles, preparing interviews. Over 30 of them. The same thing kept happening:
                <strong> same person, same experience, better communicated — suddenly, interviews.</strong>
              </p>
              <p>
                Then I went to the other side of the table and asked 26 people what actually gets someone
                shortlisted. Their answers, not my assumptions, became <strong>the Asovix Method</strong>.
              </p>
              <div className="fsig">— Samuel Adu, BSc Business Technology &amp; Communications</div>
            </div>
          </div>
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

      {/* ── B2B TEASER → /organisations ── */}
      <section id="recruiters" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="b2b">
            <div>
              <div className="kicker" style={{ textAlign: 'left' }}>For organisations</div>
              <h2>Got a group of candidates, not just one?</h2>
              <p className="lead">
                We run the same positioning work at cohort scale for recruitment agencies, universities,
                training providers and career platforms — and report on what happens next.
              </p>
              <div className="orgcta">
                <Link href="/organisations" className="cta" onClick={() => trackCta('see_b2b', 'b2b_teaser')}>See how it works →</Link>
                <a href="https://calendly.com/infoasovix/30min" className="ghost" target="_blank" rel="noopener noreferrer" onClick={() => trackCta('book_b2b_call', 'b2b_teaser')}>Talk to Samuel</a>
              </div>
            </div>
            <div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="stat"><div className="statn">10–20</div><div className="statl">candidates in a typical first pilot</div></div>
                <div className="stat"><div className="statn">26</div><div className="statl">discovery interviews behind the method</div></div>
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

      <div className={`sticky ${showSticky ? 'on' : ''}`}>
        <Link href="/diagnosis" onClick={() => trackDiagnosisClick('sticky_mobile')}>{V.stickyCta} →</Link>
      </div>

      <footer>
        <div className="wrap">
          <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><img src="/logo.svg" alt="" width="26" height="29" style={{ display: 'block' }} />Asovix<em>.</em></div>
          <div className="ftag">The company that helps graduates get interviews.</div>
          <div className="flinks">
            <Link href="/diagnosis">Career positioning check</Link>
            <a href="#pricing">See pricing</a>
            <Link href="/organisations">For organisations</Link>
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
