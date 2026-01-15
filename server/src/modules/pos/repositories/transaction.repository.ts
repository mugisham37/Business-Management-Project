import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, asc, sql, count, gte, lte } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { transactions, transactionItems, paymentRecords } from '../../database/schema/transaction.schema';
import { Transaction, TransactionItem, TransactionWithItems } from '../entities/transaction.entity';
import { CreateTransactionDto, CreateTransactionItemDto, PaymentMethod, TransactionStatus } from '../dto/transaction.dto';

@Injectable()
export class TransactionRepository {
  constructor(
    @Inject(DrizzleService)
    private readonly drizzle: DrizzleService,
  ) {}

  async create(
    tenantId: string,
    transactionData: CreateTransactionDto,
    userId: string,
  ): Promise<Transaction> {
    const db = this.drizzle.getDb();
    
    // Generate transaction number
    const transactionNumber = await this.generateTransactionNumber(tenantId);
    
    // Calculate totals
    const subtotal = transactionData.items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
      return sum + lineTotal;
    }, 0);
    
    const taxAmount = transactionData.taxAmount || 0;
    const discountAmount = transactionData.discountAmount || 0;
    const tipAmount = transactionData.tipAmount || 0;
    const total = subtotal + taxAmount - discountAmount + tipAmount;
    
    const [transaction] = await db
      .insert(transactions)
      .values({
        tenantId,
        transactionNumber,
        customerId: transactionData.customerId,
        locationId: transactionData.locationId,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        tipAmount: tipAmount.toFixed(2),
        total: total.toFixed(2),
        status: 'pending',
        itemCount: transactionData.items.length,
        notes: transactionData.notes,
        paymentMethod: transactionData.paymentMethod,
        paymentStatus: 'pending',
        paymentReference: transactionData.paymentReference,
        isOfflineTransaction: transactionData.isOfflineTransaction || false,
        offlineTimestamp: transactionData.isOfflineTransaction ? new Date() : null,
        metadata: transactionData.metadata || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.mapToEntity(transaction);
  }

  async createItems(
    tenantId: string,
    transactionId: string,
    items: CreateTransactionItemDto[],
    userId: string,
  ): Promise<TransactionItem[]> {
    const db = this.drizzle.getDb();
    
    const itemsData = items.map(item => {
      const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
      return {
        tenantId,
        transactionId,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
        discountAmount: (item.discountAmount || 0).toFixed(2),
        taxAmount: '0.00', // Tax calculation can be added later
        variantInfo: item.variantInfo || {},
        metadata: item.metadata || {},
        createdBy: userId,
        updatedBy: userId,
      };
    });

    const createdItems = await db
      .insert(transactionItems)
      .values(itemsData)
      .returning();

    return createdItems.map(this.mapItemToEntity);
  }

  async findById(tenantId: string, id: string): Promise<Transaction | null> {
    const db = this.drizzle.getDb();
    
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.tenantId, tenantId),
        eq(transactions.id, id),
        eq(transactions.isActive, true)
      ));

    return transaction ? this.mapToEntity(transaction) : null;
  }

  async findByIdWithItems(tenantId: string, id: string): Promise<TransactionWithItems | null> {
    const transaction = await this.findById(tenantId, id);
    if (!transaction) return null;

    const items = await this.findItemsByTransactionId(tenantId, id);
    const payments = await this.findPaymentsByTransactionId(tenantId, id);

    return {
      ...transaction,
      items,
      payments,
    };
  }

  async findItemsByTransactionId(tenantId: string, transactionId: string): Promise<TransactionItem[]> {
    const db = this.drizzle.getDb();
    
    const items = await db
      .select()
      .from(transactionItems)
      .where(and(
        eq(transactionItems.tenantId, tenantId),
        eq(transactionItems.transactionId, transactionId),
        eq(transactionItems.isActive, true)
      ))
      .orderBy(asc(transactionItems.createdAt));

    return items.map(this.mapItemToEntity);
  }

  async findPaymentsByTransactionId(tenantId: string, transactionId: string): Promise<any[]> {
    const db = this.drizzle.getDb();
    
    const payments = await db
      .select()
      .from(paymentRecords)
      .where(and(
        eq(paymentRecords.tenantId, tenantId),
        eq(paymentRecords.transactionId, transactionId),
        eq(paymentRecords.isActive, true)
      ))
      .orderBy(asc(paymentRecords.createdAt));

    return payments;
  }

  async update(
    tenantId: string,
    id: string,
    updates: Partial<Transaction>,
    userId: string,
  ): Promise<Transaction | null> {
    const db = this.drizzle.getDb();
    
    // Create update object without undefined properties and with proper types
    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Only add defined properties to avoid exactOptionalPropertyTypes issues
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        if (key === 'paymentMethod') {
          updateData[key] = value as PaymentMethod;
        } else if (key === 'status') {
          updateData[key] = value as TransactionStatus;
        } else {
          updateData[key] = value;
        }
      }
    });
    
    const [updated] = await db
      .update(transactions)
      .set(updateData)
      .where(and(
        eq(transactions.tenantId, tenantId),
        eq(transactions.id, id),
        eq(transactions.isActive, true)
      ))
      .returning();

    return updated ? this.mapToEntity(updated) : null;
  }

  async findByTenant(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      locationId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const db = this.drizzle.getDb();
    
    let whereConditions = [
      eq(transactions.tenantId, tenantId),
      eq(transactions.isActive, true),
    ];

    if (options.locationId) {
      whereConditions.push(eq(transactions.locationId, options.locationId));
    }

    if (options.status) {
      // Cast status to the correct enum type
      whereConditions.push(eq(transactions.status, options.status as any));
    }

    if (options.startDate) {
      whereConditions.push(gte(transactions.createdAt, options.startDate));
    }

    if (options.endDate) {
      whereConditions.push(lte(transactions.createdAt, options.endDate));
    }

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(transactions)
      .where(and(...whereConditions));

    const totalCount = countResult[0]?.count || 0;

    // Get transactions with proper query building
    let query = db
      .select()
      .from(transactions)
      .where(and(...whereConditions))
      .orderBy(desc(transactions.createdAt));

    if (options.limit !== undefined) {
      query = query.limit(options.limit) as any;
    }

    if (options.offset !== undefined) {
      query = query.offset(options.offset) as any;
    }

    const results = await query;

    return {
      transactions: results.map(this.mapToEntity),
      total: totalCount,
    };
  }

  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    locationId?: string,
  ): Promise<Transaction[]> {
    const db = this.drizzle.getDb();
    
    let whereConditions = [
      eq(transactions.tenantId, tenantId),
      eq(transactions.isActive, true),
      gte(transactions.createdAt, startDate),
      lte(transactions.createdAt, endDate),
    ];

    if (locationId) {
      whereConditions.push(eq(transactions.locationId, locationId));
    }

    const results = await db
      .select()
      .from(transactions)
      .where(and(...whereConditions))
      .orderBy(desc(transactions.createdAt));

    return results.map(this.mapToEntity);
  }

  private async generateTransactionNumber(tenantId: string): Promise<string> {
    const db = this.drizzle.getDb();
    
    // Get the count of transactions for today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const countResult = await db
      .select({ count: count() })
      .from(transactions)
      .where(and(
        eq(transactions.tenantId, tenantId),
        gte(transactions.createdAt, startOfDay),
        lte(transactions.createdAt, endOfDay)
      ));

    const todayCount = countResult[0]?.count || 0;

    const sequence = (todayCount + 1).toString().padStart(4, '0');
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    return `TXN-${dateStr}-${sequence}`;
  }

  private mapToEntity(row: any): Transaction {
    return {
      id: row.id,
      tenantId: row.tenantId,
      transactionNumber: row.transactionNumber,
      customerId: row.customerId,
      locationId: row.locationId,
      subtotal: parseFloat(row.subtotal),
      taxAmount: parseFloat(row.taxAmount),
      discountAmount: parseFloat(row.discountAmount),
      tipAmount: parseFloat(row.tipAmount),
      total: parseFloat(row.total),
      status: row.status,
      itemCount: row.itemCount,
      notes: row.notes,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      paymentReference: row.paymentReference,
      isOfflineTransaction: row.isOfflineTransaction,
      offlineTimestamp: row.offlineTimestamp,
      syncedAt: row.syncedAt,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      deletedAt: row.deletedAt,
      version: row.version,
      isActive: row.isActive,
    };
  }

  private mapItemToEntity(row: any): TransactionItem {
    return {
      id: row.id,
      tenantId: row.tenantId,
      transactionId: row.transactionId,
      productId: row.productId,
      productSku: row.productSku,
      productName: row.productName,
      quantity: parseFloat(row.quantity),
      unitPrice: parseFloat(row.unitPrice),
      lineTotal: parseFloat(row.lineTotal),
      discountAmount: parseFloat(row.discountAmount),
      taxAmount: parseFloat(row.taxAmount),
      variantInfo: row.variantInfo,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      deletedAt: row.deletedAt,
      version: row.version,
      isActive: row.isActive,
    };
  }
}