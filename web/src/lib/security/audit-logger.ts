/**
 * Security Audit Logger
 * Logs security-relevant events for compliance and monitoring
 * Requirements: 12.5
 */

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  eventType: AuditEventType;
  action: string;
  resource?: string;
  resourceId?: string;
  outcome: 'success' | 'failure' | 'denied';
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export type AuditEventType = 
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'configuration_change'
  | 'security_event'
  | 'compliance_event'
  | 'system_event'
  | 'user_action';

export interface AuditLoggerConfig {
  enableConsoleLogging: boolean;
  enableFileLogging: boolean;
  enableRemoteLogging: boolean;
  logLevel: 'all' | 'medium' | 'high' | 'critical';
  retentionDays: number;
  encryptLogs: boolean;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number; // milliseconds
}

export class AuditLogger {
  private config: AuditLoggerConfig;
  private eventQueue: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = {
      enableConsoleLogging: process.env.NODE_ENV === 'development',
      enableFileLogging: true,
      enableRemoteLogging: process.env.NODE_ENV === 'production',
      logLevel: 'medium',
      retentionDays: 90,
      encryptLogs: true,
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
      ...config
    };

    this.startFlushTimer();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };

    // Check if event should be logged based on level
    if (!this.shouldLogEvent(auditEvent)) {
      return;
    }

    // Add to queue
    this.eventQueue.push(auditEvent);

    // Console logging for development
    if (this.config.enableConsoleLogging) {
      this.logToConsole(auditEvent);
    }

    // Immediate flush for critical events
    if (auditEvent.riskLevel === 'critical') {
      await this.flush();
    }

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Log authentication events
   */
  async logAuthentication(
    action: 'login' | 'logout' | 'token_refresh' | 'mfa_challenge' | 'mfa_verify',
    outcome: 'success' | 'failure',
    userId?: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
      eventType: 'authentication',
      action,
      outcome,
      details,
      riskLevel: outcome === 'failure' ? 'medium' : 'low'
    };
    if (userId !== undefined) event.userId = userId;
    await this.logEvent(event);
  }

  /**
   * Log authorization events
   */
  async logAuthorization(
    action: string,
    resource: string,
    outcome: 'success' | 'denied',
    userId?: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
      eventType: 'authorization',
      action,
      resource,
      outcome,
      details,
      riskLevel: outcome === 'denied' ? 'medium' : 'low'
    };
    if (userId !== undefined) event.userId = userId;
    await this.logEvent(event);
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    action: 'read' | 'query' | 'export',
    resource: string,
    resourceId?: string,
    userId?: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
      eventType: 'data_access',
      action,
      resource,
      outcome: 'success',
      details,
      riskLevel: 'low'
    };
    if (resourceId !== undefined) event.resourceId = resourceId;
    if (userId !== undefined) event.userId = userId;
    await this.logEvent(event);
  }

  /**
   * Log data modification events
   */
  async logDataModification(
    action: 'create' | 'update' | 'delete' | 'bulk_update' | 'bulk_delete',
    resource: string,
    resourceId?: string,
    userId?: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    const riskLevel = action.startsWith('bulk_') || action === 'delete' ? 'medium' : 'low';
    
    const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
      eventType: 'data_modification',
      action,
      resource,
      outcome: 'success',
      details,
      riskLevel
    };
    if (resourceId !== undefined) event.resourceId = resourceId;
    if (userId !== undefined) event.userId = userId;
    await this.logEvent(event);
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    action: string,
    outcome: 'success' | 'failure' | 'denied',
    details: Record<string, unknown> = {},
    riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ): Promise<void> {
    await this.logEvent({
      eventType: 'security_event',
      action,
      outcome,
      details,
      riskLevel
    });
  }

  /**
   * Log compliance events
   */
  async logComplianceEvent(
    action: string,
    resource: string,
    userId?: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
      eventType: 'compliance_event',
      action,
      resource,
      outcome: 'success',
      details,
      riskLevel: 'medium'
    };
    if (userId !== undefined) event.userId = userId;
    await this.logEvent(event);
  }

  /**
   * Flush queued events
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // File logging
      if (this.config.enableFileLogging) {
        await this.logToFile(events);
      }

      // Remote logging
      if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
        await this.logToRemote(events);
      }
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Get audit events for a user
   */
  async getUserAuditTrail(): Promise<AuditEvent[]> {
    // In a real implementation, this would query the audit log storage
    // For now, return empty array as this is a logging-only implementation
    return [];
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    complianceType: 'GDPR' | 'SOC2' | 'PCI-DSS' | 'HIPAA'
  ): Promise<{
    period: { start: Date; end: Date };
    complianceType: string;
    totalEvents: number;
    eventsByType: Record<string, number>;
    securityIncidents: number;
    dataAccessEvents: number;
    complianceViolations: AuditEvent[];
  }> {
    // In a real implementation, this would analyze stored audit logs
    return {
      period: { start: startDate, end: endDate },
      complianceType,
      totalEvents: 0,
      eventsByType: {},
      securityIncidents: 0,
      dataAccessEvents: 0,
      complianceViolations: []
    };
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldLogEvent(event: AuditEvent): boolean {
    const levelPriority = {
      'all': 0,
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };

    const configLevel = levelPriority[this.config.logLevel];
    const eventLevel = levelPriority[event.riskLevel];

    return eventLevel >= configLevel;
  }

  private logToConsole(event: AuditEvent): void {
    const logLevel = event.riskLevel === 'critical' ? 'error' : 
                    event.riskLevel === 'high' ? 'warn' : 'info';
    
    console[logLevel]('AUDIT:', {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      type: event.eventType,
      action: event.action,
      outcome: event.outcome,
      userId: event.userId,
      resource: event.resource,
      riskLevel: event.riskLevel
    });
  }

  private async logToFile(events: AuditEvent[]): Promise<void> {
    // In a real implementation, this would write to a secure log file
    // For now, we'll just simulate the operation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _logData = events.map(event => JSON.stringify(event)).join('\n');
    
    if (typeof window === 'undefined') {
      // Server-side logging would go here
      console.log('Would write to audit log file:', events.length, 'events');
    }
  }

  private async logToRemote(events: AuditEvent[]): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AUDIT_LOG_TOKEN}`
        },
        body: JSON.stringify({ events })
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Remote audit logging failed:', error);
      throw error;
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Scheduled audit log flush failed:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush remaining events
    this.flush().catch(error => {
      console.error('Final audit log flush failed:', error);
    });
  }
}

// Default audit logger instance
export const auditLogger = new AuditLogger();

/**
 * Utility functions for common audit scenarios
 */
export const logUserAction = (
  action: string,
  userId: string,
  details: Record<string, unknown> = {}
) => auditLogger.logEvent({
  eventType: 'user_action',
  action,
  outcome: 'success',
  userId,
  details,
  riskLevel: 'low'
});

export const logSecurityIncident = (
  action: string,
  details: Record<string, unknown> = {},
  riskLevel: 'high' | 'critical' = 'high'
) => auditLogger.logSecurityEvent(action, 'failure', details, riskLevel);

/**
 * React hook for audit logging
 */
export function useAuditLogger() {
  return {
    logAuthentication: auditLogger.logAuthentication.bind(auditLogger),
    logAuthorization: auditLogger.logAuthorization.bind(auditLogger),
    logDataAccess: auditLogger.logDataAccess.bind(auditLogger),
    logDataModification: auditLogger.logDataModification.bind(auditLogger),
    logSecurityEvent: auditLogger.logSecurityEvent.bind(auditLogger),
    logUserAction
  };
}