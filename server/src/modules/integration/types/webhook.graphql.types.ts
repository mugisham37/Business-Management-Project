import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { BaseEntity } from '../../../common/graphql/base.types';

export enum WebhookStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
  SUSPENDED = 'suspended',
}

export enum WebhookAuthType {
  BEARER_TOKEN = 'bearer_token',
  API_KEY = 'api_key',
  BASIC_AUTH = 'basic_auth',
  NONE = 'none',
}

registerEnumType(WebhookStatus, { name: 'WebhookStatus' });
registerEnumType(WebhookAuthType, { name: 'WebhookAuthType' });

@ObjectType()
export class WebhookType extends BaseEntity {
  @Field(() => ID)
  declare id: string;

  @Field()
  integrationId!: string;

  @Field()
  name!: string;

  @Field()
  url!: string;

  @Field()
  method!: string;

  @Field(() => [String])
  events!: string[];

  @Field(() => WebhookStatus)
  status!: WebhookStatus;

  @Field(() => WebhookAuthType)
  authType!: WebhookAuthType;

  @Field()
  isActive!: boolean;

  @Field(() => Int)
  timeout!: number;

  @Field(() => Int)
  retryAttempts!: number;

  @Field(() => Int)
  successCount!: number;

  @Field(() => Int)
  failureCount!: number;

  @Field({ nullable: true })
  lastDeliveryAt?: Date;

  @Field({ nullable: true })
  lastSuccessAt?: Date;

  @Field({ nullable: true })
  lastFailureAt?: Date;

  @Field({ nullable: true })
  lastError?: string;

  @Field()
  declare createdAt: Date;

  @Field()
  declare updatedAt: Date;
}

@ObjectType()
export class WebhookDeliveryType {
  @Field(() => ID)
  id!: string;

  @Field()
  webhookId!: string;

  @Field()
  eventType!: string;

  @Field(() => Int)
  statusCode!: number;

  @Field()
  success!: boolean;

  @Field({ nullable: true })
  error?: string;

  @Field(() => Int)
  duration!: number;

  @Field()
  deliveredAt!: Date;

  @Field(() => Int)
  retryCount!: number;
}

@ObjectType()
export class WebhookTestResult {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  statusCode?: number;

  @Field({ nullable: true })
  error?: string;

  @Field(() => Int)
  duration!: number;

  @Field()
  timestamp!: Date;
}