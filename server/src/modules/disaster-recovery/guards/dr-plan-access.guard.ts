import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DisasterRecoveryService } from '../services/disaster-recovery.service';

@Injectable()
export class DRPlanAccessGuard implements CanActivate {
  constructor(
    private readonly drService: DisasterRecoveryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();

    const planId = args.planId || request.drPlanId;
    const tenantId = request.tenantId;
    const user = request.user;

    if (!planId) {
      return true; // No plan ID to validate
    }

    try {
      // Check if user has access to the DR plan
      const plan = await this.drService.getDRPlan(planId, tenantId);
      
      if (!plan) {
        throw new ForbiddenException('DR plan not found or access denied');
      }

      // Add plan to request for use in resolvers
      request.drPlan = plan;
      
      return true;
    } catch (error) {
      throw new ForbiddenException('Access denied to DR plan');
    }
  }
}