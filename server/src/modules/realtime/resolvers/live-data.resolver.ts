import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { LiveInventoryService } from '../services/live-inventory.service';
import { LiveSalesDashboardService } from '../services/live-sales-dashboard.service';
import { LiveCustomerActivityService } from '../services/live-customer-activity.service';
import { LiveAnalyticsService } from '../services/live-analytics.service';

// GraphQL Types (these would typically be in separate files)
import { ObjectType, Field, ID, Float, Int, InputType } from '@nestjs/graphql';

@ObjectType()
export class LiveInventoryLevel {
  @Field(() => ID)
  productId!: string;

  @Field(() => ID, { nullable: true })
  variantId?: string | null;

  @Field(() => ID)
  locationId!: string;

  @Field(() => Int)
  currentLevel!: number;

  @Field(() => Int)
  availableLevel!: number;

  @Field(() => Int)
  reservedLevel!: number;

  @Field(() => Int)
  reorderPoint!: number;

  @Field()
  lastUpdated!: Date;

  @Field()
  status!: string;
}

@ObjectType()
export class SalesDashboardOverview {
  @Field(() => Float)
  totalSales!: number;

  @Field(() => Int)
  transactionCount!: number;

  @Field(() => Float)
  averageTransactionValue!: number;

  @Field(() => [HourlyBreakdown])
  hourlyBreakdown!: HourlyBreakdown[];
}

@ObjectType()
export class HourlyBreakdown {
  @Field(() => Int)
  hour!: number;

  @Field(() => Float)
  sales!: number;

  @Field(() => Int)
  transactions!: number;
}

@ObjectType()
export class CustomerActivity {
  @Field()
  type!: string;

  @Field(() => ID)
  customerId!: string;

  @Field({ nullable: true })
  customerName?: string | undefined;

  @Field({ nullable: true })
  customerEmail?: string | undefined;

  @Field(() => ID, { nullable: true })
  locationId?: string | undefined;

  @Field()
  timestamp!: Date;

  @Field()
  details!: string; // JSON string
}

@ObjectType()
export class AnalyticsOverview {
  @Field(() => Float)
  totalRevenue!: number;

  @Field(() => Int)
  totalTransactions!: number;

  @Field(() => Int)
  totalCustomers!: number;

  @Field(() => Int)
  totalProducts!: number;

  @Field(() => Float)
  averageOrderValue!: number;

  @Field(() => Float)
  conversionRate!: number;

  @Field()
  timestamp!: Date;
}

@ObjectType()
export class KPIMetric {
  @Field()
  name!: string;

  @Field(() => Float)
  value!: number;

  @Field()
  unit!: string;

  @Field(() => Float)
  change!: number;

  @Field()
  changeDirection!: string;

  @Field(() => Float, { nullable: true })
  target?: number | undefined;

  @Field()
  status!: string;

  @Field()
  timestamp!: Date;
}

@InputType()
export class InventorySubscriptionInput {
  @Field(() => [ID])
  productIds!: string[];

  @Field(() => ID, { nullable: true })
  locationId?: string;
}

@InputType()
export class SalesSubscriptionInput {
  @Field(() => ID, { nullable: true })
  locationId?: string;
}

@InputType()
export class CustomerActivitySubscriptionInput {
  @Field(() => ID, { nullable: true })
  customerId?: string;
}

@InputType()
export class AnalyticsSubscriptionInput {
  @Field(() => ID, { nullable: true })
  locationId?: string;
}

@Resolver()
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
export class LiveDataResolver {
  private readonly logger = new Logger(LiveDataResolver.name);

  constructor(
    private readonly liveInventoryService: LiveInventoryService,
    private readonly liveSalesDashboardService: LiveSalesDashboardService,
    private readonly liveCustomerActivityService: LiveCustomerActivityService,
    private readonly liveAnalyticsService: LiveAnalyticsService,
  ) {}

  // ===== INVENTORY QUERIES =====

  @Query(() => [LiveInventoryLevel])
  @RequireFeature('real-time-inventory')
  async liveInventoryLevels(
    @CurrentTenant() tenantId: string,
    @Args('productIds', { type: () => [String] }) productIds: string[],
    @Args('locationId', { nullable: true }) locationId?: string,
  ): Promise<LiveInventoryLevel[]> {
    const levels = await this.liveInventoryService.getLiveInventoryLevels(
      tenantId,
      productIds,
      locationId,
    );

    return levels.map(level => ({
      productId: level.productId,
      variantId: level.variantId || null,
      locationId: level.locationId,
      currentLevel: level.currentLevel,
      availableLevel: level.availableLevel,
      reservedLevel: level.reservedLevel,
      reorderPoint: level.reorderPoint,
      lastUpdated: level.lastUpdated,
      status: level.status,
    }));
  }

  @Query(() => String) // Would be a proper InventoryDashboard type
  @RequireFeature('real-time-inventory')
  async inventoryDashboard(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { nullable: true }) locationId?: string,
  ): Promise<string> {
    const dashboard = await this.liveInventoryService.getInventoryDashboardData(tenantId, locationId);
    return JSON.stringify(dashboard);
  }

  // ===== SALES QUERIES =====

  @Query(() => SalesDashboardOverview)
  @RequireFeature('real-time-sales')
  async salesDashboard(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { nullable: true }) locationId?: string,
  ): Promise<SalesDashboardOverview> {
    const dashboard = await this.liveSalesDashboardService.getSalesDashboardData(tenantId, locationId);
    
    return {
      totalSales: dashboard.today.totalSales,
      transactionCount: dashboard.today.transactionCount,
      averageTransactionValue: dashboard.today.averageTransactionValue,
      hourlyBreakdown: dashboard.today.hourlyBreakdown.map(hour => ({
        hour: hour.hour,
        sales: hour.sales,
        transactions: hour.transactions,
      })),
    };
  }

  @Query(() => String) // Would be a proper LiveSalesMetrics type
  @RequireFeature('real-time-sales')
  async liveSalesMetrics(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { nullable: true }) locationId?: string,
  ): Promise<string> {
    const metrics = await this.liveSalesDashboardService.getLiveSalesMetrics(tenantId, locationId);
    return JSON.stringify(metrics);
  }

  // ===== CUSTOMER ACTIVITY QUERIES =====

  @Query(() => [CustomerActivity])
  @RequireFeature('real-time-customer-activity')
  async customerActivityFeed(
    @CurrentTenant() tenantId: string,
    @Args('limit', { nullable: true, defaultValue: 50 }) limit?: number,
    @Args('customerId', { nullable: true }) customerId?: string,
    @Args('locationId', { nullable: true }) locationId?: string,
  ): Promise<CustomerActivity[]> {
    const options: any = { limit };
    if (customerId) options.customerId = customerId;
    if (locationId) options.locationId = locationId;

    const feed = await this.liveCustomerActivityService.getCustomerActivityFeed(tenantId, options);
    
    return feed.activities.map(activity => ({
      type: activity.type,
      customerId: activity.customerId,
      customerName: activity.customerName,
      customerEmail: activity.customerEmail,
      locationId: activity.locationId,
      timestamp: activity.timestamp,
      details: JSON.stringify(activity.details),
    }));
  }

  @Query(() => String) // Would be a proper CustomerEngagementMetrics type
  @RequireFeature('real-time-customer-activity')
  async customerEngagementMetrics(
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    const metrics = await this.liveCustomerActivityService.getCustomerEngagementMetrics(tenantId);
    return JSON.stringify(metrics);
  }

  // ===== ANALYTICS QUERIES =====

  @Query(() => AnalyticsOverview)
  @RequireFeature('real-time-analytics')
  async analyticsOverview(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { nullable: true }) locationId?: string,
  ): Promise<AnalyticsOverview> {
    const analytics = await this.liveAnalyticsService.getLiveAnalyticsData(tenantId, locationId);
    
    return {
      totalRevenue: analytics.overview.totalRevenue,
      totalTransactions: analytics.overview.totalTransactions,
      totalCustomers: analytics.overview.totalCustomers,
      totalProducts: analytics.overview.totalProducts,
      averageOrderValue: analytics.overview.averageOrderValue,
      conversionRate: analytics.overview.conversionRate,
      timestamp: analytics.overview.timestamp,
    };
  }

  @Query(() => [KPIMetric])
  @RequireFeature('real-time-analytics')
  async kpiMetrics(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { nullable: true }) locationId?: string,
  ): Promise<KPIMetric[]> {
    const metrics = await this.liveAnalyticsService.getKPIMetrics(tenantId, locationId);
    
    return metrics.map(metric => ({
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      change: metric.change,
      changeDirection: metric.changeDirection,
      target: metric.target,
      status: metric.status,
      timestamp: metric.timestamp,
    }));
  }

  @Query(() => String) // Would be a proper AnalyticsAlerts type
  @RequireFeature('real-time-analytics')
  async analyticsAlerts(
    @CurrentTenant() tenantId: string,
    @Args('severity', { nullable: true }) severity?: string,
    @Args('type', { nullable: true }) type?: string,
    @Args('locationId', { nullable: true }) locationId?: string,
    @Args('limit', { nullable: true, defaultValue: 50 }) limit?: number,
  ): Promise<string> {
    const options: any = { limit };
    if (severity) options.severity = severity;
    if (type) options.type = type;
    if (locationId) options.locationId = locationId;

    const alerts = await this.liveAnalyticsService.getAnalyticsAlerts(tenantId, options);
    return JSON.stringify(alerts);
  }

  // ===== MUTATIONS =====

  @Mutation(() => String)
  @RequireFeature('real-time-inventory')
  async subscribeToInventoryUpdates(
    @CurrentTenant() tenantId: string,
    @Args('input') input: InventorySubscriptionInput,
  ): Promise<string> {
    const subscription = await this.liveInventoryService.subscribeToInventoryUpdates(
      tenantId,
      input.productIds,
      input.locationId,
    );
    
    return JSON.stringify(subscription);
  }

  @Mutation(() => String)
  @RequireFeature('real-time-sales')
  async subscribeToSalesUpdates(
    @CurrentTenant() tenantId: string,
    @Args('input') input: SalesSubscriptionInput,
  ): Promise<string> {
    const subscription = await this.liveSalesDashboardService.subscribeToSalesUpdates(
      tenantId,
      input.locationId,
    );
    
    return JSON.stringify(subscription);
  }

  @Mutation(() => String)
  @RequireFeature('real-time-customer-activity')
  async subscribeToCustomerActivity(
    @CurrentTenant() tenantId: string,
    @Args('input') input: CustomerActivitySubscriptionInput,
  ): Promise<string> {
    const subscription = await this.liveCustomerActivityService.subscribeToCustomerActivity(
      tenantId,
      input.customerId,
    );
    
    return JSON.stringify(subscription);
  }

  @Mutation(() => String)
  @RequireFeature('real-time-analytics')
  async subscribeToAnalyticsUpdates(
    @CurrentTenant() tenantId: string,
    @Args('input') input: AnalyticsSubscriptionInput,
  ): Promise<string> {
    const subscription = await this.liveAnalyticsService.subscribeToAnalyticsUpdates(
      tenantId,
      input.locationId,
    );
    
    return JSON.stringify(subscription);
  }
}