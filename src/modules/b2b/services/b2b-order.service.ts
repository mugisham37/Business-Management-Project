import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  b2bOrders, 
  b2bOrderItems,
  quotes,
  customers,
  products
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, asc, sql, isNull, ilike, not, inArray } from 'drizzle-orm';
import { CreateB2BOrderDto, UpdateB2BOrderDto, B2BOrderQueryDto, B2BOrderItemDto } from '../dto/b2b-order.dto';
import { B2BPricingService } from './b2b-pricing.service';
import { B2BWorkflowService } from './b2b-workflow.service';

export interface B2BOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId: string;
  quoteId?: string;
  status: string;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  confirmedDeliveryDate?: Date;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentTerms: string;
  paymentDueDate?: Date;
  shippingMethod?: string;
  trackingNumber?: string;
  shippingAddress: any;
  billingAddress: any;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  salesRepId?: string;
  accountManagerId?: string;
  specialInstructions?: string;
  internalNotes?: string;
  items: B2BOrderItem[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface B2BOrderItem {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  discountPercentage: number;
  discountAmount: number;
  lineTotal: number;
  quantityShipped: number;
  quantityBackordered: number;
  metadata: Record<string, any>;
}

@Injectable()
export class B2BOrderService {
  private readonly logger = new Logger(B2BOrderService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly pricingService: B2BPricingService,
    private readonly workflowService: B2BWorkflowService,
  ) {}

  async createB2BOrder(tenantId: string, data: CreateB2BOrderDto, userId: string): Promise<B2BOrder> {
    try {
      // Validate order data
      await this.validateOrderData(tenantId, data);

      // Generate order number
      const orderNumber = await this.generateOrderNumber(tenantId);

      // Calculate pricing for all items
      const pricedItems = await this.calculateItemPricing(tenantId, data.customerId, data.items);

      // Calculate totals
      const subtotal = pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const taxAmount = await this.calculateTax(tenantId, data.customerId, subtotal, data.shippingAddress);
      const shippingAmount = await this.calculateShipping(tenantId, data.customerId, pricedItems, data.shippingAddress);
      const discountAmount = data.discountAmount || 0;
      const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

      // Check if order requires approval
      const requiresApproval = await this.checkApprovalRequired(tenantId, data.customerId, totalAmount);

      // Create order record
      const [orderRecord] = await this.drizzle.getDb()
        .insert(b2bOrders)
        .values({
          tenantId,
          orderNumber,
          customerId: data.customerId,
          quoteId: data.quoteId,
          status: requiresApproval ? 'pending_approval' : 'approved',
          orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
          requestedDeliveryDate: data.requestedDeliveryDate ? new Date(data.requestedDeliveryDate) : null,
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          shippingAmount: shippingAmount.toString(),
          discountAmount: discountAmount.toString(),
          totalAmount: totalAmount.toString(),
          paymentTerms: data.paymentTerms,
          paymentDueDate: this.calculatePaymentDueDate(data.paymentTerms, new Date()),
          shippingMethod: data.shippingMethod,
          shippingAddress: data.shippingAddress,
          billingAddress: data.billingAddress,
          requiresApproval,
          salesRepId: data.salesRepId,
          accountManagerId: data.accountManagerId,
          specialInstructions: data.specialInstructions,
          internalNotes: data.internalNotes,
          metadata: data.metadata || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Create order items
      const orderItemsData = pricedItems.map(item => ({
        tenantId,
        orderId: orderRecord.id,
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        listPrice: item.listPrice.toString(),
        discountPercentage: item.discountPercentage.toString(),
        discountAmount: item.discountAmount.toString(),
        lineTotal: item.lineTotal.toString(),
        quantityShipped: '0',
        quantityBackordered: '0',
        metadata: item.metadata || {},
        createdBy: userId,
        updatedBy: userId,
      }));

      const orderItems = await this.drizzle.getDb()
        .insert(b2bOrderItems)
        .values(orderItemsData)
        .returning();

      // Start approval workflow if required
      if (requiresApproval) {
        await this.workflowService.startApprovalWorkflow(tenantId, orderRecord.id, 'b2b_order', userId);
      }

      // Clear caches
      await this.invalidateOrderCaches(tenantId);

      // Emit event
      this.eventEmitter.emit('b2b-order.created', {
        tenantId,
        orderId: orderRecord.id,
        customerId: data.customerId,
        totalAmount,
        requiresApproval,
        userId,
      });

      this.logger.log(`Created B2B order ${orderRecord.orderNumber} for tenant ${tenantId}`);
      return this.mapToB2BOrder(orderRecord, orderItems);
    } catch (error) {
      this.logger.error(`Failed to create B2B order for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findB2BOrderById(tenantId: string, orderId: string): Promise<B2BOrder> {
    try {
      const cacheKey = `b2b-order:${tenantId}:${orderId}`;
      
      // Try cache first
      let order = await this.cacheService.get<B2BOrder>(cacheKey);
      
      if (!order) {
        // Get order with items
        const [orderRecord] = await this.drizzle.getDb()
          .select()
          .from(b2bOrders)
          .where(and(
            eq(b2bOrders.tenantId, tenantId),
            eq(b2bOrders.id, orderId),
            isNull(b2bOrders.deletedAt)
          ));

        if (!orderRecord) {
          throw new NotFoundException(`B2B order ${orderId} not found`);
        }

        const orderItems = await this.drizzle.getDb()
          .select()
          .from(b2bOrderItems)
          .where(and(
            eq(b2bOrderItems.tenantId, tenantId),
            eq(b2bOrderItems.orderId, orderId),
            isNull(b2bOrderItems.deletedAt)
          ));

        order = this.mapToB2BOrder(orderRecord, orderItems);

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, order, { ttl: 600 });
      }

      return order;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find B2B order ${orderId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findB2BOrders(tenantId: string, query: B2BOrderQueryDto): Promise<{ orders: B2BOrder[]; total: number }> {
    try {
      const cacheKey = `b2b-orders:${tenantId}:${JSON.stringify(query)}`;
      
      // Try cache first for common queries
      let result = await this.cacheService.get<{ orders: B2BOrder[]; total: number }>(cacheKey);
      
      if (!result) {
        const conditions = [
          eq(b2bOrders.tenantId, tenantId),
          isNull(b2bOrders.deletedAt)
        ];

        // Add search conditions
        if (query.search) {
          conditions.push(
            or(
              ilike(b2bOrders.orderNumber, `%${query.search}%`),
              ilike(customers.companyName, `%${query.search}%`)
            )!
          );
        }

        // Add filter conditions
        if (query.status) {
          if (Array.isArray(query.status)) {
            conditions.push(inArray(b2bOrders.status, query.status));
          } else {
            conditions.push(eq(b2bOrders.status, query.status));
          }
        }

        if (query.customerId) {
          conditions.push(eq(b2bOrders.customerId, query.customerId));
        }

        if (query.salesRepId) {
          conditions.push(eq(b2bOrders.salesRepId, query.salesRepId));
        }

        if (query.accountManagerId) {
          conditions.push(eq(b2bOrders.accountManagerId, query.accountManagerId));
        }

        if (query.startDate) {
          conditions.push(gte(b2bOrders.orderDate, new Date(query.startDate)));
        }

        if (query.endDate) {
          conditions.push(lte(b2bOrders.orderDate, new Date(query.endDate)));
        }

        if (query.minAmount !== undefined) {
          conditions.push(gte(b2bOrders.totalAmount, query.minAmount.toString()));
        }

        if (query.maxAmount !== undefined) {
          conditions.push(lte(b2bOrders.totalAmount, query.maxAmount.toString()));
        }

        if (query.requiresApproval !== undefined) {
          conditions.push(eq(b2bOrders.requiresApproval, query.requiresApproval));
        }

        const whereClause = and(...conditions);

        // Get total count
        const [countResult] = await this.drizzle.getDb()
          .select({ count: sql<number>`count(*)` })
          .from(b2bOrders)
          .leftJoin(customers, eq(b2bOrders.customerId, customers.id))
          .where(whereClause);

        const total = countResult?.count || 0;

        // Get paginated results
        const offset = ((query.page || 1) - 1) * (query.limit || 20);
        const orderBy = query.sortOrder === 'asc' 
          ? asc(b2bOrders[query.sortBy as keyof typeof b2bOrders] || b2bOrders.orderDate)
          : desc(b2bOrders[query.sortBy as keyof typeof b2bOrders] || b2bOrders.orderDate);

        const orders = await this.drizzle.getDb()
          .select()
          .from(b2bOrders)
          .leftJoin(customers, eq(b2bOrders.customerId, customers.id))
          .where(whereClause)
          .orderBy(orderBy)
          .limit(query.limit || 20)
          .offset(offset);

        // Get order items for each order
        const orderIds = orders.map(row => row.b2b_orders.id);
        const allOrderItems = orderIds.length > 0 ? await this.drizzle.getDb()
          .select()
          .from(b2bOrderItems)
          .where(and(
            eq(b2bOrderItems.tenantId, tenantId),
            inArray(b2bOrderItems.orderId, orderIds),
            isNull(b2bOrderItems.deletedAt)
          )) : [];

        const ordersList = orders.map(row => {
          const orderItems = allOrderItems.filter(item => item.orderId === row.b2b_orders.id);
          return this.mapToB2BOrder(row.b2b_orders, orderItems);
        });

        result = {
          orders: ordersList,
          total: total,
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, { ttl: 300 });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to find B2B orders for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateB2BOrder(tenantId: string, orderId: string, data: UpdateB2BOrderDto, userId: string): Promise<B2BOrder> {
    try {
      // Check if order exists and can be updated
      const existingOrder = await this.findB2BOrderById(tenantId, orderId);
      
      if (!this.canUpdateOrder(existingOrder.status)) {
        throw new BadRequestException(`Cannot update order in ${existingOrder.status} status`);
      }

      // Update order record
      const updateData: any = { ...data, updatedBy: userId };
      
      // Convert date fields
      if (data.requestedDeliveryDate) {
        updateData.requestedDeliveryDate = new Date(data.requestedDeliveryDate);
      }
      if (data.confirmedDeliveryDate) {
        updateData.confirmedDeliveryDate = new Date(data.confirmedDeliveryDate);
      }

      // Convert decimal fields to strings
      if (data.discountAmount !== undefined) {
        updateData.discountAmount = data.discountAmount.toString();
      }

      const [updatedOrder] = await this.drizzle.getDb()
        .update(b2bOrders)
        .set(updateData)
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.id, orderId),
          isNull(b2bOrders.deletedAt)
        ))
        .returning();

      if (!updatedOrder) {
        throw new Error(`B2B order ${orderId} not found for update`);
      }

      // Clear caches
      await this.invalidateOrderCaches(tenantId, orderId);

      // Emit event
      this.eventEmitter.emit('b2b-order.updated', {
        tenantId,
        orderId,
        previousStatus: existingOrder.status,
        newStatus: updatedOrder.status,
        userId,
      });

      // Get updated order with items
      return this.findB2BOrderById(tenantId, orderId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update B2B order ${orderId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async approveOrder(tenantId: string, orderId: string, approvalNotes: string, userId: string): Promise<B2BOrder> {
    try {
      const existingOrder = await this.findB2BOrderById(tenantId, orderId);
      
      if (existingOrder.status !== 'pending_approval') {
        throw new BadRequestException('Order is not pending approval');
      }

      const [updatedOrder] = await this.drizzle.getDb()
        .update(b2bOrders)
        .set({
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          approvalNotes,
          updatedBy: userId,
        })
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.id, orderId)
        ))
        .returning();

      // Clear caches
      await this.invalidateOrderCaches(tenantId, orderId);

      // Emit event
      this.eventEmitter.emit('b2b-order.approved', {
        tenantId,
        orderId,
        customerId: existingOrder.customerId,
        totalAmount: existingOrder.totalAmount,
        approvedBy: userId,
      });

      return this.findB2BOrderById(tenantId, orderId);
    } catch (error) {
      this.logger.error(`Failed to approve B2B order ${orderId}:`, error);
      throw error;
    }
  }

  async rejectOrder(tenantId: string, orderId: string, rejectionReason: string, userId: string): Promise<B2BOrder> {
    try {
      const existingOrder = await this.findB2BOrderById(tenantId, orderId);
      
      if (existingOrder.status !== 'pending_approval') {
        throw new BadRequestException('Order is not pending approval');
      }

      const [updatedOrder] = await this.drizzle.getDb()
        .update(b2bOrders)
        .set({
          status: 'cancelled',
          approvalNotes: rejectionReason,
          updatedBy: userId,
        })
        .where(and(
          eq(b2bOrders.tenantId, tenantId),
          eq(b2bOrders.id, orderId)
        ))
        .returning();

      // Clear caches
      await this.invalidateOrderCaches(tenantId, orderId);

      // Emit event
      this.eventEmitter.emit('b2b-order.rejected', {
        tenantId,
        orderId,
        customerId: existingOrder.customerId,
        rejectionReason,
        rejectedBy: userId,
      });

      return this.findB2BOrderById(tenantId, orderId);
    } catch (error) {
      this.logger.error(`Failed to reject B2B order ${orderId}:`, error);
      throw error;
    }
  }

  private async validateOrderData(tenantId: string, data: CreateB2BOrderDto): Promise<void> {
    // Validate customer exists
    const [customer] = await this.drizzle.getDb()
      .select()
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        eq(customers.id, data.customerId),
        isNull(customers.deletedAt)
      ));

    if (!customer) {
      throw new NotFoundException(`Customer ${data.customerId} not found`);
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    // Validate product IDs
    const productIds = data.items.map(item => item.productId);
    const existingProducts = await this.drizzle.getDb()
      .select({ id: products.id })
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        inArray(products.id, productIds),
        isNull(products.deletedAt)
      ));

    const existingProductIds = existingProducts.map(p => p.id);
    const missingProducts = productIds.filter(id => !existingProductIds.includes(id));
    
    if (missingProducts.length > 0) {
      throw new BadRequestException(`Products not found: ${missingProducts.join(', ')}`);
    }

    // Validate quantities
    for (const item of data.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException(`Invalid quantity for product ${item.productId}`);
      }
    }
  }

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    
    // Get the latest order number for this year
    const [latestOrder] = await this.drizzle.getDb()
      .select({ orderNumber: b2bOrders.orderNumber })
      .from(b2bOrders)
      .where(and(
        eq(b2bOrders.tenantId, tenantId),
        ilike(b2bOrders.orderNumber, `${prefix}%`)
      ))
      .orderBy(desc(b2bOrders.orderNumber))
      .limit(1);

    let nextNumber = 1;
    if (latestOrder) {
      const currentNumber = parseInt(latestOrder.orderNumber.split('-').pop() || '0');
      nextNumber = currentNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  private async calculateItemPricing(tenantId: string, customerId: string, items: B2BOrderItemDto[]): Promise<any[]> {
    const pricedItems = [];

    for (const item of items) {
      // Get product details
      const [product] = await this.drizzle.getDb()
        .select()
        .from(products)
        .where(and(
          eq(products.tenantId, tenantId),
          eq(products.id, item.productId)
        ));

      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }

      // Get customer-specific pricing
      const customerPrice = await this.pricingService.getCustomerPrice(
        tenantId,
        customerId,
        item.productId,
        item.quantity
      );

      const unitPrice = customerPrice || parseFloat(product.basePrice);
      const listPrice = parseFloat(product.basePrice);
      const discountPercentage = customerPrice ? ((listPrice - unitPrice) / listPrice) * 100 : 0;
      const discountAmount = (listPrice - unitPrice) * item.quantity;
      const lineTotal = unitPrice * item.quantity;

      pricedItems.push({
        productId: item.productId,
        sku: product.sku,
        productName: product.name,
        description: item.description || product.description,
        quantity: item.quantity,
        unitPrice,
        listPrice,
        discountPercentage,
        discountAmount,
        lineTotal,
        metadata: item.metadata || {},
      });
    }

    return pricedItems;
  }

  private async calculateTax(tenantId: string, customerId: string, subtotal: number, shippingAddress: any): Promise<number> {
    // Placeholder tax calculation - would integrate with tax service
    const taxRate = 0.08; // 8% default tax rate
    return subtotal * taxRate;
  }

  private async calculateShipping(tenantId: string, customerId: string, items: any[], shippingAddress: any): Promise<number> {
    // Placeholder shipping calculation - would integrate with shipping service
    const totalWeight = items.reduce((sum, item) => sum + (item.quantity * 1), 0); // Assume 1 lb per item
    return Math.max(10, totalWeight * 0.5); // $10 minimum, $0.50 per lb
  }

  private async checkApprovalRequired(tenantId: string, customerId: string, totalAmount: number): Promise<boolean> {
    // Check if order amount exceeds approval threshold
    const approvalThreshold = 10000; // $10,000 default threshold
    return totalAmount >= approvalThreshold;
  }

  private calculatePaymentDueDate(paymentTerms: string, orderDate: Date): Date {
    const dueDate = new Date(orderDate);
    
    switch (paymentTerms) {
      case 'net_15':
        dueDate.setDate(dueDate.getDate() + 15);
        break;
      case 'net_30':
        dueDate.setDate(dueDate.getDate() + 30);
        break;
      case 'net_45':
        dueDate.setDate(dueDate.getDate() + 45);
        break;
      case 'net_60':
        dueDate.setDate(dueDate.getDate() + 60);
        break;
      case 'net_90':
        dueDate.setDate(dueDate.getDate() + 90);
        break;
      case 'cod':
        // Cash on delivery - due immediately
        break;
      default:
        dueDate.setDate(dueDate.getDate() + 30);
    }
    
    return dueDate;
  }

  private canUpdateOrder(status: string): boolean {
    const updatableStatuses = ['draft', 'pending_approval', 'approved'];
    return updatableStatuses.includes(status);
  }

  private mapToB2BOrder(orderRecord: any, orderItems: any[]): B2BOrder {
    return {
      id: orderRecord.id,
      tenantId: orderRecord.tenantId,
      orderNumber: orderRecord.orderNumber,
      customerId: orderRecord.customerId,
      quoteId: orderRecord.quoteId,
      status: orderRecord.status,
      orderDate: orderRecord.orderDate,
      requestedDeliveryDate: orderRecord.requestedDeliveryDate,
      confirmedDeliveryDate: orderRecord.confirmedDeliveryDate,
      subtotal: parseFloat(orderRecord.subtotal),
      taxAmount: parseFloat(orderRecord.taxAmount),
      shippingAmount: parseFloat(orderRecord.shippingAmount),
      discountAmount: parseFloat(orderRecord.discountAmount),
      totalAmount: parseFloat(orderRecord.totalAmount),
      paymentTerms: orderRecord.paymentTerms,
      paymentDueDate: orderRecord.paymentDueDate,
      shippingMethod: orderRecord.shippingMethod,
      trackingNumber: orderRecord.trackingNumber,
      shippingAddress: orderRecord.shippingAddress,
      billingAddress: orderRecord.billingAddress,
      requiresApproval: orderRecord.requiresApproval,
      approvedBy: orderRecord.approvedBy,
      approvedAt: orderRecord.approvedAt,
      approvalNotes: orderRecord.approvalNotes,
      salesRepId: orderRecord.salesRepId,
      accountManagerId: orderRecord.accountManagerId,
      specialInstructions: orderRecord.specialInstructions,
      internalNotes: orderRecord.internalNotes,
      items: orderItems.map(item => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        listPrice: parseFloat(item.listPrice),
        discountPercentage: parseFloat(item.discountPercentage),
        discountAmount: parseFloat(item.discountAmount),
        lineTotal: parseFloat(item.lineTotal),
        quantityShipped: parseFloat(item.quantityShipped),
        quantityBackordered: parseFloat(item.quantityBackordered),
        metadata: item.metadata || {},
      })),
      metadata: orderRecord.metadata || {},
      createdAt: orderRecord.createdAt,
      updatedAt: orderRecord.updatedAt,
    };
  }

  private async invalidateOrderCaches(tenantId: string, orderId?: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`b2b-orders:${tenantId}:*`);
      
      if (orderId) {
        await this.cacheService.invalidatePattern(`b2b-order:${tenantId}:${orderId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate B2B order caches for tenant ${tenantId}:`, error);
    }
  }
}