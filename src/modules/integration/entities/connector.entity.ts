import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationType } from './integration.entity';

export class Connector {
  @ApiProperty({ description: 'Connector ID' })
  id: string;

  @ApiProperty({ description: 'Connector name' })
  name: string;

  @ApiProperty({ description: 'Display name' })
  displayName: string;

  @ApiPropertyOptional({ description: 'Connector description' })
  description?: string;

  @ApiProperty({ enum: IntegrationType, description: 'Connector type' })
  type: IntegrationType;

  @ApiProperty({ description: 'Connector version' })
  version: string;

  @ApiPropertyOptional({ description: 'Minimum supported version' })
  minVersion?: string;

  @ApiPropertyOptional({ description: 'Maximum supported version' })
  maxVersion?: string;

  @ApiProperty({ description: 'Configuration schema' })
  configSchema: any;

  @ApiProperty({ description: 'Authentication schema' })
  authSchema: any;

  @ApiProperty({ description: 'Connector capabilities' })
  capabilities: string[];

  @ApiProperty({ description: 'Supported events' })
  supportedEvents: string[];

  @ApiProperty({ description: 'Supported operations' })
  supportedOperations: string[];

  @ApiPropertyOptional({ description: 'Documentation URL' })
  documentationUrl?: string;

  @ApiProperty({ description: 'Example configuration' })
  exampleConfig: Record<string, any>;

  @ApiProperty({ description: 'Is active', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Is official connector', default: false })
  isOfficial: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}