import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to extract customer pricing tier from GraphQL context
 */
export const CurrentPricingTier = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.b2bCustomer?.pricingTier || 'standard';
  },
);

/**
 * Decorator to check if customer has specific pricing tier
 */
export const HasPricingTier = (tier: string) => {
  return createParamDecorator(
    (data: unknown, context: ExecutionContext) => {
      const ctx = GqlExecutionContext.create(context);
      const request = ctx.getContext().req;
      const customerTier = request.user?.b2bCustomer?.pricingTier || 'standard';
      return customerTier === tier;
    },
  );
};