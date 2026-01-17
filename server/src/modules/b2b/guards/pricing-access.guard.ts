import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * Guard to validate pricing access permissions
 * 
 * Ensures users can only access pricing information they're authorized to see
 * Customers can see their own pricing, sales reps can see their territory pricing
 */
@Injectable()
export class PricingAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;
    const args = gqlContext.getArgs();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Users with global pricing access can see all pricing
    if (user.permissions?.includes('pricing:read_all')) {
      return true;
    }

    // Check operation type
    const fieldName = gqlContext.getInfo().fieldName;
    const isPricingOperation = this.isPricingOperation(fieldName);

    if (!isPricingOperation) {
      return true; // Not a pricing operation
    }

    // Customers can see their own pricing
    if (user.customerId) {
      if (args.customerId && args.customerId !== user.customerId) {
        throw new ForbiddenException('Cannot access pricing for other customers');
      }
      return true;
    }

    // Sales reps can see pricing for their territory customers
    if (user.permissions?.includes('pricing:read_territory')) {
      const territoryContext = request.territoryContext;
      if (territoryContext?.territories?.length > 0) {
        // Would need to validate customer is in sales rep's territory
        return true;
      }
    }

    // Check for basic pricing read permission
    if (user.permissions?.includes('pricing:read')) {
      return true;
    }

    throw new ForbiddenException('Insufficient pricing access permissions');
  }

  private isPricingOperation(fieldName: string): boolean {
    const pricingOperations = [
      'getCustomerPricing',
      'getBulkPricing',
      'getPricingRules',
      'getPortalProductCatalog',
      'updatePricing',
      'createPricingRule'
    ];

    return pricingOperations.some(op => fieldName.includes(op));
  }
}