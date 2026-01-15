import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: ThreatCondition[];
  timeWindow: number; // in milliseconds
  threshold: number;
  enabled: boolean;
}

export interface ThreatCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex';
  value: any;
  weight: number;
}

export interface ThreatAnalysis {
  threatId: string;
  confidence: number; // 0-100
  riskScore: number; // 0-100
  indicators: string[];
  recommendations: string[];
  timestamp: Date;
}

@Injectable()
export class ThreatDetectionService {
  private readonly logger = new Logger(ThreatDetectionService.name);
  private readonly threatPatterns: Map<string, ThreatPattern> = new Map();
  private readonly eventHistory: Map<string, any[]> = new Map();
  private readonly maxHistorySize: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.maxHistorySize = this.configService.get<number>('THREAT_DETECTION_HISTORY_SIZE', 10000);
    this.initializeThreatPatterns();
  }

  /**
   * Analyze an audit event for potential threats
   */
  async analyzeEvent(event: any): Promise<ThreatAnalysis[]> {
    try {
      const analyses: ThreatAnalysis[] = [];

      // Store event in history
      this.storeEventInHistory(event);

      // Check each threat pattern
      for (const pattern of this.threatPatterns.values()) {
        if (!pattern.enabled) continue;

        const analysis = await this.checkThreatPattern(event, pattern);
        if (analysis) {
          analyses.push(analysis);
        }
      }

      // Emit threat analyses
      if (analyses.length > 0) {
        this.eventEmitter.emit('threat.detected', {
          event,
          analyses,
          timestamp: new Date(),
        });
      }

      return analyses;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to analyze event for threats: ${err.message}`, err.stack);
      return [];
    }
  }

  /**
   * Add or update a threat pattern
   */
  async addThreatPattern(pattern: ThreatPattern): Promise<void> {
    this.threatPatterns.set(pattern.id, pattern);
    this.logger.log(`Added threat pattern: ${pattern.name}`);
  }

  /**
   * Remove a threat pattern
   */
  async removeThreatPattern(patternId: string): Promise<void> {
    this.threatPatterns.delete(patternId);
    this.logger.log(`Removed threat pattern: ${patternId}`);
  }

  /**
   * Get all threat patterns
   */
  async getThreatPatterns(): Promise<ThreatPattern[]> {
    return Array.from(this.threatPatterns.values());
  }

  /**
   * Enable or disable a threat pattern
   */
  async toggleThreatPattern(patternId: string, enabled: boolean): Promise<void> {
    const pattern = this.threatPatterns.get(patternId);
    if (pattern) {
      pattern.enabled = enabled;
      this.logger.log(`${enabled ? 'Enabled' : 'Disabled'} threat pattern: ${pattern.name}`);
    }
  }

  /**
   * Perform behavioral analysis on user activities
   */
  async performBehavioralAnalysis(userId: string, tenantId: string): Promise<ThreatAnalysis[]> {
    try {
      const userEvents = this.getUserEventHistory(userId, tenantId);
      const analyses: ThreatAnalysis[] = [];

      // Analyze login patterns
      const loginAnalysis = this.analyzeLoginPatterns(userEvents);
      if (loginAnalysis) analyses.push(loginAnalysis);

      // Analyze data access patterns
      const dataAccessAnalysis = this.analyzeDataAccessPatterns(userEvents);
      if (dataAccessAnalysis) analyses.push(dataAccessAnalysis);

      // Analyze time-based patterns
      const timeAnalysis = this.analyzeTimePatterns(userEvents);
      if (timeAnalysis) analyses.push(timeAnalysis);

      return analyses;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to perform behavioral analysis: ${err.message}`, err.stack);
      return [];
    }
  }

  /**
   * Check if an account is compromised
   */
  async isAccountCompromised(tenantId: string, userId: string): Promise<boolean> {
    try {
      const userEvents = this.getUserEventHistory(userId, tenantId);
      
      // Check for indicators of compromise
      const indicators = [
        this.checkUnusualLoginLocations(userEvents),
        this.checkRapidPasswordChanges(userEvents),
        this.checkUnusualDataAccess(userEvents),
        this.checkPrivilegeEscalation(userEvents),
      ];

      const compromiseScore = indicators.filter(Boolean).length;
      return compromiseScore >= 2; // Require at least 2 indicators
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to check account compromise: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Check if an IP is blacklisted
   */
  async isIpBlacklisted(ipAddress: string): Promise<boolean> {
    try {
      // Check against known malicious IPs
      const blacklistedIps = await this.getBlacklistedIps();
      return blacklistedIps.includes(ipAddress);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to check IP blacklist: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Initialize default threat patterns
   */
  private initializeThreatPatterns(): void {
    const defaultPatterns: ThreatPattern[] = [
      {
        id: 'brute_force_login',
        name: 'Brute Force Login Attack',
        description: 'Multiple failed login attempts in short time',
        severity: 'high',
        conditions: [
          {
            field: 'action',
            operator: 'equals',
            value: 'login',
            weight: 1,
          },
          {
            field: 'metadata.failed',
            operator: 'equals',
            value: true,
            weight: 1,
          },
        ],
        timeWindow: 5 * 60 * 1000, // 5 minutes
        threshold: 5,
        enabled: true,
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Attempt',
        description: 'Unauthorized attempt to gain higher privileges',
        severity: 'critical',
        conditions: [
          {
            field: 'action',
            operator: 'equals',
            value: 'update',
            weight: 1,
          },
          {
            field: 'resource',
            operator: 'contains',
            value: 'permission',
            weight: 2,
          },
        ],
        timeWindow: 60 * 60 * 1000, // 1 hour
        threshold: 1,
        enabled: true,
      },
      {
        id: 'data_exfiltration',
        name: 'Data Exfiltration Attempt',
        description: 'Unusual data export or access patterns',
        severity: 'critical',
        conditions: [
          {
            field: 'action',
            operator: 'equals',
            value: 'export',
            weight: 2,
          },
        ],
        timeWindow: 10 * 60 * 1000, // 10 minutes
        threshold: 10,
        enabled: true,
      },
      {
        id: 'unusual_access_time',
        name: 'Unusual Access Time',
        description: 'Access outside normal business hours',
        severity: 'medium',
        conditions: [
          {
            field: 'timestamp',
            operator: 'regex',
            value: /T(0[0-7]|1[8-9]|2[0-3]):/,
            weight: 1,
          },
        ],
        timeWindow: 60 * 60 * 1000, // 1 hour
        threshold: 5,
        enabled: true,
      },
    ];

    defaultPatterns.forEach(pattern => {
      this.threatPatterns.set(pattern.id, pattern);
    });

    this.logger.log(`Initialized ${defaultPatterns.length} default threat patterns`);
  }

  /**
   * Check a specific threat pattern against an event
   */
  private async checkThreatPattern(
    event: any,
    pattern: ThreatPattern,
  ): Promise<ThreatAnalysis | null> {
    try {
      // Get relevant events within time window
      const relevantEvents = this.getEventsInTimeWindow(
        event.tenantId,
        event.userId,
        pattern.timeWindow,
      );

      // Filter events that match pattern conditions
      const matchingEvents = relevantEvents.filter(e =>
        this.eventMatchesPattern(e, pattern),
      );

      if (matchingEvents.length >= pattern.threshold) {
        const confidence = Math.min(100, (matchingEvents.length / pattern.threshold) * 100);
        const riskScore = this.calculateRiskScore(pattern, matchingEvents);

        return {
          threatId: pattern.id,
          confidence,
          riskScore,
          indicators: this.extractIndicators(pattern, matchingEvents),
          recommendations: this.getRecommendations(pattern),
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to check threat pattern ${pattern.id}: ${err.message}`);
      return null;
    }
  }

  /**
   * Check if an event matches a threat pattern
   */
  private eventMatchesPattern(event: any, pattern: ThreatPattern): boolean {
    return pattern.conditions.every(condition => {
      const fieldValue = this.getNestedValue(event, condition.field);
      return this.evaluateCondition(fieldValue, condition);
    });
  }

  /**
   * Evaluate a threat condition
   */
  private evaluateCondition(fieldValue: any, condition: ThreatCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'regex':
        return condition.value.test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Store event in history for analysis
   */
  private storeEventInHistory(event: any): void {
    const key = `${event.tenantId}:${event.userId}`;
    
    if (!this.eventHistory.has(key)) {
      this.eventHistory.set(key, []);
    }

    const history = this.eventHistory.get(key)!;
    history.push({
      ...event,
      timestamp: new Date(event.timestamp || Date.now()),
    });

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  /**
   * Get user event history
   */
  private getUserEventHistory(userId: string, tenantId: string): any[] {
    const key = `${tenantId}:${userId}`;
    return this.eventHistory.get(key) || [];
  }

  /**
   * Get events within a time window
   */
  private getEventsInTimeWindow(
    tenantId: string,
    userId: string,
    timeWindow: number,
  ): any[] {
    const history = this.getUserEventHistory(userId, tenantId);
    const cutoff = new Date(Date.now() - timeWindow);
    
    return history.filter(event => 
      new Date(event.timestamp) >= cutoff,
    );
  }

  /**
   * Calculate risk score for a threat
   */
  private calculateRiskScore(pattern: ThreatPattern, events: any[]): number {
    const baseScore = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 100,
    }[pattern.severity];

    const frequencyMultiplier = Math.min(2, events.length / pattern.threshold);
    return Math.min(100, baseScore * frequencyMultiplier);
  }

  /**
   * Extract indicators from matching events
   */
  private extractIndicators(pattern: ThreatPattern, events: any[]): string[] {
    const indicators: string[] = [];
    
    indicators.push(`${events.length} events matching pattern "${pattern.name}"`);
    
    if (events.length > 0) {
      const timeSpan = new Date(events[events.length - 1].timestamp).getTime() - 
                      new Date(events[0].timestamp).getTime();
      indicators.push(`Events occurred over ${Math.round(timeSpan / 1000)} seconds`);
    }

    return indicators;
  }

  /**
   * Get recommendations for a threat pattern
   */
  private getRecommendations(pattern: ThreatPattern): string[] {
    const recommendations: Record<string, string[]> = {
      brute_force_login: [
        'Enable account lockout after failed attempts',
        'Implement CAPTCHA for suspicious IPs',
        'Consider IP-based rate limiting',
      ],
      privilege_escalation: [
        'Review user permissions immediately',
        'Audit recent permission changes',
        'Implement approval workflow for privilege changes',
      ],
      data_exfiltration: [
        'Review data access patterns',
        'Implement data loss prevention (DLP)',
        'Monitor large data exports',
      ],
      unusual_access_time: [
        'Verify user identity for off-hours access',
        'Implement additional authentication for unusual times',
        'Monitor for other suspicious activities',
      ],
    };

    return recommendations[pattern.id] || ['Review and investigate the activity'];
  }

  /**
   * Analyze login patterns for behavioral analysis
   */
  private analyzeLoginPatterns(events: any[]): ThreatAnalysis | null {
    const loginEvents = events.filter(e => e.action === 'login');
    
    if (loginEvents.length < 5) return null;

    // Check for unusual IP addresses
    const ips = loginEvents.map(e => e.ipAddress);
    const uniqueIps = new Set(ips);
    
    if (uniqueIps.size > 3) {
      return {
        threatId: 'unusual_login_locations',
        confidence: Math.min(100, (uniqueIps.size / loginEvents.length) * 100),
        riskScore: 60,
        indicators: [`Logins from ${uniqueIps.size} different IP addresses`],
        recommendations: ['Verify user identity', 'Check for account compromise'],
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Analyze data access patterns
   */
  private analyzeDataAccessPatterns(events: any[]): ThreatAnalysis | null {
    const dataEvents = events.filter(e => 
      e.action === 'read' || e.action === 'export',
    );
    
    if (dataEvents.length < 10) return null;

    // Check for rapid data access
    const timeSpan = new Date(dataEvents[dataEvents.length - 1].timestamp).getTime() - 
                    new Date(dataEvents[0].timestamp).getTime();
    
    if (timeSpan < 10 * 60 * 1000) { // 10 minutes
      return {
        threatId: 'rapid_data_access',
        confidence: 80,
        riskScore: 70,
        indicators: [`${dataEvents.length} data access events in ${Math.round(timeSpan / 1000)} seconds`],
        recommendations: ['Review data access patterns', 'Check for data exfiltration'],
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Analyze time-based patterns
   */
  private analyzeTimePatterns(events: any[]): ThreatAnalysis | null {
    const offHoursEvents = events.filter(e => {
      const hour = new Date(e.timestamp).getHours();
      return hour < 8 || hour > 18; // Outside 8 AM - 6 PM
    });

    if (offHoursEvents.length > events.length * 0.5) {
      return {
        threatId: 'unusual_time_patterns',
        confidence: 70,
        riskScore: 50,
        indicators: [`${offHoursEvents.length} events outside business hours`],
        recommendations: ['Verify legitimate business need for off-hours access'],
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Check for unusual login locations
   */
  private checkUnusualLoginLocations(events: any[]): boolean {
    const loginEvents = events.filter(e => e.action === 'login');
    const ips = loginEvents.map(e => e.ipAddress);
    const uniqueIps = new Set(ips);
    
    return uniqueIps.size > 5; // More than 5 different IPs
  }

  /**
   * Check for rapid password changes
   */
  private checkRapidPasswordChanges(events: any[]): boolean {
    const passwordEvents = events.filter(e => 
      e.action === 'password_change' || e.resource.includes('password'),
    );
    
    return passwordEvents.length > 3; // More than 3 password changes
  }

  /**
   * Check for unusual data access
   */
  private checkUnusualDataAccess(events: any[]): boolean {
    const dataEvents = events.filter(e => 
      e.action === 'read' || e.action === 'export',
    );
    
    return dataEvents.length > 100; // More than 100 data access events
  }

  /**
   * Check for privilege escalation
   */
  private checkPrivilegeEscalation(events: any[]): boolean {
    const privilegeEvents = events.filter(e => 
      e.resource.includes('permission') || e.resource.includes('role'),
    );
    
    return privilegeEvents.length > 0;
  }

  /**
   * Get blacklisted IPs (mock implementation)
   */
  private async getBlacklistedIps(): Promise<string[]> {
    // In a real implementation, this would query a threat intelligence database
    return [
      '192.168.1.100', // Example malicious IP
      '10.0.0.50',     // Example malicious IP
    ];
  }
}