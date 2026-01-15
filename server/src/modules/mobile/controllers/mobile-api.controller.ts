import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { MobileApiInterceptor } from '../interceptors/mobile-api.interceptor';
import { CompressionInterceptor } from '../interceptors/compression.interceptor';
import { MobileOptimizationService } from '../services/mobile-optimization.service';
import { PayloadCompressionService } from '../services/payload-compression.service';
import { ProgressiveLoadingService } from '../services/progressive-loading.service';
import { OfflineDataSyncService } from '../services/offline-data-sync.service';

@Controller('api/v1/mobile')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@UseInterceptors(MobileApiInterceptor, CompressionInterceptor)
@RequireFeature('mobile-optimization')
@ApiTags('Mobile API')
@ApiBearerAuth()
export class MobileApiController {
  constructor(
    private readonly mobileOptimizationService: MobileOptimizationService,
    private readonly compressionService: PayloadCompressionService,
    private readonly progressiveLoadingService: ProgressiveLoadingService,
    private readonly offlineSyncService: OfflineDataSyncService,
  ) {}

  @Get('optimization/recommendations')
  @RequirePermission('mobile:read')
  @ApiOperation({ summary: 'Get mobile optimization recommendations' })
  @ApiResponse({ status: 200, description: 'Optimization recommendations retrieved' })
  @ApiQuery({ name: 'deviceType', required: false, enum: ['phone', 'tablet', 'desktop'] })
  async getOptimizationRecommendations(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Query('deviceType') deviceType: string = 'phone',
  ) {
    return this.mobileOptimizationService.getOptimizationRecommendations(
      tenantId,
      user.id,
      deviceType,
    );
  }

  @Get('compression/analysis')
  @RequirePermission('mobile:read')
  @ApiOperation({ summary: 'Analyze compression effectiveness for sample data' })
  @ApiResponse({ status: 200, description: 'Compression analysis completed' })
  async analyzeCompressionEffectiveness(
    @CurrentTenant() tenantId: string,
  ) {
    // Get sample data for analysis (in production, this would be real data)
    const sampleData = [
      { id: 1, name: 'Sample Product 1', description: 'This is a sample product description' },
      { id: 2, name: 'Sample Product 2', description: 'Another sample product with more details' },
      // Add more sample data...
    ];

    return this.compressionService.analyzeCompressionEffectiveness(sampleData);
  }

  @Get('progressive-loading/recommendations')
  @RequirePermission('mobile:read')
  @ApiOperation({ summary: 'Get progressive loading recommendations' })
  @ApiResponse({ status: 200, description: 'Progressive loading recommendations retrieved' })
  @ApiQuery({ name: 'dataSize', required: false, type: 'number' })
  @ApiQuery({ name: 'deviceType', required: false, enum: ['phone', 'tablet', 'desktop'] })
  @ApiQuery({ name: 'connectionType', required: false, enum: ['wifi', 'cellular', 'offline'] })
  async getProgressiveLoadingRecommendations(
    @Query('dataSize') dataSize: number = 1000,
    @Query('deviceType') deviceType: 'phone' | 'tablet' | 'desktop' = 'phone',
    @Query('connectionType') connectionType: 'wifi' | 'cellular' | 'offline' = 'wifi',
  ) {
    return this.progressiveLoadingService.getProgressiveLoadingRecommendations(
      dataSize,
      deviceType,
      connectionType,
    );
  }

  @Post('data/queue-for-sync')
  @RequirePermission('mobile:write')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue data for offline synchronization' })
  @ApiResponse({ status: 202, description: 'Data queued for synchronization' })
  async queueDataForSync(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      entityType: string;
      entityId: string;
      operation: 'create' | 'update' | 'delete';
      data: any;
      priority?: 'high' | 'medium' | 'low';
    },
  ) {
    await this.offlineSyncService.queueForSync(
      tenantId,
      user.id,
      data.entityType,
      data.entityId,
      data.operation,
      data.data,
      data.priority,
    );

    return {
      message: 'Data queued for synchronization',
      entityType: data.entityType,
      entityId: data.entityId,
      operation: data.operation,
    };
  }

  @Post('data/sync')
  @RequirePermission('mobile:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Synchronize offline data' })
  @ApiResponse({ status: 200, description: 'Data synchronization completed' })
  async synchronizeOfflineData(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() options: {
      batchSize?: number;
      maxRetries?: number;
      conflictResolution?: 'client-wins' | 'server-wins' | 'merge' | 'manual';
    } = {},
  ) {
    return this.offlineSyncService.synchronizeOfflineData(tenantId, user.id, options);
  }

  @Get('data/sync-status')
  @RequirePermission('mobile:read')
  @ApiOperation({ summary: 'Get offline data synchronization status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved' })
  async getSyncStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.offlineSyncService.getSyncStatus(tenantId, user.id);
  }

  @Post('data/clear-offline-queue')
  @RequirePermission('mobile:admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear offline data queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Offline queue cleared' })
  async clearOfflineQueue(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    await this.offlineSyncService.clearOfflineQueue(tenantId, user.id);
    
    return {
      message: 'Offline queue cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('endpoints/products')
  @RequirePermission('products:read')
  @ApiOperation({ summary: 'Get products with mobile optimization' })
  @ApiResponse({ status: 200, description: 'Products retrieved with mobile optimization' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'pageSize', required: false, type: 'number' })
  @ApiQuery({ name: 'preloadNext', required: false, type: 'boolean' })
  async getMobileOptimizedProducts(
    @CurrentTenant() tenantId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('preloadNext') preloadNext: boolean = true,
  ) {
    // Mock data source - in production, this would call ProductService
    const mockDataSource = async () => {
      // Simulate database call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Generate mock products
      const products = [];
      for (let i = 1; i <= 100; i++) {
        products.push({
          id: `product-${i}`,
          name: `Product ${i}`,
          description: `Description for product ${i}`,
          price: Math.random() * 100,
          category: `Category ${Math.ceil(i / 10)}`,
          inStock: Math.random() > 0.2,
          createdAt: new Date(),
        });
      }
      return products;
    };

    const options = {
      pageSize,
      maxPages: 10,
      preloadNext,
      cachePages: true,
      priorityFields: ['id', 'name', 'price', 'inStock'],
    };

    return this.progressiveLoadingService.loadProgressively(
      mockDataSource,
      options,
      `products:${tenantId}`,
      page,
    );
  }

  @Get('endpoints/transactions')
  @RequirePermission('transactions:read')
  @ApiOperation({ summary: 'Get transactions with mobile optimization' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved with mobile optimization' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'pageSize', required: false, type: 'number' })
  async getMobileOptimizedTransactions(
    @CurrentTenant() tenantId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 15,
  ) {
    // Mock data source for transactions
    const mockDataSource = async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const transactions = [];
      for (let i = 1; i <= 200; i++) {
        transactions.push({
          id: `txn-${i}`,
          amount: Math.random() * 500,
          status: Math.random() > 0.1 ? 'completed' : 'pending',
          customerId: `customer-${Math.ceil(Math.random() * 50)}`,
          items: Math.ceil(Math.random() * 5),
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        });
      }
      return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    };

    const options = {
      pageSize,
      maxPages: 8,
      preloadNext: false, // Don't preload for transactions to save bandwidth
      cachePages: true,
      priorityFields: ['id', 'amount', 'status', 'createdAt'],
    };

    return this.progressiveLoadingService.loadProgressively(
      mockDataSource,
      options,
      `transactions:${tenantId}`,
      page,
    );
  }

  @Get('endpoints/customers')
  @RequirePermission('customers:read')
  @ApiOperation({ summary: 'Get customers with mobile optimization' })
  @ApiResponse({ status: 200, description: 'Customers retrieved with mobile optimization' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  async getMobileOptimizedCustomers(
    @CurrentTenant() tenantId: string,
    @Query('page') page: number = 1,
  ) {
    // Mock data source for customers
    const mockDataSource = async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
      
      const customers = [];
      for (let i = 1; i <= 150; i++) {
        customers.push({
          id: `customer-${i}`,
          name: `Customer ${i}`,
          email: `customer${i}@example.com`,
          phone: `+1234567${String(i).padStart(3, '0')}`,
          totalOrders: Math.ceil(Math.random() * 20),
          totalSpent: Math.random() * 2000,
          lastOrderDate: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        });
      }
      return customers;
    };

    const options = {
      pageSize: 25,
      maxPages: 6,
      preloadNext: true,
      cachePages: true,
      priorityFields: ['id', 'name', 'email', 'totalOrders'],
    };

    return this.progressiveLoadingService.loadProgressively(
      mockDataSource,
      options,
      `customers:${tenantId}`,
      page,
    );
  }
}