import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { ConnectorRepository } from '../repositories/connector.repository';
import { CacheService } from '../../cache/cache.service';

import {
  IConnector,
  ConnectorCapability,
  ConnectorConfig,
  ConnectorMetadata,
  TestConnectionResult,
  SyncResult,
} from '../interfaces/connector.interface';

import {
  CreateConnectorDto,
  UpdateConnectorDto,
  ConnectorListDto,
} from '../dto/connector.dto';

import { Connector, IntegrationType } from '../entities/connector.entity';

@Injectable()
export class ConnectorService {
  private readonly logger = new Logger(ConnectorService.name);
  private readonly connectors = new Map<string, IConnector>();

  constructor(
    private readonly connectorRepository: ConnectorRepository,
    private readonly cacheService: CacheService,
    private readonly moduleRef: ModuleRef,
  ) {
    this.initializeConnectors();
  }

  /**
   * Initialize built-in connectors
   */
  private async initializeConnectors(): Promise<void> {
    try {
      // Load connector instances from the module
      const connectorNames = [
        'QuickBooksConnector',
        'XeroConnector',
        'ShopifyConnector',
        'StripeConnector',
      ];

      for (const connectorName of connectorNames) {
        try {
          const connector = await this.moduleRef.get(connectorName, { strict: false });
          if (connector) {
            const metadata = connector.getMetadata();
            this.connectors.set(this.getConnectorKey(metadata.type, metadata.name), connector);
            this.logger.log(`Loaded connector: ${metadata.name} (${metadata.type})`);
          }
        } catch (error) {
          this.logger.warn(`Failed to load connector ${connectorName}:`, (error as Error).message);
        }
      }

      this.logger.log(`Initialized ${this.connectors.size} connectors`);
    } catch (error) {
      this.logger.error('Failed to initialize connectors:', error);
    }
  }

  /**
   * Register a new connector
   */
  async registerConnector(connector: IConnector): Promise<void> {
    const metadata = connector.getMetadata();
    const key = this.getConnectorKey(metadata.type, metadata.name);

    this.logger.log(`Registering connector: ${metadata.name} (${metadata.type})`);

    // Validate connector
    await this.validateConnector(connector);

    // Store connector instance
    this.connectors.set(key, connector);

    // Store connector metadata in database
    await this.connectorRepository.upsert({
      name: metadata.name,
      displayName: metadata.displayName,
      description: metadata.description,
      type: metadata.type,
      version: metadata.version,
      configSchema: metadata.configSchema,
      authSchema: metadata.authSchema,
      capabilities: metadata.capabilities,
      supportedEvents: metadata.supportedEvents,
      supportedOperations: metadata.supportedOperations,
      ...(metadata.documentationUrl ? { documentationUrl: metadata.documentationUrl } : {}),
      exampleConfig: metadata.exampleConfig,
      isActive: true,
      isOfficial: metadata.isOfficial || false,
    });

    this.logger.log(`Connector registered successfully: ${metadata.name}`);
  }

  /**
   * Get connector instance
   */
  async getConnector(type: IntegrationType, name: string): Promise<IConnector | null> {
    const key = this.getConnectorKey(type, name);
    return this.connectors.get(key) || null;
  }

  /**
   * List available connectors
   */
  async listConnectors(filters?: ConnectorListDto): Promise<Connector[]> {
    const cacheKey = `connectors:list:${JSON.stringify(filters || {})}`;
    
    let connectors = await this.cacheService.get<Connector[]>(cacheKey);
    
    if (!connectors) {
      connectors = await this.connectorRepository.findAll(filters);
      await this.cacheService.set(cacheKey, connectors, { ttl: 300 }); // Cache for 5 minutes
    }

    return connectors;
  }

  /**
   * Get connector metadata
   */
  async getConnectorMetadata(type: IntegrationType, name: string): Promise<ConnectorMetadata | null> {
    const connector = await this.getConnector(type, name);
    return connector ? connector.getMetadata() : null;
  }

  /**
   * Validate connector configuration
   */
  async validateConfig(
    type: IntegrationType,
    name: string,
    config: Record<string, any>,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const connector = await this.getConnector(type, name);
    
    if (!connector) {
      return {
        isValid: false,
        errors: [`Connector not found: ${name}`],
      };
    }

    try {
      const result = await connector.validateConfig(config);
      return result;
    } catch (error) {
      return {
        isValid: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Test connector connection
   */
  async testConnection(
    type: IntegrationType,
    name: string,
    config: ConnectorConfig,
  ): Promise<TestConnectionResult> {
    this.logger.log(`Testing connection for connector: ${name}`);

    const connector = await this.getConnector(type, name);
    
    if (!connector) {
      return {
        success: false,
        error: `Connector not found: ${name}`,
        details: {},
      };
    }

    try {
      const result = await connector.testConnection(config);
      
      this.logger.log(`Connection test ${result.success ? 'passed' : 'failed'} for connector: ${name}`);
      return result;
    } catch (error) {
      this.logger.error(`Connection test failed for connector ${name}:`, error);
      
      return {
        success: false,
        error: (error as Error).message,
        details: { stack: (error as Error).stack },
      };
    }
  }

  /**
   * Execute data synchronization
   */
  async executeSync(
    type: IntegrationType,
    name: string,
    config: ConnectorConfig,
    syncOptions: {
      direction: 'inbound' | 'outbound' | 'bidirectional';
      entities?: string[];
      fullSync?: boolean;
      lastSyncTime?: Date;
    },
  ): Promise<SyncResult> {
    this.logger.log(`Executing sync for connector: ${name}, direction: ${syncOptions.direction}`);

    const connector = await this.getConnector(type, name);
    
    if (!connector) {
      throw new BadRequestException(`Connector not found: ${name}`);
    }

    // Check if connector supports sync
    const metadata = connector.getMetadata();
    if (!metadata.capabilities.includes(ConnectorCapability.SYNC)) {
      throw new BadRequestException(`Connector ${name} does not support synchronization`);
    }

    try {
      const result = await connector.sync(config, syncOptions);
      
      this.logger.log(
        `Sync completed for connector: ${name}, ` +
        `processed: ${result.recordsProcessed}, ` +
        `succeeded: ${result.recordsSucceeded}, ` +
        `failed: ${result.recordsFailed}`
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Sync failed for connector ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get connector capabilities
   */
  async getCapabilities(type: IntegrationType, name: string): Promise<ConnectorCapability[]> {
    const connector = await this.getConnector(type, name);
    
    if (!connector) {
      return [];
    }

    const metadata = connector.getMetadata();
    return metadata.capabilities;
  }

  /**
   * Check if connector supports a specific operation
   */
  async supportsOperation(
    type: IntegrationType,
    name: string,
    operation: string,
  ): Promise<boolean> {
    const connector = await this.getConnector(type, name);
    
    if (!connector) {
      return false;
    }

    const metadata = connector.getMetadata();
    return metadata.supportedOperations.includes(operation);
  }

  /**
   * Get connector configuration schema
   */
  async getConfigSchema(type: IntegrationType, name: string): Promise<any> {
    const connector = await this.getConnector(type, name);
    
    if (!connector) {
      return null;
    }

    const metadata = connector.getMetadata();
    return metadata.configSchema;
  }

  /**
   * Get connector authentication schema
   */
  async getAuthSchema(type: IntegrationType, name: string): Promise<any> {
    const connector = await this.getConnector(type, name);
    
    if (!connector) {
      return null;
    }

    const metadata = connector.getMetadata();
    return metadata.authSchema;
  }

  /**
   * Update connector metadata
   */
  async updateConnector(
    type: IntegrationType,
    name: string,
    dto: UpdateConnectorDto,
  ): Promise<Connector> {
    const connector = await this.connectorRepository.findByName(name);
    
    if (!connector) {
      throw new BadRequestException(`Connector not found: ${name}`);
    }

    const updatedConnector = await this.connectorRepository.update(connector.id, dto);

    // Clear cache
    await this.cacheService.del(`connectors:list:*`);

    this.logger.log(`Connector updated: ${name}`);
    return updatedConnector;
  }

  /**
   * Disable connector
   */
  async disableConnector(type: IntegrationType, name: string): Promise<void> {
    const key = this.getConnectorKey(type, name);
    
    // Remove from memory
    this.connectors.delete(key);

    // Update database
    const connector = await this.connectorRepository.findByName(name);
    if (connector) {
      await this.connectorRepository.update(connector.id, { isActive: false });
    }

    // Clear cache
    await this.cacheService.del(`connectors:list:*`);

    this.logger.log(`Connector disabled: ${name}`);
  }

  /**
   * Get connector statistics
   */
  async getConnectorStats(): Promise<{
    totalConnectors: number;
    activeConnectors: number;
    connectorsByType: Record<string, number>;
    officialConnectors: number;
  }> {
    const connectors = await this.connectorRepository.findAll();
    
    const stats = {
      totalConnectors: connectors.length,
      activeConnectors: connectors.filter(c => c.isActive).length,
      connectorsByType: {} as Record<string, number>,
      officialConnectors: connectors.filter(c => c.isOfficial).length,
    };

    // Count by type
    for (const connector of connectors) {
      stats.connectorsByType[connector.type] = (stats.connectorsByType[connector.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Validate connector implementation
   */
  private async validateConnector(connector: IConnector): Promise<void> {
    const metadata = connector.getMetadata();

    // Validate required metadata
    if (!metadata.name || !metadata.type || !metadata.version) {
      throw new BadRequestException('Connector metadata is incomplete');
    }

    // Validate configuration schema
    if (!metadata.configSchema || typeof metadata.configSchema !== 'object') {
      throw new BadRequestException('Connector must provide a valid configuration schema');
    }

    // Validate authentication schema
    if (!metadata.authSchema || typeof metadata.authSchema !== 'object') {
      throw new BadRequestException('Connector must provide a valid authentication schema');
    }

    // Test basic functionality
    try {
      await connector.validateConfig({});
    } catch (error) {
      // This is expected for empty config, just checking the method exists
    }

    this.logger.log(`Connector validation passed: ${metadata.name}`);
  }

  /**
   * Generate connector key for internal mapping
   */
  private getConnectorKey(type: IntegrationType, name: string): string {
    return `${type}:${name.toLowerCase()}`;
  }
}