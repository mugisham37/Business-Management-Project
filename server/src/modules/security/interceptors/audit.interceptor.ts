import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

import { AuditService } from '../services/audit.service';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // Check if auditing is enabled for this endpoint
    const skipAudit = this.reflector.get<boolean>('skipAudit', context.getHandler());
    if (skipAudit) {
      return next.handle();
    }

    const startTime = Date.now();
    const auditContext = this.buildAuditContext(context, request, user);

    return next.handle().pipe(
      tap(async (response) => {
        const duration = Date.now() - startTime;
        
        try {
          await this.logSuccessfulOperation(auditContext, response, duration);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(`Failed to log successful audit event: ${errorMessage}`, errorStack);
        }
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;
        
        try {
          await this.logFailedOperation(auditContext, error, duration);
        } catch (auditError) {
          const auditErrorMessage = auditError instanceof Error ? auditError.message : String(auditError);
          const auditErrorStack = auditError instanceof Error ? auditError.stack : undefined;
          this.logger.error(`Failed to log failed audit event: ${auditErrorMessage}`, auditErrorStack);
        }

        throw error;
      }),
    );
  }

  /**
   * Build audit context from execution context
   */
  private buildAuditContext(
    context: ExecutionContext,
    request: any,
    user: AuthenticatedUser | undefined,
  ): any {
    return {
      tenantId: user?.tenantId || 'system',
      userId: user?.id || 'anonymous',
      action: this.getActionFromContext(context, request),
      resource: this.getResourceFromContext(context, request),
      ipAddress: this.getClientIp(request),
      userAgent: request.get('User-Agent') || 'unknown',
      method: request.method,
      url: request.url,
      controller: context.getClass().name,
      handler: context.getHandler().name,
      requestId: request.id || this.generateRequestId(),
    };
  }

  /**
   * Log successful operation
   */
  private async logSuccessfulOperation(
    auditContext: any,
    response: any,
    duration: number,
  ): Promise<void> {
    const auditEvent = {
      ...auditContext,
      status: 'success',
      duration,
      timestamp: new Date(),
      metadata: {
        responseSize: this.getResponseSize(response),
        statusCode: 200, // Successful operations
        performance: {
          duration,
          category: this.categorizePerformance(duration),
        },
      },
    };

    await this.auditService.logEvent(auditEvent);
  }

  /**
   * Log failed operation
   */
  private async logFailedOperation(
    auditContext: any,
    error: any,
    duration: number,
  ): Promise<void> {
    const auditEvent = {
      ...auditContext,
      status: 'error',
      duration,
      timestamp: new Date(),
      metadata: {
        error: {
          name: error.name,
          message: error.message,
          statusCode: error.status || 500,
        },
        performance: {
          duration,
          category: this.categorizePerformance(duration),
        },
        severity: this.categorizeErrorSeverity(error),
      },
    };

    await this.auditService.logEvent(auditEvent);
  }

  /**
   * Get action from execution context
   */
  private getActionFromContext(context: ExecutionContext, request: any): string {
    // Check for custom audit action metadata
    const customAction = this.reflector.get<string>('auditAction', context.getHandler());
    if (customAction) {
      return customAction;
    }

    const method = request.method.toLowerCase();
    const path = request.url.toLowerCase();

    // Map specific paths to actions
    if (path.includes('login')) return 'login';
    if (path.includes('logout')) return 'logout';
    if (path.includes('register')) return 'register';
    if (path.includes('password')) return 'password_change';
    if (path.includes('export')) return 'export';
    if (path.includes('import')) return 'import';
    if (path.includes('download')) return 'download';
    if (path.includes('upload')) return 'upload';

    // Default HTTP method mapping
    const actionMap: Record<string, string> = {
      get: 'read',
      post: 'create',
      put: 'update',
      patch: 'update',
      delete: 'delete',
    };

    return actionMap[method.toLowerCase()] ?? method;
  }

  /**
   * Get resource from execution context
   */
  private getResourceFromContext(context: ExecutionContext, request: any): string {
    // Check for custom audit resource metadata
    const customResource = this.reflector.get<string>('auditResource', context.getHandler());
    if (customResource) {
      return customResource;
    }

    const path = request.url;
    
    // Remove query parameters and extract resource
    const cleanPath = path.split('?')[0];
    const pathParts = cleanPath.split('/').filter((part: string) => part);
    
    // Return the main resource (usually the second part after 'api/v1')
    if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'v1') {
      return pathParts[2];
    }
    
    // Fallback to controller name
    return context.getClass().name.replace('Controller', '').toLowerCase();
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get response size for logging
   */
  private getResponseSize(response: any): number {
    if (!response) return 0;
    
    try {
      return JSON.stringify(response).length;
    } catch {
      return 0;
    }
  }

  /**
   * Categorize performance based on duration
   */
  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'fast';
    if (duration < 500) return 'normal';
    if (duration < 2000) return 'slow';
    return 'very_slow';
  }

  /**
   * Categorize error severity
   */
  private categorizeErrorSeverity(error: any): string {
    const statusCode = error.status || 500;
    
    if (statusCode >= 500) return 'high';
    if (statusCode === 403 || statusCode === 401) return 'medium';
    if (statusCode >= 400) return 'low';
    
    return 'info';
  }
}