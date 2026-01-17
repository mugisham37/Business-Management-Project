import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

/**
 * GraphQL subscription resolver for contract real-time updates
 * 
 * Provides real-time notifications for:
 * - Contract creation and updates
 * - Contract approvals and signatures
 * - Contract renewals and expirations
 * - Compliance status changes
 * - Customer-specific contract updates
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContractSubscriptionResolver {
  private readonly logger = new Logger(ContractSubscriptionResolver.name);

  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Subscription: Contract status changed
   * Emitted when any contract status changes
   */
  @Subscription(() => Object, {
    name: 'contractStatusChanged',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.contractStatusChanged.tenantId === context.req.user.tenantId;
      const matchesContract = !variables.contractId || payload.contractStatusChanged.id === variables.contractId;
      const matchesCustomer = !variables.customerId || payload.contractStatusChanged.customerId === variables.customerId;
      return matchesTenant && matchesContract && matchesCustomer;
    },
  })
  contractStatusChanged(
    @Args('contractId', { type: () => ID, nullable: true }) contractId?: string,
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: contractStatusChanged for tenant ${tenantId}, contract ${contractId || 'all'}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator([
      'CONTRACT_CREATED',
      'CONTRACT_UPDATED',
      'CONTRACT_APPROVED',
      'CONTRACT_SIGNED',
      'CONTRACT_ACTIVATED',
      'CONTRACT_EXPIRED'
    ]);
  }

  /**
   * Subscription: Contract requires approval
   * Emitted when a contract is submitted and requires approval
   */
  @Subscription(() => Object, {
    name: 'contractRequiresApproval',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.contractRequiresApproval.tenantId === context.req.user.tenantId;
      const userCanApprove = context.req.user.permissions?.includes('contract:approve');
      return matchesTenant && userCanApprove;
    },
  })
  contractRequiresApproval(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: contractRequiresApproval for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('CONTRACT_REQUIRES_APPROVAL');
  }

  /**
   * Subscription: Contract signed
   * Emitted when a contract is signed by all parties
   */
  @Subscription(() => Object, {
    name: 'contractSigned',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.contractSigned.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.contractSigned.contract.customerId === variables.customerId;
      return matchesTenant && matchesCustomer;
    },
  })
  contractSigned(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: contractSigned for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('CONTRACT_SIGNED');
  }

  /**
   * Subscription: Contract renewal due
   * Emitted when a contract is approaching renewal date
   */
  @Subscription(() => Object, {
    name: 'contractRenewalDue',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.contractRenewalDue.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.contractRenewalDue.contract.customerId === variables.customerId;
      const userCanManageContracts = context.req.user.permissions?.includes('contract:manage');
      return matchesTenant && matchesCustomer && userCanManageContracts;
    },
  })
  contractRenewalDue(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: contractRenewalDue for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('CONTRACT_RENEWAL_DUE');
  }

  /**
   * Subscription: Contract compliance alert
   * Emitted when there are compliance issues with a contract
   */
  @Subscription(() => Object, {
    name: 'contractComplianceAlert',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.contractComplianceAlert.tenantId === context.req.user.tenantId;
      const userCanViewCompliance = context.req.user.permissions?.includes('compliance:read');
      return matchesTenant && userCanViewCompliance;
    },
  })
  contractComplianceAlert(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: contractComplianceAlert for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('CONTRACT_COMPLIANCE_ALERT');
  }
}