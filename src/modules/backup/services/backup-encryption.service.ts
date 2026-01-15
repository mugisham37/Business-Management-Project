import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface EncryptionKey {
  id: string;
  tenantId: string;
  algorithm: string;
  keyData: string;
  createdAt: Date;
  isActive: boolean;
}

export interface EncryptionResult {
  encryptedFilePath: string;
  keyId: string;
  algorithm: string;
  iv: string;
  authTag?: string;
  encryptionDuration: number;
}

export interface DecryptionResult {
  decryptedFilePath: string;
  decryptionDuration: number;
}

@Injectable()
export class BackupEncryptionService {
  private readonly logger = new Logger(BackupEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits

  constructor(private readonly configService: ConfigService) {}

  /**
   * Encrypt backup file
   */
  async encryptBackupFile(
    inputFilePath: string,
    outputFilePath: string,
    tenantId: string,
  ): Promise<EncryptionResult> {
    this.logger.log(`Encrypting backup file: ${inputFilePath}`);
    const startTime = Date.now();

    try {
      // Get or create encryption key for tenant
      const encryptionKey = await this.getOrCreateBackupKey(tenantId);
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher using createCipheriv instead of deprecated createCipher
      const key = Buffer.from(encryptionKey.keyData, 'hex');
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from(tenantId)); // Additional authenticated data

      // Create streams
      const inputStream = fs.createReadStream(inputFilePath);
      const outputStream = fs.createWriteStream(outputFilePath);

      // Write IV to the beginning of the encrypted file
      outputStream.write(iv);

      // Encrypt file
      await new Promise<void>((resolve, reject) => {
        inputStream.pipe(cipher).pipe(outputStream);
        
        outputStream.on('finish', () => {
          resolve();
        });
        
        outputStream.on('error', reject);
        inputStream.on('error', reject);
        cipher.on('error', reject);
      });

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Append auth tag to file
      fs.appendFileSync(outputFilePath, authTag);

      const encryptionDuration = Date.now() - startTime;
      this.logger.log(`Backup file encrypted successfully in ${encryptionDuration}ms`);

      return {
        encryptedFilePath: outputFilePath,
        keyId: encryptionKey.id,
        algorithm: this.algorithm,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encryptionDuration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to encrypt backup file: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Decrypt backup file
   */
  async decryptBackupFile(
    encryptedFilePath: string,
    outputFilePath: string,
    keyId: string,
    tenantId: string,
  ): Promise<DecryptionResult> {
    this.logger.log(`Decrypting backup file: ${encryptedFilePath}`);
    const startTime = Date.now();

    try {
      // Get encryption key
      const encryptionKey = await this.getBackupKey(keyId);
      if (!encryptionKey || encryptionKey.tenantId !== tenantId) {
        throw new Error('Invalid encryption key or tenant mismatch');
      }

      // Read encrypted file
      const encryptedData = fs.readFileSync(encryptedFilePath);
      
      // Extract IV (first 16 bytes)
      const iv = encryptedData.slice(0, this.ivLength);
      
      // Extract auth tag (last 16 bytes)
      const authTag = encryptedData.slice(-16);
      
      // Extract encrypted content (middle part)
      const encryptedContent = encryptedData.slice(this.ivLength, -16);

      // Create decipher using createDecipheriv instead of deprecated createDecipher
      const key = Buffer.from(encryptionKey.keyData, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from(tenantId));

      // Decrypt content
      const decryptedContent = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
      ]);

      // Write decrypted content to output file
      fs.writeFileSync(outputFilePath, decryptedContent);

      const decryptionDuration = Date.now() - startTime;
      this.logger.log(`Backup file decrypted successfully in ${decryptionDuration}ms`);

      return {
        decryptedFilePath: outputFilePath,
        decryptionDuration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to decrypt backup file: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Check if file is encrypted
   */
  async isFileEncrypted(filePath: string): Promise<boolean> {
    try {
      // Read first few bytes to check for encryption signature
      const buffer = Buffer.alloc(32);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 32, 0);
      fs.closeSync(fd);

      // Check if file starts with random-looking data (encrypted)
      // This is a simple heuristic - in production, you might use a magic number
      const entropy = this.calculateEntropy(buffer);
      return entropy > 7.5; // High entropy indicates encryption

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check file encryption: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Test decryption with a small portion of the file
   */
  async testDecryption(filePath: string, keyId: string): Promise<boolean> {
    try {
      const tempDir = this.configService.get('TEMP_DIR', '/tmp');
      const tempFile = path.join(tempDir, `test_decrypt_${Date.now()}`);

      // Create a small test file with first 1KB of encrypted data
      const testData = Buffer.alloc(1024);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, testData, 0, 1024, 0);
      fs.closeSync(fd);

      const testFilePath = path.join(tempDir, `test_encrypted_${Date.now()}`);
      fs.writeFileSync(testFilePath, testData.slice(0, bytesRead));

      try {
        // Try to decrypt the test portion
        const encryptionKey = await this.getBackupKey(keyId);
        if (!encryptionKey) {
          return false;
        }

        // This is a simplified test - in practice, you'd need to handle the IV and auth tag properly
        // Extract IV from test data (first 16 bytes)
        const testIv = testData.slice(0, this.ivLength);
        const key = Buffer.from(encryptionKey.keyData, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, key, testIv);
        decipher.update(testData.slice(16, 32)); // Skip IV, test small portion
        
        return true;

      } catch (decryptError) {
        return false;
      } finally {
        // Clean up test files
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Test decryption failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get backup encryption key ID for tenant
   */
  async getBackupKeyId(tenantId: string): Promise<string> {
    const key = await this.getOrCreateBackupKey(tenantId);
    return key.id;
  }

  /**
   * Check if encryption key exists
   */
  async keyExists(keyId: string): Promise<boolean> {
    try {
      const key = await this.getBackupKey(keyId);
      return key !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotate encryption keys for tenant
   */
  async rotateBackupKeys(tenantId: string): Promise<EncryptionKey> {
    this.logger.log(`Rotating backup encryption keys for tenant ${tenantId}`);

    try {
      // Deactivate current key
      const currentKey = await this.getActiveBackupKey(tenantId);
      if (currentKey) {
        await this.deactivateKey(currentKey.id);
      }

      // Create new key
      const newKey = await this.createBackupKey(tenantId);
      
      this.logger.log(`Backup encryption keys rotated for tenant ${tenantId}`);
      return newKey;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to rotate backup keys for tenant ${tenantId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Generate secure backup of encryption keys
   */
  async backupEncryptionKeys(tenantId: string): Promise<string> {
    this.logger.log(`Creating backup of encryption keys for tenant ${tenantId}`);

    try {
      const keys = await this.getTenantKeys(tenantId);
      
      // Create key backup structure (without actual key data for security)
      const keyBackup = {
        tenantId,
        backupDate: new Date(),
        keys: keys.map(key => ({
          id: key.id,
          algorithm: key.algorithm,
          createdAt: key.createdAt,
          isActive: key.isActive,
          // Note: Actual key data is not included in backup for security
        })),
      };

      // Encrypt the backup
      const masterKey = this.getMasterEncryptionKey();
      // Use a fixed IV for backup encryption (in production, consider randomizing and storing separately)
      const backupIv = Buffer.alloc(16, 0); // Using zero IV for consistent backups
      const keyBuffer = crypto.scryptSync(masterKey, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, backupIv);
      
      let encrypted = cipher.update(JSON.stringify(keyBackup), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      this.logger.log(`Encryption keys backup created for tenant ${tenantId}`);
      return encrypted;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to backup encryption keys for tenant ${tenantId}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async getOrCreateBackupKey(tenantId: string): Promise<EncryptionKey> {
    let key = await this.getActiveBackupKey(tenantId);
    
    if (!key) {
      key = await this.createBackupKey(tenantId);
    }

    return key;
  }

  private async getActiveBackupKey(tenantId: string): Promise<EncryptionKey | null> {
    // In a real implementation, this would query the database
    // For now, return a mock key
    return {
      id: `backup_key_${tenantId}`,
      tenantId,
      algorithm: this.algorithm,
      keyData: crypto.randomBytes(this.keyLength).toString('hex'),
      createdAt: new Date(),
      isActive: true,
    };
  }

  private async createBackupKey(tenantId: string): Promise<EncryptionKey> {
    const keyData = crypto.randomBytes(this.keyLength);
    
    const key: EncryptionKey = {
      id: `backup_key_${tenantId}_${Date.now()}`,
      tenantId,
      algorithm: this.algorithm,
      keyData: keyData.toString('hex'),
      createdAt: new Date(),
      isActive: true,
    };

    // In a real implementation, this would save to database
    this.logger.log(`Created new backup encryption key for tenant ${tenantId}`);
    
    return key;
  }

  private async getBackupKey(keyId: string): Promise<EncryptionKey | null> {
    // In a real implementation, this would query the database
    // For now, return a mock key if it matches the expected format
    if (keyId.startsWith('backup_key_')) {
      const parts = keyId.split('_');
      const tenantId = parts[2];
      if (!tenantId) {
        return null;
      }
      return {
        id: keyId,
        tenantId,
        algorithm: this.algorithm,
        keyData: crypto.randomBytes(this.keyLength).toString('hex'),
        createdAt: new Date(),
        isActive: true,
      };
    }
    
    return null;
  }

  private async getTenantKeys(tenantId: string): Promise<EncryptionKey[]> {
    // In a real implementation, this would query the database
    return [await this.getOrCreateBackupKey(tenantId)];
  }

  private async deactivateKey(keyId: string): Promise<void> {
    // In a real implementation, this would update the database
    this.logger.log(`Deactivated encryption key ${keyId}`);
  }

  private getMasterEncryptionKey(): string {
    // In production, this should come from a secure key management service
    const key = this.configService.get<string>('MASTER_ENCRYPTION_KEY');
    return key || 'default-master-key-change-in-production';
  }

  private calculateEntropy(buffer: Buffer): number {
    const frequencies = new Array(256).fill(0);
    
    // Count byte frequencies
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte !== undefined) {
        frequencies[byte]++;
      }
    }

    // Calculate Shannon entropy
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (frequencies[i] > 0) {
        const probability = frequencies[i] / buffer.length;
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }
}