import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to extract DR plan from GraphQL context
 */
export const CurrentDRPlan = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.drPlan;
  },
);

/**
 * Decorator to validate DR plan access
 */
export const ValidateDRPlanAccess = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add plan ID to request for middleware processing
    if (args.planId) {
      request.drPlanId = args.planId;
    }
    
    return args.planId;
  },
);

/**
 * Decorator to extract disaster type from context
 */
export const CurrentDisasterType = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs();
    return args.disasterType || args.input?.disasterType;
  },
);

/**
 * Decorator to validate execution permissions
 */
export const ValidateExecutionPermission = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();
    
    // Add execution context for validation
    request.executionContext = {
      planId: args.planId,
      executionId: args.executionId,
      isTest: args.input?.isTest || false,
    };
    
    return request.executionContext;
  },
);