import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { CurrentTenant } from '../decorators/tenant.decorators';
import { Tenant, BusinessTier } from '../entities/tenant.entity';
import { FeatureFlag } from '../entities/feature-flag.entity';

/**
 * PubSub instance for tenant subscriptions
 * Using any type cast for compatibility with graphql-subscriptions v3.x
 */
const pubSub: any = new PubSub();

/**
 * Subscription event names
 */
const SUBSCRIPTION_EVENTS = {
  TENANT_UPDATED: 'tenantUpdated',
  METRICS_UPDATED: 'metricsUpdated',
  TIER_CHANGED: 'tierChanged',
  FEATURE_FLAG_CHANGED: 'featureFlagChanged',
  SUBSCRIPTION_STATUS_CHANGED: 'subscriptionStatusChanged',
  TENANT_ACTIVITY: 'tenantActivity',
} as const;

/**
 * GraphQL Subscriptions for real-time tenant updates
 */
@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantSubscriptionsResolver {
  constructor() {}

  /**
   * Subscribe to tenant updates
   */
  @Subscription(() => Tenant, {
    name: 'tenantUpdated',
    filter: (payload, variables) => {
      return payload.tenantUpdated.id === variables.tenantId;
    },
  })
  tenantUpdated(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @CurrentTenant() currentTenantId: string,
  ) {
    // Ensure user can only subscribe to their own tenant
    if (tenantId !== currentTenantId) {
      throw new Error('Access denied: Cannot subscribe to other tenant updates');
    }
    return pubSub.asyncIterator(SUBSCRIPTION_EVENTS.TENANT_UPDATED);
  }

  /**
   * Subscribe to business metrics updates
   */
  @Subscription(() => String, {
    name: 'metricsUpdated',
    filter: (payload, variables) => {
      return payload.metricsUpdated.tenantId === variables.tenantId;
    },
  })
  metricsUpdated(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @CurrentTenant() currentTenantId: string,
  ) {
    if (tenantId !== currentTenantId) {
      throw new Error('Access denied: Cannot subscribe to other tenant metrics');
    }
    return pubSub.asyncIterator(SUBSCRIPTION_EVENTS.METRICS_UPDATED);
  }

  /**
   * Subscribe to tier changes
   */
  @Subscription(() => String, {
    name: 'tierChanged',
    filter: (payload, variables) => {
      return payload.tierChanged.tenantId === variables.tenantId;
    },
  })
  tierChanged(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @CurrentTenant() currentTenantId: string,
  ) {
    if (tenantId !== currentTenantId) {
      throw new Error('Access denied: Cannot subscribe to other tenant tier changes');
    }
    return pubSub.asyncIterator(SUBSCRIPTION_EVENTS.TIER_CHANGED);
  }

  /**
   * Subscribe to feature flag changes
   */
  @Subscription(() => FeatureFlag, {
    name: 'featureFlagChanged',
    filter: (payload, variables) => {
      return payload.featureFlagChanged.tenantId === variables.tenantId;
    },
  })
  featureFlagChanged(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @CurrentTenant() currentTenantId: string,
  ) {
    if (tenantId !== currentTenantId) {
      throw new Error('Access denied: Cannot subscribe to other tenant feature flags');
    }
    return pubSub.asyncIterator(SUBSCRIPTION_EVENTS.FEATURE_FLAG_CHANGED);
  }

  /**
   * Subscribe to subscription status changes
   */
  @Subscription(() => String, {
    name: 'subscriptionStatusChanged',
    filter: (payload, variables) => {
      return payload.subscriptionStatusChanged.tenantId === variables.tenantId;
    },
  })
  subscriptionStatusChanged(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @CurrentTenant() currentTenantId: string,
  ) {
    if (tenantId !== currentTenantId) {
      throw new Error('Access denied: Cannot subscribe to other tenant subscription changes');
    }
    return pubSub.asyncIterator(SUBSCRIPTION_EVENTS.SUBSCRIPTION_STATUS_CHANGED);
  }

  /**
   * Subscribe to tenant activity events
   */
  @Subscription(() => String, {
    name: 'tenantActivity',
    filter: (payload, variables) => {
      return payload.tenantActivity.tenantId === variables.tenantId;
    },
  })
  tenantActivity(
    @Args('tenantId', { type: () => ID }) tenantId: string,
    @CurrentTenant() currentTenantId: string,
  ) {
    if (tenantId !== currentTenantId) {
      throw new Error('Access denied: Cannot subscribe to other tenant activity');
    }
    return pubSub.asyncIterator(SUBSCRIPTION_EVENTS.TENANT_ACTIVITY);
  }

  /**
   * Static method to publish tenant updates
   */
  static publishTenantUpdate(tenant: Tenant): void {
    pubSub.publish(SUBSCRIPTION_EVENTS.TENANT_UPDATED, { tenantUpdated: tenant });
  }

  /**
   * Static method to publish metrics updates
   */
  static publishMetricsUpdate(tenantId: string, metrics: any): void {
    pubSub.publish(SUBSCRIPTION_EVENTS.METRICS_UPDATED, { 
      metricsUpdated: { tenantId, metrics, timestamp: new Date() } 
    });
  }

  /**
   * Static method to publish tier changes
   */
  static publishTierChange(tenantId: string, previousTier: BusinessTier, newTier: BusinessTier): void {
    pubSub.publish(SUBSCRIPTION_EVENTS.TIER_CHANGED, { 
      tierChanged: { tenantId, previousTier, newTier, timestamp: new Date() } 
    });
  }

  /**
   * Static method to publish feature flag changes
   */
  static publishFeatureFlagChange(featureFlag: FeatureFlag): void {
    pubSub.publish(SUBSCRIPTION_EVENTS.FEATURE_FLAG_CHANGED, { featureFlagChanged: featureFlag });
  }

  /**
   * Static method to publish subscription status changes
   */
  static publishSubscriptionStatusChange(tenantId: string, status: string): void {
    pubSub.publish(SUBSCRIPTION_EVENTS.SUBSCRIPTION_STATUS_CHANGED, { 
      subscriptionStatusChanged: { tenantId, status, timestamp: new Date() } 
    });
  }

  /**
   * Static method to publish tenant activity
   */
  static publishTenantActivity(tenantId: string, activity: any): void {
    pubSub.publish(SUBSCRIPTION_EVENTS.TENANT_ACTIVITY, { 
      tenantActivity: { tenantId, ...activity, timestamp: new Date() } 
    });
  }
}

// Export pubSub for use in services
export { pubSub };
