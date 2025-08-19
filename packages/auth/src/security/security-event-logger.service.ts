/**
 * Security Event Logger Service
 * Handles logging and alerting for security events with GDPR compliance
 */

import { createAuditLogContext, createSecurityLogContext } from '@company/shared/utils';
import { Logger } from 'winston';
import { SecureIdGenerator } from '../tokens/secure-id-generator.service';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  correlationId?: string;
}

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'login_suspicious'
  | 'password_change'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_bypass_attempt'
  | 'account_locked'
  | 'account_unlocked'
  | 'permission_escalation'
  | 'unauthorized_access'
  | 'data_access'
  | 'data_export'
  | 'data_deletion'
  | 'session_hijack_attempt'
  | 'brute_force_attack'
  | 'credential_stuffing'
  | 'device_change'
  | 'location_change'
  | 'api_abuse'
  | 'rate_limit_exceeded'
  | 'webauthn_registration'
  | 'webauthn_authentication'
  | 'passwordless_auth'
  | 'oauth_authorization'
  | 'gdpr_data_request'
  | 'gdpr_data_export'
  | 'gdpr_data_deletion'
  | 'compliance_violation';

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAlert {
  id: string;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  title: string;
  message: string;
  actionRequired: boolean;
  recommendedActions: string[];
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AuditTrail {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  correlationId?: string;
  gdprRelevant: boolean;
  retentionPeriod?: number; // days
}

export interface GDPRDataRequest {
  id: string;
  userId: string;
  requestType: 'access' | 'portability' | 'rectification' | 'erasure' | 'restriction';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
  requestedBy: string;
  processedBy?: string;
  dataCategories: string[];
  reason?: string;
  legalBasis?: string;
  metadata?: Record<string, any>;
}

export class SecurityEventLoggerService {
  private alerts: Map<string, SecurityAlert> = new Map();
  private auditTrails: Map<string, AuditTrail> = new Map();
  private gdprRequests: Map<string, GDPRDataRequest> = new Map();

  constructor(private readonly logger: Logger) {}

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const correlationId = event.correlationId || SecureIdGenerator.generateCorrelationId();
    const timestamp = event.timestamp || new Date();

    try {
      // Create security log context
      const logContext = createSecurityLogContext(
        event.type,
        event.severity,
        undefined, // request object not available here
        {
          userId: event.userId,
          sessionId: event.sessionId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          deviceFingerprint: event.deviceFingerprint,
          description: event.description,
          metadata: event.metadata,
          timestamp: timestamp.toISOString(),
          correlationId,
        }
      );

      // Log the security event
      this.logger.warn('Security event detected', logContext);

      // Check if alert should be generated
      if (this.shouldGenerateAlert(event)) {
        await this.generateSecurityAlert(event, correlationId, timestamp);
      }

      // Store audit trail if required
      if (this.isAuditableEvent(event.type)) {
        await this.createAuditTrail({
          userId: event.userId,
          action: event.type,
          resource: 'security_event',
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          timestamp,
          correlationId,
          gdprRelevant: this.isGDPRRelevant(event.type),
          metadata: event.metadata,
        });
      }

      // Handle GDPR-specific events
      if (this.isGDPREvent(event.type)) {
        await this.handleGDPREvent(event, correlationId, timestamp);
      }
    } catch (error) {
      this.logger.error('Failed to log security event', {
        correlationId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create audit trail entry
   */
  async createAuditTrail(data: Omit<AuditTrail, 'id'>): Promise<string> {
    const auditId = SecureIdGenerator.generateSecureId();
    const correlationId = data.correlationId || SecureIdGenerator.generateCorrelationId();

    try {
      const auditTrail: AuditTrail = {
        id: auditId,
        ...data,
        correlationId,
      };

      // Store audit trail
      this.auditTrails.set(auditId, auditTrail);

      // Create audit log context
      const logContext = createAuditLogContext(
        data.action,
        undefined, // request object not available here
        {
          userId: data.userId,
          resource: data.resource,
          resourceId: data.resourceId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: data.timestamp.toISOString(),
          correlationId,
          gdprRelevant: data.gdprRelevant,
          retentionPeriod: data.retentionPeriod,
        }
      );

      // Log the audit event
      this.logger.info('Audit trail created', logContext);

      return auditId;
    } catch (error) {
      this.logger.error('Failed to create audit trail', {
        correlationId,
        action: data.action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate security alert
   */
  private async generateSecurityAlert(
    event: SecurityEvent,
    correlationId: string,
    timestamp: Date
  ): Promise<void> {
    const alertId = SecureIdGenerator.generateSecureId();

    try {
      const alert: SecurityAlert = {
        id: alertId,
        eventType: event.type,
        severity: event.severity,
        userId: event.userId,
        title: this.getAlertTitle(event.type),
        message: this.getAlertMessage(event.type, event.description),
        actionRequired: this.isActionRequired(event.type, event.severity),
        recommendedActions: this.getRecommendedActions(event.type),
        timestamp,
        acknowledged: false,
      };

      // Store alert
      this.alerts.set(alertId, alert);

      // Log alert generation
      this.logger.warn('Security alert generated', {
        correlationId,
        alertId,
        eventType: event.type,
        severity: event.severity,
        userId: event.userId,
        actionRequired: alert.actionRequired,
      });

      // Send notifications for critical alerts
      if (event.severity === 'critical') {
        await this.sendCriticalAlertNotification(alert, correlationId);
      }
    } catch (error) {
      this.logger.error('Failed to generate security alert', {
        correlationId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle GDPR-specific events
   */
  private async handleGDPREvent(
    event: SecurityEvent,
    correlationId: string,
    timestamp: Date
  ): Promise<void> {
    try {
      // Log GDPR event with special handling
      this.logger.info('GDPR event processed', {
        correlationId,
        eventType: event.type,
        userId: event.userId,
        timestamp: timestamp.toISOString(),
        gdprCompliant: true,
        dataProcessingLawfulBasis: this.getGDPRLawfulBasis(event.type),
      });

      // Create GDPR audit trail
      await this.createAuditTrail({
        userId: event.userId,
        action: `gdpr_${event.type}`,
        resource: 'gdpr_compliance',
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp,
        correlationId,
        gdprRelevant: true,
        retentionPeriod: this.getGDPRRetentionPeriod(event.type),
        metadata: {
          ...event.metadata,
          gdprProcessingBasis: this.getGDPRLawfulBasis(event.type),
          dataCategories: this.getGDPRDataCategories(event.type),
        },
      });
    } catch (error) {
      this.logger.error('Failed to handle GDPR event', {
        correlationId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create GDPR data request
   */
  async createGDPRDataRequest(
    userId: string,
    requestType: GDPRDataRequest['requestType'],
    requestedBy: string,
    dataCategories: string[],
    reason?: string,
    legalBasis?: string
  ): Promise<string> {
    const requestId = SecureIdGenerator.generateSecureId();
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      const gdprRequest: GDPRDataRequest = {
        id: requestId,
        userId,
        requestType,
        status: 'pending',
        requestedAt: new Date(),
        requestedBy,
        dataCategories,
        reason,
        legalBasis,
        metadata: {
          correlationId,
        },
      };

      // Store GDPR request
      this.gdprRequests.set(requestId, gdprRequest);

      // Log GDPR request
      await this.logSecurityEvent({
        type: 'gdpr_data_request',
        severity: 'medium',
        userId,
        description: `GDPR ${requestType} request created`,
        metadata: {
          requestId,
          requestType,
          dataCategories,
          requestedBy,
          reason,
          legalBasis,
        },
        correlationId,
      });

      this.logger.info('GDPR data request created', {
        correlationId,
        requestId,
        userId,
        requestType,
        dataCategories,
        requestedBy,
      });

      return requestId;
    } catch (error) {
      this.logger.error('Failed to create GDPR data request', {
        correlationId,
        userId,
        requestType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Enhanced security event alerting with real-time notifications
   */
  async sendSecurityAlert(
    alertType: 'critical_breach' | 'mfa_bypass' | 'suspicious_activity' | 'compliance_violation',
    userId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      const alert = {
        id: SecureIdGenerator.generateSecureId(),
        type: alertType,
        userId,
        timestamp: new Date(),
        details,
        correlationId,
      };

      // Log critical security alert
      await this.logSecurityEvent({
        type: 'compliance_violation',
        severity: 'critical',
        userId,
        description: `Critical security alert: ${alertType}`,
        metadata: {
          alertType,
          alertId: alert.id,
          ...details,
        },
        correlationId,
      });

      // In production, this would send real-time notifications
      // via email, SMS, Slack, PagerDuty, etc.
      this.logger.error('CRITICAL SECURITY ALERT', {
        correlationId,
        alertType,
        userId,
        details,
        requiresImmediateAction: true,
      });
    } catch (error) {
      this.logger.error('Failed to send security alert', {
        correlationId,
        alertType,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Enhanced audit trail with compliance metadata
   */
  async createComplianceAuditTrail(
    data: Omit<AuditTrail, 'id'> & {
      complianceFramework?: 'gdpr' | 'hipaa' | 'sox' | 'pci_dss';
      dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
      businessJustification?: string;
    }
  ): Promise<string> {
    const auditId = SecureIdGenerator.generateSecureId();
    const correlationId = data.correlationId || SecureIdGenerator.generateCorrelationId();

    try {
      const auditTrail: AuditTrail & {
        complianceFramework?: string;
        dataClassification?: string;
        businessJustification?: string;
      } = {
        id: auditId,
        ...data,
        correlationId,
      };

      // Store audit trail with enhanced metadata
      this.auditTrails.set(auditId, auditTrail);

      // Create enhanced audit log context
      const logContext = createAuditLogContext(
        data.action,
        undefined, // request object not available here
        {
          userId: data.userId,
          resource: data.resource,
          resourceId: data.resourceId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: data.timestamp.toISOString(),
          correlationId,
          gdprRelevant: data.gdprRelevant,
          retentionPeriod: data.retentionPeriod,
          complianceFramework: data.complianceFramework,
          dataClassification: data.dataClassification,
          businessJustification: data.businessJustification,
        }
      );

      // Log the enhanced audit event
      this.logger.info('Enhanced compliance audit trail created', logContext);

      return auditId;
    } catch (error) {
      this.logger.error('Failed to create compliance audit trail', {
        correlationId,
        action: data.action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get security alerts for a user
   */
  async getUserSecurityAlerts(userId: string): Promise<SecurityAlert[]> {
    try {
      const userAlerts = Array.from(this.alerts.values())
        .filter(alert => alert.userId === userId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return userAlerts;
    } catch (error) {
      this.logger.error('Failed to get user security alerts', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Acknowledge security alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    try {
      const alert = this.alerts.get(alertId);
      if (!alert) {
        return false;
      }

      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();

      this.logger.info('Security alert acknowledged', {
        alertId,
        acknowledgedBy,
        eventType: alert.eventType,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to acknowledge alert', {
        alertId,
        acknowledgedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get audit trail for a user
   */
  async getUserAuditTrail(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditTrail[]> {
    try {
      const userAuditTrails = Array.from(this.auditTrails.values())
        .filter(trail => trail.userId === userId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(offset, offset + limit);

      return userAuditTrails;
    } catch (error) {
      this.logger.error('Failed to get user audit trail', {
        userId,
        limit,
        offset,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserDataForGDPR(userId: string): Promise<{
    personalData: Record<string, any>;
    auditTrail: AuditTrail[];
    securityEvents: SecurityEvent[];
    dataProcessingActivities: Record<string, any>[];
  }> {
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      // Log GDPR data export
      await this.logSecurityEvent({
        type: 'gdpr_data_export',
        severity: 'medium',
        userId,
        description: 'User data exported for GDPR compliance',
        correlationId,
      });

      // Get user audit trail
      const auditTrail = await this.getUserAuditTrail(userId, 1000);

      // Get security events (would be from a proper storage in real implementation)
      const securityEvents: SecurityEvent[] = [];

      // Get data processing activities
      const dataProcessingActivities = this.getDataProcessingActivities(userId);

      return {
        personalData: {
          // This would include all personal data from various sources
          userId,
          exportedAt: new Date().toISOString(),
          correlationId,
        },
        auditTrail: auditTrail.filter(trail => trail.gdprRelevant),
        securityEvents,
        dataProcessingActivities,
      };
    } catch (error) {
      this.logger.error('Failed to export user data for GDPR', {
        correlationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete user data for GDPR compliance
   */
  async deleteUserDataForGDPR(userId: string, deletedBy: string, reason: string): Promise<void> {
    const correlationId = SecureIdGenerator.generateCorrelationId();

    try {
      // Log GDPR data deletion
      await this.logSecurityEvent({
        type: 'gdpr_data_deletion',
        severity: 'high',
        userId,
        description: `User data deleted for GDPR compliance: ${reason}`,
        metadata: {
          deletedBy,
          reason,
        },
        correlationId,
      });

      // Create audit trail for deletion
      await this.createAuditTrail({
        userId,
        action: 'gdpr_data_deletion',
        resource: 'user_data',
        resourceId: userId,
        ipAddress: 'system',
        timestamp: new Date(),
        correlationId,
        gdprRelevant: true,
        retentionPeriod: 2555, // 7 years for legal compliance
        metadata: {
          deletedBy,
          reason,
          gdprCompliant: true,
        },
      });

      this.logger.info('User data deleted for GDPR compliance', {
        correlationId,
        userId,
        deletedBy,
        reason,
      });
    } catch (error) {
      this.logger.error('Failed to delete user data for GDPR', {
        correlationId,
        userId,
        deletedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Helper methods

  private shouldGenerateAlert(event: SecurityEvent): boolean {
    const alertableEvents: SecurityEventType[] = [
      'login_suspicious',
      'mfa_bypass_attempt',
      'account_locked',
      'permission_escalation',
      'unauthorized_access',
      'session_hijack_attempt',
      'brute_force_attack',
      'credential_stuffing',
      'api_abuse',
      'compliance_violation',
    ];

    return alertableEvents.includes(event.type) || event.severity === 'critical';
  }

  private isAuditableEvent(eventType: SecurityEventType): boolean {
    // Most security events should be auditable
    return true;
  }

  private isGDPRRelevant(eventType: SecurityEventType): boolean {
    const gdprRelevantEvents: SecurityEventType[] = [
      'data_access',
      'data_export',
      'data_deletion',
      'gdpr_data_request',
      'gdpr_data_export',
      'gdpr_data_deletion',
      'login_success',
      'login_failure',
      'account_locked',
      'account_unlocked',
    ];

    return gdprRelevantEvents.includes(eventType);
  }

  private isGDPREvent(eventType: SecurityEventType): boolean {
    return eventType.startsWith('gdpr_');
  }

  private isActionRequired(eventType: SecurityEventType, severity: SecurityEventSeverity): boolean {
    if (severity === 'critical') return true;

    const actionRequiredEvents: SecurityEventType[] = [
      'mfa_bypass_attempt',
      'permission_escalation',
      'unauthorized_access',
      'session_hijack_attempt',
      'brute_force_attack',
      'compliance_violation',
    ];

    return actionRequiredEvents.includes(eventType);
  }

  private getAlertTitle(eventType: SecurityEventType): string {
    const titles: Record<SecurityEventType, string> = {
      login_success: 'Successful Login',
      login_failure: 'Failed Login Attempt',
      login_suspicious: 'Suspicious Login Activity',
      password_change: 'Password Changed',
      mfa_enabled: 'MFA Enabled',
      mfa_disabled: 'MFA Disabled',
      mfa_bypass_attempt: 'MFA Bypass Attempt Detected',
      account_locked: 'Account Locked',
      account_unlocked: 'Account Unlocked',
      permission_escalation: 'Permission Escalation Detected',
      unauthorized_access: 'Unauthorized Access Attempt',
      data_access: 'Data Access',
      data_export: 'Data Export',
      data_deletion: 'Data Deletion',
      session_hijack_attempt: 'Session Hijack Attempt',
      brute_force_attack: 'Brute Force Attack Detected',
      credential_stuffing: 'Credential Stuffing Attack',
      device_change: 'New Device Detected',
      location_change: 'New Location Detected',
      api_abuse: 'API Abuse Detected',
      rate_limit_exceeded: 'Rate Limit Exceeded',
      webauthn_registration: 'WebAuthn Credential Registered',
      webauthn_authentication: 'WebAuthn Authentication',
      passwordless_auth: 'Passwordless Authentication',
      oauth_authorization: 'OAuth Authorization',
      gdpr_data_request: 'GDPR Data Request',
      gdpr_data_export: 'GDPR Data Export',
      gdpr_data_deletion: 'GDPR Data Deletion',
      compliance_violation: 'Compliance Violation',
    };

    return titles[eventType] || 'Security Event';
  }

  private getAlertMessage(eventType: SecurityEventType, description: string): string {
    return description || `A ${eventType.replace(/_/g, ' ')} event was detected on your account.`;
  }

  private getRecommendedActions(eventType: SecurityEventType): string[] {
    const actions: Record<SecurityEventType, string[]> = {
      login_suspicious: [
        'Review recent login activity',
        'Change password if unauthorized',
        'Enable MFA if not already enabled',
        'Check for unfamiliar devices',
      ],
      mfa_bypass_attempt: [
        'Immediately change password',
        'Review MFA settings',
        'Check for unauthorized access',
        'Contact security team',
      ],
      unauthorized_access: [
        'Change password immediately',
        'Review account permissions',
        'Check for data breaches',
        'Enable additional security measures',
      ],
      brute_force_attack: [
        'Account has been temporarily locked',
        'Change password when unlocked',
        'Enable MFA',
        'Monitor for further attempts',
      ],
      // Add more as needed
    };

    return actions[eventType] || ['Review account activity', 'Contact support if suspicious'];
  }

  private async sendCriticalAlertNotification(
    alert: SecurityAlert,
    correlationId: string
  ): Promise<void> {
    try {
      // In a real implementation, this would send notifications via email, SMS, etc.
      this.logger.error('CRITICAL SECURITY ALERT', {
        correlationId,
        alertId: alert.id,
        eventType: alert.eventType,
        userId: alert.userId,
        title: alert.title,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to send critical alert notification', {
        correlationId,
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private getGDPRLawfulBasis(eventType: SecurityEventType): string {
    const lawfulBases: Record<string, string> = {
      gdpr_data_request: 'Article 6(1)(c) - Legal obligation',
      gdpr_data_export: 'Article 6(1)(c) - Legal obligation',
      gdpr_data_deletion: 'Article 6(1)(c) - Legal obligation',
      login_success: 'Article 6(1)(b) - Contract performance',
      login_failure: 'Article 6(1)(f) - Legitimate interests (security)',
    };

    return lawfulBases[eventType] || 'Article 6(1)(f) - Legitimate interests';
  }

  private getGDPRRetentionPeriod(eventType: SecurityEventType): number {
    const retentionPeriods: Record<string, number> = {
      gdpr_data_request: 2555, // 7 years
      gdpr_data_export: 2555, // 7 years
      gdpr_data_deletion: 2555, // 7 years
      login_success: 365, // 1 year
      login_failure: 365, // 1 year
    };

    return retentionPeriods[eventType] || 365; // Default 1 year
  }

  private getGDPRDataCategories(eventType: SecurityEventType): string[] {
    const dataCategories: Record<string, string[]> = {
      gdpr_data_request: ['personal_data', 'processing_activities'],
      gdpr_data_export: ['personal_data', 'audit_logs', 'security_events'],
      gdpr_data_deletion: ['personal_data', 'derived_data'],
      login_success: ['authentication_data', 'session_data'],
      login_failure: ['authentication_data', 'security_logs'],
    };

    return dataCategories[eventType] || ['security_logs'];
  }

  private getDataProcessingActivities(userId: string): Record<string, any>[] {
    // In a real implementation, this would query actual data processing activities
    return [
      {
        activity: 'Authentication Processing',
        purpose: 'User authentication and session management',
        lawfulBasis: 'Article 6(1)(b) - Contract performance',
        dataCategories: ['authentication_data', 'session_data'],
        retentionPeriod: '1 year',
        userId,
      },
      {
        activity: 'Security Monitoring',
        purpose: 'Fraud prevention and security monitoring',
        lawfulBasis: 'Article 6(1)(f) - Legitimate interests',
        dataCategories: ['security_logs', 'audit_trails'],
        retentionPeriod: '2 years',
        userId,
      },
    ];
  }
}
