import { ObjectType, Field, Int, Float, registerEnumType, InputType, ArgsType } from '@nestjs/graphql';
import { GraphQLJSON, GraphQLDateTime } from 'graphql-scalars';
import { LogLevel, LogCategory } from '../logger.service';

// Register enums for GraphQL
registerEnumType(LogLevel, {
  name: 'LogLevel',
  description: 'Available log levels',
});

registerEnumType(LogCategory, {
  name: 'LogCategory',
  description: 'Available log categories',
});

@ObjectType('LogEntry')
export class LogEntryType {
  @Field()
  id: string;

  @Field(() => GraphQLDateTime)
  timestamp: Date;

  @Field(() => LogLevel)
  level: LogLevel;

  @Field(() => LogCategory)
  category: LogCategory;

  @Field()
  message: string;

  @Field({ nullable: true })
  context?: string;

  @Field({ nullable: true })
  tenantId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  requestId?: string;

  @Field({ nullable: true })
  correlationId?: string;

  @Field({ nullable: true })
  operation?: string;

  @Field(() => Int, { nullable: true })
  duration?: number;

  @Field({ nullable: true })
  graphqlOperation?: string;

  @Field({ nullable: true })
  graphqlOperationType?: string;

  @Field(() => [String], { nullable: true })
  graphqlPath?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  graphqlVariables?: Record<string, unknown>;

  @Field(() => Int, { nullable: true })
  graphqlComplexity?: number;

  @Field(() => Int, { nullable: true })
  graphqlDepth?: number;

  @Field({ nullable: true })
  sessionId?: string;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  userAgent?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;
}

@ObjectType('LogMetrics')
export class LogMetricsType {
  @Field(() => Int)
  totalLogs: number;

  @Field(() => Int)
  errorCount: number;

  @Field(() => Int)
  warningCount: number;

  @Field(() => Int)
  performanceIssues: number;

  @Field(() => Int)
  securityEvents: number;

  @Field(() => Int)
  auditEvents: number;

  @Field(() => Float)
  averageResponseTime: number;

  @Field(() => Int)
  slowQueries: number;

  @Field(() => Int)
  graphqlErrors: number;
}

@ObjectType('TopOperation')
export class TopOperationType {
  @Field()
  operation: string;

  @Field(() => Int)
  count: number;

  @Field(() => Float)
  avgDuration: number;
}

@ObjectType('ErrorPattern')
export class ErrorPatternType {
  @Field()
  pattern: string;

  @Field(() => Int)
  count: number;

  @Field(() => GraphQLDateTime)
  lastOccurrence: Date;
}

@ObjectType('PerformanceTrend')
export class PerformanceTrendType {
  @Field(() => GraphQLDateTime)
  timestamp: Date;

  @Field(() => Float)
  avgDuration: number;

  @Field(() => Int)
  operationCount: number;
}

@ObjectType('SecurityAlert')
export class SecurityAlertType {
  @Field()
  type: string;

  @Field(() => Int)
  count: number;

  @Field()
  severity: string;
}

@ObjectType('TenantActivity')
export class TenantActivityType {
  @Field()
  tenantId: string;

  @Field(() => Int)
  logCount: number;

  @Field(() => Float)
  errorRate: number;
}

@ObjectType('LogAnalytics')
export class LogAnalyticsType {
  @Field(() => [TopOperationType])
  topOperations: TopOperationType[];

  @Field(() => [ErrorPatternType])
  errorPatterns: ErrorPatternType[];

  @Field(() => [PerformanceTrendType])
  performanceTrends: PerformanceTrendType[];

  @Field(() => [SecurityAlertType])
  securityAlerts: SecurityAlertType[];

  @Field(() => [TenantActivityType])
  tenantActivity: TenantActivityType[];
}

@ObjectType('LogConnection')
export class LogConnectionType {
  @Field(() => [LogEntryEdge])
  edges: LogEntryEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType('LogEntryEdge')
export class LogEntryEdge {
  @Field()
  cursor: string;

  @Field(() => LogEntryType)
  node: LogEntryType;
}

@ObjectType('PageInfo')
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType('LogSearchResult')
export class LogSearchResultType {
  @Field(() => [LogEntryType])
  logs: LogEntryType[];

  @Field(() => Int)
  totalCount: number;

  @Field(() => LogMetricsType)
  metrics: LogMetricsType;

  @Field(() => [String])
  suggestions: string[];
}

@ObjectType('LogStreamEvent')
export class LogStreamEventType {
  @Field(() => LogEntryType)
  log: LogEntryType;

  @Field(() => GraphQLDateTime)
  timestamp: Date;

  @Field()
  eventType: string;
}

@ObjectType('AuditLogEntry')
export class AuditLogEntryType extends LogEntryType {
  @Field()
  auditId: string;

  @Field()
  event: string;

  @Field(() => GraphQLJSON)
  details: Record<string, unknown>;

  @Field({ nullable: true })
  entityType?: string;

  @Field({ nullable: true })
  entityId?: string;

  @Field({ nullable: true })
  previousValue?: string;

  @Field({ nullable: true })
  newValue?: string;
}

@ObjectType('SecurityLogEntry')
export class SecurityLogEntryType extends LogEntryType {
  @Field()
  securityId: string;

  @Field()
  event: string;

  @Field()
  severity: string;

  @Field(() => GraphQLJSON)
  details: Record<string, unknown>;

  @Field({ nullable: true })
  threatLevel?: string;

  @Field({ nullable: true })
  sourceIp?: string;

  @Field({ nullable: true })
  userAgent?: string;
}

@ObjectType('PerformanceLogEntry')
export class PerformanceLogEntryType extends LogEntryType {
  @Field()
  operation: string;

  @Field(() => Int)
  duration: number;

  @Field()
  performanceCategory: string;

  @Field()
  isSlowQuery: boolean;

  @Field({ nullable: true })
  queryComplexity?: number;

  @Field({ nullable: true })
  cacheHitRate?: number;
}

@ObjectType('BusinessLogEntry')
export class BusinessLogEntryType extends LogEntryType {
  @Field()
  businessId: string;

  @Field()
  businessEvent: string;

  @Field(() => GraphQLJSON)
  businessDetails: Record<string, unknown>;

  @Field({ nullable: true })
  businessUnit?: string;

  @Field({ nullable: true })
  revenue?: number;

  @Field({ nullable: true })
  customerImpact?: string;
}

// Mutation Response Types
@ObjectType('LogMutationResponse')
export class LogMutationResponseType {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => [LogErrorType], { nullable: true })
  errors?: LogErrorType[];
}

@ObjectType('LogError')
export class LogErrorType {
  @Field()
  message: string;

  @Field({ nullable: true })
  code?: string;

  @Field(() => [String], { nullable: true })
  path?: string[];

  @Field(() => GraphQLDateTime)
  timestamp: Date;
}

// Subscription Types
@ObjectType('LogSubscriptionPayload')
export class LogSubscriptionPayloadType {
  @Field(() => LogEntryType)
  log: LogEntryType;

  @Field()
  subscriptionId: string;

  @Field(() => GraphQLDateTime)
  timestamp: Date;
}

@ObjectType('MetricsSubscriptionPayload')
export class MetricsSubscriptionPayloadType {
  @Field(() => LogMetricsType)
  metrics: LogMetricsType;

  @Field({ nullable: true })
  tenantId?: string;

  @Field(() => GraphQLDateTime)
  timestamp: Date;
}

@ObjectType('AlertSubscriptionPayload')
export class AlertSubscriptionPayloadType {
  @Field()
  alertType: string;

  @Field()
  severity: string;

  @Field()
  message: string;

  @Field(() => GraphQLJSON)
  details: Record<string, unknown>;

  @Field(() => GraphQLDateTime)
  timestamp: Date;
}