import { describe, it, expect } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  packEncryptedSecret,
  unpackEncryptedSecret,
  maskSecret,
  safeCompareStrings,
} from '../src/utils/crypto-vault.js';

describe('Crypto Vault (AES-256-GCM & Secret Masking)', () => {
  it('encrypts and decrypts a sensitive token losslessly', () => {
    const rawSecret = 'sk-proj-super-secret-production-token-12345';
    const encrypted = encryptSecret(rawSecret);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(rawSecret);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it('rejects tampered ciphertext or altered auth tag', () => {
    const rawSecret = 'meta-system-user-token-987654321';
    const encrypted = encryptSecret(rawSecret);

    // Tamper with ciphertext
    const tampered = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -4) + 'AAAA',
    };

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('packs and unpacks vault string format correctly', () => {
    const secret = 'rzp_live_secret_key_abcdef123456';
    const packed = packEncryptedSecret(encryptSecret(secret));

    expect(packed.startsWith('vault:v1:')).toBe(true);

    const unpacked = unpackEncryptedSecret(packed);
    expect(unpacked).toBe(secret);
  });

  it('masks sensitive tokens showing only the last 4 characters', () => {
    expect(maskSecret('sk-proj-1234567890abcdef')).toBe('••••••••cdef');
    expect(maskSecret('my-secret-key')).toBe('••••••••-key');
    expect(maskSecret('1234')).toBe('••••');
    expect(maskSecret('')).toBe('');
    expect(maskSecret(null)).toBe('');
  });

  it('performs timing-safe string comparison correctly', () => {
    const token = 'whsec_random_webhook_verification_token';
    expect(safeCompareStrings(token, token)).toBe(true);
    expect(safeCompareStrings(token, token + 'x')).toBe(false);
    expect(safeCompareStrings(token, 'whsec_different_token')).toBe(false);
  });
});
