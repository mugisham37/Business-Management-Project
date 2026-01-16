import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor to automatically filter responses by tenant
 * Ensures that responses only contain data from the user's tenant
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user = request.user;

    // If no user, skip tenant filtering
    if (!user || !user.tenantId) {
      return next.handle();
    }

    const tenantId = user.tenantId;

    return next.handle().pipe(
      map(data => {
        // If data is null or undefined, return as is
        if (data == null) {
          return data;
        }

        // Filter data by tenant
        return this.filterByTenant(data, tenantId);
      }),
    );
  }

  /**
   * Recursively filter data to ensure tenant isolation
   */
  private filterByTenant(data: any, tenantId: string): any {
    // Handle arrays
    if (Array.isArray(data)) {
      return data
        .filter(item => this.belongsToTenant(item, tenantId))
        .map(item => this.filterByTenant(item, tenantId));
    }

    // Handle objects
    if (typeof data === 'object' && data !== null) {
      // Check if object has tenantId and validate it
      if ('tenantId' in data) {
        if (data.tenantId !== tenantId) {
          throw new ForbiddenException('Access denied: Cross-tenant access not allowed');
        }
      }

      // Recursively filter nested objects
      const filtered: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          filtered[key] = this.filterByTenant(data[key], tenantId);
        }
      }
      return filtered;
    }

    // Return primitive values as is
    return data;
  }

  /**
   * Check if an item belongs to the specified tenant
   */
  private belongsToTenant(item: any, tenantId: string): boolean {
    // If item doesn't have tenantId, allow it (might be a non-tenant-scoped object)
    if (typeof item !== 'object' || item === null || !('tenantId' in item)) {
      return true;
    }

    return item.tenantId === tenantId;
  }
}
