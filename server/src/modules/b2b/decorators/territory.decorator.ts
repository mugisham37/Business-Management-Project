import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Decorator to extract sales territory from GraphQL context
 */
export const CurrentTerritory = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.territory || null;
  },
);

/**
 * Decorator to extract territory ID from GraphQL context
 */
export const CurrentTerritoryId = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.territoryId || null;
  },
);

/**
 * Decorator to check if user manages a territory
 */
export const IsTerritoryManager = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    return request.user?.roles?.includes('territory_manager') || false;
  },
);