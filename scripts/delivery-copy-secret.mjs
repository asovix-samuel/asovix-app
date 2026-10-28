// Copies ONE saved setting to the Windows clipboard without ever showing it, so it can be
// pasted into Vercel (Settings -> Environment Variables).
//
//   node scripts/delivery-copy-secret.mjs DELIVERY_SESSION_SECRET
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ALLOWED = [
  'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DELIVERY_PASSWORD_HASH', 'DELIVERY_SESSION_SECRET',
  'ANTHROPIC_API_KEY', 'STRIPE_SECRET_KEY',
];
const name = process.argv[2];
if (!ALLOWED.includes(name)) {
  console.log('Usage: node scripts/delivery-copy-secret.mjs NAME');
  console.log('NAME is one of: ' + ALLOWED.join(', '));
  process.exit(1);
}
const file = new URL('../.env.local', import.meta.url);
const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
const m = new RegExp('^' + name + '=(.+)$', 'm').exec(text);
if (!m) {
  console.log(name + ' is not saved in .env.local yet.');
  process.exit(1);
}
const r = spawnSync('clip', [], { input: m[1].trim(), shell: true });
if (r.status !== 0) {
  console.log('Could not reach the clipboard.');
  process.exit(1);
}
console.log(name + ' copied to your clipboard (' + m[1].trim().length + ' characters). Paste it into Vercel now, then copy something else to clear it.');
