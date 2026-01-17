import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Subscription } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { B2BPricingService } from '../services/b2b-pricing.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import {
  CreatePricingRuleInput,
  UpdatePricingRuleInput,
  PricingRuleQueryInput,
  CustomerPricingQueryInput,
  BulkPricingQueryInput,
  PricingRuleType,
  PricingRulesResponse,
  CustomerPricingResponse,
  BulkPricingResponse,
  PricingRuleResponse
} from '../types/pricing.types';

/**
 * GraphQL resolver for B2B pricing management
 * 
 * Provides operations for:
 * - Dynamic pricing rule management
 * - Customer-specific pricing queries
 * - Bulk pricing calculations
 * - Contract-based pricing
 * - Pricing tier management
 * - Real-time pricing updates
 * 
 * @requires JwtAuthGuard - Authentication required for all operations
 * @requires TenantGuard - Tenant isolation enforced
 * @requires PermissionsGuard - Permission-based access control
 */
@Resolver(() => PricingRuleType)
@UseGuards(JwtAuthGuard, TenantGuard)
export class PricingResolver extends BaseResolver {
  private readonly logger = new Logger(PricingResolver.name);

  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly pricingService: B2BPricingService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Get customer-specific pricing for a product
   * @permission pricing:read
   */
  @Query(() => CustomerPricingResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:read')
  async getCustomerPricing(
    @Args('query') query: CustomerPricingQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<CustomerPricingResponse> {
    try {
      this.logger.debug(`Getting customer pricing for ${query.customerId}, product ${query.productId}`);
      
      const pricing = await this.pricingService.getCustomerPricing(
        tenantId,
        query.customerId,
        query.productId,
        query.quantity,
      );

      return {
        customerId: query.customerId,
        productId: query.productId,
        quantity: query.quantity,
        listPrice: pricing.listPrice,
        customerPrice: pricing.customerPrice,
        discountPercentage: pricing.discountPercentage,
        discountAmount: pricing.discountAmount,
        appliedRules: pricing.appliedRules,
        pricingTier: pricing.pricingTier,
        contractPricing: pricing.contractPricing,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer pricing:`, error);
      throw error;
    }
  }

  /**
   * Query: Get bulk pricing for multiple products
   * @permission pricing:read
   */
  @Query(() => BulkPricingResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:read')
  async getBulkPricing(
    @Args('query') query: BulkPricingQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BulkPricingResponse> {
    try {
      this.logger.debug(`Getting bulk pricing for customer ${query.customerId}, ${query.items.length} items`);
      
      const pricingResults = await this.pricingService.getBulkPricing(
        tenantId,
        query.customerId,
        query.items,
      );

      return {
        customerId: query.customerId,
        items: pricingResults,
        totalListPrice: pricingResults.reduce((sum, item) => sum + item.listPrice * item.quantity, 0),
        totalCustomerPrice: pricingResults.reduce((sum, item) => sum + item.customerPrice * item.quantity, 0),
        totalSavings: pricingResults.reduce((sum, item) => sum + item.discountAmount * item.quantity, 0),
      };
    } catch (error) {
      this.logger.error(`Failed to get bulk pricing:`, error);
      throw error;
    }
  }

  /**
   * Query: Get all pricing rules with filtering
   * @permission pricing:read
   */
  @Query(() => PricingRulesResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:read')
  async getPricingRules(
    @Args('query') query: PricingRuleQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PricingRulesResponse> {
    try {
      this.logger.debug(`Fetching pricing rules for tenant ${tenantId}`);
      
      const result = await this.pricingService.getPricingRules(tenantId, query);
      
      return {
        rules: result.rules,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get pricing rules:`, error);
      throw error;
    }
  }

  /**
   * Query: Get applicable pricing rules for a specific scenario
   * @permission pricing:read
   */
  @Query(() => [PricingRuleType])
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:read')
  async getApplicablePricingRules(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('productId', { type: () => ID }) productId: string,
    @Args('quantity') quantity: number,
    @Args('amount') amount: number,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PricingRuleType[]> {
    try {
      this.logger.debug(`Getting applicable pricing rules for customer ${customerId}, product ${productId}`);
      
      return await this.pricingService.getApplicablePricingRules(
        tenantId,
        customerId,
        productId,
        quantity,
        amount,
      );
    } catch (error) {
      this.logger.error(`Failed to get applicable pricing rules:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Create a new pricing rule
   * @permission pricing:create
   */
  @Mutation(() => PricingRuleResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:create')
  async createPricingRule(
    @Args('input') input: CreatePricingRuleInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PricingRuleResponse> {
    try {
      this.logger.log(`Creating pricing rule for tenant ${tenantId} by user ${user.id}`);
      
      const rule = await this.pricingService.createPricingRule(tenantId, input, user.id);

      // Emit pricing change event
      await this.pubSub.publish('PRICING_RULE_CREATED', {
        pricingRuleCreated: {
          tenantId,
          rule,
          createdBy: user.id,
        },
      });

      this.logger.log(`Created pricing rule ${rule.id}`);
      return {
        rule,
        message: 'Pricing rule created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create pricing rule:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Update an existing pricing rule
   * @permission pricing:update
   */
  @Mutation(() => PricingRuleResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:update')
  async updatePricingRule(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePricingRuleInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PricingRuleResponse> {
    try {
      this.logger.log(`Updating pricing rule ${id} for tenant ${tenantId} by user ${user.id}`);
      
      const rule = await this.pricingService.updatePricingRule(tenantId, id, input, user.id);

      // Emit pricing change event
      await this.pubSub.publish('PRICING_RULE_UPDATED', {
        pricingRuleUpdated: {
          tenantId,
          rule,
          updatedBy: user.id,
        },
      });

      this.logger.log(`Updated pricing rule ${id}`);
      return {
        rule,
        message: 'Pricing rule updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update pricing rule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Delete a pricing rule
   * @permission pricing:delete
   */
  @Mutation(() => Boolean)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:delete')
  async deletePricingRule(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`Deleting pricing rule ${id} for tenant ${tenantId} by user ${user.id}`);
      
      await this.pricingService.deletePricingRule(tenantId, id, user.id);

      // Emit pricing change event
      await this.pubSub.publish('PRICING_RULE_DELETED', {
        pricingRuleDeleted: {
          tenantId,
          ruleId: id,
          deletedBy: user.id,
        },
      });

      this.logger.log(`Deleted pricing rule ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete pricing rule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Activate or deactivate a pricing rule
   * @permission pricing:update
   */
  @Mutation(() => PricingRuleResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('pricing:update')
  async setPricingRuleActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PricingRuleResponse> {
    try {
      this.logger.log(`Setting pricing rule ${id} active status to ${isActive}`);
      
      const rule = await this.pricingService.updatePricingRule(
        tenantId,
        id,
        { isActive },
        user.id,
      );

      // Emit pricing change event
      await this.pubSub.publish('PRICING_RULE_STATUS_CHANGED', {
        pricingRuleStatusChanged: {
          tenantId,
          rule,
          isActive,
          changedBy: user.id,
        },
      });

      this.logger.log(`Set pricing rule ${id} active status to ${isActive}`);
      return {
        rule,
        message: `Pricing rule ${isActive ? 'activated' : 'deactivated'} successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to set pricing rule active status:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load target entity for pricing rule
   */
  @ResolveField('targetEntity')
  async getTargetEntity(
    @Parent() rule: PricingRuleType,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!rule.targetId || !rule.targetType) {
        return null;
      }

      // DataLoader implementation would go here based on targetType
      return {
        id: rule.targetId,
        type: rule.targetType,
        // Additional fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load target entity for pricing rule ${rule.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Check if pricing rule is currently active
   */
  @ResolveField('isCurrentlyActive')
  async getIsCurrentlyActive(
    @Parent() rule: PricingRuleType,
  ): Promise<boolean> {
    const now = new Date();
    const isWithinDateRange = now >= new Date(rule.effectiveDate) && 
                             (!rule.expirationDate || now <= new Date(rule.expirationDate));
    return rule.isActive && isWithinDateRange;
  }

  /**
   * Subscription: Pricing rule created
   * Filters events by tenant for multi-tenant isolation
   */
  @Subscription('pricingRuleCreated', {
    filter: (payload, variables, context) => {
      return payload.pricingRuleCreated.tenantId === context.req.user.tenantId;
    },
  })
  pricingRuleCreated(@CurrentTenant() tenantId: string) {
    this.logger.debug(`Subscription: pricingRuleCreated for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('PRICING_RULE_CREATED');
  }

  /**
   * Subscription: Pricing rule updated
   * Filters events by tenant and optionally by rule ID
   */
  @Subscription('pricingRuleUpdated', {
    filter: (payload, variables, context) => {
      const matchesTenant = payload.pricingRuleUpdated.tenantId === context.req.user.tenantId;
      const matchesRule = !variables.ruleId || payload.pricingRuleUpdated.rule.id === variables.ruleId;
      return matchesTenant && matchesRule;
    },
  })
  pricingRuleUpdated(
    @Args('ruleId', { type: () => ID, nullable: true }) ruleId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.debug(`Subscription: pricingRuleUpdated for tenant ${tenantId}, rule ${ruleId || 'all'}`);
    return this.pubSub.asyncIterator('PRICING_RULE_UPDATED');
  }

  /**
   * Subscription: Pricing changed for customer/product
   * Real-time pricing updates for specific customer-product combinations
   */
  @Subscription('pricingChanged', {
    filter: (payload, variables, context) => {
      const matchesTenant = payload.pricingChanged.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.pricingChanged.customerId === variables.customerId;
      const matchesProduct = !variables.productId || payload.pricingChanged.productId === variables.productId;
      return matchesTenant && matchesCustomer && matchesProduct;
    },
  })
  pricingChanged(
    @Args('customerId', { type: () => ID, nullable: true }) customerId: string,
    @Args('productId', { type: () => ID, nullable: true }) productId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.debug(`Subscription: pricingChanged for tenant ${tenantId}, customer ${customerId || 'all'}, product ${productId || 'all'}`);
    return this.pubSub.asyncIterator('PRICING_CHANGED');
  }
}