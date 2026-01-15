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

export class CreateReportDto {
  name!: string;
  description?: string;
  query!: {
    sql: string;
    parameters: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean';
      required: boolean;
      defaultValue?: any;
    }>;
  };
  visualization!: {
    type: 'table' | 'chart' | 'metric';
    chartType?: 'line' | 'bar' | 'pie' | 'area';
    xAxis?: string;
    yAxis?: string[];
  };
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:MM format
    recipients: string[];
  };
  isPublic!: boolean;
}

export class UpdateReportDto {
  name?: string;
  description?: string;
  query?: {
    sql?: string;
    parameters?: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean';
      required: boolean;
      defaultValue?: any;
    }>;
  };
  visualization?: {
    type?: 'table' | 'chart' | 'metric';
    chartType?: 'line' | 'bar' | 'pie' | 'area';
    xAxis?: string;
    yAxis?: string[];
  };
  schedule?: {
    enabled?: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
    time?: string;
    recipients?: string[];
  };
  isPublic?: boolean;
}

export class ExecuteReportDto {
  parameters?: Record<string, any>;
  format?: 'json' | 'csv' | 'pdf' | 'excel';
  filters?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
    value: any;
  }>;
}

@Controller('api/v1/analytics/reports')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-analytics')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Analytics Reports')
export class ReportingController {
  constructor(
    private readonly analyticsAPIService: AnalyticsAPIService,
  ) {}

  @Get()
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get all reports for tenant' })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  async getReports(
    @CurrentTenant() tenantId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ): Promise<{
    reports: Array<{
      id: string;
      name: string;
      description?: string;
      category: string;
      isPublic: boolean;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      lastRun?: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // This would query the database for reports
    // For now, return mock data
    const mockReports = [
      {
        id: 'report-1',
        name: 'Daily Sales Report',
        description: 'Daily sales performance and trends',
        category: 'sales',
        isPublic: false,
        createdBy: 'user-1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        lastRun: new Date('2024-01-20'),
      },
      {
        id: 'report-2',
        name: 'Inventory Status Report',
        description: 'Current inventory levels and alerts',
        category: 'inventory',
        isPublic: true,
        createdBy: 'user-2',
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-18'),
        lastRun: new Date('2024-01-19'),
      },
      {
        id: 'report-3',
        name: 'Customer Analytics Report',
        description: 'Customer behavior and segmentation analysis',
        category: 'customer',
        isPublic: false,
        createdBy: 'user-1',
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-20'),
      },
    ];

    // Apply filters
    let filteredReports = mockReports;
    
    if (search) {
      filteredReports = filteredReports.filter(report => 
        report.name.toLowerCase().includes(search.toLowerCase()) ||
        report.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (category) {
      filteredReports = filteredReports.filter(report => report.category === category);
    }

    // Apply pagination
    const total = filteredReports.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedReports = filteredReports.slice(startIndex, startIndex + limit);

    return {
      reports: paginatedReports,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  @Get(':reportId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiResponse({ status: 200, description: 'Report retrieved successfully' })
  @ApiParam({ name: 'reportId', type: 'string' })
  async getReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    id: string;
    name: string;
    description?: string;
    query: any;
    visualization: any;
    schedule?: any;
    isPublic: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // This would query the database for the specific report
    // For now, return mock data
    return {
      id: reportId,
      name: 'Daily Sales Report',
      description: 'Daily sales performance and trends',
      query: {
        sql: `
          SELECT 
            DATE(transaction_date) as date,
            SUM(total_amount) as revenue,
            COUNT(*) as transaction_count,
            AVG(total_amount) as avg_order_value
          FROM analytics_${tenantId.replace(/-/g, '_')}.fact_transactions
          WHERE transaction_date >= {start_date}
            AND transaction_date <= {end_date}
          GROUP BY DATE(transaction_date)
          ORDER BY date
        `,
        parameters: [
          { name: 'start_date', type: 'date', required: true },
          { name: 'end_date', type: 'date', required: true },
        ],
      },
      visualization: {
        type: 'chart',
        chartType: 'line',
        xAxis: 'date',
        yAxis: ['revenue', 'transaction_count'],
      },
      schedule: {
        enabled: true,
        frequency: 'daily',
        time: '08:00',
        recipients: ['manager@company.com'],
      },
      isPublic: false,
      createdBy: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
    };
  }

  @Post()
  @RequirePermission('analytics:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new report' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  async createReport(
    @Body(ValidationPipe) createReportDto: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    id: string;
    message: string;
  }> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would store the report in the database
    // For now, just return success
    
    return {
      id: reportId,
      message: 'Report created successfully',
    };
  }

  @Put(':reportId')
  @RequirePermission('analytics:update')
  @ApiOperation({ summary: 'Update report' })
  @ApiResponse({ status: 200, description: 'Report updated successfully' })
  @ApiParam({ name: 'reportId', type: 'string' })
  async updateReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body(ValidationPipe) updateReportDto: UpdateReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    // This would update the report in the database
    // For now, just return success
    
    return {
      message: 'Report updated successfully',
    };
  }

  @Delete(':reportId')
  @RequirePermission('analytics:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete report' })
  @ApiResponse({ status: 204, description: 'Report deleted successfully' })
  @ApiParam({ name: 'reportId', type: 'string' })
  async deleteReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    // This would delete the report from the database
    // For now, just return success
  }

  @Post(':reportId/execute')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute report' })
  @ApiResponse({ status: 200, description: 'Report executed successfully' })
  @ApiParam({ name: 'reportId', type: 'string' })
  async executeReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body(ValidationPipe) executeDto: ExecuteReportDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    data: any[];
    metadata: {
      executionTime: number;
      rowCount: number;
      reportId: string;
      executedAt: Date;
    };
    visualization?: any;
  }> {
    // This would execute the report query
    // For now, return mock data
    const mockData = [
      { date: '2024-01-01', revenue: 1250.50, transaction_count: 25, avg_order_value: 50.02 },
      { date: '2024-01-02', revenue: 1380.75, transaction_count: 28, avg_order_value: 49.31 },
      { date: '2024-01-03', revenue: 1125.25, transaction_count: 22, avg_order_value: 51.15 },
    ];

    return {
      data: mockData,
      metadata: {
        executionTime: 245,
        rowCount: mockData.length,
        reportId,
        executedAt: new Date(),
      },
      visualization: {
        type: 'chart',
        chartType: 'line',
        xAxis: 'date',
        yAxis: ['revenue', 'transaction_count'],
      },
    };
  }

  @Post(':reportId/schedule')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule report execution' })
  @ApiResponse({ status: 200, description: 'Report scheduled successfully' })
  @ApiParam({ name: 'reportId', type: 'string' })
  async scheduleReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() scheduleConfig: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
      time: string;
      recipients: string[];
      format: 'pdf' | 'excel' | 'csv';
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string; nextRun: Date }> {
    // This would set up the scheduled report execution
    // For now, calculate next run time and return success
    
    const now = new Date();
    const nextRun = new Date(now);
    
    switch (scheduleConfig.frequency) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1);
        break;
    }

    const timeParts = scheduleConfig.time.split(':');
    const hours = timeParts[0] || '00';
    const minutes = timeParts[1] || '00';
    nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    return {
      message: 'Report scheduled successfully',
      nextRun,
    };
  }

  @Get(':reportId/history')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get report execution history' })
  @ApiResponse({ status: 200, description: 'Execution history retrieved' })
  @ApiParam({ name: 'reportId', type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getReportHistory(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @CurrentTenant() tenantId: string,
    @Query('limit') limit: number = 50,
  ): Promise<{
    executions: Array<{
      id: string;
      executedAt: Date;
      executedBy: string;
      status: 'success' | 'failed' | 'cancelled';
      executionTime: number;
      rowCount?: number;
      error?: string;
      downloadUrl?: string;
    }>;
  }> {
    // This would query the execution history from database
    // For now, return mock data
    const executions = Array.from({ length: Math.min(limit, 10) }, (_, i) => {
      const success = Math.random() > 0.1;
      const hasDownload = Math.random() > 0.5;
      
      return {
        id: `execution_${i + 1}`,
        executedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        executedBy: 'user-1',
        status: success ? ('success' as const) : ('failed' as const),
        executionTime: Math.random() * 5000 + 500,
        ...(success && { rowCount: Math.floor(Math.random() * 1000) }),
        ...(hasDownload && { downloadUrl: `/downloads/report_${reportId}_${i + 1}.pdf` }),
      };
    });

    return { executions };
  }

  @Get('templates/predefined')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get predefined report templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getPredefinedTemplates(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    templates: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      query: any;
      visualization: any;
    }>;
  }> {
    const templates = [
      {
        id: 'sales-summary',
        name: 'Sales Summary Report',
        description: 'Comprehensive sales performance overview',
        category: 'sales',
        query: {
          sql: `
            SELECT 
              DATE_TRUNC('day', transaction_date) as period,
              SUM(total_amount) as revenue,
              COUNT(*) as transactions,
              COUNT(DISTINCT customer_id) as unique_customers,
              AVG(total_amount) as avg_order_value
            FROM analytics_{tenant_id}.fact_transactions
            WHERE transaction_date >= {start_date} AND transaction_date <= {end_date}
            GROUP BY DATE_TRUNC('day', transaction_date)
            ORDER BY period
          `,
          parameters: [
            { name: 'start_date', type: 'date', required: true },
            { name: 'end_date', type: 'date', required: true },
          ],
        },
        visualization: {
          type: 'chart',
          chartType: 'line',
          xAxis: 'period',
          yAxis: ['revenue', 'transactions'],
        },
      },
      {
        id: 'inventory-status',
        name: 'Inventory Status Report',
        description: 'Current inventory levels and stock alerts',
        category: 'inventory',
        query: {
          sql: `
            SELECT 
              p.product_name,
              p.category,
              i.ending_quantity as current_stock,
              CASE 
                WHEN i.ending_quantity <= 10 THEN 'Low Stock'
                WHEN i.ending_quantity <= 50 THEN 'Medium Stock'
                ELSE 'Good Stock'
              END as stock_status
            FROM analytics_{tenant_id}.fact_inventory i
            JOIN analytics_{tenant_id}.dim_product p ON i.product_id = p.product_id
            WHERE i.snapshot_date = (SELECT MAX(snapshot_date) FROM analytics_{tenant_id}.fact_inventory)
            ORDER BY i.ending_quantity ASC
          `,
          parameters: [],
        },
        visualization: {
          type: 'table',
        },
      },
      {
        id: 'customer-segments',
        name: 'Customer Segmentation Report',
        description: 'Customer analysis by segments and behavior',
        category: 'customer',
        query: {
          sql: `
            SELECT 
              customer_segment,
              COUNT(*) as customer_count,
              AVG(lifetime_value) as avg_lifetime_value,
              AVG(avg_order_value) as avg_order_value,
              SUM(total_orders) as total_orders
            FROM analytics_{tenant_id}.fact_customers
            WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM analytics_{tenant_id}.fact_customers)
            GROUP BY customer_segment
            ORDER BY avg_lifetime_value DESC
          `,
          parameters: [],
        },
        visualization: {
          type: 'chart',
          chartType: 'bar',
          xAxis: 'customer_segment',
          yAxis: ['customer_count', 'avg_lifetime_value'],
        },
      },
    ];

    return { templates };
  }

  @Post('export')
  @RequirePermission('analytics:export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Export report data' })
  @ApiResponse({ status: 202, description: 'Export initiated successfully' })
  async exportReport(
    @Body() exportRequest: {
      reportId?: string;
      query?: string;
      parameters?: Record<string, any>;
      format: 'csv' | 'excel' | 'pdf';
      includeCharts?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    exportId: string;
    status: 'queued' | 'processing';
    estimatedCompletionTime: Date;
  }> {
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would queue the export job
    // For now, return mock response
    
    const estimatedCompletionTime = new Date();
    estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + 5);

    return {
      exportId,
      status: 'queued',
      estimatedCompletionTime,
    };
  }

  @Get('export/:exportId/status')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get export status' })
  @ApiResponse({ status: 200, description: 'Export status retrieved' })
  @ApiParam({ name: 'exportId', type: 'string' })
  async getExportStatus(
    @Param('exportId') exportId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    exportId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress?: number;
    downloadUrl?: string;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
  }> {
    // This would check the actual export status
    // For now, return mock status
    return {
      exportId,
      status: 'completed',
      progress: 100,
      downloadUrl: `/downloads/${exportId}.pdf`,
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
      completedAt: new Date(),
    };
  }
}