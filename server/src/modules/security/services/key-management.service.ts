import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DrizzleService } from '../../database/drizzle.service';
import { EncryptionService } from './encryption.service';

export interface EncryptionKey {
  id: string;
  tenantId: string;
  keyType: 'master' | 'tenant' | 'field' | 'backup';
  algorithm: string;
  keyData: string; // Encrypted key data
  version: number;
  createdAt: Date;
  expiresAt?: Date;
  rotatedAt?: Date;
  status: 'active' | 'rotating' | 'deprecated' | 'revoked';
  metadata: Record<string, any>;
}

export interface KeyRotationPolicy {
  keyType: string;
  rotationIntervalDays: number;
  gracePeriodDays: number;
  autoRotate: boolean;
  notifyBeforeDays: number;
}

@Injectable()
export class KeyManagementService {
  private readonly logger = new Logger(KeyManagementService.name);
  private readonly keyCache = new Map<string, Buffer>();
  private readonly rotationPolicies: Map<string, KeyRotationPolicy> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly drizzleService: DrizzleService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.initializeRotationPolicies();
  }

  /**
   * Generate new encryption key for tenant
   */
  async generateTenantKey(
    tenantId: string,
    keyType: 'tenant' | 'field' | 'backup' = 'tenant',
    algorithm: string = 'aes-256-gcm'
  ): Promise<EncryptionKey> {
    try {
      // Generate cryptographically secure key
      const keyLength = this.getKeyLength(algorithm);
      const keyData = crypto.randomBytes(keyLength);
      
      // Encrypt the key data with master key
      const encryptedKeyData = await this.encryptionService.encryptAtRest(
        keyData.toString('hex'),
        `key:${tenantId}:${keyType}`
      );

      const key: EncryptionKey = {
        id: crypto.randomUUID(),
        tenantId,
        keyType,
        algorithm,
        keyData: encryptedKeyData,
        version: await this.getNextKeyVersion(tenantId, keyType),
        createdAt: new Date(),
        expiresAt: this.calculateExpirationDate(keyType) || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: 'active',
        metadata: {
          generatedBy: 'system',
          purpose: `${keyType}_encryption`,
        },
      };

      // Store key in secure storage (database)
      await this.storeKey(key);

      // Cache the decrypted key for performance
      this.keyCache.set(`${tenantId}:${keyType}:${key.version}`, keyData);

      this.logger.log(`Generated new ${keyType} key for tenant ${tenantId}, version ${key.version}`);
      
      return key;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to generate tenant key: ${err.message}`, err.stack);
      throw new Error('Key generation failed');
    }
  }

  /**
   * Rotate encryption keys for a tenant
   */
  async rotateKeys(tenantId: string, keyType?: string): Promise<void> {
    try {
      const keyTypes = keyType ? [keyType] : ['tenant', 'field', 'backup'];

      for (const type of keyTypes) {
        await this.rotateKeyType(tenantId, type as any);
      }

      this.logger.log(`Completed key rotation for tenant ${tenantId}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Key rotation failed for tenant ${tenantId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get active encryption key for tenant
   */
  async getActiveKey(tenantId: string, keyType: string): Promise<Buffer> {
    const cacheKey = `${tenantId}:${keyType}:active`;
    
    // Check cache first
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // Retrieve from database
    let keyRecord = await this.getActiveKeyRecord(tenantId, keyType);
    if (!keyRecord) {
      // Generate new key if none exists
      const newKey = await this.generateTenantKey(tenantId, keyType as any);
      keyRecord = newKey;
    }

    // Decrypt key data
    const decryptedKeyData = await this.encryptionService.decryptAtRest(
      keyRecord.keyData,
      `key:${tenantId}:${keyType}`
    );

    const keyBuffer = Buffer.from(decryptedKeyData, 'hex');
    
    // Cache for performance
    this.keyCache.set(cacheKey, keyBuffer);
    
    // Set cache expiration
    setTimeout(() => {
      this.keyCache.delete(cacheKey);
    }, 60 * 60 * 1000); // 1 hour

    return keyBuffer;
  }

  /**
   * Secure key deletion
   */
  async deleteKey(keyId: string, reason: string): Promise<void> {
    try {
      const keyRecord = await this.getKeyById(keyId);
      if (!keyRecord) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Mark key as revoked
      keyRecord.status = 'revoked';
      keyRecord.metadata.revokedAt = new Date();
      keyRecord.metadata.revocationReason = reason;

      await this.updateKey(keyRecord);

      // Remove from cache
      this.clearKeyFromCache(keyRecord.tenantId, keyRecord.keyType);

      this.logger.log(`Revoked key ${keyId} for tenant ${keyRecord.tenantId}: ${reason}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete key ${keyId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get key history for tenant
   */
  async getKeyHistory(tenantId: string, keyType?: string): Promise<EncryptionKey[]> {
    try {
      const keys = await this.getTenantKeys(tenantId, keyType);
      // Sort by creation date, most recent first
      return keys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get key history for tenant ${tenantId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get all active keys for tenant
   */
  async getActiveKeys(tenantId: string): Promise<EncryptionKey[]> {
    try {
      const keys = await this.getTenantKeys(tenantId);
      return keys.filter(key => key.status === 'active');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get active keys for tenant ${tenantId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Revoke a specific key
   */
  async revokeKey(keyId: string): Promise<void> {
    try {
      const keyRecord = await this.getKeyById(keyId);
      if (!keyRecord) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Mark key as revoked
      keyRecord.status = 'revoked';
      keyRecord.metadata.revokedAt = new Date();

      await this.updateKey(keyRecord);

      // Remove from cache
      this.clearKeyFromCache(keyRecord.tenantId, keyRecord.keyType);

      this.logger.log(`Revoked key ${keyId} for tenant ${keyRecord.tenantId}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to revoke key ${keyId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get key rotation status for tenant
   */
  async getKeyRotationStatus(tenantId: string): Promise<any> {
    const keys = await this.getTenantKeys(tenantId);
    const rotationStatus: any = {};

    for (const key of keys) {
      const policy = this.rotationPolicies.get(key.keyType);
      if (policy) {
        const daysSinceCreation = Math.floor(
          (Date.now() - key.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        );
        
        const daysUntilRotation = policy.rotationIntervalDays - daysSinceCreation;
        
        rotationStatus[key.keyType] = {
          version: key.version,
          status: key.status,
          createdAt: key.createdAt,
          daysUntilRotation: Math.max(0, daysUntilRotation),
          needsRotation: daysUntilRotation <= policy.notifyBeforeDays,
          autoRotate: policy.autoRotate,
        };
      }
    }

    return rotationStatus;
  }

  /**
   * Backup encryption keys
   */
  async backupKeys(tenantId: string): Promise<string> {
    try {
      const keys = await this.getTenantKeys(tenantId);
      const backup = {
        tenantId,
        backupDate: new Date(),
        keys: keys.map(key => ({
          id: key.id,
          keyType: key.keyType,
          algorithm: key.algorithm,
          version: key.version,
          createdAt: key.createdAt,
          // Note: We don't include the actual key data in backups for security
          metadata: key.metadata,
        })),
      };

      // Encrypt backup data
      const backupData = await this.encryptionService.encryptAtRest(
        JSON.stringify(backup),
        `backup:${tenantId}`
      );

      this.logger.log(`Created key backup for tenant ${tenantId}`);
      
      return backupData;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to backup keys for tenant ${tenantId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Initialize key rotation policies
   */
  private initializeRotationPolicies(): void {
    const policies: KeyRotationPolicy[] = [
      {
        keyType: 'tenant',
        rotationIntervalDays: 90, // 3 months
        gracePeriodDays: 7,
        autoRotate: true,
        notifyBeforeDays: 14,
      },
      {
        keyType: 'field',
        rotationIntervalDays: 180, // 6 months
        gracePeriodDays: 14,
        autoRotate: true,
        notifyBeforeDays: 30,
      },
      {
        keyType: 'backup',
        rotationIntervalDays: 365, // 1 year
        gracePeriodDays: 30,
        autoRotate: false,
        notifyBeforeDays: 60,
      },
    ];

    policies.forEach(policy => {
      this.rotationPolicies.set(policy.keyType, policy);
    });

    this.logger.log(`Initialized ${policies.length} key rotation policies`);
  }

  /**
   * Rotate specific key type for tenant
   */
  private async rotateKeyType(tenantId: string, keyType: 'tenant' | 'field' | 'backup'): Promise<void> {
    const currentKey = await this.getActiveKeyRecord(tenantId, keyType);
    if (!currentKey) {
      // No existing key, generate new one
      await this.generateTenantKey(tenantId, keyType);
      return;
    }

    // Mark current key as rotating
    currentKey.status = 'rotating';
    currentKey.rotatedAt = new Date();
    await this.updateKey(currentKey);

    // Generate new key
    const newKey = await this.generateTenantKey(tenantId, keyType);

    // Mark old key as deprecated after grace period
    const policy = this.rotationPolicies.get(keyType);
    if (policy) {
      setTimeout(async () => {
        currentKey.status = 'deprecated';
        await this.updateKey(currentKey);
      }, policy.gracePeriodDays * 24 * 60 * 60 * 1000);
    }

    // Clear cache to force refresh
    this.clearKeyFromCache(tenantId, keyType);

    this.logger.log(`Rotated ${keyType} key for tenant ${tenantId}: ${currentKey.version} -> ${newKey.version}`);
  }

  /**
   * Get key length for algorithm
   */
  private getKeyLength(algorithm: string): number {
    switch (algorithm) {
      case 'aes-256-gcm':
      case 'aes-256-cbc':
        return 32; // 256 bits
      case 'aes-192-gcm':
      case 'aes-192-cbc':
        return 24; // 192 bits
      case 'aes-128-gcm':
      case 'aes-128-cbc':
        return 16; // 128 bits
      default:
        return 32; // Default to 256 bits
    }
  }

  /**
   * Calculate expiration date based on key type
   */
  private calculateExpirationDate(keyType: string): Date | undefined {
    const policy = this.rotationPolicies.get(keyType);
    if (policy && policy.rotationIntervalDays > 0) {
      return new Date(Date.now() + policy.rotationIntervalDays * 24 * 60 * 60 * 1000);
    }
    return undefined;
  }

  /**
   * Get next key version for tenant and type
   */
  private async getNextKeyVersion(tenantId: string, keyType: string): Promise<number> {
    const keys = await this.getTenantKeys(tenantId, keyType);
    const maxVersion = Math.max(0, ...keys.map(k => k.version));
    return maxVersion + 1;
  }

  /**
   * Clear key from cache
   */
  private clearKeyFromCache(tenantId: string, keyType: string): void {
    const patterns = [
      `${tenantId}:${keyType}:active`,
      `${tenantId}:${keyType}:`,
    ];

    for (const [key] of this.keyCache.entries()) {
      if (patterns.some(pattern => key.startsWith(pattern))) {
        this.keyCache.delete(key);
      }
    }
  }

  // Mock database operations (in real implementation, these would use Drizzle)
  private async storeKey(key: EncryptionKey): Promise<void> {
    // Store in database
    this.logger.debug(`Storing key ${key.id} in database`);
  }

  private async getActiveKeyRecord(tenantId: string, keyType: string): Promise<EncryptionKey | null> {
    // Query database for active key
    return null; // Mock implementation
  }

  private async getKeyById(keyId: string): Promise<EncryptionKey | null> {
    // Query database by key ID
    return null; // Mock implementation
  }

  private async updateKey(key: EncryptionKey): Promise<void> {
    // Update key in database
    this.logger.debug(`Updating key ${key.id} in database`);
  }

  private async getTenantKeys(tenantId: string, keyType?: string): Promise<EncryptionKey[]> {
    // Query all keys for tenant
    return []; // Mock implementation
  }
}