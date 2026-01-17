import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * Guard to ensure user has B2B customer access
 * 
 * Validates that the user is associated with a B2B customer account
 * and has appropriate permissions for B2B operations
 */
@Injectable()
export class B2BCustomerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has B2B customer association
    if (!user.customerId && !user.permissions?.includes('b2b:access_all')) {
      throw new ForbiddenException('B2B customer access required');
    }

    // Check if user has basic B2B permissions
    const hasB2BAccess = user.permissions?.some((permission: string) => 
      permission.startsWith('b2b_') || 
      permission.includes('customer:') ||
      permission.includes('order:') ||
      permission.includes('quote:')
    );

    if (!hasB2BAccess && !user.customerId) {
      throw new ForbiddenException('Insufficient B2B permissions');
    }

    return true;
  }
}