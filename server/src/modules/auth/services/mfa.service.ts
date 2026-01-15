import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';

import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema/user.schema';
import { eq, and } from 'drizzle-orm';

export interface MfaSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MfaVerificationResult {
  isValid: boolean;
  usedBackupCode?: boolean;
}

@Injectable()
export class MfaService {
  private readonly appName: string;
  private readonly issuer: string;

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.appName = this.configService.get<string>('APP_NAME', 'Unified Business Platform');
    this.issuer = this.configService.get<string>('APP_ISSUER', 'Unified Business Platform');
  }

  /**
   * Generate MFA setup for a user
   */
  async generateMfaSetup(userId: string, tenantId: string, userEmail: string): Promise<MfaSetupResponse> {
    const db = this.drizzleService.getDb();

    // Check if user exists and is active
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user) {
      throw new BadRequestException('User not found or inactive');
    }

    // Generate secret for TOTP
    const secret = speakeasy.generateSecret({
      name: `${this.appName} (${userEmail})`,
      issuer: this.issuer,
      length: 32,
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Generate QR code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Store the secret temporarily (not enabled yet)
    await db
      .update(users)
      .set({
        mfaSecret: secret.base32,
        mfaBackupCodes: backupCodes,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(users.id, userId));

    return {
      secret: secret.base32!,
      qrCodeUrl,
      backupCodes,
      manualEntryKey: secret.base32!,
    };
  }

  /**
   * Enable MFA for a user after verifying the setup
   */
  async enableMfa(userId: string, tenantId: string, token: string): Promise<void> {
    const db = this.drizzleService.getDb();

    // Get user with MFA secret
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not found. Please generate MFA setup first.');
    }

    // Verify the token
    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps (60 seconds) of tolerance
    });

    if (!isValid) {
      throw new BadRequestException('Invalid MFA token');
    }

    // Enable MFA
    await db
      .update(users)
      .set({
        mfaEnabled: true,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(users.id, userId));

    // Emit MFA enabled event
    this.eventEmitter.emit('user.mfa_enabled', {
      userId,
      tenantId,
      timestamp: new Date(),
    });
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: string, tenantId: string, token?: string, backupCode?: string): Promise<void> {
    const db = this.drizzleService.getDb();

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user || !user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled for this user');
    }

    // Verify token or backup code
    let isValid = false;

    if (token && user.mfaSecret) {
      isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 2,
      });
    } else if (backupCode) {
      const backupCodes = Array.isArray(user.mfaBackupCodes) ? user.mfaBackupCodes : [];
      isValid = backupCodes.includes(backupCode);
    }

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA token or backup code');
    }

    // Disable MFA and clear secrets
    await db
      .update(users)
      .set({
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(users.id, userId));

    // Emit MFA disabled event
    this.eventEmitter.emit('user.mfa_disabled', {
      userId,
      tenantId,
      timestamp: new Date(),
    });
  }

  /**
   * Verify MFA token during login
   */
  async verifyMfaToken(userId: string, tenantId: string, token: string): Promise<MfaVerificationResult> {
    const db = this.drizzleService.getDb();

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this user');
    }

    // First, try to verify as TOTP token
    const isTotpValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (isTotpValid) {
      return { isValid: true, usedBackupCode: false };
    }

    // If TOTP fails, check if it's a backup code
    const backupCodes = Array.isArray(user.mfaBackupCodes) ? user.mfaBackupCodes : [];
    const isBackupCode = backupCodes.includes(token);

    if (isBackupCode) {
      // Remove the used backup code
      const updatedBackupCodes = backupCodes.filter(code => code !== token);
      
      await db
        .update(users)
        .set({
          mfaBackupCodes: updatedBackupCodes,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Emit backup code used event
      this.eventEmitter.emit('user.mfa_backup_code_used', {
        userId,
        tenantId,
        remainingCodes: updatedBackupCodes.length,
        timestamp: new Date(),
      });

      return { isValid: true, usedBackupCode: true };
    }

    return { isValid: false };
  }

  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId: string, tenantId: string, token: string): Promise<string[]> {
    const db = this.drizzleService.getDb();

    // Verify current MFA token first
    const verification = await this.verifyMfaToken(userId, tenantId, token);
    if (!verification.isValid) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    // Generate new backup codes
    const newBackupCodes = this.generateBackupCodes();

    // Update user with new backup codes
    await db
      .update(users)
      .set({
        mfaBackupCodes: newBackupCodes,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(users.id, userId));

    // Emit backup codes regenerated event
    this.eventEmitter.emit('user.mfa_backup_codes_regenerated', {
      userId,
      tenantId,
      timestamp: new Date(),
    });

    return newBackupCodes;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMfaEnabled(userId: string, tenantId: string): Promise<boolean> {
    const db = this.drizzleService.getDb();

    const [user] = await db
      .select({ mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ))
      .limit(1);

    return user?.mfaEnabled || false;
  }

  /**
   * Get MFA status for user
   */
  async getMfaStatus(userId: string, tenantId: string): Promise<{
    enabled: boolean;
    backupCodesCount: number;
    hasSecret: boolean;
  }> {
    const db = this.drizzleService.getDb();

    const [user] = await db
      .select({
        mfaEnabled: users.mfaEnabled,
        mfaSecret: users.mfaSecret,
        mfaBackupCodes: users.mfaBackupCodes,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user) {
      return { enabled: false, backupCodesCount: 0, hasSecret: false };
    }

    const backupCodes = Array.isArray(user.mfaBackupCodes) ? user.mfaBackupCodes : [];

    return {
      enabled: user.mfaEnabled || false,
      backupCodesCount: backupCodes.length,
      hasSecret: !!user.mfaSecret,
    };
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Validate backup code format
   */
  private isValidBackupCodeFormat(code: string): boolean {
    // Backup codes should be 8 characters, alphanumeric
    return /^[A-F0-9]{8}$/.test(code.toUpperCase());
  }
}