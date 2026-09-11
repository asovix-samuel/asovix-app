import Stripe from 'stripe';
import { PRODUCTS, createCheckoutSession } from '../../lib/checkout';

// The product catalogue and session building live in lib/checkout.js, shared
// with the /checkout links used in emails, so both paths always charge the same.

// Stripe metadata: max 50 keys, 500 chars per value — chunk long text.
const CHUNK_SIZE = 450;
function chunkIntoMeta(meta, prefix, text, maxChunks) {
  const t = (text || '').substring(0, maxChunks * CHUNK_SIZE);
  let count = 0;
  for (let i = 0; i * CHUNK_SIZE < t.length && i < maxChunks; i++) {
    meta[`${prefix}_${i}`] = t.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    count++;
  }
  meta[`${prefix}_n`] = String(count);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const {
    product = 'cv_positioning', name, email, phone, role, target, location, challenge, jd, cvText,
    diagnosisId, cvOnFile,
  } = req.body || {};

  const p = PRODUCTS[product];
  if (!p) return res.status(400).json({ error: 'Unknown product' });

  // The instant product needs the brief; manual products only need payment —
  // Stripe checkout collects the customer's email and name itself.
  if (!p.manual && (!email || !name)) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const extraMetadata = {};

    if (!p.manual) {
      extraMetadata.clientName = name;
      extraMetadata.clientEmail = email;
      extraMetadata.phone = (phone || '').substring(0, 100);
      extraMetadata.role = (role || '').substring(0, 450);
      extraMetadata.target = (target || '').substring(0, 450);
      extraMetadata.location = location || 'UK';
      extraMetadata.challenge = (challenge || '').substring(0, 450);
      chunkIntoMeta(extraMetadata, 'cv', cvText, 13);
      chunkIntoMeta(extraMetadata, 'jd', jd, 6);
    }

    const session = await createCheckoutSession(stripe, {
      product,
      email,
      diagnosisId,
      cvOnFile: !!cvOnFile,
      source: diagnosisId ? 'diagnosis' : 'site',
      extraMetadata,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
}
