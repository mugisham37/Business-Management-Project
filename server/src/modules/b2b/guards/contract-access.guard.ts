import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';

/**
 * Guard to validate contract access permissions
 * 
 * Ensures users can only access contracts they're authorized to see
 * Customers can see their own contracts, sales reps can see their territory contracts
 */
@Injectable()
export class ContractAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;
    const args = gqlContext.getArgs();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Users with global contract access can see all contracts
    if (user.permissions?.includes('contract:read_all')) {
      return true;
    }

    // Check operation type
    const fieldName = gqlContext.getInfo().fieldName;
    const isContractOperation = this.isContractOperation(fieldName);

    if (!isContractOperation) {
      return true; // Not a contract operation
    }

    // Customers can see their own contracts
    if (user.customerId) {
      if (args.customerId && args.customerId !== user.customerId) {
        throw new ForbiddenException('Cannot access contracts for other customers');
      }
      return true;
    }

    // Sales reps can see contracts for their territory customers
    if (user.permissions?.includes('contract:read_territory')) {
      const territoryContext = request.territoryContext;
      if (territoryContext?.territories?.length > 0) {
        // Would need to validate customer is in sales rep's territory
        return true;
      }
    }

    // Check for basic contract read permission
    if (user.permissions?.includes('contract:read')) {
      return true;
    }

    // Legal team can access contracts for review
    if (user.permissions?.includes('legal:read')) {
      return true;
    }

    throw new ForbiddenException('Insufficient contract access permissions');
  }

  private isContractOperation(fieldName: string): boolean {
    const contractOperations = [
      'getContract',
      'getContracts',
      'createContract',
      'updateContract',
      'approveContract',
      'signContract',
      'renewContract'
    ];

    return contractOperations.some(op => fieldName.includes(op));
  }
}