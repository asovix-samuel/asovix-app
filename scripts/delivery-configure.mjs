// Saves the delivery workspace's credentials to .env.local on THIS computer only.
//
//   node scripts/delivery-configure.mjs      (or: npm run delivery:configure)
//
// Each value is typed with hidden input, checked for the right shape, and written to
// .env.local (which git ignores). Nothing is printed back, sent anywhere, or committed.
// Press Enter to keep a value that is already saved. Type - to remove one.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../.env.local', import.meta.url);
let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
const has = (name) => new RegExp('^' + name + '=.+$', 'm').test(text);

// Reads one line in raw mode. Characters are NEVER echoed (a * is drawn per character
// instead), so a pasted secret cannot appear on screen, even when the line wraps.
function ask(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let buf = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const done = (value) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
      resolve(value);
    };
    function onData(chunk) {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (code === 3) { process.stdout.write('\n'); process.exit(130); } // Ctrl+C
        if (code === 13 || code === 10) return done(buf.trim()); // Enter
        if (code === 127 || code === 8) { if (buf) { buf = buf.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (code >= 32) { buf += ch; process.stdout.write('*'); }
      }
    }
    stdin.on('data', onData);
  });
}

function setVar(name, value) {
  const re = new RegExp('^' + name + '=.*$', 'm');
  if (value === '-') { text = text.replace(re, '').replace(/\n{3,}/g, '\n\n'); return; }
  text = re.test(text) ? text.replace(re, () => name + '=' + value) : text.trimEnd() + (text ? '\n' : '') + name + '=' + value + '\n';
}

const FIELDS = [
  { name: 'SUPABASE_URL', label: 'Supabase Project URL (https://xxxx.supabase.co)', ok: (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v) },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase secret key', ok: (v) => v.length > 30 && !/\s/.test(v) },
  { name: 'DATABASE_URL', label: 'Supabase database connection string (postgresql://...)', ok: (v) => /^postgres(ql)?:\/\/.+@.+:\d+\/.+/.test(v) && !v.includes('[YOUR-PASSWORD]') },
  { name: 'ANTHROPIC_API_KEY', label: 'Anthropic API key (sk-ant-...)', ok: (v) => /^sk-ant-/.test(v) },
  { name: 'SMTP_USER', label: 'Email address the site sends from (same as the SMTP_USER already on Vercel)', ok: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
  { name: 'SMTP_PASS', label: 'Email app password (same as SMTP_PASS on Vercel)', ok: (v) => v.replace(/\s/g, '').length >= 12 },
  { name: 'PAYPAL_CLIENT_ID', label: 'PayPal SANDBOX client id (from developer.paypal.com > Apps)', ok: (v) => v.length > 20 && !/\s/.test(v) },
  { name: 'PAYPAL_CLIENT_SECRET', label: 'PayPal SANDBOX client secret', ok: (v) => v.length > 20 && !/\s/.test(v) },
  { name: 'REED_API_KEY', label: 'Reed job board API key (free, from reed.co.uk/developers)', ok: (v) => v.length >= 20 && !/\s/.test(v) },
  { name: 'STRIPE_SECRET_KEY', label: 'Stripe TEST secret key (sk_test_...)', ok: (v) => /^(sk|rk)_test_/.test(v) },
];

console.log('Typing is hidden (you will see * only). Press Enter to skip, or keep a value already saved.\n');
for (const f of FIELDS) {
  const state = has(f.name) ? ' [already saved]' : '';
  for (;;) {
    const v = await ask(f.label + state + ': ');
    if (!v) break;
    if (v === '-' || f.ok(v)) { setVar(f.name, v); break; }
    console.log("  That doesn't look right for this field. Try again, or press Enter to skip.");
  }
}
writeFileSync(file, text);
console.log('\nSaved to .env.local on this computer. Nothing was displayed or sent anywhere.');
for (const f of FIELDS) console.log('  ' + (has(f.name) ? 'set    ' : 'MISSING') + '  ' + f.name);
