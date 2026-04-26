import Stripe from 'stripe';
import Anthropic from '@anthropic-ai/sdk';
import { generateDocxBuffers } from '../../lib/docxGenerator';
import { sendCVsToClient, notifyOwner } from '../../lib/email';
import { ASOVIX_SYSTEM_PROMPT, ASOVIX_USER_PROMPT } from '../../lib/prompts';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ received: true });
  }

  const meta = session.metadata || {};
  const clientName = meta.clientName || 'Client';
  const clientEmail = meta.clientEmail || session.customer_email;

  console.log(`Processing order for ${clientName} (${clientEmail})`);

  try {
    // ── 1. Generate CVs with Claude ──────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const brief = {
      name: clientName,
      email: clientEmail,
      role: meta.role || '',
      target: meta.target || '',
      location: meta.location || 'UK',
      challenge: meta.challenge || '',
    };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: ASOVIX_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: ASOVIX_USER_PROMPT(brief, meta.cvText || '', meta.jd || ''),
      }],
    });

    const claudeOutput = message.content[0]?.text || '';

    if (!claudeOutput || !claudeOutput.includes('===CV')) {
      throw new Error('Claude did not return expected CV format');
    }

    // ── 2. Build .docx files ─────────────────────────────────────
    const { buf1, buf2, buf3 } = await generateDocxBuffers(claudeOutput);

    // ── 3. Email CVs to client ───────────────────────────────────
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
    await sendCVsToClient({
      clientEmail,
      clientName,
      cv1Buf: buf1,
      cv2Buf: buf2,
      cv3Buf: buf3,
      safeName,
    });

    // ── 4. Notify Samuel ─────────────────────────────────────────
    await notifyOwner({
      clientName,
      clientEmail,
      amount: (session.amount_total / 100).toFixed(2),
      target: meta.target || 'Not specified',
      location: meta.location || 'UK',
    });

    console.log(`Order complete for ${clientName}`);
    res.status(200).json({ success: true });

  } catch (err) {
    console.error('Order processing error:', err);
    // Still return 200 to Stripe so it doesn't retry endlessly
    // But log the error for manual follow-up
    res.status(200).json({ received: true, error: err.message });
  }
}
