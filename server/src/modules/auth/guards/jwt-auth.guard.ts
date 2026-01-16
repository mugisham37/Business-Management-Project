import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * JWT Authentication Guard for GraphQL
 * Validates JWT tokens in Authorization header
 * Can be bypassed with @Public() decorator
 * GraphQL-only implementation
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  override getRequest(context: ExecutionContext) {
    // GraphQL-only: Extract request from GraphQL context
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext().req;
  }

  override canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
