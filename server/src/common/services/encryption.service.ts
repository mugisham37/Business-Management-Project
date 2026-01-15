import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }
    
    // Derive a key of the correct length
    this.encryptionKey = crypto.scryptSync(key, 'salt', this.keyLength);
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV + encrypted data + auth tag
    const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex'), tag]);
    return combined.toString('base64');
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(ciphertext: string): Promise<string> {
    const combined = Buffer.from(ciphertext, 'base64');
    
    // Extract IV, encrypted data, and auth tag
    const iv = combined.subarray(0, this.ivLength);
    const tag = combined.subarray(combined.length - this.tagLength);
    const encrypted = combined.subarray(this.ivLength, combined.length - this.tagLength);
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hash data (one-way)
   */
  async hash(data: string): Promise<string> {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
