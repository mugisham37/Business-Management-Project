import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  decimal,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';

// Enums
export const integrationStatusEnum = pgEnum('integration_status', [
  'active',
  'inactive',
  'error',
  'pending',
  'suspended',
]);

export const integrationTypeEnum = pgEnum('integration_type', [
  'accounting',
  'ecommerce',
  'payment',
  'crm',
  'inventory',
  'shipping',
  'marketing',
  'custom',
]);

export const authTypeEnum = pgEnum('auth_type', [
  'oauth2',
  'api_key',
  'basic_auth',
  'bearer_token',
  'custom',
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const webhookStatusEnum = pgEnum('webhook_status', [
  'active',
  'inactive',
  'failed',
  'suspended',
]);

// Integration configurations
export const integrations = pgTable('integrations', {
  ...baseSchema,
  name: varchar('name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  type: integrationTypeEnum('type').notNull(),
  status: integrationStatusEnum('status').notNull().default('pending'),
  
  // Configuration
  config: jsonb('config').default({}),
  credentials: jsonb('credentials').default({}), // Encrypted
  settings: jsonb('settings').default({}),
  
  // Authentication
  authType: authTypeEnum('auth_type').notNull(),
  authConfig: jsonb('auth_config').default({}),
  
  // Metadata
  providerName: varchar('provider_name', { length: 100 }),
  providerVersion: varchar('provider_version', { length: 50 }),
  connectorVersion: varchar('connector_version', { length: 50 }),
  
  // Health and monitoring
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: varchar('health_status', { length: 50 }),
  errorCount: integer('error_count').default(0),
  lastError: text('last_error'),
  lastErrorAt: timestamp('last_error_at'),
  
  // Usage tracking
  requestCount: integer('request_count').default(0),
  lastRequestAt: timestamp('last_request_at'),
  
  // Sync settings
  syncEnabled: boolean('sync_enabled').default(false),
  syncInterval: integer('sync_interval'), // in minutes
  lastSyncAt: timestamp('last_sync_at'),
  nextSyncAt: timestamp('next_sync_at'),
});

// API Keys for integration authentication
export const apiKeys = pgTable('api_keys', {
  ...baseSchema,
  integrationId: uuid('integration_id').references(() => integrations.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(), // Hashed API key
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(), // First few chars for identification
  
  // Permissions and scopes
  scopes: jsonb('scopes').default([]),
  permissions: jsonb('permissions').default([]),
  
  // Rate limiting
  rateLimit: integer('rate_limit').default(1000), // requests per hour
  rateLimitWindow: integer('rate_limit_window').default(3600), // in seconds
  
  // Usage tracking
  requestCount: integer('request_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  // Status and expiry
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'),
  
  // Metadata
  description: text('description'),
  ipWhitelist: jsonb('ip_whitelist').default([]),
  userAgent: varchar('user_agent', { length: 500 }),
});

// Webhook configurations
export const webhooks = pgTable('webhooks', {
  ...baseSchema,
  integrationId: uuid('integration_id').references(() => integrations.id),
  
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 1000 }).notNull(),
  method: varchar('method', { length: 10 }).default('POST'),
  
  // Events and triggers
  events: jsonb('events').default([]), // Array of event names
  filters: jsonb('filters').default({}), // Event filtering criteria
  
  // Authentication
  authType: authTypeEnum('auth_type').default('bearer_token'),
  authConfig: jsonb('auth_config').default({}),
  secretKey: varchar('secret_key', { length: 255 }), // For signature verification
  
  // Configuration
  headers: jsonb('headers').default({}),
  timeout: integer('timeout').default(30), // in seconds
  retryAttempts: integer('retry_attempts').default(3),
  retryDelay: integer('retry_delay').default(1000), // in milliseconds
  
  // Status and health
  status: webhookStatusEnum('status').default('active'),
  isActive: boolean('is_active').default(true),
  
  // Monitoring
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  lastDeliveryAt: timestamp('last_delivery_at'),
  lastSuccessAt: timestamp('last_success_at'),
  lastFailureAt: timestamp('last_failure_at'),
  lastError: text('last_error'),
});

// Webhook delivery logs
export const webhookDeliveries = pgTable('webhook_deliveries', {
  ...baseSchema,
  webhookId: uuid('webhook_id').references(() => webhooks.id),
  
  // Request details
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  headers: jsonb('headers').default({}),
  
  // Response details
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  responseHeaders: jsonb('response_headers').default({}),
  
  // Timing
  deliveredAt: timestamp('delivered_at'),
  duration: integer('duration'), // in milliseconds
  
  // Status
  success: boolean('success').default(false),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  nextRetryAt: timestamp('next_retry_at'),
});

// Data synchronization logs
export const syncLogs = pgTable('sync_logs', {
  ...baseSchema,
  integrationId: uuid('integration_id').references(() => integrations.id),
  
  // Sync details
  syncType: varchar('sync_type', { length: 100 }).notNull(), // 'full', 'incremental', 'manual'
  direction: varchar('direction', { length: 20 }).notNull(), // 'inbound', 'outbound', 'bidirectional'
  status: syncStatusEnum('status').notNull().default('pending'),
  
  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // in milliseconds
  
  // Results
  recordsProcessed: integer('records_processed').default(0),
  recordsSucceeded: integer('records_succeeded').default(0),
  recordsFailed: integer('records_failed').default(0),
  recordsSkipped: integer('records_skipped').default(0),
  
  // Details
  summary: jsonb('summary').default({}),
  errors: jsonb('errors').default([]),
  warnings: jsonb('warnings').default([]),
  
  // Metadata
  triggeredBy: varchar('triggered_by', { length: 100 }), // 'schedule', 'manual', 'webhook'
  triggerData: jsonb('trigger_data').default({}),
});

// OAuth2 tokens and configurations
export const oauth2Tokens = pgTable('oauth2_tokens', {
  ...baseSchema,
  integrationId: uuid('integration_id').references(() => integrations.id),
  
  // Token data (encrypted)
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenType: varchar('token_type', { length: 50 }).default('Bearer'),
  
  // Expiry and scopes
  expiresAt: timestamp('expires_at'),
  scopes: jsonb('scopes').default([]),
  
  // Provider details
  providerId: varchar('provider_id', { length: 255 }),
  providerData: jsonb('provider_data').default({}),
  
  // Status
  isActive: boolean('is_active').default(true),
  lastRefreshedAt: timestamp('last_refreshed_at'),
});

// Rate limiting tracking
export const rateLimits = pgTable('rate_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  
  // Identifier (API key, user ID, IP, etc.)
  identifier: varchar('identifier', { length: 255 }).notNull(),
  identifierType: varchar('identifier_type', { length: 50 }).notNull(), // 'api_key', 'user', 'ip'
  
  // Rate limit configuration
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  requestCount: integer('request_count').default(0),
  limit: integer('limit').notNull(),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Connector configurations and metadata
export const connectors = pgTable('connectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Connector identity
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  type: integrationTypeEnum('type').notNull(),
  
  // Versioning
  version: varchar('version', { length: 50 }).notNull(),
  minVersion: varchar('min_version', { length: 50 }),
  maxVersion: varchar('max_version', { length: 50 }),
  
  // Configuration schema
  configSchema: jsonb('config_schema').notNull(),
  authSchema: jsonb('auth_schema').notNull(),
  
  // Capabilities
  capabilities: jsonb('capabilities').default([]),
  supportedEvents: jsonb('supported_events').default([]),
  supportedOperations: jsonb('supported_operations').default([]),
  
  // Documentation
  documentationUrl: varchar('documentation_url', { length: 500 }),
  exampleConfig: jsonb('example_config').default({}),
  
  // Status
  isActive: boolean('is_active').default(true),
  isOfficial: boolean('is_official').default(false),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes for performance
export const integrationTenantIndex = index('idx_integrations_tenant_status')
  .on(integrations.tenantId, integrations.status);

export const apiKeyTenantIndex = index('idx_api_keys_tenant_active')
  .on(apiKeys.tenantId, apiKeys.isActive);

export const webhookIntegrationIndex = index('idx_webhooks_integration_status')
  .on(webhooks.integrationId, webhooks.status);

export const syncLogIntegrationIndex = index('idx_sync_logs_integration_status')
  .on(syncLogs.integrationId, syncLogs.status);

export const rateLimitIdentifierIndex = index('idx_rate_limits_identifier_window')
  .on(rateLimits.identifier, rateLimits.windowStart);