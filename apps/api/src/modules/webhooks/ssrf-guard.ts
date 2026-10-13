import { URL } from 'url';
import net from 'net';

/**
 * Validates a target URL against SSRF vulnerabilities:
 * - Ensures protocol is http or https
 * - Rejects private, loopback, link-local, and cloud metadata IP ranges
 */
export class SsrfGuard {
  private static isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      const [a, b] = parts;
      if (a === 0 || a === 127) return true; // 0.0.0.0/8, 127.0.0.0/8
      if (a === 10) return true; // 10.0.0.0/8
      if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true; // 192.168.0.0/16
      if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local / Cloud metadata)
      if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true; // 100.64.0.0/10
      return false;
    }

    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      if (lower.startsWith('fe80:')) return true; // Link-local
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // Unique local
      if (lower.startsWith('::ffff:127.') || lower.startsWith('::ffff:10.') || lower.startsWith('::ffff:192.168.')) {
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Checks whether a target URL is safe for outbound requests.
   * Allows bypassing SSRF check in explicit test mock scenarios if allowed.
   */
  static isSafeUrl(rawUrl: string, allowLocalForTesting = false): { safe: boolean; reason?: string } {
    try {
      const parsed = new URL(rawUrl);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { safe: false, reason: 'Invalid protocol. Only HTTP and HTTPS are permitted.' };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Explicit testing bypass for mock test servers
      if (allowLocalForTesting && (hostname === 'localhost' || hostname === '127.0.0.1')) {
        return { safe: true };
      }

      // Check common loopback & cloud metadata hostnames
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === 'metadata.google.internal' ||
        hostname === 'instance-data'
      ) {
        return { safe: false, reason: 'Target hostname resolves to a restricted internal domain.' };
      }

      // If hostname is directly an IP literal
      if (net.isIP(hostname)) {
        if (this.isPrivateIp(hostname)) {
          return { safe: false, reason: 'Target IP belongs to a restricted internal or private address range.' };
        }
      }

      return { safe: true };
    } catch {
      return { safe: false, reason: 'Malformed URL.' };
    }
  }

  /**
   * Asserts safety or throws an HTTP 400 bad request error.
   */
  static assertSafeUrl(rawUrl: string, allowLocalForTesting = false): void {
    const result = this.isSafeUrl(rawUrl, allowLocalForTesting);
    if (!result.safe) {
      const err = new Error(`SSRF Security Violation: ${result.reason}`);
      Object.assign(err, { statusCode: 400 });
      throw err;
    }
  }
}
