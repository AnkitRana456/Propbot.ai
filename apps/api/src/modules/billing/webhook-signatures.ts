import crypto from 'crypto';

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Stripe webhook verification (https://stripe.com/docs/webhooks/signatures):
 * header `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>...]`, where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`).
 * The timestamp tolerance (default 5 min) blocks replay of captured deliveries.
 * `rawBody` MUST be the exact bytes Stripe sent, not re-serialised JSON.
 */
export function verifyStripeSignature(
  rawBody: Buffer | string,
  header: string,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  let timestamp = '';
  const candidates: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map(s => s?.trim());
    if (k === 't' && v) timestamp = v;
    if (k === 'v1' && v) candidates.push(v);
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || candidates.length === 0) return false;
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return candidates.some(c => safeEqualHex(c, expected));
}

/** Razorpay: X-Razorpay-Signature = hex HMAC-SHA256(webhook secret, rawBody). */
export function verifyHmacSha256Hex(rawBody: Buffer | string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(signature, expected);
}
