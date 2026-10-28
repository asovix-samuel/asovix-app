// Proves the private CV bucket works and is really private. Uses a synthetic file only.
//   node --env-file=.env.local scripts/delivery-check-storage.mjs
import { randomUUID } from 'node:crypto';
import { deleteFile, loadFile, saveFile, storageKind, storageNameFor } from '../lib/delivery/storage.js';

const kind = storageKind();
console.log('storage backend:', kind);
if (kind !== 'supabase') { console.log('Not using Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).'); process.exit(1); }

const candidateId = randomUUID();
const name = storageNameFor(randomUUID(), 'pdf');
const bytes = new TextEncoder().encode('%PDF-1.4 synthetic test file, no real candidate data ' + randomUUID());
const bucket = process.env.DELIVERY_BUCKET || 'candidate-cvs';
const base = process.env.SUPABASE_URL.replace(/\/$/, '');

await saveFile(candidateId, name, bytes);
console.log('upload:            ok');
const back = await loadFile(candidateId, name);
console.log('download (signed in with the server key):', Buffer.compare(Buffer.from(back), Buffer.from(bytes)) === 0 ? 'ok, identical bytes' : 'MISMATCH');

// Anyone on the internet, no key: must NOT be able to read it.
const pub = await fetch(`${base}/storage/v1/object/public/${bucket}/${candidateId}/${name}`);
console.log('public URL, no key: HTTP', pub.status, pub.status === 200 ? '  <-- PUBLIC! BAD' : '(refused, good)');
const anon = await fetch(`${base}/storage/v1/object/${bucket}/${candidateId}/${name}`);
console.log('unauthenticated API: HTTP', anon.status, anon.status === 200 ? '  <-- OPEN! BAD' : '(refused, good)');

const info = await fetch(`${base}/storage/v1/bucket/${bucket}`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, ...(process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY }) } });
const b = await info.json().catch(() => ({}));
console.log('bucket "' + bucket + '" public flag:', b.public === false ? 'false (private, good)' : String(b.public));

await deleteFile(candidateId, name);
let gone = false;
try { await loadFile(candidateId, name); } catch { gone = true; }
console.log('cleanup (test file deleted):', gone ? 'ok' : 'FAILED');
