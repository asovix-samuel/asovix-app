import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sendDeliveryEmail } from '../../lib/delivery/mail.js';

test('mail: builds a message with the exact bytes of each file attached (dry run, nothing sent)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mail-'));
  const f = join(dir, 'cv.pdf');
  writeFileSync(f, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10]));
  const r = await sendDeliveryEmail({ to: 'a@example.com', subject: 'Your CV', text: 'Hello', files: [f], dryRun: true });
  assert.deepEqual(r.attached, ['cv.pdf (7 bytes)']);
});

test('mail: refuses a bad recipient, a missing body and an empty file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mail-'));
  const empty = join(dir, 'empty.docx');
  writeFileSync(empty, '');
  await assert.rejects(() => sendDeliveryEmail({ to: 'nope', subject: 's', text: 't', dryRun: true }), /recipient/);
  await assert.rejects(() => sendDeliveryEmail({ to: 'a@example.com', subject: '', text: '', dryRun: true }), /required/);
  await assert.rejects(() => sendDeliveryEmail({ to: 'a@example.com', subject: 's', text: 't', files: [empty], dryRun: true }), /empty/);
});

test('mail: a real send without SMTP settings fails clearly instead of silently', async () => {
  const keep = { u: process.env.SMTP_USER, p: process.env.SMTP_PASS };
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  try {
    await assert.rejects(() => sendDeliveryEmail({ to: 'a@example.com', subject: 's', text: 't' }), /not set up/);
  } finally {
    if (keep.u) process.env.SMTP_USER = keep.u;
    if (keep.p) process.env.SMTP_PASS = keep.p;
  }
});
