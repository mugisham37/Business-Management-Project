import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { SupplierRepository } from '../repositories/supplier.repository';
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrderFilterInput,
  CreateApprovalInput,
  ApprovalResponseInput,
  CreateReceiptInput,
  CreateInvoiceInput,
  PurchaseOrderStatus,
} from '../inputs/purchase-order.input';
import { purchaseOrders } from '../../database/schema/purchase-order.schema';

// Domain Events
export class PurchaseOrderCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly purchaseOrderId: string,
    public readonly supplierId: string,
    public readonly totalAmount: number,
    public readonly userId: string,
  ) {}
}

export class PurchaseOrderApprovedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly purchaseOrderId: string,
    public readonly approverId: string,
    public readonly approvalLevel: number,
  ) {}
}

export class PurchaseOrderSentEvent {
  constructor(
    public readonly tenantId: string,
    public readonly purchaseOrderId: string,
    public readonly supplierId: string,
    public readonly userId: string,
  ) {}
}

export class PurchaseOrderReceivedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly purchaseOrderId: string,
    public readonly receiptId: string,
    public readonly receivedBy: string,
  ) {}
}

export class PurchaseOrderInvoicedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly purchaseOrderId: string,
    public readonly invoiceId: string,
    public readonly invoiceAmount: number,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Purchase Order Management
  async createPurchaseOrder(
    tenantId: string,
    data: CreatePurchaseOrderInput,
    userId: string,
  ): Promise<typeof purchaseOrders.$inferSelect> {
    // Verify supplier exists and is active
    const supplier = await this.supplierRepository.findById(tenantId, data.supplierId);
    if (!supplier || supplier.supplier.status !== 'active') {
      throw new BadRequestException('Supplier not found or inactive');
    }

    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Purchase order must have at least one item');
    }

    // Validate quantities and prices
    for (const item of data.items) {
      if (item.quantityOrdered <= 0) {
        throw new BadRequestException('Item quantity must be greater than 0');
      }
      if (item.unitPrice < 0) {
        throw new BadRequestException('Item unit price cannot be negative');
      }
    }

    const result = await this.purchaseOrderRepository.create(tenantId, data, userId);
    const purchaseOrder = result.purchaseOrder;

    // Emit domain event
    this.eventEmitter.emit(
      'purchase-order.created',
      new PurchaseOrderCreatedEvent(
        tenantId,
        purchaseOrder.id,
        data.supplierId,
        parseFloat(purchaseOrder.totalAmount),
        userId,
      ),
    );

    return purchaseOrder;
  }

  async getPurchaseOrder(
    tenantId: string,
    id: string,
    includeRelations = false,
  ): Promise<typeof purchaseOrders.$inferSelect> {
    const result = await this.purchaseOrderRepository.findById(tenantId, id, includeRelations);
    if (!result) {
      throw new NotFoundException('Purchase order not found');
    }

    return result.purchaseOrder;
  }

  async getPurchaseOrderWithRelations(tenantId: string, id: string) {
    const result = await this.purchaseOrderRepository.findById(tenantId, id, true);
    if (!result) {
      throw new NotFoundException('Purchase order not found');
    }

    return result;
  }

  async getPurchaseOrders(tenantId: string, query: PurchaseOrderFilterInput) {
    return await this.purchaseOrderRepository.findMany(tenantId, query);
  }

  async updatePurchaseOrder(
    tenantId: string,
    id: string,
    data: UpdatePurchaseOrderInput,
    userId: string,
  ): Promise<typeof purchaseOrders.$inferSelect> {
    // Check if purchase order exists
    const existingPo = await this.getPurchaseOrder(tenantId, id);

    // Validate status transitions
    if (data.status) {
      this.validateStatusTransition(existingPo.status, data.status);
    }

    const purchaseOrder = await this.purchaseOrderRepository.update(tenantId, id, data, userId);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    // Emit events for status changes
    if (data.status && data.status !== existingPo.status) {
      this.handleStatusChange(tenantId, purchaseOrder, data.status, userId);
    }

    return purchaseOrder;
  }

  async deletePurchaseOrder(tenantId: string, id: string, userId: string): Promise<void> {
    const existingPo = await this.getPurchaseOrder(tenantId, id);

    // Only allow deletion of draft or cancelled orders
    if (![PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.CANCELLED].includes(existingPo.status as PurchaseOrderStatus)) {
      throw new BadRequestException('Can only delete draft or cancelled purchase orders');
    }

    const deleted = await this.purchaseOrderRepository.delete(tenantId, id, userId);
    if (!deleted) {
      throw new NotFoundException('Purchase order not found');
    }
  }

  async getPurchaseOrderByPoNumber(
    tenantId: string,
    poNumber: string,
  ): Promise<typeof purchaseOrders.$inferSelect> {
    const purchaseOrder = await this.purchaseOrderRepository.findByPoNumber(tenantId, poNumber);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    return purchaseOrder;
  }

  // Approval Workflow
  async submitForApproval(
    tenantId: string,
    purchaseOrderId: string,
    userId: string,
  ): Promise<typeof purchaseOrders.$inferSelect> {
    const purchaseOrder = await this.getPurchaseOrder(tenantId, purchaseOrderId);

    if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft purchase orders can be submitted for approval');
    }

    // Update status to pending approval
    const updatedPo = await this.purchaseOrderRepository.update(
      tenantId,
      purchaseOrderId,
      { status: PurchaseOrderStatus.PENDING_APPROVAL },
      userId,
    );

    if (!updatedPo) {
      throw new NotFoundException('Purchase order not found');
    }

    // Create approval requests based on business rules
    await this.createApprovalRequests(tenantId, updatedPo, userId);

    return updatedPo;
  }

  async createApproval(
    tenantId: string,
    data: CreateApprovalInput,
    userId: string,
  ) {
    // Verify purchase order exists and is pending approval
    const purchaseOrder = await this.getPurchaseOrder(tenantId, data.purchaseOrderId);
    if (purchaseOrder.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Purchase order is not pending approval');
    }

    return await this.purchaseOrderRepository.createApproval(tenantId, data, userId);
  }

  async respondToApproval(
    tenantId: string,
    approvalId: string,
    response: ApprovalResponseInput,
    userId: string,
  ) {
    const approval = await this.purchaseOrderRepository.updateApproval(
      tenantId,
      approvalId,
      response,
      userId,
    );

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    // Check if all approvals are complete
    if (response.status === 'approved') {
      await this.checkApprovalCompletion(tenantId, approval.purchaseOrderId, userId);
    } else if (response.status === 'rejected') {
      // Reject the entire purchase order
      await this.purchaseOrderRepository.update(
        tenantId,
        approval.purchaseOrderId,
        { status: PurchaseOrderStatus.CANCELLED },
        userId,
      );
    }

    return approval;
  }

  async getPendingApprovals(tenantId: string, approverId?: string) {
    return await this.purchaseOrderRepository.getPendingApprovals(tenantId, approverId);
  }

  // Receipt Management
  async createReceipt(
    tenantId: string,
    data: CreateReceiptInput,
    userId: string,
  ) {
    // Verify purchase order exists and is in appropriate status
    const purchaseOrder = await this.getPurchaseOrder(tenantId, data.purchaseOrderId);
    if (![PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.SENT_TO_SUPPLIER, PurchaseOrderStatus.ACKNOWLEDGED, PurchaseOrderStatus.PARTIALLY_RECEIVED].includes(purchaseOrder.status as PurchaseOrderStatus)) {
      throw new BadRequestException('Purchase order is not in a receivable status');
    }

    // Validate receipt items
    for (const item of data.items) {
      if (item.quantityReceived < 0) {
        throw new BadRequestException('Received quantity cannot be negative');
      }
      if (item.quantityAccepted < 0) {
        throw new BadRequestException('Accepted quantity cannot be negative');
      }
      if (item.quantityAccepted > item.quantityReceived) {
        throw new BadRequestException('Accepted quantity cannot exceed received quantity');
      }
    }

    const result = await this.purchaseOrderRepository.createReceipt(tenantId, data, userId);

    // Update purchase order status based on receipt completion
    await this.updatePurchaseOrderReceiptStatus(tenantId, data.purchaseOrderId, userId);

    // Emit domain event
    this.eventEmitter.emit(
      'purchase-order.received',
      new PurchaseOrderReceivedEvent(
        tenantId,
        data.purchaseOrderId,
        result.receipt.id,
        userId,
      ),
    );

    return result;
  }

  // Invoice Management
  async createInvoice(
    tenantId: string,
    data: CreateInvoiceInput,
    userId: string,
  ) {
    // Verify purchase order exists
    const purchaseOrder = await this.getPurchaseOrder(tenantId, data.purchaseOrderId);

    // Check for duplicate invoice number
    // This would require additional repository method to check existing invoices

    // Validate invoice items
    for (const item of data.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException('Invoice item quantity must be greater than 0');
      }
      if (item.unitPrice < 0) {
        throw new BadRequestException('Invoice item unit price cannot be negative');
      }
    }

    const result = await this.purchaseOrderRepository.createInvoice(tenantId, data, userId);

    // Perform three-way matching
    await this.performThreeWayMatching(tenantId, result.invoice.id, userId);

    // Emit domain event
    this.eventEmitter.emit(
      'purchase-order.invoiced',
      new PurchaseOrderInvoicedEvent(
        tenantId,
        data.purchaseOrderId,
        result.invoice.id,
        data.invoiceAmount,
        userId,
      ),
    );

    return result;
  }

  // Analytics and Reporting
  async getPurchaseOrderStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return await this.purchaseOrderRepository.getPurchaseOrderStats(tenantId, startDate, endDate);
  }

  async getSupplierPurchaseStats(
    tenantId: string,
    supplierId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return await this.purchaseOrderRepository.getSupplierPurchaseStats(
      tenantId,
      supplierId,
      startDate,
      endDate,
    );
  }

  // Private helper methods
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      [PurchaseOrderStatus.DRAFT]: [PurchaseOrderStatus.PENDING_APPROVAL, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.PENDING_APPROVAL]: [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.APPROVED]: [PurchaseOrderStatus.SENT_TO_SUPPLIER, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.SENT_TO_SUPPLIER]: [PurchaseOrderStatus.ACKNOWLEDGED, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.ACKNOWLEDGED]: [PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.FULLY_RECEIVED, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: [PurchaseOrderStatus.FULLY_RECEIVED, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.FULLY_RECEIVED]: [PurchaseOrderStatus.CLOSED],
      [PurchaseOrderStatus.CANCELLED]: [], // No transitions from cancelled
      [PurchaseOrderStatus.CLOSED]: [], // No transitions from closed
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private handleStatusChange(
    tenantId: string,
    purchaseOrder: typeof purchaseOrders.$inferSelect,
    newStatus: string,
    userId: string,
  ): void {
    switch (newStatus) {
      case PurchaseOrderStatus.SENT_TO_SUPPLIER:
        this.eventEmitter.emit(
          'purchase-order.sent',
          new PurchaseOrderSentEvent(tenantId, purchaseOrder.id, purchaseOrder.supplierId, userId),
        );
        break;
      // Add other status change handlers as needed
    }
  }

  private async createApprovalRequests(
    tenantId: string,
    purchaseOrder: typeof purchaseOrders.$inferSelect,
    userId: string,
  ): Promise<void> {
    // Simple approval logic - in a real system, this would be more sophisticated
    const totalAmount = parseFloat(purchaseOrder.totalAmount);

    // Example approval thresholds
    const approvalRules = [
      { threshold: 1000, level: 1, role: 'manager' },
      { threshold: 5000, level: 2, role: 'director' },
      { threshold: 25000, level: 3, role: 'vp' },
    ];

    for (const rule of approvalRules) {
      if (totalAmount >= rule.threshold) {
        // In a real system, you would look up users with the required role
        // For now, we'll skip the actual approval creation
        // await this.purchaseOrderRepository.createApproval(tenantId, {
        //   purchaseOrderId: purchaseOrder.id,
        //   approverId: 'user-with-role',
        //   approvalLevel: rule.level,
        //   approvalRule: `Amount >= ${rule.threshold}`,
        // }, userId);
      }
    }
  }

  private async checkApprovalCompletion(
    tenantId: string,
    purchaseOrderId: string,
    userId: string,
  ): Promise<void> {
    // Check if all required approvals are complete
    const pendingApprovals = await this.purchaseOrderRepository.getPendingApprovals(tenantId);
    const hasPendingApprovals = pendingApprovals.some(
      approval => approval.purchaseOrderId === purchaseOrderId,
    );

    if (!hasPendingApprovals) {
      // All approvals complete, update status to approved
      const updatedPo = await this.purchaseOrderRepository.update(
        tenantId,
        purchaseOrderId,
        { status: PurchaseOrderStatus.APPROVED },
        userId,
      );

      if (updatedPo) {
        this.eventEmitter.emit(
          'purchase-order.approved',
          new PurchaseOrderApprovedEvent(tenantId, purchaseOrderId, userId, 0),
        );
      }
    }
  }

  private async updatePurchaseOrderReceiptStatus(
    tenantId: string,
    purchaseOrderId: string,
    userId: string,
  ): Promise<void> {
    // Get purchase order with items to check receipt status
    const result = await this.purchaseOrderRepository.findById(tenantId, purchaseOrderId, true);
    if (!result || !result.items) {
      return;
    }

    // Check if all items are fully received
    const allItemsReceived = result.items.every(item => {
      const quantityOrdered = parseFloat(item.quantityOrdered);
      const quantityReceived = parseFloat(item.quantityReceived);
      return quantityReceived >= quantityOrdered;
    });

    // Check if any items are partially received
    const anyItemsReceived = result.items.some(item => {
      const quantityReceived = parseFloat(item.quantityReceived);
      return quantityReceived > 0;
    });

    let newStatus: string | undefined;
    if (allItemsReceived) {
      newStatus = PurchaseOrderStatus.FULLY_RECEIVED;
    } else if (anyItemsReceived) {
      newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    if (newStatus && newStatus !== result.purchaseOrder.status) {
      await this.purchaseOrderRepository.update(
        tenantId,
        purchaseOrderId,
        { status: newStatus as PurchaseOrderStatus },
        userId,
      );
    }
  }

  // Private helper methods
  private async performThreeWayMatching(
    tenantId: string,
    invoiceId: string,
    userId: string,
  ): Promise<void> {
    // Get the invoice with related items
    const invoice = await this.purchaseOrderRepository.findInvoiceById(tenantId, invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Get the purchase order with all relations
    const purchaseOrder = await this.purchaseOrderRepository.findById(tenantId, invoice.purchaseOrderId, true);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    // Get all receipts for this PO
    const receipts = purchaseOrder.receipts || [];
    const poItems = purchaseOrder.items || [];
    
    // Perform three-way matching
    const matchingResults = {
      overallMatch: true,
      variances: [] as any[],
      totalVariance: 0,
    };

    // Compare invoice items with PO items and receipt items
    for (const invoiceItem of invoice.items || []) {
      // Find the corresponding PO item by purchaseOrderItemId
      const poItem = poItems.find(
        (item: any) => item.id === invoiceItem.purchaseOrderItemId
      );
      
      if (!poItem) {
        matchingResults.overallMatch = false;
        matchingResults.variances.push({
          type: 'ITEM_NOT_ON_PO',
          purchaseOrderItemId: invoiceItem.purchaseOrderItemId,
          description: 'Invoice item not found on purchase order',
        });
        continue;
      }

      // Convert strings to numbers for calculations
      const poItemUnitPrice = parseFloat(poItem.unitPrice.toString());
      const poItemQuantity = parseFloat(poItem.quantityOrdered.toString());

      // Find corresponding receipt items
      let receivedQuantity = 0;
      for (const receipt of receipts) {
        const receiptItemsTyped = receipt as any;
        const receiptItem = receiptItemsTyped.items?.find(
          (item: any) => item.purchaseOrderItemId === invoiceItem.purchaseOrderItemId
        );
        if (receiptItem) {
          receivedQuantity += parseFloat(receiptItem.quantityAccepted?.toString() || 0);
        }
      }

      // Check quantity variance
      const quantityVariance = invoiceItem.quantity - receivedQuantity;
      if (Math.abs(quantityVariance) > 0.01) { // Allow for small rounding differences
        matchingResults.overallMatch = false;
        matchingResults.variances.push({
          type: 'QUANTITY_VARIANCE',
          purchaseOrderItemId: invoiceItem.purchaseOrderItemId,
          invoiceQuantity: invoiceItem.quantity,
          receivedQuantity,
          variance: quantityVariance,
        });
      }

      // Check price variance (allow 5% tolerance)
      const priceVariance = Math.abs(invoiceItem.unitPrice - poItemUnitPrice);
      const priceVariancePercent = (priceVariance / poItemUnitPrice) * 100;
      if (priceVariancePercent > 5) {
        matchingResults.overallMatch = false;
        matchingResults.variances.push({
          type: 'PRICE_VARIANCE',
          purchaseOrderItemId: invoiceItem.purchaseOrderItemId,
          poUnitPrice: poItemUnitPrice,
          invoiceUnitPrice: invoiceItem.unitPrice,
          variance: priceVariance,
          variancePercent: priceVariancePercent,
        });
      }

      // Calculate total variance
      matchingResults.totalVariance += Math.abs(
        (invoiceItem.quantity * invoiceItem.unitPrice) - 
        (receivedQuantity * poItemUnitPrice)
      );
    }

    // Update invoice match status
    const matchStatus = matchingResults.overallMatch ? 'matched' : 
                       matchingResults.totalVariance > 100 ? 'disputed' : 'variance';

    await this.purchaseOrderRepository.updateInvoiceMatchStatus(
      tenantId,
      invoiceId,
      matchStatus,
      matchingResults,
      userId,
    );

    // If there are significant variances, create alerts or notifications
    if (!matchingResults.overallMatch && matchingResults.totalVariance > 50) {
      // In a real system, this would create alerts for procurement team
      console.log(`Three-way matching failed for invoice ${invoiceId}:`, matchingResults);
    }
  }

  // Workflow automation methods
  async autoApproveSmallOrders(
    tenantId: string,
    threshold: number = 500,
  ): Promise<void> {
    // Auto-approve orders below threshold
    const pendingOrders = await this.purchaseOrderRepository.findMany(tenantId, {
      status: PurchaseOrderStatus.PENDING_APPROVAL,
    });

    for (const order of pendingOrders.purchaseOrders) {
      const totalAmount = parseFloat(order.totalAmount);
      if (totalAmount <= threshold) {
        await this.purchaseOrderRepository.update(
          tenantId,
          order.id,
          { status: PurchaseOrderStatus.APPROVED },
          'system',
        );
      }
    }
  }

  async sendOverdueReminders(tenantId: string): Promise<void> {
    // Send reminders for overdue deliveries
    const overdueOrders = await this.purchaseOrderRepository.findMany(tenantId, {
      status: PurchaseOrderStatus.SENT_TO_SUPPLIER,
      deliveryDateTo: new Date().toISOString(),
    });

    for (const order of overdueOrders.purchaseOrders) {
      // In a real system, this would send notifications
      console.log(`Order ${order.poNumber} is overdue for delivery`);
    }
  }
}