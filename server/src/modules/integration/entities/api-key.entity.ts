import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKey {
  @ApiProperty({ description: 'API Key ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Integration ID' })
  integrationId?: string;

  @ApiProperty({ description: 'API Key name' })
  name!: string;

  @ApiProperty({ description: 'Hashed API key' })
  keyHash!: string;

  @ApiProperty({ description: 'Key prefix for identification' })
  keyPrefix!: string;

  @ApiProperty({ description: 'API key scopes' })
  scopes!: string[];

  @ApiProperty({ description: 'API key permissions' })
  permissions!: string[];

  @ApiProperty({ description: 'Rate limit per hour', default: 1000 })
  rateLimit!: number;

  @ApiProperty({ description: 'Rate limit window in seconds', default: 3600 })
  rateLimitWindow!: number;

  @ApiProperty({ description: 'Request count', default: 0 })
  requestCount!: number;

  @ApiPropertyOptional({ description: 'Last used timestamp' })
  lastUsedAt?: Date;

  @ApiProperty({ description: 'Is active', default: true })
  isActive!: boolean;

  @ApiPropertyOptional({ description: 'Expiry timestamp' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string;

  @ApiProperty({ description: 'IP whitelist' })
  ipWhitelist!: string[];

  @ApiPropertyOptional({ description: 'User agent' })
  userAgent?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Created by user ID' })
  createdBy!: string;

  @ApiProperty({ description: 'Updated by user ID' })
  updatedBy!: string;
}