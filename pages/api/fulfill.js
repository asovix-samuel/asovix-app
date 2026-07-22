import Stripe from 'stripe';
import { fulfillOrder } from '../../lib/fulfill';

// Called by the success page right after Stripe redirects back.
// Verifies the payment DIRECTLY with Stripe (no webhook, no signing
// secret needed), then generates and emails the CVs. Idempotent.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.body || {};
  if (!session_id || typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session id' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const status = await fulfillOrder(stripe, session);

    // Non-PII order facts for the client-side GA4 purchase event.
    const PRODUCT_NAMES = {
      instant: 'Interview-Ready CVs (3 tailored CVs)',
      linkedin: 'CVs + LinkedIn Positioning',
      bundle: 'The Complete Package',
    };
    const productKey = (session.metadata && session.metadata.product) || 'instant';
    return res.status(200).json({
      status,
      order: {
        product: productKey,
        product_name: PRODUCT_NAMES[productKey] || productKey,
        value: (session.amount_total || 0) / 100,
        currency: (session.currency || 'eur').toUpperCase(),
      },
    });
  } catch (err) {
    console.error('fulfill endpoint error:', err);
    return res.status(500).json({ error: 'Fulfilment failed' });
  }
}
