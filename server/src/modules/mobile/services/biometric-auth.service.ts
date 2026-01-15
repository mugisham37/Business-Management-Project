import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import * as crypto from 'crypto';

export interface BiometricAuthRequest {
  userId: string;
  tenantId: string;
  deviceId: string;
  biometricType: 'fingerprint' | 'face' | 'voice' | 'iris';
  challenge: string;
  signature: string;
  publicKey: string;
  timestamp: number;
}

export interface BiometricAuthResult {
  success: boolean;
  sessionToken?: string;
  expiresAt?: Date;
  error?: string;
  requiresReregistration?: boolean;
}

export interface BiometricRegistration {
  id: string;
  userId: string;
  tenantId: string;
  deviceId: string;
  biometricType: 'fingerprint' | 'face' | 'voice' | 'iris';
  publicKey: string;
  keyAlgorithm: string;
  enrollmentData: string; // Encrypted biometric template
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  failureCount: number;
  maxFailures: number;
}

export interface BiometricCapabilities {
  fingerprint: boolean;
  face: boolean;
  voice: boolean;
  iris: boolean;
  deviceSecure: boolean;
  biometricEnrolled: boolean;
}

@Injectable()
export class BiometricAuthService {
  private readonly logger = new Logger(BiometricAuthService.name);
  private readonly maxFailures = 5;
  private readonly sessionDuration = 3600000; // 1 hour in milliseconds

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Authenticate user using biometric data
   */
  async authenticateWithBiometric(
    request: BiometricAuthRequest,
  ): Promise<BiometricAuthResult> {
    try {
      this.logger.log(
        `Biometric authentication attempt: ${request.biometricType} for user ${request.userId}`,
      );

      // Validate request timestamp (prevent replay attacks)
      if (!this.isValidTimestamp(request.timestamp)) {
        return {
          success: false,
          error: 'Invalid timestamp - request too old or from future',
        };
      }

      // Get biometric registration
      const registration = await this.getBiometricRegistration(
        request.userId,
        request.tenantId,
        request.deviceId,
        request.biometricType,
      );

      if (!registration) {
        return {
          success: false,
          error: 'Biometric not registered for this device',
          requiresReregistration: true,
        };
      }

      if (!registration.isActive) {
        return {
          success: false,
          error: 'Biometric authentication disabled',
          requiresReregistration: true,
        };
      }

      // Check failure count
      if (registration.failureCount >= registration.maxFailures) {
        this.logger.warn(
          `Biometric authentication blocked due to too many failures: ${request.userId}`,
        );
        return {
          success: false,
          error: 'Biometric authentication temporarily blocked',
          requiresReregistration: true,
        };
      }

      // Verify biometric signature
      const isValidSignature = await this.verifyBiometricSignature(
        request,
        registration,
      );

      if (!isValidSignature) {
        // Increment failure count
        await this.incrementFailureCount(registration);
        
        return {
          success: false,
          error: 'Biometric verification failed',
        };
      }

      // Reset failure count on successful authentication
      await this.resetFailureCount(registration);

      // Generate session token
      const sessionToken = await this.generateSessionToken(
        request.userId,
        request.tenantId,
        request.deviceId,
      );

      const expiresAt = new Date(Date.now() + this.sessionDuration);

      // Update last used timestamp
      registration.lastUsed = new Date();
      await this.updateBiometricRegistration(registration);

      this.logger.log(`Biometric authentication successful for user ${request.userId}`);

      return {
        success: true,
        sessionToken,
        expiresAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Biometric authentication error: ${errorMessage}`, errorStack);
      return {
        success: false,
        error: 'Authentication service error',
      };
    }
  }

  /**
   * Register biometric authentication for a device
   */
  async registerBiometric(
    userId: string,
    tenantId: string,
    deviceId: string,
    biometricType: 'fingerprint' | 'face' | 'voice' | 'iris',
    publicKey: string,
    keyAlgorithm: string,
    enrollmentData: string,
  ): Promise<BiometricRegistration> {
    try {
      this.logger.log(
        `Registering biometric ${biometricType} for user ${userId} on device ${deviceId}`,
      );

      // Check if biometric is already registered
      const existingRegistration = await this.getBiometricRegistration(
        userId,
        tenantId,
        deviceId,
        biometricType,
      );

      if (existingRegistration) {
        // Update existing registration
        existingRegistration.publicKey = publicKey;
        existingRegistration.keyAlgorithm = keyAlgorithm;
        existingRegistration.enrollmentData = await this.encryptEnrollmentData(enrollmentData);
        existingRegistration.isActive = true;
        existingRegistration.failureCount = 0;

        await this.updateBiometricRegistration(existingRegistration);
        
        this.logger.log(`Updated existing biometric registration for user ${userId}`);
        return existingRegistration;
      }

      // Create new registration
      const registration: BiometricRegistration = {
        id: `biometric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        tenantId,
        deviceId,
        biometricType,
        publicKey,
        keyAlgorithm,
        enrollmentData: await this.encryptEnrollmentData(enrollmentData),
        isActive: true,
        createdAt: new Date(),
        failureCount: 0,
        maxFailures: this.maxFailures,
      };

      await this.saveBiometricRegistration(registration);

      this.logger.log(`Biometric registration completed for user ${userId}`);
      return registration;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Biometric registration failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Unregister biometric authentication
   */
  async unregisterBiometric(
    userId: string,
    tenantId: string,
    deviceId: string,
    biometricType?: 'fingerprint' | 'face' | 'voice' | 'iris',
  ): Promise<void> {
    try {
      if (biometricType) {
        // Unregister specific biometric type
        const registration = await this.getBiometricRegistration(
          userId,
          tenantId,
          deviceId,
          biometricType,
        );

        if (registration) {
          registration.isActive = false;
          await this.updateBiometricRegistration(registration);
          this.logger.log(`Unregistered ${biometricType} for user ${userId}`);
        }
      } else {
        // Unregister all biometric types for device
        const registrations = await this.getAllBiometricRegistrations(userId, tenantId, deviceId);
        
        for (const registration of registrations) {
          registration.isActive = false;
          await this.updateBiometricRegistration(registration);
        }
        
        this.logger.log(`Unregistered all biometrics for user ${userId} on device ${deviceId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Biometric unregistration failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get biometric capabilities for a device
   */
  async getBiometricCapabilities(
    deviceId: string,
    userAgent?: string,
  ): Promise<BiometricCapabilities> {
    // In a real implementation, this would check device capabilities
    // For now, we'll simulate based on user agent or device type
    
    const capabilities: BiometricCapabilities = {
      fingerprint: false,
      face: false,
      voice: false,
      iris: false,
      deviceSecure: true,
      biometricEnrolled: false,
    };

    if (userAgent) {
      // Detect capabilities from user agent
      if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        capabilities.fingerprint = true;
        capabilities.face = userAgent.includes('iPhone X') || userAgent.includes('iPhone 1');
      } else if (userAgent.includes('Android')) {
        capabilities.fingerprint = true;
        capabilities.face = true;
      }
    } else {
      // Default capabilities for unknown devices
      capabilities.fingerprint = true;
      capabilities.face = true;
    }

    return capabilities;
  }

  /**
   * Validate biometric session token
   */
  async validateSessionToken(
    sessionToken: string,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    try {
      const cacheKey = `biometric_session:${sessionToken}`;
      const sessionData = await this.cacheService.get<{
        userId: string;
        tenantId: string;
        deviceId: string;
        expiresAt: number;
      }>(cacheKey);

      if (!sessionData) {
        return false;
      }

      // Check if session is expired
      if (Date.now() > sessionData.expiresAt) {
        await this.cacheService.invalidatePattern(cacheKey);
        return false;
      }

      // Check if session belongs to the correct user and tenant
      return sessionData.userId === userId && sessionData.tenantId === tenantId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Session token validation failed: ${errorMessage}`, errorStack);
      return false;
    }
  }

  /**
   * Get biometric registration
   */
  private async getBiometricRegistration(
    userId: string,
    tenantId: string,
    deviceId: string,
    biometricType: string,
  ): Promise<BiometricRegistration | null> {
    const cacheKey = `biometric_reg:${tenantId}:${userId}:${deviceId}:${biometricType}`;
    return this.cacheService.get<BiometricRegistration>(cacheKey);
  }

  /**
   * Get all biometric registrations for a device
   */
  private async getAllBiometricRegistrations(
    userId: string,
    tenantId: string,
    deviceId: string,
  ): Promise<BiometricRegistration[]> {
    const types: ('fingerprint' | 'face' | 'voice' | 'iris')[] = ['fingerprint', 'face', 'voice', 'iris'];
    const registrations: BiometricRegistration[] = [];

    for (const type of types) {
      const registration = await this.getBiometricRegistration(userId, tenantId, deviceId, type);
      if (registration) {
        registrations.push(registration);
      }
    }

    return registrations;
  }
  /**
   * Save biometric registration
   */
  private async saveBiometricRegistration(registration: BiometricRegistration): Promise<void> {
    const cacheKey = `biometric_reg:${registration.tenantId}:${registration.userId}:${registration.deviceId}:${registration.biometricType}`;
    await this.cacheService.set(cacheKey, registration, { ttl: 86400 * 30 }); // 30 days
  }

  /**
   * Update biometric registration
   */
  private async updateBiometricRegistration(registration: BiometricRegistration): Promise<void> {
    await this.saveBiometricRegistration(registration);
  }

  /**
   * Verify biometric signature
   */
  private async verifyBiometricSignature(
    request: BiometricAuthRequest,
    registration: BiometricRegistration,
  ): Promise<boolean> {
    try {
      // In a real implementation, this would verify the cryptographic signature
      // using the stored public key and biometric template
      
      // For simulation, we'll do basic validation
      if (!request.signature || !request.publicKey || !request.challenge) {
        return false;
      }

      // Verify public key matches registration
      if (request.publicKey !== registration.publicKey) {
        return false;
      }

      // Simulate signature verification (in production, use actual crypto verification)
      const expectedSignature = crypto
        .createHash('sha256')
        .update(request.challenge + request.publicKey + request.timestamp)
        .digest('hex');

      // Allow some variance for biometric matching (not exact match)
      const similarity = this.calculateSimilarity(request.signature, expectedSignature);
      
      // Require at least 85% similarity for biometric authentication
      return similarity >= 0.85;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Signature verification failed: ${errorMessage}`, errorStack);
      return false;
    }
  }

  /**
   * Calculate similarity between two strings (mock biometric matching)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    // Initialize matrix rows with proper type safety
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    // Initialize first row
    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }
    
    // Calculate distances
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1,
          );
        }
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Encrypt enrollment data
   */
  private async encryptEnrollmentData(data: string): Promise<string> {
    // In production, use proper encryption with tenant-specific keys
    const key = this.configService.get('BIOMETRIC_ENCRYPTION_KEY', 'default-key-32-chars-minimum0000');
    const iv = crypto.randomBytes(16);
    // Use first 32 characters of key for AES-256
    const keyBuffer = Buffer.from(key.substring(0, 32).padEnd(32, '0'), 'utf8');
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Prepend IV to encrypted data for decryption
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Generate session token
   */
  private async generateSessionToken(
    userId: string,
    tenantId: string,
    deviceId: string,
  ): Promise<string> {
    const tokenData = {
      userId,
      tenantId,
      deviceId,
      timestamp: Date.now(),
      random: Math.random().toString(36).substr(2, 9),
    };

    const token = crypto
      .createHash('sha256')
      .update(JSON.stringify(tokenData))
      .digest('hex');

    // Store session data
    const sessionData = {
      userId,
      tenantId,
      deviceId,
      expiresAt: Date.now() + this.sessionDuration,
    };

    const cacheKey = `biometric_session:${token}`;
    await this.cacheService.set(cacheKey, sessionData, { ttl: this.sessionDuration / 1000 });

    return token;
  }

  /**
   * Increment failure count
   */
  private async incrementFailureCount(registration: BiometricRegistration): Promise<void> {
    registration.failureCount++;
    await this.updateBiometricRegistration(registration);
  }

  /**
   * Reset failure count
   */
  private async resetFailureCount(registration: BiometricRegistration): Promise<void> {
    registration.failureCount = 0;
    await this.updateBiometricRegistration(registration);
  }

  /**
   * Validate timestamp to prevent replay attacks
   */
  private isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    const maxFuture = 60000; // 1 minute in future
    
    return timestamp >= (now - maxAge) && timestamp <= (now + maxFuture);
  }
}