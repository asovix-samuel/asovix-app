import nodemailer from 'nodemailer';

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send CVs to client with download links / attachments
 */
export async function sendCVsToClient({ clientEmail, clientName, cv1Buf, cv2Buf, cv3Buf, safeName }) {
  const transport = getTransport();

  await transport.sendMail({
    from: `"Asovix" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject: `Your Asovix CVs are ready, ${clientName.split(' ')[0]}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="padding: 32px 0 16px;">
          <h1 style="font-size: 24px; color: #1B3A6B; margin: 0 0 4px;">Asovix<span style="font-style:italic">.</span></h1>
          <p style="font-size: 11px; color: #888; letter-spacing: 0.08em; text-transform: uppercase; margin: 0;">AI-Powered CV Optimisation</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px;">

        <p style="font-size: 15px; line-height: 1.6;">Hi ${clientName.split(' ')[0]},</p>
        <p style="font-size: 15px; line-height: 1.6;">Your three optimised CVs are attached and ready to use. Here's your quick guide:</p>

        <div style="background: #F0F4FA; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 14px;">📊 CV 1 — Finance / FP&A / Analyst</p>
          <p style="margin: 0 0 16px; font-size: 13px; color: #555;">Use this for Financial Analyst, FP&A Analyst, Finance Operations, and data-focused roles.</p>

          <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 14px;">🏦 CV 2 — Paraplanner / Advisory / Wealth</p>
          <p style="margin: 0 0 16px; font-size: 13px; color: #555;">Use this for Paraplanner, Wealth Management, and roles offering an advisor development pathway.</p>

          <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 14px;">💼 CV 3 — Sales / Advisory / Consultancy</p>
          <p style="margin: 0; font-size: 13px; color: #555;">Use this for Sales Executive, Business Development, Client Relationship Manager, and consultancy roles.</p>
        </div>

        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="font-size: 13px; color: #1a1a1a; margin: 0 0 8px; font-weight: 600;">Quick tips:</p>
          <ul style="font-size: 13px; color: #555; margin: 0; padding-left: 16px; line-height: 1.8;">
            <li>Save each CV as a PDF before attaching to applications</li>
            <li>Tailor the subject line of each application to the specific job title</li>
            <li>Make sure your LinkedIn headline matches whichever CV you're sending</li>
            <li>You can reply to this email if you need any adjustments</li>
          </ul>
        </div>

        <p style="font-size: 15px; line-height: 1.6;">Good luck — go get those interviews!</p>

        <p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">
          Warm regards,<br>
          <strong>Samuel Adu</strong><br>
          <span style="color: #1B3A6B;">Asovix</span>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;">
        <p style="font-size: 11px; color: #aaa; text-align: center;">Asovix · AI-Powered CV Optimisation · asovix.com</p>
      </div>
    `,
    attachments: [
      { filename: `${safeName}_CV1_Finance_Analyst.docx`, content: cv1Buf, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: `${safeName}_CV2_Paraplanner_Advisory.docx`, content: cv2Buf, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: `${safeName}_CV3_Sales_Consultancy.docx`, content: cv3Buf, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    ],
  });
}

/**
 * Notify Samuel of a new order
 */
export async function notifyOwner({ clientName, clientEmail, amount, target, location }) {
  const transport = getTransport();

  await transport.sendMail({
    from: `"Asovix Orders" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: `💰 New Asovix order — ${clientName} (€${amount})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; color: #1a1a1a;">
        <h2 style="color: #1B3A6B;">New order received</h2>
        <table style="font-size: 14px; line-height: 2; width: 100%;">
          <tr><td style="color: #888; width: 140px;">Client name</td><td><strong>${clientName}</strong></td></tr>
          <tr><td style="color: #888;">Email</td><td>${clientEmail}</td></tr>
          <tr><td style="color: #888;">Target</td><td>${target || 'Not specified'}</td></tr>
          <tr><td style="color: #888;">Location</td><td>${location || 'UK'}</td></tr>
          <tr><td style="color: #888;">Amount paid</td><td><strong style="color: #1B3A6B;">€${amount}</strong></td></tr>
        </table>
        <p style="font-size: 13px; color: #888; margin-top: 16px;">CVs have been generated and sent to the client automatically.</p>
      </div>
    `,
  });
}
