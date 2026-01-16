import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService, AuditEvent, AuditQuery } from './audit.service';
import { ComplianceService } from './compliance.service';
import { ThreatDetectionService } from './threat-detection.service';
import { EncryptionService } from './encryption.service';
import { KeyManagementService } from './key-management.service';
import { SecurityMonitoringService } from './security-monitoring.service';
import { EnterpriseAuthService } from './enterprise-auth.service';
import { PenetrationTestingService } from './penetration-testing.service';
import { DataDeletionService } from './data-deletion.service';

/**
 * Central orchestration service that coordinates all security operations
 * Ensures all service capabilities are utilized and interconnected
 * Acts as the unified entry point for the security module
 */
@Injectable()
export class SecurityOrchestratorService {
  private readonly logger = new Logger(SecurityOrchestratorService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly complianceService: ComplianceService,
    private readonly threatDetectionService: ThreatDetectionService,
    private readonly encryptionService: EncryptionService,
    private readonly keyManagementService: KeyManagementService,
    private readonly securityMonitoringService: SecurityMonitoringService,
    private readonly enterpriseAuthService: EnterpriseAuthService,
    private readonly penetrationTestingService: PenetrationTestingService,
    private readonly dataDeletionService: DataDeletionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeOrchestrator();
  }

  /**
   * Initialize orchestrator and set up cross-service communication
   */
  private initializeOrchestrator(): void {
    this.logger.log('Initializing Security Orchestrator');
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for cross-service communication
   */
  private setupEventListeners(): void {
    // Listen to audit events and trigger threat analysis
    this.eventEmitter.on('audit.logged', async (event: AuditEvent) => {
      try {
        const threatAnalyses = await this.threatDetectionService.analyzeEvent(event);
        if (threatAnalyses.length > 0) {
          this.eventEmitter.emit('security.threats_detected', {
            event,
            threats: threatAnalyses,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        this.logger.error('Error analyzing event for threats', error);
      }
    });

    // Listen to threat detections and trigger compliance checks
    this.eventEmitter.on('security.threats_detected', async (data: any) => {
      try {
        const complianceStatus = await this.complianceService.getComplianceStatus(
          data.event.tenantId,
        );
        if (complianceStatus) {
          this.eventEmitter.emit('security.compliance_check', {
            threats: data.threats,
            compliance: complianceStatus,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        this.logger.error('Error checking compliance', error);
      }
    });
  }

  // ============================================================================
  // AUDIT OPERATIONS
  // ============================================================================

  /**
   * Log security event with full audit trail
   */
  async logSecurityEvent(event: AuditEvent): Promise<void> {
    try {
      await this.auditService.logEvent(event);
      this.eventEmitter.emit('audit.logged', event);
      this.logger.debug(`Security event logged: ${event.action}`);
    } catch (error) {
      this.logger.error('Failed to log security event', error);
      throw error;
    }
  }

  /**
   * Query audit logs with comprehensive filtering
   */
  async queryAuditLogs(query: AuditQuery): Promise<any[]> {
    try {
      return await this.auditService.queryLogs(query);
    } catch (error) {
      this.logger.error('Failed to query audit logs', error);
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLog(tenantId: string, logId: string): Promise<any | null> {
    try {
      return await this.auditService.getLogById(tenantId, logId);
    } catch (error) {
      this.logger.error('Failed to get audit log', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive audit report for compliance
   */
  async generateAuditReport(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const logs = await this.auditService.queryLogs({
        tenantId,
        startDate,
        endDate,
      });

      return {
        tenantId,
        period: { startDate, endDate },
        totalEvents: logs.length,
        eventsByType: this.groupBy(logs, (l) => l.action),
        eventsBySeverity: this.groupBy(logs, (l) => l.severity),
        eventsByCategory: this.groupBy(logs, (l) => l.category),
        events: logs,
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to generate audit report', error);
      throw error;
    }
  }

  /**
   * Analyze audit patterns for anomalies
   */
  async analyzeAuditPatterns(tenantId: string, timeWindowDays: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeWindowDays);

      const logs = await this.auditService.queryLogs({
        tenantId,
        startDate,
        endDate: new Date(),
        limit: 10000,
      });

      const patterns = {
        topActions: this.getTopItems(logs, 'action', 10),
        topResources: this.getTopItems(logs, 'resource', 10),
        topUsers: this.getTopItems(logs, 'userId', 10),
        topCategories: this.getTopItems(logs, 'category', 5),
        timeDistribution: this.analyzeTimeDistribution(logs),
        anomalies: this.detectAnomalies(logs),
      };

      return patterns;
    } catch (error) {
      this.logger.error('Failed to analyze audit patterns', error);
      throw error;
    }
  }

  // ============================================================================
  // COMPLIANCE OPERATIONS
  // ============================================================================

  /**
   * Get comprehensive compliance status
   */
  async getComplianceStatus(tenantId: string): Promise<any> {
    try {
      return await this.complianceService.getComplianceStatus(tenantId);
    } catch (error) {
      this.logger.error('Failed to get compliance status', error);
      throw error;
    }
  }

  /**
   * Generate compliance report for specific framework
   */
  async generateComplianceReport(tenantId: string, frameworkId: string): Promise<any> {
    try {
      return await this.complianceService.generateComplianceReport(tenantId, frameworkId);
    } catch (error) {
      this.logger.error('Failed to generate compliance report', error);
      throw error;
    }
  }

  /**
   * Get available compliance frameworks
   */
  async getComplianceFrameworks(): Promise<any[]> {
    try {
      return await this.complianceService.getFrameworks();
    } catch (error) {
      this.logger.error('Failed to get compliance frameworks', error);
      throw error;
    }
  }

  /**
   * Get compliance reports for period
   */
  async getComplianceReports(
    tenantId: string,
    options: { frameworkId?: string; startDate?: Date; endDate?: Date },
  ): Promise<any[]> {
    try {
      return await this.complianceService.getReports(tenantId, options);
    } catch (error) {
      this.logger.error('Failed to get compliance reports', error);
      throw error;
    }
  }

  // ============================================================================
  // THREAT DETECTION OPERATIONS
  // ============================================================================

  /**
   * Analyze event for threats
   */
  async analyzeThreat(event: any): Promise<any[]> {
    try {
      const analyses = await this.threatDetectionService.analyzeEvent(event);
      if (analyses.length > 0) {
        this.eventEmitter.emit('security.threats_detected', {
          event,
          analyses,
          timestamp: new Date(),
        });
      }
      return analyses;
    } catch (error) {
      this.logger.error('Failed to analyze threat', error);
      throw error;
    }
  }

  /**
   * Manage threat patterns
   */
  async addThreatPattern(pattern: any): Promise<void> {
    try {
      await this.threatDetectionService.addThreatPattern(pattern);
      this.eventEmitter.emit('security.threat_pattern_added', pattern);
    } catch (error) {
      this.logger.error('Failed to add threat pattern', error);
      throw error;
    }
  }

  /**
   * Remove threat pattern
   */
  async removeThreatPattern(patternId: string): Promise<void> {
    try {
      await this.threatDetectionService.removeThreatPattern(patternId);
      this.eventEmitter.emit('security.threat_pattern_removed', { patternId });
    } catch (error) {
      this.logger.error('Failed to remove threat pattern', error);
      throw error;
    }
  }

  /**
   * Get all threat patterns
   */
  async getThreatPatterns(): Promise<any[]> {
    try {
      return await this.threatDetectionService.getThreatPatterns();
    } catch (error) {
      this.logger.error('Failed to get threat patterns', error);
      throw error;
    }
  }

  /**
   * Toggle threat pattern
   */
  async toggleThreatPattern(patternId: string, enabled: boolean): Promise<void> {
    try {
      await this.threatDetectionService.toggleThreatPattern(patternId, enabled);
      this.eventEmitter.emit('security.threat_pattern_toggled', { patternId, enabled });
    } catch (error) {
      this.logger.error('Failed to toggle threat pattern', error);
      throw error;
    }
  }

  /**
   * Perform behavioral analysis on user
   */
  async performBehavioralAnalysis(userId: string, tenantId: string): Promise<any[]> {
    try {
      return await this.threatDetectionService.performBehavioralAnalysis(userId, tenantId);
    } catch (error) {
      this.logger.error('Failed to perform behavioral analysis', error);
      throw error;
    }
  }

  /**
   * Check if account is compromised
   */
  async checkAccountCompromise(tenantId: string, userId: string): Promise<boolean> {
    try {
      return await this.threatDetectionService.isAccountCompromised(tenantId, userId);
    } catch (error) {
      this.logger.error('Failed to check account compromise', error);
      throw error;
    }
  }

  /**
   * Get active threats
   */
  async getActiveThreats(tenantId: string, limit?: number): Promise<any[]> {
    try {
      return await this.threatDetectionService.getActiveThreats(tenantId, limit);
    } catch (error) {
      this.logger.error('Failed to get active threats', error);
      throw error;
    }
  }

  // ============================================================================
  // ENCRYPTION OPERATIONS
  // ============================================================================

  /**
   * Encrypt field data
   */
  async encryptField(data: string, tenantId: string, fieldName: string): Promise<string> {
    try {
      return await this.encryptionService.encryptField(data, tenantId, fieldName);
    } catch (error) {
      this.logger.error('Failed to encrypt field', error);
      throw error;
    }
  }

  /**
   * Decrypt field data
   */
  async decryptField(encryptedData: string, tenantId: string, fieldName: string): Promise<string> {
    try {
      return await this.encryptionService.decryptField(encryptedData, tenantId, fieldName);
    } catch (error) {
      this.logger.error('Failed to decrypt field', error);
      throw error;
    }
  }

  /**
   * Encrypt data at rest
   */
  async encryptAtRest(data: string, context?: string): Promise<string> {
    try {
      return await this.encryptionService.encryptAtRest(data, context);
    } catch (error) {
      this.logger.error('Failed to encrypt data at rest', error);
      throw error;
    }
  }

  /**
   * Decrypt data at rest
   */
  async decryptAtRest(encryptedData: string, context?: string): Promise<string> {
    try {
      return await this.encryptionService.decryptAtRest(encryptedData, context);
    } catch (error) {
      this.logger.error('Failed to decrypt data at rest', error);
      throw error;
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await this.encryptionService.hashPassword(password);
    } catch (error) {
      this.logger.error('Failed to hash password', error);
      throw error;
    }
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await this.encryptionService.verifyPassword(password, hash);
    } catch (error) {
      this.logger.error('Failed to verify password', error);
      throw error;
    }
  }

  /**
   * Mask sensitive data
   */
  maskSensitiveData(data: Record<string, any>): Record<string, any> {
    try {
      return this.encryptionService.maskSensitiveData(data);
    } catch (error) {
      this.logger.error('Failed to mask sensitive data', error);
      throw error;
    }
  }

  // ============================================================================
  // KEY MANAGEMENT OPERATIONS
  // ============================================================================

  /**
   * Generate tenant key
   */
  async generateTenantKey(
    tenantId: string,
    keyType: 'tenant' | 'field' | 'backup' = 'tenant',
  ): Promise<any> {
    try {
      const key = await this.keyManagementService.generateTenantKey(tenantId, keyType);
      await this.logSecurityEvent({
        tenantId,
        action: 'key_generated',
        resource: 'encryption_key',
        resourceId: key.id,
        metadata: { keyType, version: key.version },
        severity: 'medium',
        category: 'security',
      });
      this.eventEmitter.emit('security.key_generated', key);
      return key;
    } catch (error) {
      this.logger.error('Failed to generate tenant key', error);
      throw error;
    }
  }

  /**
   * Rotate keys for tenant
   */
  async rotateKeys(tenantId: string, keyType?: string): Promise<void> {
    try {
      await this.keyManagementService.rotateKeys(tenantId, keyType);
      await this.logSecurityEvent({
        tenantId,
        action: 'keys_rotated',
        resource: 'encryption_key',
        metadata: { keyType: keyType || 'all' },
        severity: 'high',
        category: 'security',
      });
      this.eventEmitter.emit('security.keys_rotated', { tenantId, keyType });
    } catch (error) {
      this.logger.error('Failed to rotate keys', error);
      throw error;
    }
  }

  /**
   * Get key history
   */
  async getKeyHistory(tenantId: string, keyType?: string): Promise<any[]> {
    try {
      return await this.keyManagementService.getKeyHistory(tenantId, keyType);
    } catch (error) {
      this.logger.error('Failed to get key history', error);
      throw error;
    }
  }

  /**
   * Get active keys
   */
  async getActiveKeys(tenantId: string): Promise<any[]> {
    try {
      return await this.keyManagementService.getActiveKeys(tenantId);
    } catch (error) {
      this.logger.error('Failed to get active keys', error);
      throw error;
    }
  }

  /**
   * Revoke key
   */
  async revokeKey(keyId: string, tenantId: string): Promise<void> {
    try {
      await this.keyManagementService.revokeKey(keyId);
      await this.logSecurityEvent({
        tenantId,
        action: 'key_revoked',
        resource: 'encryption_key',
        resourceId: keyId,
        severity: 'high',
        category: 'security',
      });
      this.eventEmitter.emit('security.key_revoked', { keyId });
    } catch (error) {
      this.logger.error('Failed to revoke key', error);
      throw error;
    }
  }

  // ============================================================================
  // MONITORING OPERATIONS
  // ============================================================================

  /**
   * Get current security metrics
   */
  async getSecurityMetrics(tenantId: string): Promise<any> {
    try {
      return await this.securityMonitoringService.getCurrentMetrics(tenantId);
    } catch (error) {
      this.logger.error('Failed to get security metrics', error);
      throw error;
    }
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(
    tenantId: string,
    options: { period?: string; startDate?: Date; endDate?: Date },
  ): Promise<any> {
    try {
      return await this.securityMonitoringService.getMetrics(tenantId, options);
    } catch (error) {
      this.logger.error('Failed to get historical metrics', error);
      throw error;
    }
  }

  /**
   * Get recent security events
   */
  async getRecentSecurityEvents(tenantId: string, limit: number = 20): Promise<any[]> {
    try {
      return await this.securityMonitoringService.getRecentEvents(tenantId, limit);
    } catch (error) {
      this.logger.error('Failed to get recent events', error);
      throw error;
    }
  }

  /**
   * Get security settings
   */
  async getSecuritySettings(tenantId: string): Promise<any> {
    try {
      return await this.securityMonitoringService.getSecuritySettings(tenantId);
    } catch (error) {
      this.logger.error('Failed to get security settings', error);
      throw error;
    }
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(tenantId: string, settings: any, userId: string): Promise<any> {
    try {
      const updated = await this.securityMonitoringService.updateSecuritySettings(
        tenantId,
        settings,
        userId,
      );
      await this.logSecurityEvent({
        tenantId,
        userId,
        action: 'security_settings_updated',
        resource: 'security_settings',
        resourceId: tenantId,
        newValues: settings,
        severity: 'medium',
        category: 'security',
      });
      this.eventEmitter.emit('security.settings_updated', { tenantId, settings });
      return updated;
    } catch (error) {
      this.logger.error('Failed to update security settings', error);
      throw error;
    }
  }

  /**
   * Acknowledge security alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await this.securityMonitoringService.acknowledgeAlert(alertId, userId);
      this.eventEmitter.emit('security.alert_acknowledged', { alertId, userId });
    } catch (error) {
      this.logger.error('Failed to acknowledge alert', error);
      throw error;
    }
  }

  // ============================================================================
  // ENTERPRISE AUTHENTICATION OPERATIONS
  // ============================================================================

  /**
   * Configure SAML
   */
  async configureSAML(config: any): Promise<void> {
    try {
      await this.enterpriseAuthService.configureSAML(config);
      await this.logSecurityEvent({
        tenantId: config.tenantId,
        action: 'saml_configured',
        resource: 'sso_configuration',
        resourceId: config.tenantId,
        severity: 'high',
        category: 'security',
      });
      this.eventEmitter.emit('security.saml_configured', config);
    } catch (error) {
      this.logger.error('Failed to configure SAML', error);
      throw error;
    }
  }

  /**
   * Get SAML configuration
   */
  async getSAMLConfig(tenantId: string): Promise<any> {
    try {
      return await this.enterpriseAuthService.getSAMLConfig(tenantId);
    } catch (error) {
      this.logger.error('Failed to get SAML config', error);
      throw error;
    }
  }

  /**
   * Configure LDAP
   */
  async configureLDAP(config: any): Promise<void> {
    try {
      await this.enterpriseAuthService.configureLDAP(config);
      await this.logSecurityEvent({
        tenantId: config.tenantId,
        action: 'ldap_configured',
        resource: 'sso_configuration',
        resourceId: config.tenantId,
        severity: 'high',
        category: 'security',
      });
      this.eventEmitter.emit('security.ldap_configured', config);
    } catch (error) {
      this.logger.error('Failed to configure LDAP', error);
      throw error;
    }
  }

  /**
   * Get LDAP configuration
   */
  async getLDAPConfig(tenantId: string): Promise<any> {
    try {
      return await this.enterpriseAuthService.getLDAPConfig(tenantId);
    } catch (error) {
      this.logger.error('Failed to get LDAP config', error);
      throw error;
    }
  }

  /**
   * Configure OAuth2
   */
  async configureOAuth2(config: any): Promise<void> {
    try {
      await this.enterpriseAuthService.configureOAuth2(config);
      await this.logSecurityEvent({
        tenantId: config.tenantId,
        action: 'oauth2_configured',
        resource: 'sso_configuration',
        resourceId: config.tenantId,
        severity: 'high',
        category: 'security',
      });
      this.eventEmitter.emit('security.oauth2_configured', config);
    } catch (error) {
      this.logger.error('Failed to configure OAuth2', error);
      throw error;
    }
  }

  /**
   * Get SSO sessions
   */
  async getSSOSessions(tenantId: string): Promise<any[]> {
    try {
      return await this.enterpriseAuthService.getSSOSessions(tenantId);
    } catch (error) {
      this.logger.error('Failed to get SSO sessions', error);
      throw error;
    }
  }

  /**
   * Revoke SSO session
   */
  async revokeSSOSession(sessionId: string, tenantId: string): Promise<void> {
    try {
      await this.enterpriseAuthService.revokeSSOSession(sessionId, tenantId);
      await this.logSecurityEvent({
        tenantId,
        action: 'sso_session_revoked',
        resource: 'sso_session',
        resourceId: sessionId,
        severity: 'medium',
        category: 'security',
      });
      this.eventEmitter.emit('security.sso_session_revoked', { sessionId });
    } catch (error) {
      this.logger.error('Failed to revoke SSO session', error);
      throw error;
    }
  }

  // ============================================================================
  // PENETRATION TESTING OPERATIONS
  // ============================================================================

  /**
   * Initiate penetration test
   */
  async initiatePenetrationTest(config: any): Promise<any> {
    try {
      const test = await this.penetrationTestingService.initiatePenetrationTest(config);
      await this.logSecurityEvent({
        tenantId: config.tenantId,
        action: 'penetration_test_initiated',
        resource: 'penetration_test',
        resourceId: test.id,
        metadata: { testType: config.testType },
        severity: 'high',
        category: 'security',
      });
      this.eventEmitter.emit('security.penetration_test_started', test);
      return test;
    } catch (error) {
      this.logger.error('Failed to initiate penetration test', error);
      throw error;
    }
  }

  /**
   * Get penetration test results
   */
  async getPenetrationTestResults(testId: string): Promise<any> {
    try {
      return await this.penetrationTestingService.getTestResults(testId);
    } catch (error) {
      this.logger.error('Failed to get penetration test results', error);
      throw error;
    }
  }

  /**
   * Generate vulnerability report
   */
  async generateVulnerabilityReport(tenantId: string, period?: string): Promise<any> {
    try {
      return await this.penetrationTestingService.generateVulnerabilityReport(tenantId, period);
    } catch (error) {
      this.logger.error('Failed to generate vulnerability report', error);
      throw error;
    }
  }

  /**
   * Get vulnerability findings
   */
  async getVulnerabilityFindings(tenantId: string, filters?: any): Promise<any[]> {
    try {
      return await this.penetrationTestingService.getFindings(tenantId, filters);
    } catch (error) {
      this.logger.error('Failed to get vulnerability findings', error);
      throw error;
    }
  }

  // ============================================================================
  // DATA DELETION OPERATIONS
  // ============================================================================

  /**
   * Schedule data deletion
   */
  async scheduleDataDeletion(request: any): Promise<string> {
    try {
      const requestId = await this.dataDeletionService.scheduleDataDeletion(request);
      await this.logSecurityEvent({
        tenantId: request.tenantId,
        userId: request.requestedBy,
        action: 'data_deletion_scheduled',
        resource: 'data_deletion',
        resourceId: requestId,
        metadata: {
          dataType: request.dataType,
          reason: request.reason,
        },
        severity: 'high',
        category: 'security',
      });
      this.eventEmitter.emit('security.data_deletion_scheduled', { requestId, request });
      return requestId;
    } catch (error) {
      this.logger.error('Failed to schedule data deletion', error);
      throw error;
    }
  }

  /**
   * Get data deletion status
   */
  async getDataDeletionStatus(requestId: string): Promise<any> {
    try {
      return await this.dataDeletionService.getDeletionStatus(requestId);
    } catch (error) {
      this.logger.error('Failed to get data deletion status', error);
      throw error;
    }
  }

  /**
   * Get deletion history
   */
  async getDeletionHistory(tenantId: string, limit?: number): Promise<any[]> {
    try {
      return await this.dataDeletionService.getDeletionHistory(tenantId, limit);
    } catch (error) {
      this.logger.error('Failed to get deletion history', error);
      throw error;
    }
  }

  /**
   * Cancel data deletion
   */
  async cancelDataDeletion(requestId: string, tenantId: string): Promise<void> {
    try {
      await this.dataDeletionService.cancelDeletion(requestId);
      await this.logSecurityEvent({
        tenantId,
        action: 'data_deletion_cancelled',
        resource: 'data_deletion',
        resourceId: requestId,
        severity: 'medium',
        category: 'security',
      });
      this.eventEmitter.emit('security.data_deletion_cancelled', { requestId });
    } catch (error) {
      this.logger.error('Failed to cancel data deletion', error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Group items by key
   */
  private groupBy<T>(items: T[], keyFn: (item: T) => any): Record<string, T[]> {
    return items.reduce(
      (acc, item) => {
        const key = String(keyFn(item));
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      },
      {} as Record<string, T[]>,
    );
  }

  /**
   * Get top N items
   */
  private getTopItems<T>(
    items: T[],
    keyFn: ((item: T) => any) | string,
    limit: number = 10,
  ): { key: string; count: number }[] {
    const fn = typeof keyFn === 'function' ? keyFn : (item: any) => item[keyFn];
    const grouped = this.groupBy(items, fn);
    return Object.entries(grouped)
      .map(([key, values]) => ({ key, count: values.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Analyze time distribution of events
   */
  private analyzeTimeDistribution(items: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    items.forEach((item) => {
      const hour = new Date(item.timestamp).getHours();
      const key = `${hour}:00`;
      distribution[key] = (distribution[key] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Detect anomalies in audit logs
   */
  private detectAnomalies(items: any[]): string[] {
    const anomalies: string[] = [];

    // Detect unusual activity patterns
    const actions = this.groupBy(items, (i) => i.action);
    Object.entries(actions).forEach(([action, logs]) => {
      // Flag if action count is significantly higher than average
      const avg = items.length / Object.keys(actions).length;
      if (logs.length > avg * 3) {
        anomalies.push(`Unusual spike in ${action} actions (${logs.length} occurrences)`);
      }
    });

    // Detect failed access attempts
    const failedAttempts = items.filter((i) => i.action === 'login' && i.severity === 'high');
    if (failedAttempts.length > 10) {
      anomalies.push(`High number of failed login attempts detected (${failedAttempts.length})`);
    }

    // Detect data access patterns
    const dataAccess = items.filter((i) => i.category === 'data');
    if (dataAccess.length > 100) {
      anomalies.push(`High volume of data access events detected (${dataAccess.length})`);
    }

    return anomalies;
  }
}
