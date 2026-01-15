import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { paymentRecords } from '../../database/schema/transaction.schema';
import { PaymentRecord } from '../entities/transaction.entity';
import { PaymentMethod } from '../dto/transaction.dto';

@Injectable()
export class PaymentRepository {
  constructor(
    @Inject(DrizzleService)
    private readonly drizzle: DrizzleService,
  ) {}

  async create(
    tenantId: string,
    paymentData: {
      transactionId: string;
      paymentMethod: PaymentMethod | string;
      amount: number;
      paymentProvider?: string;
      providerTransactionId?: string;
      providerResponse?: Record<string, any>;
      metadata?: Record<string, any>;
    },
    userId: string,
  ): Promise<PaymentRecord> {
    const db = this.drizzle.getDb();
    
    // Create values object without undefined properties
    const values: any = {
      tenantId,
      transactionId: paymentData.transactionId,
      paymentMethod: paymentData.paymentMethod as PaymentMethod,
      amount: paymentData.amount.toFixed(2),
      status: 'pending',
      refundedAmount: '0.00',
      createdBy: userId,
      updatedBy: userId,
    };

    // Only add optional properties if they are defined
    if (paymentData.paymentProvider !== undefined) {
      values.paymentProvider = paymentData.paymentProvider;
    }
    if (paymentData.providerTransactionId !== undefined) {
      values.providerTransactionId = paymentData.providerTransactionId;
    }
    if (paymentData.providerResponse !== undefined) {
      values.providerResponse = paymentData.providerResponse;
    } else {
      values.providerResponse = {};
    }
    if (paymentData.metadata !== undefined) {
      values.metadata = paymentData.metadata;
    } else {
      values.metadata = {};
    }
    
    const [payment] = await db
      .insert(paymentRecords)
      .values(values)
      .returning();

    return this.mapToEntity(payment);
  }

  async update(
    tenantId: string,
    id: string,
    updates: {
      status?: string;
      processedAt?: Date;
      failureReason?: string;
      providerResponse?: Record<string, any>;
      refundedAmount?: number;
      refundedAt?: Date;
    },
    userId: string,
  ): Promise<PaymentRecord | null> {
    const db = this.drizzle.getDb();
    
    const updateData: any = {
      ...updates,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (updates.refundedAmount !== undefined) {
      updateData.refundedAmount = updates.refundedAmount.toFixed(2);
    }
    
    const [updated] = await db
      .update(paymentRecords)
      .set(updateData)
      .where(and(
        eq(paymentRecords.tenantId, tenantId),
        eq(paymentRecords.id, id),
        eq(paymentRecords.isActive, true)
      ))
      .returning();

    return updated ? this.mapToEntity(updated) : null;
  }

  async findById(tenantId: string, id: string): Promise<PaymentRecord | null> {
    const db = this.drizzle.getDb();
    
    const [payment] = await db
      .select()
      .from(paymentRecords)
      .where(and(
        eq(paymentRecords.tenantId, tenantId),
        eq(paymentRecords.id, id),
        eq(paymentRecords.isActive, true)
      ));

    return payment ? this.mapToEntity(payment) : null;
  }

  async findByTransactionId(tenantId: string, transactionId: string): Promise<PaymentRecord[]> {
    const db = this.drizzle.getDb();
    
    const payments = await db
      .select()
      .from(paymentRecords)
      .where(and(
        eq(paymentRecords.tenantId, tenantId),
        eq(paymentRecords.transactionId, transactionId),
        eq(paymentRecords.isActive, true)
      ))
      .orderBy(desc(paymentRecords.createdAt));

    return payments.map(this.mapToEntity);
  }

  async findByProviderTransactionId(
    tenantId: string,
    providerTransactionId: string,
  ): Promise<PaymentRecord | null> {
    const db = this.drizzle.getDb();
    
    const [payment] = await db
      .select()
      .from(paymentRecords)
      .where(and(
        eq(paymentRecords.tenantId, tenantId),
        eq(paymentRecords.providerTransactionId, providerTransactionId),
        eq(paymentRecords.isActive, true)
      ));

    return payment ? this.mapToEntity(payment) : null;
  }

  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    locationId?: string,
  ): Promise<PaymentRecord[]> {
    const db = this.drizzle.getDb();
    
    let whereConditions = [
      eq(paymentRecords.tenantId, tenantId),
      eq(paymentRecords.isActive, true),
    ];

    // Add date range conditions
    if (startDate) {
      whereConditions.push(gte(paymentRecords.createdAt, startDate));
    }
    if (endDate) {
      whereConditions.push(lte(paymentRecords.createdAt, endDate));
    }

    const payments = await db
      .select()
      .from(paymentRecords)
      .where(and(...whereConditions))
      .orderBy(desc(paymentRecords.createdAt));

    return payments.map(this.mapToEntity);
  }

  private mapToEntity(row: any): PaymentRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      transactionId: row.transactionId,
      paymentMethod: row.paymentMethod,
      amount: parseFloat(row.amount),
      status: row.status,
      paymentProvider: row.paymentProvider,
      providerTransactionId: row.providerTransactionId,
      providerResponse: row.providerResponse,
      processedAt: row.processedAt,
      failureReason: row.failureReason,
      refundedAmount: parseFloat(row.refundedAmount),
      refundedAt: row.refundedAt,
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