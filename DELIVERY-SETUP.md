# Delivery workspace: setup (private, for Samuel only)

The delivery workspace lives at **asovix.com/delivery**. It is invisible to the public: it needs a
password, is never listed in the sitemap, and tells search engines and analytics to stay out.

It adds three things the website did not have before: a **database**, **private file storage** and a
**login**. Nothing about checkout, the diagnosis form or the confirmation emails changes.

## What it does in this first stage

1. You add a candidate: original CV (PDF or Word), target role, location, goal, package, and anything the client already told you.
2. It reads the whole CV (every page, tables, text boxes, headers) and builds:
   - a structured candidate record,
   - an evidence ledger: each claim beside its exact source (file, page, section), marked
     *source-documented*, *client-confirmed*, *needs confirmation* or *unsupported*,
   - contradictions, conflicting dates, template leftovers and missing essentials,
   - a short list of questions you can edit.
3. You record the client's answers and press **Continue analysis**. It picks up where it left off.

Stage 1 never emails clients. Writing and delivery are stage 2, below.

## Stage 2: writing, review and delivery

When a candidate is **Ready for positioning**, open them and use the **Deliverables** tab:

1. *(Optional)* paste the job ad they are targeting (clients can also paste one on the intake page). It sharpens the positioning and is required for a cover letter addressed to a named company.
2. Press **Write drafts**. It writes exactly what the package includes (Focused CV and CV Positioning: CV; LinkedIn: profile; bundles: CV, LinkedIn and cover letter; Full package also gets an **interview prep brief for you**, which is never emailed).
3. Every line cites the evidence it rests on (hover the `e1` tags). Code then checks each draft:
   - **red (blocks approval):** a figure not in the cited evidence, evidence or roles that do not exist, a skill not written anywhere, generic phrases ("team player", "responsible for"...), a cover letter naming a company that is not in the job ad;
   - **amber (your judgement):** a team result that reads like a solo one, evidence still awaiting the client's confirmation, too long for one page.
   Names, employers, job titles, dates and education always come from the verified record, never from the AI.
4. Edit anything in place and **Save edits** (checks run again). **Approve** each document. You can choose **Approve anyway** for red items you have checked yourself.
5. When every client document is approved, check the email and press **Send to client**. It sends branded Word files from your SMTP account, once. A double click can never send twice, and a failed send leaves nothing marked as sent.
6. For revisions, paste the client's reply and press **Write revision**. It writes a new version from the last one plus their feedback, and shows how many free rounds are left (one, or two for bundles, within 7 days).

**Settings needed to send:** `SMTP_USER` and `SMTP_PASS` (already used by the site's emails). Without them you can still download the .docx files and send them yourself.

## One-time setup (about 20 minutes)

### 1. Create the database and file storage (Supabase, free plan)
1. Go to supabase.com and create an account, then **New project**.
2. Choose a region in the EU (Ireland or Frankfurt). Pick any database password and save it somewhere safe.
3. When the project is ready, open **Project Settings → API** and copy:
   - the **Project URL** → this is `SUPABASE_URL`
   - the **service_role** key → this is `SUPABASE_SERVICE_ROLE_KEY` (keep it secret; it is never shown to anyone visiting the site)
4. Open **Project Settings → Database → Connection string**, choose **Transaction pooler**, copy it and replace
   `[YOUR-PASSWORD]` with your database password → this is `DATABASE_URL`.

The CV storage area (called a bucket) is created automatically, and it is always **private**.

### 2. Choose your sign-in password
On this computer, in the `asovix-app` folder, run:

```
npm run delivery:set-password
```

It asks for a password (12+ characters) and prints two lines: `DELIVERY_PASSWORD_HASH=…` and
`DELIVERY_SESSION_SECRET=…`. Your password itself is never saved, only a scrambled version.

### 3. Add the settings to Vercel
Vercel → your project → **Settings → Environment Variables**. Add these (all environments):

| Name | Value |
|---|---|
| `DATABASE_URL` | from step 1.4 |
| `SUPABASE_URL` | from step 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 1.3 |
| `DELIVERY_PASSWORD_HASH` | from step 2 |
| `DELIVERY_SESSION_SECRET` | from step 2 |

These already exist and are reused: `ANTHROPIC_API_KEY` (the AI), `STRIPE_SECRET_KEY` (checks that an order is really paid).

Optional, to see what each analysis costs: `ANTHROPIC_PRICE_INPUT_PER_1M` and `ANTHROPIC_PRICE_OUTPUT_PER_1M`
(dollars per million tokens, from Anthropic's pricing page). Optional: `ANTHROPIC_MODEL` (defaults to `claude-sonnet-5`, the model the site already uses).

### 4. Upload the files
Upload the prepared folder to GitHub with **Add file → Upload files** (drag the folder in). Vercel redeploys in about two minutes.
Then open `asovix.com/delivery`.

## How it keeps its promises

- **Private:** every page and every request checks your signed login. CV files have no web address; they are
  only served to you through a signed-in download that checks the file belongs to that candidate.
- **Durable:** candidates, evidence, questions and answers are saved in the database; originals in the private bucket.
- **Resumable:** each step is saved. If the AI times out or fails, **Resume** carries on from the last saved step
  without paying for the finished steps again. Answers you add are kept and used in the next run. Each identical input
  can be tried at most 3 times, so it can never loop or double-charge.
- **No double processing:** the same form submitted twice, or Continue pressed twice, runs once.
- **Paid means paid:** an order shows "Paid" only if Stripe confirms it right now. Otherwise it shows "not verified".
  Stripe's `asovix_fulfilled` flag only means the website's confirmation emails were handled; it is shown as that and
  is never treated as proof the career work is done.
- **No invented facts:** every claim must quote the client's own text, and every figure in a claim must appear in that
  quote. Anything else is shown as *unsupported*. A result written as "we" is never presented as the client's own.

## Good to know

- **Vercel function limit:** the free (Hobby) plan allows 12 serverless functions. The site now uses exactly 12 (the
  workspace adds 2). If a deploy ever complains about the limit, that is the reason.
- **GDPR:** the delivery workspace stores CVs, unlike the diagnosis form. Update the privacy notice to say how long
  originals are kept before using this with real clients, and delete a candidate's records and file when asked.
- **Scanned CVs:** a CV that is only a picture cannot be read. The workspace says so; ask the client for a Word or text-based PDF.
- **Private/test:** use *Manual test record* on the New candidate form for practice runs. It is labelled TEST and never shown as paid.

## Run it on this computer (optional)

```
npm install
npm run delivery:set-password
npm run dev
```
Open http://localhost:3000/delivery. With no `DATABASE_URL`, it keeps its data in a local `.delivery-data` folder
(ignored by git) so you can try it without any online account. `npm test` runs the automated checks.
