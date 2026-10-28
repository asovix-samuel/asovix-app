import Stripe from 'stripe';
import { fulfillOrder } from '../../lib/fulfill';
import { PAYPAL_ORDER_ID, captureOrder, toSession } from '../../lib/paypal';

// Called by the success page right after Stripe redirects back.
// Verifies the payment DIRECTLY with Stripe (no webhook, no signing
// secret needed), then generates and emails the CVs. Idempotent.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id, order_id } = req.body || {};

  // PayPal: the buyer approved the payment on PayPal's page; the money is only taken when WE capture it here.
  // PayPal refuses a second capture, so a reload or a second tab can never send the emails twice.
  if (order_id) {
    if (typeof order_id !== 'string' || !PAYPAL_ORDER_ID.test(order_id)) return res.status(400).json({ error: 'Invalid order id' });
    try {
      const { order, alreadyCaptured } = await captureOrder(order_id);
      const session = toSession(order);
      const status = alreadyCaptured ? 'already' : await fulfillOrder(null, session);
      return res.status(200).json({
        status,
        order: { product: session.metadata.product, product_name: session.metadata.product, value: session.amount_total / 100, currency: session.currency.toUpperCase() },
        orderId: order_id,
      });
    } catch (err) {
      if (err.status === 402) return res.status(402).json({ error: 'Payment not completed' });
      console.error('fulfill endpoint error (paypal):', err);
      return res.status(500).json({ error: 'Fulfilment failed' });
    }
  }

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
