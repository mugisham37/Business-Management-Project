import { Injectable, Logger } from '@nestjs/common';
import DataLoader from 'dataloader';
import { B2BOrderRepository } from '../repositories/b2b-order.repository';
import { B2BOrderService } from '../services/b2b-order.service';

/**
 * DataLoader for B2B orders to prevent N+1 query problems
 * 
 * Provides batched loading for:
 * - Orders by ID
 * - Orders by customer ID
 * - Order items by order ID
 * - Order analytics by customer
 */
@Injectable()
export class B2BOrderDataLoader {
  private readonly logger = new Logger(B2BOrderDataLoader.name);

  constructor(
    private readonly b2bOrderRepository: B2BOrderRepository,
    private readonly b2bOrderService: B2BOrderService,
  ) {}

  /**
   * Create DataLoader for orders by ID
   */
  createOrderByIdLoader(tenantId: string): DataLoader<string, any> {
    return new DataLoader(async (orderIds: readonly string[]) => {
      try {
        this.logger.debug(`Batch loading ${orderIds.length} orders for tenant ${tenantId}`);
        
        const orders = await Promise.all(
          orderIds.map(id => this.b2bOrderRepository.findById(tenantId, id))
        );

        return orders;
      } catch (error) {
        this.logger.error(`Failed to batch load orders:`, error);
        throw error;
      }
    });
  }

  /**
   * Create DataLoader for orders by customer ID
   */
  createOrdersByCustomerLoader(tenantId: string): DataLoader<string, any[]> {
    return new DataLoader(async (customerIds: readonly string[]) => {
      try {
        this.logger.debug(`Batch loading orders for ${customerIds.length} customers in tenant ${tenantId}`);
        
        const ordersByCustomer = await Promise.all(
          customerIds.map(customerId => 
            this.b2bOrderRepository.findByCustomerId(tenantId, customerId)
          )
        );

        return ordersByCustomer;
      } catch (error) {
        this.logger.error(`Failed to batch load orders by customer:`, error);
        throw error;
      }
    });
  }

  /**
   * Create DataLoader for order items by order ID
   */
  createOrderItemsLoader(tenantId: string): DataLoader<string, any[]> {
    return new DataLoader(async (orderIds: readonly string[]) => {
      try {
        this.logger.debug(`Batch loading order items for ${orderIds.length} orders in tenant ${tenantId}`);
        
        const itemsByOrder = await Promise.all(
          orderIds.map(orderId => 
            this.b2bOrderRepository.findOrderItems(tenantId, orderId)
          )
        );

        return itemsByOrder;
      } catch (error) {
        this.logger.error(`Failed to batch load order items:`, error);
        throw error;
      }
    });
  }

  /**
   * Create DataLoader for order analytics by customer
   */
  createCustomerOrderAnalyticsLoader(tenantId: string): DataLoader<string, any> {
    return new DataLoader(async (customerIds: readonly string[]) => {
      try {
        this.logger.debug(`Batch loading order analytics for ${customerIds.length} customers in tenant ${tenantId}`);
        
        const analytics = await Promise.all(
          customerIds.map(customerId => 
            this.b2bOrderService.getCustomerOrderAnalytics(tenantId, customerId)
          )
        );

        return analytics;
      } catch (error) {
        this.logger.error(`Failed to batch load customer order analytics:`, error);
        throw error;
      }
    });
  }

  /**
   * Create DataLoader for order approval status
   */
  createOrderApprovalStatusLoader(tenantId: string): DataLoader<string, any> {
    return new DataLoader(async (orderIds: readonly string[]) => {
      try {
        this.logger.debug(`Batch loading approval status for ${orderIds.length} orders in tenant ${tenantId}`);
        
        const approvalStatuses = await Promise.all(
          orderIds.map(orderId => 
            this.b2bOrderService.getOrderApprovalStatus(tenantId, orderId)
          )
        );

        return approvalStatuses;
      } catch (error) {
        this.logger.error(`Failed to batch load order approval statuses:`, error);
        throw error;
      }
    });
  }
}