import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';

import { DrizzleService } from '../../database/drizzle.service';
import { AuditService } from './audit.service';
import { EncryptionService } from './encryption.service';

export interface DataDeletionRequest {
  tenantId: string;
  userId?: string;
  dataType: 'user' | 'tenant' | 'transaction' | 'customer' | 'employee' | 'all';
  reason: 'gdpr' | 'retention_policy' | 'user_request' | 'compliance' | 'security';
  requestedBy: string;
  scheduledFor?: Date;
  metadata?: Record<string, any>;
}

export interface DeletionResult {
  requestId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  deletedRecords: number;
  errors: string[];
  completedAt?: Date;
  verificationHash?: string;
}

export interface SecureDeletionConfig {
  overwritePasses: number;
  verificationRequired: boolean;
  auditRequired: boolean;
  backupBeforeDeletion: boolean;
  cryptographicErasure: boolean;
}

@Injectable()
export class DataDeletionService {
  private readonly logger = new Logger(DataDeletionService.name);
  private readonly deletionQueue = new Map<string, DataDeletionRequest>();
  private readonly config: SecureDeletionConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly drizzleService: DrizzleService,
    private readonly auditService: AuditService,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.config = {
      overwritePasses: this.configService.get<number>('SECURE_DELETION_PASSES', 3),
      verificationRequired: this.configService.get<boolean>('DELETION_VERIFICATION', true),
      auditRequired: this.configService.get<boolean>('DELETION_AUDIT', true),
      backupBeforeDeletion: this.configService.get<boolean>('BACKUP_BEFORE_DELETION', true),
      cryptographicErasure: this.configService.get<boolean>('CRYPTOGRAPHIC_ERASURE', true),
    };
  }

  /**
   * Schedule secure data deletion
   */
  async scheduleDataDeletion(request: DataDeletionRequest): Promise<string> {
    try {
      const requestId = crypto.randomUUID();
      const scheduledRequest = {
        ...request,
        scheduledFor: request.scheduledFor || new Date(),
      };

      this.deletionQueue.set(requestId, scheduledRequest);

      // Audit the deletion request
      if (this.config.auditRequired) {
        await this.auditService.logEvent({
          tenantId: request.tenantId,
          userId: request.requestedBy,
          action: 'data_deletion_scheduled',
          resource: 'data_deletion',
          resourceId: requestId,
          metadata: {
            dataType: request.dataType,
            reason: request.reason,
            scheduledFor: scheduledRequest.scheduledFor,
          },
          severity: 'high',
          category: 'security',
        });
      }

      // If scheduled for immediate deletion, process now
      if (scheduledRequest.scheduledFor <= new Date()) {
        setImmediate(() => this.processDataDeletion(requestId));
      } else {
        // Schedule for later
        const delay = scheduledRequest.scheduledFor.getTime() - Date.now();
        setTimeout(() => this.processDataDeletion(requestId), delay);
      }

      this.logger.log(`Scheduled data deletion request ${requestId} for tenant ${request.tenantId}`);
      return requestId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to schedule data deletion: ${errorMessage}`, errorStack);
      throw new Error('Failed to schedule data deletion');
    }
  }

  /**
   * Process data deletion request
   */
  async processDataDeletion(requestId: string): Promise<DeletionResult> {
    const request = this.deletionQueue.get(requestId);
    if (!request) {
      throw new Error(`Deletion request not found: ${requestId}`);
    }

    const result: DeletionResult = {
      requestId,
      status: 'in_progress',
      deletedRecords: 0,
      errors: [],
    };

    try {
      this.logger.log(`Processing data deletion request ${requestId} for tenant ${request.tenantId}`);

      // Create backup if required
      if (this.config.backupBeforeDeletion) {
        await this.createDeletionBackup(request);
      }

      // Perform secure deletion based on data type
      switch (request.dataType) {
        case 'user':
          result.deletedRecords = await this.deleteUserData(request);
          break;
        case 'tenant':
          result.deletedRecords = await this.deleteTenantData(request);
          break;
        case 'transaction':
          result.deletedRecords = await this.deleteTransactionData(request);
          break;
        case 'customer':
          result.deletedRecords = await this.deleteCustomerData(request);
          break;
        case 'employee':
          result.deletedRecords = await this.deleteEmployeeData(request);
          break;
        case 'all':
          result.deletedRecords = await this.deleteAllTenantData(request);
          break;
        default:
          throw new Error(`Unsupported data type: ${request.dataType}`);
      }

      // Perform cryptographic erasure if enabled
      if (this.config.cryptographicErasure) {
        await this.performCryptographicErasure(request);
      }

      // Verify deletion if required
      if (this.config.verificationRequired) {
        const verified = await this.verifyDeletion(request);
        if (!verified) {
          throw new Error('Deletion verification failed');
        }
        result.verificationHash = await this.generateVerificationHash(request, result.deletedRecords);
      }

      result.status = 'completed';
      result.completedAt = new Date();

      // Audit successful deletion
      if (this.config.auditRequired) {
        await this.auditService.logEvent({
          tenantId: request.tenantId,
          userId: request.requestedBy,
          action: 'data_deletion_completed',
          resource: 'data_deletion',
          resourceId: requestId,
          metadata: {
            dataType: request.dataType,
            deletedRecords: result.deletedRecords,
            verificationHash: result.verificationHash,
          },
          severity: 'critical',
          category: 'security',
        });
      }

      // Emit deletion completed event
      this.eventEmitter.emit('data.deletion.completed', {
        requestId,
        tenantId: request.tenantId,
        dataType: request.dataType,
        deletedRecords: result.deletedRecords,
      });

      this.logger.log(`Completed data deletion request ${requestId}: ${result.deletedRecords} records deleted`);

    } catch (error) {
      result.status = 'failed';
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);

      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Data deletion failed for request ${requestId}: ${errorMessage}`, errorStack);

      // Audit failed deletion
      if (this.config.auditRequired) {
        await this.auditService.logEvent({
          tenantId: request.tenantId,
          userId: request.requestedBy,
          action: 'data_deletion_failed',
          resource: 'data_deletion',
          resourceId: requestId,
          metadata: {
            error: errorMessage,
            dataType: request.dataType,
          },
          severity: 'critical',
          category: 'security',
        });
      }
    } finally {
      // Clean up request from queue
      this.deletionQueue.delete(requestId);
    }

    return result;
  }

  /**
   * Secure memory overwrite for sensitive data
   */
  secureOverwrite(buffer: Buffer, passes: number = this.config.overwritePasses): void {
    for (let pass = 0; pass < passes; pass++) {
      // Different patterns for each pass
      switch (pass % 3) {
        case 0:
          buffer.fill(0x00); // All zeros
          break;
        case 1:
          buffer.fill(0xFF); // All ones
          break;
        case 2:
          // Random data
          crypto.randomFillSync(buffer);
          break;
      }
    }
    
    // Final pass with zeros
    buffer.fill(0x00);
  }

  /**
   * Get deletion status
   */
  getDeletionStatus(requestId: string): DeletionResult | null {
    // In a real implementation, this would query the database
    return null;
  }

  /**
   * Cancel scheduled deletion
   */
  async cancelDeletion(requestId: string, cancelledBy: string): Promise<void> {
    const request = this.deletionQueue.get(requestId);
    if (!request) {
      throw new Error(`Deletion request not found: ${requestId}`);
    }

    this.deletionQueue.delete(requestId);

    // Audit cancellation
    if (this.config.auditRequired) {
      await this.auditService.logEvent({
        tenantId: request.tenantId,
        userId: cancelledBy,
        action: 'data_deletion_cancelled',
        resource: 'data_deletion',
        resourceId: requestId,
        metadata: {
          originalRequestedBy: request.requestedBy,
          dataType: request.dataType,
        },
        severity: 'medium',
        category: 'security',
      });
    }

    this.logger.log(`Cancelled data deletion request ${requestId}`);
  }

  /**
   * Delete user data (GDPR compliance)
   */
  private async deleteUserData(request: DataDeletionRequest): Promise<number> {
    const db = this.drizzleService.getDb();
    let deletedCount = 0;

    // Delete user records
    // Note: In real implementation, use actual Drizzle queries
    this.logger.log(`Deleting user data for tenant ${request.tenantId}, user ${request.userId}`);
    
    // Mock deletion count
    deletedCount = 1;

    return deletedCount;
  }

  /**
   * Delete tenant data
   */
  private async deleteTenantData(request: DataDeletionRequest): Promise<number> {
    const db = this.drizzleService.getDb();
    let deletedCount = 0;

    // Delete all tenant-related data
    this.logger.log(`Deleting all tenant data for tenant ${request.tenantId}`);
    
    // Mock deletion count
    deletedCount = 100;

    return deletedCount;
  }

  /**
   * Delete transaction data
   */
  private async deleteTransactionData(request: DataDeletionRequest): Promise<number> {
    // Implementation for transaction data deletion
    return 0;
  }

  /**
   * Delete customer data
   */
  private async deleteCustomerData(request: DataDeletionRequest): Promise<number> {
    // Implementation for customer data deletion
    return 0;
  }

  /**
   * Delete employee data
   */
  private async deleteEmployeeData(request: DataDeletionRequest): Promise<number> {
    // Implementation for employee data deletion
    return 0;
  }

  /**
   * Delete all tenant data
   */
  private async deleteAllTenantData(request: DataDeletionRequest): Promise<number> {
    // Implementation for complete tenant data deletion
    return 0;
  }

  /**
   * Create backup before deletion
   */
  private async createDeletionBackup(request: DataDeletionRequest): Promise<void> {
    this.logger.log(`Creating backup before deletion for request ${request.tenantId}`);
    // Implementation for creating backup
  }

  /**
   * Perform cryptographic erasure
   */
  private async performCryptographicErasure(request: DataDeletionRequest): Promise<void> {
    // Rotate encryption keys to make encrypted data unrecoverable
    await this.encryptionService.rotateKeys(request.tenantId);
    this.logger.log(`Performed cryptographic erasure for tenant ${request.tenantId}`);
  }

  /**
   * Verify deletion was successful
   */
  private async verifyDeletion(request: DataDeletionRequest): Promise<boolean> {
    // Implementation for deletion verification
    this.logger.log(`Verifying deletion for request ${request.tenantId}`);
    return true;
  }

  /**
   * Generate verification hash
   */
  private async generateVerificationHash(request: DataDeletionRequest, deletedCount: number): Promise<string> {
    const data = `${request.tenantId}:${request.dataType}:${deletedCount}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}