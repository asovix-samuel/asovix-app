import { waitUntil } from '@vercel/functions';
import { handleDelivery } from '../../../lib/delivery/api';

// Private delivery workspace API (Samuel only). All routing and the sign-in check live in
// lib/delivery/api.js. The body is parsed there, because uploads are multipart.
export const config = { api: { bodyParser: false } };

// Keep background analysis running after the response is sent (same pattern as /api/webhook).
function schedule(promise) {
  try { waitUntil(promise); } catch (e) { /* not on Vercel: the promise simply keeps running */ }
}

export default function handler(req, res) {
  return handleDelivery(req, res, { schedule });
}
