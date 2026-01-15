import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FeatureFlagService } from '../services/feature-flag.service';
import { CustomLoggerService } from '../../logger/logger.service';
import { BusinessTier } from '../entities/tenant.entity';
import { AuthenticatedUser } from './tenant.guard';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
    private readonly logger: CustomLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required feature from decorator
    const requiredFeature = this.reflector.get<string>('feature', context.getHandler());
    const requiredTier = this.reflector.get<BusinessTier>('requiredTier', context.getHandler());
    const allowedTiers = this.reflector.get<BusinessTier[]>('allowedTiers', context.getHandler());

    // If no feature requirement, allow access
    if (!requiredFeature && !requiredTier && !allowedTiers) {
      return true;
    }

    const request = this.getRequest(context);
    const user: AuthenticatedUser = request.user;
    const tenantContext = request.tenantContext;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('User authentication required');
    }

    if (!tenantContext) {
      throw new ForbiddenException('Tenant context required');
    }

    try {
      // Check tier requirements first (faster than feature evaluation)
      if (requiredTier) {
        if (!this.meetsTierRequirement(tenantContext.businessTier, requiredTier)) {
          throw new ForbiddenException({
            message: `Feature requires ${requiredTier} tier or higher`,
            currentTier: tenantContext.businessTier,
            requiredTier,
            upgradeRequired: true,
          });
        }
      }

      if (allowedTiers && allowedTiers.length > 0) {
        if (!allowedTiers.includes(tenantContext.businessTier)) {
          throw new ForbiddenException({
            message: `Feature only available for specific tiers`,
            currentTier: tenantContext.businessTier,
            allowedTiers,
            upgradeRequired: true,
          });
        }
      }

      // Check feature flag if specified
      if (requiredFeature) {
        const hasFeature = await this.featureFlagService.hasFeature(
          user.tenantId,
          requiredFeature,
          {
            tenantId: user.tenantId,
            businessTier: tenantContext.businessTier,
            businessMetrics: tenantContext.tenant.metrics,
            userId: user.id,
            userRoles: user.role ? [user.role] : [],
          },
        );

        if (!hasFeature) {
          this.logger.warn(
            `Feature access denied: ${requiredFeature} for tenant ${user.tenantId} (tier: ${tenantContext.businessTier})`
          );

          throw new ForbiddenException({
            message: `Feature '${requiredFeature}' not available for your business tier`,
            feature: requiredFeature,
            currentTier: tenantContext.businessTier,
            upgradeRequired: true,
          });
        }
      }

      // Log successful feature access
      this.logger.debug(
        `Feature access granted: ${requiredFeature || 'tier-based'} for tenant ${user.tenantId}`
      );

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      const errorMessage = (error as Error).message || 'Unknown error';
      const errorStack = (error as Error).stack;

      this.logger.error(
        `Feature guard evaluation failed: ${errorMessage}`,
        errorStack,
        { tenantId: user.tenantId },
      );

      throw new ForbiddenException('Feature access evaluation failed');
    }
  }

  /**
   * Check if current tier meets required tier
   */
  private meetsTierRequirement(currentTier: BusinessTier, requiredTier: BusinessTier): boolean {
    const tierOrder = [BusinessTier.MICRO, BusinessTier.SMALL, BusinessTier.MEDIUM, BusinessTier.ENTERPRISE];
    const currentIndex = tierOrder.indexOf(currentTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);
    
    return currentIndex >= requiredIndex;
  }

  /**
   * Get request object from execution context
   */
  private getRequest(context: ExecutionContext) {
    const contextType = context.getType<'http' | 'graphql'>();
    
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req;
    }
    
    return context.switchToHttp().getRequest();
  }
}