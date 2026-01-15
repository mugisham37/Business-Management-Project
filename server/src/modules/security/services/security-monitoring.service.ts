import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AuditService } from './audit.service';
import { ThreatDetectionService } from './threat-detection.service';

export interface SecurityMetrics {
  tenantId: string;
  timestamp: Date;
  failedLogins: number;
  successfulLogins: number;
  dataAccessAttempts: number;
  privilegeEscalations: number;
  suspiciousActivities: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreats: SecurityThreat[];
}

export interface SecurityThreat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  firstDetected: Date;
  lastSeen: Date;
  count: number;
  status: 'active' | 'mitigated' | 'resolved';
  affectedResources: string[];
  recommendedActions: string[];
}

export interface SecurityAlert {
  id: string;
  tenantId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  metadata: Record<string, any>;
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved';
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
}

@Injectable()
export class SecurityMonitoringService {
  private readonly logger = new Logger(SecurityMonitoringService.name);
  private readonly activeThreats = new Map<string, SecurityThreat>();
  private readonly securityMetrics = new Map<string, SecurityMetrics>();
  private readonly alertThresholds: Record<string, number>;

  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly threatDetectionService: ThreatDetectionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.alertThresholds = {
      failedLogins: this.configService.get<number>('SECURITY_FAILED_LOGIN_THRESHOLD', 10),
      dataAccess: this.configService.get<number>('SECURITY_DATA_ACCESS_THRESHOLD', 1000),
      privilegeEscalation: this.configService.get<number>('SECURITY_PRIVILEGE_ESCALATION_THRESHOLD', 1),
      suspiciousActivity: this.configService.get<number>('SECURITY_SUSPICIOUS_ACTIVITY_THRESHOLD', 5),
    };
  }

  /**
   * Monitor security events in real-time
   */
  @OnEvent('audit.logged')
  async handleAuditEvent(event: any): Promise<void> {
    try {
      // Update security metrics
      await this.updateSecurityMetrics(event);

      // Check for immediate threats
      await this.checkImmediateThreats(event);

      // Update threat detection
      await this.threatDetectionService.analyzeEvent(event);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle audit event: ${err.message}`, err.stack);
    }
  }

  /**
   * Handle security violations
   */
  @OnEvent('security.violation')
  async handleSecurityViolation(violation: any): Promise<void> {
    try {
      const threat: SecurityThreat = {
        id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: violation.violations.join(', '),
        severity: this.calculateThreatSeverity(violation),
        description: `Security violation detected: ${violation.violations.join(', ')}`,
        source: violation.event.ipAddress || 'unknown',
        firstDetected: new Date(),
        lastSeen: new Date(),
        count: 1,
        status: 'active',
        affectedResources: [violation.event.resource],
        recommendedActions: this.getRecommendedActions(violation.violations),
      };

      // Store active threat
      this.activeThreats.set(threat.id, threat);

      // Create security alert
      const alert: SecurityAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: violation.tenantId,
        type: 'security_violation',
        severity: threat.severity,
        title: 'Security Violation Detected',
        description: threat.description,
        timestamp: new Date(),
        source: threat.source,
        metadata: {
          threatId: threat.id,
          violations: violation.violations,
          event: violation.event,
        },
        status: 'new',
      };

      // Emit alert
      this.eventEmitter.emit('security.alert', alert);

      // Auto-respond to critical threats
      if (threat.severity === 'critical') {
        await this.autoRespondToThreat(threat, violation);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to handle security violation: ${err.message}`, err.stack);
    }
  }

  /**
   * Get current security metrics for a tenant
   */
  async getSecurityMetrics(tenantId: string): Promise<SecurityMetrics | null> {
    return this.securityMetrics.get(tenantId) || null;
  }

  /**
   * Get active threats for a tenant
   */
  async getActiveThreats(tenantId: string): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];
    
    for (const threat of this.activeThreats.values()) {
      // Check if threat affects this tenant (simplified logic)
      if (threat.affectedResources.some(resource => resource.includes(tenantId))) {
        threats.push(threat);
      }
    }

    return threats.filter(threat => threat.status === 'active');
  }

  /**
   * Generate security dashboard data
   */
  async getSecurityDashboard(tenantId: string): Promise<any> {
    const metrics = await this.getSecurityMetrics(tenantId);
    const activeThreats = await this.getActiveThreats(tenantId);
    const recentAlerts = await this.getRecentAlerts(tenantId, 24); // Last 24 hours

    return {
      metrics,
      activeThreats,
      recentAlerts,
      threatLevel: metrics?.threatLevel || 'low',
      summary: {
        totalThreats: activeThreats.length,
        criticalThreats: activeThreats.filter(t => t.severity === 'critical').length,
        highThreats: activeThreats.filter(t => t.severity === 'high').length,
        recentAlerts: recentAlerts.length,
        lastUpdated: new Date(),
      },
    };
  }

  /**
   * Acknowledge security alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    // In a real implementation, this would update the alert in the database
    this.logger.log(`Alert ${alertId} acknowledged by user ${userId}`);
    
    this.eventEmitter.emit('security.alert.acknowledged', {
      alertId,
      userId,
      timestamp: new Date(),
    });
  }

  /**
   * Resolve security threat
   */
  async resolveThreat(threatId: string, resolution: string, userId: string): Promise<void> {
    const threat = this.activeThreats.get(threatId);
    if (threat) {
      threat.status = 'resolved';
      
      this.logger.log(`Threat ${threatId} resolved by user ${userId}: ${resolution}`);
      
      this.eventEmitter.emit('security.threat.resolved', {
        threatId,
        resolution,
        userId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Periodic security health check
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performSecurityHealthCheck(): Promise<void> {
    try {
      this.logger.debug('Performing security health check');

      // Check for stale threats
      await this.cleanupStaleThreats();

      // Update threat levels
      await this.updateThreatLevels();

      // Generate periodic reports
      await this.generatePeriodicReports();

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Security health check failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Update security metrics for a tenant
   */
  private async updateSecurityMetrics(event: any): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return;

    let metrics = this.securityMetrics.get(tenantId);
    if (!metrics) {
      metrics = {
        tenantId,
        timestamp: new Date(),
        failedLogins: 0,
        successfulLogins: 0,
        dataAccessAttempts: 0,
        privilegeEscalations: 0,
        suspiciousActivities: 0,
        threatLevel: 'low',
        activeThreats: [],
      };
    }

    // Update metrics based on event type
    switch (event.action) {
      case 'login':
        if (event.metadata?.failed) {
          metrics.failedLogins++;
        } else {
          metrics.successfulLogins++;
        }
        break;
      case 'read':
        if (event.resource.includes('sensitive') || event.resource.includes('personal')) {
          metrics.dataAccessAttempts++;
        }
        break;
      case 'update':
        if (event.resource === 'user_permissions') {
          metrics.privilegeEscalations++;
        }
        break;
    }

    // Update threat level
    metrics.threatLevel = this.calculateThreatLevel(metrics);
    metrics.timestamp = new Date();

    this.securityMetrics.set(tenantId, metrics);
  }

  /**
   * Check for immediate threats that require instant response
   */
  private async checkImmediateThreats(event: any): Promise<void> {
    const threats: string[] = [];

    // Check for brute force attacks
    if (event.action === 'login' && event.metadata?.failed) {
      const recentFailedLogins = await this.auditService.queryLogs({
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'login',
        startDate: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
      });

      const failedCount = recentFailedLogins.filter(log => log.metadata?.failed).length;
      if (failedCount >= 5) {
        threats.push('Brute force attack detected');
      }
    }

    // Check for data exfiltration
    if (event.action === 'export' || event.action === 'read') {
      const recentExports = await this.auditService.queryLogs({
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'export',
        startDate: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
      });

      if (recentExports.length > 10) {
        threats.push('Potential data exfiltration detected');
      }
    }

    // Emit immediate threats
    if (threats.length > 0) {
      this.eventEmitter.emit('security.immediate_threat', {
        tenantId: event.tenantId,
        userId: event.userId,
        threats,
        event,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Calculate threat severity based on violation type
   */
  private calculateThreatSeverity(violation: any): 'low' | 'medium' | 'high' | 'critical' {
    const violations = violation.violations as string[];

    if (violations.some(v => v.includes('privilege escalation') || v.includes('data exfiltration'))) {
      return 'critical';
    }

    if (violations.some(v => v.includes('brute force') || v.includes('unauthorized access'))) {
      return 'high';
    }

    if (violations.some(v => v.includes('suspicious') || v.includes('unusual'))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate overall threat level for tenant
   */
  private calculateThreatLevel(metrics: SecurityMetrics): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;

    // Weight different metrics
    score += metrics.failedLogins * 2;
    score += metrics.privilegeEscalations * 10;
    score += metrics.suspiciousActivities * 5;
    score += Math.floor(metrics.dataAccessAttempts / 100);

    if (score >= 50) return 'critical';
    if (score >= 25) return 'high';
    if (score >= 10) return 'medium';
    return 'low';
  }

  /**
   * Get recommended actions for violations
   */
  private getRecommendedActions(violations: string[]): string[] {
    const actions: string[] = [];

    violations.forEach(violation => {
      if (violation.includes('failed login')) {
        actions.push('Enable account lockout after failed attempts');
        actions.push('Implement CAPTCHA for suspicious IPs');
      }
      
      if (violation.includes('privilege escalation')) {
        actions.push('Review user permissions immediately');
        actions.push('Audit recent permission changes');
      }
      
      if (violation.includes('data access')) {
        actions.push('Review data access patterns');
        actions.push('Implement additional access controls');
      }
    });

    return [...new Set(actions)]; // Remove duplicates
  }

  /**
   * Auto-respond to critical threats
   */
  private async autoRespondToThreat(threat: SecurityThreat, violation: any): Promise<void> {
    this.logger.warn(`Auto-responding to critical threat: ${threat.type}`);

    // Implement automatic responses based on threat type
    if (threat.type.includes('brute force')) {
      // Could implement IP blocking here
      this.logger.warn(`Would block IP: ${threat.source}`);
    }

    if (threat.type.includes('privilege escalation')) {
      // Could implement user suspension here
      this.logger.warn(`Would suspend user: ${violation.userId}`);
    }

    // Emit auto-response event
    this.eventEmitter.emit('security.auto_response', {
      threatId: threat.id,
      actions: threat.recommendedActions,
      timestamp: new Date(),
    });
  }

  /**
   * Get recent alerts for a tenant
   */
  private async getRecentAlerts(tenantId: string, hours: number): Promise<SecurityAlert[]> {
    // In a real implementation, this would query the database
    // For now, return empty array
    return [];
  }

  /**
   * Clean up stale threats
   */
  private async cleanupStaleThreats(): Promise<void> {
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [id, threat] of this.activeThreats.entries()) {
      if (now - threat.lastSeen.getTime() > staleThreshold) {
        threat.status = 'resolved';
        this.activeThreats.delete(id);
        this.logger.log(`Cleaned up stale threat: ${id}`);
      }
    }
  }

  /**
   * Update threat levels for all tenants
   */
  private async updateThreatLevels(): Promise<void> {
    for (const [tenantId, metrics] of this.securityMetrics.entries()) {
      const newThreatLevel = this.calculateThreatLevel(metrics);
      if (newThreatLevel !== metrics.threatLevel) {
        metrics.threatLevel = newThreatLevel;
        
        this.eventEmitter.emit('security.threat_level_changed', {
          tenantId,
          oldLevel: metrics.threatLevel,
          newLevel: newThreatLevel,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Generate periodic security reports
   */
  private async generatePeriodicReports(): Promise<void> {
    // Generate hourly summary reports
    const now = new Date();
    if (now.getMinutes() === 0) { // Top of the hour
      for (const [tenantId, metrics] of this.securityMetrics.entries()) {
        this.eventEmitter.emit('security.hourly_report', {
          tenantId,
          metrics,
          timestamp: now,
        });
      }
    }
  }
}