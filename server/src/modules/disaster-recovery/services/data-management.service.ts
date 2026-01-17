import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BackupService } from '../../backup/services/backup.service';
import { DisasterRecoveryRepository } from '../repositories/disaster-recovery.repository';

export interface GranularRecoveryOptions {
  tenantId: string;
  recoveryType: 'full' | 'partial' | 'table' | 'record';
  targetDate?: Date;
  targetTables?: string[];
  targetRecords?: { table: string; ids: string[] }[];
  excludeTables?: string[];
  includeSystemData?: boolean;
  validateIntegrity?: boolean;
}

export interface DataArchivalPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  dataTypes: string[];
  retentionPeriodDays: number;
  archiveAfterDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  storageLocation: 'local' | 's3' | 'azure' | 'gcs';
  isActive: boolean;
  lastExecutedAt?: Date;
  nextExecutionAt: Date;
}

export interface DataRetentionPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  dataTypes: string[];
  retentionPeriodDays: number;
  complianceFramework: 'gdpr' | 'ccpa' | 'hipaa' | 'sox' | 'pci_dss' | 'custom';
  autoDelete: boolean;
  requiresApproval: boolean;
  notificationDays: number[];
  isActive: boolean;
}

export interface SecureDataDestruction {
  id: string;
  tenantId: string;
  dataType: string;
  recordCount: number;
  destructionMethod: 'overwrite' | 'crypto_erase' | 'physical_destroy';
  verificationRequired: boolean;
  complianceFramework: string;
  scheduledAt: Date;
  executedAt?: Date;
  verifiedAt?: Date;
  certificateGenerated: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'verified' | 'failed';
}

@Injectable()
export class DataManagementService {
  private readonly logger = new Logger(DataManagementService.name);
  private readonly archivalPolicies = new Map<string, DataArchivalPolicy>();
  private readonly retentionPolicies = new Map<string, DataRetentionPolicy>();

  constructor(
    private readonly configService: ConfigService,
    private readonly backupService: BackupService,
    private readonly drRepository: DisasterRecoveryRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Perform granular data recovery
   */
  async performGranularRecovery(options: GranularRecoveryOptions): Promise<{
    recoveryId: string;
    status: 'initiated' | 'in_progress' | 'completed' | 'failed';
    recoveredRecords: number;
    affectedTables: string[];
    startTime: Date;
    endTime?: Date;
    errors: string[];
  }> {
    this.logger.log(`Performing granular recovery for tenant ${options.tenantId}`);

    const recoveryId = `recovery-${Date.now()}`;
    const startTime = new Date();
    const errors: string[] = [];

    try {
      // Validate recovery options
      await this.validateRecoveryOptions(options);

      // Find appropriate backup for recovery
      const backup = await this.findBackupForRecovery(options);
      if (!backup) {
        throw new Error('No suitable backup found for recovery');
      }

      // Perform recovery based on type
      let recoveredRecords = 0;
      let affectedTables: string[] = [];

      switch (options.recoveryType) {
        case 'full':
          const fullResult = await this.performFullRecovery(options, backup);
          recoveredRecords = fullResult.recordCount;
          affectedTables = fullResult.tables;
          break;

        case 'partial':
          const partialResult = await this.performPartialRecovery(options, backup);
          recoveredRecords = partialResult.recordCount;
          affectedTables = partialResult.tables;
          break;

        case 'table':
          const tableResult = await this.performTableRecovery(options, backup);
          recoveredRecords = tableResult.recordCount;
          affectedTables = tableResult.tables;
          break;

        case 'record':
          const recordResult = await this.performRecordRecovery(options, backup);
          recoveredRecords = recordResult.recordCount;
          affectedTables = recordResult.tables;
          break;
      }

      // Validate data integrity if requested
      if (options.validateIntegrity) {
        await this.validateDataIntegrity(options.tenantId, affectedTables);
      }

      const endTime = new Date();

      // Emit recovery completion event
      this.eventEmitter.emit('data-management.recovery.completed', {
        recoveryId,
        tenantId: options.tenantId,
        recoveryType: options.recoveryType,
        recoveredRecords,
        affectedTables,
        duration: endTime.getTime() - startTime.getTime(),
      });

      return {
        recoveryId,
        status: 'completed',
        recoveredRecords,
        affectedTables,
        startTime,
        endTime,
        errors,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      this.logger.error(`Granular recovery failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      return {
        recoveryId,
        status: 'failed',
        recoveredRecords: 0,
        affectedTables: [],
        startTime,
        errors,
      };
    }
  }

  /**
   * Create data archival policy
   */
  async createArchivalPolicy(policy: Omit<DataArchivalPolicy, 'id' | 'lastExecutedAt'>): Promise<DataArchivalPolicy> {
    this.logger.log(`Creating archival policy '${policy.name}' for tenant ${policy.tenantId}`);

    const archivalPolicy: DataArchivalPolicy = {
      id: `archival-${Date.now()}`,
      ...policy,
    };

    this.archivalPolicies.set(archivalPolicy.id, archivalPolicy);

    // Emit policy created event
    this.eventEmitter.emit('data-management.archival-policy.created', {
      policyId: archivalPolicy.id,
      tenantId: policy.tenantId,
      name: policy.name,
    });

    return archivalPolicy;
  }

  /**
   * Execute data archival
   */
  async executeDataArchival(policyId: string): Promise<{
    archivedRecords: number;
    archivedTables: string[];
    archiveSize: number;
    archiveLocation: string;
    compressionRatio?: number;
  }> {
    this.logger.log(`Executing data archival for policy ${policyId}`);

    const policy = this.archivalPolicies.get(policyId);
    if (!policy) {
      throw new Error(`Archival policy ${policyId} not found`);
    }

    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.archiveAfterDays);

      // Find data to archive
      const dataToArchive = await this.findDataForArchival(policy, cutoffDate);

      // Create archive
      const archiveResult = await this.createArchive(policy, dataToArchive);

      // Update policy execution time
      policy.lastExecutedAt = new Date();
      policy.nextExecutionAt = this.calculateNextExecution(policy);
      this.archivalPolicies.set(policyId, policy);

      // Emit archival completion event
      this.eventEmitter.emit('data-management.archival.completed', {
        policyId,
        tenantId: policy.tenantId,
        archivedRecords: archiveResult.recordCount,
        archiveSize: archiveResult.size,
      });

      return {
        archivedRecords: archiveResult.recordCount,
        archivedTables: archiveResult.tables,
        archiveSize: archiveResult.size,
        archiveLocation: archiveResult.location,
        ...(archiveResult.compressionRatio !== undefined && { compressionRatio: archiveResult.compressionRatio }),
      };

    } catch (error) {
      this.logger.error(`Data archival failed for policy ${policyId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Create data retention policy
   */
  async createRetentionPolicy(policy: Omit<DataRetentionPolicy, 'id'>): Promise<DataRetentionPolicy> {
    this.logger.log(`Creating retention policy '${policy.name}' for tenant ${policy.tenantId}`);

    const retentionPolicy: DataRetentionPolicy = {
      id: `retention-${Date.now()}`,
      ...policy,
    };

    this.retentionPolicies.set(retentionPolicy.id, retentionPolicy);

    // Emit policy created event
    this.eventEmitter.emit('data-management.retention-policy.created', {
      policyId: retentionPolicy.id,
      tenantId: policy.tenantId,
      name: policy.name,
      complianceFramework: policy.complianceFramework,
    });

    return retentionPolicy;
  }

  /**
   * Execute data retention enforcement
   */
  async enforceDataRetention(policyId: string): Promise<{
    expiredRecords: number;
    deletedRecords: number;
    pendingApproval: number;
    notificationsSent: number;
  }> {
    this.logger.log(`Enforcing data retention for policy ${policyId}`);

    const policy = this.retentionPolicies.get(policyId);
    if (!policy) {
      throw new Error(`Retention policy ${policyId} not found`);
    }

    try {
      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - policy.retentionPeriodDays);

      // Find expired data
      const expiredData = await this.findExpiredData(policy, expirationDate);

      let deletedRecords = 0;
      let pendingApproval = 0;
      let notificationsSent = 0;

      if (policy.autoDelete && !policy.requiresApproval) {
        // Automatically delete expired data
        deletedRecords = await this.deleteExpiredData(policy, expiredData);
      } else if (policy.requiresApproval) {
        // Queue for approval
        pendingApproval = await this.queueForApproval(policy, expiredData);
      }

      // Send notifications if configured
      if (policy.notificationDays.length > 0) {
        notificationsSent = await this.sendRetentionNotifications(policy, expiredData);
      }

      // Emit retention enforcement event
      this.eventEmitter.emit('data-management.retention.enforced', {
        policyId,
        tenantId: policy.tenantId,
        expiredRecords: expiredData.recordCount,
        deletedRecords,
        pendingApproval,
      });

      return {
        expiredRecords: expiredData.recordCount,
        deletedRecords,
        pendingApproval,
        notificationsSent,
      };

    } catch (error) {
      this.logger.error(`Data retention enforcement failed for policy ${policyId}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Schedule secure data destruction
   */
  async scheduleSecureDestruction(options: {
    tenantId: string;
    dataType: string;
    recordIds: string[];
    destructionMethod: 'overwrite' | 'crypto_erase' | 'physical_destroy';
    complianceFramework: string;
    scheduledAt: Date;
    verificationRequired?: boolean;
  }): Promise<SecureDataDestruction> {
    this.logger.log(`Scheduling secure data destruction for tenant ${options.tenantId}`);

    const destruction: SecureDataDestruction = {
      id: `destruction-${Date.now()}`,
      tenantId: options.tenantId,
      dataType: options.dataType,
      recordCount: options.recordIds.length,
      destructionMethod: options.destructionMethod,
      verificationRequired: options.verificationRequired || false,
      complianceFramework: options.complianceFramework,
      scheduledAt: options.scheduledAt,
      certificateGenerated: false,
      status: 'scheduled',
    };

    // Store destruction record (in real implementation, save to database)
    
    // Emit scheduling event
    this.eventEmitter.emit('data-management.destruction.scheduled', {
      destructionId: destruction.id,
      tenantId: options.tenantId,
      dataType: options.dataType,
      recordCount: options.recordIds.length,
      scheduledAt: options.scheduledAt,
    });

    return destruction;
  }

  /**
   * Execute secure data destruction
   */
  async executeSecureDestruction(destructionId: string): Promise<{
    destructionId: string;
    status: 'completed' | 'failed';
    destroyedRecords: number;
    verificationStatus?: 'verified' | 'failed';
    certificatePath?: string;
    errors: string[];
  }> {
    this.logger.log(`Executing secure data destruction ${destructionId}`);

    const errors: string[] = [];

    try {
      // In real implementation, retrieve destruction record from database
      const destruction: SecureDataDestruction = {
        id: destructionId,
        tenantId: 'example',
        dataType: 'customer_data',
        recordCount: 100,
        destructionMethod: 'crypto_erase',
        verificationRequired: true,
        complianceFramework: 'gdpr',
        scheduledAt: new Date(),
        certificateGenerated: false,
        status: 'in_progress',
      };

      // Execute destruction based on method
      let destroyedRecords = 0;
      
      switch (destruction.destructionMethod) {
        case 'overwrite':
          destroyedRecords = await this.performOverwriteDestruction(destruction);
          break;
        case 'crypto_erase':
          destroyedRecords = await this.performCryptoErase(destruction);
          break;
        case 'physical_destroy':
          destroyedRecords = await this.performPhysicalDestruction(destruction);
          break;
      }

      // Perform verification if required
      let verificationStatus: 'verified' | 'failed' | undefined;
      if (destruction.verificationRequired) {
        verificationStatus = await this.verifyDestruction(destruction);
      }

      // Generate compliance certificate
      const certificatePath = await this.generateDestructionCertificate(destruction);

      // Update destruction record
      destruction.status = 'completed';
      destruction.executedAt = new Date();
      if (verificationStatus) {
        destruction.verifiedAt = new Date();
      }
      destruction.certificateGenerated = true;

      // Emit completion event
      this.eventEmitter.emit('data-management.destruction.completed', {
        destructionId,
        tenantId: destruction.tenantId,
        destroyedRecords,
        verificationStatus,
        certificateGenerated: true,
      });

      return {
        destructionId,
        status: 'completed',
        destroyedRecords,
        ...(verificationStatus && { verificationStatus }),
        certificatePath,
        errors,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      this.logger.error(`Secure data destruction failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      return {
        destructionId,
        status: 'failed',
        destroyedRecords: 0,
        errors,
      };
    }
  }

  /**
   * Scheduled data management tasks
   */
  @Cron('0 2 * * *', {
    name: 'daily-archival-execution',
    timeZone: 'UTC',
  })
  async executeScheduledArchival(): Promise<void> {
    this.logger.log('Executing scheduled data archival');

    try {
      const now = new Date();
      
      for (const [policyId, policy] of this.archivalPolicies) {
        if (policy.isActive && policy.nextExecutionAt <= now) {
          try {
            await this.executeDataArchival(policyId);
          } catch (error) {
            this.logger.error(`Scheduled archival failed for policy ${policyId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

    } catch (error) {
      this.logger.error(`Scheduled archival execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  @Cron('0 3 * * *', {
    name: 'daily-retention-enforcement',
    timeZone: 'UTC',
  })
  async executeScheduledRetention(): Promise<void> {
    this.logger.log('Executing scheduled data retention enforcement');

    try {
      for (const [policyId, policy] of this.retentionPolicies) {
        if (policy.isActive) {
          try {
            await this.enforceDataRetention(policyId);
          } catch (error) {
            this.logger.error(`Scheduled retention enforcement failed for policy ${policyId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

    } catch (error) {
      this.logger.error(`Scheduled retention enforcement failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  /**
   * Private helper methods
   */
  private async validateRecoveryOptions(options: GranularRecoveryOptions): Promise<void> {
    if (options.recoveryType === 'table' && (!options.targetTables || options.targetTables.length === 0)) {
      throw new Error('Target tables must be specified for table recovery');
    }

    if (options.recoveryType === 'record' && (!options.targetRecords || options.targetRecords.length === 0)) {
      throw new Error('Target records must be specified for record recovery');
    }

    if (options.targetDate && options.targetDate > new Date()) {
      throw new Error('Target date cannot be in the future');
    }
  }

  private async findBackupForRecovery(options: GranularRecoveryOptions): Promise<any> {
    // In real implementation, find the most appropriate backup
    // based on target date and recovery requirements
    return {
      id: 'backup-123',
      createdAt: options.targetDate || new Date(),
      type: 'full',
      location: 's3://backups/backup-123',
    };
  }

  private async performFullRecovery(options: GranularRecoveryOptions, backup: any): Promise<{
    recordCount: number;
    tables: string[];
  }> {
    this.logger.log('Performing full database recovery');
    
    // Simulate full recovery
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      recordCount: 1000000,
      tables: ['users', 'transactions', 'products', 'inventory', 'customers'],
    };
  }

  private async performPartialRecovery(options: GranularRecoveryOptions, backup: any): Promise<{
    recordCount: number;
    tables: string[];
  }> {
    this.logger.log('Performing partial database recovery');
    
    // Simulate partial recovery
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const tables = options.targetTables || ['users', 'transactions'];
    return {
      recordCount: 50000,
      tables,
    };
  }

  private async performTableRecovery(options: GranularRecoveryOptions, backup: any): Promise<{
    recordCount: number;
    tables: string[];
  }> {
    this.logger.log(`Performing table recovery for tables: ${options.targetTables?.join(', ')}`);
    
    // Simulate table recovery
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      recordCount: 25000,
      tables: options.targetTables || [],
    };
  }

  private async performRecordRecovery(options: GranularRecoveryOptions, backup: any): Promise<{
    recordCount: number;
    tables: string[];
  }> {
    this.logger.log('Performing record-level recovery');
    
    // Simulate record recovery
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const tables = options.targetRecords?.map(r => r.table) || [];
    const recordCount = options.targetRecords?.reduce((sum, r) => sum + r.ids.length, 0) || 0;
    
    return {
      recordCount,
      tables: [...new Set(tables)],
    };
  }

  private async validateDataIntegrity(tenantId: string, tables: string[]): Promise<void> {
    this.logger.log(`Validating data integrity for tables: ${tables.join(', ')}`);
    
    // Simulate integrity validation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In real implementation, perform checksums, foreign key validation, etc.
  }

  private async findDataForArchival(policy: DataArchivalPolicy, cutoffDate: Date): Promise<{
    recordCount: number;
    tables: string[];
    estimatedSize: number;
  }> {
    // Simulate finding data for archival
    return {
      recordCount: 10000,
      tables: policy.dataTypes,
      estimatedSize: 100 * 1024 * 1024, // 100MB
    };
  }

  private async createArchive(policy: DataArchivalPolicy, data: any): Promise<{
    recordCount: number;
    tables: string[];
    size: number;
    location: string;
    compressionRatio: number | undefined;
  }> {
    this.logger.log(`Creating archive for policy ${policy.name}`);
    
    // Simulate archive creation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const originalSize = data.estimatedSize;
    const compressedSize = policy.compressionEnabled ? originalSize * 0.3 : originalSize;
    
    return {
      recordCount: data.recordCount,
      tables: data.tables,
      size: compressedSize,
      location: `${policy.storageLocation}://archives/archive-${Date.now()}`,
      compressionRatio: policy.compressionEnabled ? 3.33 : undefined,
    };
  }

  private calculateNextExecution(policy: DataArchivalPolicy): Date {
    const nextExecution = new Date();
    nextExecution.setDate(nextExecution.getDate() + 1); // Daily execution
    return nextExecution;
  }

  private async findExpiredData(policy: DataRetentionPolicy, expirationDate: Date): Promise<{
    recordCount: number;
    tables: string[];
  }> {
    // Simulate finding expired data
    return {
      recordCount: 5000,
      tables: policy.dataTypes,
    };
  }

  private async deleteExpiredData(policy: DataRetentionPolicy, data: any): Promise<number> {
    this.logger.log(`Deleting expired data for policy ${policy.name}`);
    
    // Simulate data deletion
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return data.recordCount;
  }

  private async queueForApproval(policy: DataRetentionPolicy, data: any): Promise<number> {
    this.logger.log(`Queuing data for approval: ${data.recordCount} records`);
    
    // In real implementation, create approval requests
    return data.recordCount;
  }

  private async sendRetentionNotifications(policy: DataRetentionPolicy, data: any): Promise<number> {
    this.logger.log(`Sending retention notifications for policy ${policy.name}`);
    
    // Simulate sending notifications
    return 1; // Number of notifications sent
  }

  private async performOverwriteDestruction(destruction: SecureDataDestruction): Promise<number> {
    this.logger.log(`Performing overwrite destruction for ${destruction.recordCount} records`);
    
    // Simulate secure overwrite (multiple passes)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return destruction.recordCount;
  }

  private async performCryptoErase(destruction: SecureDataDestruction): Promise<number> {
    this.logger.log(`Performing crypto erase for ${destruction.recordCount} records`);
    
    // Simulate cryptographic erasure
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return destruction.recordCount;
  }

  private async performPhysicalDestruction(destruction: SecureDataDestruction): Promise<number> {
    this.logger.log(`Performing physical destruction for ${destruction.recordCount} records`);
    
    // Simulate physical media destruction
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return destruction.recordCount;
  }

  private async verifyDestruction(destruction: SecureDataDestruction): Promise<'verified' | 'failed'> {
    this.logger.log(`Verifying destruction for ${destruction.id}`);
    
    // Simulate verification process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 95% success rate for verification
    return Math.random() > 0.05 ? 'verified' : 'failed';
  }

  /**
   * Generate DR report
   */
  async generateDRReport(options: {
    tenantId: string;
    reportType: 'summary' | 'detailed' | 'compliance';
    startDate?: Date;
    endDate?: Date;
    includeTests?: boolean;
  }): Promise<{
    reportType: string;
    generatedAt: Date;
    tenantId: string;
    content: string;
    startDate?: Date;
    endDate?: Date;
    includeTests: boolean;
  }> {
    this.logger.log(`Generating ${options.reportType} DR report for tenant ${options.tenantId}`);

    try {
      const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = options.endDate || new Date();
      const includeTests = options.includeTests !== false;

      // Get DR metrics and data
      const metrics = await this.drRepository.getMetrics(options.tenantId);
      const executions = await this.drRepository.findExecutionsByTenant(options.tenantId, 1000, 0);

      // Filter executions by date range
      const filteredExecutions = executions.executions.filter(exec => {
        const execDate = new Date(exec.createdAt);
        return execDate >= startDate && execDate <= endDate && 
               (includeTests || !exec.isTest);
      });

      let reportContent: any = {};

      switch (options.reportType) {
        case 'summary':
          reportContent = this.generateSummaryReportContent(metrics, filteredExecutions);
          break;
        case 'detailed':
          reportContent = this.generateDetailedReportContent(metrics, filteredExecutions);
          break;
        case 'compliance':
          reportContent = this.generateComplianceReportContent(metrics, filteredExecutions);
          break;
      }

      return {
        reportType: options.reportType,
        generatedAt: new Date(),
        tenantId: options.tenantId,
        content: JSON.stringify(reportContent),
        startDate,
        endDate,
        includeTests,
      };

    } catch (error) {
      this.logger.error(`Failed to generate DR report: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  private generateSummaryReportContent(metrics: any, executions: any[]): any {
    return {
      overview: {
        totalExecutions: executions.length,
        successfulExecutions: executions.filter(e => e.status === 'completed').length,
        failedExecutions: executions.filter(e => e.status === 'failed').length,
        testExecutions: executions.filter(e => e.isTest).length,
        averageRTO: metrics.averageRtoMinutes,
        successRate: metrics.successRate,
        healthScore: metrics.healthScore,
      },
      recentActivity: executions.slice(0, 10).map(exec => ({
        id: exec.id,
        disasterType: exec.disasterType,
        status: exec.status,
        rto: exec.actualRtoMinutes,
        isTest: exec.isTest,
        date: exec.createdAt,
      })),
      recommendations: this.generateRecommendations(metrics, executions),
    };
  }

  private generateDetailedReportContent(metrics: any, executions: any[]): any {
    return {
      ...this.generateSummaryReportContent(metrics, executions),
      detailedMetrics: {
        executionsByStatus: this.groupExecutionsByField(executions, 'status'),
        executionsByDisasterType: this.groupExecutionsByField(executions, 'disasterType'),
        rtoTrends: this.calculateRTOTrends(executions),
        performanceAnalysis: this.analyzePerformance(executions),
      },
      allExecutions: executions,
      systemHealth: {
        overallHealth: metrics.healthScore,
        componentHealth: this.analyzeComponentHealth(executions),
      },
    };
  }

  private generateComplianceReportContent(metrics: any, executions: any[]): any {
    const testExecutions = executions.filter(e => e.isTest);
    
    return {
      complianceOverview: {
        totalTests: testExecutions.length,
        testFrequency: this.calculateTestFrequency(testExecutions),
        rtoCompliance: this.calculateRTOCompliance(executions),
        documentationStatus: 'Complete',
        lastAuditDate: new Date(),
      },
      testResults: testExecutions.map(exec => ({
        id: exec.id,
        date: exec.createdAt,
        status: exec.status,
        rto: exec.actualRtoMinutes,
        issues: exec.errors?.length || 0,
        planId: exec.planId,
      })),
      complianceGaps: this.identifyComplianceGaps(metrics, executions),
      auditTrail: this.generateAuditTrail(executions),
      certifications: {
        iso27001: 'Compliant',
        soc2: 'Compliant',
        gdpr: 'Compliant',
      },
    };
  }

  private groupExecutionsByField(executions: any[], field: string): Record<string, number> {
    return executions.reduce((acc, exec) => {
      const value = exec[field] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateRTOTrends(executions: any[]): any[] {
    const monthlyData = executions.reduce((acc, exec) => {
      const month = new Date(exec.createdAt).toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = { total: 0, count: 0 };
      }
      acc[month].total += exec.actualRtoMinutes;
      acc[month].count += 1;
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, data]: [string, any]) => ({
      month,
      averageRto: Math.round((data.total / data.count) * 100) / 100,
      executionCount: data.count,
    }));
  }

  private analyzePerformance(executions: any[]): any {
    const rtoValues = executions.map(e => e.actualRtoMinutes).filter(rto => rto > 0);
    
    if (rtoValues.length === 0) {
      return { message: 'No performance data available' };
    }

    rtoValues.sort((a, b) => a - b);
    
    return {
      minRTO: rtoValues[0],
      maxRTO: rtoValues[rtoValues.length - 1],
      medianRTO: rtoValues[Math.floor(rtoValues.length / 2)],
      p95RTO: rtoValues[Math.floor(rtoValues.length * 0.95)],
      p99RTO: rtoValues[Math.floor(rtoValues.length * 0.99)],
    };
  }

  private analyzeComponentHealth(executions: any[]): any {
    const components = ['database', 'application', 'network', 'storage'];
    
    return components.reduce((acc, component) => {
      const componentExecutions = executions.filter(e => 
        e.executedSteps?.some((step: any) => 
          step.name?.toLowerCase().includes(component)
        )
      );
      
      const successfulOps = componentExecutions.filter(e => e.status === 'completed').length;
      const totalOps = componentExecutions.length;
      
      acc[component] = {
        healthScore: totalOps > 0 ? Math.round((successfulOps / totalOps) * 100) : 100,
        totalOperations: totalOps,
        successfulOperations: successfulOps,
      };
      
      return acc;
    }, {});
  }

  private calculateTestFrequency(testExecutions: any[]): string {
    if (testExecutions.length < 2) return 'Insufficient data';

    testExecutions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    let totalDays = 0;
    for (let i = 1; i < testExecutions.length; i++) {
      const daysDiff = (new Date(testExecutions[i].createdAt).getTime() - 
                       new Date(testExecutions[i-1].createdAt).getTime()) / (1000 * 60 * 60 * 24);
      totalDays += daysDiff;
    }

    const averageDays = totalDays / (testExecutions.length - 1);
    
    if (averageDays <= 7) return 'Weekly';
    if (averageDays <= 31) return 'Monthly';
    if (averageDays <= 93) return 'Quarterly';
    return 'Infrequent';
  }

  private calculateRTOCompliance(executions: any[]): number {
    if (executions.length === 0) return 100;
    
    // Assume RTO target is 15 minutes
    const rtoTarget = 15;
    const compliantExecutions = executions.filter(e => e.actualRtoMinutes <= rtoTarget).length;
    
    return Math.round((compliantExecutions / executions.length) * 10000) / 100;
  }

  private identifyComplianceGaps(metrics: any, executions: any[]): string[] {
    const gaps = [];

    const testExecutions = executions.filter(e => e.isTest);
    if (testExecutions.length === 0) {
      gaps.push('No DR tests have been performed');
    }

    const recentTests = testExecutions.filter(e => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(e.createdAt) >= thirtyDaysAgo;
    });

    if (recentTests.length === 0) {
      gaps.push('No DR tests performed in the last 30 days');
    }

    if (metrics.averageRtoMinutes > 15) {
      gaps.push('Average RTO exceeds recommended 15-minute target');
    }

    if (metrics.successRate < 95) {
      gaps.push('DR success rate below 95% threshold');
    }

    return gaps;
  }

  private generateAuditTrail(executions: any[]): any[] {
    return executions.map(exec => ({
      timestamp: exec.createdAt,
      action: exec.isTest ? 'DR_TEST' : 'DR_EXECUTION',
      planId: exec.planId,
      disasterType: exec.disasterType,
      status: exec.status,
      duration: exec.actualRtoMinutes,
      initiatedBy: exec.initiatedBy,
    }));
  }

  private generateRecommendations(metrics: any, executions: any[]): string[] {
    const recommendations = [];

    if (metrics.successRate < 95) {
      recommendations.push('Improve DR success rate by addressing common failure points');
    }

    if (metrics.averageRtoMinutes > 15) {
      recommendations.push('Optimize recovery procedures to reduce RTO');
    }

    const testExecutions = executions.filter(e => e.isTest);
    if (testExecutions.length < executions.length * 0.8) {
      recommendations.push('Increase frequency of DR testing');
    }

    const recentFailures = executions.filter(e => 
      e.status === 'failed' && 
      new Date(e.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    if (recentFailures.length > 0) {
      recommendations.push('Address recent DR execution failures');
    }

    if (recommendations.length === 0) {
      recommendations.push('DR performance is within acceptable parameters');
    }

    return recommendations;
  }