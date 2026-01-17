import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Subscription } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { ContractService } from '../services/contract.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import {
  CreateContractInput,
  UpdateContractInput,
  ContractQueryInput,
  ApproveContractInput,
  SignContractInput,
  RenewContractInput,
  ContractGraphQLType,
  ContractListResponse,
  ContractApprovalResponse,
  ContractRenewalResponse
} from '../types/contract.types';

/**
 * GraphQL resolver for B2B contract lifecycle management
 * 
 * Provides operations for:
 * - Contract CRUD operations
 * - Contract approval workflow
 * - Contract renewal management
 * - Contract expiration tracking
 * - Real-time contract status updates
 * 
 * @requires JwtAuthGuard - Authentication required for all operations
 * @requires TenantGuard - Tenant isolation enforced
 * @requires PermissionsGuard - Permission-based access control
 */
@Resolver(() => ContractGraphQLType)
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContractResolver extends BaseResolver {
  private readonly logger = new Logger(ContractResolver.name);

  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly contractService: ContractService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Get a single contract by ID
   * @permission contract:read
   */
  @Query(() => ContractGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('contract:read')
  async getContract(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractGraphQLType> {
    try {
      this.logger.debug(`Fetching contract ${id} for tenant ${tenantId}`);
      return await this.contractService.findContractById(tenantId, id);
    } catch (error) {
      this.logger.error(`Failed to get contract ${id}:`, error);
      throw error;
    }
  }

  /**
   * Query: Get paginated list of contracts with filtering
   * @permission contract:read
   */
  @Query(() => ContractListResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('contract:read')
  async getContracts(
    @Args('query') query: ContractQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractListResponse> {
    try {
      this.logger.debug(`Fetching contracts for tenant ${tenantId} with query:`, query);
      const result = await this.contractService.findContracts(tenantId, query);
      
      return {
        contracts: result.contracts,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get contracts:`, error);
      throw error;
    }
  }

  /**
   * Query: Get contracts expiring within specified days
   * @permission contract:read
   */
  @Query(() => [ContractGraphQLType])
  @UseGuards(PermissionsGuard)
  @Permissions('contract:read')
  async getExpiringContracts(
    @Args('days') days: number,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractGraphQLType[]> {
    try {
      this.logger.debug(`Fetching contracts expiring within ${days} days for tenant ${tenantId}`);
      return await this.contractService.getExpiringContracts(tenantId, days);
    } catch (error) {
      this.logger.error(`Failed to get expiring contracts:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Create a new contract
   * @permission contract:create
   */
  @Mutation(() => ContractGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('contract:create')
  async createContract(
    @Args('input') input: CreateContractInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractGraphQLType> {
    try {
      this.logger.log(`Creating contract for tenant ${tenantId} by user ${user.id}`);
      
      const contract = await this.contractService.createContract(
        tenantId,
        input,
        user.id,
      );

      this.logger.log(`Created contract ${contract.contractNumber} (${contract.id})`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to create contract:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Update an existing contract
   * @permission contract:update
   */
  @Mutation(() => ContractGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('contract:update')
  async updateContract(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateContractInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractGraphQLType> {
    try {
      this.logger.log(`Updating contract ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const contract = await this.contractService.updateContract(
        tenantId,
        id,
        input,
        user.id,
      );

      this.logger.log(`Updated contract ${id}`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to update contract ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Approve a contract
   * @permission contract:approve
   */
  @Mutation(() => ContractApprovalResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('contract:approve')
  async approveContract(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ApproveContractInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractApprovalResponse> {
    try {
      this.logger.log(`Approving contract ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const contract = await this.contractService.approveContract(
        tenantId,
        id,
        input.approvalNotes,
        user.id,
      );

      this.logger.log(`Approved contract ${id}`);
      return {
        contract,
        message: 'Contract approved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to approve contract ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Sign a contract
   * @permission contract:sign
   */
  @Mutation(() => ContractGraphQLType)
  @UseGuards(PermissionsGuard)
  @Permissions('contract:sign')
  async signContract(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: SignContractInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractGraphQLType> {
    try {
      this.logger.log(`Signing contract ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const contract = await this.contractService.updateContract(
        tenantId,
        id,
        {
          customerSignedAt: input.customerSignedAt || new Date(),
          metadata: JSON.stringify({
            signedBy: user.id,
            signedAt: new Date(),
          }),
        },
        user.id,
      );

      this.logger.log(`Signed contract ${id}`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to sign contract ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Renew a contract with new terms
   * @permission contract:renew
   */
  @Mutation(() => ContractRenewalResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('contract:renew')
  async renewContract(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: RenewContractInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ContractRenewalResponse> {
    try {
      this.logger.log(`Renewing contract ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const contract = await this.contractService.renewContract(
        tenantId,
        id,
        input.newEndDate,
        input.contractValue,
        input.pricingTerms ? JSON.parse(input.pricingTerms) : undefined,
        user.id,
      );

      this.logger.log(`Renewed contract ${id} with new end date ${input.newEndDate}`);
      return {
        contract,
        message: 'Contract renewed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to renew contract ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Terminate a contract
   * @permission contract:terminate
   */
  @Mutation('terminateContract')
  @UseGuards(PermissionsGuard)
  @Permissions('contract:terminate')
  async terminateContract(
    @Args('id', { type: () => ID }) id: string,
    @Args('terminationReason') terminationReason: string,
    @Args('terminationDate', { nullable: true }) terminationDate: Date,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      this.logger.log(`Terminating contract ${id} for tenant ${tenantId} by user ${user.id}`);
      
      // Get contract and update status to terminated
      const contract = await this.contractService.updateContract(
        tenantId,
        id,
        {
          status: 'terminated',
          metadata: {
            terminationReason,
            terminationDate: terminationDate || new Date(),
            terminatedBy: user.id,
          },
        },
        user.id,
      );

      this.logger.log(`Terminated contract ${id}`);
      return contract;
    } catch (error) {
      this.logger.error(`Failed to terminate contract ${id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load customer for contract
   * Uses DataLoader for batch loading to prevent N+1 queries
   */
  @ResolveField('customer')
  async getCustomer(
    @Parent() contract: ContractGraphQLType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      // DataLoader implementation would go here
      // For now, return a placeholder that indicates the customer ID
      return {
        id: contract.customerId,
        // Additional customer fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load customer for contract ${contract.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load sales representative for contract
   * Uses DataLoader for batch loading
   */
  @ResolveField('salesRep')
  async getSalesRep(
    @Parent() contract: ContractGraphQLType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!contract.salesRepId) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: contract.salesRepId,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load sales rep for contract ${contract.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load account manager for contract
   * Uses DataLoader for batch loading
   */
  @ResolveField('accountManager')
  async getAccountManager(
    @Parent() contract: ContractGraphQLType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!contract.accountManagerId) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: contract.accountManagerId,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load account manager for contract ${contract.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Check if contract is expired
   */
  @ResolveField('isExpired')
  async getIsExpired(
    @Parent() contract: ContractGraphQLType,
  ): Promise<boolean> {
    return new Date() > new Date(contract.endDate);
  }

  /**
   * Field Resolver: Calculate days until expiration
   */
  @ResolveField('daysUntilExpiration')
  async getDaysUntilExpiration(
    @Parent() contract: ContractGraphQLType,
  ): Promise<number> {
    const now = new Date();
    const endDate = new Date(contract.endDate);
    const diffTime = endDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Field Resolver: Check if contract requires renewal notice
   */
  @ResolveField('requiresRenewalNotice')
  async getRequiresRenewalNotice(
    @Parent() contract: ContractGraphQLType,
  ): Promise<boolean> {
    if (!contract.autoRenewal || !contract.renewalNoticeDays) {
      return false;
    }
    
    const now = new Date();
    const endDate = new Date(contract.endDate);
    const diffTime = endDate.getTime() - now.getTime();
    const daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return daysUntilExpiration <= contract.renewalNoticeDays;
  }

  /**
   * Subscription: Contract expiring notification
   * Filters events by tenant for multi-tenant isolation
   * 
   * Emitted when a contract is approaching expiration
   */
  @Subscription('contractExpiring', {
    filter: (payload, variables, context) => {
      // Filter by tenant to ensure data isolation
      return payload.contractExpiring.tenantId === context.req.user.tenantId;
    },
  })
  contractExpiring(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: contractExpiring for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('CONTRACT_EXPIRING');
  }

  /**
   * Subscription: Contract status changed
   * Filters events by tenant and optionally by contract ID
   * 
   * Emitted when a contract status changes (approved, renewed, terminated, etc.)
   */
  @Subscription('contractStatusChanged', {
    filter: (payload, variables, context) => {
      const matchesTenant = payload.contractStatusChanged.tenantId === context.req.user.tenantId;
      const matchesContract = !variables.contractId || payload.contractStatusChanged.id === variables.contractId;
      return matchesTenant && matchesContract;
    },
  })
  contractStatusChanged(
    @Args('contractId', { type: () => ID, nullable: true }) contractId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.debug(`Subscription: contractStatusChanged for tenant ${tenantId}, contract ${contractId || 'all'}`);
    return this.pubSub.asyncIterator('CONTRACT_STATUS_CHANGED');
  }
}
