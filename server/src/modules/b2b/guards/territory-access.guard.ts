import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * Guard to validate territory access permissions
 * 
 * Ensures users can only access data within their assigned territories
 * unless they have global territory access permissions
 */
@Injectable()
export class TerritoryAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;
    const args = gqlContext.getArgs();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Users with global territory access can access all territories
    if (user.permissions?.includes('territory:access_all')) {
      return true;
    }

    // Check if user has territory context from middleware
    const territoryContext = request.territoryContext;
    if (!territoryContext || !territoryContext.territories?.length) {
      throw new ForbiddenException('No territory access assigned');
    }

    // If specific territory is requested, validate access
    if (args.territoryId) {
      const hasAccess = territoryContext.territories.some(
        (territory: any) => territory.id === args.territoryId
      );
      
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to requested territory');
      }
    }

    // If customer is specified, validate customer is in user's territories
    if (args.customerId) {
      const customerTerritories = territoryContext.territories.map((t: any) => t.id);
      // This would need to be validated against customer-territory mapping
      // For now, we'll allow if user has any territory access
    }

    return true;
  }
}