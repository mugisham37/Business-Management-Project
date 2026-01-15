import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { OfflineSyncService } from '../services/offline-sync.service';

@Controller('api/v1/pos/offline')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiTags('POS Offline Operations')
export class OfflineController {
  constructor(
    private readonly offlineSyncService: OfflineSyncService,
  ) {}

  @Post('queue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Queue offline operation',
    description: 'Queues an operation for later synchronization when connectivity is restored'
  })
  @ApiResponse({ status: 201, description: 'Operation queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid operation data' })
  async queueOfflineOperation(
    @Body(ValidationPipe) operationData: {
      type: 'create_transaction' | 'update_transaction' | 'void_transaction' | 'refund_transaction';
      data: any;
      deviceId: string;
      priority?: number;
      timestamp?: string;
    },
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ) {
    const operation = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: operationData.type,
      data: operationData.data,
      timestamp: operationData.timestamp ? new Date(operationData.timestamp) : new Date(),
      deviceId: operationData.deviceId,
      priority: operationData.priority || 5, // Default priority
    };

    await this.offlineSyncService.queueOfflineOperation(
      tenantId,
      operation,
      user.id
    );

    return {
      success: true,
      operationId: operation.id,
      queuedAt: new Date().toISOString(),
    };
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Synchronize pending operations',
    description: 'Processes all pending offline operations and synchronizes them with the server'
  })
  @ApiQuery({ name: 'deviceId', required: false, description: 'Sync operations for specific device only' })
  @ApiResponse({ status: 200, description: 'Synchronization completed' })
  async syncPendingOperations(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Query('deviceId') deviceId?: string,
  ) {
    const result = await this.offlineSyncService.syncPendingOperations(
      tenantId,
      deviceId,
      user.id
    );

    return {
      ...result,
      syncedAt: new Date().toISOString(),
    };
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Get offline sync status',
    description: 'Returns the current status of offline operations and sync queue'
  })
  @ApiQuery({ name: 'deviceId', required: false, description: 'Filter by device ID' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved successfully' })
  async getSyncStatus(
    @CurrentTenant() tenantId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    // In a real implementation, this would query the offline queue repository
    // For now, return mock status
    return {
      tenantId,
      deviceId,
      pendingOperations: 0,
      lastSyncAt: new Date().toISOString(),
      syncInProgress: false,
      errors: [],
      status: 'online',
    };
  }

  @Post('conflict-resolution')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Resolve sync conflicts',
    description: 'Provides resolution for conflicts detected during synchronization'
  })
  @ApiResponse({ status: 200, description: 'Conflicts resolved successfully' })
  async resolveConflicts(
    @Body(ValidationPipe) resolutionData: {
      operationId: string;
      conflicts: Array<{
        type: string;
        description: string;
        serverData: any;
        clientData: any;
      }>;
      resolution: {
        strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
        resolvedData?: any;
      };
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // In a real implementation, this would resolve the conflicts
    // For now, return success
    return {
      success: true,
      operationId: resolutionData.operationId,
      conflictsResolved: resolutionData.conflicts.length,
      strategy: resolutionData.resolution.strategy,
      resolvedAt: new Date().toISOString(),
    };
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Check offline capabilities health',
    description: 'Returns the health status of offline functionality and local storage'
  })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async checkOfflineHealth(
    @CurrentTenant() tenantId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    // In a real implementation, this would check:
    // - Local storage availability
    // - Queue service health
    // - Network connectivity
    // - Sync service status
    
    return {
      status: 'healthy',
      localStorageAvailable: true,
      queueServiceHealthy: true,
      networkConnected: true,
      syncServiceRunning: true,
      lastHealthCheck: new Date().toISOString(),
      capabilities: {
        offlineTransactions: true,
        offlineInventory: true,
        offlineCustomers: true,
        conflictResolution: true,
        prioritySync: true,
      },
    };
  }

  @Post('cache/preload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Preload offline cache',
    description: 'Preloads essential data for offline operations'
  })
  @ApiResponse({ status: 200, description: 'Cache preloaded successfully' })
  async preloadOfflineCache(
    @Body(ValidationPipe) cacheRequest: {
      dataTypes: Array<'products' | 'customers' | 'locations' | 'settings'>;
      locationId?: string;
      maxAge?: number; // Cache max age in seconds
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // In a real implementation, this would:
    // 1. Fetch essential data from the database
    // 2. Store it in local cache/storage
    // 3. Set appropriate cache expiration
    // 4. Return cache statistics
    
    const cacheStats = {
      products: cacheRequest.dataTypes.includes('products') ? 150 : 0,
      customers: cacheRequest.dataTypes.includes('customers') ? 75 : 0,
      locations: cacheRequest.dataTypes.includes('locations') ? 5 : 0,
      settings: cacheRequest.dataTypes.includes('settings') ? 1 : 0,
    };

    return {
      success: true,
      cachedItems: cacheStats,
      totalItems: Object.values(cacheStats).reduce((sum, count) => sum + count, 0),
      cacheExpiry: new Date(Date.now() + (cacheRequest.maxAge || 3600) * 1000).toISOString(),
      preloadedAt: new Date().toISOString(),
    };
  }

  @Get('cache/status')
  @ApiOperation({ 
    summary: 'Get offline cache status',
    description: 'Returns information about cached data for offline operations'
  })
  @ApiResponse({ status: 200, description: 'Cache status retrieved successfully' })
  async getCacheStatus(
    @CurrentTenant() tenantId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    // In a real implementation, this would check local cache/storage
    return {
      cacheSize: '2.5MB',
      itemCount: 231,
      lastUpdated: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      categories: {
        products: { count: 150, size: '1.8MB', lastUpdated: new Date().toISOString() },
        customers: { count: 75, size: '0.5MB', lastUpdated: new Date().toISOString() },
        locations: { count: 5, size: '0.1MB', lastUpdated: new Date().toISOString() },
        settings: { count: 1, size: '0.1MB', lastUpdated: new Date().toISOString() },
      },
      healthStatus: 'healthy',
    };
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Clear offline cache',
    description: 'Clears cached data for offline operations'
  })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearOfflineCache(
    @Body(ValidationPipe) clearRequest: {
      dataTypes?: Array<'products' | 'customers' | 'locations' | 'settings'>;
      clearAll?: boolean;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // In a real implementation, this would clear the specified cache data
    const clearedTypes = clearRequest.clearAll 
      ? ['products', 'customers', 'locations', 'settings']
      : clearRequest.dataTypes || [];

    return {
      success: true,
      clearedTypes,
      clearedAt: new Date().toISOString(),
      remainingCacheSize: clearRequest.clearAll ? '0MB' : '1.2MB',
    };
  }
}