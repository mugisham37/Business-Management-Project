import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Local Authentication Guard for GraphQL
 * Validates email/password credentials in GraphQL context
 * Used internally for login resolver validation
 * GraphQL-only implementation
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  override getRequest(context: ExecutionContext) {
    // GraphQL-only: Extract request from GraphQL context
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext().req;
  }
}
