import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsArray, IsNumber, IsBoolean, IsOptional, IsEnum, Min, Max } from 'class-validator';

import { DisasterType } from '../entities/disaster-recovery.entity';

@InputType()
export class CreateDRPlanInput {
  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  description!: string;

  @Field(() => [DisasterType])
  @IsArray()
  @IsEnum(DisasterType, { each: true })
  disasterTypes!: DisasterType[];

  @Field()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rtoMinutes!: number;

  @Field()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rpoMinutes!: number;

  @Field()
  @IsString()
  primaryRegion!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  secondaryRegions!: string[];

  @Field()
  @IsBoolean()
  automaticFailover!: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  configuration?: string; // JSON string
}

@InputType()
export class UpdateDRPlanInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => [DisasterType], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(DisasterType, { each: true })
  disasterTypes?: DisasterType[];

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rtoMinutes?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rpoMinutes?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  primaryRegion?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryRegions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  automaticFailover?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  configuration?: string; // JSON string
}

@InputType()
export class ExecuteDRInput {
  @Field(() => DisasterType)
  @IsEnum(DisasterType)
  disasterType!: DisasterType;

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}

@InputType()
export class TestDRPlanInput {
  @Field(() => String)
  @IsEnum(['full', 'partial', 'failover_only'])
  testType!: 'full' | 'partial' | 'failover_only';
}

@InputType()
export class CreateFailoverConfigInput {
  @Field()
  @IsString()
  serviceName!: string;

  @Field()
  @IsString()
  primaryEndpoint!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  secondaryEndpoints!: string[];

  @Field()
  @IsBoolean()
  automaticFailover!: boolean;

  @Field({ defaultValue: 60 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(3600)
  healthCheckIntervalSeconds?: number;

  @Field({ defaultValue: 300 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(1800)
  failoverTimeoutSeconds?: number;
}

@InputType()
export class ExecuteFailoverInput {
  @Field()
  @IsString()
  serviceName!: string;

  @Field()
  @IsString()
  targetRegion!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class CreateReplicationInput {
  @Field()
  @IsString()
  sourceRegion!: string;

  @Field()
  @IsString()
  targetRegion!: string;

  @Field()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rpoMinutes!: number;

  @Field({ defaultValue: 'asynchronous' })
  @IsOptional()
  @IsEnum(['synchronous', 'asynchronous'])
  replicationType?: 'synchronous' | 'asynchronous';

  @Field({ defaultValue: true })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;
}

@InputType()
export class DRPlansFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => DisasterType, { nullable: true })
  @IsOptional()
  @IsEnum(DisasterType)
  disasterType?: DisasterType;

  @Field({ defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field({ defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

@InputType()
export class DRExecutionsFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  planId?: string;

  @Field(() => DisasterType, { nullable: true })
  @IsOptional()
  @IsEnum(DisasterType)
  disasterType?: DisasterType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;

  @Field({ defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field({ defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

@InputType()
export class GenerateReportInput {
  @Field(() => String)
  @IsEnum(['summary', 'detailed', 'compliance'])
  reportType!: 'summary' | 'detailed' | 'compliance';

  @Field({ nullable: true })
  @IsOptional()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  endDate?: Date;

  @Field({ defaultValue: true })
  @IsOptional()
  @IsBoolean()
  includeTests?: boolean;
}