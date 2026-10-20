import { ApiError } from '../../utils/api-error.js';

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

type Param = string | number | boolean | undefined | null;

/** Stripe's API takes form-encoded bodies; nested keys are written by the caller as `a[b][c]`. */
export async function stripeRequest<T = Record<string, unknown>>(
  method: 'POST' | 'GET' | 'DELETE',
  path: string,
  params: Record<string, Param> = {},
  idempotencyKey?: string,
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'Stripe is not configured (STRIPE_SECRET_KEY missing).');
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.append(k, String(v));
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: method === 'GET' ? undefined : body,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', json.error?.message ?? `Stripe answered HTTP ${res.status}.`);
  return json;
}
