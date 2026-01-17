import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to extract B2B customer information from GraphQL context
 */
export const CurrentB2BCustomer = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.b2bCustomer || null;
  },
);

/**
 * Decorator to extract customer ID from GraphQL context
 */
export const CurrentCustomerId = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.customerId || null;
  },
);

/**
 * Decorator to check if user is a B2B customer
 */
export const IsB2BCustomer = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return !!request.user?.b2bCustomer;
  },
);