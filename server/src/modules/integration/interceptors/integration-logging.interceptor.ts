import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class IntegrationLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IntegrationLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const userAgent = request.get('User-Agent') || '';
    const ip = request.ip;
    
    const startTime = Date.now();

    // Log request details for integration endpoints
    this.logger.log(
      `Integration API Request: ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `Integration API Response: ${method} ${url} - Duration: ${duration}ms`
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `Integration API Error: ${method} ${url} - Duration: ${duration}ms - Error: ${error.message}`
        );
        throw error;
      }),
    );
  }
}