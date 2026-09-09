import Link from 'next/link';
import { Seo } from '../lib/seo';

export default function Terms() {
  return (
    <>
      <Seo
        title="Terms of Service — Asovix"
        description="The terms covering Asovix career positioning services: delivery times, the revision policy, refunds and your responsibilities."
        path="/terms"
      />
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
        <h1>Terms of Service</h1>
        <div className="upd">Last updated: September 2026</div>

        <h2>1. The service</h2>
        <p>Asovix provides career positioning services — CV positioning, LinkedIn positioning, cover letters and interview preparation — operated by Samuel Adu, Cork, Ireland. By purchasing, you agree to these terms.</p>

        <h2>2. Delivery</h2>
        <p>Every order is prepared personally. After payment you receive a confirmation email asking for your current CV, your LinkedIn URL and your target role; documents are delivered by email within 24 hours of us having what we need from you. Interview Preparation is a live session, scheduled with you by email within 24 hours of purchase.</p>

        <h2>3. Accuracy of your information</h2>
        <p>Our documents are built from the CV content and details you supply. You are responsible for the truthfulness of that information. We reposition and rewrite your real experience; we do not invent qualifications or experience, and you must not ask us to.</p>

        <h2>4. Revisions and refunds</h2>
        <ul>
          <li>One free minor revision is included, if requested within 7 days of delivery. Reply to your delivery email.</li>
          <li>Additional minor revisions, or any minor revision requested more than 7 days after delivery, are charged at a flat €15.</li>
          <li>A major rework — a different target role, or work requiring new evidence — is treated as a new CV Positioning job at €65, not a revision.</li>
          <li>Bundle orders of €110 or above include one extra free revision round.</li>
          <li>If we fail to deliver your order, you receive a full refund.</li>
          <li>As personalised digital services made to your individual requirements, orders are otherwise non-refundable once work on your order has begun — you acknowledge and consent to this at purchase, as permitted under EU consumer law for personalised goods and digital services. This does not affect your statutory rights.</li>
        </ul>

        <h2>5. No employment guarantee</h2>
        <p>We improve how your experience is presented. We cannot and do not guarantee interviews, offers or employment — hiring decisions rest with employers.</p>

        <h2>6. Intellectual property</h2>
        <p>Delivered documents are yours to use without restriction. The Asovix name, method, website content and materials remain our property.</p>

        <h2>7. Liability</h2>
        <p>To the maximum extent permitted by law, our total liability arising from any order is limited to the amount you paid for that order. Nothing in these terms limits liability that cannot be limited under Irish law.</p>

        <h2>8. Governing law</h2>
        <p>These terms are governed by the laws of Ireland, and the Irish courts have jurisdiction. EU consumers retain any mandatory protections of their country of residence.</p>

        <h2>9. Contact</h2>
        <p><a href="mailto:info@asovix.com">info@asovix.com</a> · Asovix, Cork, Ireland</p>
      </div>
    </>
  );
}
