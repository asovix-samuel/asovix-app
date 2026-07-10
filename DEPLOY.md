# Deploying the new Asovix site — step by step

## 1. Upload the code to GitHub (replaces old files)
1. Go to github.com/asovix-samuel/asovix-app
2. Click **Add file → Upload files**
3. Drag in: the `lib` folder, the `pages` folder, `package.json`, `SETUP.md`, `DEPLOY.md`
4. Scroll down → **Commit changes**
5. Vercel redeploys automatically (~2 min). Check asovix-app.vercel.app

## 2. Verify configuration
Visit **asovix-app.vercel.app/api/health** — every value should say SET.
For anything MISSING: Vercel dashboard → asovix-app → Settings → Environment Variables (see SETUP.md for the list), then Deployments → ⋯ → Redeploy.

## 3. Fix the Stripe webhook
1. dashboard.stripe.com → Developers → Webhooks
2. There should be ONE endpoint: `https://asovix-app.vercel.app/api/webhook` listening for `checkout.session.completed` (delete any others)
3. Click it → Reveal **Signing secret** → copy
4. Vercel → Settings → Environment Variables → set `STRIPE_WEBHOOK_SECRET` to that value → Redeploy

## 4. Test end to end (in Stripe TEST mode)
1. Go through the flow at asovix-app.vercel.app/start
2. Pay with card 4242 4242 4242 4242, any future date, any CVC
3. Confirm: 3 CVs arrive at the customer email, order notification arrives at OWNER_EMAIL
4. Also test the free checklist form on the homepage

## 5. Point asovix.com at the new site
1. Vercel → asovix-app project → Settings → Domains → Add → `asovix.com` (and `www.asovix.com`)
2. Vercel shows DNS records. At your domain registrar (wherever you bought asovix.com):
   - A record: `@` → `76.76.21.21`
   - CNAME record: `www` → `cname.vercel-dns.com`
3. Wait for DNS (minutes to a few hours). Old site disappears, new site is live on asovix.com
4. Update `NEXT_PUBLIC_APP_URL` env var to `https://asovix.com` → Redeploy
5. Update the Stripe webhook endpoint URL to `https://asovix.com/api/webhook` (or add it as a second endpoint) and update the signing secret if it changes

## 6. Go live with real payments
Once test mode works: switch Stripe to Live mode, put live keys in `STRIPE_SECRET_KEY`, create a live webhook (same URL), update `STRIPE_WEBHOOK_SECRET`, Redeploy.

## 7. Clean up
- Delete the duplicate Vercel project `asovix-app-i21o` (its Settings → Delete Project)
- Make the GitHub repo private again if you haven't
