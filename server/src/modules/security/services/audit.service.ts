import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, and, gte, lte, desc, asc } from 'drizzle-orm';

import { DrizzleService } from '../../database/drizzle.service';
import { auditLogs } from '../../database/schema/tenant.schema';
import { EncryptionService } from './encryption.service';

export interface AuditEvent {
  tenantId?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'security' | 'data' | 'system' | 'user' | 'compliance';
}

export interface AuditQuery {
  tenantId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: string;
  category?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}

export interface ComplianceReport {
  tenantId: string;
  reportType: 'SOC2' | 'GDPR' | 'PCI_DSS' | 'HIPAA';
  startDate: Date;
  endDate: Date;
  totalEvents: number;
  securityEvents: number;
  dataAccessEvents: number;
  userEvents: number;
  systemEvents: number;
  criticalEvents: number;
  violations: AuditViolation[];
  recommendations: string[];
}

export interface AuditViolation {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedResources: string[];
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly retentionPeriodDays: number;
  private readonly encryptSensitiveData: boolean;

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.retentionPeriodDays = this.configService.get<number>('AUDIT_RETENTION_DAYS', 2555); // 7 years default
    this.encryptSensitiveData = this.configService.get<boolean>('ENCRYPT_AUDIT_DATA', true);
  }

  /**
   * Log audit event with immutable timestamp
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      const db = this.drizzleService.getDb();

      // Validate and normalize action to allowed enum values
      const validActions = ['create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import'] as const;
      const action = validActions.includes(event.action as any) 
        ? (event.action as typeof validActions[number]) 
        : 'read'; // Default to 'read' if invalid

      // Mask sensitive data in old/new values
      const maskedOldValues = event.oldValues 
        ? this.encryptionService.maskSensitiveData(event.oldValues)
        : null;
      
      const maskedNewValues = event.newValues 
        ? this.encryptionService.maskSensitiveData(event.newValues)
        : null;

      // Encrypt sensitive audit data if enabled
      let encryptedOldValues = maskedOldValues;
      let encryptedNewValues = maskedNewValues;
      let encryptedMetadata = event.metadata;

      if (this.encryptSensitiveData && event.tenantId) {
        if (maskedOldValues) {
          encryptedOldValues = JSON.parse(
            await this.encryptionService.encryptField(
              JSON.stringify(maskedOldValues),
              event.tenantId,
              'audit_old_values'
            )
          );
        }

        if (maskedNewValues) {
          encryptedNewValues = JSON.parse(
            await this.encryptionService.encryptField(
              JSON.stringify(maskedNewValues),
              event.tenantId,
              'audit_new_values'
            )
          );
        }

        if (event.metadata) {
          encryptedMetadata = JSON.parse(
            await this.encryptionService.encryptField(
              JSON.stringify(event.metadata),
              event.tenantId,
              'audit_metadata'
            )
          );
        }
      }

      // Create immutable audit log entry
      await db.insert(auditLogs).values({
        tenantId: event.tenantId ? event.tenantId : null,
        userId: event.userId ? event.userId : null,
        action,
        resource: event.resource,
        resourceId: event.resourceId ? event.resourceId : null,
        oldValues: encryptedOldValues,
        newValues: encryptedNewValues,
        metadata: {
          ...encryptedMetadata,
          severity: event.severity || 'medium',
          category: event.category || 'system',
          encrypted: this.encryptSensitiveData,
        },
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        requestId: event.requestId || null,
      });

      // Emit audit event for real-time monitoring
      this.eventEmitter.emit('audit.logged', {
        ...event,
        timestamp: new Date(),
      });

      // Check for security violations
      await this.checkSecurityViolations(event);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to log audit event: ${errorMessage}`, errorStack);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async queryLogs(query: AuditQuery): Promise<any[]> {
    try {
      const db = this.drizzleService.getDb();
      
      let whereConditions: any[] = [];

      if (query.tenantId) {
        whereConditions.push(eq(auditLogs.tenantId, query.tenantId));
      }

      if (query.userId) {
        whereConditions.push(eq(auditLogs.userId, query.userId));
      }

      if (query.action) {
        const validActions = ['create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import'] as const;
        if (validActions.includes(query.action as any)) {
          whereConditions.push(eq(auditLogs.action, query.action as typeof validActions[number]));
        }
      }

      if (query.resource) {
        whereConditions.push(eq(auditLogs.resource, query.resource));
      }

      if (query.startDate) {
        whereConditions.push(gte(auditLogs.createdAt, query.startDate));
      }

      if (query.endDate) {
        whereConditions.push(lte(auditLogs.createdAt, query.endDate));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
      const orderBy = query.orderBy === 'asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt);

      const results = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(query.limit || 100)
        .offset(query.offset || 0);

      // Decrypt sensitive data if needed
      const decryptedResults = await Promise.all(
        results.map(async (log) => {
          if (this.encryptSensitiveData && log.tenantId && (log.metadata as any)?.encrypted) {
            try {
              const decryptedLog = { ...log };

              if (log.oldValues) {
                const decryptedOldValues = await this.encryptionService.decryptField(
                  JSON.stringify(log.oldValues),
                  log.tenantId,
                  'audit_old_values'
                );
                decryptedLog.oldValues = JSON.parse(decryptedOldValues);
              }

              if (log.newValues) {
                const decryptedNewValues = await this.encryptionService.decryptField(
                  JSON.stringify(log.newValues),
                  log.tenantId,
                  'audit_new_values'
                );
                decryptedLog.newValues = JSON.parse(decryptedNewValues);
              }

              if (log.metadata && Object.keys(log.metadata).length > 0) {
                const decryptedMetadata = await this.encryptionService.decryptField(
                  JSON.stringify(log.metadata),
                  log.tenantId,
                  'audit_metadata'
                );
                decryptedLog.metadata = JSON.parse(decryptedMetadata);
              }

              return decryptedLog;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logger.error(`Failed to decrypt audit log ${log.id}: ${errorMessage}`);
              return log; // Return encrypted version if decryption fails
            }
          }

          return log;
        })
      );

      return decryptedResults;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to query audit logs: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    reportType: 'SOC2' | 'GDPR' | 'PCI_DSS' | 'HIPAA',
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    try {
      const logs = await this.queryLogs({
        tenantId,
        startDate,
        endDate,
        limit: 10000, // Large limit for comprehensive report
      });

      const totalEvents = logs.length;
      const securityEvents = logs.filter(log => log.metadata?.category === 'security').length;
      const dataAccessEvents = logs.filter(log => log.metadata?.category === 'data').length;
      const userEvents = logs.filter(log => log.metadata?.category === 'user').length;
      const systemEvents = logs.filter(log => log.metadata?.category === 'system').length;
      const criticalEvents = logs.filter(log => log.metadata?.severity === 'critical').length;

      const violations = await this.detectComplianceViolations(logs, reportType);
      const recommendations = this.generateComplianceRecommendations(violations, reportType);

      return {
        tenantId,
        reportType,
        startDate,
        endDate,
        totalEvents,
        securityEvents,
        dataAccessEvents,
        userEvents,
        systemEvents,
        criticalEvents,
        violations,
        recommendations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to generate compliance report: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const db = this.drizzleService.getDb();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriodDays);

      const result = await db
        .delete(auditLogs)
        .where(lte(auditLogs.createdAt, cutoffDate));

      this.logger.log(`Cleaned up ${result.rowCount || 0} old audit logs`);
      return result.rowCount || 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to cleanup old audit logs: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportLogs(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const logs = await this.queryLogs({
        tenantId,
        startDate,
        endDate,
        limit: 50000, // Large limit for export
      });

      if (format === 'csv') {
        return this.convertLogsToCSV(logs);
      }

      return JSON.stringify(logs, null, 2);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to export audit logs: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Check for security violations in audit events
   */
  private async checkSecurityViolations(event: AuditEvent): Promise<void> {
    const violations: string[] = [];

    // Check for suspicious login patterns
    if (event.action === 'login' && event.metadata?.failed) {
      const recentFailedLogins = await this.queryLogs({
        ...(event.tenantId ? { tenantId: event.tenantId } : {}),
        ...(event.userId ? { userId: event.userId } : {}),
        action: 'login',
        startDate: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
      });

      const failedCount = recentFailedLogins.filter(log => log.metadata?.failed).length;
      if (failedCount >= 5) {
        violations.push('Multiple failed login attempts detected');
      }
    }

    // Check for unusual data access patterns
    if (event.action === 'read' && event.resource === 'sensitive_data') {
      const recentAccess = await this.queryLogs({
        ...(event.tenantId ? { tenantId: event.tenantId } : {}),
        ...(event.userId ? { userId: event.userId } : {}),
        action: 'read',
        resource: 'sensitive_data',
        startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      });

      if (recentAccess.length > 100) {
        violations.push('Unusual data access pattern detected');
      }
    }

    // Check for privilege escalation
    if (event.action === 'update' && event.resource === 'user_permissions') {
      if (event.newValues?.permissions && event.oldValues?.permissions) {
        const oldPerms = event.oldValues.permissions as string[];
        const newPerms = event.newValues.permissions as string[];
        const addedPerms = newPerms.filter(p => !oldPerms.includes(p));
        
        if (addedPerms.some(p => p.includes('admin') || p.includes('super'))) {
          violations.push('Privilege escalation detected');
        }
      }
    }

    // Emit security alerts for violations
    if (violations.length > 0) {
      this.eventEmitter.emit('security.violation', {
        tenantId: event.tenantId,
        userId: event.userId,
        violations,
        event,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Detect compliance violations in audit logs
   */
  private async detectComplianceViolations(
    logs: any[],
    reportType: string
  ): Promise<AuditViolation[]> {
    const violations: AuditViolation[] = [];

    // GDPR violations
    if (reportType === 'GDPR') {
      // Check for data access without consent
      const dataAccessLogs = logs.filter(log => 
        log.action === 'read' && 
        log.resource.includes('personal_data') &&
        !log.metadata?.consent
      );

      if (dataAccessLogs.length > 0) {
        violations.push({
          type: 'GDPR_DATA_ACCESS_WITHOUT_CONSENT',
          description: 'Personal data accessed without explicit consent',
          severity: 'high',
          count: dataAccessLogs.length,
          firstOccurrence: new Date(Math.min(...dataAccessLogs.map(l => l.createdAt.getTime()))),
          lastOccurrence: new Date(Math.max(...dataAccessLogs.map(l => l.createdAt.getTime()))),
          affectedResources: [...new Set(dataAccessLogs.map(l => l.resourceId))],
        });
      }
    }

    // PCI DSS violations
    if (reportType === 'PCI_DSS') {
      // Check for unencrypted payment data access
      const paymentDataLogs = logs.filter(log => 
        log.resource.includes('payment') &&
        !log.metadata?.encrypted
      );

      if (paymentDataLogs.length > 0) {
        violations.push({
          type: 'PCI_UNENCRYPTED_PAYMENT_DATA',
          description: 'Payment data accessed without encryption',
          severity: 'critical',
          count: paymentDataLogs.length,
          firstOccurrence: new Date(Math.min(...paymentDataLogs.map(l => l.createdAt.getTime()))),
          lastOccurrence: new Date(Math.max(...paymentDataLogs.map(l => l.createdAt.getTime()))),
          affectedResources: [...new Set(paymentDataLogs.map(l => l.resourceId))],
        });
      }
    }

    return violations;
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(
    violations: AuditViolation[],
    reportType: string
  ): string[] {
    const recommendations: string[] = [];

    violations.forEach(violation => {
      switch (violation.type) {
        case 'GDPR_DATA_ACCESS_WITHOUT_CONSENT':
          recommendations.push('Implement explicit consent tracking for all personal data access');
          recommendations.push('Review and update privacy policies');
          break;
        case 'PCI_UNENCRYPTED_PAYMENT_DATA':
          recommendations.push('Enable encryption for all payment data storage and transmission');
          recommendations.push('Implement tokenization for sensitive payment information');
          break;
      }
    });

    // General recommendations based on report type
    if (reportType === 'SOC2') {
      recommendations.push('Implement regular access reviews');
      recommendations.push('Enhance monitoring and alerting systems');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertLogsToCSV(logs: any[]): string {
    if (logs.length === 0) {
      return 'No data available';
    }

    const headers = [
      'Timestamp',
      'Tenant ID',
      'User ID',
      'Action',
      'Resource',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Severity',
      'Category'
    ];

    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.createdAt.toISOString(),
        log.tenantId || '',
        log.userId || '',
        log.action,
        log.resource,
        log.resourceId || '',
        log.ipAddress || '',
        `"${log.userAgent || ''}"`, // Quoted to handle commas
        log.metadata?.severity || '',
        log.metadata?.category || '',
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Generate audit report for specified period and type
   */
  async generateReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    reportType: string = 'summary',
  ): Promise<any> {
    try {
      const query: AuditQuery = {
        tenantId,
        startDate,
        endDate,
        limit: 10000,
      };

      const logs = await this.queryLogs(query);
      const stats = await this.getStatistics(tenantId, startDate, endDate);

      return {
        id: `report-${Date.now()}`,
        tenantId,
        reportType,
        period: { startDate, endDate },
        summary: stats,
        logs: reportType === 'detailed' ? logs : logs.slice(0, 100),
        generatedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate report: ${errorMessage}`);
      throw new Error('Report generation failed');
    }
  }

  /**
   * Get audit statistics for a time period
   */
  async getStatistics(tenantId: string | undefined, startDate: Date, endDate: Date): Promise<any> {
    try {
      const query: AuditQuery = { 
        ...(tenantId ? { tenantId } : {}),
        startDate, 
        endDate, 
        limit: 10000 
      };
      const logs = await this.queryLogs(query);

      const stats = {
        totalEvents: logs.length,
        byAction: {} as Record<string, number>,
        byResource: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
        criticalEventCount: 0,
      };

      logs.forEach(log => {
        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
        stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
        if (log.metadata?.category) {
          stats.byCategory[log.metadata.category] = (stats.byCategory[log.metadata.category] || 0) + 1;
        }
        if (log.metadata?.severity) {
          stats.bySeverity[log.metadata.severity] = (stats.bySeverity[log.metadata.severity] || 0) + 1;
          if (log.metadata.severity === 'critical') {
            stats.criticalEventCount++;
          }
        }
        if (log.userId) {
          stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get statistics: ${errorMessage}`);
      return { totalEvents: 0, byAction: {}, byResource: {}, byCategory: {}, bySeverity: {}, byUser: {} };
    }
  }

  /**
   * Search logs with advanced filtering and full-text search
   */
  async searchLogs(searchOptions: any): Promise<{ logs: any[]; total: number }> {
    try {
      const query: AuditQuery = {
        tenantId: searchOptions.tenantId,
        limit: searchOptions.limit,
        offset: searchOptions.offset,
      };

      // Simple text search in action and resource fields
      if (searchOptions.query) {
        const searchQuery = searchOptions.query.toLowerCase();
        const allLogs = await this.queryLogs({ ...query, limit: 10000 });
        const filteredLogs = allLogs.filter(log =>
          log.action.toLowerCase().includes(searchQuery) ||
          log.resource.toLowerCase().includes(searchQuery)
        );

        // Apply offset and limit
        const total = filteredLogs.length;
        const logs = filteredLogs.slice(searchOptions.offset, searchOptions.offset + searchOptions.limit);

        // Apply additional filters
        if (searchOptions.filters) {
          if (searchOptions.filters.severity) {
            logs.filter(log => log.metadata?.severity === searchOptions.filters.severity);
          }
          if (searchOptions.filters.category) {
            logs.filter(log => log.metadata?.category === searchOptions.filters.category);
          }
        }

        return { logs, total };
      }

      const logs = await this.queryLogs(query);
      return { logs, total: logs.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to search logs: ${errorMessage}`);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Initiate audit log export job
   */
  async initiateExport(exportRequest: any): Promise<string> {
    try {
      const exportId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // In a production system, this would queue a background job
      // For now, we'll just return the export ID
      const query: AuditQuery = {
        tenantId: exportRequest.tenantId,
        startDate: exportRequest.startDate,
        endDate: exportRequest.endDate,
        limit: 100000,
      };

      const logs = await this.queryLogs(query);

      // Store export metadata (in production, this would be in a cache/DB)
      this.logger.log(`Export ${exportId} initiated with ${logs.length} logs`);

      return exportId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initiate export: ${errorMessage}`);
      throw new Error('Export initiation failed');
    }
  }

  /**
   * Get compliance audit trail
   */
  async getComplianceTrail(
    tenantId: string | undefined,
    startDate: Date,
    endDate: Date,
    framework?: string,
  ): Promise<any[]> {
    try {
      const query: AuditQuery = {
        ...(tenantId ? { tenantId } : {}),
        startDate,
        endDate,
        limit: 10000,
        category: 'compliance',
      };

      const logs = await this.queryLogs(query);

      // Filter by compliance framework if specified
      if (framework) {
        return logs.filter(log => log.metadata?.complianceFramework === framework);
      }

      return logs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get compliance trail: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Verify integrity of audit logs
   */
  async verifyIntegrity(tenantId: string): Promise<any> {
    try {
      const query: AuditQuery = { tenantId, limit: 10000 };
      const logs = await this.queryLogs(query);

      // Basic integrity checks
      const result = {
        isIntegrityValid: true,
        totalLogsVerified: logs.length,
        checksPerformed: [] as string[],
        anomalies: [] as string[],
      };

      // Check for gaps in timestamps
      result.checksPerformed.push('timestamp_continuity');
      if (logs.length > 1) {
        for (let i = 1; i < logs.length; i++) {
          const timeDiff = logs[i].createdAt.getTime() - logs[i - 1].createdAt.getTime();
          // Allow up to 1 hour gaps (3600000ms)
          if (timeDiff > 3600000 && i < logs.length - 1) {
            result.anomalies.push(`Large time gap detected at log ${i}`);
            result.isIntegrityValid = false;
          }
        }
      }

      // Check for required fields
      result.checksPerformed.push('field_completeness');
      logs.forEach((log, index) => {
        if (!log.action || !log.resource) {
          result.anomalies.push(`Missing required fields at log ${index}`);
          result.isIntegrityValid = false;
        }
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to verify integrity: ${errorMessage}`);
      return {
        isIntegrityValid: false,
        totalLogsVerified: 0,
        checksPerformed: [],
        anomalies: [errorMessage],
      };
    }
  }
}