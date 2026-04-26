import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { name, email, role, target, location, challenge, jd, cvText } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Asovix CV Optimisation — 3 Tailored CVs',
            description: 'Finance / Analyst · Paraplanner / Advisory · Sales / Consultancy — UK market positioned, ATS optimised',
            images: [],
          },
          unit_amount: 1500, // €15.00 in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?cancelled=true`,
      metadata: {
        clientName: name,
        clientEmail: email,
        role: role || '',
        target: target || '',
        location: location || 'UK',
        challenge: (challenge || '').substring(0, 500),
        jd: (jd || '').substring(0, 1000),
        cvText: (cvText || '').substring(0, 3000),
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}
