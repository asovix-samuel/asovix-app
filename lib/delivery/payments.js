// An order is only "paid" if Stripe says so, asked server-side with the secret key,
// the same check the website's webhook uses (payment_status === 'paid'). Anything we
// cannot confirm is stored as "not verified" and never shown as paid.
import { PACKAGES } from "./config.js";
import { PAYPAL_ORDER_ID, getOrder, paypalConfigured, toSession } from "../paypal.js";
export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
class StripeLookup {
    async retrieve(sessionId) {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const s = await stripe.checkout.sessions.retrieve(sessionId);
        // asovix_fulfilled only records that the website's confirmation and owner-alert emails were handled.
        // It is shown for information and is never used as proof that any deliverable is done.
        let flag = null;
        const piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
        if (piId) {
            try {
                const pi = await stripe.paymentIntents.retrieve(piId);
                flag = (pi.metadata && pi.metadata.asovix_fulfilled) || "not set";
            } catch (e) { /* informational only */ }
        }
        return {
            confirmation_flag: flag,
            id: s.id,
            payment_status: s.payment_status,
            livemode: s.livemode,
            amount_total: s.amount_total,
            currency: s.currency,
            customer_email: s.customer_details?.email ?? s.customer_email ?? null,
            product: (s.metadata && s.metadata.product) || null,
        };
    }
}
class PayPalLookup {
    async retrieve(orderId) {
        const order = await getOrder(orderId);
        if (!order)
            return null;
        const s = toSession(order);
        return { confirmation_flag: null, id: s.id, payment_status: s.payment_status, livemode: s.livemode, amount_total: s.amount_total, currency: s.currency, customer_email: s.customer_email, product: s.metadata.product || null };
    }
}
let lookupOverride = null;
export function setPaymentLookupForTests(l) {
    lookupOverride = l;
}
export async function verifyStripeSession(sessionId) {
    const isPayPal = PAYPAL_ORDER_ID.test(sessionId) && !SESSION_ID.test(sessionId);
    const who = isPayPal ? "PayPal" : "Stripe";
    const base = { provider: isPayPal ? "paypal" : "stripe", stripeSessionId: sessionId, package: null, amountCents: null, currency: null, customerEmail: null, confirmationFlag: null };
    if (!SESSION_ID.test(sessionId) && !PAYPAL_ORDER_ID.test(sessionId)) {
        return { ...base, paymentStatus: "not_verified", note: "That does not look like a payment reference (a Stripe session id starts with cs_live_ or cs_test_; a PayPal order id is letters and numbers)." };
    }
    if (!lookupOverride && (isPayPal ? !paypalConfigured() : !process.env.STRIPE_SECRET_KEY)) {
        return { ...base, paymentStatus: "not_verified", note: `${isPayPal ? "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are" : "STRIPE_SECRET_KEY is"} not set here, so payment could not be checked. Saved as NOT verified.` };
    }
    try {
        const s = await (lookupOverride ?? (isPayPal ? new PayPalLookup() : new StripeLookup())).retrieve(sessionId);
        if (!s)
            return { ...base, paymentStatus: "not_verified", note: `${who} has no payment with that id.` };
        const info = {
            ...base,
            package: s.product && PACKAGES[s.product] ? s.product : null,
            amountCents: s.amount_total,
            currency: s.currency,
            customerEmail: s.customer_email,
            confirmationFlag: s.confirmation_flag == null ? null : (s.confirmation_flag === "true"
                ? "Website confirmation/alert emails: handled (Stripe flag asovix_fulfilled). This is NOT delivery of the career work."
                : "Website confirmation/alert emails: flag not set yet."),
        };
        if (s.payment_status !== "paid")
            return { ...info, paymentStatus: "not_paid", note: `${who} reports this payment as "${s.payment_status}", not paid.` };
        if (!s.livemode)
            return { ...info, paymentStatus: "manual_test", note: `${who} TEST-mode payment. No real money was taken.` };
        return { ...info, paymentStatus: "verified_paid", note: `Payment confirmed with ${who}.` };
    }
    catch (err) {
        return { ...base, paymentStatus: "not_verified", note: `${who} could not be reached or refused the lookup (${err.message.slice(0, 120)}). Saved as NOT verified.` };
    }
}
