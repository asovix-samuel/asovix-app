import Link from 'next/link';
import { trackDiagnosisClick } from '../lib/analytics';
import { V } from '../lib/diagnosis';

// Reusable end-of-article call to action for future Irish SEO content pages.
//
// The journey we want is SEARCH → ANSWER → INSIGHT → DIAGNOSIS, not
// SEARCH → SALES PITCH. So this belongs at the END of a page that has already
// answered the reader's question — one per page, never repeated mid-article.
//
// Usage:
//   <DiagnosisCta location="why-no-interviews" />
//   <DiagnosisCta location="irish-cv-format" heading="Not sure if yours does this?" />
//
// `location` is passed to analytics so we can see which article drives diagnoses.
export default function DiagnosisCta({
  location,
  heading = 'Not sure what is holding you back?',
  body = 'Seven quick questions. We tell you what your answers point to, and the one thing to fix first.',
  label = V.heroCta,
}) {
  return (
    <aside className="dxcta">
      <style jsx>{`
        .dxcta {
          background: linear-gradient(135deg, rgba(46,109,228,0.16), rgba(46,109,228,0.04));
          border: 1px solid rgba(77,141,255,0.3);
          border-radius: 24px;
          padding: 38px 30px;
          text-align: center;
          margin: 48px auto 0;
          max-width: 720px;
        }
        h2 {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(22px, 3.4vw, 30px);
          color: #fff;
          margin-bottom: 10px;
          line-height: 1.25;
        }
        p {
          font-size: 15px;
          color: #9FB0C8;
          line-height: 1.7;
          max-width: 520px;
          margin: 0 auto 24px;
        }
        a {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(180deg, #3B7DF0, #2557C7);
          color: #fff;
          text-decoration: none;
          font-size: 15px;
          font-weight: 600;
          padding: 15px 30px;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(59,125,240,0.4);
          transition: transform 0.2s ease-out;
        }
        a:hover { transform: translateY(-2px); }
        .note { font-size: 12.5px; color: #64748F; margin: 18px 0 0; }
        @media (max-width: 560px) { .dxcta { padding: 30px 20px; border-radius: 20px; } }
      `}</style>
      <h2>{heading}</h2>
      <p>{body}</p>
      <Link href="/diagnosis" onClick={() => trackDiagnosisClick(location || 'content')}>
        {label} →
      </Link>
      <p className="note">2 minutes · No payment required</p>
    </aside>
  );
}
