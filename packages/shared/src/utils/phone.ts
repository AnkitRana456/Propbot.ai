/**
 * Single source of truth for phone validation (API, web app and widget).
 * Spec rules: strip spaces, parentheses, hyphens and dots; keep only digits and a leading "+".
 *  - India (+91): exactly 10 digits, first digit 6-9
 *  - USA/Canada (+1): NANP  ^[2-9]\d{2}[2-9]\d{6}$
 * Other countries are validated by national-number length only (E.164 range), which is
 * deliberately permissive: it rejects obvious garbage without needing a full numbering-plan library.
 */

export interface CountryPhoneRule {
  iso: string;
  name: string;
  dialCode: string; // digits only, no "+"
  min: number; // national number length
  max: number;
  pattern?: RegExp; // tested against the national number
}

export const NANP_PATTERN = /^[2-9]\d{2}[2-9]\d{6}$/;
export const INDIA_PATTERN = /^[6-9]\d{9}$/;

const rule = (
  iso: string,
  name: string,
  dialCode: string,
  min: number,
  max = min,
): CountryPhoneRule => ({ iso, name, dialCode, min, max });

export const COUNTRY_PHONE_RULES: readonly CountryPhoneRule[] = [
  { iso: 'IN', name: 'India', dialCode: '91', min: 10, max: 10, pattern: INDIA_PATTERN },
  { iso: 'US', name: 'United States', dialCode: '1', min: 10, max: 10, pattern: NANP_PATTERN },
  { iso: 'CA', name: 'Canada', dialCode: '1', min: 10, max: 10, pattern: NANP_PATTERN },
  rule('GB', 'United Kingdom', '44', 10, 10),
  rule('AE', 'United Arab Emirates', '971', 9),
  rule('SA', 'Saudi Arabia', '966', 9),
  rule('QA', 'Qatar', '974', 8),
  rule('KW', 'Kuwait', '965', 8),
  rule('BH', 'Bahrain', '973', 8),
  rule('OM', 'Oman', '968', 8),
  rule('SG', 'Singapore', '65', 8),
  rule('MY', 'Malaysia', '60', 9, 10),
  rule('TH', 'Thailand', '66', 9),
  rule('ID', 'Indonesia', '62', 9, 12),
  rule('PH', 'Philippines', '63', 10),
  rule('VN', 'Vietnam', '84', 9, 10),
  rule('HK', 'Hong Kong', '852', 8),
  rule('CN', 'China', '86', 11),
  rule('JP', 'Japan', '81', 10),
  rule('KR', 'South Korea', '82', 9, 10),
  rule('AU', 'Australia', '61', 9),
  rule('NZ', 'New Zealand', '64', 8, 10),
  rule('PK', 'Pakistan', '92', 10),
  rule('BD', 'Bangladesh', '880', 10),
  rule('LK', 'Sri Lanka', '94', 9),
  rule('NP', 'Nepal', '977', 10),
  rule('DE', 'Germany', '49', 10, 11),
  rule('FR', 'France', '33', 9),
  rule('IT', 'Italy', '39', 9, 11),
  rule('ES', 'Spain', '34', 9),
  rule('PT', 'Portugal', '351', 9),
  rule('NL', 'Netherlands', '31', 9),
  rule('BE', 'Belgium', '32', 8, 9),
  rule('CH', 'Switzerland', '41', 9),
  rule('AT', 'Austria', '43', 10, 11),
  rule('SE', 'Sweden', '46', 9),
  rule('NO', 'Norway', '47', 8),
  rule('DK', 'Denmark', '45', 8),
  rule('FI', 'Finland', '358', 9, 10),
  rule('IE', 'Ireland', '353', 9),
  rule('PL', 'Poland', '48', 9),
  rule('RU', 'Russia', '7', 10),
  rule('TR', 'Turkey', '90', 10),
  rule('IL', 'Israel', '972', 9),
  rule('EG', 'Egypt', '20', 10),
  rule('ZA', 'South Africa', '27', 9),
  rule('NG', 'Nigeria', '234', 10),
  rule('KE', 'Kenya', '254', 9),
  rule('BR', 'Brazil', '55', 10, 11),
  rule('MX', 'Mexico', '52', 10),
  rule('AR', 'Argentina', '54', 10),
  rule('CL', 'Chile', '56', 9),
  rule('CO', 'Colombia', '57', 10),
];

export const SUPPORTED_COUNTRY_COUNT = COUNTRY_PHONE_RULES.length;

export type PhoneInvalidReason =
  | 'empty'
  | 'invalid_characters'
  | 'unknown_country_code'
  | 'invalid_length'
  | 'invalid_format';

export interface PhoneValidationResult {
  valid: boolean;
  /** Canonical +<dial><national> form, present when valid. */
  e164?: string;
  country?: string;
  national?: string;
  reason?: PhoneInvalidReason;
}

/** Removes spaces, parentheses, hyphens and dots; keeps digits and a single leading "+". */
export function sanitizePhone(raw: string): string {
  const stripped = (raw ?? '').trim().replace(/[\s().-]/g, '');
  const plus = stripped.startsWith('+') ? '+' : '';
  return plus + stripped.replace(/\D/g, '');
}

function matches(r: CountryPhoneRule, national: string): boolean {
  if (national.length < r.min || national.length > r.max) return false;
  return r.pattern ? r.pattern.test(national) : /^\d+$/.test(national);
}

/**
 * Validates a phone number. Numbers without "+" are interpreted for `defaultCountry`
 * (India by default): a national number, a national number with a trunk "0", or dial code + national.
 */
export function validatePhone(raw: string, defaultCountry = 'IN'): PhoneValidationResult {
  const rawTrimmed = (raw ?? '').trim();
  if (!rawTrimmed) return { valid: false, reason: 'empty' };
  if (/[^\d\s().+-]/.test(rawTrimmed) || rawTrimmed.indexOf('+', 1) !== -1) {
    return { valid: false, reason: 'invalid_characters' };
  }
  const cleaned = sanitizePhone(rawTrimmed);
  if (!cleaned.replace('+', '')) return { valid: false, reason: 'empty' };

  const accept = (r: CountryPhoneRule, national: string): PhoneValidationResult => ({
    valid: true,
    e164: `+${r.dialCode}${national}`,
    country: r.iso,
    national,
  });

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    // Longest dial code first so +971 is not read as +9...
    const candidates = COUNTRY_PHONE_RULES.filter(c => digits.startsWith(c.dialCode)).sort(
      (a, b) => b.dialCode.length - a.dialCode.length,
    );
    if (candidates.length === 0) return { valid: false, reason: 'unknown_country_code' };
    for (const c of candidates) {
      const national = digits.slice(c.dialCode.length);
      if (matches(c, national)) return accept(c, national);
    }
    const best = candidates[0]!;
    const national = digits.slice(best.dialCode.length);
    const lenOk = national.length >= best.min && national.length <= best.max;
    return { valid: false, country: best.iso, reason: lenOk ? 'invalid_format' : 'invalid_length' };
  }

  const home = COUNTRY_PHONE_RULES.find(c => c.iso === defaultCountry) ?? COUNTRY_PHONE_RULES[0]!;
  let national = cleaned;
  if (national.startsWith(home.dialCode) && national.length - home.dialCode.length >= home.min) {
    national = national.slice(home.dialCode.length);
  } else if (national.startsWith('0') && home.iso !== 'US' && home.iso !== 'CA') {
    national = national.slice(1);
  }
  if (matches(home, national)) return accept(home, national);
  const lenOk = national.length >= home.min && national.length <= home.max;
  return { valid: false, country: home.iso, reason: lenOk ? 'invalid_format' : 'invalid_length' };
}

export function isValidPhone(raw: string, defaultCountry = 'IN'): boolean {
  return validatePhone(raw, defaultCountry).valid;
}

/** Valid -> canonical E.164; invalid -> sanitized input unchanged (callers must validate first). */
export function normalizePhoneNumber(raw: string, defaultCountry = 'IN'): string {
  const res = validatePhone(raw, defaultCountry);
  return res.valid && res.e164 ? res.e164 : sanitizePhone(raw);
}
