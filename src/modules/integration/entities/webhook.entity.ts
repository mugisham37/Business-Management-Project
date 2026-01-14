import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthType } from './integration.entity';

export enum WebhookStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
  SUSPENDED = 'suspended',
}

export class Webhook {
  @ApiProperty({ description: 'Webhook ID' })
  id!: string;

  @ApiProperty({ description: 'Integration ID' })
  integrationId!: string;

  @ApiProperty({ description: 'Webhook name' })
  name!: string;

  @ApiProperty({ description: 'Webhook URL' })
  url!: string;

  @ApiProperty({ description: 'HTTP method', default: 'POST' })
  method!: string;

  @ApiProperty({ description: 'Events to listen for' })
  events!: string[];

  @ApiPropertyOptional({ description: 'Event filters' })
  filters?: Record<string, any>;

  @ApiProperty({ enum: AuthType, description: 'Authentication type' })
  authType!: AuthType;

  @ApiProperty({ description: 'Authentication configuration' })
  authConfig!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Secret key for signature verification' })
  secretKey?: string;

  @ApiProperty({ description: 'Custom headers' })
  headers!: Record<string, any>;

  @ApiProperty({ description: 'Timeout in seconds', default: 30 })
  timeout!: number;

  @ApiProperty({ description: 'Retry attempts', default: 3 })
  retryAttempts!: number;

  @ApiProperty({ description: 'Retry delay in milliseconds', default: 1000 })
  retryDelay!: number;

  @ApiProperty({ enum: WebhookStatus, description: 'Webhook status' })
  status!: WebhookStatus;

  @ApiProperty({ description: 'Is active', default: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Success count', default: 0 })
  successCount!: number;

  @ApiProperty({ description: 'Failure count', default: 0 })
  failureCount!: number;

  @ApiPropertyOptional({ description: 'Last delivery timestamp' })
  lastDeliveryAt?: Date;

  @ApiPropertyOptional({ description: 'Last success timestamp' })
  lastSuccessAt?: Date;

  @ApiPropertyOptional({ description: 'Last failure timestamp' })
  lastFailureAt?: Date;

  @ApiPropertyOptional({ description: 'Last error message' })
  lastError?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Deleted timestamp' })
  deletedAt?: Date;
}

export class WebhookDelivery {
  @ApiProperty({ description: 'Delivery ID' })
  id!: string;

  @ApiProperty({ description: 'Webhook ID' })
  webhookId!: string;

  @ApiProperty({ description: 'Event type' })
  eventType!: string;

  @ApiProperty({ description: 'Event payload' })
  payload!: any;

  @ApiProperty({ description: 'Request headers' })
  headers!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Response status code' })
  statusCode?: number;

  @ApiPropertyOptional({ description: 'Response body' })
  responseBody?: string;

  @ApiProperty({ description: 'Response headers' })
  responseHeaders!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Delivery timestamp' })
  deliveredAt?: Date;

  @ApiPropertyOptional({ description: 'Duration in milliseconds' })
  duration?: number;

  @ApiProperty({ description: 'Success status', default: false })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Error message' })
  error?: string;

  @ApiProperty({ description: 'Retry count', default: 0 })
  retryCount!: number;

  @ApiPropertyOptional({ description: 'Next retry timestamp' })
  nextRetryAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}