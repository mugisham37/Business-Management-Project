import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

/**
 * Integration logging interceptor
 * Logs all integration API requests and responses for debugging and auditing
 */
@Injectable()
export class IntegrationLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IntegrationLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    this.logger.log(
      `[${requestId}] ${method} ${url} - Request received`,
      { params, query, ...(body && { body: this.sanitizeBody(body) }) }
    );

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `[${requestId}] ${method} ${url} - Response sent (${duration}ms)`,
          { statusCode: context.switchToHttp().getResponse().statusCode }
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `[${requestId}] ${method} ${url} - Error (${duration}ms)`,
          {
            statusCode: error.status,
            message: error.message,
            error: error.name,
          }
        );
        throw error;
      })
    );
  }

  /**
   * Generate a unique request ID for tracking
   */
  private generateRequestId(): string {
    return `INT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize sensitive data from request body
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
