import { Injectable } from '@nestjs/common';
import { eq, and, like, ilike, desc, asc, sql, gte, lte, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderApprovals,
  purchaseOrderReceipts,
  purchaseOrderReceiptItems,
  purchaseOrderInvoices,
  purchaseOrderInvoiceItems,
} from '../../database/schema/purchase-order.schema';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  CreateApprovalDto,
  ApprovalResponseDto,
  CreateReceiptDto,
  CreateInvoiceDto,
} from '../dto/purchase-order.dto';

export interface PurchaseOrderWithRelations {
  purchaseOrder: typeof purchaseOrders.$inferSelect;
  items?: (typeof purchaseOrderItems.$inferSelect)[];
  approvals?: (typeof purchaseOrderApprovals.$inferSelect)[];
  receipts?: (typeof purchaseOrderReceipts.$inferSelect)[];
  invoices?: (typeof purchaseOrderInvoices.$inferSelect)[];
}

@Injectable()
export class PurchaseOrderRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.getDb();
  }

  async generatePoNumber(tenantId: string): Promise<string> {
    // Get the current year and month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PO${year}${month}`;

    // Get the last PO number for this month
    const [lastPo] = await this.db
      .select({ poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          like(purchaseOrders.poNumber, `${prefix}%`),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .orderBy(desc(purchaseOrders.poNumber))
      .limit(1);

    let sequence = 1;
    if (lastPo) {
      const lastSequence = parseInt(lastPo.poNumber.substring(prefix.length));
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  async create(
    tenantId: string,
    data: CreatePurchaseOrderDto,
    userId: string,
  ): Promise<PurchaseOrderWithRelations> {
    return await this.db.transaction(async (tx) => {
      // Generate PO number
      const poNumber = await this.generatePoNumber(tenantId);

      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + (item.quantityOrdered * item.unitPrice), 0);
      const taxAmount = data.taxAmount || 0;
      const shippingAmount = data.shippingAmount || 0;
      const discountAmount = data.discountAmount || 0;
      const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

      // Create purchase order
      const purchaseOrderResult = await tx
        .insert(purchaseOrders)
        .values({
          tenantId,
          poNumber,
          supplierId: data.supplierId,
          priority: data.priority || 'normal',
          requestedDeliveryDate: data.requestedDeliveryDate ? new Date(data.requestedDeliveryDate) : null,
          expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          shippingAmount: shippingAmount.toString(),
          discountAmount: discountAmount.toString(),
          totalAmount: totalAmount.toString(),
          currency: data.currency || 'USD',
          deliveryAddress: data.deliveryAddress || {},
          billingAddress: data.billingAddress || {},
          shippingMethod: data.shippingMethod,
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          description: data.description,
          internalNotes: data.internalNotes,
          supplierNotes: data.supplierNotes,
          customFields: data.customFields || {},
          tags: data.tags || [],
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!purchaseOrderResult[0]) {
        throw new Error('Failed to create purchase order');
      }

      const purchaseOrder = purchaseOrderResult[0];

      // Create purchase order items
      const items = await Promise.all(
        data.items.map(async (item) => {
          const totalPrice = item.quantityOrdered * item.unitPrice;
          const [poItem] = await tx
            .insert(purchaseOrderItems)
            .values({
              tenantId,
              purchaseOrderId: purchaseOrder.id,
              productId: item.productId,
              itemDescription: item.itemDescription,
              sku: item.sku,
              quantityOrdered: item.quantityOrdered.toString(),
              unitPrice: item.unitPrice.toString(),
              totalPrice: totalPrice.toString(),
              specifications: item.specifications || {},
              requestedDeliveryDate: item.requestedDeliveryDate ? new Date(item.requestedDeliveryDate) : null,
              notes: item.notes,
              customFields: item.customFields || {},
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();
          
          if (!poItem) {
            throw new Error('Failed to create purchase order item');
          }
          
          return poItem;
        }),
      );

      return {
        purchaseOrder,
        items,
        approvals: [],
        receipts: [],
        invoices: [],
      };
    });
  }

  async findById(
    tenantId: string,
    id: string,
    includeRelations = false,
  ): Promise<PurchaseOrderWithRelations | null> {
    const [purchaseOrder] = await this.db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          eq(purchaseOrders.id, id),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .limit(1);

    if (!purchaseOrder) {
      return null;
    }

    const result: PurchaseOrderWithRelations = {
      purchaseOrder,
    };

    if (includeRelations) {
      // Load items
      result.items = await this.db
        .select()
        .from(purchaseOrderItems)
        .where(
          and(
            eq(purchaseOrderItems.tenantId, tenantId),
            eq(purchaseOrderItems.purchaseOrderId, id),
            isNull(purchaseOrderItems.deletedAt),
          ),
        )
        .orderBy(asc(purchaseOrderItems.createdAt));

      // Load approvals
      result.approvals = await this.db
        .select()
        .from(purchaseOrderApprovals)
        .where(
          and(
            eq(purchaseOrderApprovals.tenantId, tenantId),
            eq(purchaseOrderApprovals.purchaseOrderId, id),
            isNull(purchaseOrderApprovals.deletedAt),
          ),
        )
        .orderBy(asc(purchaseOrderApprovals.approvalLevel));

      // Load receipts
      result.receipts = await this.db
        .select()
        .from(purchaseOrderReceipts)
        .where(
          and(
            eq(purchaseOrderReceipts.tenantId, tenantId),
            eq(purchaseOrderReceipts.purchaseOrderId, id),
            isNull(purchaseOrderReceipts.deletedAt),
          ),
        )
        .orderBy(desc(purchaseOrderReceipts.receiptDate));

      // Load invoices
      result.invoices = await this.db
        .select()
        .from(purchaseOrderInvoices)
        .where(
          and(
            eq(purchaseOrderInvoices.tenantId, tenantId),
            eq(purchaseOrderInvoices.purchaseOrderId, id),
            isNull(purchaseOrderInvoices.deletedAt),
          ),
        )
        .orderBy(desc(purchaseOrderInvoices.invoiceDate));
    }

    return result;
  }

  async findByPoNumber(
    tenantId: string,
    poNumber: string,
  ): Promise<typeof purchaseOrders.$inferSelect | null> {
    const [purchaseOrder] = await this.db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          eq(purchaseOrders.poNumber, poNumber),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .limit(1);

    return purchaseOrder || null;
  }

  async findMany(
    tenantId: string,
    query: PurchaseOrderQueryDto,
  ): Promise<{
    purchaseOrders: (typeof purchaseOrders.$inferSelect)[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      search,
      status,
      supplierId,
      priority,
      orderDateFrom,
      orderDateTo,
      deliveryDateFrom,
      deliveryDateTo,
      page = 1,
      limit = 20,
      sortBy = 'orderDate',
      sortOrder = 'desc',
    } = query;

    // Build where conditions
    const conditions = [eq(purchaseOrders.tenantId, tenantId), isNull(purchaseOrders.deletedAt)];

    if (search) {
      conditions.push(
        sql`(${ilike(purchaseOrders.poNumber, `%${search}%`)} OR ${ilike(purchaseOrders.description, `%${search}%`)})`,
      );
    }

    if (status) {
      conditions.push(eq(purchaseOrders.status, status));
    }

    if (supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, supplierId));
    }

    if (priority) {
      conditions.push(eq(purchaseOrders.priority, priority));
    }

    if (orderDateFrom) {
      conditions.push(gte(purchaseOrders.orderDate, new Date(orderDateFrom)));
    }

    if (orderDateTo) {
      conditions.push(lte(purchaseOrders.orderDate, new Date(orderDateTo)));
    }

    if (deliveryDateFrom) {
      conditions.push(gte(purchaseOrders.requestedDeliveryDate, new Date(deliveryDateFrom)));
    }

    if (deliveryDateTo) {
      conditions.push(lte(purchaseOrders.requestedDeliveryDate, new Date(deliveryDateTo)));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(whereClause);
    
    const count = countResult[0]?.count || 0;

    // Build order by clause
    const validSortColumns = ['poNumber', 'orderDate', 'status', 'priority', 'totalAmount', 'supplierId', 'requestedDeliveryDate'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'orderDate';
    
    let orderByClause;
    if (sortColumn === 'poNumber') {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.poNumber) : asc(purchaseOrders.poNumber);
    } else if (sortColumn === 'orderDate') {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.orderDate) : asc(purchaseOrders.orderDate);
    } else if (sortColumn === 'status') {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.status) : asc(purchaseOrders.status);
    } else if (sortColumn === 'priority') {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.priority) : asc(purchaseOrders.priority);
    } else if (sortColumn === 'totalAmount') {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.totalAmount) : asc(purchaseOrders.totalAmount);
    } else if (sortColumn === 'supplierId') {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.supplierId) : asc(purchaseOrders.supplierId);
    } else if (sortColumn === 'requestedDeliveryDate') {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.requestedDeliveryDate) : asc(purchaseOrders.requestedDeliveryDate);
    } else {
      orderByClause = sortOrder === 'desc' ? desc(purchaseOrders.orderDate) : asc(purchaseOrders.orderDate);
    }

    // Get paginated results
    const offset = (page - 1) * limit;
    const purchaseOrderList = await this.db
      .select()
      .from(purchaseOrders)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(count / limit);

    return {
      purchaseOrders: purchaseOrderList,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdatePurchaseOrderDto,
    userId: string,
  ): Promise<typeof purchaseOrders.$inferSelect | null> {
    const updateData: any = {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Convert date strings to Date objects
    if (data.requestedDeliveryDate) {
      updateData.requestedDeliveryDate = new Date(data.requestedDeliveryDate);
    }
    if (data.expectedDeliveryDate) {
      updateData.expectedDeliveryDate = new Date(data.expectedDeliveryDate);
    }
    if (data.actualDeliveryDate) {
      updateData.actualDeliveryDate = new Date(data.actualDeliveryDate);
    }

    const [purchaseOrder] = await this.db
      .update(purchaseOrders)
      .set(updateData)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          eq(purchaseOrders.id, id),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .returning();

    return purchaseOrder || null;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [purchaseOrder] = await this.db
      .update(purchaseOrders)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          eq(purchaseOrders.id, id),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .returning();

    return !!purchaseOrder;
  }

  // Approval methods
  async createApproval(
    tenantId: string,
    data: CreateApprovalDto,
    userId: string,
  ): Promise<typeof purchaseOrderApprovals.$inferSelect> {
    const [approval] = await this.db
      .insert(purchaseOrderApprovals)
      .values({
        tenantId,
        ...data,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (!approval) {
      throw new Error('Failed to create approval');
    }

    return approval;
  }

  async updateApproval(
    tenantId: string,
    approvalId: string,
    response: ApprovalResponseDto,
    userId: string,
  ): Promise<typeof purchaseOrderApprovals.$inferSelect | null> {
    const [approval] = await this.db
      .update(purchaseOrderApprovals)
      .set({
        status: response.status,
        comments: response.comments,
        respondedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(purchaseOrderApprovals.tenantId, tenantId),
          eq(purchaseOrderApprovals.id, approvalId),
          isNull(purchaseOrderApprovals.deletedAt),
        ),
      )
      .returning();

    return approval || null;
  }

  async getPendingApprovals(
    tenantId: string,
    approverId?: string,
  ): Promise<(typeof purchaseOrderApprovals.$inferSelect)[]> {
    const conditions = [
      eq(purchaseOrderApprovals.tenantId, tenantId),
      eq(purchaseOrderApprovals.status, 'pending'),
      isNull(purchaseOrderApprovals.deletedAt),
    ];

    if (approverId) {
      conditions.push(eq(purchaseOrderApprovals.approverId, approverId));
    }

    return await this.db
      .select()
      .from(purchaseOrderApprovals)
      .where(and(...conditions))
      .orderBy(asc(purchaseOrderApprovals.requestedAt));
  }

  // Receipt methods
  async createReceipt(
    tenantId: string,
    data: CreateReceiptDto,
    userId: string,
  ): Promise<{
    receipt: typeof purchaseOrderReceipts.$inferSelect;
    items: (typeof purchaseOrderReceiptItems.$inferSelect)[];
  }> {
    return await this.db.transaction(async (tx) => {
      // Generate receipt number
      const receiptNumber = await this.generateReceiptNumber(tenantId);

      // Create receipt
      const [receipt] = await tx
        .insert(purchaseOrderReceipts)
        .values({
          tenantId,
          purchaseOrderId: data.purchaseOrderId,
          receiptNumber,
          receiptDate: data.receiptDate ? new Date(data.receiptDate) : new Date(),
          receivedBy: userId,
          deliveryNote: data.deliveryNote,
          carrierName: data.carrierName,
          trackingNumber: data.trackingNumber,
          qualityCheck: data.qualityCheck || false,
          qualityNotes: data.qualityNotes,
          notes: data.notes,
          attachments: data.attachments || [],
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!receipt) {
        throw new Error('Failed to create receipt');
      }

      // Create receipt items
      const items = await Promise.all(
        data.items.map(async (item) => {
          const [receiptItem] = await tx
            .insert(purchaseOrderReceiptItems)
            .values({
              tenantId,
              receiptId: receipt.id,
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantityReceived: item.quantityReceived.toString(),
              quantityAccepted: item.quantityAccepted.toString(),
              quantityRejected: (item.quantityRejected || 0).toString(),
              conditionNotes: item.conditionNotes,
              rejectionReason: item.rejectionReason,
              locationId: item.locationId,
              binLocation: item.binLocation,
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();

          if (!receiptItem) {
            throw new Error('Failed to create receipt item');
          }

          // Update purchase order item quantities
          await tx
            .update(purchaseOrderItems)
            .set({
              quantityReceived: sql`${purchaseOrderItems.quantityReceived} + ${item.quantityReceived}`,
              receiptStatus: item.quantityReceived >= parseFloat(
                (await tx
                  .select({ quantityOrdered: purchaseOrderItems.quantityOrdered })
                  .from(purchaseOrderItems)
                  .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId))
                  .limit(1))[0]?.quantityOrdered || '0'
              ) ? 'complete' : 'partial',
              updatedBy: userId,
              updatedAt: new Date(),
            })
            .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));

          return receiptItem;
        }),
      );

      return { receipt, items };
    });
  }

  private async generateReceiptNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `REC${year}${month}`;

    const [lastReceipt] = await this.db
      .select({ receiptNumber: purchaseOrderReceipts.receiptNumber })
      .from(purchaseOrderReceipts)
      .where(
        and(
          eq(purchaseOrderReceipts.tenantId, tenantId),
          like(purchaseOrderReceipts.receiptNumber, `${prefix}%`),
          isNull(purchaseOrderReceipts.deletedAt),
        ),
      )
      .orderBy(desc(purchaseOrderReceipts.receiptNumber))
      .limit(1);

    let sequence = 1;
    if (lastReceipt) {
      const lastSequence = parseInt(lastReceipt.receiptNumber.substring(prefix.length));
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  // Invoice methods
  async createInvoice(
    tenantId: string,
    data: CreateInvoiceDto,
    userId: string,
  ): Promise<{
    invoice: typeof purchaseOrderInvoices.$inferSelect;
    items: (typeof purchaseOrderInvoiceItems.$inferSelect)[];
  }> {
    return await this.db.transaction(async (tx) => {
      // Create invoice
      const [invoice] = await tx
        .insert(purchaseOrderInvoices)
        .values({
          tenantId,
          purchaseOrderId: data.purchaseOrderId,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: new Date(data.invoiceDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          invoiceAmount: data.invoiceAmount.toString(),
          taxAmount: (data.taxAmount || 0).toString(),
          discountAmount: (data.discountAmount || 0).toString(),
          description: data.description,
          notes: data.notes,
          attachments: data.attachments || [],
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!invoice) {
        throw new Error('Failed to create invoice');
      }

      // Create invoice items
      const items = await Promise.all(
        data.items.map(async (item) => {
          const totalAmount = item.quantity * item.unitPrice;
          const [invoiceItem] = await tx
            .insert(purchaseOrderInvoiceItems)
            .values({
              tenantId,
              invoiceId: invoice.id,
              purchaseOrderItemId: item.purchaseOrderItemId,
              description: item.description,
              sku: item.sku,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toString(),
              totalAmount: totalAmount.toString(),
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();

          if (!invoiceItem) {
            throw new Error('Failed to create invoice item');
          }

          return invoiceItem;
        }),
      );

      return { invoice, items };
    });
  }

  // Statistics and reporting
  async getPurchaseOrderStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalOrders: number;
    totalValue: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    averageOrderValue: number;
    pendingApprovals: number;
  }> {
    const conditions = [eq(purchaseOrders.tenantId, tenantId), isNull(purchaseOrders.deletedAt)];

    if (startDate) {
      conditions.push(gte(purchaseOrders.orderDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(purchaseOrders.orderDate, endDate));
    }

    const stats = await this.db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalValue: sql<number>`sum(total_amount::numeric)`,
        draftCount: sql<number>`count(*) filter (where status = 'draft')`,
        pendingApprovalCount: sql<number>`count(*) filter (where status = 'pending_approval')`,
        approvedCount: sql<number>`count(*) filter (where status = 'approved')`,
        sentCount: sql<number>`count(*) filter (where status = 'sent_to_supplier')`,
        acknowledgedCount: sql<number>`count(*) filter (where status = 'acknowledged')`,
        partiallyReceivedCount: sql<number>`count(*) filter (where status = 'partially_received')`,
        fullyReceivedCount: sql<number>`count(*) filter (where status = 'fully_received')`,
        cancelledCount: sql<number>`count(*) filter (where status = 'cancelled')`,
        closedCount: sql<number>`count(*) filter (where status = 'closed')`,
        lowPriorityCount: sql<number>`count(*) filter (where priority = 'low')`,
        normalPriorityCount: sql<number>`count(*) filter (where priority = 'normal')`,
        highPriorityCount: sql<number>`count(*) filter (where priority = 'high')`,
        urgentPriorityCount: sql<number>`count(*) filter (where priority = 'urgent')`,
        averageValue: sql<number>`avg(total_amount::numeric)`,
      })
      .from(purchaseOrders)
      .where(and(...conditions));

    const result = stats[0];

    if (!result) {
      return {
        totalOrders: 0,
        totalValue: 0,
        byStatus: {
          draft: 0,
          pending_approval: 0,
          approved: 0,
          sent_to_supplier: 0,
          acknowledged: 0,
          partially_received: 0,
          fully_received: 0,
          cancelled: 0,
          closed: 0,
        },
        byPriority: {
          low: 0,
          normal: 0,
          high: 0,
          urgent: 0,
        },
        averageOrderValue: 0,
        pendingApprovals: 0,
      };
    }

    return {
      totalOrders: result.totalOrders || 0,
      totalValue: result.totalValue || 0,
      byStatus: {
        draft: result.draftCount || 0,
        pending_approval: result.pendingApprovalCount || 0,
        approved: result.approvedCount || 0,
        sent_to_supplier: result.sentCount || 0,
        acknowledged: result.acknowledgedCount || 0,
        partially_received: result.partiallyReceivedCount || 0,
        fully_received: result.fullyReceivedCount || 0,
        cancelled: result.cancelledCount || 0,
        closed: result.closedCount || 0,
      },
      byPriority: {
        low: result.lowPriorityCount || 0,
        normal: result.normalPriorityCount || 0,
        high: result.highPriorityCount || 0,
        urgent: result.urgentPriorityCount || 0,
      },
      averageOrderValue: result.averageValue || 0,
      pendingApprovals: result.pendingApprovalCount || 0,
    };
  }

  async getSupplierPurchaseStats(
    tenantId: string,
    supplierId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalOrders: number;
    totalSpend: number;
    averageOrderValue: number;
    onTimeDeliveryRate: number;
  }> {
    const conditions = [
      eq(purchaseOrders.tenantId, tenantId),
      eq(purchaseOrders.supplierId, supplierId),
      isNull(purchaseOrders.deletedAt),
    ];

    if (startDate) {
      conditions.push(gte(purchaseOrders.orderDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(purchaseOrders.orderDate, endDate));
    }

    const stats = await this.db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalValue: sql<number>`sum(total_amount::numeric)`,
        averageValue: sql<number>`avg(total_amount::numeric)`,
        onTimeDeliveries: sql<number>`count(*) filter (where actual_delivery_date <= requested_delivery_date)`,
        completedDeliveries: sql<number>`count(*) filter (where actual_delivery_date is not null)`,
      })
      .from(purchaseOrders)
      .where(and(...conditions));

    const result = stats[0];
    
    if (!result) {
      return {
        totalOrders: 0,
        totalSpend: 0,
        averageOrderValue: 0,
        onTimeDeliveryRate: 0,
      };
    }
    
    const onTimeDeliveryRate = (result.completedDeliveries || 0) > 0 
      ? ((result.onTimeDeliveries || 0) / (result.completedDeliveries || 1)) * 100 
      : 0;

    return {
      totalOrders: result.totalOrders || 0,
      totalSpend: result.totalValue || 0,
      averageOrderValue: result.averageValue || 0,
      onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 100) / 100,
    };
  }

  // Analytics methods for procurement analytics service
  async getSpendBySupplier(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    supplierId: string;
    supplierName: string;
    totalSpend: number;
    orderCount: number;
  }>> {
    const result = await this.db
      .select({
        supplierId: purchaseOrders.supplierId,
        supplierName: sql<string>`s.name`,
        totalSpend: sql<number>`sum(${purchaseOrders.totalAmount}::numeric)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(purchaseOrders)
      .leftJoin(sql`suppliers s`, sql`s.id = ${purchaseOrders.supplierId}`)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          gte(purchaseOrders.orderDate, startDate),
          lte(purchaseOrders.orderDate, endDate),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .groupBy(purchaseOrders.supplierId, sql`s.name`)
      .orderBy(desc(sql`sum(${purchaseOrders.totalAmount}::numeric)`));

    return result.map(row => ({
      supplierId: row.supplierId,
      supplierName: row.supplierName || 'Unknown Supplier',
      totalSpend: row.totalSpend || 0,
      orderCount: row.orderCount || 0,
    }));
  }

  async getSpendByCategory(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    category: string;
    totalSpend: number;
    orderCount: number;
  }>> {
    const result = await this.db
      .select({
        category: sql<string>`s.supplier_type`,
        totalSpend: sql<number>`sum(${purchaseOrders.totalAmount}::numeric)`,
        orderCount: sql<number>`count(*)`,
      })
      .from(purchaseOrders)
      .leftJoin(sql`suppliers s`, sql`s.id = ${purchaseOrders.supplierId}`)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          gte(purchaseOrders.orderDate, startDate),
          lte(purchaseOrders.orderDate, endDate),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .groupBy(sql`s.supplier_type`)
      .orderBy(desc(sql`sum(${purchaseOrders.totalAmount}::numeric)`));

    return result.map(row => ({
      category: row.category || 'Uncategorized',
      totalSpend: row.totalSpend || 0,
      orderCount: row.orderCount || 0,
    }));
  }

  async getMonthlySpendTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{
    month: string;
    totalSpend: number;
    orderCount: number;
    averageOrderValue: number;
  }>> {
    const result = await this.db
      .select({
        month: sql<string>`to_char(${purchaseOrders.orderDate}, 'YYYY-MM')`,
        totalSpend: sql<number>`sum(${purchaseOrders.totalAmount}::numeric)`,
        orderCount: sql<number>`count(*)`,
        averageOrderValue: sql<number>`avg(${purchaseOrders.totalAmount}::numeric)`,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.tenantId, tenantId),
          gte(purchaseOrders.orderDate, startDate),
          lte(purchaseOrders.orderDate, endDate),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .groupBy(sql`to_char(${purchaseOrders.orderDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${purchaseOrders.orderDate}, 'YYYY-MM')`);

    return result.map(row => ({
      month: row.month,
      totalSpend: row.totalSpend || 0,
      orderCount: row.orderCount || 0,
      averageOrderValue: row.averageOrderValue || 0,
    }));
  }
}
