import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateApiKeyDto {
  @ApiProperty({ description: 'API Key name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'API key scopes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ description: 'API key permissions' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Rate limit per hour', default: 1000 })
  @IsOptional()
  @IsNumber()
  rateLimit?: number;

  @ApiPropertyOptional({ description: 'Rate limit window in seconds', default: 3600 })
  @IsOptional()
  @IsNumber()
  rateLimitWindow?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP whitelist' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ description: 'API Key name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'API key scopes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ description: 'API key permissions' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Rate limit per hour' })
  @IsOptional()
  @IsNumber()
  rateLimit?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP whitelist' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
  apiKey?: any;
  rateLimitInfo?: any;
}

export interface ApiKeyUsageStats {
  apiKeyId: string;
  name: string;
  totalRequests: number;
  lastUsedAt?: Date;
  createdAt: Date;
  isActive: boolean;
  expiresAt?: Date;
  rateLimit: number;
  rateLimitWindow: number;
  currentPeriodRequests: number;
  rateLimitResetAt?: Date;
}
