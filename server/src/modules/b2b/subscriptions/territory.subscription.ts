import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

/**
 * GraphQL subscription resolver for territory real-time updates
 * 
 * Provides real-time notifications for:
 * - Territory assignments and changes
 * - Sales performance milestones
 * - Customer territory migrations
 * - Quota updates and achievements
 * - Commission calculations
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class TerritorySubscriptionResolver {
  private readonly logger = new Logger(TerritorySubscriptionResolver.name);

  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Subscription: Territory assignment changed
   * Emitted when territory assignments are updated
   */
  @Subscription(() => Object, {
    name: 'territoryAssignmentChanged',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.territoryAssignmentChanged.tenantId === context.req.user.tenantId;
      const matchesTerritory = !variables.territoryId || payload.territoryAssignmentChanged.territoryId === variables.territoryId;
      
      // Show to affected sales rep, territory managers, or users with territory permissions
      const isAffectedSalesRep = payload.territoryAssignmentChanged.salesRepId === context.req.user.id;
      const canViewTerritories = context.req.user.permissions?.includes('territory:read');
      
      return matchesTenant && matchesTerritory && (isAffectedSalesRep || canViewTerritories);
    },
  })
  territoryAssignmentChanged(
    @Args('territoryId', { type: () => ID, nullable: true }) territoryId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: territoryAssignmentChanged for tenant ${tenantId}, territory ${territoryId || 'all'}`);
    return this.pubSub.asyncIterator([
      'SALES_REP_ASSIGNED',
      'SALES_REP_UNASSIGNED',
      'TERRITORY_REASSIGNED'
    ]);
  }

  /**
   * Subscription: Customer territory changed
   * Emitted when a customer is moved between territories
   */
  @Subscription(() => Object, {
    name: 'customerTerritoryChanged',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.customerTerritoryChanged.tenantId === context.req.user.tenantId;
      const matchesCustomer = !variables.customerId || payload.customerTerritoryChanged.customerId === variables.customerId;
      
      // Show to affected sales reps (old and new) or users with territory permissions
      const isOldSalesRep = payload.customerTerritoryChanged.oldTerritory?.salesRepId === context.req.user.id;
      const isNewSalesRep = payload.customerTerritoryChanged.newTerritory?.salesRepId === context.req.user.id;
      const canViewTerritories = context.req.user.permissions?.includes('territory:read');
      
      return matchesTenant && matchesCustomer && (isOldSalesRep || isNewSalesRep || canViewTerritories);
    },
  })
  customerTerritoryChanged(
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: customerTerritoryChanged for tenant ${tenantId}, customer ${customerId || 'all'}`);
    return this.pubSub.asyncIterator('CUSTOMER_TERRITORY_CHANGED');
  }

  /**
   * Subscription: Territory performance milestone
   * Emitted when a territory reaches a performance milestone
   */
  @Subscription(() => Object, {
    name: 'territoryPerformanceMilestone',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.territoryMilestone.tenantId === context.req.user.tenantId;
      const matchesTerritory = !variables.territoryId || payload.territoryMilestone.territoryId === variables.territoryId;
      
      // Show to territory sales rep, managers, or users with analytics permissions
      const isTerritoryRep = payload.territoryMilestone.territory?.salesRepId === context.req.user.id;
      const canViewAnalytics = context.req.user.permissions?.includes('analytics:read') ||
                              context.req.user.permissions?.includes('territory:analytics');
      
      return matchesTenant && matchesTerritory && (isTerritoryRep || canViewAnalytics);
    },
  })
  territoryPerformanceMilestone(
    @Args('territoryId', { type: () => ID, nullable: true }) territoryId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: territoryPerformanceMilestone for tenant ${tenantId}, territory ${territoryId || 'all'}`);
    return this.pubSub.asyncIterator('TERRITORY_MILESTONE');
  }

  /**
   * Subscription: Territory quota updated
   * Emitted when territory quotas are updated
   */
  @Subscription(() => Object, {
    name: 'territoryQuotaUpdated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.territoryQuotaUpdated.tenantId === context.req.user.tenantId;
      const matchesTerritory = !variables.territoryId || payload.territoryQuotaUpdated.territoryId === variables.territoryId;
      
      // Show to territory sales rep, managers, or users with territory management permissions
      const isTerritoryRep = payload.territoryQuotaUpdated.territory?.salesRepId === context.req.user.id;
      const canManageTerritories = context.req.user.permissions?.includes('territory:manage');
      
      return matchesTenant && matchesTerritory && (isTerritoryRep || canManageTerritories);
    },
  })
  territoryQuotaUpdated(
    @Args('territoryId', { type: () => ID, nullable: true }) territoryId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: territoryQuotaUpdated for tenant ${tenantId}, territory ${territoryId || 'all'}`);
    return this.pubSub.asyncIterator('TERRITORY_QUOTA_UPDATED');
  }

  /**
   * Subscription: Commission calculated
   * Emitted when commissions are calculated for a territory
   */
  @Subscription(() => Object, {
    name: 'commissionCalculated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.commissionCalculated.tenantId === context.req.user.tenantId;
      const matchesSalesRep = !variables.salesRepId || payload.commissionCalculated.salesRepId === variables.salesRepId;
      
      // Show to the sales rep earning the commission or users with commission permissions
      const isEarningSalesRep = payload.commissionCalculated.salesRepId === context.req.user.id;
      const canViewCommissions = context.req.user.permissions?.includes('commission:read');
      
      return matchesTenant && matchesSalesRep && (isEarningSalesRep || canViewCommissions);
    },
  })
  commissionCalculated(
    @Args('salesRepId', { type: () => ID, nullable: true }) salesRepId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: commissionCalculated for tenant ${tenantId}, salesRep ${salesRepId || 'all'}`);
    return this.pubSub.asyncIterator('COMMISSION_CALCULATED');
  }

  /**
   * Subscription: Territory analytics updated
   * Emitted when territory performance analytics are updated
   */
  @Subscription(() => Object, {
    name: 'territoryAnalyticsUpdated',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.territoryAnalyticsUpdated.tenantId === context.req.user.tenantId;
      const canViewAnalytics = context.req.user.permissions?.includes('analytics:read') ||
                              context.req.user.permissions?.includes('territory:analytics');
      
      return matchesTenant && canViewAnalytics;
    },
  })
  territoryAnalyticsUpdated(@CurrentTenant() tenantId?: string) {
    this.logger.debug(`Subscription: territoryAnalyticsUpdated for tenant ${tenantId}`);
    return this.pubSub.asyncIterator('TERRITORY_ANALYTICS_UPDATED');
  }

  /**
   * Subscription: Sales target achievement
   * Emitted when a sales rep achieves their sales targets
   */
  @Subscription(() => Object, {
    name: 'salesTargetAchievement',
    filter: (payload, variables, context) => {
      const matchesTenant = payload.salesTargetAchievement.tenantId === context.req.user.tenantId;
      const matchesSalesRep = !variables.salesRepId || payload.salesTargetAchievement.salesRepId === variables.salesRepId;
      
      // Show to the achieving sales rep, their manager, or users with analytics permissions
      const isAchievingSalesRep = payload.salesTargetAchievement.salesRepId === context.req.user.id;
      const canViewAnalytics = context.req.user.permissions?.includes('analytics:read');
      
      return matchesTenant && matchesSalesRep && (isAchievingSalesRep || canViewAnalytics);
    },
  })
  salesTargetAchievement(
    @Args('salesRepId', { type: () => ID, nullable: true }) salesRepId?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    this.logger.debug(`Subscription: salesTargetAchievement for tenant ${tenantId}, salesRep ${salesRepId || 'all'}`);
    return this.pubSub.asyncIterator('SALES_TARGET_ACHIEVEMENT');
  }
}