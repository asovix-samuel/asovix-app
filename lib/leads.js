// ── Diagnosis lead capture ──
//
// STORAGE STATUS: this project has no database. Nothing in package.json talks
// to one, and the filesystem on Vercel is ephemeral, so writing to disk would
// silently lose leads. Rather than adding a paid service without approval,
// every lead is delivered two ways:
//
//   1. A readable notification email to Samuel.
//   2. A machine-readable JSON block inside that same email, so any lead can be
//      pasted straight into a sheet or CRM import without retyping.
//
// TO ADD A REAL DATABASE LATER: implement persistLead() below and nothing else
// changes. The record shape is already stable and documented in LEAD_FIELDS.
// Vercel Postgres, Vercel KV, Supabase and Airtable all fit this shape.

import nodemailer from 'nodemailer';

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
  'primaryIssue',
  'recommendedService',
  'recommendedPrice',
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
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function row(label, value) {
  if (value === '' || value == null) return '';
  return `<tr><td style="color:#888;padding:4px 12px 4px 0;vertical-align:top;white-space:nowrap;">${esc(label)}</td><td style="color:#1a1a1a;padding:4px 0;"><strong>${esc(value)}</strong></td></tr>`;
}

/** Notify Samuel, with a copy-pasteable JSON block for CRM import. */
export async function notifyOwnerOfLead(record, transport) {
  const t = transport || getTransport();
  const json = JSON.stringify(record, null, 2);

  await t.sendMail({
    from: `"Asovix" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL || process.env.SMTP_USER,
    replyTo: record.email,
    subject: `🩺 Diagnosis lead — ${record.firstName || record.email} — ${record.recommendedService}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="font-size:19px;color:#1B3A6B;margin:0 0 4px;">New diagnosis lead</h2>
        <p style="font-size:12px;color:#888;margin:0 0 18px;">${esc(record.submittedAt)} · ${esc(record.id)}</p>
        <table style="font-size:14px;border-collapse:collapse;width:100%;">
          ${row('Name', record.firstName)}
          ${row('Email', record.email)}
          ${row('LinkedIn', record.linkedin)}
          ${row('Goal', record.goal)}
          ${row('Target role', record.targetRole)}
          ${row('Situation', (record.situation || []).join(', '))}
          ${row('Applications', record.applications)}
          ${row('Thinks problem is', record.biggestProblem)}
          ${row('CV uploaded', record.cvProvided ? (record.cvFilename || 'yes') : 'no')}
        </table>
        <h3 style="font-size:15px;color:#1B3A6B;margin:22px 0 6px;">What we told them</h3>
        <table style="font-size:14px;border-collapse:collapse;width:100%;">
          ${row('Primary issue', record.primaryIssue)}
          ${row('Recommended', `${record.recommendedService} (€${record.recommendedPrice})`)}
        </table>
        ${record.cvExcerpt ? `<h3 style="font-size:15px;color:#1B3A6B;margin:22px 0 6px;">CV excerpt</h3><pre style="font-size:12px;color:#444;background:#f5f6f8;padding:12px;border-radius:6px;white-space:pre-wrap;">${esc(record.cvExcerpt)}</pre>` : ''}
        <h3 style="font-size:15px;color:#1B3A6B;margin:22px 0 6px;">For your CRM / sheet</h3>
        <pre style="font-size:12px;color:#444;background:#f5f6f8;padding:12px;border-radius:6px;white-space:pre-wrap;">${esc(json)}</pre>
        <p style="font-size:13px;color:#555;margin-top:18px;">Reply to this email to reach them directly.</p>
      </div>
    `,
  });
}

/** Send the candidate their own copy of the diagnosis. */
export async function sendDiagnosisToLead(record, diagnosis, transport) {
  const t = transport || getTransport();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://asovix.com';
  const first = (record.firstName || 'there').split(' ')[0];

  await t.sendMail({
    from: `"Asovix" <${process.env.SMTP_USER}>`,
    to: record.email,
    subject: 'Your Asovix positioning diagnosis',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="padding: 32px 0 16px;">
          <h1 style="font-size: 24px; color: #1B3A6B; margin: 0 0 4px;">Asovix<span style="font-style:italic">.</span></h1>
          <p style="font-size: 11px; color: #888; letter-spacing: 0.08em; text-transform: uppercase; margin: 0;">Career Positioning</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;">
        <p style="font-size:15px;line-height:1.6;">Hi ${esc(first)},</p>
        <p style="font-size:15px;line-height:1.6;">Here is your positioning diagnosis, based on the answers you gave.</p>

        <p style="font-size:12px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin:24px 0 4px;">Primary issue</p>
        <p style="font-size:17px;line-height:1.5;color:#1B3A6B;margin:0 0 18px;"><strong>${esc(diagnosis.primaryIssue)}</strong></p>

        <p style="font-size:12px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 4px;">Biggest gap</p>
        <p style="font-size:15px;line-height:1.65;margin:0 0 18px;">${esc(diagnosis.biggestGap)}</p>

        <p style="font-size:12px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 4px;">Next best action</p>
        <p style="font-size:15px;line-height:1.65;margin:0 0 18px;">${esc(diagnosis.nextAction)}</p>

        <p style="font-size:15px;line-height:1.6;">Based on your answers, the service that fits is <strong>${esc(diagnosis.offer.name)} (€${esc(diagnosis.offer.price)})</strong>.</p>
        <p style="margin:22px 0 26px;">
          <a href="${appUrl}/#pricing" style="background:#4D8DFF;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 26px;border-radius:8px;display:inline-block;">See what that involves →</a>
        </p>
        <p style="font-size:14px;line-height:1.6;color:#555;">This is based only on what you told us, so treat it as a starting point rather than a verdict. Reply to this email with anything you think I have missed — it reaches me directly.</p>
        <p style="font-size:15px;line-height:1.6;">— <strong>Samuel Adu</strong><br><span style="color:#1B3A6B;">Asovix</span></p>
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
    cvExcerpt: cvExcerpt || '',
    primaryIssue: diagnosis.primaryIssue,
    recommendedService: diagnosis.offer.name,
    recommendedPrice: diagnosis.offer.price,
    recommendedId: diagnosis.recommended,
    source: source || 'direct',
  };
}
