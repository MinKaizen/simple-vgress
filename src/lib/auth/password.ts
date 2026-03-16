import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hash a password using scrypt (built-in to Node.js, no external dependencies)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  
  const hashBuffer = Buffer.from(hash, 'hex');
  const suppliedHashBuffer = scryptSync(password, salt, 64);
  
  return timingSafeEqual(hashBuffer, suppliedHashBuffer);
}

/**
 * Generate a unique user ID
 */
export function generateUserId(): string {
  return randomBytes(16).toString('hex');
}
