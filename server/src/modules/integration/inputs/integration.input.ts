import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsObject, IsArray, Min, MaxLength, MinLength } from 'class-validator';
import { IntegrationType, IntegrationStatus, AuthType } from '../types/integration.graphql.types';

@InputType()
export class WebhookConfigInput {
  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  url!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @Field(() => AuthType, { nullable: true })
  @IsOptional()
  @IsEnum(AuthType)
  authType?: AuthType;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;
}

@InputType()
export class CreateIntegrationInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Field(() => IntegrationType)
  @IsEnum(IntegrationType)
  type!: IntegrationType;

  @Field(() => AuthType)
  @IsEnum(AuthType)
  authType!: AuthType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  providerName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  syncInterval?: number;

  @Field(() => [WebhookConfigInput], { nullable: true })
  @IsOptional()
  @IsArray()
  webhooks?: WebhookConfigInput[];
}

@InputType()
export class UpdateIntegrationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  syncInterval?: number;
}

@InputType()
export class IntegrationFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => IntegrationType, { nullable: true })
  @IsOptional()
  @IsEnum(IntegrationType)
  type?: IntegrationType;

  @Field(() => IntegrationStatus, { nullable: true })
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  providerName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;
}

@InputType()
export class IntegrationConfigInput {
  @Field()
  @IsString()
  key!: string;

  @Field()
  value!: any;
}
