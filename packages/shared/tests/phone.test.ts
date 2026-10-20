import { describe, it, expect } from 'vitest';
import {
  validatePhone,
  sanitizePhone,
  normalizePhoneNumber,
  SUPPORTED_COUNTRY_COUNT,
} from '../src/utils/phone.js';

describe('phone validation (shared)', () => {
  it('sanitizes spaces, parentheses, hyphens and dots', () => {
    expect(sanitizePhone(' +91 (98765) 43210 ')).toBe('+919876543210');
    expect(sanitizePhone('987-654.3210')).toBe('9876543210');
  });

  it('India: exactly 10 digits starting 6-9', () => {
    expect(validatePhone('9876543210').e164).toBe('+919876543210');
    expect(validatePhone('6000000000').valid).toBe(true);
    expect(validatePhone('5876543210').valid).toBe(false); // starts with 5
    expect(validatePhone('987654321').valid).toBe(false); // 9 digits
    expect(validatePhone('98765432101').valid).toBe(false); // 11 digits
    expect(validatePhone('+91 98765 43210').valid).toBe(true);
    expect(validatePhone('919876543210').e164).toBe('+919876543210');
    expect(validatePhone('09876543210').e164).toBe('+919876543210');
  });

  it('USA/Canada: NANP rules', () => {
    expect(validatePhone('+1 (415) 555-2671').e164).toBe('+14155552671');
    expect(validatePhone('+1 (115) 555-2671').valid).toBe(false); // area code starts with 1
    expect(validatePhone('+1 415 155 2671').valid).toBe(false); // exchange starts with 1
    expect(validatePhone('+1 415 555 267').valid).toBe(false);
    expect(validatePhone('4155552671', 'US').e164).toBe('+14155552671');
  });

  it('other countries: dial code + length', () => {
    expect(validatePhone('+44 7911 123456').valid).toBe(true);
    expect(validatePhone('+971 50 123 4567').e164).toBe('+971501234567');
    expect(validatePhone('+971 50 123').valid).toBe(false);
    expect(validatePhone('+999 123456789').reason).toBe('unknown_country_code');
  });

  it('rejects junk', () => {
    expect(validatePhone('').reason).toBe('empty');
    expect(validatePhone('98765abcde').reason).toBe('invalid_characters');
    expect(validatePhone('98+7654321').reason).toBe('invalid_characters');
  });

  it('supports 50+ countries', () => {
    expect(SUPPORTED_COUNTRY_COUNT).toBeGreaterThanOrEqual(50);
  });

  it('normalizePhoneNumber returns E.164 when valid', () => {
    expect(normalizePhoneNumber('98765 43210')).toBe('+919876543210');
  });
});
