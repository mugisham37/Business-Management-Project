import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor to standardize REST API responses
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        
        // Skip transformation for already formatted responses
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Skip transformation for file downloads
        if (response.getHeader('content-disposition')) {
          return data;
        }

        // Skip transformation for health checks
        if (request.url.includes('/health')) {
          return data;
        }

        // Get API version from route
        const version = this.getApiVersion(request.url);

        // Transform successful responses
        return {
          success: true,
          message: this.getSuccessMessage(context, response.statusCode),
          data,
          timestamp: new Date().toISOString(),
          version,
        };
      }),
    );
  }

  private getApiVersion(url: string): string {
    const versionMatch = url.match(/\/api\/v(\d+)\//);
    return versionMatch?.[1] ?? '1';
  }

  private getSuccessMessage(context: ExecutionContext, statusCode: number): string {
    const method = context.switchToHttp().getRequest().method;
    
    switch (method) {
      case 'POST':
        return statusCode === 201 ? 'Resource created successfully' : 'Operation completed successfully';
      case 'PUT':
      case 'PATCH':
        return 'Resource updated successfully';
      case 'DELETE':
        return 'Resource deleted successfully';
      case 'GET':
      default:
        return 'Data retrieved successfully';
    }
  }
}