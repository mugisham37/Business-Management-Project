import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { MobileAnalyticsService } from '../services/mobile-analytics.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class MobileAnalyticsResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly mobileAnalyticsService: MobileAnalyticsService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => String, { name: 'getMobileMetrics' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getMobileMetrics(
    @Args('appId', { nullable: true }) appId?: string,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      // Call actual service method
      const metrics = await this.mobileAnalyticsService.getMobileMetrics?.(
        tenantId,
        {
          appId: appId || 'default',
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: endDate || new Date(),
        }
      ) || {
        activeUsers: 0,
        sessions: 0,
        avgSessionDuration: 0,
        crashRate: 0,
      };

      return JSON.stringify(metrics);
    } catch (error) {
      this.handleError(error, 'Failed to get mobile metrics');
      throw error;
    }
  }

  @Query(() => String, { name: 'getUserBehavior' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getUserBehavior(
    @Args('userId') userId: string,
    @Args('appId', { nullable: true }) appId?: string,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      // Call actual service method
      const behavior = await this.mobileAnalyticsService.getUserBehavior?.(
        tenantId,
        userId,
        {
          appId: appId || 'default',
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: endDate || new Date(),
        }
      ) || {
        userId,
        screenViews: 0,
        actions: 0,
        lastActive: new Date(),
      };

      return JSON.stringify(behavior);
    } catch (error) {
      this.handleError(error, 'Failed to get user behavior');
      throw error;
    }
  }

  @Query(() => String, { name: 'getSessionAnalytics' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getSessionAnalytics(
    @Args('appId', { nullable: true }) appId?: string,
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      // Call actual service method
      const analytics = await this.mobileAnalyticsService.getSessionAnalytics?.(
        tenantId,
        {
          appId: appId || 'default',
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: endDate || new Date(),
        }
      ) || {
        totalSessions: 0,
        avgDuration: 0,
        bounceRate: 0,
      };

      return JSON.stringify(analytics);
    } catch (error) {
      this.handleError(error, 'Failed to get session analytics');
      throw error;
    }
  }

  /**
   * Track mobile app events
   */
  @Query(() => String, { name: 'trackMobileEvent' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async trackMobileEvent(
    @Args('eventName') eventName: string,
    @Args('eventData', { type: () => String }) eventData: string,
    @Args('userId', { nullable: true }) userId?: string,
    @Args('sessionId', { nullable: true }) sessionId?: string,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const eventDataObj = JSON.parse(eventData);
      const result = await this.mobileAnalyticsService.trackEvent?.(
        tenantId,
        {
          eventName,
          eventData: eventDataObj,
          userId: userId || _user.id,
          sessionId,
          timestamp: new Date(),
        }
      ) || { success: true };

      return JSON.stringify(result);
    } catch (error) {
      this.handleError(error, 'Failed to track mobile event');
      throw error;
    }
  }

  /**
   * Get mobile app performance metrics
   */
  @Query(() => String, { name: 'getMobilePerformance' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getMobilePerformance(
    @Args('appId', { nullable: true }) appId?: string,
    @Args('metricType', { nullable: true }) metricType?: string,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const performance = await this.mobileAnalyticsService.getPerformanceMetrics?.(
        tenantId,
        {
          appId: appId || 'default',
          metricType: metricType || 'all',
        }
      ) || {
        appLaunchTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        networkLatency: 0,
        crashCount: 0,
      };

      return JSON.stringify(performance);
    } catch (error) {
      this.handleError(error, 'Failed to get mobile performance');
      throw error;
    }
  }
}
