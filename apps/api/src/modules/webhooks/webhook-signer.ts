import crypto from 'crypto';

export class WebhookSigner {
  /**
   * Generates a random secure webhook secret token.
   */
  static generateSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Masks secret for client display (e.g. whsec_••••••••1a2b).
   */
  static maskSecret(secret: string): string {
    if (!secret) return '••••••••';
    if (secret.length <= 10) return '••••••••';
    return `${secret.slice(0, 6)}••••••••${secret.slice(-4)}`;
  }

  /**
   * Computes HMAC-SHA256 signature for outbound webhook payload.
   * Format: sha256=<hex> over `${timestamp}.${rawBody}`
   */
  static sign(payload: string | Record<string, unknown>, secret: string, timestamp?: number): {
    signature: string;
    timestamp: number;
    headerValue: string;
  } {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedPayload = `${ts}.${bodyString}`;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedPayload);
    const digest = hmac.digest('hex');

    return {
      signature: digest,
      timestamp: ts,
      headerValue: `sha256=${digest}`,
    };
  }

  /**
   * Verifies incoming webhook signature.
   */
  static verify(
    payload: string | Buffer,
    signatureHeader: string,
    secret: string,
    timestampHeader?: string,
    toleranceSeconds = 300,
  ): boolean {
    if (!signatureHeader) return false;

    // Handle formats like "sha256=abcdef..." or raw hex
    const signature = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7)
      : signatureHeader;

    const bodyString = typeof payload === 'string' ? payload : payload.toString('utf8');
    const signedData = timestampHeader ? `${timestampHeader}.${bodyString}` : bodyString;

    const expectedHmac = crypto.createHmac('sha256', secret);
    expectedHmac.update(signedData);
    const expectedSignature = expectedHmac.digest('hex');

    if (timestampHeader) {
      const ts = parseInt(timestampHeader, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > toleranceSeconds) {
        return false; // Replay attack tolerance exceeded
      }
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
