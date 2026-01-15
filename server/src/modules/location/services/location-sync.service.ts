import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { LocationService } from './location.service';
import { Location } from '../entities/location.entity';

export interface SyncEvent {
  id: string;
  tenantId: string;
  locationId: string;
  eventType: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  data: any;
  timestamp: Date;
  userId: string;
  version: number;
}

export interface ConflictResolution {
  strategy: 'last-write-wins' | 'manual' | 'merge' | 'reject';
  resolvedData?: any;
  conflictReason?: string;
}

@Injectable()
export class LocationSyncService {
  private readonly logger = new Logger(LocationSyncService.name);
  private readonly syncChannelPrefix = 'location-sync';
  
  // In-memory storage for sync events and logs
  private syncEvents = new Map<string, SyncEvent>();
  private syncTimelines = new Map<string, Array<{ id: string; timestamp: number }>>();
  private failedEvents = new Map<string, Array<string>>();
  private conflicts = new Map<string, Array<string>>();
  private subscribers = new Map<string, Array<(event: SyncEvent) => void>>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly locationService: LocationService,
  ) {}

  /**
   * Broadcast a sync event to all locations within a tenant
   */
  async broadcastSyncEvent(event: SyncEvent): Promise<void> {
    try {
      const channel = `${this.syncChannelPrefix}:${event.tenantId}`;
      
      // Store event in sync log for conflict resolution
      await this.storeSyncEvent(event);
      
      // Notify subscribers
      const channelSubscribers = this.subscribers.get(channel) || [];
      for (const subscriber of channelSubscribers) {
        try {
          subscriber(event);
        } catch (error: any) {
          this.logger.error(`Failed to notify subscriber: ${error.message}`, error.stack);
        }
      }
      
      // Handle the event locally as well
      await this.handleSyncEvent(event);
      
      this.logger.debug(`Broadcasted sync event: ${event.id} to channel: ${channel}`);
    } catch (error: any) {
      this.logger.error(`Failed to broadcast sync event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle incoming sync events from other locations
   */
  private async handleSyncEvent(event: SyncEvent): Promise<void> {
    try {
      this.logger.debug(`Received sync event: ${event.id} for entity: ${event.entityType}:${event.entityId}`);

      // Check for conflicts
      const conflict = await this.detectConflict(event);
      if (conflict) {
        await this.handleConflict(event, conflict);
        return;
      }

      // Apply the sync event
      await this.applySyncEvent(event);
      
      // Emit local event for further processing
      this.eventEmitter.emit('sync.applied', event);
      
    } catch (error: any) {
      this.logger.error(`Failed to handle sync event: ${error.message}`, error.stack);
      
      // Store failed event for manual resolution
      await this.storeFailedSyncEvent(event, error.message);
    }
  }

  /**
   * Detect conflicts between incoming sync event and local data
   */
  private async detectConflict(event: SyncEvent): Promise<ConflictResolution | null> {
    try {
      const syncLogKey = `sync-log:${event.tenantId}:${event.entityType}:${event.entityId}`;
      const lastSyncEvent = this.syncEvents.get(syncLogKey);
      
      if (!lastSyncEvent) {
        return null; // No previous event, no conflict
      }
      
      // Check for version conflicts
      if (event.version <= lastSyncEvent.version) {
        return {
          strategy: 'reject',
          conflictReason: 'Outdated version received',
        };
      }

      // Check for concurrent modifications (same timestamp, different locations)
      const timeDiff = Math.abs(event.timestamp.getTime() - lastSyncEvent.timestamp.getTime());
      if (timeDiff < 1000 && event.locationId !== lastSyncEvent.locationId) {
        return {
          strategy: 'last-write-wins',
          conflictReason: 'Concurrent modification detected',
        };
      }

      return null; // No conflict detected
    } catch (error: any) {
      this.logger.error(`Failed to detect conflict: ${error.message}`, error.stack);
      return {
        strategy: 'manual',
        conflictReason: 'Error during conflict detection',
      };
    }
  }

  /**
   * Handle conflicts based on resolution strategy
   */
  private async handleConflict(event: SyncEvent, resolution: ConflictResolution): Promise<void> {
    try {
      switch (resolution.strategy) {
        case 'last-write-wins':
          await this.applySyncEvent(event);
          this.logger.warn(`Applied last-write-wins resolution for event: ${event.id}`);
          break;
          
        case 'reject':
          this.logger.warn(`Rejected sync event: ${event.id} - ${resolution.conflictReason}`);
          break;
          
        case 'manual':
          await this.storeConflictForManualResolution(event, resolution);
          this.logger.warn(`Stored conflict for manual resolution: ${event.id}`);
          break;
          
        case 'merge':
          // Implement merge logic based on entity type
          await this.mergeSyncEvent(event, resolution);
          break;
      }
    } catch (error: any) {
      this.logger.error(`Failed to handle conflict: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Apply sync event to local data
   */
  private async applySyncEvent(event: SyncEvent): Promise<void> {
    try {
      switch (event.entityType) {
        case 'location':
          await this.applyLocationSync(event);
          break;
        case 'inventory':
          await this.applyInventorySync(event);
          break;
        case 'transaction':
          await this.applyTransactionSync(event);
          break;
        case 'customer':
          await this.applyCustomerSync(event);
          break;
        default:
          this.logger.warn(`Unknown entity type for sync: ${event.entityType}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to apply sync event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Apply location-specific sync events
   */
  private async applyLocationSync(event: SyncEvent): Promise<void> {
    try {
      switch (event.eventType) {
        case 'create':
          // Location creation is handled by the location service
          this.eventEmitter.emit('location.sync.created', event);
          break;
          
        case 'update':
          // Update location data
          await this.locationService.update(
            event.tenantId,
            event.entityId,
            event.data,
            event.userId
          );
          break;
          
        case 'delete':
          // Soft delete location
          await this.locationService.delete(
            event.tenantId,
            event.entityId,
            event.userId
          );
          break;
      }
    } catch (error: any) {
      this.logger.error(`Failed to apply location sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Apply inventory-specific sync events
   */
  private async applyInventorySync(event: SyncEvent): Promise<void> {
    try {
      // Emit event for inventory module to handle
      this.eventEmitter.emit('inventory.sync.received', event);
    } catch (error: any) {
      this.logger.error(`Failed to apply inventory sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Apply transaction-specific sync events
   */
  private async applyTransactionSync(event: SyncEvent): Promise<void> {
    try {
      // Emit event for POS module to handle
      this.eventEmitter.emit('transaction.sync.received', event);
    } catch (error: any) {
      this.logger.error(`Failed to apply transaction sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Apply customer-specific sync events
   */
  private async applyCustomerSync(event: SyncEvent): Promise<void> {
    try {
      // Emit event for CRM module to handle
      this.eventEmitter.emit('customer.sync.received', event);
    } catch (error: any) {
      this.logger.error(`Failed to apply customer sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Merge sync event data with existing data
   */
  private async mergeSyncEvent(event: SyncEvent, resolution: ConflictResolution): Promise<void> {
    try {
      // Implement entity-specific merge logic
      switch (event.entityType) {
        case 'location':
          // For locations, merge non-conflicting fields
          const mergedData = await this.mergeLocationData(event);
          event.data = mergedData;
          await this.applySyncEvent(event);
          break;
          
        default:
          // Default to last-write-wins for unknown entities
          await this.applySyncEvent(event);
      }
    } catch (error: any) {
      this.logger.error(`Failed to merge sync event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Merge location data intelligently
   */
  private async mergeLocationData(event: SyncEvent): Promise<any> {
    try {
      const currentLocation = await this.locationService.findById(event.tenantId, event.entityId);
      const incomingData = event.data;
      
      // Merge strategy: prefer incoming data for most fields,
      // but preserve local changes for specific fields like metrics
      const mergedData = {
        ...incomingData,
        metrics: {
          ...currentLocation.metrics,
          ...incomingData.metrics,
        },
        settings: {
          ...currentLocation.settings,
          ...incomingData.settings,
        },
      };
      
      return mergedData;
    } catch (error: any) {
      this.logger.error(`Failed to merge location data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Store sync event in log for conflict resolution
   */
  private async storeSyncEvent(event: SyncEvent): Promise<void> {
    try {
      const syncLogKey = `sync-log:${event.tenantId}:${event.entityType}:${event.entityId}`;
      
      // Store event
      this.syncEvents.set(syncLogKey, event);
      
      // Also store in timeline
      const timelineKey = `sync-timeline:${event.tenantId}`;
      let timeline = this.syncTimelines.get(timelineKey) || [];
      timeline.push({ id: event.id, timestamp: event.timestamp.getTime() });
      
      // Keep only last 1000 events
      if (timeline.length > 1000) {
        timeline = timeline.slice(-1000);
      }
      
      this.syncTimelines.set(timelineKey, timeline);
      
    } catch (error: any) {
      this.logger.error(`Failed to store sync event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Store failed sync event for manual resolution
   */
  private async storeFailedSyncEvent(event: SyncEvent, errorMessage: string): Promise<void> {
    try {
      const failedEventKey = `failed-sync:${event.tenantId}:${event.id}`;
      const failedEventData = {
        ...event,
        error: errorMessage,
        failedAt: new Date(),
      };
      
      // Store failed event
      this.syncEvents.set(failedEventKey, failedEventData as any);
      
      // Add to failed events list
      const failedListKey = `failed-sync-list:${event.tenantId}`;
      let failedList = this.failedEvents.get(failedListKey) || [];
      failedList.unshift(event.id);
      
      // Keep only last 100 failed events
      if (failedList.length > 100) {
        failedList = failedList.slice(0, 100);
      }
      
      this.failedEvents.set(failedListKey, failedList);
      
    } catch (error: any) {
      this.logger.error(`Failed to store failed sync event: ${error.message}`, error.stack);
    }
  }

  /**
   * Store conflict for manual resolution
   */
  private async storeConflictForManualResolution(event: SyncEvent, resolution: ConflictResolution): Promise<void> {
    try {
      const conflictKey = `conflict:${event.tenantId}:${event.id}`;
      const conflictData = {
        event,
        resolution,
        createdAt: new Date(),
      };
      
      // Store conflict
      this.syncEvents.set(conflictKey, conflictData as any);
      
      // Add to conflicts list
      const conflictsListKey = `conflicts-list:${event.tenantId}`;
      let conflictsList = this.conflicts.get(conflictsListKey) || [];
      conflictsList.unshift(event.id);
      
      // Keep only last 100 conflicts
      if (conflictsList.length > 100) {
        conflictsList = conflictsList.slice(0, 100);
      }
      
      this.conflicts.set(conflictsListKey, conflictsList);
      
    } catch (error: any) {
      this.logger.error(`Failed to store conflict: ${error.message}`, error.stack);
    }
  }

  /**
   * Setup subscriptions for sync events (in-memory implementation)
   */
  private setupSubscriptions(): void {
    try {
      this.logger.log('In-memory sync subscriptions setup complete');
    } catch (error: any) {
      this.logger.error(`Failed to setup subscriptions: ${error.message}`, error.stack);
    }
  }

  /**
   * Get sync status for a tenant
   */
  async getSyncStatus(tenantId: string): Promise<{
    lastSyncTime: Date | null;
    pendingEvents: number;
    failedEvents: number;
    conflicts: number;
  }> {
    try {
      // Get last sync time from timeline
      const timelineKey = `sync-timeline:${tenantId}`;
      const timeline = this.syncTimelines.get(timelineKey) || [];
      const lastEvent = timeline.length > 0 ? timeline[timeline.length - 1] : null;
      const lastSyncTime = lastEvent?.timestamp ? new Date(lastEvent.timestamp) : null;
      
      // Count failed events
      const failedListKey = `failed-sync-list:${tenantId}`;
      const failedEvents = (this.failedEvents.get(failedListKey) || []).length;
      
      // Count conflicts
      const conflictsListKey = `conflicts-list:${tenantId}`;
      const conflicts = (this.conflicts.get(conflictsListKey) || []).length;
      
      return {
        lastSyncTime,
        pendingEvents: 0, // Would need to implement pending queue
        failedEvents,
        conflicts,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get sync status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Retry failed sync events
   */
  async retryFailedEvents(tenantId: string): Promise<number> {
    try {
      const failedListKey = `failed-sync-list:${tenantId}`;
      const failedEventIds = this.failedEvents.get(failedListKey) || [];
      
      let retriedCount = 0;
      
      for (const eventId of failedEventIds) {
        try {
          const failedEventKey = `failed-sync:${tenantId}:${eventId}`;
          const failedEventData = this.syncEvents.get(failedEventKey);
          
          if (failedEventData) {
            const { error, failedAt, ...event } = failedEventData as any;
            await this.handleSyncEvent(event);
            
            // Remove from failed list if successful
            const updatedFailedList = failedEventIds.filter(id => id !== eventId);
            this.failedEvents.set(failedListKey, updatedFailedList);
            this.syncEvents.delete(failedEventKey);
            
            retriedCount++;
          }
        } catch (error: any) {
          this.logger.warn(`Failed to retry sync event ${eventId}: ${error.message}`);
        }
      }
      
      return retriedCount;
    } catch (error: any) {
      this.logger.error(`Failed to retry failed events: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Event handlers for location changes
   */
  @OnEvent('location.created')
  async handleLocationCreated(event: any): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: event.tenantId,
      locationId: event.locationId,
      eventType: 'create',
      entityType: 'location',
      entityId: event.locationId,
      data: event.location,
      timestamp: new Date(),
      userId: event.userId,
      version: 1,
    };
    
    await this.broadcastSyncEvent(syncEvent);
  }

  @OnEvent('location.updated')
  async handleLocationUpdated(event: any): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: event.tenantId,
      locationId: event.locationId,
      eventType: 'update',
      entityType: 'location',
      entityId: event.locationId,
      data: event.location,
      timestamp: new Date(),
      userId: event.userId,
      version: event.location.version || 1,
    };
    
    await this.broadcastSyncEvent(syncEvent);
  }

  @OnEvent('location.deleted')
  async handleLocationDeleted(event: any): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: event.tenantId,
      locationId: event.locationId,
      eventType: 'delete',
      entityType: 'location',
      entityId: event.locationId,
      data: { id: event.locationId },
      timestamp: new Date(),
      userId: event.userId,
      version: 1,
    };
    
    await this.broadcastSyncEvent(syncEvent);
  }
}