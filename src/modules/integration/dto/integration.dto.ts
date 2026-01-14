import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsBoolean,
  IsNumber,
  IsDate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

import { IntegrationType, IntegrationStatus, AuthType } from '../entities/integration.entity';

export class CreateIntegrationDto {
  @ApiProperty({ description: 'Integration name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Display name for the integration' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Integration description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: IntegrationType, description: 'Integration type' })
  @IsEnum(IntegrationType)
  type!: IntegrationType;

  @ApiProperty({ description: 'Provider name (e.g., quickbooks, xero)' })
  @IsString()
  providerName!: string;

  @ApiProperty({ enum: AuthType, description: 'Authentication type' })
  @IsEnum(AuthType)
  authType!: AuthType;

  @ApiPropertyOptional({ description: 'Authentication configuration' })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Integration configuration' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Integration settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Authentication credentials' })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Enable automatic synchronization' })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Sync interval in minutes' })
  @IsOptional()
  @IsNumber()
  syncInterval?: number;

  @ApiPropertyOptional({ description: 'Webhook configurations' })
  @IsOptional()
  @IsArray()
  webhooks?: Array<{
    name: string;
    url: string;
    events: string[];
    filters?: Record<string, any>;
  }>;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ description: 'Integration name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Display name for the integration' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Integration description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Authentication configuration' })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Integration configuration' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Integration settings' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Enable automatic synchronization' })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Sync interval in minutes' })
  @IsOptional()
  @IsNumber()
  syncInterval?: number;
}

export class IntegrationStatusDto {
  @ApiProperty({ enum: IntegrationStatus, description: 'New integration status' })
  @IsEnum(IntegrationStatus)
  status!: IntegrationStatus;
}

export class IntegrationListDto {
  @ApiPropertyOptional({ enum: IntegrationType, description: 'Filter by integration type' })
  @IsOptional()
  @IsEnum(IntegrationType)
  type?: IntegrationType;

  @ApiPropertyOptional({ enum: IntegrationStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @ApiPropertyOptional({ description: 'Filter by provider name' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({ description: 'Filter by sync enabled status' })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Number of results to return' })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip' })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  offset?: number;
}

export class TriggerSyncDto {
  @ApiPropertyOptional({ 
    enum: ['full', 'incremental'], 
    default: 'incremental',
    description: 'Type of synchronization to perform' 
  })
  @IsOptional()
  @IsEnum(['full', 'incremental'])
  syncType?: 'full' | 'incremental' = 'incremental';

  @ApiPropertyOptional({ description: 'Specific entities to sync' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entities?: string[];

  @ApiPropertyOptional({ description: 'Additional sync options' })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

export class IntegrationConfigDto {
  @ApiProperty({ description: 'Configuration key' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Configuration value' })
  value!: any;

  @ApiPropertyOptional({ description: 'Configuration description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the configuration is sensitive' })
  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;
}

export class IntegrationHealthDto {
  @ApiProperty({ description: 'Integration ID' })
  @IsString()
  integrationId!: string;

  @ApiProperty({ description: 'Health status' })
  @IsBoolean()
  isHealthy!: boolean;

  @ApiProperty({ description: 'Last health check timestamp' })
  @IsDate()
  lastChecked!: Date;

  @ApiPropertyOptional({ description: 'Health check details' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: 'Error message if unhealthy' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Response time in milliseconds' })
  @IsOptional()
  @IsNumber()
  responseTime?: number;
}

export class IntegrationStatsDto {
  @ApiProperty({ description: 'Total number of requests' })
  @IsNumber()
  totalRequests!: number;

  @ApiProperty({ description: 'Number of successful requests' })
  @IsNumber()
  successfulRequests!: number;

  @ApiProperty({ description: 'Number of failed requests' })
  @IsNumber()
  failedRequests!: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  @IsNumber()
  averageResponseTime!: number;

  @ApiProperty({ description: 'Last request timestamp' })
  @IsDate()
  lastRequestAt!: Date;

  @ApiPropertyOptional({ description: 'Success rate percentage' })
  @IsOptional()
  @IsNumber()
  successRate?: number;

  @ApiPropertyOptional({ description: 'Uptime percentage' })
  @IsOptional()
  @IsNumber()
  uptime?: number;
}

export class BatchOperationDto {
  @ApiProperty({ description: 'Operation type' })
  @IsEnum(['create', 'update', 'delete', 'sync'])
  operation!: 'create' | 'update' | 'delete' | 'sync';

  @ApiProperty({ description: 'Entity type' })
  @IsString()
  entity!: string;

  @ApiProperty({ description: 'Data for the operation' })
  @IsArray()
  data!: any[];

  @ApiPropertyOptional({ description: 'Batch operation options' })
  @IsOptional()
  @IsObject()
  options?: {
    batchSize?: number;
    continueOnError?: boolean;
    validateOnly?: boolean;
  };
}

export class IntegrationEventDto {
  @ApiProperty({ description: 'Event type' })
  @IsString()
  eventType!: string;

  @ApiProperty({ description: 'Event data' })
  @IsObject()
  data!: Record<string, any>;

  @ApiProperty({ description: 'Event timestamp' })
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'Event source' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Event metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class IntegrationLogDto {
  @ApiProperty({ description: 'Log level' })
  @IsEnum(['debug', 'info', 'warn', 'error'])
  level!: 'debug' | 'info' | 'warn' | 'error';

  @ApiProperty({ description: 'Log message' })
  @IsString()
  message!: string;

  @ApiProperty({ description: 'Log timestamp' })
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'Additional log data' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Error stack trace' })
  @IsOptional()
  @IsString()
  stack?: string;
}

export class IntegrationMetricsDto {
  @ApiProperty({ description: 'Metric name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Metric value' })
  @IsNumber()
  value!: number;

  @ApiProperty({ description: 'Metric unit' })
  @IsString()
  unit!: string;

  @ApiProperty({ description: 'Metric timestamp' })
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'Metric tags' })
  @IsOptional()
  @IsObject()
  tags?: Record<string, string>;
}
