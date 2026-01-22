import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { AnalyticsAPIService } from '../services/analytics-api.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { Dashboard, WidgetData } from '../types/analytics.types';

@Resolver()
@UseGuards(JwtAuthGuard)
export class DashboardResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly analyticsAPIService: AnalyticsAPIService,
    private readonly cacheService: IntelligentCacheService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => Dashboard, { name: 'getDashboard' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getDashboard(
    @Args('dashboardId', { type: () => ID }) dashboardId: string,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Dashboard> {
    try {
      const { dashboard } = await this.analyticsAPIService.getDashboardData(tenantId, dashboardId);
      return {
        id: dashboard.id,
        tenantId: dashboard.tenantId,
        name: dashboard.name,
        description: dashboard.description ?? '',
        widgets: dashboard.widgets.map((w: any) => ({
          id: w.id,
          title: w.title,
          type: w.type,
          data: JSON.stringify(w.data || {}),
          x: w.position?.x || 0,
          y: w.position?.y || 0,
          width: w.position?.width || 4,
          height: w.position?.height || 4,
        })),
        isPublic: dashboard.isPublic ?? false,
        createdAt: dashboard.createdAt ?? new Date(),
        updatedAt: dashboard.updatedAt ?? new Date(),
        createdBy: dashboard.createdBy ?? '',
        version: 1,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get dashboard');
      throw error;
    }
  }

  @Mutation(() => Dashboard, { name: 'createDashboard' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:write')
  async createDashboard(
    @Args('name') name: string,
    @Args('description', { nullable: true }) description: string | undefined,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<Dashboard> {
    try {
      const dashboardId = `dash_${Date.now()}`;
      const dashboard: Dashboard = {
        id: dashboardId,
        tenantId,
        name,
        description: description ?? '',
        widgets: [],
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user.id,
        version: 1,
      };

      // Cache the dashboard
      await this.cacheService.set(`dashboard:${tenantId}:${dashboardId}`, dashboard, { ttl: 3600 });

      return dashboard;
    } catch (error) {
      this.handleError(error, 'Failed to create dashboard');
      throw error;
    }
  }

  @Query(() => WidgetData, { name: 'getWidgetData' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getWidgetData(
    @Args('widgetId', { type: () => ID }) widgetId: string,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<WidgetData> {
    try {
      const cacheKey = `widget:${tenantId}:${widgetId}`;
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return {
          widgetId,
          data: JSON.stringify(cached),
          updatedAt: new Date(),
          fromCache: true,
        };
      }

      // Mock data for now
      const data = { value: Math.random() * 1000 };
      await this.cacheService.set(cacheKey, data, { ttl: 300 });

      return {
        widgetId,
        data: JSON.stringify(data),
        updatedAt: new Date(),
        fromCache: false,
      };
    } catch (error) {
      this.handleError(error, 'Failed to get widget data');
      throw error;
    }
  }
}
