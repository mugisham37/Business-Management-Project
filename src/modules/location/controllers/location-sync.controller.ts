import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission, CurrentUser, CurrentTenant } from '../../auth/decorators/auth.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { LocationSyncService } from '../services/location-sync.service';
import { LocationOfflineService, OfflineOperation } from '../services/location-offline.service';

@Controller('api/v1/locations/sync')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
@ApiTags('Location Sync')
export class LocationSyncController {
  constructor(
    private readonly locationSyncService: LocationSyncService,
    private readonly locationOfflineService: LocationOfflineService,
  ) {}

  @Get('status')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get sync status for tenant' })
  @ApiResponse({ 
    status: 200, 
    description: 'Sync status retrieved successfully',
  })
  async getSyncStatus(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    lastSyncTime: Date | null;
    pendingEvents: number;
    failedEvents: number;
    conflicts: number;
  }> {
    return this.locationSyncService.getSyncStatus(tenantId);
  }

  @Post('retry-failed')
  @RequirePermission('locations:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry failed sync events' })
  @ApiResponse({ 
    status: 200, 
    description: 'Failed events retried successfully',
  })
  async retryFailedEvents(
    @CurrentTenant() tenantId: string,
  ): Promise<{ retriedCount: number }> {
    const retriedCount = await this.locationSyncService.retryFailedEvents(tenantId);
    return { retriedCount };
  }

  @Get('offline/:locationId/status')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get offline queue status for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Offline queue status retrieved successfully',
  })
  async getOfflineQueueStatus(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    totalOperations: number;
    pendingOperations: number;
    failedOperations: number;
    lastSyncAttempt: Date | null;
    isOnline: boolean;
  }> {
    return this.locationOfflineService.getOfflineQueueStatus(tenantId, locationId);
  }

  @Get('offline/:locationId/queue')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get offline queue for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Offline queue retrieved successfully',
  })
  async getOfflineQueue(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<OfflineOperation[]> {
    return this.locationOfflineService.getOfflineQueue(tenantId, locationId);
  }

  @Put('offline/:locationId/connection')
  @RequirePermission('locations:update')
  @ApiOperation({ summary: 'Update location connection status' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Connection status updated successfully',
  })
  async updateConnectionStatus(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() body: { isOnline: boolean },
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.locationOfflineService.updateConnectionStatus(tenantId, locationId, body.isOnline);
    return { message: `Location ${locationId} marked as ${body.isOnline ? 'online' : 'offline'}` };
  }

  @Post('offline/:locationId/sync')
  @RequirePermission('locations:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger sync for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Sync triggered successfully',
  })
  async triggerSync(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ syncedCount: number }> {
    const syncedCount = await this.locationOfflineService.attemptSync(tenantId, locationId);
    return { syncedCount };
  }

  @Post('offline/:locationId/retry-failed')
  @RequirePermission('locations:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry failed offline operations for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Failed operations retried successfully',
  })
  async retryFailedOfflineOperations(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ syncedCount: number }> {
    const syncedCount = await this.locationOfflineService.retryFailedOperations(tenantId, locationId);
    return { syncedCount };
  }

  @Post('offline/:locationId/clear-queue')
  @RequirePermission('locations:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear offline queue for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Offline queue cleared successfully',
  })
  async clearOfflineQueue(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.locationOfflineService.clearOfflineQueue(tenantId, locationId);
    return { message: `Offline queue cleared for location ${locationId}` };
  }

  @Get('offline/:locationId/is-online')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Check if location is online' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Online status retrieved successfully',
  })
  async isLocationOnline(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ isOnline: boolean }> {
    const isOnline = await this.locationOfflineService.isLocationOnline(tenantId, locationId);
    return { isOnline };
  }

  @Post('offline/:locationId/queue-operation')
  @RequirePermission('locations:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Manually queue an offline operation' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Operation queued successfully',
  })
  async queueOfflineOperation(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() operation: {
      operationType: 'create' | 'update' | 'delete';
      entityType: string;
      entityId: string;
      data: any;
      maxRetries?: number;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ operationId: string }> {
    const operationId = await this.locationOfflineService.queueOfflineOperation({
      tenantId,
      locationId,
      operationType: operation.operationType,
      entityType: operation.entityType,
      entityId: operation.entityId,
      data: operation.data,
      timestamp: new Date(),
      userId: user.id,
      maxRetries: operation.maxRetries || 3,
    });
    
    return { operationId };
  }
}