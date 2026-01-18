import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { LogLevel, LogCategory } from '../logger.service';
import { SanitizationUtil } from '../utils/sanitization.util';

// Metadata keys
export const LOG_LEVEL_KEY = 'logLevel';
export const LOG_CATEGORY_KEY = 'logCategory';
export const LOG_OPERATION_KEY = 'logOperation';
export const LOG_SENSITIVE_KEY = 'logSensitive';
export const LOG_PERFORMANCE_KEY = 'logPerformance';
export const LOG_AUDIT_KEY = 'logAudit';
export const LOG_SECURITY_KEY = 'logSecurity';
export const LOG_BUSINESS_KEY = 'logBusiness';

/**
 * Decorator to set the log level for a method or class
 */
export const SetLogLevel = (level: LogLevel) => SetMetadata(LOG_LEVEL_KEY, level);

/**
 * Decorator to set the log category for a method or class
 */
export const SetLogCategory = (category: LogCategory) => SetMetadata(LOG_CATEGORY_KEY, category);

/**
 * Decorator to set the operation name for logging
 */
export const LogOperation = (operation: string) => SetMetadata(LOG_OPERATION_KEY, operation);

/**
 * Decorator to mark a method as containing sensitive data
 * This will ensure sensitive information is redacted from logs
 */
export const LogSensitive = (fields?: string[]) => SetMetadata(LOG_SENSITIVE_KEY, fields || true);

/**
 * Decorator to enable performance logging for a method
 */
export const LogPerformance = (threshold?: number) => SetMetadata(LOG_PERFORMANCE_KEY, threshold || 1000);

/**
 * Decorator to enable audit logging for a method
 */
export const LogAudit = (event?: string) => SetMetadata(LOG_AUDIT_KEY, event || true);

/**
 * Decorator to enable security logging for a method
 */
export const LogSecurity = (event?: string) => SetMetadata(LOG_SECURITY_KEY, event || true);

/**
 * Decorator to enable business event logging for a method
 */
export const LogBusiness = (event?: string) => SetMetadata(LOG_BUSINESS_KEY, event || true);

/**
 * Parameter decorator to inject log context into method parameters
 */
export const LogContext = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const gqlContext = GqlExecutionContext.create(ctx);
    const context = gqlContext.getContext();
    const request = context.req;
    
    const logContext = {
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
      requestId: request.id || request.headers['x-request-id'],
      sessionId: request.sessionID || request.headers['x-session-id'],
      ipAddress: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'],
      correlationId: request.headers['x-correlation-id'],
      operationName: gqlContext.getInfo()?.operation?.name?.value,
      fieldName: gqlContext.getInfo()?.fieldName,
    };

    return data ? logContext[data as keyof typeof logContext] : logContext;
  },
);

/**
 * Parameter decorator to inject GraphQL operation info
 */
export const GraphQLOperationInfo = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const gqlContext = GqlExecutionContext.create(ctx);
    const info = gqlContext.getInfo();
    
    const operationInfo = {
      operationName: info.operation.name?.value,
      operationType: info.operation.operation,
      fieldName: info.fieldName,
      path: info.path,
      parentType: info.parentType.name,
      returnType: info.returnType.toString(),
      schema: info.schema,
      fragments: info.fragments,
      variableValues: info.variableValues,
    };

    return data ? operationInfo[data as keyof typeof operationInfo] : operationInfo;
  },
);

/**
 * Parameter decorator to inject performance metrics
 */
export const PerformanceMetrics = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const startTime = Date.now();
    
    return {
      startTime,
      getElapsed: () => Date.now() - startTime,
      mark: (label: string) => ({ label, timestamp: Date.now(), elapsed: Date.now() - startTime }),
    };
  },
);

/**
 * Decorator to automatically log method entry and exit
 */
export function LogMethodCalls(options?: {
  level?: LogLevel;
  category?: LogCategory;
  includeArgs?: boolean;
  includeResult?: boolean;
  sensitiveFields?: string[];
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyName;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const correlationId = `${className}.${methodName}_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get logger instance (assuming it's injected as 'logger' or 'loggerService')
      const logger = (this as any).logger || (this as any).loggerService || (this as any).customLogger;
      
      if (logger) {
        // Log method entry
        logger.debug(
          `Method ${className}.${methodName} started`,
          {
            className,
            methodName,
            correlationId,
            args: options?.includeArgs ? SanitizationUtil.sanitizeArgs(args, options.sensitiveFields) : undefined,
          },
        );
      }

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        if (logger) {
          // Log method success
          logger.debug(
            `Method ${className}.${methodName} completed successfully`,
            {
              className,
              methodName,
              correlationId,
              duration,
              result: options?.includeResult ? SanitizationUtil.sanitizeResult(result, options.sensitiveFields) : undefined,
            },
          );

          // Log performance if threshold exceeded
          const threshold = options?.level === LogLevel.WARN ? 500 : 1000;
          if (duration > threshold) {
            logger.performance(`${className}.${methodName}`, duration, {
              correlationId,
              threshold,
            });
          }
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (logger) {
          logger.error(
            `Method ${className}.${methodName} failed`,
            errorObj.stack,
            {
              className,
              methodName,
              correlationId,
              duration,
              error: errorObj.message,
              args: options?.includeArgs ? SanitizationUtil.sanitizeArgs(args, options.sensitiveFields) : undefined,
            },
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to automatically log GraphQL resolver performance
 */
export function LogGraphQLResolver(options?: {
  complexityThreshold?: number;
  durationThreshold?: number;
  logVariables?: boolean;
  sensitiveFields?: string[];
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const resolverName = `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const [, , context, info] = args;
      
      const logger = (this as any).logger || (this as any).loggerService || (this as any).customLogger;
      const operationName = info?.operation?.name?.value || 'anonymous';
      const operationType = info?.operation?.operation;
      
      if (logger) {
        logger.graphqlQuery(
          operationName,
          info?.operation?.loc?.source?.body || '',
          options?.logVariables ? info?.variableValues || {} : {},
          {
            tenantId: context.req?.user?.tenantId,
            userId: context.req?.user?.id,
            resolverName,
            operationType,
          },
        );
      }

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        if (logger) {
          // Log performance
          logger.performance(resolverName, duration, {
            operationName,
            operationType,
            tenantId: context.req?.user?.tenantId,
            userId: context.req?.user?.id,
          });

          // Log slow queries
          const threshold = options?.durationThreshold || 1000;
          if (duration > threshold) {
            logger.warn(
              `Slow GraphQL resolver: ${resolverName} took ${duration}ms`,
              {
                operationName,
                operationType,
                duration,
                threshold,
                tenantId: context.req?.user?.tenantId,
              },
            );
          }
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (logger) {
          logger.graphqlError(
            operationName,
            errorObj,
            info?.path?.key ? [info.path.key] : undefined,
            {
              resolverName,
              duration,
              tenantId: context.req?.user?.tenantId,
              userId: context.req?.user?.id,
            },
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to log database operations
 */
export function LogDatabaseOperation(options?: {
  table?: string;
  operation?: string;
  logQuery?: boolean;
  sensitiveFields?: string[];
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const methodName = `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const logger = (this as any).logger || (this as any).loggerService || (this as any).customLogger;
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        if (logger) {
          logger.database(
            options?.operation || propertyName,
            options?.table || 'unknown',
            duration,
            {
              methodName,
              query: options?.logQuery ? args[0] : undefined,
            },
          );
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (logger) {
          logger.error(
            `Database operation failed: ${methodName}`,
            errorObj.stack,
            {
              operation: options?.operation || propertyName,
              table: options?.table,
              duration,
              error: errorObj.message,
            },
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to log cache operations
 */
export function LogCacheOperation(options?: {
  operation?: 'get' | 'set' | 'delete' | 'clear';
  logKeys?: boolean;
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const methodName = `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const logger = (this as any).logger || (this as any).loggerService || (this as any).customLogger;
      const key = args[0];
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        const hit = options?.operation === 'get' ? !!result : true;

        if (logger) {
          logger.cache(
            options?.operation || propertyName,
            options?.logKeys ? key : '[key]',
            hit,
            {
              methodName,
              duration,
            },
          );
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (logger) {
          logger.error(
            `Cache operation failed: ${methodName}`,
            errorObj.stack,
            {
              operation: options?.operation || propertyName,
              key: options?.logKeys ? key : '[key]',
              duration,
              error: errorObj.message,
            },
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to log integration calls
 */
export function LogIntegration(service: string, options?: {
  logRequest?: boolean;
  logResponse?: boolean;
  sensitiveFields?: string[];
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operation = propertyName;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const logger = (this as any).logger || (this as any).loggerService || (this as any).customLogger;
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        if (logger) {
          logger.integration(service, operation, true, duration, {
            request: options?.logRequest ? SanitizationUtil.sanitizeArgs(args, options.sensitiveFields) : undefined,
            response: options?.logResponse ? SanitizationUtil.sanitizeResult(result, options.sensitiveFields) : undefined,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (logger) {
          logger.integration(service, operation, false, duration, {
            error: errorObj.message,
            request: options?.logRequest ? SanitizationUtil.sanitizeArgs(args, options.sensitiveFields) : undefined,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}