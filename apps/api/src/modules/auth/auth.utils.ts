import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { UserRole, UserStatus } from '@propbot/shared';

const SALT_ROUNDS = 12;

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_min_32_characters_long_12345';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRATION || '15m';

export interface AccessTokenPayload {
  sub: string;
  companyId: string;
  role: UserRole;
  status: UserStatus;
  email: string;
  name: string;
  type: 'access';
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateRandomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign(
    {
      ...payload,
      type: 'access',
    },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return decoded;
}
