import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';
import { Inject } from '@nestjs/common';
import { CustomLoggerService } from '../logger.service';
import { LogAlertRuleInput } from '../inputs/logger.input';
import { AlertSubscriptionPayloadType } from '../types/logger.types';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: any;
  threshold: number;
  timeWindowSeconds: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels: string[];
  enabled: boolean;
  tenantId: string;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

interface AlertState {
  ruleId: string;
  currentCount: number;
  windowStart: Date;
  recentEvents: any[];
}

@Injectable()
export class LoggerAlertService {
  private alertRules = new Map<string, AlertRule>();
  private alertStates = new Map<string, AlertState>();
  private activeAlerts = new Map<string, any>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly loggerService: CustomLoggerService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    this.loggerService.setContext('LoggerAlertService');
    this.setupEventListeners();
    this.startAlertProcessing();
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }
    return undefined;
  }

  async createAlertRule(
    input: LogAlertRuleInput,
    tenantId: string,
  ): Promise<AlertRule> {
    try {
      const ruleId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const rule: AlertRule = {
        id: ruleId,
        name: input.name,
        description: input.description,
        conditions: input.conditions,
        threshold: input.threshold,
        timeWindowSeconds: input.timeWindowSeconds,
        severity: input.severity || 'medium',
        notificationChannels: input.notificationChannels,
        enabled: input.enabled !== false,
        tenantId,
        createdAt: new Date(),
        triggerCount: 0,
      };

      this.alertRules.set(ruleId, rule);
      
      // Initialize alert state
      this.alertStates.set(ruleId, {
        ruleId,
        currentCount: 0,
        windowStart: new Date(),
        recentEvents: [],
      });

      this.loggerService.audit(
        'alert_rule_created',
        {
          ruleId,
          name: input.name,
          threshold: input.threshold,
          timeWindowSeconds: input.timeWindowSeconds,
          severity: input.severity,
        },
        { tenantId },
      );

      return rule;
    } catch (error) {
      this.loggerService.error(
        'Failed to create alert rule',
        this.getErrorStack(error),
        { tenantId, input, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async updateAlertRule(
    ruleId: string,
    input: Partial<LogAlertRuleInput>,
    tenantId: string,
  ): Promise<AlertRule> {
    try {
      const rule = this.alertRules.get(ruleId);
      if (!rule || rule.tenantId !== tenantId) {
        throw new Error('Alert rule not found or access denied');
      }

      const updatedRule: AlertRule = {
        ...rule,
        ...input,
        id: ruleId,
        tenantId,
      };

      this.alertRules.set(ruleId, updatedRule);

      this.loggerService.audit(
        'alert_rule_updated',
        {
          ruleId,
          changes: input,
        },
        { tenantId },
      );

      return updatedRule;
    } catch (error) {
      this.loggerService.error(
        'Failed to update alert rule',
        this.getErrorStack(error),
        { ruleId, tenantId, input, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async deleteAlertRule(ruleId: string, tenantId: string): Promise<void> {
    try {
      const rule = this.alertRules.get(ruleId);
      if (!rule || rule.tenantId !== tenantId) {
        throw new Error('Alert rule not found or access denied');
      }

      this.alertRules.delete(ruleId);
      this.alertStates.delete(ruleId);
      this.activeAlerts.delete(ruleId);

      this.loggerService.audit(
        'alert_rule_deleted',
        { ruleId, ruleName: rule.name },
        { tenantId },
      );
    } catch (error) {
      this.loggerService.error(
        'Failed to delete alert rule',
        this.getErrorStack(error),
        { ruleId, tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getAlertRules(tenantId: string): Promise<AlertRule[]> {
    try {
      const rules = Array.from(this.alertRules.values())
        .filter(rule => rule.tenantId === tenantId);

      return rules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.loggerService.error(
        'Failed to get alert rules',
        this.getErrorStack(error),
        { tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getActiveAlerts(tenantId: string): Promise<any[]> {
    try {
      const alerts = Array.from(this.activeAlerts.values())
        .filter(alert => alert.tenantId === tenantId);

      return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
    } catch (error) {
      this.loggerService.error(
        'Failed to get active alerts',
        this.getErrorStack(error),
        { tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, tenantId: string, userId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert || alert.tenantId !== tenantId) {
        throw new Error('Alert not found or access denied');
      }

      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = userId;
      alert.status = 'acknowledged';

      this.activeAlerts.set(alertId, alert);

      this.loggerService.audit(
        'alert_acknowledged',
        {
          alertId,
          ruleId: alert.ruleId,
          acknowledgedBy: userId,
        },
        { tenantId, userId },
      );

      // Publish alert update
      this.pubSub.publish(`alerts_${tenantId}`, {
        alertType: 'acknowledged',
        severity: alert.severity,
        message: `Alert ${alert.ruleName} acknowledged by user`,
        details: { alertId, acknowledgedBy: userId },
        timestamp: new Date(),
      });
    } catch (error) {
      this.loggerService.error(
        'Failed to acknowledge alert',
        this.getErrorStack(error),
        { alertId, tenantId, userId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  createAlertStream(
    tenantId: string,
    severity?: string,
  ): AsyncIterator<AlertSubscriptionPayloadType> {
    try {
      const topic = severity ? `alerts_${tenantId}_${severity}` : `alerts_${tenantId}`;
      
      this.loggerService.audit(
        'alert_stream_created',
        { tenantId, severity },
        { tenantId },
      );

      return (this.pubSub as any).asyncIterator(topic) as AsyncIterator<AlertSubscriptionPayloadType>;
    } catch (error) {
      this.loggerService.error(
        'Failed to create alert stream',
        this.getErrorStack(error),
        { tenantId, severity, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  async getAlertMetrics(tenantId: string): Promise<any> {
    try {
      const rules = await this.getAlertRules(tenantId);
      const activeAlerts = await this.getActiveAlerts(tenantId);
      
      const totalRules = rules.length;
      const enabledRules = rules.filter(rule => rule.enabled).length;
      const totalTriggers = rules.reduce((sum, rule) => sum + rule.triggerCount, 0);
      
      const alertsBySeverity = {
        low: activeAlerts.filter(alert => alert.severity === 'low').length,
        medium: activeAlerts.filter(alert => alert.severity === 'medium').length,
        high: activeAlerts.filter(alert => alert.severity === 'high').length,
        critical: activeAlerts.filter(alert => alert.severity === 'critical').length,
      };

      const last24Hours = activeAlerts.filter(
        alert => alert.triggeredAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
      );

      return {
        totalRules,
        enabledRules,
        totalActiveAlerts: activeAlerts.length,
        totalTriggers,
        alertsBySeverity,
        alertsLast24Hours: last24Hours.length,
        averageResponseTime: this.calculateAverageResponseTime(activeAlerts),
        topAlertRules: this.getTopAlertRules(rules, 5),
      };
    } catch (error) {
      this.loggerService.error(
        'Failed to get alert metrics',
        this.getErrorStack(error),
        { tenantId, error: this.getErrorMessage(error) },
      );
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen for log entries to evaluate against alert rules
    this.eventEmitter.on('log.entry', (logEntry) => {
      this.evaluateLogAgainstRules(logEntry);
    });

    // Listen for batch log events
    this.eventEmitter.on('logs.batch', (batchData) => {
      batchData.logs.forEach((logEntry: any) => {
        this.evaluateLogAgainstRules(logEntry);
      });
    });
  }

  private startAlertProcessing(): void {
    // Process alert states every 30 seconds
    setInterval(() => {
      this.processAlertStates();
    }, 30000);

    // Cleanup old alert states every 5 minutes
    setInterval(() => {
      this.cleanupOldAlertStates();
    }, 300000);
  }

  private evaluateLogAgainstRules(logEntry: any): void {
    try {
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled || rule.tenantId !== logEntry.tenantId) {
          continue;
        }

        if (this.matchesRuleConditions(logEntry, rule.conditions)) {
          this.incrementAlertState(rule.id, logEntry);
        }
      }
    } catch (error) {
      this.loggerService.error(
        'Failed to evaluate log against alert rules',
        this.getErrorStack(error),
        { logEntry: logEntry.id, error: this.getErrorMessage(error) },
      );
    }
  }

  private matchesRuleConditions(logEntry: any, conditions: any): boolean {
    // Apply the same filtering logic as in search service
    if (conditions.level && logEntry.level !== conditions.level) {
      return false;
    }

    if (conditions.category && logEntry.category !== conditions.category) {
      return false;
    }

    if (conditions.operation && !logEntry.operation?.includes(conditions.operation)) {
      return false;
    }

    if (conditions.context && !logEntry.context?.includes(conditions.context)) {
      return false;
    }

    if (conditions.minDuration && (logEntry.duration || 0) < conditions.minDuration) {
      return false;
    }

    if (conditions.maxDuration && (logEntry.duration || 0) > conditions.maxDuration) {
      return false;
    }

    // Add more condition checks as needed

    return true;
  }

  private incrementAlertState(ruleId: string, logEntry: any): void {
    const state = this.alertStates.get(ruleId);
    if (!state) return;

    const now = new Date();
    const rule = this.alertRules.get(ruleId);
    if (!rule) return;

    // Check if we need to reset the time window
    const windowElapsed = now.getTime() - state.windowStart.getTime();
    if (windowElapsed > rule.timeWindowSeconds * 1000) {
      state.currentCount = 0;
      state.windowStart = now;
      state.recentEvents = [];
    }

    // Increment count and add event
    state.currentCount++;
    state.recentEvents.push({
      timestamp: logEntry.timestamp,
      level: logEntry.level,
      message: logEntry.message,
      operation: logEntry.operation,
    });

    // Keep only recent events (last 100)
    if (state.recentEvents.length > 100) {
      state.recentEvents = state.recentEvents.slice(-100);
    }

    this.alertStates.set(ruleId, state);

    // Check if threshold is exceeded
    if (state.currentCount >= rule.threshold) {
      this.triggerAlert(rule, state);
    }
  }

  private triggerAlert(rule: AlertRule, state: AlertState): void {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const alert = {
        id: alertId,
        ruleId: rule.id,
        ruleName: rule.name,
        ruleDescription: rule.description,
        severity: rule.severity,
        tenantId: rule.tenantId,
        triggeredAt: new Date(),
        status: 'active',
        eventCount: state.currentCount,
        timeWindow: rule.timeWindowSeconds,
        recentEvents: state.recentEvents.slice(-10), // Last 10 events
        notificationChannels: rule.notificationChannels,
      };

      this.activeAlerts.set(alertId, alert);

      // Update rule trigger count
      rule.triggerCount++;
      rule.lastTriggered = new Date();
      this.alertRules.set(rule.id, rule);

      // Reset alert state
      state.currentCount = 0;
      state.windowStart = new Date();
      state.recentEvents = [];
      this.alertStates.set(rule.id, state);

      // Log the alert
      this.loggerService.security(
        'alert_triggered',
        {
          alertId,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          eventCount: alert.eventCount,
          timeWindow: rule.timeWindowSeconds,
        },
        { tenantId: rule.tenantId },
      );

      // Publish to GraphQL subscriptions
      const payload: AlertSubscriptionPayloadType = {
        alertType: 'triggered',
        severity: rule.severity,
        message: `Alert "${rule.name}" triggered: ${alert.eventCount} events in ${rule.timeWindowSeconds} seconds`,
        details: {
          alertId,
          ruleId: rule.id,
          ruleName: rule.name,
          eventCount: alert.eventCount,
          recentEvents: alert.recentEvents,
        },
        timestamp: new Date(),
      };

      // Publish to general alerts stream
      this.pubSub.publish(`alerts_${rule.tenantId}`, payload);
      
      // Publish to severity-specific stream
      this.pubSub.publish(`alerts_${rule.tenantId}_${rule.severity}`, payload);

      // Send notifications (in a real implementation)
      this.sendAlertNotifications(alert);

    } catch (error) {
      this.loggerService.error(
        'Failed to trigger alert',
        this.getErrorStack(error),
        { ruleId: rule.id, error: this.getErrorMessage(error) },
      );
    }
  }

  private processAlertStates(): void {
    const now = Date.now();
    
    for (const [ruleId, state] of this.alertStates.entries()) {
      const rule = this.alertRules.get(ruleId);
      if (!rule) continue;

      // Check if time window has expired
      const windowElapsed = now - state.windowStart.getTime();
      if (windowElapsed > rule.timeWindowSeconds * 1000) {
        // Reset state if no recent activity
        if (state.currentCount > 0) {
          state.currentCount = 0;
          state.windowStart = new Date(now);
          state.recentEvents = [];
          this.alertStates.set(ruleId, state);
        }
      }
    }
  }

  private cleanupOldAlertStates(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup old active alerts
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      const age = now - alert.triggeredAt.getTime();
      if (age > maxAge && alert.status === 'acknowledged') {
        this.activeAlerts.delete(alertId);
      }
    }

    this.loggerService.performance(
      'alert_cleanup',
      Date.now(),
      {
        activeAlerts: this.activeAlerts.size,
        alertRules: this.alertRules.size,
        alertStates: this.alertStates.size,
      },
    );
  }

  private sendAlertNotifications(alert: any): void {
    // In a real implementation, this would send notifications via:
    // - Email
    // - Slack
    // - SMS
    // - Webhook
    // - etc.
    
    this.loggerService.audit(
      'alert_notifications_sent',
      {
        alertId: alert.id,
        channels: alert.notificationChannels,
        severity: alert.severity,
      },
      { tenantId: alert.tenantId },
    );
  }

  private calculateAverageResponseTime(alerts: any[]): number {
    const acknowledgedAlerts = alerts.filter(alert => alert.acknowledgedAt);
    
    if (acknowledgedAlerts.length === 0) return 0;

    const totalResponseTime = acknowledgedAlerts.reduce((sum, alert) => {
      return sum + (alert.acknowledgedAt.getTime() - alert.triggeredAt.getTime());
    }, 0);

    return Math.round(totalResponseTime / acknowledgedAlerts.length / 1000); // seconds
  }

  private getTopAlertRules(rules: AlertRule[], limit: number): any[] {
    return rules
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, limit)
      .map(rule => ({
        id: rule.id,
        name: rule.name,
        triggerCount: rule.triggerCount,
        severity: rule.severity,
        lastTriggered: rule.lastTriggered,
      }));
  }
}