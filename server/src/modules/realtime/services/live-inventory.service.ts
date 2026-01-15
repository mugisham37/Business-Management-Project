import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeService } from './realtime.service';
import { InventoryLevelChangedEvent, LowStockAlertEvent, InventoryTransferEvent } from '../../inventory/services/inventory.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface LiveInventoryUpdate {
  type: 'level_changed' | 'low_stock' | 'transfer' | 'reservation';
  productId: string;
  productName?: string;
  variantId?: string | null;
  locationId: string;
  locationName?: string;
  previousLevel?: number;
  newLevel: number;
  changeReason: string;
  changedBy: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface InventoryDashboardData {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  recentMovements: Array<{
    productId: string;
    productName: string;
    locationId: string;
    locationName: string;
    changeType: string;
    quantity: number;
    timestamp: Date;
  }>;
  topMovingProducts: Array<{
    productId: string;
    productName: string;
    totalMovement: number;
    locations: number;
  }>;
  locationSummary: Array<{
    locationId: string;
    locationName: string;
    totalProducts: number;
    lowStockCount: number;
    totalValue: number;
  }>;
}

@Injectable()
export class LiveInventoryService {
  private readonly logger = new Logger(LiveInventoryService.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Handle inventory level changes and broadcast updates
   */
  @OnEvent('inventory.level.changed')
  async handleInventoryLevelChanged(event: InventoryLevelChangedEvent): Promise<void> {
    try {
      this.logger.log(
        `Processing inventory level change: ${event.productId} at ${event.locationId} - ${event.previousLevel} → ${event.newLevel}`,
      );

      // Create live update payload
      const update: LiveInventoryUpdate = {
        type: 'level_changed',
        productId: event.productId,
        variantId: event.variantId,
        locationId: event.locationId,
        previousLevel: event.previousLevel,
        newLevel: event.newLevel,
        changeReason: event.changeReason,
        changedBy: event.userId,
        timestamp: new Date(),
        metadata: {
          quantityChange: event.newLevel - event.previousLevel,
        },
      };

      // Broadcast to real-time subscribers
      await this.realtimeService.broadcastInventoryUpdate(event.tenantId, {
        productId: event.productId,
        locationId: event.locationId,
        previousQuantity: event.previousLevel,
        newQuantity: event.newLevel,
        changeReason: event.changeReason,
        changedBy: event.userId,
      });

      // Update dashboard cache
      await this.updateInventoryDashboardCache(event.tenantId);

      // Send notification for significant changes
      if (Math.abs(event.newLevel - event.previousLevel) >= 100) {
        await this.realtimeService.sendNotification(event.tenantId, {
          id: `inventory-${event.productId}-${Date.now()}`,
          type: 'info',
          title: 'Significant Inventory Change',
          message: `Product ${event.productId} level changed by ${event.newLevel - event.previousLevel} units`,
          priority: 'medium',
          metadata: {
            productId: event.productId,
            locationId: event.locationId,
            changeAmount: event.newLevel - event.previousLevel,
          },
        });
      }

    } catch (error: any) {
      this.logger.error(`Failed to handle inventory level change: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle low stock alerts
   */
  @OnEvent('inventory.low.stock')
  async handleLowStockAlert(event: LowStockAlertEvent): Promise<void> {
    try {
      this.logger.log(
        `Processing low stock alert: ${event.productId} at ${event.locationId} - ${event.currentLevel}/${event.reorderPoint}`,
      );

      // Broadcast low stock alert
      await this.realtimeService.broadcastLowStockAlert(event.tenantId, {
        productId: event.productId,
        productName: `Product ${event.productId}`, // Would be fetched from product service
        locationId: event.locationId,
        locationName: `Location ${event.locationId}`, // Would be fetched from location service
        currentQuantity: event.currentLevel,
        reorderPoint: event.reorderPoint,
      });

      // Update dashboard cache
      await this.updateInventoryDashboardCache(event.tenantId);

    } catch (error: any) {
      this.logger.error(`Failed to handle low stock alert: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle inventory transfers
   */
  @OnEvent('inventory.transfer')
  async handleInventoryTransfer(event: InventoryTransferEvent): Promise<void> {
    try {
      this.logger.log(
        `Processing inventory transfer: ${event.productId} from ${event.fromLocationId} to ${event.toLocationId} - ${event.quantity} units`,
      );

      // Broadcast transfer update to both locations
      const transferUpdate = {
        type: 'transfer' as const,
        productId: event.productId,
        variantId: event.variantId,
        fromLocationId: event.fromLocationId,
        toLocationId: event.toLocationId,
        quantity: event.quantity,
        transferredBy: event.userId,
        timestamp: new Date(),
      };

      // Broadcast to source location
      await this.realtimeService.broadcastInventoryUpdate(event.tenantId, {
        productId: event.productId,
        locationId: event.fromLocationId,
        previousQuantity: 0, // Would need to fetch actual values
        newQuantity: 0, // Would need to fetch actual values
        changeReason: 'transfer_out',
        changedBy: event.userId,
      });

      // Broadcast to destination location
      await this.realtimeService.broadcastInventoryUpdate(event.tenantId, {
        productId: event.productId,
        locationId: event.toLocationId,
        previousQuantity: 0, // Would need to fetch actual values
        newQuantity: 0, // Would need to fetch actual values
        changeReason: 'transfer_in',
        changedBy: event.userId,
      });

      // Update dashboard cache
      await this.updateInventoryDashboardCache(event.tenantId);

      // Send notification for transfer completion
      await this.realtimeService.sendNotification(event.tenantId, {
        id: `transfer-${event.productId}-${Date.now()}`,
        type: 'success',
        title: 'Inventory Transfer Completed',
        message: `${event.quantity} units of ${event.productId} transferred successfully`,
        priority: 'low',
        metadata: {
          productId: event.productId,
          fromLocationId: event.fromLocationId,
          toLocationId: event.toLocationId,
          quantity: event.quantity,
        },
      });

    } catch (error: any) {
      this.logger.error(`Failed to handle inventory transfer: ${error.message}`, error.stack);
    }
  }

  /**
   * Get real-time inventory dashboard data
   */
  async getInventoryDashboardData(tenantId: string, locationId?: string): Promise<InventoryDashboardData> {
    try {
      const cacheKey = `inventory-dashboard:${tenantId}:${locationId || 'all'}`;
      
      // Try cache first
      let dashboardData = await this.cacheService.get<InventoryDashboardData>(cacheKey);
      
      if (!dashboardData) {
        // Generate dashboard data (this would integrate with actual inventory service)
        dashboardData = await this.generateInventoryDashboardData(tenantId, locationId);
        
        // Cache for 2 minutes
        await this.cacheService.set(cacheKey, dashboardData, { ttl: 120 });
      }

      return dashboardData;
    } catch (error: any) {
      this.logger.error(`Failed to get inventory dashboard data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get live inventory levels for specific products
   */
  async getLiveInventoryLevels(
    tenantId: string,
    productIds: string[],
    locationId?: string,
  ): Promise<Array<{
    productId: string;
    variantId?: string | null;
    locationId: string;
    currentLevel: number;
    availableLevel: number;
    reservedLevel: number;
    reorderPoint: number;
    lastUpdated: Date;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
  }>> {
    try {
      const cacheKey = `live-inventory:${tenantId}:${productIds.join(',')}:${locationId || 'all'}`;
      
      // Try cache first
      let inventoryLevels = await this.cacheService.get<any[]>(cacheKey);
      
      if (!inventoryLevels) {
        // Fetch from inventory service (mock data for now)
        inventoryLevels = productIds.map(productId => ({
          productId,
          variantId: null,
          locationId: locationId || 'default',
          currentLevel: Math.floor(Math.random() * 100),
          availableLevel: Math.floor(Math.random() * 90),
          reservedLevel: Math.floor(Math.random() * 10),
          reorderPoint: 20,
          lastUpdated: new Date(),
          status: 'in_stock' as const,
        }));
        
        // Cache for 30 seconds (very short for live data)
        await this.cacheService.set(cacheKey, inventoryLevels, { ttl: 30 });
      }

      return inventoryLevels;
    } catch (error: any) {
      this.logger.error(`Failed to get live inventory levels: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Subscribe to inventory updates for specific products
   */
  async subscribeToInventoryUpdates(
    tenantId: string,
    productIds: string[],
    locationId?: string,
  ): Promise<{ subscriptionId: string; initialData: any[] }> {
    try {
      const subscriptionId = `inv-${tenantId}-${Date.now()}`;
      
      // Get initial data
      const initialData = await this.getLiveInventoryLevels(tenantId, productIds, locationId);
      
      this.logger.log(
        `Created inventory subscription ${subscriptionId} for ${productIds.length} products`,
      );

      return {
        subscriptionId,
        initialData,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create inventory subscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async updateInventoryDashboardCache(tenantId: string): Promise<void> {
    try {
      // Invalidate all dashboard caches for this tenant
      await this.cacheService.invalidatePattern(`inventory-dashboard:${tenantId}:*`);
      await this.cacheService.invalidatePattern(`live-inventory:${tenantId}:*`);
    } catch (error: any) {
      this.logger.warn(`Failed to update inventory dashboard cache: ${error.message}`);
    }
  }

  private async generateInventoryDashboardData(
    tenantId: string,
    locationId?: string,
  ): Promise<InventoryDashboardData> {
    // This would integrate with actual inventory service
    // For now, returning mock data structure
    return {
      totalProducts: 150,
      lowStockCount: 12,
      outOfStockCount: 3,
      totalValue: 45000.00,
      recentMovements: [
        {
          productId: 'prod-001',
          productName: 'Sample Product 1',
          locationId: 'loc-001',
          locationName: 'Main Store',
          changeType: 'sale',
          quantity: -5,
          timestamp: new Date(),
        },
      ],
      topMovingProducts: [
        {
          productId: 'prod-001',
          productName: 'Sample Product 1',
          totalMovement: 50,
          locations: 3,
        },
      ],
      locationSummary: [
        {
          locationId: 'loc-001',
          locationName: 'Main Store',
          totalProducts: 100,
          lowStockCount: 8,
          totalValue: 30000.00,
        },
      ],
    };
  }
}