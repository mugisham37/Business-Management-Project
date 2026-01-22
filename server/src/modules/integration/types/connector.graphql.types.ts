import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { BaseEntity } from '../../../common/graphql/base.types';

export enum ConnectorCapability {
  SYNC = 'sync',
  WEBHOOK = 'webhook',
  REAL_TIME = 'real_time',
  BATCH = 'batch',
  OAUTH = 'oauth',
  API_KEY = 'api_key',
}

registerEnumType(ConnectorCapability, { name: 'ConnectorCapability' });

@ObjectType()
export class ConnectorType extends BaseEntity {
  @Field(() => ID)
  declare id: string;

  @Field()
  name!: string;

  @Field()
  displayName!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  type!: string;

  @Field(() => Int)
  declare version: number;

  @Field(() => [ConnectorCapability])
  capabilities!: ConnectorCapability[];

  @Field(() => [String])
  supportedEvents!: string[];

  @Field(() => [String])
  supportedOperations!: string[];

  @Field()
  isActive!: boolean;

  @Field()
  isOfficial!: boolean;

  @Field()
  declare createdAt: Date;

  @Field()
  declare updatedAt: Date;
}

@ObjectType()
export class ConnectorMetadataType {
  @Field()
  name!: string;

  @Field()
  displayName!: string;

  @Field()
  description!: string;

  @Field()
  type!: string;

  @Field()
  version!: string;

  @Field(() => [ConnectorCapability])
  capabilities!: ConnectorCapability[];

  @Field(() => [String])
  supportedEvents!: string[];

  @Field(() => [String])
  supportedOperations!: string[];

  @Field({ nullable: true })
  documentationUrl?: string;

  @Field()
  isOfficial!: boolean;
}

@ObjectType()
export class ConnectorTestResult {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  details?: string;

  @Field()
  timestamp!: Date;
}