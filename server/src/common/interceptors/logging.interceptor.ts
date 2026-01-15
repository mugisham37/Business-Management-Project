import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomLoggerService } from '../../modules/logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, body, headers } = request;
    
    // Generate request ID for tracing
    const requestId = uuidv4();
    request.requestId = requestId;
    
    // Extract tenant and user info if available
    const tenantId = request.user?.tenantId;
    const userId = request.user?.id;
    
    const startTime = Date.now();
    
    this.logger.log(`Incoming ${method} ${url}`, {
      requestId,
      tenantId,
      userId,
      method,
      url,
      userAgent: headers['user-agent'],
      ip: request.ip,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          this.logger.performance(`${method} ${url}`, duration, {
            requestId,
            tenantId,
            userId,
            statusCode: response.statusCode,
            responseSize: JSON.stringify(data).length,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`Error in ${method} ${url}`, error.stack, {
            requestId,
            tenantId,
            userId,
            duration,
            errorMessage: error.message,
            errorName: error.constructor.name,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body } as Record<string, unknown>;
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}