/**
 * Security Monitoring Service
 * Monitors security events, detects threats, and maintains enterprise security features
 */

import { Logger } from 'winston';
import { SecureIdGenerator } from '../tokens/secure-id-generator.service';
import {
  SecurityEvent,
  SecurityEventLoggerService,
  SecurityEventType,
} from './security-event-logger.service';

export interface SecurityThreat {
  id: string;
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  description: string;
  indicators: ThreatIndicator[];
  detectedAt: Date;
  status: 'active' | 'investigating' | 'mitigated' | 'false_positive';
  mitigatedAt?: Date;
  mitigatedBy?: string;
  metadata?: Record<string, any>;
}

export type ThreatType =
  | 'brute_force_attack'
  | 'credential_stuffing'
  | 'account_takeover'
  | 'suspicious_login_pattern'
  | 'device_anomaly'
  | 'location_anomaly'
  | 'rate_limit_abuse'
  | 'mfa_bypass_attempt'
  | 'session_hijacking'
  | 'privilege_escalation'
  | 'data_exfiltration'
  | 'compliance_violation';

export interface ThreatIndicator {
  type: string;
  value: string;
  confidence: number; // 0-100
  source: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  threatCount: number;
  activeThreats: number;
  riskScore: number;
  complianceScore: number;
  lastUpdated: Date;
  eventsByType: Record<SecurityEventType, number>;
  threatsByType: Record<ThreatType, number>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  eventTypes: SecurityEventType[];
  conditions: AlertCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // minutes
  lastTriggered?: Date;
  actions: AlertAction[];
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range';
  value: any;
  timeWindow?: number; // minutes
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'block_user' | 'lock_account' | 'require_mfa';
  config: Record<string, any>;
}

export class SecurityMonitoringService {
  private threats: Map<string, SecurityThreat> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private eventBuffer: SecurityEvent[] = [];
  private metrics: SecurityMetrics = {
    totalEvents: 0,
    threatCount: 0,
    activeThreats: 0,
    riskScore: 0,
    complianceScore: 100,
    lastUpdated: new Date(),
    eventsByType: {} as Record<SecurityEventType, number>,
    threatsByType: {} as Record<ThreatType, number>,
  };

  constructor(
    private readonly securityEventLogger: SecurityEventLoggerService,
    private readonly logger: Logger
  ) {
    this.initializeDefaultAlertRules();
    this.startEventProcessing();
  }

  /**
   * Process security event and detect threats
   */
  async processSecurityEvent(event: SecurityEvent): Promise<void> {
    const correlationId = event.correlationId || SecureIdGenerator.generateCorrelationId();

    try {
      // Add to event buffer
      this.eventBuffer.push(event);

      // Update metrics
      this.updateMetrics(event);

      // Log the event
      await this.securityEventLogger.logSecurityEvent(event);

      // Detect threats
      const threats = await this.detectThreats(event, correlationId);
      for (const threat of threats) {
        await this.handleThreat(threat, correlationId);
      }

      // Check alert rules
      await this.checkAlertRules(event, correlationId);

      // Maintain enterprise security features
      await this.maintainEnterpriseFeatures(event, correlationId);

      this.logger.debug('Security event processed', {
        correlationId,
        eventType: event.type,
        severity: event.severity,
        threatsDetected: threats.length,
      });
    } catch (error) {
      this.logger.error('Failed to process security event', {
        correlationId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Detect threats based on security events
   */
  private async detectThreats(
    event: SecurityEvent,
    correlationId: string
  ): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Brute force detection
      if (event.type === 'login_failure') {
        const bruteForceThreats = await this.detectBruteForce(event, correlationId);
        threats.push(...bruteForceThreats);
      }

      // Credential stuffing detection
      if (event.type === 'login_failure' || event.type === 'login_suspicious') {
        const credentialStuffingThreats = await this.detectCredentialStuffing(event, correlationId);
        threats.push(...credentialStuffingThreats);
      }

      // Suspicious login pattern detection
      if (event.type === 'login_success' || event.type === 'login_suspicious') {
        const suspiciousPatternThreats = await this.detectSuspiciousLoginPatterns(
          event,
          correlationId
        );
        threats.push(...suspiciousPatternThreats);
      }

      // MFA bypass detection
      if (event.type === 'mfa_bypass_attempt') {
        const mfaBypassThreat = await this.detectMFABypass(event, correlationId);
        if (mfaBypassThreat) {
          threats.push(mfaBypassThreat);
        }
      }

      // Device anomaly detection
      if (event.type === 'device_change') {
        const deviceAnomalyThreat = await this.detectDeviceAnomaly(event, correlationId);
        if (deviceAnomalyThreat) {
          threats.push(deviceAnomalyThreat);
        }
      }

      // Location anomaly detection
      if (event.type === 'location_change') {
        const locationAnomalyThreat = await this.detectLocationAnomaly(event, correlationId);
        if (locationAnomalyThreat) {
          threats.push(locationAnomalyThreat);
        }
      }

      return threats;
    } catch (error) {
      this.logger.error('Threat detection error', {
        correlationId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Detect brute force attacks
   */
  private async detectBruteForce(
    event: SecurityEvent,
    correlationId: string
  ): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Check for multiple failed login attempts from same IP
      const recentFailures = this.eventBuffer.filter(
        e =>
          e.type === 'login_failure' &&
          e.ipAddress === event.ipAddress &&
          e.timestamp &&
          Date.now() - e.timestamp.getTime() < 15 * 60 * 1000 // 15 minutes
      );

      if (recentFailures.length >= 5) {
        const threat: SecurityThreat = {
          id: SecureIdGenerator.generateSecureId(),
          type: 'brute_force_attack',
          severity: 'high',
          ipAddress: event.ipAddress,
          description: `Brute force attack detected from IP ${event.ipAddress}`,
          indicators: [
            {
              type: 'ip_address',
              value: event.ipAddress || 'unknown',
              confidence: 90,
              source: 'login_failure_analysis',
            },
            {
              type: 'failure_count',
              value: recentFailures.length.toString(),
              confidence: 95,
              source: 'event_correlation',
            },
          ],
          detectedAt: new Date(),
          status: 'active',
          metadata: {
            correlationId,
            failureCount: recentFailures.length,
            timeWindow: '15 minutes',
          },
        };

        threats.push(threat);
      }

      // Check for multiple failed attempts across different users from same IP
      const uniqueUsers = new Set(recentFailures.filter(e => e.userId).map(e => e.userId));

      if (uniqueUsers.size >= 3) {
        const threat: SecurityThreat = {
          id: SecureIdGenerator.generateSecureId(),
          type: 'credential_stuffing',
          severity: 'critical',
          ipAddress: event.ipAddress,
          description: `Credential stuffing attack detected from IP ${event.ipAddress}`,
          indicators: [
            {
              type: 'ip_address',
              value: event.ipAddress || 'unknown',
              confidence: 95,
              source: 'multi_user_analysis',
            },
            {
              type: 'unique_users_targeted',
              value: uniqueUsers.size.toString(),
              confidence: 90,
              source: 'user_correlation',
            },
          ],
          detectedAt: new Date(),
          status: 'active',
          metadata: {
            correlationId,
            uniqueUsersTargeted: uniqueUsers.size,
            totalAttempts: recentFailures.length,
          },
        };

        threats.push(threat);
      }

      return threats;
    } catch (error) {
      this.logger.error('Brute force detection error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Detect credential stuffing attacks
   */
  private async detectCredentialStuffing(
    event: SecurityEvent,
    correlationId: string
  ): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      // Look for rapid login attempts across multiple accounts
      const recentEvents = this.eventBuffer.filter(
        e =>
          (e.type === 'login_failure' || e.type === 'login_suspicious') &&
          e.ipAddress === event.ipAddress &&
          e.timestamp &&
          Date.now() - e.timestamp.getTime() < 10 * 60 * 1000 // 10 minutes
      );

      const uniqueEmails = new Set(
        recentEvents.filter(e => e.metadata?.email).map(e => e.metadata!.email)
      );

      // High velocity across multiple accounts indicates credential stuffing
      if (uniqueEmails.size >= 5 && recentEvents.length >= 10) {
        const threat: SecurityThreat = {
          id: SecureIdGenerator.generateSecureId(),
          type: 'credential_stuffing',
          severity: 'critical',
          ipAddress: event.ipAddress,
          description: `Credential stuffing attack targeting ${uniqueEmails.size} accounts`,
          indicators: [
            {
              type: 'velocity',
              value: `${recentEvents.length} attempts in 10 minutes`,
              confidence: 95,
              source: 'velocity_analysis',
            },
            {
              type: 'account_spread',
              value: uniqueEmails.size.toString(),
              confidence: 90,
              source: 'account_analysis',
            },
          ],
          detectedAt: new Date(),
          status: 'active',
          metadata: {
            correlationId,
            accountsTargeted: uniqueEmails.size,
            totalAttempts: recentEvents.length,
            timeWindow: '10 minutes',
          },
        };

        threats.push(threat);
      }

      return threats;
    } catch (error) {
      this.logger.error('Credential stuffing detection error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Detect suspicious login patterns
   */
  private async detectSuspiciousLoginPatterns(
    event: SecurityEvent,
    correlationId: string
  ): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      if (!event.userId) return threats;

      // Check for impossible travel (logins from distant locations in short time)
      const recentLogins = this.eventBuffer.filter(
        e =>
          e.type === 'login_success' &&
          e.userId === event.userId &&
          e.timestamp &&
          Date.now() - e.timestamp.getTime() < 60 * 60 * 1000 // 1 hour
      );

      if (recentLogins.length >= 2) {
        // In a real implementation, you would calculate geographic distance
        // For now, we'll check for different IP addresses
        const uniqueIPs = new Set(recentLogins.map(e => e.ipAddress));

        if (uniqueIPs.size >= 2) {
          const threat: SecurityThreat = {
            id: SecureIdGenerator.generateSecureId(),
            type: 'suspicious_login_pattern',
            severity: 'medium',
            userId: event.userId,
            description: `Suspicious login pattern detected for user ${event.userId}`,
            indicators: [
              {
                type: 'impossible_travel',
                value: `${uniqueIPs.size} different locations in 1 hour`,
                confidence: 70,
                source: 'geolocation_analysis',
              },
            ],
            detectedAt: new Date(),
            status: 'active',
            metadata: {
              correlationId,
              uniqueLocations: uniqueIPs.size,
              timeWindow: '1 hour',
            },
          };

          threats.push(threat);
        }
      }

      return threats;
    } catch (error) {
      this.logger.error('Suspicious login pattern detection error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Detect MFA bypass attempts
   */
  private async detectMFABypass(
    event: SecurityEvent,
    correlationId: string
  ): Promise<SecurityThreat | null> {
    try {
      const threat: SecurityThreat = {
        id: SecureIdGenerator.generateSecureId(),
        type: 'mfa_bypass_attempt',
        severity: 'critical',
        userId: event.userId,
        ipAddress: event.ipAddress,
        description: `MFA bypass attempt detected for user ${event.userId}`,
        indicators: [
          {
            type: 'mfa_bypass',
            value: 'attempted',
            confidence: 100,
            source: 'mfa_service',
          },
        ],
        detectedAt: new Date(),
        status: 'active',
        metadata: {
          correlationId,
          eventMetadata: event.metadata,
        },
      };

      return threat;
    } catch (error) {
      this.logger.error('MFA bypass detection error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Detect device anomalies
   */
  private async detectDeviceAnomaly(
    event: SecurityEvent,
    correlationId: string
  ): Promise<SecurityThreat | null> {
    try {
      // Check if this is a completely new device for the user
      const userDeviceHistory = this.eventBuffer.filter(
        e =>
          e.userId === event.userId &&
          e.deviceFingerprint &&
          e.timestamp &&
          Date.now() - e.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000 // 30 days
      );

      const knownDevices = new Set(userDeviceHistory.map(e => e.deviceFingerprint));

      if (event.deviceFingerprint && !knownDevices.has(event.deviceFingerprint)) {
        const threat: SecurityThreat = {
          id: SecureIdGenerator.generateSecureId(),
          type: 'device_anomaly',
          severity: 'medium',
          userId: event.userId,
          ipAddress: event.ipAddress,
          description: `New device detected for user ${event.userId}`,
          indicators: [
            {
              type: 'new_device',
              value: event.deviceFingerprint,
              confidence: 80,
              source: 'device_fingerprinting',
            },
          ],
          detectedAt: new Date(),
          status: 'active',
          metadata: {
            correlationId,
            deviceFingerprint: event.deviceFingerprint,
            knownDevicesCount: knownDevices.size,
          },
        };

        return threat;
      }

      return null;
    } catch (error) {
      this.logger.error('Device anomaly detection error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Detect location anomalies
   */
  private async detectLocationAnomaly(
    event: SecurityEvent,
    correlationId: string
  ): Promise<SecurityThreat | null> {
    try {
      const threat: SecurityThreat = {
        id: SecureIdGenerator.generateSecureId(),
        type: 'location_anomaly',
        severity: 'low',
        userId: event.userId,
        ipAddress: event.ipAddress,
        description: `Location change detected for user ${event.userId}`,
        indicators: [
          {
            type: 'location_change',
            value: event.ipAddress || 'unknown',
            confidence: 60,
            source: 'geolocation_service',
          },
        ],
        detectedAt: new Date(),
        status: 'active',
        metadata: {
          correlationId,
          newLocation: event.ipAddress,
        },
      };

      return threat;
    } catch (error) {
      this.logger.error('Location anomaly detection error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Handle detected threat
   */
  private async handleThreat(threat: SecurityThreat, correlationId: string): Promise<void> {
    try {
      // Store threat
      this.threats.set(threat.id, threat);

      // Update metrics
      this.metrics.threatCount++;
      this.metrics.activeThreats++;
      this.metrics.threatsByType[threat.type] = (this.metrics.threatsByType[threat.type] || 0) + 1;

      // Log threat detection
      this.logger.warn('Security threat detected', {
        correlationId,
        threatId: threat.id,
        threatType: threat.type,
        severity: threat.severity,
        userId: threat.userId,
        ipAddress: threat.ipAddress,
        description: threat.description,
      });

      // Take automated actions based on threat severity
      await this.takeAutomatedActions(threat, correlationId);

      // Generate security alert
      await this.securityEventLogger.logSecurityEvent({
        type: 'compliance_violation',
        severity: threat.severity as any,
        userId: threat.userId,
        ipAddress: threat.ipAddress,
        description: `Security threat detected: ${threat.description}`,
        metadata: {
          threatId: threat.id,
          threatType: threat.type,
          indicators: threat.indicators,
        },
        correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to handle threat', {
        correlationId,
        threatId: threat.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Take automated actions based on threat
   */
  private async takeAutomatedActions(threat: SecurityThreat, correlationId: string): Promise<void> {
    try {
      switch (threat.type) {
        case 'brute_force_attack':
        case 'credential_stuffing':
          if (threat.ipAddress) {
            // In a real implementation, you would block the IP address
            this.logger.warn('IP address should be blocked', {
              correlationId,
              threatId: threat.id,
              ipAddress: threat.ipAddress,
              action: 'block_ip',
            });
          }
          break;

        case 'mfa_bypass_attempt':
          if (threat.userId) {
            // Lock the account temporarily
            this.logger.warn('Account should be locked', {
              correlationId,
              threatId: threat.id,
              userId: threat.userId,
              action: 'lock_account',
            });
          }
          break;

        case 'device_anomaly':
        case 'location_anomaly':
          if (threat.userId) {
            // Require additional verification
            this.logger.info('Additional verification required', {
              correlationId,
              threatId: threat.id,
              userId: threat.userId,
              action: 'require_verification',
            });
          }
          break;

        default:
          // No automated action for other threat types
          break;
      }
    } catch (error) {
      this.logger.error('Failed to take automated actions', {
        correlationId,
        threatId: threat.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check alert rules against event
   */
  private async checkAlertRules(event: SecurityEvent, correlationId: string): Promise<void> {
    try {
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) continue;

        // Check if event type matches rule
        if (!rule.eventTypes.includes(event.type)) continue;

        // Check cooldown period
        if (rule.lastTriggered) {
          const cooldownEnd = new Date(
            rule.lastTriggered.getTime() + rule.cooldownPeriod * 60 * 1000
          );
          if (new Date() < cooldownEnd) continue;
        }

        // Check conditions
        const conditionsMet = rule.conditions.every(condition =>
          this.evaluateCondition(condition, event)
        );

        if (conditionsMet) {
          await this.triggerAlert(rule, event, correlationId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to check alert rules', {
        correlationId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(condition: AlertCondition, event: SecurityEvent): boolean {
    try {
      let eventValue: any;

      // Get value from event based on field
      switch (condition.field) {
        case 'severity':
          eventValue = event.severity;
          break;
        case 'userId':
          eventValue = event.userId;
          break;
        case 'ipAddress':
          eventValue = event.ipAddress;
          break;
        default:
          eventValue = event.metadata?.[condition.field];
          break;
      }

      // Evaluate condition based on operator
      switch (condition.operator) {
        case 'equals':
          return eventValue === condition.value;
        case 'contains':
          return typeof eventValue === 'string' && eventValue.includes(condition.value);
        case 'greater_than':
          return typeof eventValue === 'number' && eventValue > condition.value;
        case 'less_than':
          return typeof eventValue === 'number' && eventValue < condition.value;
        case 'in_range':
          return (
            typeof eventValue === 'number' &&
            Array.isArray(condition.value) &&
            eventValue >= condition.value[0] &&
            eventValue <= condition.value[1]
          );
        default:
          return false;
      }
    } catch (error) {
      this.logger.error('Failed to evaluate condition', {
        condition,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(
    rule: AlertRule,
    event: SecurityEvent,
    correlationId: string
  ): Promise<void> {
    try {
      // Update rule last triggered time
      rule.lastTriggered = new Date();

      // Execute alert actions
      for (const action of rule.actions) {
        await this.executeAlertAction(action, event, correlationId);
      }

      this.logger.warn('Security alert triggered', {
        correlationId,
        ruleId: rule.id,
        ruleName: rule.name,
        eventType: event.type,
        severity: rule.severity,
        actionsCount: rule.actions.length,
      });
    } catch (error) {
      this.logger.error('Failed to trigger alert', {
        correlationId,
        ruleId: rule.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute alert action
   */
  private async executeAlertAction(
    action: AlertAction,
    event: SecurityEvent,
    correlationId: string
  ): Promise<void> {
    try {
      switch (action.type) {
        case 'email':
          // In a real implementation, send email notification
          this.logger.info('Email alert would be sent', {
            correlationId,
            action: action.type,
            config: action.config,
            eventType: event.type,
          });
          break;

        case 'webhook':
          // In a real implementation, call webhook
          this.logger.info('Webhook would be called', {
            correlationId,
            action: action.type,
            config: action.config,
            eventType: event.type,
          });
          break;

        case 'block_user':
          if (event.userId) {
            this.logger.warn('User would be blocked', {
              correlationId,
              action: action.type,
              userId: event.userId,
              eventType: event.type,
            });
          }
          break;

        case 'lock_account':
          if (event.userId) {
            this.logger.warn('Account would be locked', {
              correlationId,
              action: action.type,
              userId: event.userId,
              eventType: event.type,
            });
          }
          break;

        case 'require_mfa':
          if (event.userId) {
            this.logger.info('MFA would be required', {
              correlationId,
              action: action.type,
              userId: event.userId,
              eventType: event.type,
            });
          }
          break;

        default:
          this.logger.warn('Unknown alert action type', {
            correlationId,
            actionType: action.type,
          });
          break;
      }
    } catch (error) {
      this.logger.error('Failed to execute alert action', {
        correlationId,
        actionType: action.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Maintain enterprise security features
   */
  private async maintainEnterpriseFeatures(
    event: SecurityEvent,
    correlationId: string
  ): Promise<void> {
    try {
      // Maintain MFA enforcement
      if (event.type === 'login_success' && event.userId) {
        await this.maintainMFAEnforcement(event.userId, correlationId);
      }

      // Maintain OAuth integrations
      if (event.type === 'oauth_authorization') {
        await this.maintainOAuthIntegrations(event, correlationId);
      }

      // Maintain WebAuthn credentials
      if (event.type === 'webauthn_registration' || event.type === 'webauthn_authentication') {
        await this.maintainWebAuthnCredentials(event, correlationId);
      }

      // Maintain passwordless authentication
      if (event.type === 'passwordless_auth') {
        await this.maintainPasswordlessAuth(event, correlationId);
      }

      // Maintain GDPR compliance
      if (this.isGDPRRelevantEvent(event.type)) {
        await this.maintainGDPRCompliance(event, correlationId);
      }

      // Update compliance score
      this.updateComplianceScore(event);
    } catch (error) {
      this.logger.error('Failed to maintain enterprise features', {
        correlationId,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Maintain MFA enforcement
   */
  private async maintainMFAEnforcement(userId: string, correlationId: string): Promise<void> {
    try {
      // Check if user should have MFA enabled based on risk profile
      const userEvents = this.eventBuffer.filter(
        e =>
          e.userId === userId &&
          e.timestamp &&
          Date.now() - e.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
      );

      const riskEvents = userEvents.filter(e => e.severity === 'high' || e.severity === 'critical');

      if (riskEvents.length > 0) {
        this.logger.info('MFA enforcement recommended', {
          correlationId,
          userId,
          riskEventsCount: riskEvents.length,
          recommendation: 'enable_mfa',
        });
      }
    } catch (error) {
      this.logger.error('Failed to maintain MFA enforcement', {
        correlationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Maintain OAuth integrations
   */
  private async maintainOAuthIntegrations(
    event: SecurityEvent,
    correlationId: string
  ): Promise<void> {
    try {
      this.logger.debug('OAuth integration maintained', {
        correlationId,
        eventType: event.type,
        provider: event.metadata?.provider,
      });
    } catch (error) {
      this.logger.error('Failed to maintain OAuth integrations', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Maintain WebAuthn credentials
   */
  private async maintainWebAuthnCredentials(
    event: SecurityEvent,
    correlationId: string
  ): Promise<void> {
    try {
      this.logger.debug('WebAuthn credentials maintained', {
        correlationId,
        eventType: event.type,
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error('Failed to maintain WebAuthn credentials', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Maintain passwordless authentication
   */
  private async maintainPasswordlessAuth(
    event: SecurityEvent,
    correlationId: string
  ): Promise<void> {
    try {
      this.logger.debug('Passwordless authentication maintained', {
        correlationId,
        eventType: event.type,
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error('Failed to maintain passwordless authentication', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Maintain GDPR compliance
   */
  private async maintainGDPRCompliance(event: SecurityEvent, correlationId: string): Promise<void> {
    try {
      // Ensure GDPR-relevant events are properly logged and retained
      await this.securityEventLogger.createAuditTrail({
        userId: event.userId,
        action: `gdpr_${event.type}`,
        resource: 'security_monitoring',
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: event.timestamp || new Date(),
        correlationId,
        gdprRelevant: true,
        retentionPeriod: this.getGDPRRetentionPeriod(event.type),
        metadata: event.metadata,
      });

      this.logger.debug('GDPR compliance maintained', {
        correlationId,
        eventType: event.type,
        userId: event.userId,
        gdprRelevant: true,
      });
    } catch (error) {
      this.logger.error('Failed to maintain GDPR compliance', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(event: SecurityEvent): void {
    this.metrics.totalEvents++;
    this.metrics.eventsByType[event.type] = (this.metrics.eventsByType[event.type] || 0) + 1;
    this.metrics.lastUpdated = new Date();

    // Update risk score based on event severity
    const severityScores = { low: 1, medium: 5, high: 15, critical: 30 };
    const eventScore = severityScores[event.severity] || 0;

    // Exponential moving average for risk score
    const alpha = 0.1;
    this.metrics.riskScore = (1 - alpha) * this.metrics.riskScore + alpha * eventScore;
  }

  /**
   * Update compliance score
   */
  private updateComplianceScore(event: SecurityEvent): void {
    // Decrease compliance score for security violations
    if (event.severity === 'critical') {
      this.metrics.complianceScore = Math.max(0, this.metrics.complianceScore - 5);
    } else if (event.severity === 'high') {
      this.metrics.complianceScore = Math.max(0, this.metrics.complianceScore - 2);
    }

    // Gradually recover compliance score over time
    if (event.type === 'login_success' || event.type === 'mfa_enabled') {
      this.metrics.complianceScore = Math.min(100, this.metrics.complianceScore + 0.1);
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'critical_events',
        name: 'Critical Security Events',
        description: 'Alert on all critical security events',
        eventTypes: ['mfa_bypass_attempt', 'unauthorized_access', 'session_hijack_attempt'],
        conditions: [
          {
            field: 'severity',
            operator: 'equals',
            value: 'critical',
          },
        ],
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5, // 5 minutes
        actions: [
          {
            type: 'email',
            config: { recipients: ['security@company.com'] },
          },
          {
            type: 'webhook',
            config: { url: 'https://security-webhook.company.com/alerts' },
          },
        ],
      },
      {
        id: 'brute_force_detection',
        name: 'Brute Force Attack Detection',
        description: 'Alert on potential brute force attacks',
        eventTypes: ['login_failure'],
        conditions: [
          {
            field: 'severity',
            operator: 'greater_than',
            value: 'medium',
          },
        ],
        severity: 'high',
        enabled: true,
        cooldownPeriod: 15, // 15 minutes
        actions: [
          {
            type: 'email',
            config: { recipients: ['security@company.com'] },
          },
          {
            type: 'block_user',
            config: { duration: 3600 }, // 1 hour
          },
        ],
      },
      {
        id: 'mfa_bypass_attempts',
        name: 'MFA Bypass Attempts',
        description: 'Alert on MFA bypass attempts',
        eventTypes: ['mfa_bypass_attempt'],
        conditions: [],
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 0, // No cooldown for MFA bypass
        actions: [
          {
            type: 'email',
            config: { recipients: ['security@company.com'] },
          },
          {
            type: 'lock_account',
            config: { duration: 7200 }, // 2 hours
          },
        ],
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Start event processing
   */
  private startEventProcessing(): void {
    // Clean up old events every 5 minutes
    setInterval(
      () => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        this.eventBuffer = this.eventBuffer.filter(
          event => !event.timestamp || event.timestamp.getTime() > cutoff
        );
      },
      5 * 60 * 1000
    );

    // Update active threats count every minute
    setInterval(() => {
      this.metrics.activeThreats = Array.from(this.threats.values()).filter(
        threat => threat.status === 'active'
      ).length;
    }, 60 * 1000);
  }

  /**
   * Check if event type is GDPR relevant
   */
  private isGDPRRelevantEvent(eventType: SecurityEventType): boolean {
    const gdprRelevantEvents: SecurityEventType[] = [
      'login_success',
      'login_failure',
      'data_access',
      'data_export',
      'data_deletion',
      'gdpr_data_request',
      'gdpr_data_export',
      'gdpr_data_deletion',
    ];

    return gdprRelevantEvents.includes(eventType);
  }

  /**
   * Get GDPR retention period for event type
   */
  private getGDPRRetentionPeriod(eventType: SecurityEventType): number {
    const retentionPeriods: Record<string, number> = {
      login_success: 365, // 1 year
      login_failure: 365, // 1 year
      data_access: 2555, // 7 years
      data_export: 2555, // 7 years
      data_deletion: 2555, // 7 years
      gdpr_data_request: 2555, // 7 years
    };

    return retentionPeriods[eventType] || 365; // Default 1 year
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active threats
   */
  getActiveThreats(): SecurityThreat[] {
    return Array.from(this.threats.values()).filter(threat => threat.status === 'active');
  }

  /**
   * Get threat by ID
   */
  getThreat(threatId: string): SecurityThreat | undefined {
    return this.threats.get(threatId);
  }

  /**
   * Mitigate threat
   */
  async mitigateThreat(threatId: string, mitigatedBy: string, reason?: string): Promise<boolean> {
    const threat = this.threats.get(threatId);
    if (!threat) {
      return false;
    }

    threat.status = 'mitigated';
    threat.mitigatedAt = new Date();
    threat.mitigatedBy = mitigatedBy;

    if (reason) {
      threat.metadata = { ...threat.metadata, mitigationReason: reason };
    }

    this.logger.info('Threat mitigated', {
      threatId,
      threatType: threat.type,
      mitigatedBy,
      reason,
    });

    return true;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.logger.info('Alert rule added', {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
    });
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      this.logger.info('Alert rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }
}
