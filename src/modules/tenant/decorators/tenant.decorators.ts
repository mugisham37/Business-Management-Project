import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Tenant, BusinessTier } from '../entities/tenant.entity';

/**
 * Decorator to get current tenant from request context
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Tenant => {
    const request = getRequest(ctx);
    const tenantContext = request.tenantContext;
    
    if (!tenantContext || !tenantContext.tenant) {
      throw new Error('Tenant context not found in request');
    }
    
    return tenantContext.tenant;
  },
);

/**
 * Decorator to get current tenant ID from request context
 */
export const CurrentTenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = getRequest(ctx);
    const user = request.user;
    
    if (!user || !user.tenantId) {
      throw new Error('Tenant ID not found in user context');
    }
    
    return user.tenantId;
  },
);

/**
 * Decorator to get current business tier from request context
 */
export const CurrentBusinessTier = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): BusinessTier => {
    const request = getRequest(ctx);
    const tenantContext = request.tenantContext;
    
    if (!tenantContext) {
      throw new Error('Tenant context not found in request');
    }
    
    return tenantContext.businessTier;
  },
);

/**
 * Decorator to skip tenant validation for specific routes
 */
export const SkipTenantValidation = () => SetMetadata('skipTenantValidation', true);

/**
 * Decorator to require specific business tier
 */
export const RequireTier = (tier: BusinessTier) => SetMetadata('requiredTier', tier);

/**
 * Decorator to allow multiple business tiers
 */
export const AllowTiers = (...tiers: BusinessTier[]) => SetMetadata('allowedTiers', tiers);

/**
 * Decorator to require specific feature
 */
export const RequireFeature = (featureName: string) => SetMetadata('feature', featureName);

/**
 * Decorator to require multiple features (all must be available)
 */
export const RequireFeatures = (...featureNames: string[]) => SetMetadata('features', featureNames);

/**
 * Decorator to require any of the specified features (at least one must be available)
 */
export const RequireAnyFeature = (...featureNames: string[]) => SetMetadata('anyFeatures', featureNames);

/**
 * Helper function to get request object from execution context
 */
function getRequest(context: ExecutionContext) {
  const contextType = context.getType<'http' | 'graphql'>();
  
  if (contextType === 'graphql') {
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext().req;
  }
  
  return context.switchToHttp().getRequest();
}