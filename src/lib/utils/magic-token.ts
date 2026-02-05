import crypto from 'crypto'

/**
 * Generate a secure random magic token for guest signers
 * @returns A 32-character base64url encoded token
 */
export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Get the expiry date for a magic token (48 hours from now)
 * @returns ISO timestamp string
 */
export function getMagicTokenExpiry(): string {
  const expiryDate = new Date()
  expiryDate.setHours(expiryDate.getHours() + 48)
  return expiryDate.toISOString()
}

/**
 * Check if a magic token is expired
 * @param expiryDate ISO timestamp string
 * @returns true if expired, false otherwise
 */
export function isTokenExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date()
}
