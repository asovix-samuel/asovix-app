# Asovix — Setup & Deployment Guide

## What this is
A full Next.js web app that:
1. Accepts CV uploads + client brief
2. Takes €15 payment via Stripe
3. Calls Claude API to generate 3 optimised CVs
4. Emails all 3 CVs as .docx files to the client instantly
5. Sends you a notification email on every order

---

## Setup (one-time, ~15 minutes)

### Step 1 — Get your API keys

**Anthropic (Claude):**
- Go to https://console.anthropic.com
- Create an API key
- Copy it

**Stripe:**
- Go to https://dashboard.stripe.com
- Get your Publishable key + Secret key (under Developers → API keys)
- You'll add the Webhook secret in Step 4

**Gmail (for sending emails):**
- Use any Gmail account
- Go to Google Account → Security → 2-Step Verification → App Passwords
- Create an App Password for "Mail"
- Copy the 16-character password

---

### Step 2 — Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Go into the project folder
cd asovix

# Install dependencies
npm install

# Deploy
vercel deploy --prod
```

Vercel will give you a URL like: `https://asovix-xyz.vercel.app`

---

### Step 3 — Add environment variables in Vercel

Go to your Vercel dashboard → Project → Settings → Environment Variables

Add each of these:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `STRIPE_SECRET_KEY` | Your Stripe secret key (sk_live_...) |
| `STRIPE_PUBLISHABLE_KEY` | Your Stripe publishable key (pk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | See Step 4 |
| `SMTP_HOST` | smtp.gmail.com |
| `SMTP_PORT` | 587 |
| `SMTP_USER` | your.gmail@gmail.com |
| `SMTP_PASS` | Your Gmail App Password |
| `OWNER_EMAIL` | Email where you want order notifications |
| `NEXT_PUBLIC_APP_URL` | https://your-vercel-url.vercel.app |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same as STRIPE_PUBLISHABLE_KEY |

After adding all variables, redeploy:
```bash
vercel deploy --prod
```

---

### Step 4 — Set up Stripe webhook

This is what triggers CV generation when someone pays.

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-vercel-url.vercel.app/api/webhook`
4. Select event: `checkout.session.completed`
5. Copy the "Signing secret" that appears
6. Add it as `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
7. Redeploy once more

---

### Step 5 — Test it

1. Go to your Vercel URL
2. Upload a CV (or just skip that step)
3. Fill in the brief
4. On the payment page — use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
5. Check that the emails arrive

---

## Going live

Once testing works:
1. Switch Stripe from Test mode to Live mode
2. Update `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` with your live keys
3. Create a new live webhook endpoint in Stripe (same URL)
4. Update `STRIPE_WEBHOOK_SECRET` with the live signing secret
5. Redeploy

That's it — you're live and taking real payments.

---

## Costs per order

| Service | Cost per CV order |
|---|---|
| Claude API (3 CVs) | ~€0.03–0.06 |
| Stripe fee (€15) | ~€0.74 (2.9% + €0.25) |
| Vercel hosting | Free tier covers ~100k requests/month |
| **Your profit per order** | **~€14.20** |

---

## Customisation

**Change the price:**
Edit `unit_amount: 1500` in `pages/api/create-checkout.js`
(amount is in cents — 1500 = €15.00)

**Change the email from name:**
Edit `"Asovix" <${process.env.SMTP_USER}>` in `lib/email.js`

**Change Samuel's notification email:**
Set `OWNER_EMAIL` environment variable

**Update the Asovix system prompt:**
Edit `lib/prompts.js` — the `ASOVIX_SYSTEM_PROMPT` constant

---

## Support

If anything breaks, the most likely culprits are:
1. Webhook secret mismatch — regenerate it in Stripe
2. Gmail App Password expired — create a new one
3. Vercel function timeout — the webhook has 60s, should be enough

For Claude API errors — check https://console.anthropic.com for usage/limits.

---

## Fixes applied (July 2026)

1. **Webhook now uses `waitUntil`** (`@vercel/functions`) — previously CV generation ran after the response was sent, so Vercel froze the function and CVs were never generated or emailed.
2. **Full CV text now reaches the AI** — CV + job description are chunked across multiple Stripe metadata keys instead of being cut to 450 characters.
3. **Model updated to `claude-sonnet-5`**, max_tokens raised to 8000 (3 full CVs no longer truncated).
4. **Copy generalized** — CV descriptions in the email, success page, and payment page are no longer hardcoded to finance roles; each customer's 3 CVs are titled dynamically (Primary Target / Adjacent Opportunity / Broader Positioning).
5. **Failure alerts** — if an order fails after payment, Samuel gets an urgent email with the full brief + CV text to deliver manually.
6. **`/api/health`** — visit this URL on the deployed app to see which environment variables are SET vs MISSING and whether Stripe is in TEST or LIVE mode.
