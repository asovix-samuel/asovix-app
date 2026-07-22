// ── Asovix analytics helper ──
// Single wrapper around gtag so every event goes through one place.
// GA4 property: G-549ET6VHH3
//
// Rules:
//  - Never pass personally identifiable information (names, emails, phones).
//  - Event names follow GA4 recommended events where one exists
//    (generate_lead, begin_checkout, purchase); custom events use snake_case.

export const GA_ID = 'G-549ET6VHH3';

// Safe no-op when gtag isn't loaded (SSR, blockers, consent declined).
export function track(eventName, params = {}) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', eventName, params);
  } catch (e) {
    // Analytics must never break the site.
  }
}

// CTA click — call with a stable snake_case name and where it lives.
// e.g. trackCta('get_interview_ready', 'nav'), trackCta('start_now', 'pricing', 'instant')
export function trackCta(ctaName, ctaLocation, product) {
  const params = { cta_name: ctaName, cta_location: ctaLocation };
  if (product) params.product = product;
  track('cta_click', params);
}

// Checkout start — fired when the user is actually being sent to Stripe.
export function trackBeginCheckout(productId, productName, value) {
  track('begin_checkout', {
    currency: 'EUR',
    value,
    items: [{ item_id: productId, item_name: productName, price: value, quantity: 1 }],
  });
}

// Purchase — ONLY call this with server-verified order data
// (from /api/fulfill, which confirms payment_status === 'paid' with Stripe).
// GA4 deduplicates on transaction_id, and we additionally skip repeat visits.
export function trackPurchase(order) {
  if (!order || !order.transaction_id) return;
  track('purchase', {
    transaction_id: order.transaction_id,
    value: order.value,
    currency: order.currency || 'EUR',
    items: [{
      item_id: order.product,
      item_name: order.product_name || order.product,
      price: order.value,
      quantity: 1,
    }],
  });
}
