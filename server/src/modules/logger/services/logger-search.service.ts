import { Injectable } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { CustomLoggerService, LogLevel, LogCategory } from '../logger.service';
import { 
  LogSearchArgs, 
  LogConnectionArgs, 
  LogFilterInput 
} from '../inputs/logger.input';
import { 
  LogConnectionType, 
  LogSearchResultType, 
  LogEntryType,
  AuditLogEntryType,
  SecurityLogEntryType,
  PerformanceLogEntryType,
  BusinessLogEntryType,
} from '../types/logger.types';

@Injectable()
export class LoggerSearchService {
  constructor(
    private readonly cacheService: IntelligentCacheService,
    private readonly loggerService: CustomLoggerService,
  ) {
    this.loggerService.setContext('LoggerSearchService');
  }

  async getLogConnection(
    args: LogConnectionArgs,
    tenantId: string,
  ): Promise<LogConnectionType> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey('connection', tenantId, args);
      
      // Try cache first
      const cached = await this.cacheService.get<LogConnectionType>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      this.loggerService.cache('get', cacheKey, false, { tenantId });

      // Parse pagination arguments
      const { limit, cursor, isForward } = this.parsePaginationArgs(args);
      
      // Apply filters
      const filters = this.buildFilters(args.filters, tenantId);
      
      // Execute search (mock implementation)
      const { logs, totalCount, hasNextPage, hasPreviousPage } = await this.executeLogSearch(
        filters,
        limit,
        cursor,
        isForward,
      );

      // Create edges and page info
      const edges = logs.map((log, index) => ({
        cursor: this.encodeCursor(log.id),
        node: log,
      }));

      const pageInfo = {
        hasNextPage,
        hasPreviousPage,
        startCursor: edges.length > 0 ? (edges[0]?.cursor ?? null) : null,
        endCursor: edges.length > 0 ? (edges[edges.length - 1]?.cursor ?? null) : null,
      };

      const result: LogConnectionType = {
        edges,
        pageInfo,
        totalCount,
      };

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, result, { ttl: 120, tenantId });

      this.loggerService.performance(
        'get_log_connection',
        Date.now() - startTime,
        { 
          tenantId, 
          resultCount: edges.length, 
          totalCount,
          hasFilters: !!args.filters,
        },
      );

      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.loggerService.error(
        'Failed to get log connection',
        errorObj.stack,
        { tenantId, args: JSON.stringify(args), error: errorObj.message },
      );
      throw error;
    }
  }

  async searchLogs(
    args: LogSearchArgs,
    tenantId: string,
  ): Promise<LogSearchResultType> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey('search', tenantId, args);
      
      // Try cache first
      const cached = await this.cacheService.get<LogSearchResultType>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      this.loggerService.cache('get', cacheKey, false, { tenantId });

      // Build search query
      const searchQuery = this.buildSearchQuery(args.query, args.filters, tenantId);
      
      // Execute full-text search
      const { logs, totalCount } = await this.executeFullTextSearch(
        searchQuery,
        args.limit || 20,
        args.offset || 0,
        args.sortBy,
        args.sortOrder,
      );

      // Generate search suggestions
      const suggestions = await this.generateSearchSuggestions(args.query, tenantId);
      
      // Calculate metrics for search results
      const metrics = this.calculateSearchMetrics(logs);

      const result: LogSearchResultType = {
        logs,
        totalCount,
        metrics,
        suggestions,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, result, { ttl: 300, tenantId });

      this.loggerService.performance(
        'search_logs',
        Date.now() - startTime,
        { 
          tenantId, 
          query: args.query,
          resultCount: logs.length, 
          totalCount,
        },
      );

      // Log search analytics
      this.loggerService.business(
        'log_search_performed',
        {
          query: args.query,
          resultCount: logs.length,
          totalCount,
          hasFilters: !!args.filters,
          executionTime: Date.now() - startTime,
        },
        { tenantId },
      );

      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.loggerService.error(
        'Failed to search logs',
        errorObj.stack,
        { tenantId, query: args.query, error: errorObj.message },
      );
      throw error;
    }
  }

  async getAuditLogs(
    args: LogConnectionArgs,
    tenantId: string,
  ): Promise<AuditLogEntryType[]> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey('audit', tenantId, args);
      
      const cached = await this.cacheService.get<AuditLogEntryType[]>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      // Build audit-specific filters
      const filters = {
        ...this.buildFilters(args.filters, tenantId),
        category: 'audit',
      };

      // Execute audit log search
      const { logs } = await this.executeLogSearch(filters, 100, null, true);
      
      // Transform to audit log entries
      const auditLogs = logs.map(log => this.transformToAuditLog(log));

      // Cache for 10 minutes (audit logs change less frequently)
      await this.cacheService.set(cacheKey, auditLogs, { ttl: 600, tenantId });

      this.loggerService.performance(
        'get_audit_logs',
        Date.now() - startTime,
        { tenantId, resultCount: auditLogs.length },
      );

      return auditLogs;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.loggerService.error(
        'Failed to get audit logs',
        errorObj.stack,
        { tenantId, error: errorObj.message },
      );
      throw error;
    }
  }

  async getSecurityLogs(
    args: LogConnectionArgs,
    tenantId: string,
  ): Promise<SecurityLogEntryType[]> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey('security', tenantId, args);
      
      const cached = await this.cacheService.get<SecurityLogEntryType[]>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      // Build security-specific filters
      const filters = {
        ...this.buildFilters(args.filters, tenantId),
        category: 'security',
      };

      // Execute security log search
      const { logs } = await this.executeLogSearch(filters, 100, null, true);
      
      // Transform to security log entries
      const securityLogs = logs.map(log => this.transformToSecurityLog(log));

      // Cache for 5 minutes (security logs need fresher data)
      await this.cacheService.set(cacheKey, securityLogs, { ttl: 300, tenantId });

      this.loggerService.performance(
        'get_security_logs',
        Date.now() - startTime,
        { tenantId, resultCount: securityLogs.length },
      );

      return securityLogs;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.loggerService.error(
        'Failed to get security logs',
        errorObj.stack,
        { tenantId, error: errorObj.message },
      );
      throw error;
    }
  }

  async getPerformanceLogs(
    args: LogConnectionArgs,
    tenantId: string,
  ): Promise<PerformanceLogEntryType[]> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey('performance', tenantId, args);
      
      const cached = await this.cacheService.get<PerformanceLogEntryType[]>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      // Build performance-specific filters
      const filters = {
        ...this.buildFilters(args.filters, tenantId),
        category: 'performance',
      };

      // Execute performance log search
      const { logs } = await this.executeLogSearch(filters, 100, null, true);
      
      // Transform to performance log entries
      const performanceLogs = logs.map(log => this.transformToPerformanceLog(log));

      // Cache for 3 minutes
      await this.cacheService.set(cacheKey, performanceLogs, { ttl: 180, tenantId });

      this.loggerService.performance(
        'get_performance_logs',
        Date.now() - startTime,
        { tenantId, resultCount: performanceLogs.length },
      );

      return performanceLogs;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.loggerService.error(
        'Failed to get performance logs',
        errorObj.stack,
        { tenantId, error: errorObj.message },
      );
      throw error;
    }
  }

  async getBusinessLogs(
    args: LogConnectionArgs,
    tenantId: string,
  ): Promise<BusinessLogEntryType[]> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey('business', tenantId, args);
      
      const cached = await this.cacheService.get<BusinessLogEntryType[]>(cacheKey);
      if (cached) {
        this.loggerService.cache('get', cacheKey, true, { tenantId });
        return cached;
      }

      // Build business-specific filters
      const filters = {
        ...this.buildFilters(args.filters, tenantId),
        category: 'business',
      };

      // Execute business log search
      const { logs } = await this.executeLogSearch(filters, 100, null, true);
      
      // Transform to business log entries
      const businessLogs = logs.map(log => this.transformToBusinessLog(log));

      // Cache for 15 minutes
      await this.cacheService.set(cacheKey, businessLogs, { ttl: 900, tenantId });

      this.loggerService.performance(
        'get_business_logs',
        Date.now() - startTime,
        { tenantId, resultCount: businessLogs.length },
      );

      return businessLogs;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.loggerService.error(
        'Failed to get business logs',
        errorObj.stack,
        { tenantId, error: errorObj.message },
      );
      throw error;
    }
  }

  private generateCacheKey(type: string, tenantId: string, args: any): string {
    const argsHash = Buffer.from(JSON.stringify(args)).toString('base64').slice(0, 16);
    return `log_${type}:${tenantId}:${argsHash}`;
  }

  private parsePaginationArgs(args: LogConnectionArgs) {
    const { first, after, last, before } = args;

    if (first && last) {
      throw new Error('Cannot specify both first and last');
    }

    if (after && before) {
      throw new Error('Cannot specify both after and before');
    }

    const limit = Math.min(first || last || 20, 100);
    const isForward = !!first || (!first && !last);
    const cursor = (isForward ? after : before) ?? null;

    return { limit, cursor, isForward };
  }

  private buildFilters(filters: LogFilterInput | undefined, tenantId: string): any {
    const baseFilters = { tenantId };
    
    if (!filters) return baseFilters;

    return {
      ...baseFilters,
      ...(filters.level && { level: filters.level }),
      ...(filters.category && { category: filters.category }),
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.operation && { operation: filters.operation }),
      ...(filters.context && { context: filters.context }),
      ...(filters.correlationId && { correlationId: filters.correlationId }),
      ...(filters.graphqlOperation && { graphqlOperation: filters.graphqlOperation }),
      ...(filters.graphqlOperationType && { graphqlOperationType: filters.graphqlOperationType }),
      ...(filters.startTime && { startTime: filters.startTime }),
      ...(filters.endTime && { endTime: filters.endTime }),
      ...(filters.minDuration && { minDuration: filters.minDuration }),
      ...(filters.maxDuration && { maxDuration: filters.maxDuration }),
      ...(filters.ipAddress && { ipAddress: filters.ipAddress }),
      ...(filters.sessionId && { sessionId: filters.sessionId }),
      ...(filters.tags && { tags: filters.tags }),
    };
  }

  private buildSearchQuery(query: string, filters: LogFilterInput | undefined, tenantId: string): any {
    return {
      query,
      filters: this.buildFilters(filters, tenantId),
      searchFields: ['message', 'context', 'operation', 'graphqlOperation'],
      highlightFields: ['message'],
    };
  }

  private async executeLogSearch(
    filters: any,
    limit: number,
    cursor: string | null,
    isForward: boolean,
  ): Promise<{ logs: LogEntryType[]; totalCount: number; hasNextPage: boolean; hasPreviousPage: boolean }> {
    // Mock implementation - in production, this would query Elasticsearch or similar
    const mockLogs = this.generateMockLogs(limit, filters);
    
    return {
      logs: mockLogs,
      totalCount: Math.floor(Math.random() * 10000) + 1000,
      hasNextPage: Math.random() > 0.5,
      hasPreviousPage: !!cursor,
    };
  }

  private async executeFullTextSearch(
    searchQuery: any,
    limit: number,
    offset: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<{ logs: LogEntryType[]; totalCount: number }> {
    // Mock implementation - in production, this would use Elasticsearch
    const mockLogs = this.generateMockLogs(limit, searchQuery.filters);
    
    return {
      logs: mockLogs,
      totalCount: Math.floor(Math.random() * 5000) + 500,
    };
  }

  private async generateSearchSuggestions(query: string, tenantId: string): Promise<string[]> {
    // Mock suggestions based on query
    const suggestions = [
      `${query} error`,
      `${query} performance`,
      `${query} security`,
      `operation:${query}`,
      `level:error ${query}`,
    ];
    
    return suggestions.slice(0, 5);
  }

  private calculateSearchMetrics(logs: LogEntryType[]): any {
    const errorCount = logs.filter(log => log.level === LogLevel.ERROR).length;
    const warningCount = logs.filter(log => log.level === LogLevel.WARN).length;
    const avgDuration = logs
      .filter(log => log.duration)
      .reduce((sum, log) => sum + (log.duration || 0), 0) / logs.length || 0;

    return {
      totalLogs: logs.length,
      errorCount,
      warningCount,
      performanceIssues: logs.filter(log => (log.duration || 0) > 1000).length,
      securityEvents: logs.filter(log => log.category === LogCategory.SECURITY).length,
      auditEvents: logs.filter(log => log.category === LogCategory.AUDIT).length,
      averageResponseTime: avgDuration,
      slowQueries: logs.filter(log => (log.duration || 0) > 500).length,
      graphqlErrors: logs.filter(log => log.graphqlOperation && log.level === LogLevel.ERROR).length,
    };
  }

  private generateMockLogs(count: number, filters: any): LogEntryType[] {
    const levels: LogLevel[] = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const categories: LogCategory[] = [LogCategory.GRAPHQL, LogCategory.SECURITY, LogCategory.PERFORMANCE, LogCategory.AUDIT, LogCategory.BUSINESS, LogCategory.SYSTEM];
    
    return Array.from({ length: count }, (_, i) => {
      const log = {
        id: `log_${Date.now()}_${i}`,
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        level: levels[Math.floor(Math.random() * levels.length)] as LogLevel,
        category: categories[Math.floor(Math.random() * categories.length)] as LogCategory,
        message: `Mock log message ${i + 1}`,
        context: `MockContext${Math.floor(Math.random() * 5) + 1}`,
        tenantId: filters.tenantId,
        userId: `user_${Math.floor(Math.random() * 100) + 1}`,
        requestId: `req_${Date.now()}_${i}`,
        correlationId: `corr_${Date.now()}_${i}`,
        operation: `mock_operation_${Math.floor(Math.random() * 10) + 1}`,
        duration: Math.floor(Math.random() * 2000) + 50,
        graphqlOperation: Math.random() > 0.5 ? `mockQuery${Math.floor(Math.random() * 5) + 1}` : undefined,
        graphqlOperationType: Math.random() > 0.5 ? (['query', 'mutation', 'subscription'][Math.floor(Math.random() * 3)]) : undefined,
        graphqlPath: Math.random() > 0.7 ? [`field${Math.floor(Math.random() * 3) + 1}`] : undefined,
        graphqlVariables: Math.random() > 0.6 ? { mockVar: 'mockValue' } : undefined,
        graphqlComplexity: Math.random() > 0.8 ? Math.floor(Math.random() * 100) + 10 : undefined,
        graphqlDepth: Math.random() > 0.8 ? Math.floor(Math.random() * 10) + 1 : undefined,
        sessionId: `session_${Math.floor(Math.random() * 50) + 1}`,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255) + 1}`,
        userAgent: 'MockUserAgent/1.0',
        metadata: { mockKey: 'mockValue' },
      } as LogEntryType;
      return log;
    });
  }

  private transformToAuditLog(log: LogEntryType): AuditLogEntryType {
    return {
      ...log,
      auditId: `audit_${log.id}`,
      event: `audit_event_${Math.floor(Math.random() * 10) + 1}`,
      details: { auditDetail: 'mockValue' },
      entityType: Math.random() > 0.5 ? 'User' : 'Order',
      entityId: `entity_${Math.floor(Math.random() * 100) + 1}`,
      previousValue: Math.random() > 0.5 ? 'oldValue' : undefined,
      newValue: Math.random() > 0.5 ? 'newValue' : undefined,
    } as AuditLogEntryType;
  }

  private transformToSecurityLog(log: LogEntryType): SecurityLogEntryType {
    return {
      ...log,
      securityId: `sec_${log.id}`,
      event: `security_event_${Math.floor(Math.random() * 5) + 1}`,
      severity: (['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)]) || 'medium',
      details: { securityDetail: 'mockValue' },
      threatLevel: Math.random() > 0.5 ? 'elevated' : 'normal',
      sourceIp: log.ipAddress,
      userAgent: log.userAgent || 'Unknown',
    } as SecurityLogEntryType;
  }

  private transformToPerformanceLog(log: LogEntryType): PerformanceLogEntryType {
    return {
      ...log,
      operation: log.operation || 'unknown_operation',
      duration: log.duration || 0,
      performanceCategory: log.duration && log.duration > 1000 ? 'slow' : 'normal',
      isSlowQuery: (log.duration || 0) > 500,
      queryComplexity: log.graphqlComplexity,
      cacheHitRate: Math.random() > 0.5 ? Math.floor(Math.random() * 100) : undefined,
    } as PerformanceLogEntryType;
  }

  private transformToBusinessLog(log: LogEntryType): BusinessLogEntryType {
    return {
      ...log,
      businessId: `biz_${log.id}`,
      businessEvent: `business_event_${Math.floor(Math.random() * 10) + 1}`,
      businessDetails: { businessDetail: 'mockValue' },
      businessUnit: Math.random() > 0.5 ? 'Sales' : 'Marketing',
      revenue: Math.random() > 0.7 ? Math.floor(Math.random() * 10000) + 100 : undefined,
      customerImpact: Math.random() > 0.6 ? 'positive' : undefined,
    } as BusinessLogEntryType;
  }

  private encodeCursor(value: string): string {
    return Buffer.from(value).toString('base64');
  }

  private decodeCursor(cursor: string): string {
    try {
      return Buffer.from(cursor, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error('Invalid cursor');
    }
  }
}