import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { TenantService } from '../services/tenant.service';
import { CustomLoggerService } from '../../logger/logger.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  permissions: string[];
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantService: TenantService,
    private readonly logger: CustomLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if tenant validation is disabled for this route
    const skipTenantValidation = this.reflector.get<boolean>('skipTenantValidation', context.getHandler());
    if (skipTenantValidation) {
      return true;
    }

    const request = this.getRequest(context);
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!user.tenantId) {
      throw new UnauthorizedException('User does not belong to any tenant');
    }

    try {
      // Validate that the tenant exists and is active
      const isValidTenant = await this.tenantService.isValidTenant(user.tenantId);
      
      if (!isValidTenant) {
        this.logger.warn(
          `Access denied for inactive/invalid tenant: ${user.tenantId}`
        );
        throw new ForbiddenException('Tenant is inactive or does not exist');
      }

      // Get tenant context and attach to request
      const tenantContext = await this.tenantService.getTenantContext(user.tenantId);
      request.tenantContext = tenantContext;

      // Log successful tenant validation
      this.logger.debug(
        `Tenant validation successful for user ${user.id} in tenant ${user.tenantId}`
      );

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }

      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;

      this.logger.error(
        `Tenant validation failed for user ${user.id}: ${errorMessage}`,
        errorStack
      );
      
      throw new ForbiddenException('Tenant validation failed');
    }
  }

  private getRequest(context: ExecutionContext) {
    const contextType = context.getType<'http' | 'graphql'>();
    
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req;
    }
    
    return context.switchToHttp().getRequest();
  }
}