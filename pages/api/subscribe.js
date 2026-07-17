import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Lead capture: emails the free "11 Hiring Leaders, 11 Hiring Insights" PDF
// to the lead and notifies Samuel. Uses the existing SMTP setup — no new infrastructure.

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const PDF_FILENAME = '11-Hiring-Leaders-11-Hiring-Insights.pdf';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const transport = getTransport();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://asovix.com';
  const pdfUrl = `${appUrl}/${PDF_FILENAME}`;

  const mailOptions = {
    from: `"Asovix" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '11 Hiring Leaders, 11 Hiring Insights — your free guide ✓',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="padding: 32px 0 16px;">
          <h1 style="font-size: 24px; color: #1B3A6B; margin: 0 0 4px;">Asovix<span style="font-style:italic">.</span></h1>
          <p style="font-size: 11px; color: #888; letter-spacing: 0.08em; text-transform: uppercase; margin: 0;">AI Career Positioning</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px;">
        <p style="font-size: 15px; line-height: 1.6;">Here it is — 11 Hiring Leaders, 11 Hiring Insights, drawn directly from our 26 customer discovery interviews with recruiters and HR leaders at Morgan McKinley, CPL Healthcare, Noel Recruitment, Teamwork.com, Ryanair Labs, Capaciteam, Cork Airport, MTU and more. It's attached to this email as a PDF, and always available at the link below.</p>
        <p style="margin: 18px 0 28px;">
          <a href="${pdfUrl}" style="background:#1B3A6B; color:#fff; text-decoration:none; font-size:14px; font-weight:600; padding: 13px 26px; border-radius: 8px; display:inline-block;">Download the PDF →</a>
        </p>
        <p style="font-size: 15px; line-height: 1.6;">Want us to apply this research directly to your CV and LinkedIn?</p>
        <p style="margin: 18px 0 28px;">
          <a href="${appUrl}/start" style="background:#4D8DFF; color:#fff; text-decoration:none; font-size:14px; font-weight:600; padding: 13px 26px; border-radius: 8px; display:inline-block;">Get interview-ready — from €39 →</a>
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Warm regards,<br><strong>Samuel Adu</strong><br><span style="color: #1B3A6B;">Asovix</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;">
        <p style="font-size: 11px; color: #aaa; text-align: center;">Asovix · The best-positioned candidate gets noticed.</p>
      </div>
    `,
  };

  // Attach the PDF directly from the deployed public/ folder. If the read
  // fails for any reason, we still send the email with the download link above.
  try {
    const pdfPath = path.join(process.cwd(), 'public', PDF_FILENAME);
    mailOptions.attachments = [{
      filename: PDF_FILENAME,
      content: fs.readFileSync(pdfPath),
      contentType: 'application/pdf',
    }];
  } catch (fileErr) {
    console.error('Could not attach PDF, sending link only:', fileErr);
  }

  try {
    await transport.sendMail(mailOptions);

    // Notify Samuel — this builds his lead list
    if (process.env.OWNER_EMAIL) {
      await transport.sendMail({
        from: `"Asovix Leads" <${process.env.SMTP_USER}>`,
        to: process.env.OWNER_EMAIL,
        subject: `📥 New lead: ${email}`,
        text: `New "11 Hiring Leaders, 11 Hiring Insights" download.\n\nEmail: ${email}\nTime: ${new Date().toISOString()}\n\nAdd to your leads sheet and follow up in 2-3 days.`,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Could not send email' });
  }
}
