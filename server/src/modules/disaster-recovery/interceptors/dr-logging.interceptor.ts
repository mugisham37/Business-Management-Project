import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class DRLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DRLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const info = ctx.getInfo();
    
    const operationName = info.fieldName;
    const operationType = info.operation.operation;
    const tenantId = request.tenantId;
    const userId = request.user?.id;
    const args = ctx.getArgs();

    const startTime = Date.now();

    // Log operation start
    this.logger.log(
      `DR Operation Started: ${operationType}.${operationName} | Tenant: ${tenantId} | User: ${userId} | Args: ${JSON.stringify(this.sanitizeArgs(args))}`
    );

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        
        // Log successful operation
        this.logger.log(
          `DR Operation Completed: ${operationType}.${operationName} | Duration: ${duration}ms | Tenant: ${tenantId} | User: ${userId} | Success: ${this.isSuccessfulResult(result)}`
        );

        // Log specific DR events
        this.logDRSpecificEvents(operationName, args, result, tenantId, userId);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Log failed operation
        this.logger.error(
          `DR Operation Failed: ${operationType}.${operationName} | Duration: ${duration}ms | Tenant: ${tenantId} | User: ${userId} | Error: ${error.message}`,
          error.stack
        );

        // Log critical DR failures
        this.logCriticalFailures(operationName, args, error, tenantId, userId);

        return throwError(() => error);
      })
    );
  }

  private sanitizeArgs(args: any): any {
    // Remove sensitive information from logs
    const sanitized = { ...args };
    
    // Remove password fields, tokens, etc.
    if (sanitized.input) {
      delete sanitized.input.password;
      delete sanitized.input.token;
      delete sanitized.input.secret;
    }

    return sanitized;
  }

  private isSuccessfulResult(result: any): boolean {
    if (typeof result === 'boolean') {
      return result;
    }
    
    if (result && typeof result === 'object') {
      return result.success !== false;
    }
    
    return true;
  }

  private logDRSpecificEvents(
    operationName: string,
    args: any,
    result: any,
    tenantId: string,
    userId: string
  ): void {
    switch (operationName) {
      case 'executeDR':
        this.logger.warn(
          `DR EXECUTION INITIATED: Plan ${args.planId} | Disaster Type: ${args.input?.disasterType} | Test: ${args.input?.isTest} | Tenant: ${tenantId} | User: ${userId}`
        );
        break;
        
      case 'executeFailover':
        this.logger.warn(
          `FAILOVER EXECUTED: Service ${args.input?.serviceName} | Target: ${args.input?.targetRegion} | Reason: ${args.input?.reason} | Tenant: ${tenantId} | User: ${userId}`
        );
        break;
        
      case 'implementGracefulDegradation':
        this.logger.warn(
          `SERVICE DEGRADED: Service ${args.serviceName} | Level: ${args.degradationLevel} | Reason: ${args.reason} | Tenant: ${tenantId} | User: ${userId}`
        );
        break;
        
      case 'restoreServiceFromDegradation':
        this.logger.log(
          `SERVICE RESTORED: Service ${args.serviceName} | Tenant: ${tenantId} | User: ${userId}`
        );
        break;
        
      case 'performGranularRecovery':
        this.logger.warn(
          `DATA RECOVERY INITIATED: Type ${args.recoveryType} | Tables: ${args.targetTables?.join(', ') || 'All'} | Tenant: ${tenantId} | User: ${userId}`
        );
        break;
    }
  }

  private logCriticalFailures(
    operationName: string,
    args: any,
    error: any,
    tenantId: string,
    userId: string
  ): void {
    const criticalOperations = [
      'executeDR',
      'executeFailover',
      'performGranularRecovery',
      'executeSecureDestruction'
    ];

    if (criticalOperations.includes(operationName)) {
      this.logger.error(
        `CRITICAL DR FAILURE: ${operationName} | Tenant: ${tenantId} | User: ${userId} | Error: ${error.message} | Args: ${JSON.stringify(this.sanitizeArgs(args))}`,
        error.stack
      );
    }
  }
}