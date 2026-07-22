import nodemailer from 'nodemailer';

// Lead capture: emails the free Asovix CV Checklist to the lead
// and notifies Samuel. Uses the existing SMTP setup — no new infrastructure.

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const CHECKLIST = [
  ['Contact block', 'Name, phone, email, LinkedIn — no home address, no photo, no date of birth.'],
  ['One clear target', 'Your CV should read like it was written for ONE role type, not "open to anything".'],
  ['Headline subtitle', 'A one-line positioning statement under your name (e.g. "MSc Finance | FP&A Analyst | Open to UK Roles").'],
  ['Summary sells the WHY', '3–4 sentences: experience + core skills + why it matters to this employer. No "hardworking team player".'],
  ['Keywords match the job ad', 'Mirror the exact language of the job description — ATS software matches words, not meaning.'],
  ['Every bullet starts with an action verb', '"Delivered", "Reduced", "Built" — never "Responsible for" or "Assisted with".'],
  ['Every bullet ends with an outcome', 'Numbers where possible: %, €, time saved, volume handled.'],
  ['No generic filler phrases', 'Cut "hardworking", "team player", "responsible for", "involved in".'],
  ['Reverse-chronological, consistent dates', 'Month + year, same format everywhere. No unexplained gaps.'],
  ['Brand names up front', 'Known employers, institutions or clients belong where a recruiter sees them in 6 seconds.'],
  ['Standard section headings', '"Professional Experience", "Education", "Key Skills" — creative headings break ATS parsers.'],
  ['No tables, columns, graphics or icons', 'They scramble in ATS systems. Clean single-column text wins.'],
  ['2 pages maximum', 'One page if under 5 years of experience.'],
  ['Cross-border bridging', 'Targeting the UK from Ireland (or vice versa)? Translate regulatory/credential context (e.g. CBI → "analogous to FCA-regulated environments").'],
  ['Save as PDF, named properly', '"Firstname_Lastname_CV.pdf" — never "CV_final_v3 (2).docx".'],
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const transport = getTransport();

  const items = CHECKLIST.map(([title, desc], i) => `
    <tr>
      <td style="vertical-align:top; padding: 8px 12px 8px 0; color:#4D8DFF; font-weight:700; font-size:14px;">${i + 1}.</td>
      <td style="padding: 8px 0;">
        <div style="font-size:14px; font-weight:600; color:#1a1a1a;">${title}</div>
        <div style="font-size:13px; color:#555; line-height:1.6;">${desc}</div>
      </td>
    </tr>`).join('');

  try {
    await transport.sendMail({
      from: `"Asovix" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your free Asovix CV Checklist ✓',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <div style="padding: 32px 0 16px;">
            <h1 style="font-size: 24px; color: #1B3A6B; margin: 0 0 4px;">Asovix<span style="font-style:italic">.</span></h1>
            <p style="font-size: 11px; color: #888; letter-spacing: 0.08em; text-transform: uppercase; margin: 0;">AI Career Positioning</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px;">
          <p style="font-size: 15px; line-height: 1.6;">Here it is — the 15-point checklist we apply to every client CV. Fix these and you're ahead of most applicants before AI even touches your CV.</p>
          <div style="background: #F0F4FA; border-radius: 8px; padding: 8px 20px; margin: 20px 0;">
            <table style="border-collapse: collapse;">${items}</table>
          </div>
          <p style="font-size: 15px; line-height: 1.6;">Want it done for you — three tailored, ATS-ready CVs in minutes?</p>
          <p style="margin: 18px 0 28px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://asovix.com'}/start" style="background:#1B3A6B; color:#fff; text-decoration:none; font-size:14px; font-weight:600; padding: 13px 26px; border-radius: 8px; display:inline-block;">Get my 3 CVs — €39 →</a>
          </p>
          <p style="font-size: 15px; line-height: 1.6;">
            Warm regards,<br><strong>Samuel Adu</strong><br><span style="color: #1B3A6B;">Asovix</span>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;">
          <p style="font-size: 11px; color: #aaa; text-align: center;">Asovix · The best-positioned candidate gets noticed.</p>
        </div>
      `,
    });

    // Notify Samuel — this builds his lead list
    if (process.env.OWNER_EMAIL) {
      await transport.sendMail({
        from: `"Asovix Leads" <${process.env.SMTP_USER}>`,
        to: process.env.OWNER_EMAIL,
        subject: `📥 New lead: ${email}`,
        text: `New checklist download.\n\nEmail: ${email}\nTime: ${new Date().toISOString()}\n\nAdd to your leads sheet and follow up in 2-3 days.`,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Could not send email' });
  }
}
