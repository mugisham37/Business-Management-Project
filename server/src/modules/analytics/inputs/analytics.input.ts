import { InputType, Field, Int, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsDate, IsArray, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricCategory, TimePeriod } from '../types/analytics.types';

@InputType()
export class MetricsFilterInput {
  @Field(() => [MetricCategory], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(MetricCategory, { each: true })
  categories?: MetricCategory[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metricNames?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dimensions?: string[];
}

@InputType()
export class KPIFilterInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kpiNames?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => TimePeriod, { nullable: true })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod;
}

@InputType()
export class TrendFilterInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metricNames?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @Field(() => TimePeriod, { nullable: true })
  @IsOptional()
  @IsEnum(TimePeriod)
  granularity?: TimePeriod;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}


@InputType()
export class TimePeriodComparisonInput {
  @Field()
  @IsDate()
  @Type(() => Date)
  currentStartDate!: Date;

  @Field()
  @IsDate()
  @Type(() => Date)
  currentEndDate!: Date;

  @Field()
  @IsDate()
  @Type(() => Date)
  comparisonStartDate!: Date;

  @Field()
  @IsDate()
  @Type(() => Date)
  comparisonEndDate!: Date;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metricNames?: string[];
}

@InputType()
export class LocationComparisonInput {
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  locationIds!: string[];

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  metricNames!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

@InputType()
export class SegmentComparisonInput {
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  segmentIds!: string[];

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  metricNames!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}


@InputType()
export class CreateReportInput {
  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field()
  @IsString()
  reportType!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  metrics!: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dimensions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

@InputType()
export class ExecuteReportInput {
  @Field(() => ID)
  @IsString()
  reportId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

@InputType()
export class ScheduleReportInput {
  @Field(() => ID)
  @IsString()
  reportId!: string;

  @Field()
  @IsString()
  schedule!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;
}

@InputType()
export class UpdateReportInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reportType?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dimensions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

@InputType()
export class DashboardFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAfter?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdBefore?: Date;
}

@InputType()
export class ReportFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reportType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAfter?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdBefore?: Date;
}

@InputType()
export class AnalyticsQueryInput {
  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field()
  @IsString()
  sql!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  dimensions!: string[];

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  measures!: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  parameters?: string; // JSON string of parameters

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

@InputType()
export class ETLPipelineInput {
  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field()
  @IsString()
  sourceType!: string;

  @Field()
  @IsString()
  sourceConfig!: string; // JSON string

  @Field()
  @IsString()
  transformConfig!: string; // JSON string

  @Field()
  @IsString()
  destinationConfig!: string; // JSON string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schedule?: string; // Cron expression

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class PredictiveModelTrainingInput {
  @Field()
  @IsString()
  modelName!: string;

  @Field()
  @IsString()
  modelType!: string; // 'forecast', 'churn', 'pricing', 'inventory'

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @Field()
  @IsString()
  targetVariable!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  trainingConfig?: string; // JSON string

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  trainingStartDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  trainingEndDate?: Date;
}

@InputType()
export class AnalyticsConfigurationInput {
  @Field()
  @IsString()
  dataRetentionPeriod!: string;

  @Field()
  @IsString()
  aggregationLevel!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  enabledMetrics!: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  customSettings?: string; // JSON string

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enableRealTimeProcessing?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enablePredictiveAnalytics?: boolean;
}
