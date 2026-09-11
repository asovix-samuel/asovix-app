import Stripe from 'stripe';
import { PRODUCTS, createCheckoutSession } from '../lib/checkout';

// One-click checkout for links in emails:
//   /checkout?product=cv_positioning&dx=dx_abc123&cv=1
// Creates a Stripe session server-side and redirects straight to it.
//
// Nothing personal travels in the URL: `dx` is an opaque diagnosis reference
// and Stripe collects the email itself. Not indexable, and disallowed in
// robots.txt. Anything invalid falls back to the pricing section.
export async function getServerSideProps({ query, res }) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const product = String(query.product || '');
  if (!PRODUCTS[product]) {
    return { redirect: { destination: '/#pricing', permanent: false } };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await createCheckoutSession(stripe, {
      product,
      diagnosisId: query.dx,
      cvOnFile: query.cv === '1',
      source: 'diagnosis_email',
    });
    return { redirect: { destination: session.url, permanent: false } };
  } catch (err) {
    console.error('checkout link failed:', err);
    return { redirect: { destination: '/#pricing', permanent: false } };
  }
}

export default function Checkout() {
  return null;
}
