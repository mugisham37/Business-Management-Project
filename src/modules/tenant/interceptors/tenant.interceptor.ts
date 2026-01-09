import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';
import { LoggerService } from '../../logger/logger.service';

export interface TenantContext {
  tenantId: string;
  businessTier: string;
  isActive: boolean;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = this.getRequest(context);
    const user = request.user;
    const tenantContext = request.tenantContext;

    // Inject tenant context into request headers for downstream services
    if (tenantContext) {
      request.headers = {
        ...request.headers,
        'x-tenant-id': tenantContext.tenant.id,
        'x-business-tier': tenantContext.businessTier,
        'x-tenant-active': tenantContext.isActive.toString(),
      };
    }

    // Log tenant context for debugging
    if (user && tenantContext) {
      this.logger.debug(
        `Request processed for tenant: ${tenantContext.tenant.name} (${tenantContext.tenant.id}) ` +
        `by user: ${user.email} (${user.id}) - Tier: ${tenantContext.businessTier}`,
        'TenantInterceptor',
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Log successful request completion
          if (tenantContext) {
            this.logger.debug(
              `Request completed successfully for tenant: ${tenantContext.tenant.id}`,
              'TenantInterceptor',
            );
          }
        },
        error: (error) => {
          // Log error with tenant context
          if (tenantContext) {
            this.logger.error(
              `Request failed for tenant: ${tenantContext.tenant.id} - Error: ${error.message}`,
              error.stack,
              'TenantInterceptor',
            );
          }
        },
      }),
    );
  }

  private getRequest(context: ExecutionContext) {
    const contextType = context.getType<'http' | 'graphql'>();
    
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req;
    }
    
    return context.switchToHttp().getRequest();
  }
}