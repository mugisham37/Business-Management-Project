import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { IntegrationRepository } from '../repositories/integration.repository';
import { ConnectorService } from './connector.service';
import { OAuth2Service } from './oauth2.service';
import { ApiKeyService } from './api-key.service';
import { WebhookService } from './webhook.service';
import { SyncService } from './sync.service';
import { IntegrationHealthService } from './integration-health.service';

import {
  CreateIntegrationInput,
  UpdateIntegrationInput,
  IntegrationFilterInput,
  IntegrationConfigInput,
} from '../inputs/integration.input';
import { TriggerSyncInput } from '../inputs/sync.input';
import { CreateWebhookInput } from '../inputs/webhook.input';

import {
  Integration,
  IntegrationStatus,
  AuthType,
} from '../entities/integration.entity';

import { SyncType } from '../entities/sync-log.entity';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly connectorService: ConnectorService,
    private readonly oauth2Service: OAuth2Service,
    private readonly apiKeyService: ApiKeyService,
    private readonly webhookService: WebhookService,
    private readonly syncService: SyncService,
    private readonly healthService: IntegrationHealthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new integration
   */
  async create(
    tenantId: string,
    input: CreateIntegrationInput,
    userId: string,
  ): Promise<Integration> {
    this.logger.log(`Creating integration: ${input.name} for tenant: ${tenantId}`);

    // Validate connector exists and is supported
    const connector = await this.connectorService.getConnector(input.type, input.providerName || '');
    if (!connector) {
      throw new BadRequestException(`Connector not found: ${input.providerName}`);
    }

    // Validate configuration against connector schema
    await this.connectorService.validateConfig(input.type, input.providerName || '', input.config || {});

    // Create integration record
    const integration = await this.integrationRepository.create({
      tenantId,
      name: input.name,
      displayName: input.displayName || input.name,
      ...(input.description ? { description: input.description } : {}),
      type: input.type,
      status: IntegrationStatus.PENDING,
      authType: input.authType,
      authConfig: input.authConfig || {},
      config: input.config || {},
      settings: input.settings || {},
      providerName: input.providerName || '',
      providerVersion: connector.getMetadata().version,
      connectorVersion: connector.getMetadata().version,
      syncEnabled: input.syncEnabled || false,
      ...(input.syncInterval ? { syncInterval: input.syncInterval } : {}),
      createdBy: userId,
      updatedBy: userId,
    });

    // Set up authentication if provided
    if (input.authType === AuthType.OAUTH2 && input.authConfig) {
      await this.oauth2Service.initializeOAuth2(integration.id, input.authConfig as any);
    } else if (input.authType === AuthType.API_KEY && input.credentials) {
      await this.apiKeyService.storeCredentials(integration.id, input.credentials);
    }

    // Set up webhooks if configured
    if (input.webhooks && input.webhooks.length > 0) {
      for (const webhookConfig of input.webhooks) {
        const webhookInput: CreateWebhookInput = {
          integrationId: integration.id,
          ...webhookConfig,
        };
        await this.webhookService.create(integration.id, webhookInput);
      }
    }

    // Emit integration created event
    this.eventEmitter.emit('integration.created', {
      tenantId,
      integrationId: integration.id,
      type: integration.type,
      providerName: integration.providerName,
    });

    this.logger.log(`Integration created successfully: ${integration.id}`);
    return integration;
  }

  /**
   * Get integration by ID
   */
  async findById(tenantId: string, integrationId: string): Promise<Integration> {
    const integration = await this.integrationRepository.findById(tenantId, integrationId);
    if (!integration) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }
    return integration;
  }

  /**
   * List integrations for tenant
   */
  async findAll(tenantId: string, filters?: IntegrationFilterInput): Promise<Integration[]> {
    return this.integrationRepository.findAll(tenantId, filters);
  }

  /**
   * Update integration configuration
   */
  async update(
    tenantId: string,
    integrationId: string,
    input: UpdateIntegrationInput,
    userId: string,
  ): Promise<Integration> {
    this.logger.log(`Updating integration: ${integrationId}`);

    const integration = await this.findById(tenantId, integrationId);

    // Validate configuration if provided
    if (input.config) {
      if (!integration.providerName) {
        throw new BadRequestException('Integration provider name is not set');
      }
      
      await this.connectorService.validateConfig(
        integration.type,
        integration.providerName,
        { ...integration.config, ...input.config },
      );
    }

    // Update integration
    const updatedIntegration = await this.integrationRepository.update(integrationId, {
      ...input,
      updatedBy: userId,
    });

    // Update authentication if changed
    if (input.authConfig) {
      if (integration.authType === AuthType.OAUTH2) {
        await this.oauth2Service.updateOAuth2Config(integrationId, input.authConfig as any);
      }
    }

    // Emit integration updated event
    this.eventEmitter.emit('integration.updated', {
      tenantId,
      integrationId,
      changes: input,
    });

    this.logger.log(`Integration updated successfully: ${integrationId}`);
    return updatedIntegration;
  }

  /**
   * Delete integration
   */
  async delete(tenantId: string, integrationId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting integration: ${integrationId}`);

    const integration = await this.findById(tenantId, integrationId);

    // Clean up related resources
    await this.oauth2Service.revokeTokens(integrationId);
    await this.apiKeyService.revokeApiKeys(integrationId);
    await this.webhookService.deleteByIntegration(integrationId);

    // Soft delete integration
    await this.integrationRepository.softDelete(integrationId, userId);

    // Emit integration deleted event
    this.eventEmitter.emit('integration.deleted', {
      tenantId,
      integrationId,
      type: integration.type,
      providerName: integration.providerName,
    });

    this.logger.log(`Integration deleted successfully: ${integrationId}`);
  }

  /**
   * Enable/disable integration
   */
  async updateStatus(
    tenantId: string,
    integrationId: string,
    status: IntegrationStatus,
    userId: string,
  ): Promise<Integration> {
    this.logger.log(`Updating integration status: ${integrationId} to ${status}`);

    const integration = await this.findById(tenantId, integrationId);

    // Validate status transition
    if (!this.isValidStatusTransition(integration.status, status)) {
      throw new BadRequestException(
        `Invalid status transition from ${integration.status} to ${status}`,
      );
    }

    // Update status
    const updatedIntegration = await this.integrationRepository.update(integrationId, {
      status,
      updatedBy: userId,
    });

    // Handle status-specific actions
    if (status === IntegrationStatus.ACTIVE) {
      // Test connection when activating
      await this.testConnection(tenantId, integrationId);
      
      // Schedule sync if enabled
      if (integration.syncEnabled && integration.syncInterval) {
        await this.syncService.scheduleSync(integrationId, integration.syncInterval);
      }
    } else if (status === IntegrationStatus.INACTIVE) {
      // Cancel scheduled syncs
      await this.syncService.cancelScheduledSync(integrationId);
    }

    // Emit status change event
    this.eventEmitter.emit('integration.status_changed', {
      tenantId,
      integrationId,
      oldStatus: integration.status,
      newStatus: status,
    });

    this.logger.log(`Integration status updated successfully: ${integrationId}`);
    return updatedIntegration;
  }

  /**
   * Trigger manual sync
   */
  /**
   * Get integration statistics
   */
  async getStatistics(tenantId: string, integrationId: string): Promise<any> {
    const integration = await this.findById(tenantId, integrationId);
    
    const [syncStats, webhookStats, healthStats] = await Promise.all([
      this.syncService.getStatistics(integrationId),
      this.webhookService.getStatistics(integrationId),
      this.healthService.getHealthHistory(integrationId),
    ]);

    return {
      integration: {
        id: integration.id,
        name: integration.name,
        type: integration.type,
        status: integration.status,
        createdAt: integration.createdAt,
        lastRequestAt: integration.lastRequestAt,
        requestCount: integration.requestCount,
        errorCount: integration.errorCount,
      },
      sync: syncStats,
      webhooks: webhookStats,
      health: healthStats,
    };
  }

  /**
   * Get sync history for an integration
   */
  async getSyncHistory(
    integrationId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<any[]> {
    return this.syncService.getSyncHistory(integrationId, tenantId, limit);
  }

  /**
   * Get sync details by ID
   */
  async getSyncDetails(syncId: string, tenantId: string): Promise<any> {
    return this.syncService.getSyncDetails(syncId, tenantId);
  }

  /**
   * Retry failed sync
   */
  async retrySync(syncId: string, tenantId: string): Promise<string> {
    return this.syncService.retrySync(syncId, tenantId);
  }

  /**
   * Scheduled health checks for all active integrations
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthChecks(): Promise<void> {
    this.logger.log('Performing scheduled health checks for all active integrations');

    try {
      const activeIntegrations = await this.integrationRepository.findByStatus(
        IntegrationStatus.ACTIVE,
      );

      const healthCheckPromises = activeIntegrations.map(async (integration) => {
        try {
          await this.testConnection(integration.tenantId, integration.id);
        } catch (error) {
          this.logger.error(
            `Health check failed for integration ${integration.id}:`,
            error,
          );
        }
      });

      await Promise.allSettled(healthCheckPromises);
      
      this.logger.log(`Completed health checks for ${activeIntegrations.length} integrations`);
    } catch (error) {
      this.logger.error('Failed to perform scheduled health checks:', error);
    }
  }

  /**
   * Validate status transition
   */
  private isValidStatusTransition(
    currentStatus: IntegrationStatus,
    newStatus: IntegrationStatus,
  ): boolean {
    const validTransitions = {
      [IntegrationStatus.PENDING]: [
        IntegrationStatus.ACTIVE,
        IntegrationStatus.INACTIVE,
        IntegrationStatus.ERROR,
      ],
      [IntegrationStatus.ACTIVE]: [
        IntegrationStatus.INACTIVE,
        IntegrationStatus.ERROR,
        IntegrationStatus.SUSPENDED,
      ],
      [IntegrationStatus.INACTIVE]: [
        IntegrationStatus.ACTIVE,
        IntegrationStatus.ERROR,
      ],
      [IntegrationStatus.ERROR]: [
        IntegrationStatus.ACTIVE,
        IntegrationStatus.INACTIVE,
        IntegrationStatus.SUSPENDED,
      ],
      [IntegrationStatus.SUSPENDED]: [
        IntegrationStatus.ACTIVE,
        IntegrationStatus.INACTIVE,
      ],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Test integration connection
   */
  async testConnection(tenantId: string, integrationId: string): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`Testing connection for integration: ${integrationId}`);
    
    try {
      const integration = await this.findById(tenantId, integrationId);
      
      if (!integration.providerName) {
        return { success: false, error: 'No provider configured' };
      }
      
      const connector = await this.connectorService.getConnector(integration.type as any, integration.providerName);
      if (!connector) {
        return { success: false, error: 'Connector not found' };
      }
      
      // Test connection using connector
      const result = await this.connectorService.testConnection(
        integration.type as any,
        integration.providerName,
        integration.config as any
      );
      
      // Update health status
      await this.healthService.updateHealthStatus(integrationId, result.success ? 'healthy' : 'unhealthy');
      
      return result;
    } catch (error) {
      this.logger.error(`Connection test failed for integration ${integrationId}:`, error);
      const err = error as Error;
      return { success: false, error: err.message || 'Connection test failed' };
    }
  }

  /**
   * Trigger sync for integration
   */
  async triggerSync(tenantId: string, integrationId: string, options: any): Promise<any> {
    this.logger.log(`Triggering sync for integration: ${integrationId}`);
    
    const integration = await this.findById(tenantId, integrationId);
    
    if (!integration.syncEnabled) {
      throw new BadRequestException('Sync is not enabled for this integration');
    }
    
    return this.syncService.triggerSync(integrationId, {
      type: options.type || 'incremental',
      triggeredBy: 'manual',
      tenantId,
      entityTypes: options.entityTypes,
      batchSize: options.batchSize,
      conflictResolution: options.conflictResolution,
      lastSyncTimestamp: options.lastSyncTimestamp,
    });
  }
}