import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Roles Guard
 * Validates that user has required role(s)
 * Used with @Roles() decorator to protect GraphQL resolvers
 * GraphQL-only implementation
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // GraphQL-only: Extract user from GraphQL context
    const gqlContext = GqlExecutionContext.create(context);
    const user = gqlContext.getContext().req.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has required role
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `User role '${user.role}' does not have required role(s): ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
