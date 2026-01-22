import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { AuditRepository } from '../repositories/audit.repository';

import {
  AuditLogType,
  AuditSummaryType,
  AuditAction,
  AuditActionCountType,
  UserActivityType,
} from '../types/audit.graphql.types';

export interface AuditLogData {
  tenantId: string;
  integrationId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  userId: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createAuditLog(data: AuditLogData): Promise<AuditLogType> {
    const auditLog = await this.auditRepository.create({
      tenantId: data.tenantId,
      integrationId: data.integrationId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
      newValues: data.newValues ? JSON.stringify(data.newValues) : null,
      userId: data.userId,
      userEmail: data.userEmail,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      reason: data.reason,
      timestamp: new Date(),
    } as any);

    this.logger.log(`Audit log created: ${data.action} on ${data.entityType} by ${data.userId}`);
    return auditLog;
  }

  async getIntegrationAuditLogs(
    integrationId: string,
    filters: {
      action?: AuditAction;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<AuditLogType[]> {
    return this.auditRepository.findByIntegration(integrationId, filters);
  }

  async getIntegrationAuditSummary(
    integrationId: string,
    days: number = 30,
  ): Promise<AuditSummaryType> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.auditRepository.findByIntegration(integrationId, {
      startDate,
    });

    const actionCounts: Map<AuditAction, number> = new Map();
    const userActivity: Map<string, { email: string; count: number; lastActivity: Date }> = new Map();

    let lastActivity = new Date(0);

    for (const log of logs) {
      // Count actions
      const currentCount = actionCounts.get(log.action) || 0;
      actionCounts.set(log.action, currentCount + 1);

      // Track user activity
      const userKey = log.userId;
      const currentUserActivity = userActivity.get(userKey) || {
        email: log.userEmail || '',
        count: 0,
        lastActivity: new Date(0),
      };
      
      userActivity.set(userKey, {
        email: log.userEmail || currentUserActivity.email,
        count: currentUserActivity.count + 1,
        lastActivity: log.timestamp > currentUserActivity.lastActivity ? log.timestamp : currentUserActivity.lastActivity,
      });

      // Track overall last activity
      if (log.timestamp > lastActivity) {
        lastActivity = log.timestamp;
      }
    }

    const actionCountsArray: AuditActionCountType[] = Array.from(actionCounts.entries()).map(
      ([action, count]) => ({ action, count }),
    );

    const userActivityArray: UserActivityType[] = Array.from(userActivity.entries()).map(
      ([userId, activity]) => ({
        userId,
        userEmail: activity.email,
        actionCount: activity.count,
        lastActivity: activity.lastActivity,
      }),
    );

    return {
      integrationId,
      totalActions: logs.length,
      lastActivity,
      actionCounts: actionCountsArray,
      userActivity: userActivityArray,
    };
  }

  async getUserAuditLogs(
    userId: string,
    filters: {
      integrationId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<AuditLogType[]> {
    return this.auditRepository.findByUser(userId, filters);
  }

  // Event listeners for automatic audit logging
  @OnEvent('integration.created')
  async handleIntegrationCreated(event: any) {
    await this.createAuditLog({
      tenantId: event.tenantId,
      integrationId: event.integrationId,
      action: AuditAction.CREATE,
      entityType: 'integration',
      entityId: event.integrationId,
      newValues: event.integration,
      userId: event.userId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('integration.updated')
  async handleIntegrationUpdated(event: any) {
    await this.createAuditLog({
      tenantId: event.tenantId,
      integrationId: event.integrationId,
      action: AuditAction.UPDATE,
      entityType: 'integration',
      entityId: event.integrationId,
      oldValues: event.oldValues,
      newValues: event.newValues,
      userId: event.userId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('integration.deleted')
  async handleIntegrationDeleted(event: any) {
    await this.createAuditLog({
      tenantId: event.tenantId,
      integrationId: event.integrationId,
      action: AuditAction.DELETE,
      entityType: 'integration',
      entityId: event.integrationId,
      oldValues: event.integration,
      userId: event.userId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('integration.status_changed')
  async handleIntegrationStatusChanged(event: any) {
    const action = event.newStatus === 'active' ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE;
    
    await this.createAuditLog({
      tenantId: event.tenantId,
      integrationId: event.integrationId,
      action,
      entityType: 'integration',
      entityId: event.integrationId,
      oldValues: { status: event.oldStatus },
      newValues: { status: event.newStatus },
      userId: event.userId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('webhook.created')
  async handleWebhookCreated(event: any) {
    await this.createAuditLog({
      tenantId: event.tenantId,
      integrationId: event.integrationId,
      action: AuditAction.WEBHOOK_CREATE,
      entityType: 'webhook',
      entityId: event.webhookId,
      newValues: event.webhook,
      userId: event.userId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }

  @OnEvent('api_key.created')
  async handleApiKeyCreated(event: any) {
    await this.createAuditLog({
      tenantId: event.tenantId,
      integrationId: event.integrationId,
      action: AuditAction.API_KEY_CREATE,
      entityType: 'api_key',
      entityId: event.apiKeyId,
      newValues: { name: event.name, scopes: event.scopes },
      userId: event.userId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }
}