import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
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

@ApiTags('Real-time Data')
@Controller('api/v1/realtime')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
export class LiveDataController {
  constructor(
    private readonly liveInventoryService: LiveInventoryService,
    private readonly liveSalesDashboardService: LiveSalesDashboardService,
    private readonly liveCustomerActivityService: LiveCustomerActivityService,
    private readonly liveAnalyticsService: LiveAnalyticsService,
  ) {}

  // ===== INVENTORY ENDPOINTS =====

  @Get('inventory/dashboard')
  @RequireFeature('real-time-inventory')
  @ApiOperation({ summary: 'Get real-time inventory dashboard data' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Inventory dashboard data retrieved successfully' })
  async getInventoryDashboard(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.liveInventoryService.getInventoryDashboardData(tenantId, locationId);
  }

  @Get('inventory/levels')
  @RequireFeature('real-time-inventory')
  @ApiOperation({ summary: 'Get live inventory levels for specific products' })
  @ApiQuery({ name: 'productIds', required: true, description: 'Comma-separated product IDs' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Live inventory levels retrieved successfully' })
  async getLiveInventoryLevels(
    @CurrentTenant() tenantId: string,
    @Query('productIds') productIds: string,
    @Query('locationId') locationId?: string,
  ) {
    const productIdArray = productIds.split(',').map(id => id.trim());
    return this.liveInventoryService.getLiveInventoryLevels(tenantId, productIdArray, locationId);
  }

  @Post('inventory/subscribe')
  @RequireFeature('real-time-inventory')
  @ApiOperation({ summary: 'Subscribe to inventory updates for specific products' })
  @ApiResponse({ status: 201, description: 'Inventory subscription created successfully' })
  async subscribeToInventoryUpdates(
    @CurrentTenant() tenantId: string,
    @Body() body: { productIds: string[]; locationId?: string },
  ) {
    return this.liveInventoryService.subscribeToInventoryUpdates(
      tenantId,
      body.productIds,
      body.locationId,
    );
  }

  // ===== SALES DASHBOARD ENDPOINTS =====

  @Get('sales/dashboard')
  @RequireFeature('real-time-sales')
  @ApiOperation({ summary: 'Get real-time sales dashboard data' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Sales dashboard data retrieved successfully' })
  async getSalesDashboard(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.liveSalesDashboardService.getSalesDashboardData(tenantId, locationId);
  }

  @Get('sales/metrics')
  @RequireFeature('real-time-sales')
  @ApiOperation({ summary: 'Get live sales metrics' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Live sales metrics retrieved successfully' })
  async getLiveSalesMetrics(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.liveSalesDashboardService.getLiveSalesMetrics(tenantId, locationId);
  }

  @Get('sales/hourly-breakdown')
  @RequireFeature('real-time-sales')
  @ApiOperation({ summary: 'Get hourly sales breakdown for today' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Hourly sales breakdown retrieved successfully' })
  async getHourlySalesBreakdown(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.liveSalesDashboardService.getHourlySalesBreakdown(tenantId, locationId);
  }

  @Post('sales/subscribe')
  @RequireFeature('real-time-sales')
  @ApiOperation({ summary: 'Subscribe to live sales updates' })
  @ApiResponse({ status: 201, description: 'Sales subscription created successfully' })
  async subscribeToSalesUpdates(
    @CurrentTenant() tenantId: string,
    @Body() body: { locationId?: string },
  ) {
    return this.liveSalesDashboardService.subscribeToSalesUpdates(tenantId, body.locationId);
  }

  // ===== CUSTOMER ACTIVITY ENDPOINTS =====

  @Get('customers/activity-feed')
  @RequireFeature('real-time-customer-activity')
  @ApiOperation({ summary: 'Get live customer activity feed' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of activities to return' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Filter by customer ID' })
  @ApiQuery({ name: 'activityTypes', required: false, description: 'Comma-separated activity types' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Customer activity feed retrieved successfully' })
  async getCustomerActivityFeed(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
    @Query('customerId') customerId?: string,
    @Query('activityTypes') activityTypes?: string,
    @Query('locationId') locationId?: string,
  ) {
    const options: any = {};
    if (limit) options.limit = parseInt(limit, 10);
    if (customerId) options.customerId = customerId;
    if (activityTypes) options.activityTypes = activityTypes.split(',').map(t => t.trim());
    if (locationId) options.locationId = locationId;

    return this.liveCustomerActivityService.getCustomerActivityFeed(tenantId, options);
  }

  @Get('customers/engagement-metrics')
  @RequireFeature('real-time-customer-activity')
  @ApiOperation({ summary: 'Get customer engagement metrics' })
  @ApiResponse({ status: 200, description: 'Customer engagement metrics retrieved successfully' })
  async getCustomerEngagementMetrics(@CurrentTenant() tenantId: string) {
    return this.liveCustomerActivityService.getCustomerEngagementMetrics(tenantId);
  }

  @Get('customers/:customerId/activity-history')
  @RequireFeature('real-time-customer-activity')
  @ApiOperation({ summary: 'Get activity history for a specific customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of activities to return' })
  @ApiResponse({ status: 200, description: 'Customer activity history retrieved successfully' })
  async getCustomerActivityHistory(
    @CurrentTenant() tenantId: string,
    @Param('customerId') customerId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.liveCustomerActivityService.getCustomerActivityHistory(tenantId, customerId, limitNum);
  }

  @Post('customers/activity/subscribe')
  @RequireFeature('real-time-customer-activity')
  @ApiOperation({ summary: 'Subscribe to customer activity updates' })
  @ApiResponse({ status: 201, description: 'Customer activity subscription created successfully' })
  async subscribeToCustomerActivity(
    @CurrentTenant() tenantId: string,
    @Body() body: { customerId?: string },
  ) {
    return this.liveCustomerActivityService.subscribeToCustomerActivity(tenantId, body.customerId);
  }

  // ===== ANALYTICS ENDPOINTS =====

  @Get('analytics/dashboard')
  @RequireFeature('real-time-analytics')
  @ApiOperation({ summary: 'Get live analytics dashboard data' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Analytics dashboard data retrieved successfully' })
  async getAnalyticsDashboard(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.liveAnalyticsService.getLiveAnalyticsData(tenantId, locationId);
  }

  @Get('analytics/kpi-metrics')
  @RequireFeature('real-time-analytics')
  @ApiOperation({ summary: 'Get real-time KPI metrics' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'KPI metrics retrieved successfully' })
  async getKPIMetrics(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.liveAnalyticsService.getKPIMetrics(tenantId, locationId);
  }

  @Get('analytics/alerts')
  @RequireFeature('real-time-analytics')
  @ApiOperation({ summary: 'Get analytics alerts' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by severity (info, warning, critical)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by alert type' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of alerts to return' })
  @ApiResponse({ status: 200, description: 'Analytics alerts retrieved successfully' })
  async getAnalyticsAlerts(
    @CurrentTenant() tenantId: string,
    @Query('severity') severity?: 'info' | 'warning' | 'critical',
    @Query('type') type?: string,
    @Query('locationId') locationId?: string,
    @Query('limit') limit?: string,
  ) {
    const options: any = {};
    if (severity) options.severity = severity;
    if (type) options.type = type;
    if (locationId) options.locationId = locationId;
    if (limit) options.limit = parseInt(limit, 10);

    return this.liveAnalyticsService.getAnalyticsAlerts(tenantId, options);
  }

  @Post('analytics/alerts')
  @RequireFeature('real-time-analytics')
  @ApiOperation({ summary: 'Create a custom analytics alert' })
  @ApiResponse({ status: 201, description: 'Analytics alert created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createAnalyticsAlert(
    @CurrentTenant() tenantId: string,
    @Body() alertData: {
      type: 'performance' | 'inventory' | 'customer' | 'financial' | 'operational';
      severity: 'info' | 'warning' | 'critical';
      title: string;
      message: string;
      data: Record<string, any>;
      threshold?: {
        metric: string;
        value: number;
        operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
      };
      locationId?: string;
    },
  ) {
    return this.liveAnalyticsService.createAnalyticsAlert(tenantId, alertData);
  }

  @Get('analytics/performance-comparison')
  @RequireFeature('real-time-analytics')
  @ApiOperation({ summary: 'Get performance comparison data' })
  @ApiQuery({ name: 'period', required: true, description: 'Comparison period (hour, day, week, month)' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiResponse({ status: 200, description: 'Performance comparison data retrieved successfully' })
  async getPerformanceComparison(
    @CurrentTenant() tenantId: string,
    @Query('period') period: 'hour' | 'day' | 'week' | 'month',
    @Query('locationId') locationId?: string,
  ) {
    return this.liveAnalyticsService.getPerformanceComparison(tenantId, period, locationId);
  }

  @Post('analytics/subscribe')
  @RequireFeature('real-time-analytics')
  @ApiOperation({ summary: 'Subscribe to live analytics updates' })
  @ApiResponse({ status: 201, description: 'Analytics subscription created successfully' })
  async subscribeToAnalyticsUpdates(
    @CurrentTenant() tenantId: string,
    @Body() body: { locationId?: string },
  ) {
    return this.liveAnalyticsService.subscribeToAnalyticsUpdates(tenantId, body.locationId);
  }

  // ===== GENERAL REAL-TIME ENDPOINTS =====

  @Get('connection-stats')
  @RequireFeature('real-time-updates')
  @ApiOperation({ summary: 'Get real-time connection statistics' })
  @ApiResponse({ status: 200, description: 'Connection statistics retrieved successfully' })
  async getConnectionStats(@CurrentUser() user: AuthenticatedUser) {
    // Only allow admins to see connection stats
    if (!user.permissions?.includes('admin')) {
      return { message: 'Access denied' };
    }
    
    // This would integrate with the RealtimeService
    return {
      totalConnections: 0,
      tenantConnections: 0,
      averageConnectionTime: 0,
      lastHealthCheck: new Date(),
    };
  }

  @Post('test-notification')
  @RequireFeature('real-time-updates')
  @ApiOperation({ summary: 'Send a test notification (admin only)' })
  @ApiResponse({ status: 200, description: 'Test notification sent successfully' })
  async sendTestNotification(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: {
      type: 'info' | 'warning' | 'error' | 'success';
      title: string;
      message: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    },
  ) {
    // Only allow admins to send test notifications
    if (!user.permissions?.includes('admin')) {
      return { message: 'Access denied' };
    }

    // This would integrate with the RealtimeService to send a test notification
    return {
      message: 'Test notification sent successfully',
      notification: {
        id: `test-${Date.now()}`,
        ...body,
        timestamp: new Date(),
      },
    };
  }
}