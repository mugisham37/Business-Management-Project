import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

@Injectable()
export class GraphQLTenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    
    // Check if tenant validation is disabled for this route
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>('skipTenantCheck', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTenantCheck) {
      return true;
    }

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.tenantId) {
      throw new ForbiddenException('User not associated with any tenant');
    }

    // Add tenant context to the request
    request.tenantId = user.tenantId;
    
    return true;
  }
}