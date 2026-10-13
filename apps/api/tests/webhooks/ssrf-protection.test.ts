import { describe, it, expect } from 'vitest';
import { SsrfGuard } from '../../src/modules/webhooks/ssrf-guard.js';

describe('SSRF Protection Guard', () => {
  it('Rejects localhost and loopback domains', () => {
    expect(SsrfGuard.isSafeUrl('http://localhost:8080/hook').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('http://127.0.0.1:3000/hook').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('http://sub.localhost/api').safe).toBe(false);
  });

  it('Rejects cloud metadata endpoints (AWS, GCP, Azure)', () => {
    expect(SsrfGuard.isSafeUrl('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('http://metadata.google.internal/computeMetadata/v1/').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('http://instance-data/latest/').safe).toBe(false);
  });

  it('Rejects private RFC 1918 IPv4 ranges', () => {
    expect(SsrfGuard.isSafeUrl('http://10.0.0.1/webhook').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('http://172.16.0.1/webhook').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('http://172.31.255.255/webhook').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('http://192.168.1.100/webhook').safe).toBe(false);
  });

  it('Rejects non-HTTP and non-HTTPS protocols', () => {
    expect(SsrfGuard.isSafeUrl('file:///etc/passwd').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('ftp://ftp.example.com/files').safe).toBe(false);
    expect(SsrfGuard.isSafeUrl('gopher://gopher.floodgap.com/').safe).toBe(false);
  });

  it('Allows valid public HTTPS URLs', () => {
    expect(SsrfGuard.isSafeUrl('https://hooks.zapier.com/hooks/catch/123/abc').safe).toBe(true);
    expect(SsrfGuard.isSafeUrl('https://api.hubspot.com/webhooks/v1').safe).toBe(true);
    expect(SsrfGuard.isSafeUrl('https://webhook.site/abcdef-1234').safe).toBe(true);
  });

  it('assertSafeUrl throws statusCode 400 for unsafe destinations', () => {
    expect(() => SsrfGuard.assertSafeUrl('http://169.254.169.254/meta-data')).toThrowError(
      /SSRF Security Violation/,
    );
  });
});
