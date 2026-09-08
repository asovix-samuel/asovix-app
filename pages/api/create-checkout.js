import Stripe from 'stripe';

// ── Product catalogue ──
// Amounts are in cents. Every product is fulfilled by hand: Stripe collects the
// customer's name and email, then the order is prepared personally.
const PRODUCTS = {
  focused_cv: {
    amount: 4500,
    name: 'Asovix — Focused CV',
    description: 'A single-page CV for entry-level, part-time or in-person roles.',
    manual: true,
  },
  cv_positioning: {
    amount: 6500,
    name: 'Asovix — CV Positioning',
    description: 'Full evidence extraction and positioning for career-level roles.',
    manual: true,
  },
  linkedin: {
    amount: 5500,
    name: 'Asovix — LinkedIn Positioning',
    description: 'Your profile rebuilt around how recruiters search, filter and read.',
    manual: true,
  },
  cover_letter: {
    amount: 2500,
    name: 'Asovix — Cover Letter (add-on)',
    description: 'Add-on to a CV Positioning or bundle order. Not sold on its own.',
    manual: true,
  },
  interview_prep: {
    amount: 8500,
    name: 'Asovix — Interview Preparation',
    description: 'A tailored mock interview plus structured, evidence-based feedback.',
    manual: true,
  },
  cv_linkedin: {
    amount: 11000,
    name: 'Asovix — CV + LinkedIn',
    description: 'CV Positioning and LinkedIn Positioning, working as one story.',
    manual: true,
  },
  cv_linkedin_letter: {
    amount: 14500,
    name: 'Asovix — CV + LinkedIn + Cover Letter',
    description: 'CV Positioning, LinkedIn Positioning and a tailored cover letter.',
    manual: true,
  },
  full_package: {
    amount: 22500,
    name: 'Asovix — Full Career Positioning Package',
    description: 'CV, LinkedIn, cover letter and interview preparation together.',
    manual: true,
  },
  revision_fee: {
    amount: 1500,
    name: 'Asovix — Additional Revision',
    description: 'A further minor revision, or a minor revision requested more than 7 days after delivery.',
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
  const { product = 'cv_positioning', name, email, phone, role, target, location, challenge, jd, cvText } = req.body || {};

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