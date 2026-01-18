import { Resolver, Query, Mutation, Subscription, Args, Context, Info } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { GraphQLResolveInfo } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { Inject } from '@nestjs/common';

import { BaseResolver } from '../../../common/graphql/base.resolver';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { TenantInterceptor } from '../../tenant/interceptors/tenant.interceptor';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';

import { CustomLoggerService } from '../logger.service';
import { LoggerAnalyticsService } from '../services/logger-analytics.service';
import { LoggerSearchService } from '../services/logger-search.service';
import { LoggerStreamService } from '../services/logger-stream.service';
import { LoggerExportService } from '../services/logger-export.service';
import { LoggerAlertService } from '../services/logger-alert.service';

import {
  LogEntryType,
  LogMetricsType,
  LogAnalyticsType,
  LogConnectionType,
  LogSearchResultType,
  LogStreamEventType,
  LogMutationResponseType,
  AuditLogEntryType,
  SecurityLogEntryType,
  PerformanceLogEntryType,
  BusinessLogEntryType,
  LogSubscriptionPayloadType,
  MetricsSubscriptionPayloadType,
  AlertSubscriptionPayloadType,
} from '../types/logger.types';

import {
  LogSearchArgs,
  LogConnectionArgs,
  LogMetricsArgs,
  LogAnalyticsArgs,
  LogEntryInput,
  AuditLogInput,
  SecurityLogInput,
  PerformanceLogInput,
  BusinessLogInput,
  LogStreamArgs,
  LogRetentionPolicyInput,
  LogExportInput,
  LogAlertRuleInput,
} from '../inputs/logger.input';

@Resolver(() => LogEntryType)
@UseGuards(GraphQLJwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export class LoggerResolver extends BaseResolver {
  constructor(
    private readonly loggerService: CustomLoggerService,
    private readonly analyticsService: LoggerAnalyticsService,
    private readonly searchService: LoggerSearchService,
    private readonly streamService: LoggerStreamService,
    private readonly exportService: LoggerExportService,
    private readonly alertService: LoggerAlertService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(null as any); // DataLoader not needed for logger
    this.loggerService.setContext('LoggerResolver');
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  // Queries
  @Query(() => LogConnectionType, { description: 'Get paginated logs with cursor-based pagination' })
  @RequirePermission('logs:read')
  async logs(
    @Args() args: LogConnectionArgs,
    @CurrentUser() user: any,
    @Context() context: any,
    @Info() info: GraphQLResolveInfo,
  ): Promise<LogConnectionType> {
    const tenantId = this.getCurrentTenantId(context);
    const startTime = Date.now();

    try {
      const result = await this.searchService.getLogConnection(args, tenantId);
      
      this.loggerService.performance(
        'logs_query',
        Date.now() - startTime,
        {
          tenantId,
          userId: user.id,
          operation: 'logs',
          resultCount: result.edges.length,
          totalCount: result.totalCount,
        },
      );

      return result;
    } catch (error) {
      this.loggerService.graphqlError('logs', error, ['logs'], {
        tenantId,
        userId: user.id,
        args: JSON.stringify(args),
      });
      throw error;
    }
  }

  @Query(() => LogSearchResultType, { description: 'Search logs with full-text search capabilities' })
  @RequirePermission('logs:search')
  async searchLogs(
    @Args() args: LogSearchArgs,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogSearchResultType> {
    const tenantId = this.getCurrentTenantId(context);
    const startTime = Date.now();

    try {
      const result = await this.searchService.searchLogs(args, tenantId);
      
      this.loggerService.performance(
        'search_logs',
        Date.now() - startTime,
        {
          tenantId,
          userId: user.id,
          operation: 'searchLogs',
          query: args.query,
          resultCount: result.logs.length,
        },
      );

      return result;
    } catch (error) {
      this.loggerService.graphqlError('searchLogs', error, ['searchLogs'], {
        tenantId,
        userId: user.id,
        query: args.query,
      });
      throw error;
    }
  }

  @Query(() => LogMetricsType, { description: 'Get logging metrics and statistics' })
  @RequirePermission('logs:metrics')
  async logMetrics(
    @Args() args: LogMetricsArgs,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogMetricsType> {
    const tenantId = args.tenantId || this.getCurrentTenantId(context);
    const startTime = Date.now();

    try {
      const metrics = await this.analyticsService.getMetrics(tenantId, args.timeRange, args.categories);
      
      this.loggerService.performance(
        'log_metrics',
        Date.now() - startTime,
        {
          tenantId,
          userId: user.id,
          operation: 'logMetrics',
        },
      );

      return metrics;
    } catch (error) {
      this.loggerService.graphqlError('logMetrics', error, ['logMetrics'], {
        tenantId,
        userId: user.id,
      });
      throw error;
    }
  }

  @Query(() => LogAnalyticsType, { description: 'Get comprehensive log analytics and insights' })
  @RequirePermission('logs:analytics')
  async logAnalytics(
    @Args() args: LogAnalyticsArgs,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogAnalyticsType> {
    const tenantId = args.tenantId || this.getCurrentTenantId(context);
    const startTime = Date.now();

    try {
      const analytics = await this.analyticsService.getAnalytics(tenantId, args.timeRange, args.topN, args.categories);
      
      this.loggerService.performance(
        'log_analytics',
        Date.now() - startTime,
        {
          tenantId,
          userId: user.id,
          operation: 'logAnalytics',
        },
      );

      return analytics;
    } catch (error) {
      this.loggerService.graphqlError('logAnalytics', error, ['logAnalytics'], {
        tenantId,
        userId: user.id,
      });
      throw error;
    }
  }

  @Query(() => [AuditLogEntryType], { description: 'Get audit logs for compliance and security' })
  @RequirePermission('audit:read')
  async auditLogs(
    @Args() args: LogConnectionArgs,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<AuditLogEntryType[]> {
    const tenantId = this.getCurrentTenantId(context);
    const startTime = Date.now();

    try {
      const auditLogs = await this.searchService.getAuditLogs(args, tenantId);
      
      this.loggerService.audit(
        'audit_logs_accessed',
        {
          accessedBy: user.id,
          recordCount: auditLogs.length,
          filters: args.filters,
        },
        {
          tenantId,
          userId: user.id,
        },
      );

      this.loggerService.performance(
        'audit_logs',
        Date.now() - startTime,
        {
          tenantId,
          userId: user.id,
          operation: 'auditLogs',
          resultCount: auditLogs.length,
        },
      );

      return auditLogs;
    } catch (error) {
      this.loggerService.graphqlError('auditLogs', error, ['auditLogs'], {
        tenantId,
        userId: user.id,
      });
      throw error;
    }
  }

  @Query(() => [SecurityLogEntryType], { description: 'Get security logs for threat monitoring' })
  @RequirePermission('security:read')
  async securityLogs(
    @Args() args: LogConnectionArgs,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<SecurityLogEntryType[]> {
    const tenantId = this.getCurrentTenantId(context);
    const startTime = Date.now();

    try {
      const securityLogs = await this.searchService.getSecurityLogs(args, tenantId);
      
      this.loggerService.security(
        'security_logs_accessed',
        {
          accessedBy: user.id,
          recordCount: securityLogs.length,
          filters: args.filters,
        },
        {
          tenantId,
          userId: user.id,
        },
      );

      this.loggerService.performance(
        'security_logs',
        Date.now() - startTime,
        {
          tenantId,
          userId: user.id,
          operation: 'securityLogs',
          resultCount: securityLogs.length,
        },
      );

      return securityLogs;
    } catch (error) {
      this.loggerService.graphqlError('securityLogs', error, ['securityLogs'], {
        tenantId,
        userId: user.id,
      });
      throw error;
    }
  }

  // Mutations
  @Mutation(() => LogMutationResponseType, { description: 'Create a custom log entry' })
  @RequirePermission('logs:write')
  async createLogEntry(
    @Args('input') input: LogEntryInput,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogMutationResponseType> {
    const tenantId = this.getCurrentTenantId(context);

    try {
      await this.loggerService.printMessage(
        input.level,
        input.message,
        {
          tenantId,
          userId: user.id,
          operation: input.operation,
          duration: input.duration,
          correlationId: input.correlationId,
          sessionId: input.sessionId,
          ...input.metadata,
        },
        input.category,
      );

      this.loggerService.audit(
        'custom_log_created',
        {
          createdBy: user.id,
          logLevel: input.level,
          logCategory: input.category,
          message: input.message,
        },
        {
          tenantId,
          userId: user.id,
        },
      );

      return {
        success: true,
        message: 'Log entry created successfully',
      };
    } catch (error) {
      this.loggerService.graphqlError('createLogEntry', error as Error, ['createLogEntry'], {
        tenantId,
        userId: user.id,
        input: JSON.stringify(input),
      });

      return {
        success: false,
        message: 'Failed to create log entry',
        errors: [{
          message: this.getErrorMessage(error),
          code: 'LOG_CREATION_FAILED',
          timestamp: new Date(),
        }],
      };
    }
  }

  @Mutation(() => LogMutationResponseType, { description: 'Create an audit log entry' })
  @RequirePermission('audit:write')
  async createAuditLog(
    @Args('input') input: AuditLogInput,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogMutationResponseType> {
    const tenantId = this.getCurrentTenantId(context);

    try {
      this.loggerService.audit(
        input.event,
        {
          ...input.details,
          entityType: input.entityType,
          entityId: input.entityId,
          previousValue: input.previousValue,
          newValue: input.newValue,
          ...input.metadata,
        },
        {
          tenantId,
          userId: user.id,
        },
      );

      return {
        success: true,
        message: 'Audit log created successfully',
      };
    } catch (error) {
      this.loggerService.graphqlError('createAuditLog', error as Error, ['createAuditLog'], {
        tenantId,
        userId: user.id,
        event: input.event,
      });

      return {
        success: false,
        message: 'Failed to create audit log',
        errors: [{
          message: this.getErrorMessage(error),
          code: 'AUDIT_LOG_CREATION_FAILED',
          timestamp: new Date(),
        }],
      };
    }
  }

  @Mutation(() => LogMutationResponseType, { description: 'Create a security log entry' })
  @RequirePermission('security:write')
  async createSecurityLog(
    @Args('input') input: SecurityLogInput,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogMutationResponseType> {
    const tenantId = this.getCurrentTenantId(context);

    try {
      this.loggerService.security(
        input.event,
        {
          ...input.details,
          severity: input.severity,
          threatLevel: input.threatLevel,
          sourceIp: input.sourceIp,
          userAgent: input.userAgent,
          ...input.metadata,
        },
        {
          tenantId,
          userId: user.id,
        },
      );

      return {
        success: true,
        message: 'Security log created successfully',
      };
    } catch (error) {
      this.loggerService.graphqlError('createSecurityLog', error as Error, ['createSecurityLog'], {
        tenantId,
        userId: user.id,
        event: input.event,
      });

      return {
        success: false,
        message: 'Failed to create security log',
        errors: [{
          message: this.getErrorMessage(error),
          code: 'SECURITY_LOG_CREATION_FAILED',
          timestamp: new Date(),
        }],
      };
    }
  }

  @Mutation(() => LogMutationResponseType, { description: 'Export logs to external format' })
  @RequirePermission('logs:export')
  async exportLogs(
    @Args('input') input: LogExportInput,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogMutationResponseType> {
    const tenantId = this.getCurrentTenantId(context);

    try {
      const exportResult = await this.exportService.exportLogs(input, tenantId);
      
      this.loggerService.audit(
        'logs_exported',
        {
          exportedBy: user.id,
          format: input.format,
          filters: input.filters,
          recordCount: exportResult.recordCount,
          fileSize: exportResult.fileSize,
        },
        {
          tenantId,
          userId: user.id,
        },
      );

      return {
        success: true,
        message: `Logs exported successfully. ${exportResult.recordCount} records exported.`,
      };
    } catch (error) {
      this.loggerService.graphqlError('exportLogs', error as Error, ['exportLogs'], {
        tenantId,
        userId: user.id,
        format: input.format,
      });

      return {
        success: false,
        message: 'Failed to export logs',
        errors: [{
          message: this.getErrorMessage(error),
          code: 'LOG_EXPORT_FAILED',
          timestamp: new Date(),
        }],
      };
    }
  }

  @Mutation(() => LogMutationResponseType, { description: 'Configure log retention policy' })
  @RequirePermission('logs:admin')
  async setLogRetentionPolicy(
    @Args('input') input: LogRetentionPolicyInput,
    @CurrentUser() user: any,
    @Context() context: any,
  ): Promise<LogMutationResponseType> {
    const tenantId = input.tenantId || this.getCurrentTenantId(context);

    try {
      await this.analyticsService.setRetentionPolicy(input, tenantId);
      
      this.loggerService.audit(
        'log_retention_policy_updated',
        {
          updatedBy: user.id,
          retentionDays: input.retentionDays,
          categories: input.categories,
          levels: input.levels,
          archiveBeforeDelete: input.archiveBeforeDelete,
        },
        {
          tenantId,
          userId: user.id,
        },
      );

      return {
        success: true,
        message: 'Log retention policy updated successfully',
      };
    } catch (error) {
      this.loggerService.graphqlError('setLogRetentionPolicy', error as Error, ['setLogRetentionPolicy'], {
        tenantId,
        userId: user.id,
      });

      return {
        success: false,
        message: 'Failed to update log retention policy',
        errors: [{
          message: this.getErrorMessage(error),
          code: 'RETENTION_POLICY_UPDATE_FAILED',
          timestamp: new Date(),
        }],
      };
    }
  }

  // Subscriptions
  @Subscription(() => LogSubscriptionPayloadType, {
    description: 'Subscribe to real-time log events',
    filter: (payload, variables, context) => {
      const tenantId = context.req.user?.tenantId;
      return payload.log.tenantId === tenantId;
    },
  })
  @RequirePermission('logs:subscribe')
  logStream(
    @Args() args: LogStreamArgs,
    @Context() context: any,
  ): AsyncIterator<LogSubscriptionPayloadType> {
    const tenantId = this.getCurrentTenantId(context);
    const subscriptionId = args.subscriptionId || `log_stream_${Date.now()}`;

    this.loggerService.audit(
      'log_stream_subscription_started',
      {
        subscriptionId,
        filters: args.filters,
        bufferSize: args.bufferSize,
      },
      {
        tenantId,
        userId: context.req.user?.id,
      },
    );

    return this.streamService.createLogStream(args, tenantId, subscriptionId);
  }

  @Subscription(() => MetricsSubscriptionPayloadType, {
    description: 'Subscribe to real-time metrics updates',
  })
  @RequirePermission('logs:metrics')
  metricsStream(
    @Args('tenantId', { nullable: true }) tenantId: string,
    @Context() context: any,
  ): AsyncIterator<MetricsSubscriptionPayloadType> {
    const actualTenantId = tenantId || this.getCurrentTenantId(context);

    return (this.pubSub as any).asyncIterator(`metrics_${actualTenantId}`) as AsyncIterator<MetricsSubscriptionPayloadType>;
  }

  @Subscription(() => AlertSubscriptionPayloadType, {
    description: 'Subscribe to log-based alerts and notifications',
  })
  @RequirePermission('logs:alerts')
  alertStream(
    @Args('severity', { nullable: true }) severity: string,
    @Context() context: any,
  ): AsyncIterator<AlertSubscriptionPayloadType> {
    const tenantId = this.getCurrentTenantId(context);

    return this.alertService.createAlertStream(tenantId, severity);
  }
}