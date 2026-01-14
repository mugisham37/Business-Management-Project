import { 
  Controller, 
  Get, 
  Post, 
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

import { DataWarehouseService } from '../services/data-warehouse.service';

export class CreatePartitionDto {
  tableName!: string;
  partitionStrategy!: {
    column: string;
    strategy: 'range' | 'hash';
    interval?: string;
    partitionCount?: number;
  };
}

export class ExecuteQueryDto {
  query!: string;
  parameters?: any[];
  useCache?: boolean;
  cacheTTL?: number;
  timeout?: number;
}

@Controller('api/v1/analytics/warehouse')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-analytics')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Data Warehouse')
export class DataWarehouseController {
  constructor(
    private readonly dataWarehouseService: DataWarehouseService,
  ) {}

  @Post('initialize')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize data warehouse schema for tenant' })
  @ApiResponse({ status: 201, description: 'Data warehouse schema created successfully' })
  async initializeSchema(
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string; schemaName: string }> {
    await this.dataWarehouseService.createTenantSchema(tenantId);
    
    return {
      message: 'Data warehouse schema initialized successfully',
      schemaName: `analytics_${tenantId.replace(/-/g, '_')}`,
    };
  }

  @Get('health')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Test data warehouse connection' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved' })
  async testConnection(
    @CurrentTenant() tenantId: string,
  ): Promise<{ connected: boolean; message: string }> {
    const connected = await this.dataWarehouseService.testConnection(tenantId);
    
    return {
      connected,
      message: connected ? 'Connection successful' : 'Connection failed',
    };
  }

  @Post('query')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute data warehouse query' })
  @ApiResponse({ status: 200, description: 'Query executed successfully' })
  async executeQuery(
    @Body(ValidationPipe) queryDto: ExecuteQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    data: any[];
    metadata: {
      executionTime: number;
      rowCount: number;
      fromCache: boolean;
      queryId: string;
    };
  }> {
    const options: { useCache?: boolean; cacheTTL?: number; timeout?: number } = {};
    if (queryDto.useCache !== undefined) options.useCache = queryDto.useCache;
    if (queryDto.cacheTTL !== undefined) options.cacheTTL = queryDto.cacheTTL;
    if (queryDto.timeout !== undefined) options.timeout = queryDto.timeout;
    
    return this.dataWarehouseService.executeAnalyticsQuery(
      tenantId,
      queryDto.query,
      queryDto.parameters || [],
      options
    );
  }

  @Get('statistics')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get data warehouse statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    schemaSize: number;
    tableCount: number;
    totalRows: number;
    lastUpdated: Date;
    queryPerformance: {
      averageExecutionTime: number;
      cacheHitRate: number;
      queriesPerHour: number;
    };
  }> {
    return this.dataWarehouseService.getWarehouseStatistics(tenantId);
  }

  @Post('optimize')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Optimize data warehouse performance' })
  @ApiResponse({ status: 200, description: 'Optimization completed successfully' })
  async optimizeWarehouse(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    optimizationsApplied: string[];
    performanceImprovement: number;
  }> {
    return this.dataWarehouseService.optimizeWarehouse(tenantId);
  }

  @Post('partitions')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create table partitions' })
  @ApiResponse({ status: 201, description: 'Partitions created successfully' })
  async createPartitions(
    @Body(ValidationPipe) partitionDto: CreatePartitionDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string; partitionsCreated: number }> {
    await this.dataWarehouseService.createPartitions(
      tenantId,
      partitionDto.tableName,
      partitionDto.partitionStrategy
    );

    const partitionCount = partitionDto.partitionStrategy.strategy === 'hash' 
      ? partitionDto.partitionStrategy.partitionCount || 4
      : 12; // Default 12 monthly partitions for range

    return {
      message: 'Partitions created successfully',
      partitionsCreated: partitionCount,
    };
  }

  @Get('schema/:tableName')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get table schema information' })
  @ApiResponse({ status: 200, description: 'Schema information retrieved' })
  @ApiParam({ name: 'tableName', type: 'string' })
  async getTableSchema(
    @Param('tableName') tableName: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    tableName: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      defaultValue?: any;
    }>;
    indexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
    partitioning?: {
      strategy: string;
      column: string;
    };
  }> {
    const schemaName = `analytics_${tenantId.replace(/-/g, '_')}`;
    
    // This would query the information schema to get table details
    // For now, return mock data
    return {
      tableName,
      columns: [
        { name: 'id', type: 'uuid', nullable: false },
        { name: 'tenant_id', type: 'uuid', nullable: false },
        { name: 'created_at', type: 'timestamp', nullable: false },
      ],
      indexes: [
        { name: `idx_${tableName}_tenant_id`, columns: ['tenant_id'], unique: false },
        { name: `idx_${tableName}_created_at`, columns: ['created_at'], unique: false },
      ],
    };
  }

  @Get('performance/queries')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get query performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getQueryPerformance(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit: number = 50,
  ): Promise<{
    queries: Array<{
      queryId: string;
      executionTime: number;
      rowsReturned: number;
      cacheHit: boolean;
      timestamp: Date;
    }>;
    summary: {
      averageExecutionTime: number;
      cacheHitRate: number;
      totalQueries: number;
    };
  }> {
    // This would retrieve actual performance data
    // For now, return mock data
    const queries = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      queryId: `query_${i + 1}`,
      executionTime: Math.random() * 1000 + 100,
      rowsReturned: Math.floor(Math.random() * 10000),
      cacheHit: Math.random() > 0.3,
      timestamp: new Date(Date.now() - i * 60000),
    }));

    const summary = {
      averageExecutionTime: queries.reduce((sum, q) => sum + q.executionTime, 0) / queries.length,
      cacheHitRate: (queries.filter(q => q.cacheHit).length / queries.length) * 100,
      totalQueries: queries.length,
    };

    return { queries, summary };
  }

  @Get('storage/usage')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get storage usage information' })
  @ApiResponse({ status: 200, description: 'Storage usage retrieved' })
  async getStorageUsage(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    totalSize: number;
    tableBreakdown: Array<{
      tableName: string;
      size: number;
      rowCount: number;
      lastUpdated: Date;
    }>;
    growthTrend: Array<{
      date: string;
      size: number;
    }>;
  }> {
    // This would query actual storage statistics
    // For now, return mock data
    const tables = ['fact_transactions', 'fact_inventory', 'fact_customers', 'dim_product', 'dim_location'];
    
    const tableBreakdown = tables.map(tableName => ({
      tableName,
      size: Math.random() * 1000000000, // Random size in bytes
      rowCount: Math.floor(Math.random() * 1000000),
      lastUpdated: new Date(),
    }));

    const totalSize = tableBreakdown.reduce((sum, table) => sum + table.size, 0);

    const growthTrend: Array<{ date: string; size: number }> = Array.from({ length: 30 }, (_, i) => {
      const dateStr = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return {
        date: dateStr!,
        size: totalSize * (0.7 + (i / 29) * 0.3), // Simulate growth
      };
    });

    return {
      totalSize,
      tableBreakdown,
      growthTrend,
    };
  }
}