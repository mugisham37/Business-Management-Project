import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface LogContext {
  tenantId?: string | undefined;
  userId?: string | undefined;
  requestId?: string | undefined;
  operation?: string | undefined;
  duration?: number | undefined;
  graphqlOperation?: string | undefined;
  graphqlOperationType?: 'query' | 'mutation' | 'subscription' | undefined;
  graphqlPath?: string[] | undefined;
  graphqlVariables?: Record<string, unknown> | undefined;
  graphqlComplexity?: number | undefined;
  graphqlDepth?: number | undefined;
  correlationId?: string | undefined;
  sessionId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  [key: string]: unknown;
}

export interface LogMetrics {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  performanceIssues: number;
  securityEvents: number;
  auditEvents: number;
  averageResponseTime: number;
  slowQueries: number;
  graphqlErrors: number;
}

export interface LogAnalytics {
  topOperations: Array<{ operation: string; count: number; avgDuration: number }>;
  errorPatterns: Array<{ pattern: string; count: number; lastOccurrence: Date }>;
  performanceTrends: Array<{ timestamp: Date; avgDuration: number; operationCount: number }>;
  securityAlerts: Array<{ type: string; count: number; severity: 'low' | 'medium' | 'high' | 'critical' }>;
  tenantActivity: Array<{ tenantId: string; logCount: number; errorRate: number }>;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export enum LogCategory {
  GRAPHQL = 'graphql',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  AUDIT = 'audit',
  BUSINESS = 'business',
  SYSTEM = 'system',
  DATABASE = 'database',
  CACHE = 'cache',
  INTEGRATION = 'integration',
}

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLoggerService implements LoggerService {
  private context?: string;
  private readonly logLevel: string;
  private readonly logMetrics: Map<string, LogMetrics> = new Map();
  private readonly logBuffer: Array<any> = [];
  private readonly maxBufferSize: number = 1000;
  private readonly flushInterval: number = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    this.initializeMetrics();
    this.startPeriodicFlush();
  }

  private initializeMetrics(): void {
    const defaultMetrics: LogMetrics = {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      performanceIssues: 0,
      securityEvents: 0,
      auditEvents: 0,
      averageResponseTime: 0,
      slowQueries: 0,
      graphqlErrors: 0,
    };
    this.logMetrics.set('global', defaultMetrics);
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  private flushLogs(): void {
    if (this.logBuffer.length > 0) {
      // In production, send to external logging service
      this.eventEmitter.emit('logs.batch', {
        logs: [...this.logBuffer],
        timestamp: new Date(),
        count: this.logBuffer.length,
      });
      this.logBuffer.length = 0;
    }
  }

  setContext(context: string): void {
    this.context = context;
  }

  getContext(): string | undefined {
    return this.context;
  }

  log(message: string, context?: LogContext): void {
    this.printMessage(LogLevel.INFO, message, context, LogCategory.SYSTEM);
  }

  error(message: string, trace?: string, context?: LogContext): void {
    this.printMessage(LogLevel.ERROR, message, { ...context, trace }, LogCategory.SYSTEM);
    this.updateMetrics('errorCount');
  }

  warn(message: string, context?: LogContext): void {
    this.printMessage(LogLevel.WARN, message, context, LogCategory.SYSTEM);
    this.updateMetrics('warningCount');
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.printMessage(LogLevel.DEBUG, message, context, LogCategory.SYSTEM);
    }
  }

  verbose(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      this.printMessage(LogLevel.VERBOSE, message, context, LogCategory.SYSTEM);
    }
  }

  // GraphQL-specific logging methods
  graphqlQuery(
    operationName: string,
    query: string,
    variables: Record<string, unknown>,
    context?: LogContext,
  ): void {
    this.printMessage(
      LogLevel.INFO,
      `GraphQL Query: ${operationName}`,
      {
        ...context,
        graphqlOperation: operationName,
        graphqlOperationType: 'query',
        graphqlVariables: variables,
        query: this.sanitizeQuery(query),
      },
      LogCategory.GRAPHQL,
    );
  }

  graphqlMutation(
    operationName: string,
    mutation: string,
    variables: Record<string, unknown>,
    context?: LogContext,
  ): void {
    this.printMessage(
      LogLevel.INFO,
      `GraphQL Mutation: ${operationName}`,
      {
        ...context,
        graphqlOperation: operationName,
        graphqlOperationType: 'mutation',
        graphqlVariables: this.sanitizeVariables(variables),
        mutation: this.sanitizeQuery(mutation),
      },
      LogCategory.GRAPHQL,
    );
  }

  graphqlSubscription(
    operationName: string,
    subscription: string,
    variables: Record<string, unknown>,
    context?: LogContext,
  ): void {
    this.printMessage(
      LogLevel.INFO,
      `GraphQL Subscription: ${operationName}`,
      {
        ...context,
        graphqlOperation: operationName,
        graphqlOperationType: 'subscription',
        graphqlVariables: this.sanitizeVariables(variables),
        subscription: this.sanitizeQuery(subscription),
      },
      LogCategory.GRAPHQL,
    );
  }

  graphqlError(
    operationName: string,
    error: any,
    path?: string[],
    context?: LogContext,
  ): void {
    this.printMessage(
      LogLevel.ERROR,
      `GraphQL Error in ${operationName}: ${error.message}`,
      {
        ...context,
        graphqlOperation: operationName,
        graphqlPath: path,
        errorCode: error.extensions?.code,
        errorType: error.constructor.name,
        stackTrace: error.stack,
      },
      LogCategory.GRAPHQL,
    );
    this.updateMetrics('graphqlErrors');
  }

  graphqlComplexity(
    operationName: string,
    complexity: number,
    maxComplexity: number,
    context?: LogContext,
  ): void {
    const level = complexity > maxComplexity * 0.8 ? LogLevel.WARN : LogLevel.DEBUG;
    this.printMessage(
      level,
      `GraphQL Complexity: ${operationName} (${complexity}/${maxComplexity})`,
      {
        ...context,
        graphqlOperation: operationName,
        graphqlComplexity: complexity,
        maxComplexity,
        complexityRatio: complexity / maxComplexity,
      },
      LogCategory.PERFORMANCE,
    );
  }

  // Enhanced audit logging
  audit(event: string, details: Record<string, unknown>, context?: LogContext): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      event,
      details: this.sanitizeAuditDetails(details),
      ...context,
      auditId: this.generateAuditId(),
    };
    
    this.printMessage(LogLevel.INFO, `Audit: ${event}`, auditEntry, LogCategory.AUDIT);
    this.updateMetrics('auditEvents');
    
    // Emit audit event for external processing
    this.eventEmitter.emit('audit.event', auditEntry);
  }

  // Enhanced performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    const isSlowQuery = duration > 1000; // 1 second threshold
    const level = isSlowQuery ? LogLevel.WARN : LogLevel.INFO;
    
    this.printMessage(
      level,
      `Performance: ${operation} completed in ${duration}ms`,
      {
        ...context,
        operation,
        duration,
        type: 'performance',
        isSlowQuery,
        performanceCategory: this.categorizePerformance(duration),
      },
      LogCategory.PERFORMANCE,
    );

    if (isSlowQuery) {
      this.updateMetrics('slowQueries');
      this.updateMetrics('performanceIssues');
    }

    this.updateAverageResponseTime(duration);
  }

  // Enhanced security logging
  security(event: string, details: Record<string, unknown>, context?: LogContext): void {
    const severity = this.determineSeverity(event, details);
    const securityEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      event,
      details: this.sanitizeSecurityDetails(details),
      severity,
      ...context,
      securityId: this.generateSecurityId(),
    };
    
    this.printMessage(LogLevel.WARN, `Security: ${event}`, securityEntry, LogCategory.SECURITY);
    this.updateMetrics('securityEvents');
    
    // Emit security event for immediate processing
    this.eventEmitter.emit('security.event', securityEntry);
    
    // Critical security events trigger immediate alerts
    if (severity === 'critical') {
      this.eventEmitter.emit('security.critical', securityEntry);
    }
  }

  // Business logic logging
  business(event: string, details: Record<string, unknown>, context?: LogContext): void {
    this.printMessage(
      LogLevel.INFO,
      `Business Event: ${event}`,
      {
        ...context,
        businessEvent: event,
        businessDetails: details,
        businessId: this.generateBusinessId(),
      },
      LogCategory.BUSINESS,
    );
    
    this.eventEmitter.emit('business.event', {
      event,
      details,
      context,
      timestamp: new Date(),
    });
  }

  // Database operation logging
  database(operation: string, table: string, duration: number, context?: LogContext): void {
    const level = duration > 500 ? LogLevel.WARN : LogLevel.DEBUG;
    this.printMessage(
      level,
      `Database: ${operation} on ${table} (${duration}ms)`,
      {
        ...context,
        databaseOperation: operation,
        table,
        duration,
        isSlowQuery: duration > 500,
      },
      LogCategory.DATABASE,
    );
  }

  // Cache operation logging
  cache(operation: string, key: string, hit: boolean, context?: LogContext): void {
    this.printMessage(
      LogLevel.DEBUG,
      `Cache: ${operation} ${key} (${hit ? 'HIT' : 'MISS'})`,
      {
        ...context,
        cacheOperation: operation,
        cacheKey: key,
        cacheHit: hit,
      },
      LogCategory.CACHE,
    );
  }

  // Integration logging
  integration(
    service: string,
    operation: string,
    success: boolean,
    duration: number,
    context?: LogContext,
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this.printMessage(
      level,
      `Integration: ${service}.${operation} ${success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`,
      {
        ...context,
        integrationService: service,
        integrationOperation: operation,
        integrationSuccess: success,
        duration,
      },
      LogCategory.INTEGRATION,
    );
  }

  // Metrics and analytics
  getMetrics(tenantId?: string): LogMetrics {
    const key = tenantId || 'global';
    return this.logMetrics.get(key) || this.logMetrics.get('global')!;
  }

  getAnalytics(tenantId?: string, timeRange?: { start: Date; end: Date }): LogAnalytics {
    // In a real implementation, this would query a time-series database
    // For now, return mock analytics
    return {
      topOperations: [],
      errorPatterns: [],
      performanceTrends: [],
      securityAlerts: [],
      tenantActivity: [],
    };
  }

  // Log search and filtering
  searchLogs(
    query: string,
    filters?: {
      level?: LogLevel;
      category?: LogCategory;
      tenantId?: string;
      timeRange?: { start: Date; end: Date };
    },
  ): Promise<any[]> {
    // In a real implementation, this would query a log aggregation service
    return Promise.resolve([]);
  }

  // Real-time log streaming
  streamLogs(filters?: {
    level?: LogLevel;
    category?: LogCategory;
    tenantId?: string;
  }): AsyncIterableIterator<any> {
    // Implementation would use WebSockets or Server-Sent Events
    return this.createLogStream(filters);
  }

  private async* createLogStream(filters?: any): AsyncIterableIterator<any> {
    // Mock implementation - in reality, this would connect to a real-time log stream
    while (true) {
      yield { message: 'Mock log entry', timestamp: new Date() };
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.VERBOSE];
    const currentLevelIndex = levels.indexOf(this.logLevel as LogLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  printMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
    category: LogCategory = LogCategory.SYSTEM,
  ): void {
    const timestamp = new Date().toISOString();
    const correlationId = context?.correlationId || this.generateCorrelationId();
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category,
      context: this.context,
      message,
      correlationId,
      ...context,
    };

    // Add to buffer for batch processing
    this.logBuffer.push(logEntry);
    
    // Flush buffer if it's getting full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushLogs();
    }

    // Console output for development
    if (process.env.NODE_ENV !== 'production') {
      this.outputToConsole(level, logEntry);
    }

    this.updateMetrics('totalLogs');
    
    // Emit real-time log event
    this.eventEmitter.emit('log.entry', logEntry);
  }

  private outputToConsole(level: LogLevel, logEntry: any): void {
    const formattedEntry = JSON.stringify(logEntry, null, 2);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedEntry);
        break;
      case LogLevel.WARN:
        console.warn(formattedEntry);
        break;
      default:
        console.log(formattedEntry);
    }
  }

  private updateMetrics(metric: keyof LogMetrics, tenantId?: string): void {
    const key = tenantId || 'global';
    const metrics = this.logMetrics.get(key) || { ...this.logMetrics.get('global')! };
    
    if (typeof metrics[metric] === 'number') {
      (metrics[metric] as number)++;
    }
    
    this.logMetrics.set(key, metrics);
  }

  private updateAverageResponseTime(duration: number, tenantId?: string): void {
    const key = tenantId || 'global';
    const metrics = this.logMetrics.get(key) || { ...this.logMetrics.get('global')! };
    
    // Simple moving average calculation
    const currentAvg = metrics.averageResponseTime;
    const totalLogs = metrics.totalLogs;
    metrics.averageResponseTime = (currentAvg * (totalLogs - 1) + duration) / totalLogs;
    
    this.logMetrics.set(key, metrics);
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from GraphQL queries
    return query.replace(/password:\s*"[^"]*"/gi, 'password: "[REDACTED]"')
                .replace(/token:\s*"[^"]*"/gi, 'token: "[REDACTED]"');
  }

  private sanitizeVariables(variables: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...variables };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private sanitizeAuditDetails(details: Record<string, unknown>): Record<string, unknown> {
    return this.sanitizeVariables(details);
  }

  private sanitizeSecurityDetails(details: Record<string, unknown>): Record<string, unknown> {
    return this.sanitizeVariables(details);
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'fast';
    if (duration < 500) return 'normal';
    if (duration < 1000) return 'slow';
    return 'very_slow';
  }

  private determineSeverity(event: string, details: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
    const criticalEvents = ['unauthorized_access', 'data_breach', 'privilege_escalation'];
    const highEvents = ['failed_login_attempts', 'suspicious_activity', 'permission_denied'];
    const mediumEvents = ['rate_limit_exceeded', 'invalid_token', 'session_expired'];
    
    if (criticalEvents.some(e => event.includes(e))) return 'critical';
    if (highEvents.some(e => event.includes(e))) return 'high';
    if (mediumEvents.some(e => event.includes(e))) return 'medium';
    return 'low';
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSecurityId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBusinessId(): string {
    return `biz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup method
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushLogs();
  }
}