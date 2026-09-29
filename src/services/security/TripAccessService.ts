import crypto from 'crypto';

export class TripAccessService {
  /**
   * Generates a cryptographically secure, random, non-predictable trip token.
   * e.g. 'v_8f1a3b5c9d2e4f6a7b8c9d0e1f2a3b4c'
   */
  static generateSecureToken(): string {
    const rawBytes = crypto.randomBytes(24).toString('hex');
    return `v_${rawBytes}`;
  }

  /**
   * Validates token format and structure.
   */
  static isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    // Format: 'v_' followed by at least 16 hex/alphanumeric characters
    return /^v_[a-zA-Z0-9_-]{16,}$/.test(token);
  }

  /**
   * Verifies that the requested token strictly matches the target trip's token.
   * Prevents Cross-Trip Access (Trip A accessing Trip B).
   */
  static verifyTripAccess(requestedToken: string, actualTripToken: string): boolean {
    if (!this.isValidTokenFormat(requestedToken) || !actualTripToken) {
      return false;
    }
    // Timing-safe comparison to prevent timing attacks
    const bufReq = Buffer.from(requestedToken);
    const bufActual = Buffer.from(actualTripToken);
    if (bufReq.length !== bufActual.length) return false;
    return crypto.timingSafeEqual(bufReq, bufActual);
  }

  /**
   * Enforces business rule: In production, DEV_TEST unlock is strictly prohibited.
   */
  static isUnlockAllowed(unlockSource: string, isProduction: boolean): { allowed: boolean; reason?: string } {
    if (unlockSource === 'dev_test' && isProduction) {
      return {
        allowed: false,
        reason: 'DEV_TEST authorization is strictly prohibited in production environment.'
      };
    }
    return { allowed: true };
  }
}
