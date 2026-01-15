import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { AuthType } from '../entities/integration.entity';

export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Webhook URL' })
  @IsString()
  url!: string;

  @ApiPropertyOptional({ description: 'HTTP method', default: 'POST' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({ description: 'Events to listen for' })
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({ description: 'Event filters' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ enum: AuthType, description: 'Authentication type' })
  @IsOptional()
  @IsEnum(AuthType)
  authType?: AuthType;

  @ApiPropertyOptional({ description: 'Authentication configuration' })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Secret key for signature verification' })
  @IsOptional()
  @IsString()
  secretKey?: string;

  @ApiPropertyOptional({ description: 'Custom headers' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Timeout in seconds', default: 30 })
  @IsOptional()
  @IsNumber()
  timeout?: number;

  @ApiPropertyOptional({ description: 'Retry attempts', default: 3 })
  @IsOptional()
  @IsNumber()
  retryAttempts?: number;

  @ApiPropertyOptional({ description: 'Retry delay in milliseconds', default: 1000 })
  @IsOptional()
  @IsNumber()
  retryDelay?: number;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional({ description: 'Webhook name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Webhook URL' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Events to listen for' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({ description: 'Event filters' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WebhookDeliveryDto {
  @ApiProperty({ description: 'Event type' })
  @IsString()
  eventType!: string;

  @ApiProperty({ description: 'Event data' })
  @IsObject()
  data!: any;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class WebhookTestDto {
  @ApiPropertyOptional({ description: 'Test event type', default: 'test' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ description: 'Test data' })
  @IsOptional()
  @IsObject()
  data?: any;

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId!: string;
}
