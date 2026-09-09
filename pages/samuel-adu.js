import Link from 'next/link';
import { trackCta, trackDiagnosisClick } from '../lib/analytics';
import {
  Seo, MEDIA, organizationLd, personLd, breadcrumbLd,
} from '../lib/seo';

// Founder profile. Written to be genuinely useful to candidates, organisations,
// recruiters and journalists researching Samuel Adu or Asovix — not a keyword
// landing page. Every claim here is either visible elsewhere on the site or
// supported by the two press articles in MEDIA.

const FACTS = [
  { k: 'Role', v: 'Founder, Asovix' },
  { k: 'Based in', v: 'Cork, Ireland' },
  { k: 'University', v: 'Munster Technological University (MTU)' },
  { k: 'Programme', v: 'Student Inc. 2026' },
  { k: 'Field', v: 'Career positioning and employability' },
];

export default function SamuelAdu() {
  return (
    <>
      <Seo
        title="Samuel Adu | Founder of Asovix | Cork, Ireland"
        description="Samuel Adu is the founder of Asovix, a career positioning practice in Cork, Ireland. He works with job seekers on why employers are not responding, and how to position the experience they already have."
        path="/samuel-adu"
        type="profile"
        jsonLd={[
          personLd(),
          organizationLd(),
          breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Samuel Adu', path: '/samuel-adu' }]),
        ]}
      />

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: #060B16; color: #E6ECF5; }
        a { color: inherit; }
        ul { list-style: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .wrap { max-width: 860px; margin: 0 auto; padding: 0 24px; }

        .nav { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(14px); background: rgba(6,11,22,0.75); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .navin { max-width: 1080px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 24px; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 10px; }
        .logo em { color: #4D8DFF; font-style: normal; }
        .navlinks { display: flex; gap: 24px; align-items: center; }
        .navlinks a { font-size: 13.5px; color: #9FB0C8; text-decoration: none; transition: color 0.2s ease-out; }
        .navlinks a:hover { color: #fff; }
        .navcta { background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff !important; padding: 9px 18px; border-radius: 10px; font-weight: 600; box-shadow: 0 4px 20px rgba(59,125,240,0.35); }
        @media (max-width: 700px) { .navlinks a:not(.navcta) { display: none; } }

        .top { position: relative; padding: 64px 0 34px; overflow: hidden; background-image: url(/hexpattern.svg); }
        .top::before { content: ''; position: absolute; inset: -40% -20% auto; height: 130%; background: radial-gradient(ellipse 60% 55% at 50% 0%, rgba(46,109,228,0.24), transparent 70%); pointer-events: none; }
        .top > * { position: relative; }
        .crumb { font-size: 12.5px; color: #64748F; margin-bottom: 22px; }
        .crumb a { color: #7FA8F5; text-decoration: none; }
        .phead { display: grid; grid-template-columns: 132px 1fr; gap: 30px; align-items: center; animation: fadeUp 0.5s ease-out both; }
        .pavatar { width: 132px; height: 132px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255,0.28); background: linear-gradient(135deg, #4D8DFF, #1B3A6B); }
        .pavatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        h1 { font-family: 'DM Serif Display', serif; font-size: clamp(30px, 5.4vw, 46px); line-height: 1.12; color: #fff; margin-bottom: 10px; }
        .prole { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #7FA8F5; font-weight: 600; }
        @media (max-width: 640px) { .phead { grid-template-columns: 1fr; gap: 20px; } .pavatar { width: 104px; height: 104px; } }

        section { padding: 42px 0; }
        h2 { font-family: 'DM Serif Display', serif; font-size: clamp(22px, 3.4vw, 30px); color: #fff; margin-bottom: 16px; }
        h3 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        p { font-size: 16px; color: #C7D4E8; line-height: 1.8; margin-bottom: 16px; }
        p a { color: #7FA8F5; text-decoration: underline; text-underline-offset: 3px; }
        .lede { font-size: 18px; color: #E6ECF5; line-height: 1.75; }

        .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 26px 0 0; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 26px; }
        .fact { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px 16px; }
        .fact dt { font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748F; font-weight: 700; margin-bottom: 6px; }
        .fact dd { font-size: 14px; color: #E6ECF5; line-height: 1.5; }

        .media { display: grid; gap: 12px; }
        .mitem { display: block; background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px 22px; text-decoration: none; transition: border-color 0.2s ease-out, transform 0.2s ease-out; }
        .mitem:hover { border-color: rgba(77,141,255,0.5); transform: translateY(-2px); }
        .mpub { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #7FA8F5; font-weight: 700; margin-bottom: 7px; }
        .mtitle { font-size: 15.5px; color: #fff; line-height: 1.5; margin-bottom: 6px; }
        .mdate { font-size: 12px; color: #64748F; }
        .mnote { font-size: 12.5px; color: #64748F; line-height: 1.7; margin-top: 16px; }

        .cta { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(180deg, #3B7DF0, #2557C7); color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 15px 30px; border-radius: 12px; box-shadow: 0 8px 30px rgba(59,125,240,0.4); transition: transform 0.2s ease-out; }
        .cta:hover { transform: translateY(-2px); }
        .ghost { display: inline-flex; align-items: center; gap: 8px; color: #C7D4E8; text-decoration: none; font-size: 15px; font-weight: 500; padding: 15px 26px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); }
        .ghost:hover { border-color: rgba(255,255,255,0.3); }
        .ctarow { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }

        .work { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
        .wcard { background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 22px; text-decoration: none; display: block; transition: border-color 0.2s ease-out; }
        .wcard:hover { border-color: rgba(77,141,255,0.45); }
        .wcard p { font-size: 13.5px; color: #9FB0C8; margin: 0; line-height: 1.6; }

        .photo { border-radius: 20px; overflow: hidden; border: 1px solid rgba(77,141,255,0.28); margin-top: 8px; }
        .photo img { display: block; width: 100%; height: auto; }
        .caption { font-size: 12.5px; color: #64748F; margin-top: 12px; line-height: 1.65; }

        footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 40px 0; text-align: center; margin-top: 20px; }
        .flinks { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        .flinks a { font-size: 13px; color: #9FB0C8; text-decoration: none; }
        .flinks a:hover { color: #fff; }
        .fcopy { margin-top: 20px; font-size: 11.5px; color: #3D4A63; }
      `}</style>

      <nav className="nav">
        <div className="navin">
          <Link href="/" className="logo">
            <img src="/logo.svg" alt="" width="30" height="33" style={{ display: 'block' }} />Asovix<em>.</em>
          </Link>
          <div className="navlinks">
            <Link href="/">Home</Link>
            <Link href="/organisations">For organisations</Link>
            <Link href="/diagnosis" className="navcta" onClick={() => trackDiagnosisClick('samuel_adu_nav')}>Get my diagnosis</Link>
          </div>
        </div>
      </nav>

      <header className="top">
        <div className="wrap">
          <div className="crumb"><Link href="/">Asovix</Link> → Samuel Adu</div>
          <div className="phead">
            <div className="pavatar">
              <img src="/founder.jpg" alt="Samuel Adu, founder of Asovix, Cork" width="132" height="132" />
            </div>
            <div>
              <h1>Samuel Adu — Founder of Asovix</h1>
              <div className="prole">Cork, Ireland · Career positioning &amp; employability</div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section style={{ paddingTop: 26 }}>
          <div className="wrap">
            <p className="lede">
              Samuel Adu is the founder of <Link href="/">Asovix</Link>, a career positioning practice based in
              Cork, Ireland. He works on a single problem: capable people are overlooked because the value
              they already have is not communicated in a way employers can act on.
            </p>
            <p>
              Asovix did not start as a company. It started with Samuel sitting down with people one at a
              time — rewriting CVs, rebuilding LinkedIn profiles, preparing them for interviews. Over thirty
              of them. The pattern that kept repeating became the thesis the business now runs on: the same
              person, with the same experience, communicated differently, starts getting interviews.
            </p>
            <p>
              He then went to the other side of the table, running 26 discovery conversations with
              candidates, recruiters, hiring managers and careers advisers — including people working at
              organisations such as Morgan McKinley, CPL Healthcare, Ryanair Labs and Osborne Recruitment.
              Those answers, rather than assumptions, shaped the method Asovix uses today.
            </p>

            <dl className="facts">
              {FACTS.map((f) => (
                <div className="fact" key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>The work</h2>
            <p>
              Asovix is not a CV-writing service. The work is diagnostic first: understanding what someone is
              actually targeting, what their history genuinely proves, and what employers in that market are
              hiring for. Positioning is what sits where those three meet.
            </p>
            <p>
              In practice that means evidence extraction — finding the things people have dismissed as not
              worth mentioning — and then rebuilding the CV, the LinkedIn profile and the interview story
              around what an employer needs to see.
            </p>
            <div className="work">
              <Link href="/diagnosis" className="wcard" onClick={() => trackDiagnosisClick('samuel_adu_work')}>
                <h3>Career positioning check</h3>
                <p>A free two-minute diagnosis of what is blocking your applications.</p>
              </Link>
              <Link href="/#pricing" className="wcard" onClick={() => trackCta('services_from_founder_page', 'samuel_adu')}>
                <h3>CV, LinkedIn &amp; interview positioning</h3>
                <p>The individual services Asovix offers job seekers in Ireland.</p>
              </Link>
              <Link href="/organisations" className="wcard" onClick={() => trackCta('b2b_from_founder_page', 'samuel_adu')}>
                <h3>Work with cohorts</h3>
                <p>How Asovix supports universities, agencies and training providers.</p>
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>Student Inc. 2026 and MTU</h2>
            <p>
              Samuel is studying Business Technology and Communications at Munster Technological University
              (MTU), Bishopstown Campus, and built Asovix through{' '}
              <strong>Student Inc. 2026</strong> — the national student entrepreneurship programme managed by
              MTU and funded by the Higher Education Authority. He demonstrated Asovix at the Student Inc.
              2026 showcase in August 2026.
            </p>
            <figure className="photo">
              <img
                src="/founder-research.jpg"
                alt="Samuel Adu, founder of Asovix, with the Asovix site open on a laptop and printed candidate result cards"
                width="1600"
                height="1067"
                loading="lazy"
              />
            </figure>
            <p className="caption">
              Samuel with Asovix candidate research and results — the work behind the method.
            </p>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>Featured in</h2>
            <div className="media">
              {MEDIA.map((m) => (
                <a
                  key={m.url}
                  href={m.url}
                  className="mitem"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackCta('media_link', 'samuel_adu', m.publisher)}
                >
                  <div className="mpub">{m.publisher}</div>
                  <div className="mtitle">{m.title}</div>
                  <div className="mdate">
                    {new Date(m.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })} · Read the article →
                  </div>
                </a>
              ))}
            </div>
            <p className="mnote">
              Samuel and Asovix appear in the Student Inc. 2026 showcase coverage in both publications. These
              are independent articles about the programme — neither publication endorses Asovix, and neither
              is a client or partner.
            </p>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>Get in touch</h2>
            <p>
              For press enquiries, speaking, or working with a group of candidates, email{' '}
              <a href="mailto:info@asovix.com">info@asovix.com</a>. If you are job hunting and want to know
              what is holding you back, the fastest starting point is the positioning check.
            </p>
            <div className="ctarow">
              <Link href="/diagnosis" className="cta" onClick={() => trackDiagnosisClick('samuel_adu_footer')}>
                Find out what&apos;s blocking you →
              </Link>
              <a
                href="https://www.linkedin.com/company/asovix/"
                className="ghost"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCta('linkedin_from_founder_page', 'samuel_adu')}
              >
                Asovix on LinkedIn
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="flinks">
            <Link href="/">Asovix home</Link>
            <Link href="/diagnosis">Career positioning check</Link>
            <Link href="/organisations">For organisations</Link>
            <a href="mailto:info@asovix.com">info@asovix.com</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <div className="fcopy">© {new Date().getFullYear()} Asovix · Cork, Ireland</div>
        </div>
      </footer>
    </>
  );
}
