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

  res.status(200).json({ received: true });

  if (event.type !== 'checkout.session.completed') return;

  const session = event.data.object;
  const meta = session.metadata || {};
  const clientName = meta.clientName || 'Client';
  const clientEmail = meta.clientEmail || session.customer_email;

  if (!clientEmail) {
    console.error('No client email found');
    return;
  }

  try {
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
      console.error('Claude bad output:', claudeOutput.substring(0, 200));
      return;
    }

    const { buf1, buf2, buf3 } = await generateDocxBuffers(claudeOutput);
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');

    await sendCVsToClient({
      clientEmail,
      clientName,
      cv1Buf: buf1,
      cv2Buf: buf2,
      cv3Buf: buf3,
      safeName,
    });

    await notifyOwner({
      clientName,
      clientEmail,
      amount: (session.amount_total / 100).toFixed(2),
      target: meta.target || 'Not specified',
      location: meta.location || 'UK',
    });

    console.log(`Order complete for ${clientName}`);
  } catch (err) {
    console.error('Order processing error:', err.message);
  }
}
