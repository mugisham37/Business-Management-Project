import { Injectable, Inject } from '@nestjs/common';

/**
 * Interface for PubSub engine
 */
interface PubSubEngine {
  publish(triggerName: string, payload: any): Promise<void>;
  subscribe(triggerName: string, onMessage: Function, options?: Object): Promise<number>;
  unsubscribe(subId: number): void;
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
}

/**
 * PubSub service with tenant filtering support
 * Wraps the PubSub instance to provide tenant-aware event publishing
 */
@Injectable()
export class PubSubService {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSubEngine,
  ) {}

  /**
   * Publish an event with tenant context
   * Events are automatically tagged with tenant ID for filtering
   */
  async publish<T>(
    triggerName: string,
    payload: T & { tenantId: string },
  ): Promise<void> {
    await this.pubSub.publish(triggerName, payload);
  }

  /**
   * Subscribe to events with automatic tenant filtering
   * Returns an async iterator that only yields events for the specified tenant
   */
  asyncIterator<T>(
    triggers: string | string[],
    tenantId: string,
  ): AsyncIterableIterator<T> {
    const iterator = this.pubSub.asyncIterator<T>(triggers);
    
    // Wrap the iterator to filter by tenant
    return this.filterByTenant<T>(iterator, tenantId);
  }

  /**
   * Filter async iterator by tenant ID
   * Only yields events that match the specified tenant
   */
  private async *filterByTenant<T>(
    iterator: AsyncIterator<T>,
    tenantId: string,
  ): AsyncIterableIterator<T> {
    // Create an async iterable from the iterator
    const iterable: AsyncIterable<T> = {
      [Symbol.asyncIterator]() {
        return iterator;
      },
    };
    
    for await (const value of iterable) {
      // Check if the event has a tenantId and it matches
      if (this.matchesTenant(value, tenantId)) {
        yield value;
      }
    }
  }

  /**
   * Check if an event matches the specified tenant
   */
  private matchesTenant(value: any, tenantId: string): boolean {
    // Handle different payload structures
    if (typeof value === 'object' && value !== null) {
      // Direct tenantId property
      if (value.tenantId === tenantId) {
        return true;
      }

      // Nested in first property (common pattern: { entityCreated: { tenantId, ... } })
      const firstKey = Object.keys(value)[0];
      if (firstKey && typeof value[firstKey] === 'object' && value[firstKey].tenantId === tenantId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Publish multiple events at once
   */
  async publishBatch<T>(
    events: Array<{ triggerName: string; payload: T & { tenantId: string } }>,
  ): Promise<void> {
    await Promise.all(
      events.map(event => this.publish(event.triggerName, event.payload)),
    );
  }

  /**
   * Create a tenant-scoped trigger name
   * Useful for tenant-specific channels
   */
  createTenantTrigger(baseTrigger: string, tenantId: string): string {
    return `${baseTrigger}:${tenantId}`;
  }
}

/**
 * Common subscription event names
 */
export const SUBSCRIPTION_EVENTS = {
  // Entity events
  ENTITY_CREATED: 'ENTITY_CREATED',
  ENTITY_UPDATED: 'ENTITY_UPDATED',
  ENTITY_DELETED: 'ENTITY_DELETED',
  
  // Inventory events
  INVENTORY_CHANGED: 'INVENTORY_CHANGED',
  INVENTORY_LOW_STOCK: 'INVENTORY_LOW_STOCK',
  
  // Transaction events
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED: 'TRANSACTION_UPDATED',
  
  // Employee events
  EMPLOYEE_STATUS_CHANGED: 'EMPLOYEE_STATUS_CHANGED',
  
  // Notification events
  NOTIFICATION_RECEIVED: 'NOTIFICATION_RECEIVED',
  
  // Real-time events
  USER_ONLINE: 'USER_ONLINE',
  USER_OFFLINE: 'USER_OFFLINE',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  
  // Location events
  LOCATION_STATUS_CHANGED: 'LOCATION_STATUS_CHANGED',
  SYNC_STATUS_CHANGED: 'SYNC_STATUS_CHANGED',
  
  // POS events
  POS_TRANSACTION_CREATED: 'POS_TRANSACTION_CREATED',
  OFFLINE_STATUS_CHANGED: 'OFFLINE_STATUS_CHANGED',
  
  // Warehouse events
  PICK_LIST_ASSIGNED: 'PICK_LIST_ASSIGNED',
  PICK_LIST_COMPLETED: 'PICK_LIST_COMPLETED',
  
  // Supplier events
  PURCHASE_ORDER_APPROVED: 'PURCHASE_ORDER_APPROVED',
  PURCHASE_ORDER_RECEIVED: 'PURCHASE_ORDER_RECEIVED',
  
  // B2B events
  CONTRACT_EXPIRING: 'CONTRACT_EXPIRING',
  
  // Communication events
  COMMUNICATION_SCHEDULED: 'COMMUNICATION_SCHEDULED',
  
  // Compliance events
  COMPLIANCE_EXPIRING: 'COMPLIANCE_EXPIRING',
  
  // Integration events
  WEBHOOK_DELIVERED: 'WEBHOOK_DELIVERED',
  
  // Location events
  PROMOTION_ACTIVATED: 'PROMOTION_ACTIVATED',
  
  // Analytics events
  METRICS_UPDATED: 'METRICS_UPDATED',
} as const;

export type SubscriptionEvent = typeof SUBSCRIPTION_EVENTS[keyof typeof SUBSCRIPTION_EVENTS];
