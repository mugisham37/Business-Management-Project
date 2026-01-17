import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * Guard to validate approval authority
 * 
 * Ensures users have the appropriate approval permissions and limits
 * for the specific operation they're attempting
 */
@Injectable()
export class ApprovalAuthorityGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;
    const args = gqlContext.getArgs();
    const user = request.user;
    const handler = context.getHandler();

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Get required approval type from decorator or infer from operation
    const requiredApprovalType = this.reflector.get<string>('approvalType', handler) || 
                                this.inferApprovalType(gqlContext.getInfo().fieldName);

    if (!requiredApprovalType) {
      return true; // No specific approval requirement
    }

    // Check if user has the required approval permission
    const approvalPermission = `${requiredApprovalType}:approve`;
    if (!user.permissions?.includes(approvalPermission)) {
      throw new ForbiddenException(`Insufficient approval authority for ${requiredApprovalType}`);
    }

    // Check approval limits from context
    const approvalContext = request.approvalContext;
    if (approvalContext?.limits) {
      const limits = approvalContext.limits[requiredApprovalType];
      
      if (limits && args.amount !== undefined) {
        if (args.amount > limits.maxAmount) {
          throw new ForbiddenException(`Approval amount exceeds limit of ${limits.maxAmount}`);
        }
      }
    }

    return true;
  }

  private inferApprovalType(fieldName: string): string | null {
    if (fieldName.includes('Order')) return 'b2b_order';
    if (fieldName.includes('Quote')) return 'quote';
    if (fieldName.includes('Contract')) return 'contract';
    if (fieldName.includes('Pricing')) return 'pricing';
    return null;
  }
}