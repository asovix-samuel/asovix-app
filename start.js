import Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { fulfillOrder } from '../../lib/fulfill';

// BACKUP delivery path only. The success page (/api/fulfill) is the
// primary path and needs no webhook config. If this webhook also fires,
// the idempotency flag in fulfillOrder prevents double-sending.
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Not fatal for the business: the success page fulfils orders directly.
    console.error('Webhook signature failed (backup path only):', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    waitUntil(fulfillOrder(stripe, event.data.object));
  }

  res.status(200).json({ received: true });
}
