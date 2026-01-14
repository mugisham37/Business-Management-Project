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

import { 
  CustomReportingService,
  ReportDefinition,
  Dashboard,
  ReportExecution,
  ReportVisualization,
  ReportFilter,
  ReportSchedule
} from '../services/custom-reporting.service';

export class CreateReportDto {
  name!: string;
  description!: string;
  category!: string;
  isPublic!: boolean;
  configuration!: {
    dataSource: string;
    query?: string;
    visualizations: ReportVisualization[];
    filters: ReportFilter[];
    parameters: any[];
    layout: any;
  };
  sharing!: any;
}

export class UpdateReportDto {
  name?: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  configuration?: {
    dataSource?: string;
    query?: string;
    visualizations?: ReportVisualization[];
    filters?: ReportFilter[];
    parameters?: any[];
    layout?: any;
  };
  sharing?: any;
}

export class ExecuteReportDto {
  parameters?: Record<string, any>;
  filters?: Record<string, any>;
  format?: 'json' | 'csv' | 'excel' | 'pdf';
  async?: boolean;
}

export class CreateDashboardDto {
  name!: string;
  description!: string;
  isDefault!: boolean;
  configuration!: {
    layout: any;
    widgets: any[];
    filters: any[];
    theme: 'light' | 'dark' | 'auto';
    refreshInterval: number;
  };
  sharing!: any;
}

export class ScheduleReportDto {
  enabled!: boolean;
  frequency!: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time!: string;
  timezone!: string;
  recipients!: string[];
  format!: 'pdf' | 'excel' | 'csv' | 'email';
}

@Controller('api/v1/analytics/reporting')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-analytics')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Custom Reporting')
export class CustomReportingController {
  constructor(
    private readonly customReportingService: CustomReportingService,
  ) {}

  // Report Management Endpoints

  @Post('reports')
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new custom report' })
  @ApiResponse({ status: 201, description: 'Report created successfully', type: Object })
  async createReport(
    @Body(ValidationPipe) createReportDto: CreateReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportDefinition> {
    return this.customReportingService.createReport(tenantId, user.id, createReportDto);
  }

  @Get('reports')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'List all reports for tenant' })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'tags', required: false, type: String, description: 'Comma-separated tags' })
  @ApiQuery({ name: 'createdBy', required: false, type: String })
  @ApiQuery({ name: 'isPublic', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['name', 'created', 'modified', 'executions'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async listReports(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('createdBy') createdBy?: string,
    @Query('isPublic') isPublic?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy?: 'name' | 'created' | 'modified' | 'executions',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<{
    reports: ReportDefinition[];
    total: number;
    hasMore: boolean;
  }> {
    const options: { category?: string; tags?: string[]; createdBy?: string; isPublic?: boolean; limit?: number; offset?: number; sortBy?: 'name' | 'created' | 'modified' | 'executions'; sortOrder?: 'asc' | 'desc' } = {};
    if (category !== undefined) options.category = category;
    if (tags !== undefined) options.tags = tags.split(',');
    if (createdBy !== undefined) options.createdBy = createdBy;
    if (isPublic !== undefined) options.isPublic = isPublic;
    if (limit !== undefined) options.limit = limit;
    if (offset !== undefined) options.offset = offset;
    if (sortBy !== undefined) options.sortBy = sortBy;
    if (sortOrder !== undefined) options.sortOrder = sortOrder;

    return this.customReportingService.listReports(tenantId, user.id, options);
  }

  @Get('reports/:reportId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get a specific report definition' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully', type: Object })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID' })
  async getReport(
    @Param('reportId') reportId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReportDefinition> {
    const report = await this.customReportingService.getReport(tenantId, reportId);
    if (!report) {
      throw new Error('Report not found');
    }
    return report;
  }

  @Put('reports/:reportId')
  @RequirePermission('analytics:edit')
  @ApiOperation({ summary: 'Update a report definition' })
  @ApiResponse({ status: 200, description: 'Report updated successfully', type: Object })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID' })
  async updateReport(
    @Param('reportId') reportId: string,
    @Body(ValidationPipe) updateReportDto: UpdateReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportDefinition> {
    const cleanUpdateDto: Partial<ReportDefinition> = {};
    if (updateReportDto.name !== undefined) (cleanUpdateDto as any).name = updateReportDto.name;
    if (updateReportDto.description !== undefined) (cleanUpdateDto as any).description = updateReportDto.description;
    if (updateReportDto.category !== undefined) (cleanUpdateDto as any).category = updateReportDto.category;
    if (updateReportDto.isPublic !== undefined) (cleanUpdateDto as any).isPublic = updateReportDto.isPublic;
    if (updateReportDto.configuration !== undefined) (cleanUpdateDto as any).configuration = updateReportDto.configuration;
    if (updateReportDto.sharing !== undefined) (cleanUpdateDto as any).sharing = updateReportDto.sharing;
    
    return this.customReportingService.updateReport(tenantId, reportId, user.id, cleanUpdateDto as any);
  }

  @Delete('reports/:reportId')
  @RequirePermission('analytics:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a report' })
  @ApiResponse({ status: 204, description: 'Report deleted successfully' })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID' })
  async deleteReport(
    @Param('reportId') reportId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // Implementation would delete the report
    // For now, just log the action
    console.log(`Deleting report ${reportId} for tenant ${tenantId} by user ${user.id}`);
  }

  // Report Execution Endpoints

  @Post('reports/:reportId/execute')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a report' })
  @ApiResponse({ status: 200, description: 'Report execution initiated', type: Object })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID' })
  async executeReport(
    @Param('reportId') reportId: string,
    @Body(ValidationPipe) executeReportDto: ExecuteReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportExecution> {
    return this.customReportingService.executeReport(tenantId, reportId, user.id, executeReportDto);
  }

  @Get('executions/:executionId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get report execution status and results' })
  @ApiResponse({ status: 200, description: 'Execution details retrieved', type: Object })
  @ApiParam({ name: 'executionId', type: 'string', description: 'Execution ID' })
  async getExecution(
    @Param('executionId') executionId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ReportExecution> {
    // Implementation would retrieve execution details
    // For now, return mock data
    return {
      id: executionId,
      reportId: 'report-1',
      tenantId,
      executedBy: 'user-1',
      parameters: {},
      filters: {},
      status: 'completed',
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
      executionTime: 5000,
      resultSize: 1024,
      outputFormat: 'json',
      outputUrl: 'https://storage.example.com/reports/report-1.json',
    };
  }

  // Report Scheduling Endpoints

  @Post('reports/:reportId/schedule')
  @RequirePermission('analytics:schedule')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a report for automatic execution' })
  @ApiResponse({ status: 201, description: 'Report scheduled successfully' })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID' })
  async scheduleReport(
    @Param('reportId') reportId: string,
    @Body(ValidationPipe) scheduleDto: ScheduleReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string; nextRun: Date }> {
    await this.customReportingService.scheduleReport(tenantId, reportId, user.id, scheduleDto);
    
    // Calculate next run time for response
    const nextRun = new Date(); // Would calculate actual next run time
    
    return {
      message: 'Report scheduled successfully',
      nextRun,
    };
  }

  @Delete('reports/:reportId/schedule')
  @RequirePermission('analytics:schedule')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel report schedule' })
  @ApiResponse({ status: 204, description: 'Schedule cancelled successfully' })
  @ApiParam({ name: 'reportId', type: 'string', description: 'Report ID' })
  async cancelSchedule(
    @Param('reportId') reportId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // Implementation would cancel the scheduled report
    console.log(`Cancelling schedule for report ${reportId} in tenant ${tenantId}`);
  }

  // Dashboard Management Endpoints

  @Post('dashboards')
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new dashboard' })
  @ApiResponse({ status: 201, description: 'Dashboard created successfully', type: Object })
  async createDashboard(
    @Body(ValidationPipe) createDashboardDto: CreateDashboardDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Dashboard> {
    return this.customReportingService.createDashboard(tenantId, user.id, createDashboardDto);
  }

  @Get('dashboards')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'List all dashboards for tenant' })
  @ApiResponse({ status: 200, description: 'Dashboards retrieved successfully' })
  async listDashboards(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Dashboard[]> {
    // Implementation would list dashboards
    // For now, return empty array
    return [];
  }

  @Get('dashboards/:dashboardId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get dashboard with widget data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string', description: 'Dashboard ID' })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean })
  async getDashboard(
    @Param('dashboardId') dashboardId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('refresh') refresh?: boolean,
  ): Promise<{
    dashboard: Dashboard;
    widgets: Array<{
      id: string;
      data: any;
      lastUpdated: Date;
      executionTime: number;
      error?: string;
    }>;
    lastUpdated: Date;
  }> {
    const options: { refresh?: boolean; filters?: Record<string, any> } = {};
    if (refresh !== undefined) options.refresh = refresh;
    return this.customReportingService.getDashboardData(tenantId, dashboardId, user.id, options);
  }

  @Put('dashboards/:dashboardId')
  @RequirePermission('analytics:edit')
  @ApiOperation({ summary: 'Update a dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard updated successfully', type: Object })
  @ApiParam({ name: 'dashboardId', type: 'string', description: 'Dashboard ID' })
  async updateDashboard(
    @Param('dashboardId') dashboardId: string,
    @Body(ValidationPipe) updateDashboardDto: Partial<CreateDashboardDto>,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Dashboard> {
    // Implementation would update dashboard
    // For now, return mock dashboard
    return {
      id: dashboardId,
      name: updateDashboardDto.name || 'Updated Dashboard',
      description: updateDashboardDto.description || 'Updated description',
      tenantId,
      createdBy: user.id,
      isDefault: updateDashboardDto.isDefault || false,
      configuration: updateDashboardDto.configuration || {
        layout: { type: 'grid', columns: 12, rowHeight: 100, margin: 10, containerPadding: 20 },
        widgets: [],
        filters: [],
        theme: 'light',
        refreshInterval: 300,
      },
      sharing: updateDashboardDto.sharing || {
        isPublic: false,
        allowedUsers: [],
        allowedRoles: [],
        permissions: { canView: true, canEdit: false, canShare: false, canSchedule: false },
      },
      metadata: {
        tags: [],
        category: 'custom',
        lastViewed: new Date(),
        viewCount: 1,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  @Delete('dashboards/:dashboardId')
  @RequirePermission('analytics:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a dashboard' })
  @ApiResponse({ status: 204, description: 'Dashboard deleted successfully' })
  @ApiParam({ name: 'dashboardId', type: 'string', description: 'Dashboard ID' })
  async deleteDashboard(
    @Param('dashboardId') dashboardId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // Implementation would delete the dashboard
    console.log(`Deleting dashboard ${dashboardId} for tenant ${tenantId} by user ${user.id}`);
  }

  // Report Builder Helper Endpoints

  @Get('data-sources')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get available data sources for report building' })
  @ApiResponse({ status: 200, description: 'Data sources retrieved successfully' })
  async getDataSources(
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    id: string;
    name: string;
    type: 'table' | 'view' | 'materialized_view';
    schema: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      description?: string;
    }>;
    description?: string;
  }>> {
    // Implementation would return available data sources
    return [
      {
        id: 'fact_transactions',
        name: 'Transaction Facts',
        type: 'table',
        schema: `analytics_${tenantId.replace(/-/g, '_')}`,
        columns: [
          { name: 'id', type: 'uuid', nullable: false, description: 'Transaction ID' },
          { name: 'transaction_date', type: 'date', nullable: false, description: 'Transaction date' },
          { name: 'total_amount', type: 'decimal', nullable: false, description: 'Total transaction amount' },
          { name: 'customer_id', type: 'uuid', nullable: true, description: 'Customer ID' },
          { name: 'location_id', type: 'uuid', nullable: true, description: 'Location ID' },
          { name: 'product_id', type: 'uuid', nullable: true, description: 'Product ID' },
        ],
        description: 'Transactional sales data',
      },
      {
        id: 'dim_products',
        name: 'Product Dimension',
        type: 'table',
        schema: `analytics_${tenantId.replace(/-/g, '_')}`,
        columns: [
          { name: 'product_id', type: 'uuid', nullable: false, description: 'Product ID' },
          { name: 'sku', type: 'varchar', nullable: false, description: 'Product SKU' },
          { name: 'product_name', type: 'varchar', nullable: false, description: 'Product name' },
          { name: 'category', type: 'varchar', nullable: true, description: 'Product category' },
          { name: 'brand', type: 'varchar', nullable: true, description: 'Product brand' },
        ],
        description: 'Product master data',
      },
    ];
  }

  @Post('query/validate')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a SQL query for report building' })
  @ApiResponse({ status: 200, description: 'Query validation result' })
  async validateQuery(
    @Body() queryData: { query: string; parameters?: Record<string, any> },
    @CurrentTenant() tenantId: string,
  ): Promise<{
    isValid: boolean;
    error?: string;
    estimatedRows?: number;
    estimatedExecutionTime?: number;
    columns?: Array<{ name: string; type: string }>;
  }> {
    try {
      // In production, would validate the query against the data warehouse
      // For now, return mock validation
      const isValid = !queryData.query.toLowerCase().includes('drop') && 
                     !queryData.query.toLowerCase().includes('delete') &&
                     !queryData.query.toLowerCase().includes('update');

      if (!isValid) {
        return {
          isValid: false,
          error: 'Query contains potentially dangerous operations',
        };
      }

      return {
        isValid: true,
        estimatedRows: Math.floor(Math.random() * 10000) + 100,
        estimatedExecutionTime: Math.floor(Math.random() * 5000) + 500,
        columns: [
          { name: 'date', type: 'date' },
          { name: 'revenue', type: 'decimal' },
          { name: 'transactions', type: 'integer' },
        ],
      };
    } catch (error) {
      return {
        isValid: false,
        error: (error as any)?.message || 'Unknown error',
      };
    }
  }

  @Post('query/preview')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview query results (limited rows)' })
  @ApiResponse({ status: 200, description: 'Query preview results' })
  async previewQuery(
    @Body() queryData: { query: string; parameters?: Record<string, any>; limit?: number },
    @CurrentTenant() tenantId: string,
  ): Promise<{
    data: any[];
    columns: Array<{ name: string; type: string }>;
    totalRows: number;
    executionTime: number;
  }> {
    try {
      const limit = Math.min(queryData.limit || 100, 1000); // Max 1000 rows for preview
      
      // In production, would execute the query with LIMIT
      // For now, return mock data
      const mockData = Array.from({ length: Math.min(limit, 50) }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        revenue: Math.random() * 10000 + 1000,
        transactions: Math.floor(Math.random() * 100) + 10,
      }));

      return {
        data: mockData,
        columns: [
          { name: 'date', type: 'date' },
          { name: 'revenue', type: 'decimal' },
          { name: 'transactions', type: 'integer' },
        ],
        totalRows: mockData.length,
        executionTime: Math.random() * 1000 + 100,
      };
    } catch (error) {
      throw new Error(`Query preview failed: ${(error as any)?.message || 'Unknown error'}`);
    }
  }

  // Template and Examples Endpoints

  @Get('templates')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get report templates' })
  @ApiResponse({ status: 200, description: 'Report templates retrieved successfully' })
  async getReportTemplates(
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    preview: string;
    configuration: any;
  }>> {
    return [
      {
        id: 'sales-summary',
        name: 'Sales Summary Report',
        description: 'Daily, weekly, and monthly sales performance overview',
        category: 'Sales',
        preview: 'https://example.com/previews/sales-summary.png',
        configuration: {
          dataSource: 'fact_transactions',
          query: `
            SELECT 
              DATE_TRUNC('day', transaction_date) as date,
              COUNT(*) as transactions,
              SUM(total_amount) as revenue,
              AVG(total_amount) as avg_order_value
            FROM fact_transactions 
            WHERE transaction_date >= {{start_date}} 
              AND transaction_date <= {{end_date}}
            GROUP BY DATE_TRUNC('day', transaction_date)
            ORDER BY date DESC
          `,
          visualizations: [
            {
              id: 'revenue-chart',
              type: 'chart',
              title: 'Daily Revenue',
              configuration: {
                chartType: 'line',
                dataMapping: { xAxis: 'date', yAxis: 'revenue' },
              },
            },
          ],
          filters: [
            {
              id: 'date-range',
              name: 'Date Range',
              type: 'date',
              field: 'transaction_date',
              operator: 'between',
              required: true,
            },
          ],
        },
      },
      {
        id: 'inventory-status',
        name: 'Inventory Status Report',
        description: 'Current inventory levels and stock alerts',
        category: 'Inventory',
        preview: 'https://example.com/previews/inventory-status.png',
        configuration: {
          dataSource: 'fact_inventory',
          query: `
            SELECT 
              p.product_name,
              p.sku,
              i.ending_quantity as current_stock,
              CASE 
                WHEN i.ending_quantity <= 10 THEN 'Low'
                WHEN i.ending_quantity <= 50 THEN 'Medium'
                ELSE 'High'
              END as stock_level
            FROM fact_inventory i
            JOIN dim_products p ON i.product_id = p.product_id
            WHERE i.snapshot_date = CURRENT_DATE
            ORDER BY i.ending_quantity ASC
          `,
          visualizations: [
            {
              id: 'stock-table',
              type: 'table',
              title: 'Current Stock Levels',
              configuration: {
                dataMapping: {},
              },
            },
          ],
        },
      },
    ];
  }
}