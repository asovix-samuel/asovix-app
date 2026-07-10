import Stripe from 'stripe';
import Anthropic from '@anthropic-ai/sdk';
import { waitUntil } from '@vercel/functions';
import { generateDocxBuffers } from '../../lib/docxGenerator';
import { sendCVsToClient, notifyOwner, notifyOwnerFailure } from '../../lib/email';
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

// Reassemble text that create-checkout.js chunked across metadata keys
function unchunkMeta(meta, prefix) {
  const n = parseInt(meta[`${prefix}_n`] || '0', 10);
  let out = '';
  for (let i = 0; i < n; i++) out += meta[`${prefix}_${i}`] || '';
  return out;
}

async function processOrder(session) {
  const meta = session.metadata || {};
  const clientName = meta.clientName || 'Client';
  const clientEmail = meta.clientEmail || session.customer_email;

  if (!clientEmail) {
    console.error('No client email found on session', session.id);
    return;
  }

  const brief = {
    name: clientName,
    email: clientEmail,
    phone: meta.phone || '',
    role: meta.role || '',
    target: meta.target || '',
    location: meta.location || 'UK',
    challenge: meta.challenge || '',
  };
  const cvText = unchunkMeta(meta, 'cv');
  const jd = unchunkMeta(meta, 'jd');

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: ASOVIX_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: ASOVIX_USER_PROMPT(brief, cvText, jd),
      }],
    });

    const claudeOutput = message.content[0]?.text || '';

    if (!claudeOutput || !claudeOutput.includes('===CV')) {
      throw new Error('Model output missing CV markers: ' + claudeOutput.substring(0, 200));
    }

    const { buf1, buf2, buf3, titles } = await generateDocxBuffers(claudeOutput);
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');

    await sendCVsToClient({
      clientEmail,
      clientName,
      cv1Buf: buf1,
      cv2Buf: buf2,
      cv3Buf: buf3,
      safeName,
      titles,
    });

    await notifyOwner({
      clientName,
      clientEmail,
      amount: (session.amount_total / 100).toFixed(2),
      target: meta.target || 'Not specified',
      location: meta.location || 'UK',
    });

    console.log(`Order complete for ${clientName} (${session.id})`);
  } catch (err) {
    console.error('Order processing error:', err);
    // Tell Samuel an order FAILED so he can deliver manually — the client already paid.
    try {
      await notifyOwnerFailure({
        clientName,
        clientEmail,
        sessionId: session.id,
        errorMessage: err.message || String(err),
        brief,
        cvText,
        jd,
      });
    } catch (e2) {
      console.error('Failed to send failure alert:', e2);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    // waitUntil keeps the function alive AFTER we respond to Stripe.
    // (Previously the work ran after res.status(200) with nothing keeping
    // the lambda alive — Vercel froze it and CVs were never generated.)
    waitUntil(processOrder(event.data.object));
  }

  res.status(200).json({ received: true });
}
