import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from '../gateways/realtime.gateway';

export interface InventoryUpdateEvent {
  productId: string;
  locationId: string;
  previousQuantity: number;
  newQuantity: number;
  changeReason: string;
  changedBy: string;
}

export interface TransactionEvent {
  transactionId: string;
  locationId: string;
  customerId?: string;
  total: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: string;
  status: string;
  processedBy: string;
}

export interface CustomerActivityEvent {
  customerId: string;
  activityType: 'purchase' | 'loyalty_earned' | 'loyalty_redeemed' | 'profile_updated' | 'registration';
  details: Record<string, any>;
  locationId?: string;
}

export interface NotificationEvent {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetUsers?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  /**
   * Broadcast inventory update to all subscribed clients
   */
  async broadcastInventoryUpdate(tenantId: string, event: InventoryUpdateEvent): Promise<void> {
    try {
      this.logger.log(
        `Broadcasting inventory update for tenant ${tenantId}: ${event.productId} at ${event.locationId}`,
      );

      this.realtimeGateway.emitInventoryUpdate(tenantId, event.locationId, {
        type: 'inventory_update',
        productId: event.productId,
        locationId: event.locationId,
        previousQuantity: event.previousQuantity,
        newQuantity: event.newQuantity,
        changeReason: event.changeReason,
        changedBy: event.changedBy,
        quantityChange: event.newQuantity - event.previousQuantity,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to broadcast inventory update: ${err.message}`, err.stack);
    }
  }

  /**
   * Broadcast transaction event to all subscribed clients
   */
  async broadcastTransactionEvent(tenantId: string, event: TransactionEvent): Promise<void> {
    try {
      this.logger.log(
        `Broadcasting transaction event for tenant ${tenantId}: ${event.transactionId} at ${event.locationId}`,
      );

      this.realtimeGateway.emitTransactionUpdate(tenantId, event.locationId, {
        type: 'transaction_created',
        transactionId: event.transactionId,
        locationId: event.locationId,
        customerId: event.customerId,
        total: event.total,
        itemCount: event.items.length,
        paymentMethod: event.paymentMethod,
        status: event.status,
        processedBy: event.processedBy,
        items: event.items,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to broadcast transaction event: ${err.message}`, err.stack);
    }
  }

  /**
   * Broadcast customer activity to subscribed clients
   */
  async broadcastCustomerActivity(tenantId: string, event: CustomerActivityEvent): Promise<void> {
    try {
      this.logger.log(
        `Broadcasting customer activity for tenant ${tenantId}: ${event.customerId} - ${event.activityType}`,
      );

      this.realtimeGateway.emitCustomerActivity(tenantId, event.customerId, {
        type: 'customer_activity',
        customerId: event.customerId,
        activityType: event.activityType,
        details: event.details,
        locationId: event.locationId,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to broadcast customer activity: ${err.message}`, err.stack);
    }
  }

  /**
   * Send notification to specific tenant
   */
  async sendNotification(tenantId: string, notification: NotificationEvent): Promise<void> {
    try {
      this.logger.log(
        `Sending notification to tenant ${tenantId}: ${notification.type} - ${notification.title}`,
      );

      this.realtimeGateway.emitNotification(tenantId, {
        type: 'notification',
        id: notification.id,
        notificationType: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        targetUsers: notification.targetUsers,
        metadata: notification.metadata,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send notification: ${err.message}`, err.stack);
    }
  }

  /**
   * Send system alert to all connected clients in a tenant
   */
  async sendSystemAlert(tenantId: string, alert: {
    type: 'maintenance' | 'outage' | 'update' | 'security';
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    scheduledTime?: Date;
    estimatedDuration?: number;
  }): Promise<void> {
    try {
      this.logger.log(
        `Sending system alert to tenant ${tenantId}: ${alert.type} - ${alert.severity}`,
      );

      this.realtimeGateway.emitNotification(tenantId, {
        type: 'system_alert',
        alertType: alert.type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        scheduledTime: alert.scheduledTime,
        estimatedDuration: alert.estimatedDuration,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send system alert: ${err.message}`, err.stack);
    }
  }

  /**
   * Broadcast low stock alert
   */
  async broadcastLowStockAlert(
    tenantId: string,
    alert: {
      productId: string;
      productName: string;
      locationId: string;
      locationName: string;
      currentQuantity: number;
      reorderPoint: number;
      suggestedReorderQuantity?: number;
    },
  ): Promise<void> {
    try {
      this.logger.log(
        `Broadcasting low stock alert for tenant ${tenantId}: ${alert.productName} at ${alert.locationName}`,
      );

      this.realtimeGateway.emitNotification(tenantId, {
        type: 'low_stock_alert',
        productId: alert.productId,
        productName: alert.productName,
        locationId: alert.locationId,
        locationName: alert.locationName,
        currentQuantity: alert.currentQuantity,
        reorderPoint: alert.reorderPoint,
        suggestedReorderQuantity: alert.suggestedReorderQuantity,
        severity: alert.currentQuantity === 0 ? 'critical' : 'warning',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to broadcast low stock alert: ${err.message}`, err.stack);
    }
  }

  /**
   * Broadcast sales milestone achievement
   */
  async broadcastSalesMilestone(
    tenantId: string,
    milestone: {
      type: 'daily_target' | 'weekly_target' | 'monthly_target' | 'revenue_milestone';
      title: string;
      description: string;
      value: number;
      target: number;
      locationId?: string;
      achievedBy?: string;
    },
  ): Promise<void> {
    try {
      this.logger.log(
        `Broadcasting sales milestone for tenant ${tenantId}: ${milestone.type} - ${milestone.title}`,
      );

      this.realtimeGateway.emitNotification(tenantId, {
        type: 'sales_milestone',
        milestoneType: milestone.type,
        title: milestone.title,
        description: milestone.description,
        value: milestone.value,
        target: milestone.target,
        percentage: Math.round((milestone.value / milestone.target) * 100),
        locationId: milestone.locationId,
        achievedBy: milestone.achievedBy,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to broadcast sales milestone: ${err.message}`, err.stack);
    }
  }

  /**
   * Get real-time connection statistics
   */
  getConnectionStatistics() {
    return this.realtimeGateway.getConnectionStats();
  }

  /**
   * Get active connections for a specific tenant
   */
  getTenantConnections(tenantId: string): Array<{
    id: string;
    user: {
      id: string;
      email: string;
      tenantId: string;
      displayName?: string;
    };
    tenantId: string;
    connectedAt: Date;
    lastActivity: Date;
    rooms: Set<string>;
  }> {
    return this.realtimeGateway.getTenantConnections(tenantId);
  }

  /**
   * Check if tenant has active connections
   */
  hasTenantConnections(tenantId: string): boolean {
    const connections = this.getTenantConnections(tenantId);
    return connections.length > 0;
  }

  /**
   * Get connection count for a tenant
   */
  getTenantConnectionCount(tenantId: string): number {
    const connections = this.getTenantConnections(tenantId);
    return connections.length;
  }
}