import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import {
  BaseConnector,
  ConnectorMetadata,
  ConnectorConfig,
  TestConnectionResult,
  SyncResult,
  SyncOptions,
  ValidationResult,
  QueryOptions,
  QueryResult,
  DataEntity,
  ConnectorCapability,
} from '../interfaces/connector.interface';

import { IntegrationType, AuthType } from '../entities/integration.entity';

@Injectable()
export class QuickBooksConnector extends BaseConnector {
  private readonly logger = new Logger(QuickBooksConnector.name);
  private readonly baseUrl = 'https://sandbox-quickbooks.api.intuit.com';
  private readonly apiVersion = 'v3';

  constructor(private readonly httpService: HttpService) {
    super();
  }

  override async initialize(config: ConnectorConfig): Promise<void> {
    await super.initialize(config);
    this.logger.log('QuickBooks connector initialized');
  }

  getMetadata(): ConnectorMetadata {
    return {
      name: 'quickbooks',
      displayName: 'QuickBooks Online',
      description: 'Connect to QuickBooks Online for accounting data synchronization',
      type: IntegrationType.ACCOUNTING,
      version: '1.0.0',
      
      configSchema: {
        type: 'object',
        properties: {
          companyId: {
            type: 'string',
            title: 'Company ID',
            description: 'QuickBooks Company ID (Realm ID)',
          },
          environment: {
            type: 'string',
            enum: ['sandbox', 'production'],
            default: 'sandbox',
            title: 'Environment',
            description: 'QuickBooks environment to connect to',
          },
          syncSettings: {
            type: 'object',
            properties: {
              syncCustomers: { type: 'boolean', default: true },
              syncItems: { type: 'boolean', default: true },
              syncInvoices: { type: 'boolean', default: true },
              syncPayments: { type: 'boolean', default: true },
              syncExpenses: { type: 'boolean', default: false },
            },
          },
        },
        required: ['companyId'],
      },

      authSchema: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            title: 'Access Token',
            description: 'OAuth2 access token',
          },
          refreshToken: {
            type: 'string',
            title: 'Refresh Token',
            description: 'OAuth2 refresh token',
          },
          tokenType: {
            type: 'string',
            default: 'Bearer',
          },
        },
        required: ['accessToken'],
      },

      capabilities: [
        ConnectorCapability.READ,
        ConnectorCapability.WRITE,
        ConnectorCapability.SYNC,
        ConnectorCapability.WEBHOOK,
        ConnectorCapability.BATCH,
      ],

      supportedEvents: [
        'customer.created',
        'customer.updated',
        'item.created',
        'item.updated',
        'invoice.created',
        'invoice.updated',
        'payment.created',
      ],

      supportedOperations: [
        'customers.list',
        'customers.create',
        'customers.update',
        'items.list',
        'items.create',
        'items.update',
        'invoices.list',
        'invoices.create',
        'invoices.update',
        'payments.list',
        'payments.create',
      ],

      documentationUrl: 'https://developer.intuit.com/app/developer/qbo/docs/api/accounting',
      
      exampleConfig: {
        companyId: '123456789012345',
        environment: 'sandbox',
        syncSettings: {
          syncCustomers: true,
          syncItems: true,
          syncInvoices: true,
          syncPayments: true,
          syncExpenses: false,
        },
      },

      isOfficial: true,
    };
  }

  async validateConfig(config: Record<string, any>): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!config.companyId) {
      errors.push('Company ID is required');
    }

    if (config.environment && !['sandbox', 'production'].includes(config.environment)) {
      errors.push('Environment must be either "sandbox" or "production"');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async testConnection(config: ConnectorConfig): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      this.ensureInitialized();

      // Test connection by fetching company info
      const response = await this.makeApiRequest(
        'GET',
        `/v3/company/${config.config.companyId}/companyinfo/${config.config.companyId}`,
        config,
      );

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        details: {
          companyName: response.QueryResponse?.CompanyInfo?.[0]?.CompanyName,
          country: response.QueryResponse?.CompanyInfo?.[0]?.Country,
        },
        responseTime,
        version: this.apiVersion,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorResponse = (error as any)?.response?.data;
      
      return {
        success: false,
        error: errorMessage,
        details: { error: errorResponse },
        responseTime: Date.now() - startTime,
      };
    }
  }

  async sync(config: ConnectorConfig, options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsSucceeded = 0;
    let recordsFailed = 0;
    const errors: Array<{ record?: any; error: string; code?: string }> = [];
    const warnings: string[] = [];

    try {
      this.ensureInitialized();

      const syncSettings = config.config.syncSettings || {};
      const entities = options.entities || this.getDefaultSyncEntities(syncSettings);

      for (const entity of entities) {
        try {
          const entityResult = await this.syncEntity(config, entity, options);
          recordsProcessed += entityResult.recordsProcessed;
          recordsSucceeded += entityResult.recordsSucceeded;
          recordsFailed += entityResult.recordsFailed;
          errors.push(...entityResult.errors);
          warnings.push(...entityResult.warnings);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          this.logger.error(`Failed to sync entity ${entity}:`, error);
          errors.push({
            error: `Failed to sync ${entity}: ${errorMessage}`,
            code: 'ENTITY_SYNC_FAILED',
          });
        }
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsSucceeded,
        recordsFailed,
        recordsSkipped: 0,
        errors,
        warnings,
        summary: {
          entitiesSynced: entities,
          syncDirection: options.direction,
          fullSync: options.fullSync,
        },
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        recordsProcessed,
        recordsSucceeded,
        recordsFailed: recordsProcessed - recordsSucceeded,
        recordsSkipped: 0,
        errors: [{ error: errorMessage, code: 'SYNC_FAILED' }],
        warnings,
        summary: {},
        duration: Date.now() - startTime,
      };
    }
  }

  async read(
    config: ConnectorConfig,
    entity: string,
    options?: QueryOptions,
  ): Promise<QueryResult> {
    this.ensureInitialized();

    try {
      const queryParams = this.buildQueryParams(options);
      const response = await this.makeApiRequest(
        'GET',
        `/v3/company/${config.config.companyId}/${entity}${queryParams}`,
        config,
      );

      const data = this.transformInboundData(response.QueryResponse?.[entity] || [], entity);

      return {
        data,
        total: data.length,
        hasMore: false, // QuickBooks doesn't provide pagination info in this format
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw this.createError(`Failed to read ${entity}: ${errorMessage}`);
    }
  }

  async write(
    config: ConnectorConfig,
    entity: string,
    data: DataEntity[],
  ): Promise<SyncResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    let recordsSucceeded = 0;
    let recordsFailed = 0;
    const errors: Array<{ record?: any; error: string; code?: string }> = [];

    for (const record of data) {
      try {
        const transformedData = this.transformOutboundData(record.data, entity);
        
        await this.makeApiRequest(
          'POST',
          `/v3/company/${config.config.companyId}/${entity}`,
          config,
          transformedData,
        );

        recordsSucceeded++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';
        
        recordsFailed++;
        errors.push({
          record: record.data,
          error: errorMessage,
          code: errorCode,
        });
      }
    }

    return {
      success: recordsFailed === 0,
      recordsProcessed: data.length,
      recordsSucceeded,
      recordsFailed,
      recordsSkipped: 0,
      errors,
      warnings: [],
      summary: { entity },
      duration: Date.now() - startTime,
    };
  }

  getSupportedEntities(): string[] {
    return [
      'customers',
      'items',
      'invoices',
      'payments',
      'expenses',
      'vendors',
      'accounts',
      'taxcodes',
    ];
  }

  getEntitySchema(entity: string): any {
    const schemas: Record<string, any> = {
      customers: {
        type: 'object',
        properties: {
          Name: { type: 'string', required: true },
          CompanyName: { type: 'string' },
          BillAddr: {
            type: 'object',
            properties: {
              Line1: { type: 'string' },
              City: { type: 'string' },
              CountrySubDivisionCode: { type: 'string' },
              PostalCode: { type: 'string' },
            },
          },
          PrimaryEmailAddr: {
            type: 'object',
            properties: {
              Address: { type: 'string' },
            },
          },
        },
      },
      items: {
        type: 'object',
        properties: {
          Name: { type: 'string', required: true },
          Type: { type: 'string', enum: ['Inventory', 'NonInventory', 'Service'] },
          UnitPrice: { type: 'number' },
          QtyOnHand: { type: 'number' },
        },
      },
    };

    return schemas[entity] || {};
  }

  private async syncEntity(
    config: ConnectorConfig,
    entity: string,
    options: SyncOptions,
  ): Promise<SyncResult> {
    this.logger.log(`Syncing entity: ${entity}`);

    if (options.direction === 'inbound' || options.direction === 'bidirectional') {
      // Sync from QuickBooks to our system
      const result = await this.read(config, entity);
      
      // Here you would typically save the data to your local database
      // For now, we'll just return success
      
      return {
        success: true,
        recordsProcessed: result.data.length,
        recordsSucceeded: result.data.length,
        recordsFailed: 0,
        recordsSkipped: 0,
        errors: [],
        warnings: [],
        summary: { entity, direction: 'inbound' },
        duration: 0,
      };
    }

    // For outbound sync, you would read from your local database and write to QuickBooks
    return {
      success: true,
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      summary: { entity, direction: 'outbound' },
      duration: 0,
    };
  }

  private getDefaultSyncEntities(syncSettings: Record<string, boolean>): string[] {
    const entities: string[] = [];
    
    if (syncSettings.syncCustomers) entities.push('customers');
    if (syncSettings.syncItems) entities.push('items');
    if (syncSettings.syncInvoices) entities.push('invoices');
    if (syncSettings.syncPayments) entities.push('payments');
    if (syncSettings.syncExpenses) entities.push('expenses');

    return entities;
  }

  private buildQueryParams(options?: QueryOptions): string {
    if (!options) return '';

    const params = new URLSearchParams();

    if (options.limit) {
      params.append('maxresults', options.limit.toString());
    }

    if (options.offset) {
      params.append('startposition', (options.offset + 1).toString());
    }

    return params.toString() ? `?${params.toString()}` : '';
  }

  private async makeApiRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    config: ConnectorConfig,
    data?: any,
  ): Promise<any> {
    const url = `${this.getBaseUrl(config)}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${config.credentials.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url,
          headers,
          data,
        })
      );

      return response.data;
    } catch (error) {
      await this.handleApiError(error);
    }
  }

  private getBaseUrl(config: ConnectorConfig): string {
    const environment = config.config.environment || 'sandbox';
    return environment === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  private transformInboundData(data: any[], entity: string): any[] {
    // Transform QuickBooks data to our internal format
    return data.map(item => ({
      id: item.Id,
      externalId: item.Id,
      type: entity,
      data: item,
      lastModified: new Date(item.MetaData?.LastUpdatedTime || Date.now()),
    }));
  }

  private transformOutboundData(data: any, entity: string): any {
    // Transform our internal data to QuickBooks format
    // This would contain the specific mapping logic for each entity type
    return data;
  }
}