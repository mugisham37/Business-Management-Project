import { IsString, IsArray, IsNumber, IsBoolean, IsOptional, IsEnum, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InputType, Field, ObjectType } from '@nestjs/graphql';

import { DisasterType } from '../entities/disaster-recovery.entity';

// Base DTOs
@InputType()
export class CreateDRPlanDto {
  @ApiProperty({ description: 'Name of the disaster recovery plan' })
  @Field()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Description of the disaster recovery plan' })
  @Field()
  @IsString()
  description!: string;

  @ApiProperty({ description: 'Types of disasters this plan covers', enum: DisasterType, isArray: true })
  @Field(() => [String])
  @IsArray()
  @IsEnum(DisasterType, { each: true })
  disasterTypes!: DisasterType[];

  @ApiProperty({ description: 'Recovery Time Objective in minutes', minimum: 1, maximum: 1440 })
  @Field()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rtoMinutes!: number;

  @ApiProperty({ description: 'Recovery Point Objective in minutes', minimum: 1, maximum: 1440 })
  @Field()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rpoMinutes!: number;

  @ApiProperty({ description: 'Primary region for operations' })
  @Field()
  @IsString()
  primaryRegion!: string;

  @ApiProperty({ description: 'Secondary regions for disaster recovery', isArray: true })
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  secondaryRegions!: string[];

  @ApiProperty({ description: 'Enable automatic failover' })
  @Field()
  @IsBoolean()
  automaticFailover!: boolean;

  @ApiProperty({ description: 'Additional configuration options', default: {} })
  @Field(() => String)
  @IsObject()
  configuration!: Record<string, any>;
}

@InputType()
export class CreateDRPlanInput extends CreateDRPlanDto {}

@InputType()
export class UpdateDRPlanDto {
  @ApiPropertyOptional({ description: 'Name of the disaster recovery plan' })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the disaster recovery plan' })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Types of disasters this plan covers', enum: DisasterType, isArray: true })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(DisasterType, { each: true })
  disasterTypes?: DisasterType[];

  @ApiPropertyOptional({ description: 'Recovery Time Objective in minutes', minimum: 1, maximum: 1440 })
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rtoMinutes?: number;

  @ApiPropertyOptional({ description: 'Recovery Point Objective in minutes', minimum: 1, maximum: 1440 })
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rpoMinutes?: number;

  @ApiPropertyOptional({ description: 'Primary region for operations' })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  primaryRegion?: string;

  @ApiPropertyOptional({ description: 'Secondary regions for disaster recovery', isArray: true })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryRegions?: string[];

  @ApiPropertyOptional({ description: 'Enable automatic failover' })
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  automaticFailover?: boolean;

  @ApiPropertyOptional({ description: 'Additional configuration options' })
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;
}

@InputType()
export class UpdateDRPlanInput extends UpdateDRPlanDto {}

@InputType()
export class ExecuteDRDto {
  @ApiProperty({ description: 'Type of disaster', enum: DisasterType })
  @Field()
  @IsEnum(DisasterType)
  disasterType!: DisasterType;

  @ApiPropertyOptional({ description: 'Whether this is a test execution', default: false })
  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}

@InputType()
export class ExecuteDRInput extends ExecuteDRDto {}

@InputType()
export class TestDRPlanDto {
  @ApiProperty({ description: 'Type of test to perform', enum: ['full', 'partial', 'failover_only'] })
  @Field()
  @IsEnum(['full', 'partial', 'failover_only'])
  testType!: 'full' | 'partial' | 'failover_only';
}

@InputType()
export class TestDRPlanInput extends TestDRPlanDto {}

// Failover DTOs
@InputType()
export class CreateFailoverConfigDto {
  @ApiProperty({ description: 'Name of the service' })
  @Field()
  @IsString()
  serviceName!: string;

  @ApiProperty({ description: 'Primary endpoint URL' })
  @Field()
  @IsString()
  primaryEndpoint!: string;

  @ApiProperty({ description: 'Secondary endpoint URLs', isArray: true })
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  secondaryEndpoints!: string[];

  @ApiProperty({ description: 'Enable automatic failover' })
  @Field()
  @IsBoolean()
  automaticFailover!: boolean;

  @ApiPropertyOptional({ description: 'Health check interval in seconds', default: 60 })
  @Field({ defaultValue: 60 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(3600)
  healthCheckIntervalSeconds?: number;

  @ApiPropertyOptional({ description: 'Failover timeout in seconds', default: 300 })
  @Field({ defaultValue: 300 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(1800)
  failoverTimeoutSeconds?: number;
}

@InputType()
export class CreateFailoverConfigInput extends CreateFailoverConfigDto {}

@InputType()
export class ExecuteFailoverDto {
  @ApiProperty({ description: 'Service name to failover' })
  @Field()
  @IsString()
  serviceName!: string;

  @ApiProperty({ description: 'Target region for failover' })
  @Field()
  @IsString()
  targetRegion!: string;

  @ApiPropertyOptional({ description: 'Reason for failover' })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class ExecuteFailoverInput extends ExecuteFailoverDto {}

// Replication DTOs
@InputType()
export class CreateReplicationDto {
  @ApiProperty({ description: 'Source region' })
  @Field()
  @IsString()
  sourceRegion!: string;

  @ApiProperty({ description: 'Target region' })
  @Field()
  @IsString()
  targetRegion!: string;

  @ApiProperty({ description: 'RPO in minutes' })
  @Field()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rpoMinutes!: number;

  @ApiPropertyOptional({ description: 'Replication type', enum: ['synchronous', 'asynchronous'], default: 'asynchronous' })
  @Field({ defaultValue: 'asynchronous' })
  @IsOptional()
  @IsEnum(['synchronous', 'asynchronous'])
  replicationType?: 'synchronous' | 'asynchronous';

  @ApiPropertyOptional({ description: 'Enable compression', default: true })
  @Field({ defaultValue: true })
  @IsOptional()
  @IsBoolean()
  compressionEnabled?: boolean;
}

@InputType()
export class CreateReplicationInput extends CreateReplicationDto {}

// Response DTOs
@ObjectType()
export class DRPlanResponseDto {
  @ApiProperty()
  @Field()
  success!: boolean;

  @ApiProperty()
  @Field()
  data!: any;

  @ApiProperty()
  @Field()
  message!: string;
}

@ObjectType()
export class DRExecutionResponseDto {
  @ApiProperty()
  @Field()
  success!: boolean;

  @ApiProperty()
  @Field()
  data!: any;

  @ApiProperty()
  @Field()
  message!: string;
}

@ObjectType()
export class DRMetricsResponseDto {
  @ApiProperty()
  @Field()
  success!: boolean;

  @ApiProperty()
  @Field()
  data!: any;

  @ApiProperty()
  @Field()
  message!: string;
}

@ObjectType()
export class RTOAnalysisResponseDto {
  @ApiProperty()
  @Field()
  success!: boolean;

  @ApiProperty()
  @Field()
  data!: any;

  @ApiProperty()
  @Field()
  message!: string;
}

@ObjectType()
export class FailoverConfigResponseDto {
  @ApiProperty()
  @Field()
  success!: boolean;

  @ApiProperty()
  @Field()
  data!: any;

  @ApiProperty()
  @Field()
  message!: string;
}

@ObjectType()
export class ReplicationStatusResponseDto {
  @ApiProperty()
  @Field()
  success!: boolean;

  @ApiProperty()
  @Field()
  data!: any;

  @ApiProperty()
  @Field()
  message!: string;
}

// Query DTOs
export class ListDRPlansQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by disaster type', enum: DisasterType })
  @IsOptional()
  @IsEnum(DisasterType)
  disasterType?: DisasterType;

  @ApiPropertyOptional({ description: 'Number of results to return', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class ListDRExecutionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by plan ID' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'Filter by disaster type', enum: DisasterType })
  @IsOptional()
  @IsEnum(DisasterType)
  disasterType?: DisasterType;

  @ApiPropertyOptional({ description: 'Filter by test executions only' })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;

  @ApiPropertyOptional({ description: 'Number of results to return', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

// Validation DTOs
export class ValidateDRPlanDto {
  @ApiProperty({ description: 'Plan ID to validate' })
  @IsString()
  planId!: string;
}

export class GenerateReportDto {
  @ApiProperty({ description: 'Type of report to generate', enum: ['summary', 'detailed', 'compliance'] })
  @IsEnum(['summary', 'detailed', 'compliance'])
  reportType!: 'summary' | 'detailed' | 'compliance';

  @ApiPropertyOptional({ description: 'Start date for report data' })
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for report data' })
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Include test executions in report', default: true })
  @IsOptional()
  @IsBoolean()
  includeTests?: boolean;
}