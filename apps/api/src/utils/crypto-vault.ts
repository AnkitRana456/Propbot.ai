import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a consistent 32-byte Buffer key from the environment ENCRYPTION_KEY.
 * If the key is not set or malformed, generates a deterministic fallback for non-production environments.
 */
function getMasterKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production environment (minimum 32 bytes).');
    }
    // Deterministic 32-byte key for local development fallback
    return crypto.createHash('sha256').update('propbot_default_dev_encryption_key_32_bytes!').digest();
  }

  // If already a 64-char hex string, decode directly
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // Otherwise, hash to standard 32 bytes
  return crypto.createHash('sha256').update(rawKey).digest();
}

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string; // Base64
  tag: string; // Base64
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a randomized IV.
 */
export function encryptSecret(plaintext: string): EncryptedPayload {
  if (!plaintext) {
    return { ciphertext: '', iv: '', tag: '' };
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypts an EncryptedPayload. Throws an error if ciphertext or authentication tag is tampered with.
 */
export function decryptSecret(payload: EncryptedPayload): string {
  if (!payload.ciphertext || !payload.iv || !payload.tag) {
    return '';
  }

  const key = getMasterKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(payload.ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Serializes an EncryptedPayload to a single compact vault string:
 * "vault:v1:<iv>:<tag>:<ciphertext>"
 */
export function packEncryptedSecret(payload: EncryptedPayload): string {
  if (!payload.ciphertext) return '';
  return `vault:v1:${payload.iv}:${payload.tag}:${payload.ciphertext}`;
}

/**
 * Deserializes and decrypts a compact vault string.
 */
export function unpackEncryptedSecret(packed: string): string {
  if (!packed) return '';
  if (!packed.startsWith('vault:v1:')) {
    // If not a vault string, it might be raw unencrypted legacy value
    return packed;
  }

  const parts = packed.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid vault secret format');
  }

  const [, , iv, tag, ciphertext] = parts;
  return decryptSecret({ iv: iv!, tag: tag!, ciphertext: ciphertext! });
}

/**
 * Masks a secret string showing only the last 4 characters.
 * Example: "sk-proj-1234567890abcdef" -> "••••••••cdef"
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 4) {
    return '••••';
  }
  const last4 = trimmed.slice(-4);
  return `••••••••${last4}`;
}

/**
 * Safe constant-time string comparison to prevent timing attacks on webhook signatures.
 */
export function safeCompareStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Encrypts a secret for storage (vault:v1:...). Empty stays null; already sealed values are kept as they are. */
export function sealSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('vault:v1:')) return value;
  return packEncryptedSecret(encryptSecret(value));
}

/** Reads a stored secret, sealed or legacy plain text. */
export function openSecret(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return unpackEncryptedSecret(value) || undefined;
}
