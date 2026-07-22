import Head from 'next/head';
import Link from 'next/link';

export default function Privacy() {
  return (
    <>
      <Head><title>Privacy Policy — Asovix</title><link rel="icon" href="/favicon.ico" /></Head>
      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #060B16; color: #C7D4E8; }
        .lw { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; line-height: 1.8; font-size: 15px; }
        .lw h1 { color: #fff; font-size: 30px; margin-bottom: 6px; }
        .lw .upd { color: #64748F; font-size: 13px; margin-bottom: 34px; }
        .lw h2 { color: #fff; font-size: 19px; margin: 32px 0 10px; }
        .lw p, .lw li { margin-bottom: 10px; color: #9FB0C8; }
        .lw ul { padding-left: 22px; }
        .lw a { color: #4D8DFF; }
        .back { display: inline-block; margin-bottom: 30px; color: #7FA8F5; text-decoration: none; font-size: 14px; }
      `}</style>
      <div className="lw">
        <Link href="/" className="back">← Back to Asovix</Link>
        <h1>Privacy Policy</h1>
        <div className="upd">Last updated: July 2026</div>

        <h2>1. Who we are</h2>
        <p>Asovix ("we", "us") is a career positioning service operated by Samuel Adu, based in Cork, Ireland. We are the data controller for personal data processed through asovix.com. Contact: <a href="mailto:info@asovix.com">info@asovix.com</a>.</p>

        <h2>2. What we collect and why</h2>
        <ul>
          <li><strong>Order details</strong> — your name, email address, phone (optional), target role, location preference and career notes you provide: used to prepare and deliver your documents. Legal basis: performance of a contract.</li>
          <li><strong>Your CV content</strong> — the text of the CV you upload and any job description you paste: used solely to produce your tailored documents. Legal basis: performance of a contract.</li>
          <li><strong>Email address (checklist)</strong> — if you request our free checklist: used to send it and occasional career insights. Legal basis: consent; unsubscribe any time by replying "unsubscribe".</li>
          <li><strong>Payment data</strong> — handled entirely by Stripe; we never see or store your card details.</li>
        </ul>

        <h2>3. Who processes your data on our behalf</h2>
        <ul>
          <li><strong>Stripe</strong> (payments) — receives your payment details and order information, including the career brief and CV text needed to fulfil your order. See Stripe's privacy policy.</li>
          <li><strong>Anthropic</strong> (document generation) — receives your CV text and brief to generate your tailored documents. Data submitted via this service is not used to train models.</li>
          <li><strong>Vercel</strong> (website hosting) and <strong>Namecheap Private Email</strong> (email delivery).</li>
        </ul>
        <p>Some providers process data outside the EEA under EU-approved safeguards (Standard Contractual Clauses / adequacy decisions).</p>

        <h2>4. Retention</h2>
        <p>Order emails and delivered documents are retained for support and revision purposes for up to 24 months, after which they are deleted. Payment records are retained as required by tax law. You can request earlier deletion at any time.</p>

        <h2>5. Your rights (GDPR)</h2>
        <p>You have the right to access, rectify, erase, restrict or object to processing of your personal data, the right to data portability, and the right to withdraw consent. To exercise any right, email <a href="mailto:info@asovix.com">info@asovix.com</a>. You may also lodge a complaint with the Irish Data Protection Commission (dataprotection.ie).</p>

        <h2>6. Cookies</h2>
        <p>We use Google Analytics 4 to understand how visitors find and use asovix.com (pages visited, traffic source, approximate location, device type). Analytics cookies are set only if you accept them via the consent banner shown on your first visit; if you decline, no analytics cookies are placed. We do not send names, email addresses or phone numbers to Google Analytics. You can change your choice at any time by clearing this site's data in your browser. Strictly necessary technical storage may also be used by our hosting and payment providers to deliver the service.</p>

        <h2>7. Changes</h2>
        <p>We will update this page if our practices change, and revise the date above.</p>
      </div>
    </>
  );
}
