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
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationConfigDto,
  IntegrationStatusDto,
  IntegrationListDto,
} from '../dto/integration.dto';

import {
  Integration,
  IntegrationStatus,
  IntegrationType,
  AuthType,
} from '../entities/integration.entity';

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
    dto: CreateIntegrationDto,
    userId: string,
  ): Promise<Integration> {
    this.logger.log(`Creating integration: ${dto.name} for tenant: ${tenantId}`);

    // Validate connector exists and is supported
    const connector = await this.connectorService.getConnector(dto.type, dto.providerName);
    if (!connector) {
      throw new BadRequestException(`Connector not found: ${dto.providerName}`);
    }

    // Validate configuration against connector schema
    await this.connectorService.validateConfig(dto.type, dto.providerName, dto.config);

    // Create integration record
    const integration = await this.integrationRepository.create({
      tenantId,
      name: dto.name,
      displayName: dto.displayName || dto.name,
      description: dto.description,
      type: dto.type,
      status: IntegrationStatus.PENDING,
      authType: dto.authType,
      authConfig: dto.authConfig || {},
      config: dto.config || {},
      settings: dto.settings || {},
      providerName: dto.providerName,
      providerVersion: connector.version,
      connectorVersion: connector.version,
      syncEnabled: dto.syncEnabled || false,
      syncInterval: dto.syncInterval,
      createdBy: userId,
      updatedBy: userId,
    });

    // Set up authentication if provided
    if (dto.authType === AuthType.OAUTH2 && dto.authConfig) {
      await this.oauth2Service.initializeOAuth2(integration.id, dto.authConfig);
    } else if (dto.authType === AuthType.API_KEY && dto.credentials) {
      await this.apiKeyService.storeCredentials(integration.id, dto.credentials);
    }

    // Set up webhooks if configured
    if (dto.webhooks && dto.webhooks.length > 0) {
      for (const webhookConfig of dto.webhooks) {
        await this.webhookService.create(integration.id, webhookConfig);
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
  async findAll(tenantId: string, filters?: IntegrationListDto): Promise<Integration[]> {
    return this.integrationRepository.findAll(tenantId, filters);
  }

  /**
   * Update integration configuration
   */
  async update(
    tenantId: string,
    integrationId: string,
    dto: UpdateIntegrationDto,
    userId: string,
  ): Promise<Integration> {
    this.logger.log(`Updating integration: ${integrationId}`);

    const integration = await this.findById(tenantId, integrationId);

    // Validate configuration if provided
    if (dto.config) {
      await this.connectorService.validateConfig(
        integration.type,
        integration.providerName,
        { ...integration.config, ...dto.config },
      );
    }

    // Update integration
    const updatedIntegration = await this.integrationRepository.update(integrationId, {
      ...dto,
      updatedBy: userId,
    });

    // Update authentication if changed
    if (dto.authConfig) {
      if (integration.authType === AuthType.OAUTH2) {
        await this.oauth2Service.updateOAuth2Config(integrationId, dto.authConfig);
      }
    }

    // Emit integration updated event
    this.eventEmitter.emit('integration.updated', {
      tenantId,
      integrationId,
      changes: dto,
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
   * Test integration connection
   */
  async testConnection(tenantId: string, integrationId: string): Promise<boolean> {
    this.logger.log(`Testing connection for integration: ${integrationId}`);

    const integration = await this.findById(tenantId, integrationId);
    const connector = await this.connectorService.getConnector(
      integration.type,
      integration.providerName,
    );

    if (!connector) {
      throw new BadRequestException(`Connector not available: ${integration.providerName}`);
    }

    try {
      // Get authentication credentials
      let credentials = {};
      if (integration.authType === AuthType.OAUTH2) {
        credentials = await this.oauth2Service.getValidToken(integrationId);
      } else if (integration.authType === AuthType.API_KEY) {
        credentials = await this.apiKeyService.getCredentials(integrationId);
      }

      // Test connection using connector
      const isConnected = await connector.testConnection({
        config: integration.config,
        credentials,
        authType: integration.authType,
      });

      // Update health status
      await this.healthService.updateHealthStatus(integrationId, {
        isHealthy: isConnected,
        lastChecked: new Date(),
        details: isConnected ? 'Connection successful' : 'Connection failed',
      });

      return isConnected;
    } catch (error) {
      this.logger.error(`Connection test failed for integration ${integrationId}:`, error);
      
      await this.healthService.updateHealthStatus(integrationId, {
        isHealthy: false,
        lastChecked: new Date(),
        details: error.message,
        error: error.stack,
      });

      return false;
    }
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
  async triggerSync(
    tenantId: string,
    integrationId: string,
    syncType: 'full' | 'incremental' = 'incremental',
  ): Promise<string> {
    this.logger.log(`Triggering ${syncType} sync for integration: ${integrationId}`);

    const integration = await this.findById(tenantId, integrationId);

    if (integration.status !== IntegrationStatus.ACTIVE) {
      throw new BadRequestException('Integration must be active to trigger sync');
    }

    const syncId = await this.syncService.triggerSync(integrationId, {
      type: syncType,
      triggeredBy: 'manual',
      tenantId,
    });

    this.logger.log(`Sync triggered successfully: ${syncId} for integration: ${integrationId}`);
    return syncId;
  }

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
}