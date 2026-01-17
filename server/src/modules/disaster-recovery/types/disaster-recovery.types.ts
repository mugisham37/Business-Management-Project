import { ObjectType, Field, ID } from '@nestjs/graphql';
import { 
  DisasterRecoveryPlan, 
  DisasterRecoveryExecution, 
  DisasterRecoveryMetrics,
  FailoverConfiguration,
  ReplicationConfiguration,
  FailoverType,
  FailoverStatus,
  ReplicationStatus
} from '../entities/disaster-recovery.entity';

// Response wrapper types
@ObjectType()
export class DRPlanResponse {
  @Field()
  success!: boolean;

  @Field(() => DisasterRecoveryPlan, { nullable: true })
  data?: DisasterRecoveryPlan;

  @Field()
  message!: string;

  @Field(() => [String], { nullable: true })
  errors?: string[];
}

@ObjectType()
export class DRExecutionResponse {
  @Field()
  success!: boolean;

  @Field(() => DisasterRecoveryExecution, { nullable: true })
  data?: DisasterRecoveryExecution;

  @Field()
  message!: string;

  @Field(() => [String], { nullable: true })
  errors?: string[];
}

@ObjectType()
export class DRMetricsResponse {
  @Field()
  success!: boolean;

  @Field(() => DisasterRecoveryMetrics, { nullable: true })
  data?: DisasterRecoveryMetrics;

  @Field()
  message!: string;
}

// RTO Analysis types
@ObjectType()
export class RTOAnalysisData {
  @Field()
  planId!: string;

  @Field()
  averageRtoMinutes!: number;

  @Field()
  targetRtoMinutes!: number;

  @Field()
  performanceScore!: number;

  @Field(() => [RTOExecutionData])
  recentExecutions!: RTOExecutionData[];

  @Field(() => [RTORecommendation])
  recommendations!: RTORecommendation[];
}

@ObjectType()
export class RTOExecutionData {
  @Field()
  executionId!: string;

  @Field()
  executedAt!: Date;

  @Field()
  actualRtoMinutes!: number;

  @Field()
  targetRtoMinutes!: number;

  @Field()
  variance!: number;

  @Field()
  isTest!: boolean;
}

@ObjectType()
export class RTORecommendation {
  @Field()
  category!: string;

  @Field()
  priority!: string;

  @Field()
  description!: string;

  @Field()
  estimatedImprovementMinutes!: number;

  @Field()
  implementationEffort!: string;
}

@ObjectType()
export class RTOAnalysisResponse {
  @Field()
  success!: boolean;

  @Field(() => RTOAnalysisData, { nullable: true })
  data?: RTOAnalysisData;

  @Field()
  message!: string;
}

// RTO Trends types
@ObjectType()
export class RTOTrendData {
  @Field()
  timestamp!: Date;

  @Field()
  averageRtoMinutes!: number;

  @Field()
  executionCount!: number;

  @Field()
  successRate!: number;
}

@ObjectType()
export class RTOTrendsResponse {
  @Field()
  success!: boolean;

  @Field(() => [RTOTrendData], { nullable: true })
  data?: RTOTrendData[];

  @Field()
  message!: string;
}

// RTO Improvement Plan types
@ObjectType()
export class RTOImprovementStep {
  @Field()
  stepNumber!: number;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  estimatedTimeReduction!: number;

  @Field()
  priority!: string;

  @Field()
  dependencies!: string[];

  @Field()
  estimatedCost!: number;
}

@ObjectType()
export class RTOImprovementPlan {
  @Field()
  planId!: string;

  @Field()
  currentRtoMinutes!: number;

  @Field()
  targetRtoMinutes!: number;

  @Field()
  potentialImprovementMinutes!: number;

  @Field(() => [RTOImprovementStep])
  steps!: RTOImprovementStep[];

  @Field()
  totalEstimatedCost!: number;

  @Field()
  estimatedImplementationWeeks!: number;
}

@ObjectType()
export class RTOImprovementPlanResponse {
  @Field()
  success!: boolean;

  @Field(() => RTOImprovementPlan, { nullable: true })
  data?: RTOImprovementPlan;

  @Field()
  message!: string;
}

// Failover types
@ObjectType()
export class FailoverConfigurationResponse {
  @Field()
  success!: boolean;

  @Field(() => FailoverConfiguration, { nullable: true })
  data?: FailoverConfiguration;

  @Field()
  message!: string;
}

@ObjectType()
export class FailoverConfigurationsResponse {
  @Field()
  success!: boolean;

  @Field(() => [FailoverConfiguration], { nullable: true })
  data?: FailoverConfiguration[];

  @Field()
  message!: string;
}

@ObjectType()
export class FailoverExecution {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  configurationId!: string;

  @Field(() => FailoverStatus)
  status!: FailoverStatus;

  @Field()
  isAutomatic!: boolean;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  startedAt?: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  failoverTimeSeconds?: number;

  @Field({ nullable: true })
  targetRegion?: string;

  @Field(() => String, { nullable: true })
  result?: string; // JSON string

  @Field({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  initiatedBy?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class FailoverExecutionResponse {
  @Field()
  success!: boolean;

  @Field(() => FailoverExecution, { nullable: true })
  data?: FailoverExecution;

  @Field()
  message!: string;
}

@ObjectType()
export class FailoverMetrics {
  @Field()
  totalConfigurations!: number;

  @Field()
  activeConfigurations!: number;

  @Field()
  totalExecutions!: number;

  @Field()
  successfulExecutions!: number;

  @Field()
  failedExecutions!: number;

  @Field()
  averageFailoverTime!: number;

  @Field()
  successRate!: number;

  @Field()
  lastFailoverAt!: Date;

  @Field()
  healthyEndpoints!: number;

  @Field()
  unhealthyEndpoints!: number;
}

@ObjectType()
export class FailoverMetricsResponse {
  @Field()
  success!: boolean;

  @Field(() => FailoverMetrics, { nullable: true })
  data?: FailoverMetrics;

  @Field()
  message!: string;
}

// Replication types
@ObjectType()
export class ReplicationConfigurationResponse {
  @Field()
  success!: boolean;

  @Field(() => ReplicationConfiguration, { nullable: true })
  data?: ReplicationConfiguration;

  @Field()
  message!: string;
}

@ObjectType()
export class ReplicationStatusResponse {
  @Field()
  success!: boolean;

  @Field(() => [ReplicationConfiguration], { nullable: true })
  data?: ReplicationConfiguration[];

  @Field()
  message!: string;
}

@ObjectType()
export class ReplicationMetrics {
  @Field()
  configId!: string;

  @Field()
  sourceRegion!: string;

  @Field()
  targetRegion!: string;

  @Field()
  lagSeconds!: number;

  @Field()
  throughputMBps!: number;

  @Field()
  errorRate!: number;

  @Field()
  lastReplicationAt!: Date;

  @Field(() => ReplicationStatus)
  status!: ReplicationStatus;

  @Field()
  bytesReplicated!: number;

  @Field()
  isHealthy!: boolean;
}

@ObjectType()
export class ReplicationMetricsResponse {
  @Field()
  success!: boolean;

  @Field(() => [ReplicationMetrics], { nullable: true })
  data?: ReplicationMetrics[];

  @Field()
  message!: string;
}

@ObjectType()
export class ReplicationTrendData {
  @Field()
  timestamp!: Date;

  @Field()
  lagSeconds!: number;

  @Field()
  bytesReplicated!: number;
}

@ObjectType()
export class ReplicationTrend {
  @Field()
  configurationId!: string;

  @Field()
  sourceRegion!: string;

  @Field()
  targetRegion!: string;

  @Field(() => [ReplicationTrendData])
  trends!: ReplicationTrendData[];
}

@ObjectType()
export class ReplicationTrendsResponse {
  @Field()
  success!: boolean;

  @Field(() => [ReplicationTrend], { nullable: true })
  data?: ReplicationTrend[];

  @Field()
  message!: string;
}

// List response types
@ObjectType()
export class DRPlansResponse {
  @Field()
  success!: boolean;

  @Field(() => [DisasterRecoveryPlan], { nullable: true })
  data?: DisasterRecoveryPlan[];

  @Field()
  message!: string;

  @Field({ nullable: true })
  total?: number;
}

@ObjectType()
export class DRExecutionsResponse {
  @Field()
  success!: boolean;

  @Field(() => [DisasterRecoveryExecution], { nullable: true })
  data?: DisasterRecoveryExecution[];

  @Field()
  message!: string;

  @Field({ nullable: true })
  total?: number;
}

// Report types
@ObjectType()
export class DRReport {
  @Field()
  reportType!: string;

  @Field()
  generatedAt!: Date;

  @Field()
  tenantId!: string;

  @Field(() => String)
  content!: string; // JSON string containing report data

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field()
  includeTests!: boolean;
}

@ObjectType()
export class DRReportResponse {
  @Field()
  success!: boolean;

  @Field(() => DRReport, { nullable: true })
  data?: DRReport;

  @Field()
  message!: string;
}