// ── Private file storage for original CVs ──
//
// Unlike the public diagnosis form (CVs are only emailed, never stored), the
// delivery workspace keeps the original so work can resume later. Files are:
//   - kept in a PRIVATE bucket (never public, never given a URL),
//   - named by random ids under the candidate's own folder,
//   - only served through an authenticated API route that first checks the
//     document belongs to the candidate in the request.
//
// Production: Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, server-side only).
// Local development with those unset: files under .delivery-data/files/.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isProd } from './config.js';

const ID = /^[0-9a-f-]{36}$/i;
const NAME = /^[0-9a-f-]{36}\.(pdf|docx)$/i;

function key(candidateId, storageName) {
  if (!ID.test(candidateId) || !NAME.test(storageName)) throw new Error('Invalid storage path');
  return `${candidateId}/${storageName}`;
}

export function storageNameFor(documentId, ext) {
  if (!ID.test(documentId) || !['pdf', 'docx'].includes(ext)) throw new Error('Invalid document id');
  return `${documentId}.${ext}`;
}

const bucket = () => process.env.DELIVERY_BUCKET || 'candidate-cvs';
const supa = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? { url: process.env.SUPABASE_URL.replace(/\/$/, ''), token: process.env.SUPABASE_SERVICE_ROLE_KEY }
  : null);

export function storageKind() {
  if (supa()) return 'supabase';
  if (!isProd()) return 'local';
  return 'none';
}

async function supaFetch(path, init = {}) {
  const s = supa();
  return fetch(`${s.url}/storage/v1/${path}`, {
    ...init,
    // New-style secret keys (sb_secret_...) are not JWTs and go in apikey only; legacy service_role keys are JWTs and also go in Authorization.
    headers: { apikey: s.token, ...(s.token.startsWith('sb_') ? {} : { Authorization: `Bearer ${s.token}` }), ...(init.headers || {}) },
  });
}

async function ensureBucket() {
  const res = await supaFetch('bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: bucket(), name: bucket(), public: false }), // private, always
  });
  if (!res.ok && res.status !== 409 && !/already exists/i.test(await res.text())) {
    throw new Error('Could not create the private CV bucket in Supabase.');
  }
}

export async function saveFile(candidateId, storageName, bytes) {
  const k = key(candidateId, storageName);
  const kind = storageKind();
  if (kind === 'none') throw new Error('File storage is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see DELIVERY-SETUP.md).');
  if (kind === 'local') {
    const file = resolve(join(process.env.DELIVERY_LOCAL_FILES || './.delivery-data/files', k));
    await mkdir(resolve(file, '..'), { recursive: true });
    await writeFile(file, bytes, { flag: 'wx' });
    return;
  }
  const put = () => supaFetch(`object/${bucket()}/${k}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
  let res = await put();
  if (res.status === 404 || res.status === 400) {
    const msg = await res.clone().text();
    if (/bucket/i.test(msg)) { await ensureBucket(); res = await put(); }
  }
  if (!res.ok) throw new Error(`File storage refused the upload (${res.status}).`);
}

export async function loadFile(candidateId, storageName) {
  const k = key(candidateId, storageName);
  const kind = storageKind();
  if (kind === 'none') throw new Error('File storage is not configured.');
  if (kind === 'local') {
    return new Uint8Array(await readFile(resolve(join(process.env.DELIVERY_LOCAL_FILES || './.delivery-data/files', k))));
  }
  const res = await supaFetch(`object/authenticated/${bucket()}/${k}`);
  if (!res.ok) throw new Error(`The stored file could not be read (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function deleteFile(candidateId, storageName) {
  const k = key(candidateId, storageName);
  const kind = storageKind();
  if (kind === 'local') {
    await rm(resolve(join(process.env.DELIVERY_LOCAL_FILES || './.delivery-data/files', k)), { force: true });
  } else if (kind === 'supabase') {
    await supaFetch(`object/${bucket()}/${k}`, { method: 'DELETE' });
  }
}
