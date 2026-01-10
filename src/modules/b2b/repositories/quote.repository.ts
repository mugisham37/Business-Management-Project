import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, gte, lte, ilike, inArray, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { quotes, quoteItems } from '../../database/schema/b2b.schema';
import { CreateQuoteDto, UpdateQuoteDto, QuoteQueryDto } from '../dto/quote.dto';

export interface QuoteFilterDto {
  customerId?: string;
  status?: string | string[];
  salesRepId?: string;
  accountManagerId?: string;
  quoteDateFrom?: Date;
  quoteDateTo?: Date;
  expirationDateFrom?: Date;
  expirationDateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

@Injectable()
export class QuoteRepository {
  constructor(private readonly drizzleService: DrizzleService) {}

  async create(tenantId: string, data: CreateQuoteDto) {
    const db = this.drizzleService.getDb();
    
    // Calculate expiration date
    const quoteDate = data.quoteDate ? new Date(data.quoteDate) : new Date();
    const validityDays = data.validityDays || 30;
    const expirationDate = new Date(quoteDate);
    expirationDate.setDate(expirationDate.getDate() + validityDays);
    
    const quoteData = {
      tenantId,
      quoteNumber: await this.generateQuoteNumber(tenantId),
      customerId: data.customerId,
      quoteDate,
      expirationDate,
      validUntil: expirationDate,
      paymentTerms: data.paymentTerms,
      deliveryTerms: data.deliveryTerms || null,
      termsAndConditions: data.termsAndConditions || null,
      salesRepId: data.salesRepId || null,
      accountManagerId: data.accountManagerId || null,
      specialInstructions: data.specialInstructions || null,
      internalNotes: data.internalNotes || null,
      metadata: data.metadata || {},
      // These will be calculated by the service layer
      subtotal: '0',
      taxAmount: '0',
      shippingAmount: '0',
      discountAmount: data.discountAmount?.toString() || '0',
      totalAmount: '0',
    };
    
    const result = await db
      .insert(quotes)
      .values(quoteData)
      .returning();

    return (result as any[])[0];
  }

  async findById(tenantId: string, id: string) {
    const db = this.drizzleService.getDb();
    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(
        eq(quotes.id, id), 
        eq(quotes.tenantId, tenantId),
        isNull(quotes.deletedAt)
      ));

    return quote;
  }

  async findByQuoteNumber(tenantId: string, quoteNumber: string) {
    const db = this.drizzleService.getDb();
    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(
        eq(quotes.quoteNumber, quoteNumber), 
        eq(quotes.tenantId, tenantId),
        isNull(quotes.deletedAt)
      ));

    return quote;
  }

  async findMany(tenantId: string, filters: QuoteFilterDto = {}) {
    const db = this.drizzleService.getDb();
    
    // Build conditions
    const conditions = [
      eq(quotes.tenantId, tenantId),
      isNull(quotes.deletedAt)
    ];

    if (filters.customerId) {
      conditions.push(eq(quotes.customerId, filters.customerId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(quotes.status, filters.status));
      } else {
        conditions.push(eq(quotes.status, filters.status));
      }
    }

    if (filters.salesRepId) {
      conditions.push(eq(quotes.salesRepId, filters.salesRepId));
    }

    if (filters.accountManagerId) {
      conditions.push(eq(quotes.accountManagerId, filters.accountManagerId));
    }

    if (filters.quoteDateFrom) {
      conditions.push(gte(quotes.quoteDate, filters.quoteDateFrom));
    }

    if (filters.quoteDateTo) {
      conditions.push(lte(quotes.quoteDate, filters.quoteDateTo));
    }

    if (filters.expirationDateFrom) {
      conditions.push(gte(quotes.expirationDate, filters.expirationDateFrom));
    }

    if (filters.expirationDateTo) {
      conditions.push(lte(quotes.expirationDate, filters.expirationDateTo));
    }

    if (filters.minAmount) {
      conditions.push(gte(quotes.totalAmount, filters.minAmount.toString()));
    }

    if (filters.maxAmount) {
      conditions.push(lte(quotes.totalAmount, filters.maxAmount.toString()));
    }

    if (filters.search) {
      conditions.push(
        ilike(quotes.quoteNumber, `%${filters.search}%`)
      );
    }

    // Execute query with all conditions
    let result = await db
      .select()
      .from(quotes)
      .where(and(...conditions))
      .orderBy(desc(quotes.quoteDate));

    // Apply client-side filtering for complex operations
    if (filters.limit) {
      result = result.slice(0, filters.limit);
    }

    if (filters.offset) {
      result = result.slice(filters.offset);
    }

    return result;
  }

  async update(tenantId: string, id: string, data: UpdateQuoteDto) {
    const db = this.drizzleService.getDb();
    const [quote] = await db
      .update(quotes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(quotes.id, id), 
        eq(quotes.tenantId, tenantId),
        isNull(quotes.deletedAt)
      ))
      .returning();

    return quote;
  }

  async delete(tenantId: string, id: string) {
    const db = this.drizzleService.getDb();
    const [quote] = await db
      .update(quotes)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(quotes.id, id), 
        eq(quotes.tenantId, tenantId)
      ))
      .returning();

    return quote;
  }

  async findWithItems(tenantId: string, id: string) {
    const quote = await this.findById(tenantId, id);
    if (!quote) return null;

    const db = this.drizzleService.getDb();
    const items = await db
      .select()
      .from(quoteItems)
      .where(and(
        eq(quoteItems.quoteId, id), 
        eq(quoteItems.tenantId, tenantId),
        isNull(quoteItems.deletedAt)
      ))
      .orderBy(asc(quoteItems.createdAt));

    return {
      ...quote,
      items,
    };
  }

  async findByCustomer(tenantId: string, customerId: string, filters: Partial<QuoteFilterDto> = {}) {
    return this.findMany(tenantId, {
      ...filters,
      customerId,
    });
  }

  async findBySalesRep(tenantId: string, salesRepId: string, filters: Partial<QuoteFilterDto> = {}) {
    return this.findMany(tenantId, {
      ...filters,
      salesRepId,
    });
  }

  async findExpiring(tenantId: string, daysFromNow: number = 7) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysFromNow);

    const db = this.drizzleService.getDb();
    return await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          lte(quotes.expirationDate, expirationDate),
          inArray(quotes.status, ['sent', 'approved']),
          isNull(quotes.deletedAt)
        )
      )
      .orderBy(asc(quotes.expirationDate));
  }

  async findExpired(tenantId: string) {
    const now = new Date();

    const db = this.drizzleService.getDb();
    return await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          lte(quotes.expirationDate, now),
          inArray(quotes.status, ['sent', 'approved']),
          isNull(quotes.deletedAt)
        )
      )
      .orderBy(desc(quotes.expirationDate));
  }

  async markAsExpired(tenantId: string, ids: string[]) {
    const db = this.drizzleService.getDb();
    return await db
      .update(quotes)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          inArray(quotes.id, ids),
          isNull(quotes.deletedAt)
        )
      )
      .returning();
  }

  async convertToOrder(tenantId: string, quoteId: string, orderId: string) {
    const db = this.drizzleService.getDb();
    const [quote] = await db
      .update(quotes)
      .set({
        status: 'converted',
        convertedToOrderId: orderId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(quotes.id, quoteId), 
        eq(quotes.tenantId, tenantId),
        isNull(quotes.deletedAt)
      ))
      .returning();

    return quote;
  }

  async getQuoteMetrics(tenantId: string, filters: Partial<QuoteFilterDto> = {}) {
    const conditions = [
      eq(quotes.tenantId, tenantId),
      isNull(quotes.deletedAt)
    ];

    if (filters.quoteDateFrom) {
      conditions.push(gte(quotes.quoteDate, filters.quoteDateFrom));
    }

    if (filters.quoteDateTo) {
      conditions.push(lte(quotes.quoteDate, filters.quoteDateTo));
    }

    if (filters.salesRepId) {
      conditions.push(eq(quotes.salesRepId, filters.salesRepId));
    }

    const db = this.drizzleService.getDb();
    const allQuotes = await db
      .select()
      .from(quotes)
      .where(and(...conditions));

    const metrics = {
      totalQuotes: allQuotes.length,
      totalValue: allQuotes.reduce((sum: number, quote: any) => sum + parseFloat(quote.totalAmount), 0),
      statusBreakdown: {} as Record<string, number>,
      conversionRate: 0,
      averageQuoteValue: 0,
      expiredQuotes: 0,
      pendingQuotes: 0,
    };

    // Calculate status breakdown
    allQuotes.forEach((quote: any) => {
      metrics.statusBreakdown[quote.status] = (metrics.statusBreakdown[quote.status] || 0) + 1;
    });

    // Calculate conversion rate
    const convertedQuotes = allQuotes.filter((q: any) => q.status === 'converted').length;
    const totalEligibleQuotes = allQuotes.filter((q: any) => 
      ['sent', 'approved', 'accepted', 'rejected', 'converted'].includes(q.status)
    ).length;
    
    if (totalEligibleQuotes > 0) {
      metrics.conversionRate = (convertedQuotes / totalEligibleQuotes) * 100;
    }

    // Calculate average quote value
    if (allQuotes.length > 0) {
      metrics.averageQuoteValue = metrics.totalValue / allQuotes.length;
    }

    // Count expired and pending quotes
    metrics.expiredQuotes = allQuotes.filter((q: any) => q.status === 'expired').length;
    metrics.pendingQuotes = allQuotes.filter((q: any) => 
      ['draft', 'pending_approval', 'sent'].includes(q.status)
    ).length;

    return metrics;
  }

  private async generateQuoteNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QT-${year}-`;
    
    // Find the highest quote number for this year and tenant
    const db = this.drizzleService.getDb();
    const lastQuote = await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.tenantId, tenantId),
          ilike(quotes.quoteNumber, `${prefix}%`),
          isNull(quotes.deletedAt)
        )
      )
      .orderBy(desc(quotes.quoteNumber))
      .limit(1);

    let nextNumber = 1;
    if (lastQuote.length > 0 && lastQuote[0]) {
      const lastNumber = lastQuote[0].quoteNumber.replace(prefix, '');
      nextNumber = parseInt(lastNumber, 10) + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }
}