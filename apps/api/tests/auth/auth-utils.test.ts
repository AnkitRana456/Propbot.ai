import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  generateRandomToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/modules/auth/auth.utils.js';

describe('Auth Cryptography & Token Utilities', () => {
  it('hashes passwords securely and verifies correctly', async () => {
    const rawPassword = 'SecurePassword123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const matches = await comparePassword(rawPassword, hash);
    expect(matches).toBe(true);

    const wrongMatches = await comparePassword('WrongPassword123!', hash);
    expect(wrongMatches).toBe(false);
  }, 15000);

  it('generates random hex tokens and computes deterministic SHA-256 hashes', () => {
    const token = generateRandomToken(32);
    expect(token).toHaveLength(64); // 32 bytes in hex = 64 chars

    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it('signs and verifies JWT access tokens', () => {
    const payload = {
      sub: 'b561c28c-9892-4f9e-bc43-b1d5c7f8a123',
      companyId: 'd712e49c-1234-4a5b-9c8d-e1f2a3b4c5d6',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'company_admin' as const,
      status: 'active' as const,
    };

    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.companyId).toBe(payload.companyId);
    expect(decoded.role).toBe('company_admin');
    expect(decoded.status).toBe('active');
    expect(decoded.type).toBe('access');
  });

  it('rejects tampered JWT tokens', () => {
    const token = signAccessToken({
      sub: 'user-1',
      companyId: 'comp-1',
      email: 'test@example.com',
      name: 'Test',
      role: 'agent' as const,
      status: 'active' as const,
    });

    const tampered = token.slice(0, -5) + 'abcde';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
