// ── Diagnosis lead capture ──
//
// STORAGE: this project has no database, and Vercel wipes its filesystem
// between requests, so nothing is kept on the server. Every lead is delivered
// by email, which is the system of record:
//
//   1. To Samuel — a readable summary, the candidate's ORIGINAL CV FILE as an
//      attachment, a one-click personal reply, and a JSON block for pasting
//      into a sheet or CRM.
//   2. To the candidate — their diagnosis and a clear next step. No internal
//      data, reasoning or admin detail is shown to them.
//
// CV FILES never get a URL of any kind — public, private or signed. They go
// from the request straight into the email to Samuel and nowhere else.
// Retention follows the privacy notice: up to 12 months for people who do not
// become clients.
//
// TO ADD A REAL DATABASE LATER: implement persistLead() below. Nothing else
// changes; the record shape is fixed in LEAD_FIELDS.

import nodemailer from 'nodemailer';
import { nextStepFor, CONTACT_EMAIL } from './diagnosis';

export const LEAD_FIELDS = [
  'id',
  'submittedAt',
  'firstName',
  'email',
  'linkedin',
  'goal',
  'targetRole',
  'situation',
  'applications',
  'biggestProblem',
  'cvProvided',
  'cvFilename',
  'cvAttached',
  'cvAttachError',
  'primaryIssue',
  'recommendedService',
  'recommendedPrice',
  'nextStepTier',
  'source',
];

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Durable storage hook. Currently a no-op — email is the system of record.
 * Implement this to add a database; it must not throw, so a storage outage
 * can never cost us the email notification.
 */
export async function persistLead(record) { // eslint-disable-line no-unused-vars
  return { stored: false, reason: 'no database configured' };
}

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = encodeURIComponent;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://www.asovix.com';

function row(label, value) {
  if (value === '' || value == null) return '';
  return `<tr><td style="color:#888;padding:4px 12px 4px 0;vertical-align:top;white-space:nowrap;">${esc(label)}</td><td style="color:#1a1a1a;padding:4px 0;"><strong>${esc(value)}</strong></td></tr>`;
}

/* ── CV attachment ── */

// 3MB of file is ~4MB once base64-encoded; Vercel rejects bodies over 4.5MB.
export const MAX_CV_BYTES = 3 * 1024 * 1024;

// Extension must match the file's real first bytes. This stops a renamed
// executable or script being mailed to Samuel as "cv.pdf".
const CV_TYPES = {
  pdf: { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b, 0x03, 0x04] },
  doc: { mime: 'application/msword', magic: [0xd0, 0xcf, 0x11, 0xe0] },
  txt: { mime: 'text/plain', magic: null },
};

/**
 * Validate an uploaded CV and turn it into a mail attachment.
 * Returns { attachment, reason } — attachment is null when the file is
 * missing or rejected, and reason says why (shown to Samuel, not the candidate).
 */
export function prepareCvAttachment(cvFile, { firstName, leadId } = {}) {
  if (!cvFile || !cvFile.data) return { attachment: null, reason: '' };

  const ext = String(cvFile.name || '').toLowerCase().split('.').pop();
  const type = CV_TYPES[ext];
  if (!type) return { attachment: null, reason: 'unsupported file type' };

  let buf;
  try {
    buf = Buffer.from(String(cvFile.data), 'base64');
  } catch {
    return { attachment: null, reason: 'unreadable file' };
  }
  if (!buf.length) return { attachment: null, reason: 'empty file' };
  if (buf.length > MAX_CV_BYTES) return { attachment: null, reason: 'file over 3MB' };
  if (type.magic && !type.magic.every((byte, i) => buf[i] === byte)) {
    return { attachment: null, reason: 'file contents do not match its extension' };
  }
  if (!type.magic && buf.subarray(0, 2048).includes(0)) {
    return { attachment: null, reason: 'not a plain text file' };
  }

  const safeName = String(firstName || 'candidate')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'candidate';

  return {
    attachment: { filename: `CV-${safeName}-${leadId}.${ext}`, content: buf, contentType: type.mime },
    reason: '',
  };
}

/** One-click checkout link for emails. Carries only opaque references. */
export function checkoutLink(productId, record) {
  const q = new URLSearchParams({ product: productId, dx: record.id });
  if (record.cvAttached) q.set('cv', '1');
  return `${appUrl()}/checkout?${q.toString()}`;
}

/** Internal notification to Samuel — the lead, the CV file, and a quick reply. */
export async function notifyOwnerOfLead(record, transport, { attachment } = {}) {
  const t = transport || getTransport();
  const next = nextStepFor(record.recommendedId);
  const first = (record.firstName || '').split(' ')[0] || 'there';

  // The excerpt is shown in its own block; the base64 file is never in here.
  const { cvExcerpt, ...forCrm } = record;
  const json = JSON.stringify(forCrm, null, 2);

  let cvLine = 'Not uploaded';
  if (attachment) cvLine = `Attached to this email — ${attachment.filename}`;
  else if (record.cvProvided) {
    cvLine = `Uploaded but NOT attached${record.cvAttachError ? ` (${record.cvAttachError})` : ''} — ask them for it`;
  }

  const offered = next.tier === 'high'
    ? `A conversation with you first (${next.bookingUrl ? 'booking link' : 'reply by email'}), or buy now${next.downsell ? `, or start smaller with ${next.downsell.name} (€${next.downsell.price})` : ''}`
    : `Direct checkout (€${record.recommendedPrice}), or email you with questions`;

  const replyBody = [
    `Hi ${first},`,
    '',
    `Thanks for doing the Asovix positioning check${attachment ? ' and for sharing your CV' : ''}.`,
    '',
    `Your diagnosis pointed to: ${record.primaryIssue}`,
    '',
    "If it would help, I'm happy to talk it through before you decide anything. Just reply here with any questions, or a couple of times that suit you for a quick call.",
    '',
    'Samuel',
  ].join('\n');
  const replyHref = `mailto:${record.email}?subject=${enc('Your Asovix diagnosis — next step')}&body=${enc(replyBody)}`;

  const subject = `🩺 Diagnosis — ${record.firstName || record.email} — ${record.recommendedService} €${record.recommendedPrice}`
    + (attachment ? ' — CV attached' : record.cvProvided ? ' — CV NOT attached' : '');

  await t.sendMail({
    from: `"Asovix" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL || process.env.SMTP_USER,
    replyTo: record.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="font-size:19px;color:#1B3A6B;margin:0 0 4px;">New diagnosis lead</h2>
        <p style="font-size:12px;color:#888;margin:0 0 18px;">${esc(record.submittedAt)} · ${esc(record.id)}</p>

        <div style="background:#F0F4FA;border-radius:8px;padding:16px 18px;margin:0 0 20px;">
          <p style="font-size:14px;margin:0 0 6px;"><strong>${next.tier === 'high'
            ? `High-ticket (€${esc(record.recommendedPrice)}) — they were offered a conversation with you first.`
            : `They were offered direct checkout for ${esc(record.recommendedService)}.`}</strong></p>
          <p style="font-size:13px;color:#555;margin:0 0 12px;">${next.tier === 'high'
            ? 'Watch for a reply to their diagnosis email. If none comes, a personal follow-up is worth sending.'
            : 'If they have not bought within a day or two, a personal follow-up is worth sending.'}</p>
          <a href="${esc(replyHref)}" style="background:#2557C7;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;display:inline-block;">Reply to ${esc(first)} →</a>
        </div>

        <table style="font-size:14px;border-collapse:collapse;width:100%;">
          ${row('Name', record.firstName)}
          ${row('Email', record.email)}
          ${row('LinkedIn', record.linkedin)}
          ${row('Goal', record.goal)}
          ${row('Target role', record.targetRole)}
          ${row('Situation', (record.situation || []).join(', '))}
          ${row('Applications', record.applications)}
          ${row('Thinks problem is', record.biggestProblem)}
          ${row('CV', cvLine)}
        </table>

        <h3 style="font-size:15px;color:#1B3A6B;margin:22px 0 6px;">What we told them</h3>
        <table style="font-size:14px;border-collapse:collapse;width:100%;">
          ${row('Primary issue', record.primaryIssue)}
          ${row('Recommended', `${record.recommendedService} (€${record.recommendedPrice})`)}
          ${row('Offered', offered)}
        </table>

        ${cvExcerpt ? `<h3 style="font-size:15px;color:#1B3A6B;margin:22px 0 6px;">CV excerpt</h3><pre style="font-size:12px;color:#444;background:#f5f6f8;padding:12px;border-radius:6px;white-space:pre-wrap;">${esc(cvExcerpt)}</pre>` : ''}

        <h3 style="font-size:15px;color:#1B3A6B;margin:22px 0 6px;">For your CRM / sheet</h3>
        <pre style="font-size:12px;color:#444;background:#f5f6f8;padding:12px;border-radius:6px;white-space:pre-wrap;">${esc(json)}</pre>
        <p style="font-size:13px;color:#555;margin-top:18px;">Replying to this email reaches them directly.</p>
      </div>
    `,
    attachments: attachment
      ? [{ filename: attachment.filename, content: attachment.content, contentType: attachment.contentType }]
      : [],
  });
}

/** Candidate-facing diagnosis and next step. Nothing internal is included. */
export async function sendDiagnosisToLead(record, diagnosis, transport) {
  const t = transport || getTransport();
  const first = (record.firstName || 'there').split(' ')[0];
  const next = diagnosis.next || nextStepFor(diagnosis.recommended);
  const o = diagnosis.offer;
  const buyUrl = checkoutLink(o.id, record);

  const label = (text) => `<p style="font-size:11px;color:#888;letter-spacing:0.12em;text-transform:uppercase;margin:28px 0 6px;">${text}</p>`;
  const para = (html) => `<p style="font-size:15px;line-height:1.65;margin:0 0 12px;">${html}</p>`;
  const button = (href, text) => `<p style="margin:18px 0 14px;"><a href="${esc(href)}" style="background:#2557C7;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 26px;border-radius:8px;display:inline-block;">${esc(text)}</a></p>`;
  const link = (href, text) => `<p style="margin:10px 0;"><a href="${esc(href)}" style="color:#2557C7;font-size:14px;">${esc(text)}</a></p>`;

  let nextHtml;
  if (next.tier === 'low') {
    nextHtml = button(buyUrl, `Start ${o.name} — €${o.price} →`)
      + para('Questions first? Just reply to this email — it comes straight to me.');
  } else {
    nextHtml = (next.bookingUrl
      ? button(next.bookingUrl, 'Book a call with Samuel →')
      : para('<strong>Want to talk it through before deciding?</strong> Just reply to this email — it comes straight to me.'))
      + link(buyUrl, `Or start ${o.name} now — €${o.price} →`)
      + (next.downsell
        ? link(checkoutLink(next.downsell.id, record), `Or start smaller with ${next.downsell.name} — €${next.downsell.price} →`)
        : '');
  }

  await t.sendMail({
    from: `"Asovix" <${process.env.SMTP_USER}>`,
    to: record.email,
    replyTo: CONTACT_EMAIL,
    subject: `${first}, your Asovix positioning diagnosis`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="padding: 32px 0 16px;">
          <h1 style="font-size: 24px; color: #1B3A6B; margin: 0 0 4px;">Asovix<span style="font-style:italic">.</span></h1>
          <p style="font-size: 11px; color: #888; letter-spacing: 0.08em; text-transform: uppercase; margin: 0;">Career Positioning</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;">

        ${para(`Hi ${esc(first)},`)}
        ${para('Here is your positioning diagnosis, based on the answers you gave.')}

        ${label('What we found')}
        <p style="font-size:18px;line-height:1.45;color:#1B3A6B;margin:0 0 10px;"><strong>${esc(diagnosis.primaryIssue)}</strong></p>
        ${para(esc(diagnosis.biggestGap))}

        ${label('Why it matters')}
        ${para(esc(diagnosis.alignment.note))}

        ${label('What we recommend')}
        <p style="font-size:17px;margin:0 0 4px;"><strong>${esc(o.name)}</strong> — €${esc(o.price)}, one payment</p>
        ${para(esc(next.reason))}

        ${label('What happens next')}
        ${nextHtml}
        ${record.cvAttached ? para("You've already shared your CV, so there's nothing to send again.") : ''}

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 18px;">
        <p style="font-size:13px;line-height:1.6;color:#666;">This is based only on what you told us, so treat it as a starting point rather than a verdict.</p>
        <p style="font-size:15px;line-height:1.6;">— <strong>Samuel Adu</strong><br><span style="color:#1B3A6B;">Asovix · Cork, Ireland</span></p>
      </div>
    `,
  });
}

/** Build the stable lead record from raw answers + computed diagnosis. */
export function buildLeadRecord({ answers, diagnosis, source, cvFilename, cvExcerpt }) {
  return {
    id: `dx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    submittedAt: new Date().toISOString(),
    firstName: answers.firstName || '',
    email: answers.email || '',
    linkedin: answers.linkedin || '',
    goal: answers.goal || '',
    targetRole: answers.targetRole || '',
    situation: answers.situation || [],
    applications: answers.applications || '',
    biggestProblem: answers.biggestProblem || '',
    cvProvided: !!answers.cvProvided,
    cvFilename: cvFilename || '',
    cvAttached: false,
    cvAttachError: '',
    cvExcerpt: cvExcerpt || '',
    primaryIssue: diagnosis.primaryIssue,
    recommendedService: diagnosis.offer.name,
    recommendedPrice: diagnosis.offer.price,
    recommendedId: diagnosis.recommended,
    nextStepTier: diagnosis.next ? diagnosis.next.tier : '',
    source: source || 'direct',
  };
}
