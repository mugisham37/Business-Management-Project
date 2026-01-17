import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to check if user can approve orders
 */
export const CanApproveOrders = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.permissions?.includes('b2b_order:approve') || false;
  },
);

/**
 * Decorator to check if user can approve quotes
 */
export const CanApproveQuotes = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.permissions?.includes('quote:approve') || false;
  },
);

/**
 * Decorator to check if user can approve contracts
 */
export const CanApproveContracts = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.permissions?.includes('contract:approve') || false;
  },
);

/**
 * Decorator to get user's approval limits
 */
export const ApprovalLimits = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.approvalLimits || {};
  },
);