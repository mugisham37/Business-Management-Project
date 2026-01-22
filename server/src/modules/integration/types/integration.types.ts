import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/graphql/base.types';

@ObjectType()
export class IntegrationGQL extends BaseEntity {
  @Field()
  @ApiProperty({ description: 'Integration name' })
  name!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Integration description', required: false })
  description?: string;

  @Field()
  @ApiProperty({ description: 'Integration type' })
  type!: string;

  @Field()
  @ApiProperty({ description: 'Integration status' })
  status!: string;

  @Field()
  @ApiProperty({ description: 'Provider name' })
  providerName!: string;

  @Field()
  @ApiProperty({ description: 'Whether sync is enabled' })
  syncEnabled!: boolean;
}

@ObjectType()
export class ConnectorGQL {
  @Field(() => ID)
  @ApiProperty({ description: 'Connector identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Connector name' })
  name!: string;

  @Field()
  @ApiProperty({ description: 'Connector type' })
  type!: string;

  @Field()
  @ApiProperty({ description: 'Connector version' })
  version!: string;

  @Field()
  @ApiProperty({ description: 'Whether connector is installed' })
  isInstalled!: boolean;
}

@ObjectType()
export class APIKey {
  @Field(() => ID)
  @ApiProperty({ description: 'API key identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'API key name' })
  name!: string;

  @Field()
  @ApiProperty({ description: 'Masked key value' })
  keyMasked!: string;

  @Field()
  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Last used timestamp', required: false })
  lastUsedAt?: Date;

  @Field()
  @ApiProperty({ description: 'Whether key is active' })
  isActive!: boolean;
}

@ObjectType()
export class WebhookGQL {
  @Field(() => ID)
  @ApiProperty({ description: 'Webhook identifier' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Webhook URL' })
  url!: string;

  @Field(() => [String])
  @ApiProperty({ type: [String] })
  events!: string[];

  @Field()
  @ApiProperty({ description: 'Whether webhook is active' })
  isActive!: boolean;
}
