// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Email Verification Service
// Token Generation • Verification • Account Lockout Protection
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { CacheService, CacheKeys, getCacheService } from './CacheService';
import { logger } from '../middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerificationToken {
  token: string;
  email: string;
  profileId?: string;
  type: 'email_verification' | 'password_reset' | 'email_change';
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

export interface LockoutRecord {
  identifier: string;
  type: 'login' | 'registration' | 'verification';
  attempts: number;
  lockedUntil: number;
  createdAt: number;
}

export interface VerificationResult {
  success: boolean;
  error?: string;
  profileId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const VERIFICATION_CONFIG = {
  tokenLength: 32,
  tokenTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxAttempts: 3,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  lockoutMaxDuration: 24 * 60 * 60 * 1000, // 24 hours max
};

// ═══════════════════════════════════════════════════════════════════════════════
// Email Verification Service
// ═══════════════════════════════════════════════════════════════════════════════

export class EmailVerificationService {
  private cache: CacheService;

  constructor(cache?: CacheService) {
    this.cache = cache || getCacheService();
  }

  /**
   * Generate verification token
   */
  async generateToken(
    email: string,
    type: VerificationToken['type'],
    profileId?: string
  ): Promise<string> {
    const token = crypto.randomBytes(VERIFICATION_CONFIG.tokenLength).toString('hex');
    const now = Date.now();

    const verificationToken: VerificationToken = {
      token,
      email: email.toLowerCase(),
      profileId,
      type,
      createdAt: now,
      expiresAt: now + VERIFICATION_CONFIG.tokenTTL,
      attempts: 0,
    };

    const key = CacheKeys.verification(type, token);
    await this.cache.set(key, verificationToken, Math.ceil(VERIFICATION_CONFIG.tokenTTL / 1000));

    logger.info('Verification token generated', {
      email,
      type,
      expiresAt: new Date(verificationToken.expiresAt).toISOString(),
    });

    return token;
  }

  /**
   * Verify token
   */
  async verifyToken(
    token: string,
    type: VerificationToken['type']
  ): Promise<VerificationResult> {
    const key = CacheKeys.verification(type, token);
    const storedToken = await this.cache.get<VerificationToken>(key);

    if (!storedToken) {
      return {
        success: false,
        error: 'Invalid or expired token',
      };
    }

    // Check expiration
    if (Date.now() > storedToken.expiresAt) {
      await this.cache.delete(key);
      return {
        success: false,
        error: 'Token has expired',
      };
    }

    // Check attempts
    if (storedToken.attempts >= VERIFICATION_CONFIG.maxAttempts) {
      await this.cache.delete(key);
      return {
        success: false,
        error: 'Maximum verification attempts exceeded',
      };
    }

    // Increment attempts
    storedToken.attempts++;
    await this.cache.set(key, storedToken, Math.ceil(VERIFICATION_CONFIG.tokenTTL / 1000));

    // Delete token after successful verification
    await this.cache.delete(key);

    logger.info('Token verified', {
      email: storedToken.email,
      type,
    });

    return {
      success: true,
      profileId: storedToken.profileId,
    };
  }

  /**
   * Check if identifier is locked out
   */
  async isLockedOut(identifier: string, type: LockoutRecord['type']): Promise<{
    locked: boolean;
    remainingTime?: number;
  }> {
    const key = CacheKeys.rateLimit(identifier, `lockout:${type}`);
    const lockout = await this.cache.get<LockoutRecord>(key);

    if (!lockout) {
      return { locked: false };
    }

    if (Date.now() > lockout.lockedUntil) {
      await this.cache.delete(key);
      return { locked: false };
    }

    const remainingTime = lockout.lockedUntil - Date.now();

    return {
      locked: true,
      remainingTime,
    };
  }

  /**
   * Record failed attempt and potentially lock out
   */
  async recordFailedAttempt(
    identifier: string,
    type: LockoutRecord['type']
  ): Promise<{
    locked: boolean;
    remainingTime?: number;
    attemptsRemaining: number;
  }> {
    const key = CacheKeys.rateLimit(identifier, `lockout:${type}`);
    let lockout = await this.cache.get<LockoutRecord>(key);

    if (!lockout) {
      lockout = {
        identifier,
        type,
        attempts: 0,
        lockedUntil: 0,
        createdAt: Date.now(),
      };
    }

    lockout.attempts++;

    // Calculate lockout duration with exponential backoff
    const lockoutMultiplier = Math.min(lockout.attempts, 5);
    const lockoutDuration = VERIFICATION_CONFIG.lockoutDuration * Math.pow(2, lockoutMultiplier - 1);
    const cappedDuration = Math.min(lockoutDuration, VERIFICATION_CONFIG.lockoutMaxDuration);

    lockout.lockedUntil = Date.now() + cappedDuration;

    await this.cache.set(key, lockout, Math.ceil(cappedDuration / 1000) + 60);

    const attemptsRemaining = Math.max(0, VERIFICATION_CONFIG.maxAttempts - lockout.attempts);
    const isLocked = lockout.attempts >= VERIFICATION_CONFIG.maxAttempts;

    logger.warn('Failed attempt recorded', {
      identifier,
      type,
      attempts: lockout.attempts,
      locked: isLocked,
    });

    return {
      locked: isLocked,
      remainingTime: isLocked ? lockout.lockedUntil - Date.now() : undefined,
      attemptsRemaining,
    };
  }

  /**
   * Clear lockout
   */
  async clearLockout(
    identifier: string,
    type: LockoutRecord['type']
  ): Promise<void> {
    const key = CacheKeys.rateLimit(identifier, `lockout:${type}`);
    await this.cache.delete(key);

    logger.info('Lockout cleared', { identifier, type });
  }

  /**
   * Get lockout status
   */
  async getLockoutStatus(
    identifier: string,
    type: LockoutRecord['type']
  ): Promise<{
    attempts: number;
    locked: boolean;
    remainingTime?: number;
  }> {
    const key = CacheKeys.rateLimit(identifier, `lockout:${type}`);
    const lockout = await this.cache.get<LockoutRecord>(key);

    if (!lockout) {
      return {
        attempts: 0,
        locked: false,
      };
    }

    const isLocked = Date.now() < lockout.lockedUntil;

    return {
      attempts: lockout.attempts,
      locked: isLocked,
      remainingTime: isLocked ? lockout.lockedUntil - Date.now() : undefined,
    };
  }

  /**
   * Send verification email (placeholder - integrate with email service)
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    type: VerificationToken['type']
  ): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${type}?token=${token}`;

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, just log the URL
    logger.info('Verification email would be sent', {
      email,
      type,
      url: verificationUrl,
    });

    // Example integration with email service:
    // await emailService.send({
    //   to: email,
    //   subject: this.getSubjectForType(type),
    //   template: this.getTemplateForType(type),
    //   data: { verificationUrl, token },
    // });
  }

  /**
   * Get email subject based on type
   */
  private getSubjectForType(type: VerificationToken['type']): string {
    switch (type) {
      case 'email_verification':
        return 'Verify your email address';
      case 'password_reset':
        return 'Reset your password';
      case 'email_change':
        return 'Confirm your email change';
      default:
        return 'Verify your email';
    }
  }

  /**
   * Get email template based on type
   */
  private getTemplateForType(type: VerificationToken['type']): string {
    switch (type) {
      case 'email_verification':
        return 'email-verification';
      case 'password_reset':
        return 'password-reset';
      case 'email_change':
        return 'email-change';
      default:
        return 'verification';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

let emailVerificationServiceInstance: EmailVerificationService | null = null;

export function getEmailVerificationService(): EmailVerificationService {
  if (!emailVerificationServiceInstance) {
    emailVerificationServiceInstance = new EmailVerificationService();
  }
  return emailVerificationServiceInstance;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default EmailVerificationService;
