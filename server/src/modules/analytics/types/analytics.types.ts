import { ObjectType, Field, ID, Int, Float, registerEnumType } from '@nestjs/graphql';
import { BaseEntity } from '../../../common/graphql/base.types';

// Enums first
export enum MetricCategory {
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  CUSTOMER = 'CUSTOMER',
  FINANCIAL = 'FINANCIAL',
  OPERATIONAL = 'OPERATIONAL',
}

registerEnumType(MetricCategory, {
  name: 'MetricCategory',
  description: 'Categories for metrics',
});

export enum TimePeriod {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

registerEnumType(TimePeriod, {
  name: 'TimePeriod',
  description: 'Time period granularity',
});

export enum ReportStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

registerEnumType(ReportStatus, {
  name: 'ReportStatus',
  description: 'Status of a report',
});

export enum ExecutionStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

registerEnumType(ExecutionStatus, {
  name: 'ExecutionStatus',
  description: 'Status of a report execution',
});

// Simple types first (no dependencies)
@ObjectType()
export class MetricDimension {
  @Field()
  name!: string;

  @Field()
  value!: string;
}

@ObjectType()
export class TrendDataPoint {
  @Field()
  timestamp!: Date;

  @Field(() => Float)
  value!: number;

  @Field({ nullable: true })
  label?: string;
}

@ObjectType()
export class MetricValue {
  @Field()
  name!: string;

  @Field(() => Float)
  value!: number;

  @Field({ nullable: true })
  unit?: string;
}

@ObjectType()
export class DashboardWidget {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  type!: string;

  @Field()
  data!: string;

  @Field(() => Int)
  x!: number;

  @Field(() => Int)
  y!: number;

  @Field(() => Int)
  width!: number;

  @Field(() => Int)
  height!: number;
}

@ObjectType()
export class ForecastDataPoint {
  @Field()
  timestamp!: Date;

  @Field(() => Float)
  value!: number;

  @Field(() => Float, { nullable: true })
  lowerBound?: number;

  @Field(() => Float, { nullable: true })
  upperBound?: number;
}

// Complex types (with dependencies)
@ObjectType()
export class Metric {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  value!: number;

  @Field()
  unit!: string;

  @Field()
  category!: string;

  @Field()
  timestamp!: Date;

  @Field(() => [MetricDimension], { nullable: true })
  dimensions?: MetricDimension[];
}

@ObjectType()
export class KPI {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  currentValue!: number;

  @Field(() => Float, { nullable: true })
  targetValue?: number;

  @Field(() => Float, { nullable: true })
  previousValue?: number;

  @Field(() => Float)
  changePercentage!: number;

  @Field()
  status!: string;

  @Field()
  period!: string;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class Trend {
  @Field(() => ID)
  id!: string;

  @Field()
  metricName!: string;

  @Field(() => [TrendDataPoint])
  dataPoints!: TrendDataPoint[];

  @Field()
  direction!: string;

  @Field(() => Float)
  slope!: number;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;
}

@ObjectType()
export class ComparisonResult {
  @Field(() => ID)
  id!: string;

  @Field()
  comparisonType!: string;

  @Field()
  metricName!: string;

  @Field(() => Float)
  currentValue!: number;

  @Field(() => Float)
  comparisonValue!: number;

  @Field(() => Float)
  variance!: number;

  @Field(() => Float)
  percentageChange!: number;

  @Field()
  currentLabel!: string;

  @Field()
  comparisonLabel!: string;

  @Field({ nullable: true })
  context?: string;
}

@ObjectType()
export class LocationComparison {
  @Field(() => ID)
  locationId!: string;

  @Field()
  locationName!: string;

  @Field(() => [MetricValue])
  metrics!: MetricValue[];

  @Field(() => Int)
  rank!: number;
}

@ObjectType()
export class SegmentComparison {
  @Field(() => ID)
  segmentId!: string;

  @Field()
  segmentName!: string;

  @Field(() => [MetricValue])
  metrics!: MetricValue[];

  @Field(() => Int)
  size!: number;
}

@ObjectType()
export class Report extends BaseEntity {
  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  reportType!: string;

  @Field()
  status!: string;

  @Field(() => [String])
  metrics!: string[];

  @Field(() => [String], { nullable: true })
  dimensions?: string[];

  @Field()
  schedule!: string;

  @Field({ nullable: true })
  lastRunAt?: Date;

  @Field({ nullable: true })
  nextRunAt?: Date;
}

@ObjectType()
export class ReportExecution {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  reportId!: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  jobId?: string;

  @Field()
  startedAt!: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  result?: string;
}

@ObjectType()
export class ScheduledReport {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  reportId!: string;

  @Field()
  schedule!: string;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  nextRunAt?: Date;

  @Field({ nullable: true })
  lastRunAt?: Date;
}

@ObjectType()
export class Dashboard extends BaseEntity {
  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => [DashboardWidget])
  widgets!: DashboardWidget[];

  @Field()
  isPublic!: boolean;
}

@ObjectType()
export class WidgetData {
  @Field(() => ID)
  widgetId!: string;

  @Field()
  data!: string;

  @Field()
  updatedAt!: Date;

  @Field()
  fromCache!: boolean;
}

@ObjectType()
export class DataCube {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => [String])
  dimensions!: string[];

  @Field(() => [String])
  measures!: string[];

  @Field()
  data!: string;
}

@ObjectType()
export class Forecast {
  @Field(() => ID)
  id!: string;

  @Field()
  metricName!: string;

  @Field(() => [ForecastDataPoint])
  predictions!: ForecastDataPoint[];

  @Field(() => Float)
  confidence!: number;

  @Field()
  model!: string;
}

@ObjectType()
export class Anomaly {
  @Field(() => ID)
  id!: string;

  @Field()
  metricName!: string;

  @Field()
  timestamp!: Date;

  @Field(() => Float)
  actualValue!: number;

  @Field(() => Float)
  expectedValue!: number;

  @Field(() => Float)
  deviationScore!: number;

  @Field()
  severity!: string;
}

@ObjectType()
export class AnalyticsConfiguration {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  dataRetentionPeriod!: string;

  @Field()
  aggregationLevel!: string;

  @Field(() => [String])
  enabledMetrics!: string[];

  @Field({ nullable: true })
  customSettings?: string;

  @Field()
  enableRealTimeProcessing!: boolean;

  @Field()
  enablePredictiveAnalytics!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class MetricDefinition {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  dataType!: string;

  @Field()
  aggregationType!: string;

  @Field(() => [String])
  dimensions!: string[];

  @Field({ nullable: true })
  formula?: string;

  @Field()
  isCustom!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class ETLPipeline {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  sourceType!: string;

  @Field()
  sourceConfig!: string;

  @Field()
  transformConfig!: string;

  @Field()
  destinationConfig!: string;

  @Field({ nullable: true })
  schedule?: string;

  @Field()
  isActive!: boolean;

  @Field()
  status!: string;

  @Field({ nullable: true })
  lastRunAt?: Date;

  @Field({ nullable: true })
  nextRunAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class ETLJobResult {
  @Field(() => ID)
  id!: string;

  @Field()
  pipelineId!: string;

  @Field()
  status!: string;

  @Field()
  startedAt!: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field(() => Int)
  recordsProcessed!: number;

  @Field(() => Int)
  recordsSuccessful!: number;

  @Field(() => Int)
  recordsFailed!: number;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field({ nullable: true })
  executionLog?: string;
}

@ObjectType()
export class PredictiveModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  modelType!: string;

  @Field(() => [String])
  features!: string[];

  @Field()
  targetVariable!: string;

  @Field()
  status!: string;

  @Field(() => Float, { nullable: true })
  accuracy?: number;

  @Field({ nullable: true })
  trainingConfig?: string;

  @Field({ nullable: true })
  lastTrainedAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class DemandForecast {
  @Field(() => ID)
  id!: string;

  @Field()
  productId!: string;

  @Field()
  locationId!: string;

  @Field(() => [ForecastDataPoint])
  predictions!: ForecastDataPoint[];

  @Field(() => Float)
  confidence!: number;

  @Field()
  model!: string;

  @Field()
  forecastPeriod!: string;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class ChurnPrediction {
  @Field(() => ID)
  id!: string;

  @Field()
  customerId!: string;

  @Field(() => Float)
  churnProbability!: number;

  @Field()
  riskLevel!: string;

  @Field(() => [String])
  riskFactors!: string[];

  @Field({ nullable: true })
  recommendedActions?: string;

  @Field()
  predictionDate!: Date;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class PriceOptimization {
  @Field(() => ID)
  id!: string;

  @Field()
  productId!: string;

  @Field({ nullable: true })
  locationId?: string;

  @Field(() => Float)
  currentPrice!: number;

  @Field(() => Float)
  recommendedPrice!: number;

  @Field(() => Float)
  expectedRevenueLift!: number;

  @Field(() => Float)
  confidence!: number;

  @Field({ nullable: true })
  reasoning?: string;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class InventoryOptimization {
  @Field(() => ID)
  id!: string;

  @Field()
  productId!: string;

  @Field()
  locationId!: string;

  @Field(() => Int)
  currentStock!: number;

  @Field(() => Int)
  recommendedStock!: number;

  @Field(() => Int)
  reorderPoint!: number;

  @Field(() => Int)
  reorderQuantity!: number;

  @Field(() => Float)
  expectedServiceLevel!: number;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class QueryPerformanceStats {
  @Field(() => ID)
  id!: string;

  @Field()
  queryName!: string;

  @Field(() => Float)
  averageExecutionTime!: number;

  @Field(() => Int)
  executionCount!: number;

  @Field(() => Float)
  cacheHitRate!: number;

  @Field(() => Int)
  averageRowsReturned!: number;

  @Field()
  lastExecutedAt!: Date;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class WarehouseStatistics {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field(() => Float)
  totalStorageGB!: number;

  @Field(() => Int)
  totalTables!: number;

  @Field(() => Int)
  totalRows!: number;

  @Field(() => Float)
  compressionRatio!: number;

  @Field(() => Float)
  queryPerformanceScore!: number;

  @Field()
  lastOptimizedAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class AvailableFields {
  @Field(() => [String])
  dimensions!: string[];

  @Field(() => [String])
  measures!: string[];

  @Field(() => [String])
  filters!: string[];

  @Field(() => [String])
  dateSources!: string[];
}
