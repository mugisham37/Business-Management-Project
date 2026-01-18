import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CustomLoggerService, LogLevel, LogCategory } from '../logger.service';
import {
  LOG_LEVEL_KEY,
  LOG_CATEGORY_KEY,
  LOG_OPERATION_KEY,
  LOG_SENSITIVE_KEY,
  LOG_PERFORMANCE_KEY,
  LOG_AUDIT_KEY,
  LOG_SECURITY_KEY,
  LOG_BUSINESS_KEY,
} from '../decorators/logger.decorators';

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: CustomLoggerService,
    private readonly reflector: Reflector,
  ) {
    this.logger.setContext('LoggerInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const ctx = gqlContext.getContext();
    const args = gqlContext.getArgs();
    
    // Extract metadata from decorators
    const logLevel = this.reflector.get<LogLevel>(LOG_LEVEL_KEY, context.getHandler()) ||
                    this.reflector.get<LogLevel>(LOG_LEVEL_KEY, context.getClass()) ||
                    LogLevel.INFO;
    
    const logCategory = this.reflector.get<LogCategory>(LOG_CATEGORY_KEY, context.getHandler()) ||
                       this.reflector.get<LogCategory>(LOG_CATEGORY_KEY, context.getClass()) ||
                       LogCategory.GRAPHQL;
    
    const operation = this.reflector.get<string>(LOG_OPERATION_KEY, context.getHandler()) ||
                     this.reflector.get<string>(LOG_OPERATION_KEY, context.getClass()) ||
                     info?.fieldName ||
                     'unknown_operation';
    
    const sensitiveFields = this.reflector.get<string[] | boolean>(LOG_SENSITIVE_KEY, context.getHandler()) ||
                           this.reflector.get<string[] | boolean>(LOG_SENSITIVE_KEY, context.getClass());
    
    const performanceThreshold = this.reflector.get<number>(LOG_PERFORMANCE_KEY, context.getHandler()) ||
                                this.reflector.get<number>(LOG_PERFORMANCE_KEY, context.getClass());
    
    const auditEvent = this.reflector.get<string | boolean>(LOG_AUDIT_KEY, context.getHandler()) ||
                      this.reflector.get<string | boolean>(LOG_AUDIT_KEY, context.getClass());
    
    const securityEvent = this.reflector.get<string | boolean>(LOG_SECURITY_KEY, context.getHandler()) ||
                         this.reflector.get<string | boolean>(LOG_SECURITY_KEY, context.getClass());
    
    const businessEvent = this.reflector.get<string | boolean>(LOG_BUSINESS_KEY, context.getHandler()) ||
                         this.reflector.get<string | boolean>(LOG_BUSINESS_KEY, context.getClass());

    // Build log context
    const logContext = this.buildLogContext(ctx, info, operation, startTime);
    
    // Log method entry
    this.logMethodEntry(logLevel, logCategory, operation, args, logContext, sensitiveFields);
    
    // Log audit event if enabled
    if (auditEvent) {
      this.logAuditEvent(auditEvent, operation, args, logContext, sensitiveFields);
    }
    
    // Log security event if enabled
    if (securityEvent) {
      this.logSecurityEvent(securityEvent, operation, args, logContext);
    }
    
    // Log business event if enabled
    if (businessEvent) {
      this.logBusinessEvent(businessEvent, operation, args, logContext);
    }

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        
        // Log method success
        this.logMethodSuccess(logLevel, logCategory, operation, result, duration, logContext, sensitiveFields);
        
        // Log performance if threshold exceeded
        if (performanceThreshold && duration > performanceThreshold) {
          this.logPerformanceIssue(operation, duration, performanceThreshold, logContext);
        }
        
        // Log GraphQL complexity if available
        if (info && logCategory === LogCategory.GRAPHQL) {
          this.logGraphQLComplexity(info, logContext);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Log method error
        this.logMethodError(operation, error, duration, logContext);
        
        // Log GraphQL error
        if (info && logCategory === LogCategory.GRAPHQL) {
          this.logGraphQLError(info, error, logContext);
        }
        
        return throwError(() => error);
      }),
    );
  }

  private buildLogContext(ctx: any, info: any, operation: string, startTime: number): any {
    const request = ctx.req;
    const user = request?.user;
    
    return {
      tenantId: user?.tenantId,
      userId: user?.id,
      requestId: request?.id || request?.headers?.['x-request-id'] || `req_${startTime}`,
      correlationId: request?.headers?.['x-correlation-id'] || `corr_${startTime}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: request?.sessionID || request?.headers?.['x-session-id'],
      ipAddress: request?.ip || request?.connection?.remoteAddress,
      userAgent: request?.headers?.['user-agent'],
      operation,
      graphqlOperation: info?.operation?.name?.value,
      graphqlOperationType: info?.operation?.operation,
      graphqlPath: info?.path ? [info.path.key] : undefined,
      graphqlFieldName: info?.fieldName,
      graphqlParentType: info?.parentType?.name,
      graphqlReturnType: info?.returnType?.toString(),
    };
  }

  private logMethodEntry(
    level: LogLevel,
    category: LogCategory,
    operation: string,
    args: any,
    context: any,
    sensitiveFields?: string[] | boolean,
  ): void {
    const sanitizedArgs = this.sanitizeData(args, sensitiveFields);
    
    this.logger.printMessage(
      level,
      `${category} operation started: ${operation}`,
      {
        ...context,
        args: sanitizedArgs,
        phase: 'entry',
      },
      category,
    );
  }

  private logMethodSuccess(
    level: LogLevel,
    category: LogCategory,
    operation: string,
    result: any,
    duration: number,
    context: any,
    sensitiveFields?: string[] | boolean,
  ): void {
    const sanitizedResult = this.sanitizeData(result, sensitiveFields);
    
    this.logger.printMessage(
      level,
      `${category} operation completed: ${operation}`,
      {
        ...context,
        duration,
        result: sanitizedResult,
        phase: 'success',
        performanceCategory: this.categorizePerformance(duration),
      },
      category,
    );
  }

  private logMethodError(
    operation: string,
    error: any,
    duration: number,
    context: any,
  ): void {
    this.logger.error(
      `Operation failed: ${operation}`,
      error.stack,
      {
        ...context,
        duration,
        error: error.message,
        errorType: error.constructor.name,
        errorCode: error.code || error.extensions?.code,
        phase: 'error',
      },
    );
  }

  private logPerformanceIssue(
    operation: string,
    duration: number,
    threshold: number,
    context: any,
  ): void {
    this.logger.performance(operation, duration, {
      ...context,
      threshold,
      exceedsThreshold: true,
      performanceIssue: true,
    });
  }

  private logGraphQLComplexity(info: any, context: any): void {
    // In a real implementation, you would calculate actual complexity
    // For now, we'll use a mock complexity calculation
    const mockComplexity = Math.floor(Math.random() * 100) + 10;
    const maxComplexity = 1000;
    
    if (mockComplexity > maxComplexity * 0.8) {
      this.logger.graphqlComplexity(
        info.operation?.name?.value || 'anonymous',
        mockComplexity,
        maxComplexity,
        context,
      );
    }
  }

  private logGraphQLError(info: any, error: any, context: any): void {
    this.logger.graphqlError(
      info.operation?.name?.value || 'anonymous',
      error,
      info.path ? [info.path.key] : undefined,
      context,
    );
  }

  private logAuditEvent(
    auditEvent: string | boolean,
    operation: string,
    args: any,
    context: any,
    sensitiveFields?: string[] | boolean,
  ): void {
    const event = typeof auditEvent === 'string' ? auditEvent : operation;
    const sanitizedArgs = this.sanitizeData(args, sensitiveFields);
    
    this.logger.audit(event, {
      operation,
      args: sanitizedArgs,
      timestamp: new Date(),
    }, context);
  }

  private logSecurityEvent(
    securityEvent: string | boolean,
    operation: string,
    args: any,
    context: any,
  ): void {
    const event = typeof securityEvent === 'string' ? securityEvent : `security_${operation}`;
    
    this.logger.security(event, {
      operation,
      args: this.sanitizeSecurityData(args),
      timestamp: new Date(),
      severity: this.determineSeverity(operation, args),
    }, context);
  }

  private logBusinessEvent(
    businessEvent: string | boolean,
    operation: string,
    args: any,
    context: any,
  ): void {
    const event = typeof businessEvent === 'string' ? businessEvent : `business_${operation}`;
    
    this.logger.business(event, {
      operation,
      args: this.sanitizeBusinessData(args),
      timestamp: new Date(),
    }, context);
  }

  private sanitizeData(data: any, sensitiveFields?: string[] | boolean): any {
    if (!sensitiveFields || !data) return data;
    
    if (typeof data !== 'object') return data;
    
    const fields = Array.isArray(sensitiveFields) 
      ? sensitiveFields 
      : ['password', 'token', 'secret', 'key', 'credential', 'ssn', 'creditCard'];
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeObject(item, fields));
    }
    
    return this.sanitizeObject(data, fields);
  }

  private sanitizeObject(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = { ...obj };
    
    for (const field of sensitiveFields) {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value, sensitiveFields);
      }
    }
    
    return sanitized;
  }

  private sanitizeSecurityData(data: any): any {
    const securitySensitiveFields = [
      'password', 'token', 'secret', 'key', 'credential', 'ssn', 'creditCard',
      'apiKey', 'authToken', 'refreshToken', 'sessionToken', 'privateKey',
    ];
    
    return this.sanitizeData(data, securitySensitiveFields);
  }

  private sanitizeBusinessData(data: any): any {
    const businessSensitiveFields = [
      'ssn', 'creditCard', 'bankAccount', 'taxId', 'personalId',
    ];
    
    return this.sanitizeData(data, businessSensitiveFields);
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'fast';
    if (duration < 500) return 'normal';
    if (duration < 1000) return 'slow';
    if (duration < 5000) return 'very_slow';
    return 'critical';
  }

  private determineSeverity(operation: string, args: any): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on operation type and arguments
    const criticalOperations = ['login', 'register', 'changePassword', 'deleteAccount'];
    const highOperations = ['updateProfile', 'createOrder', 'processPayment'];
    const mediumOperations = ['search', 'filter', 'export'];
    
    if (criticalOperations.some(op => operation.toLowerCase().includes(op))) {
      return 'critical';
    }
    
    if (highOperations.some(op => operation.toLowerCase().includes(op))) {
      return 'high';
    }
    
    if (mediumOperations.some(op => operation.toLowerCase().includes(op))) {
      return 'medium';
    }
    
    return 'low';
  }
}

@Injectable()
export class GraphQLLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('GraphQLLoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const ctx = gqlContext.getContext();
    const args = gqlContext.getArgs();
    
    if (!info) {
      return next.handle();
    }

    const startTime = Date.now();
    const operationName = info.operation?.name?.value || 'anonymous';
    const operationType = info.operation?.operation;
    const fieldName = info.fieldName;
    
    const logContext = {
      tenantId: ctx.req?.user?.tenantId,
      userId: ctx.req?.user?.id,
      requestId: ctx.req?.id || ctx.req?.headers?.['x-request-id'],
      correlationId: ctx.req?.headers?.['x-correlation-id'],
      graphqlOperation: operationName,
      graphqlOperationType: operationType,
      graphqlFieldName: fieldName,
      graphqlPath: info.path ? [info.path.key] : undefined,
    };

    // Log GraphQL operation start
    this.logger.graphqlQuery(
      operationName,
      info.operation?.loc?.source?.body || '',
      info.variableValues || {},
      logContext,
    );

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        
        this.logger.performance(
          `graphql_${operationType}_${fieldName}`,
          duration,
          {
            ...logContext,
            resultSize: this.calculateResultSize(result),
          },
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        this.logger.graphqlError(
          operationName,
          error,
          info.path ? [info.path.key] : undefined,
          {
            ...logContext,
            duration,
          },
        );
        
        return throwError(() => error);
      }),
    );
  }

  private calculateResultSize(result: any): number {
    try {
      return JSON.stringify(result).length;
    } catch {
      return 0;
    }
  }
}

@Injectable()
export class PerformanceLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('PerformanceLoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const operation = `${className}.${methodName}`;
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        
        // Log all operations for performance monitoring
        this.logger.performance(operation, duration, {
          className,
          methodName,
          type: 'method_execution',
        });
        
        // Log slow operations as warnings
        if (duration > 1000) {
          this.logger.warn(
            `Slow operation detected: ${operation} took ${duration}ms`,
            {
              className,
              methodName,
              duration,
              threshold: 1000,
              type: 'slow_operation',
            },
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        this.logger.error(
          `Operation failed: ${operation}`,
          error.stack,
          {
            className,
            methodName,
            duration,
            error: error.message,
            type: 'method_error',
          },
        );
        
        return throwError(() => error);
      }),
    );
  }
}