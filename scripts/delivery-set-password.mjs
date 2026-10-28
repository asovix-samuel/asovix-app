// Sets the sign-in password for the private delivery workspace.
//
//   node scripts/delivery-set-password.mjs
//
// Typing is hidden (only * is drawn). Nothing secret is ever printed. It saves a salted
// hash of the password (never the password) and a random session secret to .env.local on
// this computer. To put them into Vercel later, use scripts/delivery-copy-secret.mjs,
// which copies one value to the clipboard without showing it.
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../.env.local', import.meta.url);

// Raw-mode input: characters are never echoed, so nothing can leak when a line wraps.
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
        if (code === 3) { process.stdout.write('\n'); process.exit(130); }
        if (code === 13 || code === 10) return done(buf);
        if (code === 127 || code === 8) { if (buf) { buf = buf.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (code >= 32) { buf += ch; process.stdout.write('*'); }
      }
    }
    stdin.on('data', onData);
  });
}

const fromEnv = process.env.DELIVERY_NEW_PASSWORD;
const pw = fromEnv || (await ask('Choose a password (at least 12 characters): '));
if (pw.length < 12) {
  console.error('That password is too short. Nothing was changed.');
  process.exit(1);
}
if (!fromEnv && (await ask('Type it again: ')) !== pw) {
  console.error('The two passwords did not match. Nothing was changed.');
  process.exit(1);
}

const salt = randomBytes(16);
// ":" separators, not "$", because .env loaders expand "$name" and would corrupt the hash.
const hash = 'scrypt:' + salt.toString('hex') + ':' + scryptSync(pw, salt, 64).toString('hex');
const secret = randomBytes(32).toString('hex');

let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
function setVar(name, value) {
  const re = new RegExp('^' + name + '=.*$', 'm');
  text = re.test(text) ? text.replace(re, () => name + '=' + value) : text.trimEnd() + (text ? '\n' : '') + name + '=' + value + '\n';
}
setVar('DELIVERY_PASSWORD_HASH', hash);
setVar('DELIVERY_SESSION_SECRET', secret);
writeFileSync(file, text);

console.log('\nSaved to .env.local on this computer. Nothing secret was displayed.');
console.log('A fresh session secret was created too, so any older login is now invalid.');
