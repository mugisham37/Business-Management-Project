import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, IsObject, IsArray } from 'class-validator';
import { IntegrationType } from '../entities/integration.entity';

export class CreateConnectorDto {
  @ApiProperty({ description: 'Connector name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Display name' })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({ description: 'Connector description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: IntegrationType, description: 'Connector type' })
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @ApiProperty({ description: 'Connector version' })
  @IsString()
  version: string;

  @ApiProperty({ description: 'Configuration schema' })
  @IsObject()
  configSchema: any;

  @ApiProperty({ description: 'Authentication schema' })
  @IsObject()
  authSchema: any;

  @ApiProperty({ description: 'Connector capabilities' })
  @IsArray()
  @IsString({ each: true })
  capabilities: string[];

  @ApiProperty({ description: 'Supported events' })
  @IsArray()
  @IsString({ each: true })
  supportedEvents: string[];

  @ApiProperty({ description: 'Supported operations' })
  @IsArray()
  @IsString({ each: true })
  supportedOperations: string[];
}

export class UpdateConnectorDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Connector description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ConnectorListDto {
  @ApiPropertyOptional({ enum: IntegrationType, description: 'Filter by type' })
  @IsOptional()
  @IsEnum(IntegrationType)
  type?: IntegrationType;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}