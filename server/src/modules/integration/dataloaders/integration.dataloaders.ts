import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';

import { WebhookRepository } from '../repositories/webhook.repository';
import { ApiKeyRepository } from '../repositories/api-key.repository';
import { SyncLogRepository } from '../repositories/sync-log.repository';
import { IntegrationRepository } from '../repositories/integration.repository';
import { ConnectorRepository } from '../repositories/connector.repository';

import { WebhookType } from '../types/webhook.graphql.types';
import { APIKeyType } from '../types/developer-portal.graphql.types';
import { SyncLogType, SyncConflictType } from '../types/sync.graphql.types';
import { Integration } from '../types/integration.graphql.types';
import { ConnectorType } from '../types/connector.graphql.types';

@Injectable()
export class IntegrationDataLoaders {
  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly syncLogRepository: SyncLogRepository,
    private readonly integrationRepository: IntegrationRepository,
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  createWebhooksByIntegrationLoader(): DataLoader<string, WebhookType[]> {
    return new DataLoader<string, WebhookType[]>(
      async (integrationIds: readonly string[]) => {
        const webhooks = await this.webhookRepository.findByIntegrationIds([...integrationIds]);
        
        const webhooksByIntegration = new Map<string, WebhookType[]>();
        integrationIds.forEach(id => webhooksByIntegration.set(id, []));
        
        webhooks.forEach((webhook) => {
          const existing = webhooksByIntegration.get(webhook.integrationId) || [];
          existing.push(webhook as unknown as WebhookType);
          webhooksByIntegration.set(webhook.integrationId, existing);
        });
        
        return integrationIds.map(id => webhooksByIntegration.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  createApiKeysByIntegrationLoader(): DataLoader<string, APIKeyType[]> {
    return new DataLoader<string, APIKeyType[]>(
      async (integrationIds: readonly string[]) => {
        const apiKeys = await this.apiKeyRepository.findByIntegrationIds([...integrationIds]);
        
        const apiKeysByIntegration = new Map<string, APIKeyType[]>();
        integrationIds.forEach(id => apiKeysByIntegration.set(id, []));
        
        apiKeys.forEach((apiKey: any) => {
          if (apiKey.integrationId) {
            const existing = apiKeysByIntegration.get(apiKey.integrationId) || [];
            existing.push({
              id: apiKey.id,
              name: apiKey.name,
              description: apiKey.description,
              scopes: apiKey.scopes,
              rateLimit: apiKey.rateLimit,
              isActive: apiKey.isActive,
              expiresAt: apiKey.expiresAt,
              createdAt: apiKey.createdAt,
              lastUsedAt: apiKey.lastUsedAt,
              requestCount: apiKey.requestCount,
            });
            apiKeysByIntegration.set(apiKey.integrationId, existing);
          }
        });
        
        return integrationIds.map(id => apiKeysByIntegration.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  createSyncLogsByIntegrationLoader(): DataLoader<string, SyncLogType[]> {
    return new DataLoader<string, SyncLogType[]>(
      async (integrationIds: readonly string[]) => {
        const syncLogs = await this.syncLogRepository.findByIntegrationIds([...integrationIds]);
        
        const syncLogsByIntegration = new Map<string, SyncLogType[]>();
        integrationIds.forEach(id => syncLogsByIntegration.set(id, []));
        
        syncLogs.forEach((syncLog) => {
          const existing = syncLogsByIntegration.get(syncLog.integrationId) || [];
          existing.push(syncLog as unknown as SyncLogType);
          syncLogsByIntegration.set(syncLog.integrationId, existing);
        });
        
        return integrationIds.map(id => syncLogsByIntegration.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  createIntegrationsByIdLoader(): DataLoader<string, Integration> {
    return new DataLoader<string, Integration>(
      async (integrationIds: readonly string[]) => {
        const integrations = await this.integrationRepository.findByIds([...integrationIds]);
        
        const integrationsById = new Map<string, Integration>();
        integrations.forEach((integration) => {
          integrationsById.set(integration.id, integration as unknown as Integration);
        });
        
        return integrationIds.map(id => integrationsById.get(id)!);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  createConflictsBySyncIdLoader(): DataLoader<string, SyncConflictType[]> {
    return new DataLoader<string, SyncConflictType[]>(
      async (syncIds: readonly string[]) => {
        const conflicts = await this.syncLogRepository.findConflictsBySyncIds([...syncIds]);
        
        const conflictsBySyncId = new Map<string, SyncConflictType[]>();
        syncIds.forEach(id => conflictsBySyncId.set(id, []));
        
        conflicts.forEach((conflict: SyncConflictType) => {
          const existing = conflictsBySyncId.get(conflict.syncId) || [];
          existing.push(conflict);
          conflictsBySyncId.set(conflict.syncId, existing);
        });
        
        return syncIds.map(id => conflictsBySyncId.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  createIntegrationsByConnectorLoader(): DataLoader<string, Integration[]> {
    return new DataLoader<string, Integration[]>(
      async (connectorKeys: readonly string[]) => {
        // connectorKey format: "type_providerName"
        const integrations = await this.integrationRepository.findByConnectorKeys([...connectorKeys]);
        
        const integrationsByConnector = new Map<string, Integration[]>();
        connectorKeys.forEach(key => integrationsByConnector.set(key, []));
        
        integrations.forEach((integration) => {
          const connectorKey = `${integration.type}_${integration.providerName}`;
          const existing = integrationsByConnector.get(connectorKey) || [];
          existing.push(integration as unknown as Integration);
          integrationsByConnector.set(connectorKey, existing);
        });
        
        return connectorKeys.map(key => integrationsByConnector.get(key) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  createWebhooksByEventLoader(): DataLoader<string, WebhookType[]> {
    return new DataLoader<string, WebhookType[]>(
      async (eventTypes: readonly string[]) => {
        const webhooks = await this.webhookRepository.findByEventTypes([...eventTypes]);
        
        const webhooksByEvent = new Map<string, WebhookType[]>();
        eventTypes.forEach(event => webhooksByEvent.set(event, []));
        
        webhooks.forEach((webhook) => {
          webhook.events.forEach((event: string) => {
            const existing = webhooksByEvent.get(event) || [];
            existing.push(webhook as unknown as WebhookType);
            webhooksByEvent.set(event, existing);
          });
        });
        
        return eventTypes.map(event => webhooksByEvent.get(event) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
      },
    );
  }

  getLoaders() {
    return {
      webhooks_by_integration: this.createWebhooksByIntegrationLoader(),
      api_keys_by_integration: this.createApiKeysByIntegrationLoader(),
      sync_logs_by_integration: this.createSyncLogsByIntegrationLoader(),
      integrations_by_id: this.createIntegrationsByIdLoader(),
      conflicts_by_sync_id: this.createConflictsBySyncIdLoader(),
      integrations_by_connector: this.createIntegrationsByConnectorLoader(),
      webhooks_by_event: this.createWebhooksByEventLoader(),
    };
  }
}