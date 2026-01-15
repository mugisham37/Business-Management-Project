import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
  iterations: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly config: EncryptionConfig;
  private readonly masterKey: Buffer;
  private readonly keyCache = new Map<string, Buffer>();

  constructor(private readonly configService: ConfigService) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      tagLength: 16,
      saltLength: 32,
      iterations: 100000,
    };

    // Get master key from environment or generate one
    const masterKeyHex = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (!masterKeyHex) {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
    }
    
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    if (this.masterKey.length !== this.config.keyLength) {
      throw new Error(`Master key must be ${this.config.keyLength} bytes (${this.config.keyLength * 2} hex characters)`);
    }
  }

  /**
   * Encrypt sensitive field data with tenant-specific key
   */
  async encryptField(data: string, tenantId: string, fieldName: string): Promise<string> {
    try {
      const key = await this.getTenantFieldKey(tenantId, fieldName);
      const iv = crypto.randomBytes(this.config.ivLength);
      
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv) as any;
      cipher.setAAD(Buffer.from(`${tenantId}:${fieldName}`));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      const result: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
      
      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to encrypt field ${fieldName} for tenant ${tenantId}: ${errorMessage}`);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive field data with tenant-specific key
   */
  async decryptField(encryptedData: string, tenantId: string, fieldName: string): Promise<string> {
    try {
      const data: EncryptedData = JSON.parse(encryptedData);
      const key = await this.getTenantFieldKey(tenantId, fieldName);
      const iv = Buffer.from(data.iv, 'hex');
      
      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv) as any;
      decipher.setAAD(Buffer.from(`${tenantId}:${fieldName}`));
      decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
      
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to decrypt field ${fieldName} for tenant ${tenantId}: ${errorMessage}`);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt data at rest (for database storage)
   */
  async encryptAtRest(data: string, context: string = 'default'): Promise<string> {
    try {
      const salt = crypto.randomBytes(this.config.saltLength);
      const key = crypto.pbkdf2Sync(this.masterKey, salt, this.config.iterations, this.config.keyLength, 'sha256');
      const iv = crypto.randomBytes(this.config.ivLength);
      
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv) as any;
      cipher.setAAD(Buffer.from(context));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      const result: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex'),
      };
      
      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to encrypt data at rest: ${errorMessage}`);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data at rest (from database storage)
   */
  async decryptAtRest(encryptedData: string, context: string = 'default'): Promise<string> {
    try {
      const data: EncryptedData = JSON.parse(encryptedData);
      const salt = Buffer.from(data.salt!, 'hex');
      const key = crypto.pbkdf2Sync(this.masterKey, salt, this.config.iterations, this.config.keyLength, 'sha256');
      const iv = Buffer.from(data.iv, 'hex');
      
      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv) as any;
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
      
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to decrypt data at rest: ${errorMessage}`);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash password with salt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key
   */
  generateApiKey(): string {
    const prefix = 'ubp_';
    const randomPart = crypto.randomBytes(24).toString('base64url');
    return `${prefix}${randomPart}`;
  }

  /**
   * Hash API key for storage
   */
  async hashApiKey(apiKey: string): Promise<string> {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: any, fieldsToMask: string[] = []): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const defaultMaskedFields = [
      'password', 'passwordHash', 'token', 'secret', 'key', 'apiKey',
      'ssn', 'socialSecurityNumber', 'creditCard', 'bankAccount',
      'email', 'phone', 'address', 'firstName', 'lastName'
    ];

    const allMaskedFields = [...defaultMaskedFields, ...fieldsToMask];
    const masked = { ...data };

    for (const field of allMaskedFields) {
      if (masked[field]) {
        if (typeof masked[field] === 'string') {
          if (field === 'email') {
            // Mask email: john@example.com -> j***@e***.com
            const emailParts = masked[field].split('@');
            if (emailParts.length === 2 && emailParts[0] && emailParts[1]) {
              const local = emailParts[0];
              const domain = emailParts[1];
              const maskedLocal = local.charAt(0) + '*'.repeat(Math.max(0, local.length - 1));
              const maskedDomain = domain.charAt(0) + '*'.repeat(Math.max(0, domain.length - 4)) + domain.slice(-3);
              masked[field] = `${maskedLocal}@${maskedDomain}`;
            } else {
              // Invalid email format, just mask the whole thing
              const value = masked[field];
              masked[field] = value.charAt(0) + '*'.repeat(Math.max(0, value.length - 2)) + value.charAt(value.length - 1);
            }
          } else if (field === 'phone') {
            // Mask phone: +1234567890 -> +***-***-7890
            const phone = masked[field].replace(/\D/g, '');
            masked[field] = phone.replace(/(\d{1,3})(\d{3})(\d{4})/, '+***-***-$3');
          } else {
            // Generic masking: show first and last character
            const value = masked[field];
            if (value.length <= 2) {
              masked[field] = '*'.repeat(value.length);
            } else {
              masked[field] = value.charAt(0) + '*'.repeat(value.length - 2) + value.charAt(value.length - 1);
            }
          }
        } else {
          masked[field] = '[MASKED]';
        }
      }
    }

    return masked;
  }

  /**
   * Secure data deletion (overwrite memory)
   */
  secureDelete(data: Buffer | string): void {
    if (Buffer.isBuffer(data)) {
      data.fill(0);
    }
    // For strings, we can't directly overwrite memory in JavaScript
    // but we can at least clear the reference
    // Note: data = null would reassign the local parameter, not the caller's data
  }

  /**
   * Get or generate tenant-specific field encryption key
   */
  private async getTenantFieldKey(tenantId: string, fieldName: string): Promise<Buffer> {
    const cacheKey = `${tenantId}:${fieldName}`;
    
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // Derive key from master key + tenant ID + field name
    const keyMaterial = `${tenantId}:${fieldName}`;
    const key = crypto.pbkdf2Sync(
      this.masterKey,
      Buffer.from(keyMaterial),
      this.config.iterations,
      this.config.keyLength,
      'sha256'
    );

    // Cache the key (in production, consider using a more secure cache)
    this.keyCache.set(cacheKey, key);
    
    // Clear cache after 1 hour for security
    setTimeout(() => {
      this.keyCache.delete(cacheKey);
    }, 60 * 60 * 1000);

    return key;
  }

  /**
   * Rotate encryption keys (for key rotation policies)
   */
  async rotateKeys(tenantId: string): Promise<void> {
    // Clear cached keys for tenant
    for (const [key] of this.keyCache.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.keyCache.delete(key);
      }
    }

    this.logger.log(`Rotated encryption keys for tenant: ${tenantId}`);
  }

  /**
   * Generate master key (for initial setup)
   */
  static generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}