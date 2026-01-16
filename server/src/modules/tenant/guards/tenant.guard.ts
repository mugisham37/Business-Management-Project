import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * Guard to enforce tenant isolation in GraphQL resolvers
 * Ensures that users can only access data from their own tenant
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if tenant validation is disabled for this route
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>('skipTenantCheck', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTenantCheck) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user = request.user;

    // If no user is authenticated, let the auth guard handle it
    if (!user) {
      return true;
    }

    // Validate that user has a tenant ID
    if (!user.tenantId) {
      throw new ForbiddenException('User does not belong to any tenant');
    }

    // Attach tenant ID to request for easy access
    request.tenantId = user.tenantId;

    return true;
  }
}
