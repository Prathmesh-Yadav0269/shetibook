import crypto from 'crypto';
import argon2 from 'argon2';
import { config } from '../config/index.js';

/**
 * Argon2id password hashing options complying with OWASP recommendations
 */
const ARGON2_OPTIONS: argon2.Options & { type: 2 } = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Server-side pepper for keyed recovery secret hashing
 */
function getRecoveryPepper(): string {
  if (config.isProduction && !process.env.RECOVERY_PEPPER) {
    throw new Error('Fatal: RECOVERY_PEPPER environment variable is strictly required in production.');
  }
  return config.RECOVERY_PEPPER;
}

/**
 * Generates a 128-bit cryptographically secure recovery secret.
 * 16 random bytes = 128 bits of true entropy.
 * Formatted as 8 blocks of 4 hex digits: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 */
export function generateRecoverySecret(): string {
  const hex = crypto.randomBytes(16).toString('hex').toUpperCase();
  const chunks = hex.match(/.{1,4}/g);
  return chunks ? chunks.join('-') : hex;
}

/**
 * Normalizes recovery secret by stripping hyphens, spaces, and non-hex characters
 */
export function normalizeRecoverySecret(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

/**
 * Keyed Argon2id hashing of 128-bit recovery secret with server-side pepper
 */
export async function hashRecoverySecret(secret: string): Promise<string> {
  const normalized = normalizeRecoverySecret(secret);
  const pepper = getRecoveryPepper();
  const keyedPayload = crypto.createHmac('sha256', pepper).update(normalized).digest('hex');
  return argon2.hash(keyedPayload, ARGON2_OPTIONS);
}

/**
 * Verifies recovery secret against stored Argon2id hash using server-side pepper
 */
export async function verifyRecoverySecret(hash: string, secret: string): Promise<boolean> {
  try {
    const normalized = normalizeRecoverySecret(secret);
    const pepper = getRecoveryPepper();
    const keyedPayload = crypto.createHmac('sha256', pepper).update(normalized).digest('hex');
    return await argon2.verify(hash, keyedPayload);
  } catch {
    return false;
  }
}

/**
 * Generates a dummy hash for constant-time mitigation when phone does not exist
 */
let dummyHashCache: string | null = null;
export async function getDummyArgon2Hash(): Promise<string> {
  if (!dummyHashCache) {
    dummyHashCache = await hashPassword('dummy-timing-mitigation-password-secret');
  }
  return dummyHashCache;
}

/**
 * Hashes high-entropy tokens using SHA-256 for secure database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generates a cryptographically secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a cryptographically secure random invitation token
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Normalizes phone number to standard 10-digit format
 */
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}
