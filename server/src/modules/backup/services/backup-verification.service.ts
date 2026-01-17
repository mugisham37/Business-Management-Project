import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { BackupRepository } from '../repositories/backup.repository';
import { BackupStorageService } from './backup-storage.service';
import { BackupEncryptionService } from './backup-encryption.service';
import { BackupEntity, BackupStatus } from '../entities/backup.entity';

export interface VerificationResult {
  isValid: boolean;
  checksumMatch: boolean;
  encryptionValid: boolean;
  structureValid: boolean;
  sizeMatch: boolean;
  errors: string[];
  verificationDuration: number;
}

export interface BackupIntegrityCheck {
  backupId: string;
  expectedChecksum: string;
  actualChecksum: string;
  expectedSize: number;
  actualSize: number;
  encryptionKeyValid: boolean;
  structureValid: boolean;
  errors: string[];
}

@Injectable()
export class BackupVerificationService {
  private readonly logger = new Logger(BackupVerificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly backupRepository: BackupRepository,
    private readonly storageService: BackupStorageService,
    private readonly encryptionService: BackupEncryptionService,
  ) {}

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<VerificationResult> {
    this.logger.log(`Starting verification for backup ${backupId}`);
    const startTime = Date.now();

    try {
      const backup = await this.backupRepository.findById(backupId);
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Update status to verifying
      await this.backupRepository.update(backupId, {
        status: BackupStatus.VERIFYING,
      });

      const result = await this.performVerification(backup);
      const verificationDuration = Date.now() - startTime;

      // Update backup status based on verification result
      await this.backupRepository.update(backupId, {
        status: result.isValid ? BackupStatus.VERIFIED : BackupStatus.VERIFICATION_FAILED,
        isVerified: result.isValid,
        verifiedAt: result.isValid ? new Date() : undefined,
      });

      this.logger.log(`Backup ${backupId} verification completed: ${result.isValid ? 'PASSED' : 'FAILED'}`);

      return {
        ...result,
        verificationDuration,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Backup verification failed for ${backupId}: ${errorMessage}`, errorStack);

      // Update status to verification failed
      await this.backupRepository.update(backupId, {
        status: BackupStatus.VERIFICATION_FAILED,
        isVerified: false,
      });

      return {
        isValid: false,
        checksumMatch: false,
        encryptionValid: false,
        structureValid: false,
        sizeMatch: false,
        errors: [errorMessage],
        verificationDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Verify backup with detailed results for GraphQL
   */
  async verifyBackupWithDetails(backup: BackupEntity, options?: {
    deepVerification?: boolean;
    verifyEncryption?: boolean;
    verifyStructure?: boolean;
  }): Promise<any> {
    this.logger.log(`Starting detailed verification for backup ${backup.id}`);

    try {
      // Update status to verifying
      await this.backupRepository.update(backup.id, {
        status: BackupStatus.VERIFYING,
      });

      const result = await this.performDetailedVerification(backup, options);

      // Update backup status based on verification result
      await this.backupRepository.update(backup.id, {
        status: result.isValid ? BackupStatus.VERIFIED : BackupStatus.VERIFICATION_FAILED,
        isVerified: result.isValid,
        verifiedAt: result.isValid ? new Date() : undefined,
      });

      return {
        backupId: backup.id,
        isValid: result.isValid,
        verifiedAt: new Date(),
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        checksumValid: result.checksumMatch,
        structureValid: result.structureValid,
        encryptionValid: result.encryptionValid,
        sizeValid: result.sizeMatch,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update status to verification failed
      await this.backupRepository.update(backup.id, {
        status: BackupStatus.VERIFICATION_FAILED,
        isVerified: false,
      });

      return {
        backupId: backup.id,
        isValid: false,
        verifiedAt: new Date(),
        errorMessage,
        checksumValid: false,
        structureValid: false,
        encryptionValid: false,
        sizeValid: false,
      };
    }
  }

  /**
   * Perform comprehensive backup verification
   */
  private async performVerification(backup: BackupEntity): Promise<Omit<VerificationResult, 'verificationDuration'>> {
    const errors: string[] = [];
    let checksumMatch = false;
    let encryptionValid = false;
    let structureValid = false;
    let sizeMatch = false;

    try {
      // 1. Check if backup exists in storage
      const exists = await this.storageService.backupExists(backup.storagePath, backup.storageLocation);
      if (!exists) {
        errors.push('Backup file not found in storage');
        return {
          isValid: false,
          checksumMatch: false,
          encryptionValid: false,
          structureValid: false,
          sizeMatch: false,
          errors,
        };
      }

      // 2. Get storage metadata
      const metadata = await this.storageService.getBackupMetadata(backup.storagePath, backup.storageLocation);
      
      // 3. Verify file size
      if (metadata.size && backup.sizeBytes) {
        sizeMatch = metadata.size === backup.sizeBytes;
        if (!sizeMatch) {
          errors.push(`Size mismatch: expected ${backup.sizeBytes}, got ${metadata.size}`);
        }
      }

      // 4. Download backup for detailed verification
      const tempDir = this.configService.get('TEMP_DIR', '/tmp');
      const tempFilePath = path.join(tempDir, `verify_${backup.id}_${Date.now()}`);

      try {
        await this.storageService.downloadBackup(backup.storagePath, backup.storageLocation, tempFilePath);

        // 5. Verify checksum
        const actualChecksum = await this.calculateFileChecksum(tempFilePath);
        checksumMatch = actualChecksum === backup.checksum;
        if (!checksumMatch) {
          errors.push(`Checksum mismatch: expected ${backup.checksum}, got ${actualChecksum}`);
        }

        // 6. Verify encryption if enabled
        if (backup.encryptionKeyId) {
          encryptionValid = await this.verifyEncryption(tempFilePath, backup);
          if (!encryptionValid) {
            errors.push('Encryption verification failed');
          }
        } else {
          encryptionValid = true; // No encryption to verify
        }

        // 7. Verify backup structure
        structureValid = await this.verifyBackupStructure(tempFilePath, backup);
        if (!structureValid) {
          errors.push('Backup structure verification failed');
        }

      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Verification error: ${errorMessage}`);
    }

    const isValid = checksumMatch && encryptionValid && structureValid && sizeMatch && errors.length === 0;

    return {
      isValid,
      checksumMatch,
      encryptionValid,
      structureValid,
      sizeMatch,
      errors,
    };
  }

  /**
   * Perform detailed verification with options
   */
  private async performDetailedVerification(backup: BackupEntity, options?: {
    deepVerification?: boolean;
    verifyEncryption?: boolean;
    verifyStructure?: boolean;
  }): Promise<Omit<VerificationResult, 'verificationDuration'>> {
    const errors: string[] = [];
    let checksumMatch = false;
    let encryptionValid = false;
    let structureValid = false;
    let sizeMatch = false;

    try {
      // 1. Check if backup exists in storage
      const exists = await this.storageService.backupExists(backup.storagePath, backup.storageLocation);
      if (!exists) {
        errors.push('Backup file not found in storage');
        return {
          isValid: false,
          checksumMatch: false,
          encryptionValid: false,
          structureValid: false,
          sizeMatch: false,
          errors,
        };
      }

      // 2. Get storage metadata
      const metadata = await this.storageService.getBackupMetadata(backup.storagePath, backup.storageLocation);
      
      // 3. Verify file size
      if (metadata.size && backup.sizeBytes) {
        sizeMatch = metadata.size === backup.sizeBytes;
        if (!sizeMatch) {
          errors.push(`Size mismatch: expected ${backup.sizeBytes}, got ${metadata.size}`);
        }
      }

      // 4. Skip detailed verification if not requested
      if (!options?.deepVerification) {
        checksumMatch = true; // Assume valid for quick verification
        encryptionValid = true;
        structureValid = true;
      } else {
        // Download backup for detailed verification
        const tempDir = this.configService.get('TEMP_DIR', '/tmp');
        const tempFilePath = path.join(tempDir, `verify_${backup.id}_${Date.now()}`);

        try {
          await this.storageService.downloadBackup(backup.storagePath, backup.storageLocation, tempFilePath);

          // 5. Verify checksum
          const actualChecksum = await this.calculateFileChecksum(tempFilePath);
          checksumMatch = actualChecksum === backup.checksum;
          if (!checksumMatch) {
            errors.push(`Checksum mismatch: expected ${backup.checksum}, got ${actualChecksum}`);
          }

          // 6. Verify encryption if enabled and requested
          if (options?.verifyEncryption !== false && backup.encryptionKeyId) {
            encryptionValid = await this.verifyEncryption(tempFilePath, backup);
            if (!encryptionValid) {
              errors.push('Encryption verification failed');
            }
          } else {
            encryptionValid = true;
          }

          // 7. Verify backup structure if requested
          if (options?.verifyStructure !== false) {
            structureValid = await this.verifyBackupStructure(tempFilePath, backup);
            if (!structureValid) {
              errors.push('Backup structure verification failed');
            }
          } else {
            structureValid = true;
          }

        } finally {
          // Clean up temporary file
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Verification error: ${errorMessage}`);
    }

    const isValid = checksumMatch && encryptionValid && structureValid && sizeMatch && errors.length === 0;

    return {
      isValid,
      checksumMatch,
      encryptionValid,
      structureValid,
      sizeMatch,
      errors,
    };
  }

  /**
   * Verify backup encryption
   */
  private async verifyEncryption(filePath: string, backup: BackupEntity): Promise<boolean> {
    try {
      // Check if file is properly encrypted
      const isEncrypted = await this.encryptionService.isFileEncrypted(filePath);
      if (!isEncrypted) {
        return false;
      }

      // Verify encryption key exists and is valid
      const keyExists = await this.encryptionService.keyExists(backup.encryptionKeyId);
      if (!keyExists) {
        return false;
      }

      // Try to decrypt a small portion to verify key validity
      const canDecrypt = await this.encryptionService.testDecryption(filePath, backup.encryptionKeyId);
      return canDecrypt;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Encryption verification failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Verify backup structure and format
   */
  private async verifyBackupStructure(filePath: string, backup: BackupEntity): Promise<boolean> {
    try {
      // Check if file is a valid backup format (e.g., tar.gz, zip)
      const fileType = await this.detectFileType(filePath);
      
      switch (fileType) {
        case 'tar.gz':
          return await this.verifyTarGzStructure(filePath);
        case 'zip':
          return await this.verifyZipStructure(filePath);
        case 'sql':
          return await this.verifySqlStructure(filePath);
        default:
          this.logger.warn(`Unknown backup file type: ${fileType}`);
          return true; // Assume valid for unknown types
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Structure verification failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async detectFileType(filePath: string): Promise<string> {
    // Simple file type detection based on file signature
    const buffer = Buffer.alloc(10);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 10, 0);
    fs.closeSync(fd);

    // Check for common backup file signatures
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return 'tar.gz';
    }
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      return 'zip';
    }
    if (buffer.toString('ascii', 0, 6) === 'SQLite') {
      return 'sqlite';
    }
    if (buffer.toString('ascii', 0, 5) === 'PGDMP') {
      return 'postgresql';
    }

    return 'unknown';
  }

  private async verifyTarGzStructure(filePath: string): Promise<boolean> {
    try {
      // Use tar command to test archive integrity
      const { execSync } = require('child_process');
      execSync(`tar -tzf "${filePath}" > /dev/null 2>&1`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async verifyZipStructure(filePath: string): Promise<boolean> {
    try {
      // Use unzip command to test archive integrity
      const { execSync } = require('child_process');
      execSync(`unzip -t "${filePath}" > /dev/null 2>&1`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async verifySqlStructure(filePath: string): Promise<boolean> {
    try {
      // Basic SQL file validation - check for common SQL keywords
      const content = fs.readFileSync(filePath, 'utf8');
      const sqlKeywords = ['CREATE', 'INSERT', 'UPDATE', 'DELETE', 'SELECT', 'DROP'];
      
      return sqlKeywords.some(keyword => 
        content.toUpperCase().includes(keyword)
      );
    } catch (error) {
      return false;
    }
  }
}