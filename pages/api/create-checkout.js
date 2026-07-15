import Stripe from 'stripe';

// ── Product catalogue ──
const PRODUCTS = {
  instant: {
    amount: 3900,
    name: 'Asovix — Interview-Ready CVs (3 tailored CVs)',
    description: 'Three tailored, interview-ready CVs delivered to your email within minutes.',
    manual: false,
  },
  linkedin: {
    amount: 6900,
    name: 'Asovix — CVs + LinkedIn Positioning',
    description: '3 tailored CVs delivered in minutes + full LinkedIn overhaul within 24 hours.',
    manual: true,
  },
  bundle: {
    amount: 12900,
    name: 'Asovix — The Complete Package',
    description: 'Human-reviewed CV set + LinkedIn overhaul + custom cover letter, within 24 hours.',
    manual: true,
  },
};

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
  const { product = 'instant', name, email, phone, role, target, location, challenge, jd, cvText } = req.body || {};

  const p = PRODUCTS[product];
  if (!p) return res.status(400).json({ error: 'Unknown product' });

  // The instant product needs the brief; manual products only need payment —
  // Stripe checkout collects the customer's email and name itself.
  if (!p.manual && (!email || !name)) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const metadata = { product };

    if (!p.manual) {
      metadata.clientName = name;
      metadata.clientEmail = email;
      metadata.phone = (phone || '').substring(0, 100);
      metadata.role = (role || '').substring(0, 450);
      metadata.target = (target || '').substring(0, 450);
      metadata.location = location || 'UK';
      metadata.challenge = (challenge || '').substring(0, 450);
      chunkIntoMeta(metadata, 'cv', cvText, 13);
      chunkIntoMeta(metadata, 'jd', jd, 6);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: p.name, description: p.description },
          unit_amount: p.amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      ...(p.manual ? {} : { customer_email: email }),
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?cancelled=true`,
      metadata,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}
