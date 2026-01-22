import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray, IsInt, IsUrl, IsObject, IsBoolean, Min, Max, IsEnum } from 'class-validator';
import { AuthType } from '../types/integration.graphql.types';

@InputType()
export class CreateWebhookInput {
  @Field()
  @IsString()
  integrationId!: string;

  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsUrl()
  url!: string;

  @Field({ defaultValue: 'POST' })
  @IsOptional()
  @IsString()
  method?: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @Field(() => AuthType, { nullable: true })
  @IsOptional()
  @IsEnum(AuthType)
  authType?: AuthType;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  secretKey?: string;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @Field(() => Int, { nullable: true, defaultValue: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  timeout?: number;

  @Field(() => Int, { nullable: true, defaultValue: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retryAttempts?: number;

  @Field(() => Int, { nullable: true, defaultValue: 1000 })
  @IsOptional()
  @IsInt()
  @Min(100)
  retryDelay?: number;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class UpdateWebhookInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  url?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  method?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  timeout?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retryAttempts?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}

@InputType()
export class TestWebhookInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  event?: string;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

@InputType()
export class WebhookDeliveryInput {
  @Field()
  @IsString()
  eventType!: string;

  @Field()
  @IsObject()
  data!: any;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tenantId?: string;
}