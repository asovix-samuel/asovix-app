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

function safeFilePart(s, fallback) {
  const cleaned = (s || '').replace(/[^a-zA-Z0-9 \-&]/g, '').trim().replace(/\s+/g, '_').substring(0, 40);
  return cleaned || fallback;
}

/**
 * Send CVs to client — descriptions are dynamic, based on the TITLE lines
 * the model generated for this specific candidate.
 */
export async function sendCVsToClient({ clientEmail, clientName, cv1Buf, cv2Buf, cv3Buf, safeName, titles = [] }) {
  const transport = getTransport();

  const cvMeta = [
    { emoji: '🎯', label: titles[0] || 'Primary Target', desc: 'Your strongest, most direct positioning for the role you told us you want.' },
    { emoji: '🔀', label: titles[1] || 'Adjacent Opportunity', desc: 'A neighbouring role type your background credibly supports — more doors, same strengths.' },
    { emoji: '🌐', label: titles[2] || 'Broader Positioning', desc: 'Transferable-skills positioning for wider opportunities in your market.' },
  ];

  const cvBlocks = cvMeta.map((c, i) => `
          <p style="margin: 0 0 12px; font-weight: 600; color: #1B3A6B; font-size: 14px;">${c.emoji} CV ${i + 1} — ${c.label}</p>
          <p style="margin: 0 0 ${i < 2 ? '16px' : '0'}; font-size: 13px; color: #555;">${c.desc}</p>`).join('\n');

  await transport.sendMail({
    from: `"Asovix" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject: `Your Asovix CVs are ready, ${clientName.split(' ')[0]}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="padding: 32px 0 16px;">
          <h1 style="font-size: 24px; color: #1B3A6B; margin: 0 0 4px;">Asovix<span style="font-style:italic">.</span></h1>
          <p style="font-size: 11px; color: #888; letter-spacing: 0.08em; text-transform: uppercase; margin: 0;">AI Career Positioning</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 24px;">

        <p style="font-size: 15px; line-height: 1.6;">Hi ${clientName.split(' ')[0]},</p>
        <p style="font-size: 15px; line-height: 1.6;">Your three optimised CVs are attached and ready to use. Each one positions you for a different angle of your target market:</p>

        <div style="background: #F0F4FA; border-radius: 8px; padding: 20px; margin: 20px 0;">
${cvBlocks}
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
        <p style="font-size: 11px; color: #aaa; text-align: center;">Asovix · AI Career Positioning · The best-positioned candidate gets noticed.</p>
      </div>
    `,
    attachments: [
      { filename: `${safeName}_CV1_${safeFilePart(titles[0], 'Primary_Target')}.docx`, content: cv1Buf, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: `${safeName}_CV2_${safeFilePart(titles[1], 'Adjacent_Opportunity')}.docx`, content: cv2Buf, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: `${safeName}_CV3_${safeFilePart(titles[2], 'Broader_Positioning')}.docx`, content: cv3Buf, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
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

/**
 * URGENT alert to Samuel when an order FAILED after payment.
 * Includes the full brief + CV text so he can deliver manually.
 */
export async function notifyOwnerFailure({ clientName, clientEmail, sessionId, errorMessage, brief, cvText, jd }) {
  const transport = getTransport();

  await transport.sendMail({
    from: `"Asovix Orders" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: `🚨 FAILED order — ${clientName} PAID but CVs were NOT sent`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
        <h2 style="color: #dc2626;">Order failed after payment — act now</h2>
        <p style="font-size: 14px;">The client below <strong>paid</strong> but automatic CV generation failed. Deliver manually or refund.</p>
        <table style="font-size: 14px; line-height: 2; width: 100%;">
          <tr><td style="color: #888; width: 140px;">Client</td><td><strong>${clientName}</strong> (${clientEmail})</td></tr>
          <tr><td style="color: #888;">Stripe session</td><td>${sessionId}</td></tr>
          <tr><td style="color: #888;">Error</td><td style="color:#dc2626;">${errorMessage}</td></tr>
          <tr><td style="color: #888;">Target</td><td>${brief?.target || '-'}</td></tr>
          <tr><td style="color: #888;">Location</td><td>${brief?.location || '-'}</td></tr>
          <tr><td style="color: #888;">Challenge</td><td>${brief?.challenge || '-'}</td></tr>
        </table>
        <h3 style="font-size: 14px; margin-top: 20px;">Job description provided</h3>
        <pre style="font-size: 12px; background:#f9fafb; padding:12px; border-radius:8px; white-space:pre-wrap;">${(jd || 'None').substring(0, 3000)}</pre>
        <h3 style="font-size: 14px;">CV text extracted</h3>
        <pre style="font-size: 12px; background:#f9fafb; padding:12px; border-radius:8px; white-space:pre-wrap;">${(cvText || 'None').substring(0, 6000)}</pre>
      </div>
    `,
  });
}
