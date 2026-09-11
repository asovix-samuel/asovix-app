// ── Stripe checkout: the single place that decides what is charged ──
//
// PRODUCTS amounts are in cents and must equal lib/offers.js prices (euros).
// Both /api/create-checkout (buttons on the site) and /checkout (one-click
// links in emails) build their sessions here, so they can never charge
// differently.
//
// Every product is fulfilled by hand: Stripe collects the customer's name and
// email, then the order is prepared personally.

export const PRODUCTS = {
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DX_RE = /^dx_[a-z0-9_]{4,40}$/i;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://www.asovix.com';

/**
 * Pure: returns exactly what is passed to stripe.checkout.sessions.create, or
 * null for an unknown product. Kept pure so it can be tested without Stripe.
 *
 * `email` pre-fills Stripe's email field when we already have it (from a
 * diagnosis). `diagnosisId` links the purchase back to its lead; `cvOnFile` is
 * only honoured alongside a valid diagnosis id.
 */
export function buildCheckoutParams({ product, email, diagnosisId, cvOnFile, source, extraMetadata = {} } = {}) {
  const p = PRODUCTS[product];
  if (!p) return null;

  const metadata = { product, ...extraMetadata };
  if (diagnosisId && DX_RE.test(String(diagnosisId))) {
    metadata.diagnosisId = String(diagnosisId);
    if (cvOnFile) metadata.cvOnFile = '1';
  }
  if (source) metadata.source = String(source).slice(0, 60);

  const trimmed = String(email || '').trim();
  const cleanEmail = EMAIL_RE.test(trimmed) ? trimmed.toLowerCase() : null;

  return {
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
    ...(cleanEmail ? { customer_email: cleanEmail } : {}),
    success_url: `${appUrl()}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/?cancelled=true`,
    metadata,
  };
}

export async function createCheckoutSession(stripe, opts) {
  const params = buildCheckoutParams(opts);
  if (!params) {
    const err = new Error('Unknown product');
    err.status = 400;
    throw err;
  }
  return stripe.checkout.sessions.create(params);
}
