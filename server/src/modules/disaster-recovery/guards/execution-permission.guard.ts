import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DisasterRecoveryService } from '../services/disaster-recovery.service';

@Injectable()
export class ExecutionPermissionGuard implements CanActivate {
  constructor(
    private readonly drService: DisasterRecoveryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();

    const planId = args.planId;
    const executionId = args.executionId;
    const tenantId = request.tenantId;
    const user = request.user;
    const isTest = args.input?.isTest || false;

    try {
      // Validate plan access if planId is provided
      if (planId) {
        const plan = await this.drService.getDRPlan(planId, tenantId);
        if (!plan) {
          throw new ForbiddenException('DR plan not found or access denied');
        }

        // Check if user can execute non-test operations
        if (!isTest && !this.hasExecutionPermission(user, plan)) {
          throw new ForbiddenException('Insufficient permissions for DR execution');
        }

        request.drPlan = plan;
      }

      // Validate execution access if executionId is provided
      if (executionId) {
        const execution = await this.drService.getDRExecution(executionId, tenantId);
        if (!execution) {
          throw new ForbiddenException('DR execution not found or access denied');
        }

        request.drExecution = execution;
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Access denied for DR execution');
    }
  }

  private hasExecutionPermission(user: any, plan: any): boolean {
    // Check if user has appropriate role/permissions for non-test executions
    // This would typically check against user roles, plan criticality, etc.
    
    // For now, allow if user has disaster_recovery:execute permission
    // In a real implementation, you might have additional checks like:
    // - User role (admin, dr_operator, etc.)
    // - Plan criticality level
    // - Time-based restrictions
    // - Approval requirements
    
    return user.permissions?.includes('disaster_recovery:execute') || 
           user.roles?.includes('admin') || 
           user.roles?.includes('dr_operator');
  }
}