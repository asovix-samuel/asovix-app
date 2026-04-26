import Head from 'next/head';
import Link from 'next/link';

export default function Success() {
  return (
    <>
      <Head>
        <title>Payment successful — Asovix</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F7F8FA; color: #1a1a1a; }
      `}</style>

      <style jsx>{`
        .header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 0 24px; height: 56px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #1B3A6B; }
        .logo em { font-style: italic; }
        .main { max-width: 480px; margin: 0 auto; padding: 48px 16px; text-align: center; }
        .icon { width: 64px; height: 64px; background: #EEF2F8; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
        h1 { font-family: 'DM Serif Display', serif; font-size: 28px; color: #1B3A6B; margin-bottom: 12px; }
        .sub { font-size: 15px; color: #555; line-height: 1.7; margin-bottom: 28px; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; text-align: left; }
        .ct { font-size: 14px; font-weight: 500; margin-bottom: 12px; }
        .row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 13px; color: #555; line-height: 1.5; }
        .num { width: 20px; height: 20px; border-radius: 50%; background: #1B3A6B; color: #fff; font-size: 10px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .tip { font-size: 12px; color: #aaa; line-height: 1.8; margin-top: 16px; }
        a.back { display: inline-block; margin-top: 12px; font-size: 13px; color: #1B3A6B; text-decoration: none; }
        a.back:hover { text-decoration: underline; }
      `}</style>

      <div className="header">
        <div className="logo">Asovix<em>.</em></div>
      </div>

      <div className="main">
        <div className="icon">✦</div>
        <h1>Payment confirmed.</h1>
        <p className="sub">
          Your three CVs are being generated right now by Claude AI.<br />
          They'll arrive in your inbox within the next 2 minutes.
        </p>

        <div className="card">
          <div className="ct">Check your emails for:</div>
          <div className="row"><div className="num">1</div><span><strong>CV 1 — Finance / FP&A / Analyst</strong> — for analyst, FP&A, and finance ops roles</span></div>
          <div className="row"><div className="num">2</div><span><strong>CV 2 — Paraplanner / Advisory</strong> — for wealth management and paraplanner roles</span></div>
          <div className="row"><div className="num">3</div><span><strong>CV 3 — Sales / Advisory / Consultancy</strong> — for sales, BD, and client growth roles</span></div>
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

        <Link href="/" className="back">← Submit another CV</Link>
      </div>
    </>
  );
}
