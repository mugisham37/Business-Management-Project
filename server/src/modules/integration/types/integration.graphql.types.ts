import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { BaseEntity } from '../../../common/graphql/base.types';

// Enums
export enum IntegrationType {
  ACCOUNTING = 'accounting',
  ECOMMERCE = 'ecommerce',
  PAYMENT = 'payment',
  CRM = 'crm',
  INVENTORY = 'inventory',
  SHIPPING = 'shipping',
  MARKETING = 'marketing',
  CUSTOM = 'custom',
}

export enum IntegrationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  SUSPENDED = 'suspended',
}

export enum AuthType {
  OAUTH2 = 'oauth2',
  API_KEY = 'api_key',
  BASIC_AUTH = 'basic_auth',
  BEARER_TOKEN = 'bearer_token',
  CUSTOM = 'custom',
}

registerEnumType(IntegrationType, { name: 'IntegrationType' });
registerEnumType(IntegrationStatus, { name: 'IntegrationStatus' });
registerEnumType(AuthType, { name: 'AuthType' });

@ObjectType()
export class Integration extends BaseEntity {
  @Field(() => ID)
  declare id: string;

  @Field()
  declare tenantId: string;

  @Field()
  name!: string;

  @Field()
  displayName!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => IntegrationType)
  type!: IntegrationType;

  @Field(() => IntegrationStatus)
  status!: IntegrationStatus;

  @Field(() => AuthType)
  authType!: AuthType;

  @Field({ nullable: true })
  providerName?: string;

  @Field({ nullable: true })
  providerVersion?: string;

  @Field({ nullable: true })
  connectorVersion?: string;

  @Field({ nullable: true })
  lastHealthCheck?: Date;

  @Field({ nullable: true })
  healthStatus?: string;

  @Field(() => Int)
  errorCount!: number;

  @Field({ nullable: true })
  lastError?: string;

  @Field({ nullable: true })
  lastErrorAt?: Date;

  @Field(() => Int)
  requestCount!: number;

  @Field({ nullable: true })
  lastRequestAt?: Date;

  @Field()
  syncEnabled!: boolean;

  @Field(() => Int, { nullable: true })
  syncInterval?: number;

  @Field({ nullable: true })
  lastSyncAt?: Date;

  @Field({ nullable: true })
  nextSyncAt?: Date;

  @Field()
  declare createdAt: Date;

  @Field()
  declare updatedAt: Date;

  @Field(() => Int)
  declare version: number;
}

@ObjectType()
export class IntegrationHealth {
  @Field(() => ID)
  integrationId!: string;

  @Field()
  isHealthy!: boolean;

  @Field()
  lastChecked!: Date;

  @Field({ nullable: true })
  details?: string;

  @Field({ nullable: true })
  error?: string;

  @Field(() => Int, { nullable: true })
  responseTime?: number;
}

@ObjectType()
export class IntegrationStatistics {
  @Field(() => ID)
  integrationId!: string;

  @Field(() => Int)
  totalRequests!: number;

  @Field(() => Int)
  successfulRequests!: number;

  @Field(() => Int)
  failedRequests!: number;

  @Field()
  successRate!: number;

  @Field()
  uptime!: number;

  @Field()
  timestamp!: Date;
}
