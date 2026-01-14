import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum IntegrationType {
  ACCOUNTING = 'accounting',
  ECOMMERCE = 'ecommerce',
  PAYMENT = 'payment',
  CRM = 'crm',
  INVENTORY = 'inventory',
  SHIPPING = 'shipping',
  MARKETING = 'marketing',
  CUSTOM = 'custom',
}

export enum IntegrationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  SUSPENDED = 'suspended',
}

export enum AuthType {
  OAUTH2 = 'oauth2',
  API_KEY = 'api_key',
  BASIC_AUTH = 'basic_auth',
  BEARER_TOKEN = 'bearer_token',
  CUSTOM = 'custom',
}

export class Integration {
  @ApiProperty({ description: 'Integration ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Integration name' })
  name!: string;

  @ApiProperty({ description: 'Display name' })
  displayName!: string;

  @ApiPropertyOptional({ description: 'Integration description' })
  description?: string;

  @ApiProperty({ enum: IntegrationType, description: 'Integration type' })
  type!: IntegrationType;

  @ApiProperty({ enum: IntegrationStatus, description: 'Integration status' })
  status!: IntegrationStatus;

  @ApiProperty({ description: 'Integration configuration' })
  config!: Record<string, any>;

  @ApiProperty({ description: 'Encrypted credentials' })
  credentials!: Record<string, any>;

  @ApiProperty({ description: 'Integration settings' })
  settings!: Record<string, any>;

  @ApiProperty({ enum: AuthType, description: 'Authentication type' })
  authType!: AuthType;

  @ApiProperty({ description: 'Authentication configuration' })
  authConfig!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Provider name' })
  providerName?: string;

  @ApiPropertyOptional({ description: 'Provider version' })
  providerVersion?: string;

  @ApiPropertyOptional({ description: 'Connector version' })
  connectorVersion?: string;

  @ApiPropertyOptional({ description: 'Last health check timestamp' })
  lastHealthCheck?: Date;

  @ApiPropertyOptional({ description: 'Health status' })
  healthStatus?: string;

  @ApiProperty({ description: 'Error count', default: 0 })
  errorCount!: number;

  @ApiPropertyOptional({ description: 'Last error message' })
  lastError?: string;

  @ApiPropertyOptional({ description: 'Last error timestamp' })
  lastErrorAt?: Date;

  @ApiProperty({ description: 'Request count', default: 0 })
  requestCount!: number;

  @ApiPropertyOptional({ description: 'Last request timestamp' })
  lastRequestAt?: Date;

  @ApiProperty({ description: 'Sync enabled', default: false })
  syncEnabled!: boolean;

  @ApiPropertyOptional({ description: 'Sync interval in minutes' })
  syncInterval?: number;

  @ApiPropertyOptional({ description: 'Last sync timestamp' })
  lastSyncAt?: Date;

  @ApiPropertyOptional({ description: 'Next sync timestamp' })
  nextSyncAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Deleted timestamp' })
  deletedAt?: Date;

  @ApiProperty({ description: 'Created by user ID' })
  createdBy!: string;

  @ApiProperty({ description: 'Updated by user ID' })
  updatedBy!: string;

  @ApiProperty({ description: 'Version for optimistic locking', default: 1 })
  version!: number;
}

export class IntegrationSummary {
  @ApiProperty({ description: 'Integration ID' })
  id!: string;

  @ApiProperty({ description: 'Integration name' })
  name!: string;

  @ApiProperty({ description: 'Display name' })
  displayName!: string;

  @ApiProperty({ enum: IntegrationType, description: 'Integration type' })
  type!: IntegrationType;

  @ApiProperty({ enum: IntegrationStatus, description: 'Integration status' })
  status!: IntegrationStatus;

  @ApiPropertyOptional({ description: 'Provider name' })
  providerName?: string;

  @ApiProperty({ description: 'Sync enabled' })
  syncEnabled!: boolean;

  @ApiPropertyOptional({ description: 'Last sync timestamp' })
  lastSyncAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Health status' })
  healthStatus?: string;
}

export class IntegrationHealth {
  @ApiProperty({ description: 'Integration ID' })
  integrationId!: string;

  @ApiProperty({ description: 'Is healthy' })
  isHealthy!: boolean;

  @ApiProperty({ description: 'Last checked timestamp' })
  lastChecked!: Date;

  @ApiPropertyOptional({ description: 'Health details' })
  details?: string;

  @ApiPropertyOptional({ description: 'Error message' })
  error?: string;

  @ApiPropertyOptional({ description: 'Response time in milliseconds' })
  responseTime?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;
}

export class IntegrationMetrics {
  @ApiProperty({ description: 'Integration ID' })
  integrationId!: string;

  @ApiProperty({ description: 'Total requests' })
  totalRequests!: number;

  @ApiProperty({ description: 'Successful requests' })
  successfulRequests!: number;

  @ApiProperty({ description: 'Failed requests' })
  failedRequests!: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  averageResponseTime!: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate!: number;

  @ApiProperty({ description: 'Uptime percentage' })
  uptime!: number;

  @ApiProperty({ description: 'Last 24 hours requests' })
  last24HoursRequests!: number;

  @ApiProperty({ description: 'Peak requests per hour' })
  peakRequestsPerHour!: number;

  @ApiProperty({ description: 'Metrics timestamp' })
  timestamp!: Date;
}

export class IntegrationEvent {
  @ApiProperty({ description: 'Event ID' })
  id!: string;

  @ApiProperty({ description: 'Integration ID' })
  integrationId!: string;

  @ApiProperty({ description: 'Event type' })
  eventType!: string;

  @ApiProperty({ description: 'Event data' })
  data!: Record<string, any>;

  @ApiProperty({ description: 'Event timestamp' })
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'Event source' })
  source?: string;

  @ApiPropertyOptional({ description: 'Event metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Processing status' })
  status!: 'pending' | 'processing' | 'completed' | 'failed';

  @ApiPropertyOptional({ description: 'Processing error' })
  error?: string;

  @ApiPropertyOptional({ description: 'Retry count' })
  retryCount?: number;
}

export class IntegrationLog {
  @ApiProperty({ description: 'Log ID' })
  id!: string;

  @ApiProperty({ description: 'Integration ID' })
  integrationId!: string;

  @ApiProperty({ description: 'Log level' })
  level!: 'debug' | 'info' | 'warn' | 'error';

  @ApiProperty({ description: 'Log message' })
  message!: string;

  @ApiProperty({ description: 'Log timestamp' })
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'Additional log data' })
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Error stack trace' })
  stack?: string;

  @ApiPropertyOptional({ description: 'Request ID for correlation' })
  requestId?: string;

  @ApiPropertyOptional({ description: 'User ID who triggered the action' })
  userId?: string;
}