import { InputType, Field, Int, ArgsType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON, GraphQLDateTime } from 'graphql-scalars';
import { IsOptional, IsString, IsInt, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { LogLevel, LogCategory } from '../logger.service';

@InputType('LogFilterInput')
export class LogFilterInput {
  @Field(() => LogLevel, { nullable: true })
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @Field(() => LogCategory, { nullable: true })
  @IsOptional()
  @IsEnum(LogCategory)
  category?: LogCategory;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  operation?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  context?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  graphqlOperation?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  graphqlOperationType?: string;

  @Field(() => GraphQLDateTime, { nullable: true })
  @IsOptional()
  @IsDateString()
  startTime?: Date;

  @Field(() => GraphQLDateTime, { nullable: true })
  @IsOptional()
  @IsDateString()
  endTime?: Date;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minDuration?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDuration?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  tags?: string[];
}

@InputType('TimeRangeInput')
export class TimeRangeInput {
  @Field(() => GraphQLDateTime)
  @IsDateString()
  start!: Date;

  @Field(() => GraphQLDateTime)
  @IsDateString()
  end!: Date;
}

@ArgsType()
export class LogSearchArgs {
  @Field()
  @IsString()
  query!: string;

  @Field(() => LogFilterInput, { nullable: true })
  @IsOptional()
  filters?: LogFilterInput;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

@ArgsType()
export class LogConnectionArgs {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  last?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  before?: string;

  @Field(() => LogFilterInput, { nullable: true })
  @IsOptional()
  filters?: LogFilterInput;
}

@ArgsType()
export class LogMetricsArgs {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @Field(() => TimeRangeInput, { nullable: true })
  @IsOptional()
  timeRange?: TimeRangeInput;

  @Field(() => [LogCategory], { nullable: true })
  @IsOptional()
  categories?: LogCategory[];

  @Field({ nullable: true, defaultValue: 'hour' })
  @IsOptional()
  @IsString()
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

@ArgsType()
export class LogAnalyticsArgs {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @Field(() => TimeRangeInput, { nullable: true })
  @IsOptional()
  timeRange?: TimeRangeInput;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topN?: number;

  @Field(() => [LogCategory], { nullable: true })
  @IsOptional()
  categories?: LogCategory[];
}

@InputType('LogEntryInput')
export class LogEntryInput {
  @Field(() => LogLevel)
  @IsEnum(LogLevel)
  level!: LogLevel;

  @Field(() => LogCategory)
  @IsEnum(LogCategory)
  category!: LogCategory;

  @Field()
  @IsString()
  message!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  context?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  operation?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  tags?: string[];
}

@InputType('AuditLogInput')
export class AuditLogInput {
  @Field()
  @IsString()
  event!: string;

  @Field(() => GraphQLJSON)
  details!: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  entityType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  entityId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  previousValue?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  newValue?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

@InputType('SecurityLogInput')
export class SecurityLogInput {
  @Field()
  @IsString()
  event!: string;

  @Field(() => GraphQLJSON)
  details!: Record<string, unknown>;

  @Field({ nullable: true, defaultValue: 'medium' })
  @IsOptional()
  @IsString()
  severity?: 'low' | 'medium' | 'high' | 'critical';

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  threatLevel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sourceIp?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

@InputType('PerformanceLogInput')
export class PerformanceLogInput {
  @Field()
  @IsString()
  operation!: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  duration!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  performanceCategory?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  queryComplexity?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  cacheHitRate?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

@InputType('BusinessLogInput')
export class BusinessLogInput {
  @Field()
  @IsString()
  businessEvent!: string;

  @Field(() => GraphQLJSON)
  businessDetails!: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessUnit?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  revenue?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  customerImpact?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

@ArgsType()
export class LogStreamArgs {
  @Field(() => LogFilterInput, { nullable: true })
  @IsOptional()
  filters?: LogFilterInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  bufferSize?: number;
}

@InputType('LogRetentionPolicyInput')
export class LogRetentionPolicyInput {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  retentionDays!: number;

  @Field(() => [LogCategory])
  categories!: LogCategory[];

  @Field(() => [LogLevel])
  levels!: LogLevel[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  archiveBeforeDelete?: boolean;
}

@InputType('LogExportInput')
export class LogExportInput {
  @Field(() => LogFilterInput)
  filters!: LogFilterInput;

  @Field({ nullable: true, defaultValue: 'json' })
  @IsOptional()
  @IsString()
  format?: 'json' | 'csv' | 'xml';

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  includeMetadata?: boolean;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  compress?: boolean;
}

@InputType('LogAlertRuleInput')
export class LogAlertRuleInput {
  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  description!: string;

  @Field(() => LogFilterInput)
  conditions!: LogFilterInput;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  threshold!: number;

  @Field(() => Int)
  @IsInt()
  @Min(60)
  timeWindowSeconds!: number;

  @Field({ nullable: true, defaultValue: 'medium' })
  @IsOptional()
  @IsString()
  severity?: 'low' | 'medium' | 'high' | 'critical';

  @Field(() => [String])
  notificationChannels!: string[];

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  enabled?: boolean;
}