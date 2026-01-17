import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { B2BWorkflowService } from '../services/b2b-workflow.service';

/**
 * Middleware to inject approval context into requests
 * 
 * Adds user's approval permissions and limits to request context
 * for use in GraphQL resolvers and services
 */
@Injectable()
export class ApprovalContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApprovalContextMiddleware.name);

  constructor(
    private readonly workflowService: B2BWorkflowService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Only process authenticated requests with user context
      if (!req.user?.tenantId || !req.user?.id) {
        return next();
      }

      const tenantId = req.user.tenantId;
      const userId = req.user.id;

      this.logger.debug(`Injecting approval context for user ${userId} in tenant ${tenantId}`);

      // Get user's approval permissions
      const approvalPermissions = await this.workflowService.getUserApprovalPermissions(tenantId, userId);
      
      // Get user's approval limits
      const approvalLimits = await this.workflowService.getUserApprovalLimits(tenantId, userId);

      // Get pending approvals assigned to user
      const pendingApprovals = await this.workflowService.getPendingApprovalsForUser(tenantId, userId);

      // Inject approval context into request
      req.approvalContext = {
        permissions: approvalPermissions,
        limits: approvalLimits,
        pendingCount: pendingApprovals.length,
        userId,
        tenantId,
        canApproveOrders: approvalPermissions.includes('b2b_order:approve'),
        canApproveQuotes: approvalPermissions.includes('quote:approve'),
        canApproveContracts: approvalPermissions.includes('contract:approve'),
      };

      this.logger.debug(`Injected approval context: permissions=${approvalPermissions.length}, limits=${Object.keys(approvalLimits).length}, pending=${pendingApprovals.length}`);
    } catch (error) {
      this.logger.error(`Failed to inject approval context:`, error);
      // Continue without approval context rather than failing the request
    }

    next();
  }
}