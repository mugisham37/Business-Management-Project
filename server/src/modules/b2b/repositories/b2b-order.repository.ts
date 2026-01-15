import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { b2bOrders, b2bOrderItems } from '../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class B2BOrderRepository {
  private readonly logger = new Logger(B2BOrderRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async findById(tenantId: string, orderId: string) {
    try {
      const [order] = await this.drizzle.getDb()
        .select()
        .from(b2bOrders)
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.id, orderId),
          isNull(b2bOrders.deletedAt)
        ));

      return order;
    } catch (error) {
      this.logger.error(`Failed to find B2B order ${orderId}:`, error);
      throw error;
    }
  }

  async findByCustomerId(tenantId: string, customerId: string) {
    try {
      return await this.drizzle.getDb()
        .select()
        .from(b2bOrders)
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.customerId, customerId),
          isNull(b2bOrders.deletedAt)
        ));
    } catch (error) {
      this.logger.error(`Failed to find B2B orders for customer ${customerId}:`, error);
      throw error;
    }
  }

  async findByOrderNumber(tenantId: string, orderNumber: string) {
    try {
      const [order] = await this.drizzle.getDb()
        .select()
        .from(b2bOrders)
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.orderNumber, orderNumber),
          isNull(b2bOrders.deletedAt)
        ));

      return order;
    } catch (error) {
      this.logger.error(`Failed to find B2B order by number ${orderNumber}:`, error);
      throw error;
    }
  }

  async create(orderData: any) {
    try {
      const result = await this.drizzle.getDb()
        .insert(b2bOrders)
        .values(orderData)
        .returning();

      const order = Array.isArray(result) ? result[0] : result;
      return order;
    } catch (error) {
      this.logger.error(`Failed to create B2B order:`, error);
      throw error;
    }
  }

  async update(tenantId: string, orderId: string, updateData: any) {
    try {
      const [order] = await this.drizzle.getDb()
        .update(b2bOrders)
        .set(updateData)
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.id, orderId),
          isNull(b2bOrders.deletedAt)
        ))
        .returning();

      return order;
    } catch (error) {
      this.logger.error(`Failed to update B2B order ${orderId}:`, error);
      throw error;
    }
  }

  async delete(tenantId: string, orderId: string, userId: string) {
    try {
      const [order] = await this.drizzle.getDb()
        .update(b2bOrders)
        .set({
          deletedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.id, orderId)
        ))
        .returning();

      return order;
    } catch (error) {
      this.logger.error(`Failed to delete B2B order ${orderId}:`, error);
      throw error;
    }
  }

  // Order items methods
  async findOrderItems(tenantId: string, orderId: string) {
    try {
      return await this.drizzle.getDb()
        .select()
        .from(b2bOrderItems)
        .where(and(
          eq(b2bOrderItems.tenantId, tenantId),
          eq(b2bOrderItems.orderId, orderId),
          isNull(b2bOrderItems.deletedAt)
        ));
    } catch (error) {
      this.logger.error(`Failed to find B2B order items for order ${orderId}:`, error);
      throw error;
    }
  }

  async createOrderItems(itemsData: any[]) {
    try {
      return await this.drizzle.getDb()
        .insert(b2bOrderItems)
        .values(itemsData)
        .returning();
    } catch (error) {
      this.logger.error(`Failed to create B2B order items:`, error);
      throw error;
    }
  }

  async updateOrderItem(tenantId: string, itemId: string, updateData: any) {
    try {
      const [item] = await this.drizzle.getDb()
        .update(b2bOrderItems)
        .set(updateData)
        .where(and(
          eq(b2bOrderItems.tenantId, tenantId),
          eq(b2bOrderItems.id, itemId),
          isNull(b2bOrderItems.deletedAt)
        ))
        .returning();

      return item;
    } catch (error) {
      this.logger.error(`Failed to update B2B order item ${itemId}:`, error);
      throw error;
    }
  }
}