import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  Headers,
  UseGuards, 
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/require-feature.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

import { 
  MobileAnalyticsService,
  MobileDashboard,
  MobileReport,
  MobileWidget,
  MobileVisualization
} from '../services/mobile-analytics.service';

export class CreateMobileDashboardDto {
  name: string;
  description: string;
  configuration: {
    layout: {
      type: 'stack' | 'grid' | 'carousel';
      orientation: 'portrait' | 'landscape' | 'adaptive';
      spacing: number;
      padding: number;
      backgroundColor?: string;
      headerConfig?: {
        show: boolean;
        height: number;
        title: string;
        showRefresh: boolean;
        showFilters: boolean;
      };
    };
    widgets: MobileWidget[];
    theme: 'light' | 'dark' | 'auto';
    refreshInterval: number;
    offlineCapable: boolean;
  };
}

export class CreateMobileReportDto {
  name: string;
  description: string;
  configuration: {
    query: string;
    parameters: any[];
    filters: any[];
    visualization: MobileVisualization;
    exportFormats: ('pdf' | 'csv' | 'image')[];
  };
  mobileOptimizations: {
    compressData: boolean;
    limitRows: number;
    useAggregation: boolean;
    cacheResults: boolean;
    offlineAvailable: boolean;
  };
  sharing: {
    allowOfflineSharing: boolean;
    requireAuthentication: boolean;
    expirationDays?: number;
  };
}

export class ExecuteMobileReportDto {
  parameters?: Record<string, any>;
  filters?: Record<string, any>;
  format?: 'json' | 'csv' | 'image';
}

export class SyncOfflineDataDto {
  syncType?: 'full' | 'incremental';
  entityTypes?: ('dashboard' | 'report' | 'widget')[];
  maxDataSize?: number;
}

interface DeviceInfo {
  type: 'phone' | 'tablet';
  os: 'ios' | 'android' | 'web';
  version: string;
  screenWidth: number;
  screenHeight: number;
  connectionType: 'wifi' | 'cellular' | 'offline';
}

@Controller('api/v1/analytics/mobile')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-analytics')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Mobile Analytics')
export class MobileAnalyticsController {
  constructor(
    private readonly mobileAnalyticsService: MobileAnalyticsService,
  ) {}

  // Mobile Dashboard Endpoints

  @Post('dashboards')
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a mobile-optimized dashboard' })
  @ApiResponse({ status: 201, description: 'Mobile dashboard created successfully', type: Object })
  async createMobileDashboard(
    @Body(ValidationPipe) createDashboardDto: CreateMobileDashboardDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MobileDashboard> {
    return this.mobileAnalyticsService.createMobileDashboard(tenantId, user.id, createDashboardDto);
  }

  @Get('dashboards')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'List mobile dashboards' })
  @ApiResponse({ status: 200, description: 'Mobile dashboards retrieved successfully' })
  async listMobileDashboards(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MobileDashboard[]> {
    // Implementation would list mobile dashboards
    // For now, return empty array
    return [];
  }

  @Get('dashboards/:dashboardId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get mobile dashboard with optimized data' })
  @ApiResponse({ status: 200, description: 'Mobile dashboard data retrieved successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string', description: 'Dashboard ID' })
  @ApiHeader({ name: 'X-Device-Type', required: false, description: 'Device type (phone/tablet)' })
  @ApiHeader({ name: 'X-Connection-Type', required: false, description: 'Connection type (wifi/cellular/offline)' })
  @ApiHeader({ name: 'X-Screen-Width', required: false, description: 'Screen width in pixels' })
  @ApiHeader({ name: 'X-Screen-Height', required: false, description: 'Screen height in pixels' })
  @ApiQuery({ name: 'forceRefresh', required: false, type: Boolean })
  async getMobileDashboard(
    @Param('dashboardId') dashboardId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('X-Device-Type') deviceType?: 'phone' | 'tablet',
    @Headers('X-Connection-Type') connectionType?: 'wifi' | 'cellular' | 'offline',
    @Headers('X-Screen-Width') screenWidth?: string,
    @Headers('X-Screen-Height') screenHeight?: string,
    @Query('forceRefresh') forceRefresh?: boolean,
  ): Promise<{
    dashboard: MobileDashboard;
    widgets: Array<{
      id: string;
      data: any;
      metadata: {
        lastUpdated: Date;
        fromCache: boolean;
        dataSize: number;
        loadTime: number;
      };
    }>;
    optimizations: {
      dataCompressed: boolean;
      imagesOptimized: boolean;
      queriesSimplified: boolean;
    };
  }> {
    const options = {
      deviceType,
      connectionType,
      screenSize: screenWidth && screenHeight ? {
        width: parseInt(screenWidth),
        height: parseInt(screenHeight),
      } : undefined,
      forceRefresh,
    };

    return this.mobileAnalyticsService.getMobileDashboard(tenantId, dashboardId, user.id, options);
  }

  @Put('dashboards/:dashboardId')
  @RequirePermission('analytics:edit')
  @ApiOperation({ summary: 'Update mobile dashboard' })
  @ApiResponse({ status: 200, description: 'Mobile dashboard updated successfully', type: Object })
  @ApiParam({ name: 'dashboardId', type: 'string', description: 'Dashboard ID' })
  async updateMobileDashboard(
    @Param('dashboardId') dashboardId: string,
    @Body(ValidationPipe) updateDashboardDto: Partial<CreateMobileDashboardDto>,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MobileDashboard> {
    // Implementation would update mobile dashboard
    // For now, return mock dashboard
    return {
      id: dashboardId,
      name: updateDashboardDto.name || 'Updated Mobile Dashboard',
      description: updateDashboardDto.description || 'Updated description',
      tenantId,
      createdBy: user.id,
      configuration: updateDashboardDto.configuration || {
        layout: {
          type: 'stack',
          orientation: 'portrait',
          spacing: 16,
          padding: 16,
        },
        widgets: [],
        theme: 'light',
        refreshInterval: 300,
        offlineCapable: false,
      },
      metadata: {
        category: 'mobile',
        tags: [],
        lastViewed: new Date(),
        viewCount: 1,
        deviceTypes: ['phone', 'tablet'],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Mobile Report Endpoints

  @Post('reports')
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a mobile-optimized report' })
  @ApiResponse({ status: 201, description: 'Mobile report created successfully', type: Object })
  async createMobileReport(
    @Body(ValidationPipe) createReportDto: CreateMobileReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MobileReport> {
    return this.mobileAnalyticsService.createMobileReport(tenantId, user.id, createReportDto);
  }

  @Get('reports')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'List mobile reports' })
  @ApiResponse({ status: 200, description: 'Mobile reports retrieved successfully' })
  async listMobileReports(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MobileReport[]> {
    // Implementation would list mobile reports
    // For now, return empty array
    return [];
  }

  @Post('reports/:reportId/execute')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute mobile report with optimizations' })
  @ApiResponse({ status: 200, description: 'Mobile report executed successfully' })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID' })
  @ApiHeader({ name: 'X-Device-Type', required: false, description: 'Device type (phone/tablet)' })
  @ApiHeader({ name: 'X-Connection-Type', required: false, description: 'Connection type (wifi/cellular/offline)' })
  async executeMobileReport(
    @Param('reportId') reportId: string,
    @Body(ValidationPipe) executeReportDto: ExecuteMobileReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('X-Device-Type') deviceType?: 'phone' | 'tablet',
    @Headers('X-Connection-Type') connectionType?: 'wifi' | 'cellular' | 'offline',
  ): Promise<{
    data: any[];
    metadata: {
      executionTime: number;
      dataSize: number;
      fromCache: boolean;
      optimized: boolean;
    };
    visualization?: {
      type: string;
      config: any;
      imageUrl?: string;
    };
  }> {
    const options = {
      ...executeReportDto,
      deviceType,
      connectionType,
    };

    return this.mobileAnalyticsService.executeMobileReport(tenantId, reportId, user.id, options);
  }

  // Offline Data Management Endpoints

  @Post('sync')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync data for offline use' })
  @ApiResponse({ status: 200, description: 'Offline data sync completed' })
  async syncOfflineData(
    @Body(ValidationPipe) syncDto: SyncOfflineDataDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    synced: number;
    failed: number;
    totalSize: number;
    errors: Array<{ entityId: string; error: string }>;
  }> {
    return this.mobileAnalyticsService.syncOfflineData(tenantId, user.id, syncDto);
  }

  @Get('offline/status')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get offline data status' })
  @ApiResponse({ status: 200, description: 'Offline data status retrieved' })
  async getOfflineStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    totalItems: number;
    totalSize: number;
    lastSync: Date;
    expiredItems: number;
    availableOffline: {
      dashboards: number;
      reports: number;
      widgets: number;
    };
  }> {
    // Implementation would get actual offline status
    // For now, return mock data
    return {
      totalItems: 25,
      totalSize: 5242880, // 5 MB
      lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      expiredItems: 2,
      availableOffline: {
        dashboards: 5,
        reports: 12,
        widgets: 8,
      },
    };
  }

  @Delete('offline/clear')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear offline data cache' })
  @ApiResponse({ status: 204, description: 'Offline data cleared successfully' })
  async clearOfflineData(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityType') entityType?: 'dashboard' | 'report' | 'widget',
  ): Promise<void> {
    // Implementation would clear offline data
    console.log(`Clearing offline data for user ${user.id} in tenant ${tenantId}, type: ${entityType || 'all'}`);
  }

  // Mobile Usage Analytics Endpoints

  @Get('usage/stats')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get mobile analytics usage statistics' })
  @ApiResponse({ status: 200, description: 'Mobile usage statistics retrieved' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'deviceType', required: false, enum: ['phone', 'tablet'] })
  async getMobileUsageStats(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('deviceType') deviceType?: 'phone' | 'tablet',
  ): Promise<{
    sessions: {
      total: number;
      averageDuration: number;
      byDeviceType: Record<string, number>;
      byConnectionType: Record<string, number>;
    };
    activities: {
      total: number;
      byType: Record<string, number>;
      offlinePercentage: number;
    };
    performance: {
      averageLoadTime: number;
      cacheHitRate: number;
      errorRate: number;
    };
    dataUsage: {
      totalDataTransferred: number;
      averagePerSession: number;
      compressionSavings: number;
    };
  }> {
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      deviceType,
    };

    return this.mobileAnalyticsService.getMobileUsageStats(tenantId, options);
  }

  @Post('usage/track')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Track mobile analytics activity' })
  @ApiResponse({ status: 202, description: 'Activity tracked successfully' })
  async trackMobileActivity(
    @Body() activityData: {
      type: 'view_dashboard' | 'view_report' | 'execute_query' | 'export_data' | 'share_content';
      entityId: string;
      duration?: number;
      metadata?: Record<string, any>;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('X-Device-Type') deviceType?: 'phone' | 'tablet',
    @Headers('X-Connection-Type') connectionType?: 'wifi' | 'cellular' | 'offline',
  ): Promise<{ message: string }> {
    // Implementation would track the activity
    console.log(`Tracking mobile activity: ${activityData.type} for user ${user.id}`);
    
    return { message: 'Activity tracked successfully' };
  }

  // Mobile Optimization Endpoints

  @Get('optimize/recommendations')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get mobile optimization recommendations' })
  @ApiResponse({ status: 200, description: 'Optimization recommendations retrieved' })
  async getOptimizationRecommendations(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    recommendations: Array<{
      type: 'performance' | 'data_usage' | 'offline' | 'ui';
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      effort: 'high' | 'medium' | 'low';
      actions: string[];
    }>;
    summary: {
      totalRecommendations: number;
      highImpact: number;
      estimatedSavings: {
        loadTime: number; // percentage
        dataUsage: number; // percentage
        batteryUsage: number; // percentage
      };
    };
  }> {
    // Implementation would analyze usage patterns and provide recommendations
    return {
      recommendations: [
        {
          type: 'performance',
          title: 'Reduce Widget Count on Mobile Dashboards',
          description: 'Some dashboards have too many widgets for optimal mobile performance',
          impact: 'high',
          effort: 'medium',
          actions: [
            'Limit mobile dashboards to 8-10 widgets maximum',
            'Use carousel layout for additional widgets',
            'Combine related metrics into single widgets',
          ],
        },
        {
          type: 'data_usage',
          title: 'Enable Data Compression for Cellular Users',
          description: 'Cellular users could benefit from automatic data compression',
          impact: 'medium',
          effort: 'low',
          actions: [
            'Enable automatic compression for cellular connections',
            'Reduce image quality on cellular',
            'Limit data refresh frequency on cellular',
          ],
        },
        {
          type: 'offline',
          title: 'Improve Offline Data Coverage',
          description: 'Only 60% of frequently accessed reports are available offline',
          impact: 'medium',
          effort: 'medium',
          actions: [
            'Enable offline mode for top 10 most accessed reports',
            'Implement smart pre-caching based on usage patterns',
            'Add offline indicators to UI',
          ],
        },
      ],
      summary: {
        totalRecommendations: 3,
        highImpact: 1,
        estimatedSavings: {
          loadTime: 25, // 25% faster load times
          dataUsage: 35, // 35% less data usage
          batteryUsage: 15, // 15% less battery usage
        },
      },
    };
  }

  @Post('optimize/apply')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply mobile optimizations automatically' })
  @ApiResponse({ status: 200, description: 'Optimizations applied successfully' })
  async applyOptimizations(
    @Body() optimizationRequest: {
      optimizations: string[];
      applyToAll?: boolean;
      entityIds?: string[];
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    applied: string[];
    failed: string[];
    summary: {
      dashboardsOptimized: number;
      reportsOptimized: number;
      estimatedImprovement: {
        loadTime: number;
        dataUsage: number;
      };
    };
  }> {
    // Implementation would apply the requested optimizations
    return {
      applied: optimizationRequest.optimizations,
      failed: [],
      summary: {
        dashboardsOptimized: 5,
        reportsOptimized: 12,
        estimatedImprovement: {
          loadTime: 20, // 20% improvement
          dataUsage: 30, // 30% reduction
        },
      },
    };
  }

  // Mobile Templates and Presets

  @Get('templates')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get mobile dashboard and report templates' })
  @ApiResponse({ status: 200, description: 'Mobile templates retrieved successfully' })
  async getMobileTemplates(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: 'dashboard' | 'report',
    @Query('deviceType') deviceType?: 'phone' | 'tablet',
  ): Promise<Array<{
    id: string;
    name: string;
    description: string;
    type: 'dashboard' | 'report';
    deviceType: 'phone' | 'tablet' | 'universal';
    preview: string;
    configuration: any;
  }>> {
    // Implementation would return mobile-optimized templates
    return [
      {
        id: 'mobile-sales-dashboard',
        name: 'Mobile Sales Dashboard',
        description: 'Key sales metrics optimized for mobile viewing',
        type: 'dashboard',
        deviceType: 'universal',
        preview: 'https://example.com/previews/mobile-sales-dashboard.png',
        configuration: {
          layout: {
            type: 'stack',
            orientation: 'portrait',
            spacing: 16,
            padding: 16,
          },
          widgets: [
            {
              id: 'revenue-metric',
              type: 'metric',
              title: 'Today\'s Revenue',
              size: 'medium',
              position: 0,
            },
            {
              id: 'sales-chart',
              type: 'chart',
              title: 'Sales Trend',
              size: 'large',
              position: 1,
            },
          ],
          theme: 'light',
          refreshInterval: 300,
          offlineCapable: true,
        },
      },
      {
        id: 'mobile-inventory-report',
        name: 'Mobile Inventory Report',
        description: 'Stock levels and alerts for mobile devices',
        type: 'report',
        deviceType: 'phone',
        preview: 'https://example.com/previews/mobile-inventory-report.png',
        configuration: {
          query: 'SELECT product_name, current_stock, reorder_point FROM inventory_view WHERE current_stock < reorder_point',
          visualization: {
            chartType: 'bar',
            dataMapping: {
              label: 'product_name',
              value: 'current_stock',
            },
            formatting: {
              numberFormat: 'integer',
              showValues: true,
            },
          },
          mobileOptimizations: {
            compressData: true,
            limitRows: 50,
            useAggregation: false,
            cacheResults: true,
            offlineAvailable: true,
          },
        },
      },
    ];
  }
}