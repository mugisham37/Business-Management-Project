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
        tenantId: event.tenantId || null,
        userId: event.userId || null,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId || null,
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
      this.logger.error(`Failed to log audit event: ${error.message}`, error.stack);
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
        whereConditions.push(eq(auditLogs.action, query.action));
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
          if (this.encryptSensitiveData && log.tenantId && log.metadata?.encrypted) {
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
              this.logger.error(`Failed to decrypt audit log ${log.id}: ${error.message}`);
              return log; // Return encrypted version if decryption fails
            }
          }

          return log;
        })
      );

      return decryptedResults;
    } catch (error) {
      this.logger.error(`Failed to query audit logs: ${error.message}`, error.stack);
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
      this.logger.error(`Failed to generate compliance report: ${error.message}`, error.stack);
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
      this.logger.error(`Failed to cleanup old audit logs: ${error.message}`, error.stack);
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
      this.logger.error(`Failed to export audit logs: ${error.message}`, error.stack);
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
        tenantId: event.tenantId,
        userId: event.userId,
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
        tenantId: event.tenantId,
        userId: event.userId,
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
}