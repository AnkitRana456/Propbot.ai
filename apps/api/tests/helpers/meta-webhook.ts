import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';

/** App secret used to sign Meta webhook deliveries in tests (also exported to META_APP_SECRET). */
export const META_TEST_APP_SECRET = 'meta_app_secret_for_signed_test_deliveries';

/** POSTs a Meta webhook payload exactly as Meta does: raw JSON body + X-Hub-Signature-256 HMAC. */
export function signedMetaPost(app: Express, payload: unknown, secret = META_TEST_APP_SECRET) {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return request(app)
    .post('/api/webhooks/meta')
    .set('X-Hub-Signature-256', `sha256=${sig}`)
    .set('Content-Type', 'application/json')
    .send(raw);
}
