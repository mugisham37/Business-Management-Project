import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Delete,
  Body, 
  Param, 
  Query, 
  UseGuards, 
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../../common/interceptors/cache.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

import { AnalyticsAPIService } from '../services/analytics-api.service';

export class CreateDashboardDto {
  name!: string;
  description?: string;
  widgets!: Array<{
    id: string;
    type: 'chart' | 'table' | 'metric' | 'gauge' | 'map';
    title: string;
    description?: string;
    query: {
      sql: string;
      parameters?: Array<{
        name: string;
        type: string;
        required: boolean;
        defaultValue?: any;
      }>;
    };
    visualization: {
      chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
      xAxis?: string;
      yAxis?: string[];
      colorBy?: string;
      aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    };
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    refreshInterval?: number;
  }>;
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  isPublic!: boolean;
}

export class UpdateDashboardDto {
  name?: string;
  description?: string;
  widgets?: Array<{
    id: string;
    type: 'chart' | 'table' | 'metric' | 'gauge' | 'map';
    title: string;
    description?: string;
    query: {
      sql: string;
      parameters?: Array<{
        name: string;
        type: string;
        required: boolean;
        defaultValue?: any;
      }>;
    };
    visualization: {
      chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
      xAxis?: string;
      yAxis?: string[];
      colorBy?: string;
      aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    };
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    refreshInterval?: number;
  }>;
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  isPublic?: boolean;
}

@Controller('api/v1/analytics/dashboards')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-analytics')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Analytics Dashboards')
export class DashboardController {
  constructor(
    private readonly analyticsAPIService: AnalyticsAPIService,
  ) {}

  @Get()
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get all dashboards for tenant' })
  @ApiResponse({ status: 200, description: 'Dashboards retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getDashboards(
    @CurrentTenant() tenantId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ): Promise<{
    dashboards: Array<{
      id: string;
      name: string;
      description?: string;
      widgetCount: number;
      isPublic: boolean;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      lastViewed?: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // This would query the database for dashboards
    // For now, return mock data
    const mockDashboards = [
      {
        id: 'dashboard-1',
        name: 'Sales Overview',
        description: 'Key sales metrics and performance indicators',
        widgetCount: 6,
        isPublic: false,
        createdBy: 'user-1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        lastViewed: new Date('2024-01-20'),
      },
      {
        id: 'dashboard-2',
        name: 'Inventory Dashboard',
        description: 'Real-time inventory levels and alerts',
        widgetCount: 4,
        isPublic: true,
        createdBy: 'user-2',
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-18'),
        lastViewed: new Date('2024-01-19'),
      },
      {
        id: 'dashboard-3',
        name: 'Customer Analytics',
        description: 'Customer behavior and engagement metrics',
        widgetCount: 8,
        isPublic: false,
        createdBy: 'user-1',
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-20'),
      },
    ];

    // Apply search filter
    let filteredDashboards = mockDashboards;
    if (search) {
      filteredDashboards = filteredDashboards.filter(dashboard => 
        dashboard.name.toLowerCase().includes(search.toLowerCase()) ||
        dashboard.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply pagination
    const total = filteredDashboards.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedDashboards = filteredDashboards.slice(startIndex, startIndex + limit);

    return {
      dashboards: paginatedDashboards,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  @Get(':dashboardId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get dashboard by ID with data' })
  @ApiResponse({ status: 200, description: 'Dashboard retrieved successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean })
  async getDashboard(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @CurrentTenant() tenantId: string,
    @Query('refresh') refresh: boolean = false,
  ): Promise<{
    dashboard: {
      id: string;
      name: string;
      description?: string;
      widgets: Array<{
        id: string;
        type: string;
        title: string;
        description?: string;
        position: any;
        data: any[];
        metadata: {
          executionTime: number;
          rowCount: number;
          lastUpdated: Date;
        };
        visualization: any;
      }>;
      filters: any[];
      isPublic: boolean;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }> {
    const result = await this.analyticsAPIService.getDashboardData(tenantId, dashboardId, refresh);
    
    // Transform the result to match the expected format
    const dashboard = {
      ...result.dashboard,
      widgets: result.dashboard.widgets.map(widget => ({
        ...widget,
        data: result.widgetData[widget.id]?.data || [],
        metadata: {
          executionTime: result.widgetData[widget.id]?.metadata.executionTime || 0,
          rowCount: result.widgetData[widget.id]?.metadata.totalRows || 0,
          lastUpdated: new Date(),
        },
      })),
    };

    return { dashboard };
  }

  @Post()
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new dashboard' })
  @ApiResponse({ status: 201, description: 'Dashboard created successfully' })
  async createDashboard(
    @Body(ValidationPipe) createDashboardDto: CreateDashboardDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    id: string;
    message: string;
  }> {
    const dashboard = await this.analyticsAPIService.saveDashboard(
      tenantId,
      {
        tenantId,
        ...createDashboardDto,
        createdBy: user.id,
      } as any,
      user.id
    );

    return {
      id: dashboard.id,
      message: 'Dashboard created successfully',
    };
  }

  @Put(':dashboardId')
  @RequirePermission('analytics:update')
  @ApiOperation({ summary: 'Update dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard updated successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  async updateDashboard(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body(ValidationPipe) updateDashboardDto: UpdateDashboardDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    // This would update the dashboard in the database
    // For now, just return success
    
    return {
      message: 'Dashboard updated successfully',
    };
  }

  @Delete(':dashboardId')
  @RequirePermission('analytics:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete dashboard' })
  @ApiResponse({ status: 204, description: 'Dashboard deleted successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  async deleteDashboard(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    // This would delete the dashboard from the database
    // For now, just return success
  }

  @Post(':dashboardId/duplicate')
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate dashboard' })
  @ApiResponse({ status: 201, description: 'Dashboard duplicated successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  async duplicateDashboard(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() duplicateOptions: {
      name?: string;
      includeData?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    id: string;
    message: string;
  }> {
    const newDashboardId = `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would duplicate the dashboard
    // For now, just return success
    
    return {
      id: newDashboardId,
      message: 'Dashboard duplicated successfully',
    };
  }

  @Post(':dashboardId/share')
  @RequirePermission('analytics:share')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Share dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard shared successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  async shareDashboard(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() shareOptions: {
      users?: string[];
      roles?: string[];
      permissions: ('read' | 'write' | 'admin')[];
      expiresAt?: Date;
      isPublic?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    shareId: string;
    shareUrl?: string;
    message: string;
  }> {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would create sharing permissions
    // For now, just return success
    
    return {
      shareId,
      ...(shareOptions.isPublic && { shareUrl: `/public/dashboard/${shareId}` }),
      message: 'Dashboard shared successfully',
    };
  }

  @Get(':dashboardId/widgets/:widgetId/data')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get widget data' })
  @ApiResponse({ status: 200, description: 'Widget data retrieved successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  @ApiParam({ name: 'widgetId', type: 'string' })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean })
  async getWidgetData(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Param('widgetId') widgetId: string,
    @CurrentTenant() tenantId: string,
    @Query('refresh') refresh: boolean = false,
  ): Promise<{
    data: any[];
    metadata: {
      executionTime: number;
      rowCount: number;
      fromCache: boolean;
      lastUpdated: Date;
    };
    visualization: any;
  }> {
    // This would get specific widget data
    // For now, return mock data
    const mockData = [
      { date: '2024-01-01', revenue: 1250.50, transactions: 25 },
      { date: '2024-01-02', revenue: 1380.75, transactions: 28 },
      { date: '2024-01-03', revenue: 1125.25, transactions: 22 },
    ];

    return {
      data: mockData,
      metadata: {
        executionTime: 150,
        rowCount: mockData.length,
        fromCache: !refresh,
        lastUpdated: new Date(),
      },
      visualization: {
        type: 'chart',
        chartType: 'line',
        xAxis: 'date',
        yAxis: ['revenue', 'transactions'],
      },
    };
  }

  @Post(':dashboardId/widgets/:widgetId/refresh')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh widget data' })
  @ApiResponse({ status: 200, description: 'Widget refreshed successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  @ApiParam({ name: 'widgetId', type: 'string' })
  async refreshWidget(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Param('widgetId') widgetId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    data: any[];
    metadata: {
      executionTime: number;
      rowCount: number;
      refreshedAt: Date;
    };
  }> {
    // This would refresh the specific widget
    // For now, return mock refreshed data
    const mockData = [
      { date: '2024-01-01', revenue: 1275.25, transactions: 26 },
      { date: '2024-01-02', revenue: 1405.50, transactions: 29 },
      { date: '2024-01-03', revenue: 1150.75, transactions: 23 },
    ];

    return {
      data: mockData,
      metadata: {
        executionTime: 180,
        rowCount: mockData.length,
        refreshedAt: new Date(),
      },
    };
  }

  @Get('templates/predefined')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get predefined dashboard templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getPredefinedTemplates(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    templates: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      widgets: Array<{
        type: string;
        title: string;
        description: string;
        visualization: any;
      }>;
      preview?: string;
    }>;
  }> {
    const templates = [
      {
        id: 'sales-executive-dashboard',
        name: 'Sales Executive Dashboard',
        description: 'Comprehensive sales overview for executives',
        category: 'sales',
        widgets: [
          {
            type: 'metric',
            title: 'Total Revenue',
            description: 'Total revenue for the current period',
            visualization: { format: 'currency' },
          },
          {
            type: 'chart',
            title: 'Revenue Trend',
            description: 'Revenue trend over time',
            visualization: { chartType: 'line', xAxis: 'date', yAxis: ['revenue'] },
          },
          {
            type: 'chart',
            title: 'Sales by Location',
            description: 'Sales performance by location',
            visualization: { chartType: 'bar', xAxis: 'location', yAxis: ['sales'] },
          },
          {
            type: 'table',
            title: 'Top Products',
            description: 'Best performing products',
            visualization: { sortBy: 'revenue', limit: 10 },
          },
        ],
        preview: '/images/dashboard-previews/sales-executive.png',
      },
      {
        id: 'inventory-manager-dashboard',
        name: 'Inventory Manager Dashboard',
        description: 'Real-time inventory monitoring and alerts',
        category: 'inventory',
        widgets: [
          {
            type: 'metric',
            title: 'Low Stock Items',
            description: 'Number of items with low stock',
            visualization: { format: 'number', threshold: { warning: 10, critical: 5 } },
          },
          {
            type: 'gauge',
            title: 'Inventory Turnover',
            description: 'Inventory turnover rate',
            visualization: { min: 0, max: 20, target: 12 },
          },
          {
            type: 'chart',
            title: 'Stock Levels by Category',
            description: 'Current stock levels grouped by category',
            visualization: { chartType: 'bar', xAxis: 'category', yAxis: ['stock_level'] },
          },
          {
            type: 'table',
            title: 'Reorder Alerts',
            description: 'Products that need reordering',
            visualization: { sortBy: 'days_of_supply', limit: 20 },
          },
        ],
        preview: '/images/dashboard-previews/inventory-manager.png',
      },
      {
        id: 'customer-analytics-dashboard',
        name: 'Customer Analytics Dashboard',
        description: 'Customer behavior and engagement insights',
        category: 'customer',
        widgets: [
          {
            type: 'metric',
            title: 'Total Customers',
            description: 'Total number of active customers',
            visualization: { format: 'number' },
          },
          {
            type: 'chart',
            title: 'Customer Acquisition',
            description: 'New customers over time',
            visualization: { chartType: 'area', xAxis: 'date', yAxis: ['new_customers'] },
          },
          {
            type: 'chart',
            title: 'Customer Segments',
            description: 'Customer distribution by segment',
            visualization: { chartType: 'pie', valueField: 'customer_count', labelField: 'segment' },
          },
          {
            type: 'table',
            title: 'Top Customers',
            description: 'Highest value customers',
            visualization: { sortBy: 'lifetime_value', limit: 15 },
          },
        ],
        preview: '/images/dashboard-previews/customer-analytics.png',
      },
    ];

    return { templates };
  }

  @Post('templates/:templateId/create')
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create dashboard from template' })
  @ApiResponse({ status: 201, description: 'Dashboard created from template successfully' })
  @ApiParam({ name: 'templateId', type: 'string' })
  async createFromTemplate(
    @Param('templateId') templateId: string,
    @Body() customization: {
      name?: string;
      description?: string;
      customizations?: Record<string, any>;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    id: string;
    message: string;
  }> {
    const dashboardId = `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would create a dashboard from the template
    // For now, just return success
    
    return {
      id: dashboardId,
      message: 'Dashboard created from template successfully',
    };
  }

  @Get(':dashboardId/export')
  @RequirePermission('analytics:export')
  @ApiOperation({ summary: 'Export dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard export initiated' })
  @ApiParam({ name: 'dashboardId', type: 'string' })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf', 'png', 'json'] })
  @ApiQuery({ name: 'includeData', required: false, type: Boolean })
  async exportDashboard(
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @CurrentTenant() tenantId: string,
    @Query('format') format: 'pdf' | 'png' | 'json' = 'pdf',
    @Query('includeData') includeData: boolean = true,
  ): Promise<{
    exportId: string;
    status: 'queued' | 'processing';
    estimatedCompletionTime: Date;
    downloadUrl?: string;
  }> {
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would queue the dashboard export
    // For now, return mock response
    
    const estimatedCompletionTime = new Date();
    estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + 3);

    return {
      exportId,
      status: 'queued',
      estimatedCompletionTime,
    };
  }
}