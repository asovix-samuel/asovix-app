// Send a delivery email with files attached, straight from disk.
//   node --env-file=.env.local scripts/delivery-send.mjs --to=a@b.com --subject="Your CV" --body=body.txt --file=cv.docx --file=cv.pdf [--dry-run]
// --dry-run builds the message and lists the attachments without sending anything.
import { readFileSync } from 'node:fs';
import { sendDeliveryEmail } from '../lib/delivery/mail.js';

const args = process.argv.slice(2);
const one = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
const files = args.filter((a) => a.startsWith('--file=')).map((a) => a.slice(7));
const bodyPath = one('body');
try {
  const r = await sendDeliveryEmail({
    to: one('to'),
    subject: one('subject'),
    text: bodyPath ? readFileSync(bodyPath, 'utf8') : one('text'),
    files,
    dryRun: args.includes('--dry-run'),
  });
  console.log(args.includes('--dry-run') ? 'DRY RUN (nothing sent).' : 'SENT.', 'Attachments:', r.attached.join('; ') || 'none');
} catch (e) {
  console.error('Not sent: ' + e.message);
  process.exit(1);
}
