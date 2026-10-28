// Sends a delivery email with real file attachments, reusing the site's existing SMTP settings (SMTP_USER / SMTP_PASS).
// Files are read from disk or storage as bytes, so nothing is retyped and nothing can be corrupted on the way.
import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

export function mailReady() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{ to: string, subject: string, text: string, files?: string[], replyTo?: string, inReplyTo?: string, dryRun?: boolean }} m
 * files = paths on disk. Returns { messageId, attached } (dryRun builds the message but does not send).
 */
export async function sendDeliveryEmail(m) {
  if (!EMAIL.test(m.to || '')) throw new Error('A valid recipient address is required.');
  if (!m.subject || !m.text) throw new Error('Subject and text are required.');
  if (!mailReady() && !m.dryRun) throw new Error('Email is not set up here: SMTP_USER and SMTP_PASS are missing from .env.local.');
  const attachments = (m.files || []).map((p) => {
    const content = readFileSync(p);
    if (!content.length) throw new Error(`Attachment is empty: ${p}`);
    return { filename: basename(p), content };
  });
  const attached = attachments.map((a) => `${a.filename} (${a.content.length} bytes)`);
  const transport = m.dryRun
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
  const info = await transport.sendMail({
    from: `"Samuel at Asovix" <${process.env.SMTP_USER || 'samuel@asovix.com'}>`,
    to: m.to,
    replyTo: m.replyTo || process.env.SMTP_USER,
    subject: m.subject,
    text: m.text,
    ...(m.inReplyTo ? { inReplyTo: m.inReplyTo, references: m.inReplyTo } : {}),
    attachments,
  });
  return { messageId: info.messageId, attached };
}
