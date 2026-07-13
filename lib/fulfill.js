import Anthropic from '@anthropic-ai/sdk';
import { generateDocxBuffers } from './docxGenerator';
import { sendCVsToClient, notifyOwner, notifyOwnerFailure } from './email';
import { ASOVIX_SYSTEM_PROMPT, ASOVIX_USER_PROMPT } from './prompts';

// Reassemble text that create-checkout.js chunked across metadata keys
export function unchunkMeta(meta, prefix) {
  const n = parseInt(meta[`${prefix}_n`] || '0', 10);
  let out = '';
  for (let i = 0; i < n; i++) out += meta[`${prefix}_${i}`] || '';
  return out;
}

/**
 * Fulfill a paid order: generate 3 CVs and email them.
 * Idempotent — uses the payment intent's metadata as a "already fulfilled"
 * flag so the success page and the webhook can never double-send.
 * Returns: 'done' | 'already' | 'failed'
 */
export async function fulfillOrder(stripe, session) {
  const meta = session.metadata || {};
  const clientName = meta.clientName || 'Client';
  const clientEmail = meta.clientEmail || session.customer_email;

  if (!clientEmail) {
    console.error('fulfill: no client email on session', session.id);
    return 'failed';
  }

  // ── Idempotency claim ──
  const piId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;

  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.metadata && pi.metadata.asovix_fulfilled === 'true') {
      console.log('fulfill: already fulfilled', session.id);
      return 'already';
    }
    await stripe.paymentIntents.update(piId, {
      metadata: { asovix_fulfilled: 'true' },
    });
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
      messages: [{ role: 'user', content: ASOVIX_USER_PROMPT(brief, cvText, jd) }],
    });

    const claudeOutput = message.content[0]?.text || '';

    if (!claudeOutput || !claudeOutput.includes('===CV')) {
      throw new Error('Model output missing CV markers: ' + claudeOutput.substring(0, 200));
    }

    const { buf1, buf2, buf3, titles } = await generateDocxBuffers(claudeOutput);
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');

    await sendCVsToClient({
      clientEmail, clientName,
      cv1Buf: buf1, cv2Buf: buf2, cv3Buf: buf3,
      safeName, titles,
    });

    await notifyOwner({
      clientName, clientEmail,
      amount: (session.amount_total / 100).toFixed(2),
      target: meta.target || 'Not specified',
      location: meta.location || 'UK',
    });

    console.log(`fulfill: order complete for ${clientName} (${session.id})`);
    return 'done';
  } catch (err) {
    console.error('fulfill: order processing error:', err);
    try {
      await notifyOwnerFailure({
        clientName, clientEmail,
        sessionId: session.id,
        errorMessage: err.message || String(err),
        brief, cvText, jd,
      });
    } catch (e2) {
      console.error('fulfill: failed to send failure alert:', e2);
    }
    return 'failed';
  }
}
