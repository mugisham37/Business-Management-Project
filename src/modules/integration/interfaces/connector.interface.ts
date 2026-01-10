import { IntegrationType, AuthType } from '../entities/integration.entity';

export enum ConnectorCapability {
  READ = 'read',
  WRITE = 'write',
  SYNC = 'sync',
  WEBHOOK = 'webhook',
  REAL_TIME = 'real_time',
  BATCH = 'batch',
  SEARCH = 'search',
  EXPORT = 'export',
  IMPORT = 'import',
}

export interface ConnectorMetadata {
  name: string;
  displayName: string;
  description: string;
  type: IntegrationType;
  version: string;
  minVersion?: string;
  maxVersion?: string;
  
  // Configuration schemas (JSON Schema format)
  configSchema: any;
  authSchema: any;
  
  // Capabilities and features
  capabilities: ConnectorCapability[];
  supportedEvents: string[];
  supportedOperations: string[];
  
  // Documentation
  documentationUrl?: string;
  exampleConfig: Record<string, any>;
  
  // Metadata
  isOfficial?: boolean;
  author?: string;
  license?: string;
  tags?: string[];
}

export interface ConnectorConfig {
  config: Record<string, any>;
  credentials: Record<string, any>;
  authType: AuthType;
  settings?: Record<string, any>;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  details: Record<string, any>;
  responseTime?: number;
  version?: string;
}

export interface SyncOptions {
  direction: 'inbound' | 'outbound' | 'bidirectional';
  entities?: string[];
  fullSync?: boolean;
  lastSyncTime?: Date;
  batchSize?: number;
  filters?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  recordsSkipped: number;
  errors: Array<{
    record?: any;
    error: string;
    code?: string;
  }>;
  warnings: string[];
  summary: Record<string, any>;
  nextSyncToken?: string;
  duration: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface WebhookEvent {
  event: string;
  data: any;
  timestamp: Date;
  source: string;
}

export interface DataEntity {
  id: string;
  type: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  lastModified?: Date;
}

export interface QueryOptions {
  filters?: Record<string, any>;
  sort?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
  fields?: string[];
}

export interface QueryResult<T = any> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextToken?: string;
}

/**
 * Base interface that all connectors must implement
 */
export interface IConnector {
  /**
   * Get connector metadata and capabilities
   */
  getMetadata(): ConnectorMetadata;

  /**
   * Validate connector configuration
   */
  validateConfig(config: Record<string, any>): Promise<ValidationResult>;

  /**
   * Test connection to the external service
   */
  testConnection(config: ConnectorConfig): Promise<TestConnectionResult>;

  /**
   * Initialize the connector with configuration
   */
  initialize(config: ConnectorConfig): Promise<void>;

  /**
   * Synchronize data between systems
   */
  sync(config: ConnectorConfig, options: SyncOptions): Promise<SyncResult>;

  /**
   * Read data from the external service
   */
  read?(
    config: ConnectorConfig,
    entity: string,
    options?: QueryOptions,
  ): Promise<QueryResult>;

  /**
   * Write data to the external service
   */
  write?(
    config: ConnectorConfig,
    entity: string,
    data: DataEntity[],
  ): Promise<SyncResult>;

  /**
   * Handle incoming webhook events
   */
  handleWebhook?(
    config: ConnectorConfig,
    event: WebhookEvent,
  ): Promise<void>;

  /**
   * Get supported entities/objects
   */
  getSupportedEntities?(): string[];

  /**
   * Get entity schema
   */
  getEntitySchema?(entity: string): any;

  /**
   * Transform data between internal and external formats
   */
  transformData?(
    data: any,
    direction: 'inbound' | 'outbound',
    entity: string,
  ): any;

  /**
   * Handle authentication refresh
   */
  refreshAuth?(config: ConnectorConfig): Promise<Record<string, any>>;

  /**
   * Clean up resources
   */
  cleanup?(): Promise<void>;
}

/**
 * Abstract base class for connectors
 */
export abstract class BaseConnector implements IConnector {
  protected config?: ConnectorConfig;
  protected initialized = false;

  abstract getMetadata(): ConnectorMetadata;
  abstract validateConfig(config: Record<string, any>): Promise<ValidationResult>;
  abstract testConnection(config: ConnectorConfig): Promise<TestConnectionResult>;
  abstract sync(config: ConnectorConfig, options: SyncOptions): Promise<SyncResult>;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  protected ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('Connector not initialized');
    }
  }

  protected createError(message: string, code?: string): Error {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  }

  protected async handleApiError(error: any): Promise<never> {
    let message = 'Unknown API error';
    let code = 'UNKNOWN_ERROR';

    if (error.response) {
      // HTTP error response
      message = error.response.data?.message || error.response.statusText || message;
      code = error.response.status?.toString() || code;
    } else if (error.message) {
      message = error.message;
    }

    throw this.createError(message, code);
  }

  async cleanup(): Promise<void> {
    this.config = undefined;
    this.initialized = false;
  }
}