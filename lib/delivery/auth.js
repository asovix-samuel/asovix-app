// ── Single-owner login for the delivery workspace ──
//
// The website has no accounts; this adds exactly one: Samuel's. Credentials live
// only in Vercel environment variables:
//   DELIVERY_PASSWORD_HASH   scrypt hash (made by scripts/delivery-set-password.mjs)
//   DELIVERY_SESSION_SECRET  random string that signs the session cookie
// The session is a signed, expiring, httpOnly cookie. No password or hash ever
// reaches the browser. Failed logins are counted in the database (not memory),
// because serverless memory does not survive between requests.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { LIMITS } from './config.js';

export const SESSION_COOKIE = 'asovix_delivery_session';

export function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = String(stored).split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const secret = () => {
  const s = process.env.DELIVERY_SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
};
const sign = (payload, key) => createHmac('sha256', key).update(payload).digest('hex');

export function createSessionToken(now = Date.now()) {
  const key = secret();
  if (!key) return null;
  const exp = now + LIMITS.sessionHours * 3600 * 1000;
  const payload = `${exp}.${randomBytes(8).toString('hex')}`;
  return `${payload}.${sign(payload, key)}`;
}

export function verifySessionToken(token, now = Date.now()) {
  const key = secret();
  if (!key || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [exp, nonce, mac] = parts;
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(sign(`${exp}.${nonce}`, key), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(exp) > now;
}

export function readCookie(header, name) {
  if (!header) return undefined;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return undefined; }
    }
  }
  return undefined;
}

/** Works with a Node request (headers is a plain object). */
export function isAuthenticated(req) {
  return verifySessionToken(readCookie(req.headers.cookie, SESSION_COOKIE));
}

/** Browsers send Origin on POSTs; one that is not our own host is refused (CSRF). */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients still need the session cookie
  try {
    return new URL(origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
}

/**
 * Every delivery API request goes through this first. Returns true when the
 * request may proceed; otherwise it has already sent the refusal.
 */
export function requireSession(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Not signed in.' });
    return false;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    res.status(403).json({ error: 'Cross-site request refused.' });
    return false;
  }
  return true;
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${LIMITS.sessionHours * 3600}${secure}`;
}
export const clearedSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

// ---- login throttling (durable) ----
export async function loginLocked(db) {
  await db.query(`DELETE FROM login_failures WHERE at < now() - ($1 || ' milliseconds')::interval`, [String(LIMITS.loginWindowMs)]);
  const rows = await db.query('SELECT COUNT(*)::int AS n FROM login_failures');
  return rows[0].n >= LIMITS.loginMaxFails;
}
export const recordLoginFailure = (db) => db.query('INSERT INTO login_failures DEFAULT VALUES');
export const resetLoginFailures = (db) => db.query('DELETE FROM login_failures');
