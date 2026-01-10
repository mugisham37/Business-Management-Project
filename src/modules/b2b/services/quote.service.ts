import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  quotes, 
  quoteItems,
  b2bOrders,
  b2bOrderItems,
  customers,
  products
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, asc, sql, isNull, ilike, not, inArray } from 'drizzle-orm';
import { CreateQuoteDto, UpdateQuoteDto, QuoteQueryDto, QuoteItemDto } from '../dto/quote.dto';
import { B2BPricingService } from './b2b-pricing.service';
import { B2BWorkflowService } from './b2b-workflow.service';

export interface Quote {
  id: string;
  tenantId: string;
  quoteNumber: string;
  customerId: string;
  status: string;
  quoteDate: Date;
  expirationDate: Date;
  validUntil: Date;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentTerms: string;
  deliveryTerms?: string;
  termsAndConditions?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  salesRepId?: string;
  accountManagerId?: string;
  customerResponse?: string;
  customerResponseDate?: Date;
  customerNotes?: string;
  convertedToOrderId?: string;
  convertedAt?: Date;
  specialInstructions?: string;
  internalNotes?: string;
  items: QuoteItem[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
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
  metadata: Record<string, any>;
}

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly pricingService: B2BPricingService,
    private readonly workflowService: B2BWorkflowService,
  ) {}

  async createQuote(tenantId: string, data: CreateQuoteDto, userId: string): Promise<Quote> {
    try {
      // Validate quote data
      await this.validateQuoteData(tenantId, data);

      // Generate quote number
      const quoteNumber = await this.generateQuoteNumber(tenantId);

      // Calculate pricing for all items
      const pricedItems = await this.calculateItemPricing(tenantId, data.customerId, data.items);

      // Calculate totals
      const subtotal = pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const taxAmount = await this.calculateTax(tenantId, data.customerId, subtotal);
      const shippingAmount = await this.calculateShipping(tenantId, data.customerId, pricedItems);
      const discountAmount = data.discountAmount || 0;
      const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

      // Set expiration date (default 30 days)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + (data.validityDays || 30));

      // Check if quote requires approval
      const requiresApproval = await this.checkApprovalRequired(tenantId, data.customerId, totalAmount);

      // Create quote record
      const [quoteRecord] = await this.drizzle.getDb()
        .insert(quotes)
        .values({
          tenantId,
          quoteNumber,
          customerId: data.customerId,
          status: requiresApproval ? 'pending_approval' : 'approved',
          quoteDate: data.quoteDate ? new Date(data.quoteDate) : new Date(),
          expirationDate,
          validUntil: expirationDate,
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          shippingAmount: shippingAmount.toString(),
          discountAmount: discountAmount.toString(),
          totalAmount: totalAmount.toString(),
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          termsAndConditions: data.termsAndConditions,
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

      // Create quote items
      const quoteItemsData = pricedItems.map(item => ({
        tenantId,
        quoteId: quoteRecord.id,
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
        metadata: item.metadata || {},
        createdBy: userId,
        updatedBy: userId,
      }));

      const quoteItemRecords = await this.drizzle.getDb()
        .insert(quoteItems)
        .values(quoteItemsData)
        .returning();

      // Start approval workflow if required
      if (requiresApproval) {
        await this.workflowService.startApprovalWorkflow(tenantId, quoteRecord.id, 'quote', userId);
      }

      // Clear caches
      await this.invalidateQuoteCaches(tenantId);

      // Emit event
      this.eventEmitter.emit('quote.created', {
        tenantId,
        quoteId: quoteRecord.id,
        customerId: data.customerId,
        totalAmount,
        requiresApproval,
        userId,
      });

      this.logger.log(`Created quote ${quoteRecord.quoteNumber} for tenant ${tenantId}`);
      return this.mapToQuote(quoteRecord, quoteItemRecords);
    } catch (error) {
      this.logger.error(`Failed to create quote for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findQuoteById(tenantId: string, quoteId: string): Promise<Quote> {
    try {
      const cacheKey = `quote:${tenantId}:${quoteId}`;
      
      // Try cache first
      let quote = await this.cacheService.get<Quote>(cacheKey);
      
      if (!quote) {
        // Get quote with items
        const [quoteRecord] = await this.drizzle.getDb()
          .select()
          .from(quotes)
          .where(and(
            eq(quotes.tenantId, tenantId),
            eq(quotes.id, quoteId),
            isNull(quotes.deletedAt)
          ));

        if (!quoteRecord) {
          throw new NotFoundException(`Quote ${quoteId} not found`);
        }

        const quoteItemRecords = await this.drizzle.getDb()
          .select()
          .from(quoteItems)
          .where(and(
            eq(quoteItems.tenantId, tenantId),
            eq(quoteItems.quoteId, quoteId),
            isNull(quoteItems.deletedAt)
          ));

        quote = this.mapToQuote(quoteRecord, quoteItemRecords);

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, quote, { ttl: 600 });
      }

      return quote;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find quote ${quoteId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findQuotes(tenantId: string, query: QuoteQueryDto): Promise<{ quotes: Quote[]; total: number }> {
    try {
      const cacheKey = `quotes:${tenantId}:${JSON.stringify(query)}`;
      
      // Try cache first for common queries
      let result = await this.cacheService.get<{ quotes: Quote[]; total: number }>(cacheKey);
      
      if (!result) {
        const conditions = [
          eq(quotes.tenantId, tenantId),
          isNull(quotes.deletedAt)
        ];

        // Add search conditions
        if (query.search) {
          conditions.push(
            or(
              ilike(quotes.quoteNumber, `%${query.search}%`),
              ilike(customers.companyName, `%${query.search}%`)
            )!
          );
        }

        // Add filter conditions
        if (query.status) {
          if (Array.isArray(query.status)) {
            conditions.push(inArray(quotes.status, query.status));
          } else {
            conditions.push(eq(quotes.status, query.status));
          }
        }

        if (query.customerId) {
          conditions.push(eq(quotes.customerId, query.customerId));
        }

        if (query.salesRepId) {
          conditions.push(eq(quotes.salesRepId, query.salesRepId));
        }

        if (query.accountManagerId) {
          conditions.push(eq(quotes.accountManagerId, query.accountManagerId));
        }

        if (query.startDate) {
          conditions.push(gte(quotes.quoteDate, new Date(query.startDate)));
        }

        if (query.endDate) {
          conditions.push(lte(quotes.quoteDate, new Date(query.endDate)));
        }

        if (query.minAmount !== undefined) {
          conditions.push(gte(quotes.totalAmount, query.minAmount.toString()));
        }

        if (query.maxAmount !== undefined) {
          conditions.push(lte(quotes.totalAmount, query.maxAmount.toString()));
        }

        if (query.expiringWithinDays !== undefined) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + query.expiringWithinDays);
          conditions.push(lte(quotes.expirationDate, futureDate));
        }

        const whereClause = and(...conditions);

        // Get total count
        const [countResult] = await this.drizzle.getDb()
          .select({ count: sql<number>`count(*)` })
          .from(quotes)
          .leftJoin(customers, eq(quotes.customerId, customers.id))
          .where(whereClause);

        const total = countResult?.count || 0;

        // Get paginated results
        const offset = ((query.page || 1) - 1) * (query.limit || 20);
        const orderBy = query.sortOrder === 'asc' 
          ? asc(quotes[query.sortBy as keyof typeof quotes] || quotes.quoteDate)
          : desc(quotes[query.sortBy as keyof typeof quotes] || quotes.quoteDate);

        const quotesData = await this.drizzle.getDb()
          .select()
          .from(quotes)
          .leftJoin(customers, eq(quotes.customerId, customers.id))
          .where(whereClause)
          .orderBy(orderBy)
          .limit(query.limit || 20)
          .offset(offset);

        // Get quote items for each quote
        const quoteIds = quotesData.map(row => row.quotes.id);
        const allQuoteItems = quoteIds.length > 0 ? await this.drizzle.getDb()
          .select()
          .from(quoteItems)
          .where(and(
            eq(quoteItems.tenantId, tenantId),
            inArray(quoteItems.quoteId, quoteIds),
            isNull(quoteItems.deletedAt)
          )) : [];

        const quotesList = quotesData.map(row => {
          const items = allQuoteItems.filter(item => item.quoteId === row.quotes.id);
          return this.mapToQuote(row.quotes, items);
        });

        result = {
          quotes: quotesList,
          total: total,
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, { ttl: 300 });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to find quotes for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateQuote(tenantId: string, quoteId: string, data: UpdateQuoteDto, userId: string): Promise<Quote> {
    try {
      // Check if quote exists and can be updated
      const existingQuote = await this.findQuoteById(tenantId, quoteId);
      
      if (!this.canUpdateQuote(existingQuote.status)) {
        throw new BadRequestException(`Cannot update quote in ${existingQuote.status} status`);
      }

      // Update quote record
      const updateData: any = { ...data, updatedBy: userId };
      
      // Convert date fields
      if (data.expirationDate) {
        updateData.expirationDate = new Date(data.expirationDate);
        updateData.validUntil = new Date(data.expirationDate);
      }

      // Convert decimal fields to strings
      if (data.discountAmount !== undefined) {
        updateData.discountAmount = data.discountAmount.toString();
      }

      const [updatedQuote] = await this.drizzle.getDb()
        .update(quotes)
        .set(updateData)
        .where(and(
          eq(quotes.tenantId, tenantId),
          eq(quotes.id, quoteId),
          isNull(quotes.deletedAt)
        ))
        .returning();

      if (!updatedQuote) {
        throw new Error(`Quote ${quoteId} not found for update`);
      }

      // Clear caches
      await this.invalidateQuoteCaches(tenantId, quoteId);

      // Emit event
      this.eventEmitter.emit('quote.updated', {
        tenantId,
        quoteId,
        previousStatus: existingQuote.status,
        newStatus: updatedQuote.status,
        userId,
      });

      // Get updated quote with items
      return this.findQuoteById(tenantId, quoteId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update quote ${quoteId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async convertQuoteToOrder(tenantId: string, quoteId: string, userId: string): Promise<any> {
    try {
      const quote = await this.findQuoteById(tenantId, quoteId);
      
      if (quote.status !== 'approved' && quote.status !== 'sent') {
        throw new BadRequestException('Quote must be approved or sent to convert to order');
      }

      if (quote.convertedToOrderId) {
        throw new ConflictException('Quote has already been converted to an order');
      }

      // Check if quote is still valid
      if (new Date() > quote.validUntil) {
        throw new BadRequestException('Quote has expired and cannot be converted');
      }

      // Create order from quote
      const [orderRecord] = await this.drizzle.getDb()
        .insert(b2bOrders)
        .values({
          tenantId,
          orderNumber: await this.generateOrderNumber(tenantId),
          customerId: quote.customerId,
          quoteId: quote.id,
          status: 'approved',
          orderDate: new Date(),
          subtotal: quote.subtotal.toString(),
          taxAmount: quote.taxAmount.toString(),
          shippingAmount: quote.shippingAmount.toString(),
          discountAmount: quote.discountAmount.toString(),
          totalAmount: quote.totalAmount.toString(),
          paymentTerms: quote.paymentTerms,
          shippingAddress: {}, // Would need to get from customer
          billingAddress: {}, // Would need to get from customer
          requiresApproval: false,
          approvedBy: userId,
          approvedAt: new Date(),
          approvalNotes: `Converted from quote ${quote.quoteNumber}`,
          salesRepId: quote.salesRepId,
          accountManagerId: quote.accountManagerId,
          specialInstructions: quote.specialInstructions,
          internalNotes: quote.internalNotes,
          metadata: quote.metadata,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Create order items from quote items
      const orderItemsData = quote.items.map(item => ({
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
        metadata: item.metadata,
        createdBy: userId,
        updatedBy: userId,
      }));

      await this.drizzle.getDb()
        .insert(b2bOrderItems)
        .values(orderItemsData);

      // Update quote to mark as converted
      await this.drizzle.getDb()
        .update(quotes)
        .set({
          status: 'converted',
          convertedToOrderId: orderRecord.id,
          convertedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(quotes.tenantId, tenantId),
          eq(quotes.id, quoteId)
        ));

      // Clear caches
      await this.invalidateQuoteCaches(tenantId, quoteId);

      // Emit event
      this.eventEmitter.emit('quote.converted', {
        tenantId,
        quoteId,
        orderId: orderRecord.id,
        customerId: quote.customerId,
        totalAmount: quote.totalAmount,
        userId,
      });

      this.logger.log(`Converted quote ${quote.quoteNumber} to order ${orderRecord.orderNumber}`);
      
      return {
        orderId: orderRecord.id,
        orderNumber: orderRecord.orderNumber,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
      };
    } catch (error) {
      this.logger.error(`Failed to convert quote ${quoteId} to order:`, error);
      throw error;
    }
  }

  private async validateQuoteData(tenantId: string, data: CreateQuoteDto): Promise<void> {
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
      throw new BadRequestException('Quote must have at least one item');
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

  private async generateQuoteNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QUO-${year}-`;
    
    // Get the latest quote number for this year
    const [latestQuote] = await this.drizzle.getDb()
      .select({ quoteNumber: quotes.quoteNumber })
      .from(quotes)
      .where(and(
        eq(quotes.tenantId, tenantId),
        ilike(quotes.quoteNumber, `${prefix}%`)
      ))
      .orderBy(desc(quotes.quoteNumber))
      .limit(1);

    let nextNumber = 1;
    if (latestQuote) {
      const currentNumber = parseInt(latestQuote.quoteNumber.split('-').pop() || '0');
      nextNumber = currentNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
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

  private async calculateItemPricing(tenantId: string, customerId: string, items: QuoteItemDto[]): Promise<any[]> {
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

  private async calculateTax(tenantId: string, customerId: string, subtotal: number): Promise<number> {
    // Placeholder tax calculation - would integrate with tax service
    const taxRate = 0.08; // 8% default tax rate
    return subtotal * taxRate;
  }

  private async calculateShipping(tenantId: string, customerId: string, items: any[]): Promise<number> {
    // Placeholder shipping calculation - would integrate with shipping service
    const totalWeight = items.reduce((sum, item) => sum + (item.quantity * 1), 0); // Assume 1 lb per item
    return Math.max(10, totalWeight * 0.5); // $10 minimum, $0.50 per lb
  }

  private async checkApprovalRequired(tenantId: string, customerId: string, totalAmount: number): Promise<boolean> {
    // Check if quote amount exceeds approval threshold
    const approvalThreshold = 25000; // $25,000 default threshold for quotes
    return totalAmount >= approvalThreshold;
  }

  private canUpdateQuote(status: string): boolean {
    const updatableStatuses = ['draft', 'pending_approval', 'approved'];
    return updatableStatuses.includes(status);
  }

  private mapToQuote(quoteRecord: any, quoteItemRecords: any[]): Quote {
    return {
      id: quoteRecord.id,
      tenantId: quoteRecord.tenantId,
      quoteNumber: quoteRecord.quoteNumber,
      customerId: quoteRecord.customerId,
      status: quoteRecord.status,
      quoteDate: quoteRecord.quoteDate,
      expirationDate: quoteRecord.expirationDate,
      validUntil: quoteRecord.validUntil,
      subtotal: parseFloat(quoteRecord.subtotal),
      taxAmount: parseFloat(quoteRecord.taxAmount),
      shippingAmount: parseFloat(quoteRecord.shippingAmount),
      discountAmount: parseFloat(quoteRecord.discountAmount),
      totalAmount: parseFloat(quoteRecord.totalAmount),
      paymentTerms: quoteRecord.paymentTerms,
      deliveryTerms: quoteRecord.deliveryTerms,
      termsAndConditions: quoteRecord.termsAndConditions,
      requiresApproval: quoteRecord.requiresApproval,
      approvedBy: quoteRecord.approvedBy,
      approvedAt: quoteRecord.approvedAt,
      approvalNotes: quoteRecord.approvalNotes,
      salesRepId: quoteRecord.salesRepId,
      accountManagerId: quoteRecord.accountManagerId,
      customerResponse: quoteRecord.customerResponse,
      customerResponseDate: quoteRecord.customerResponseDate,
      customerNotes: quoteRecord.customerNotes,
      convertedToOrderId: quoteRecord.convertedToOrderId,
      convertedAt: quoteRecord.convertedAt,
      specialInstructions: quoteRecord.specialInstructions,
      internalNotes: quoteRecord.internalNotes,
      items: quoteItemRecords.map(item => ({
        id: item.id,
        quoteId: item.quoteId,
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
        metadata: item.metadata || {},
      })),
      metadata: quoteRecord.metadata || {},
      createdAt: quoteRecord.createdAt,
      updatedAt: quoteRecord.updatedAt,
    };
  }

  private async invalidateQuoteCaches(tenantId: string, quoteId?: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`quotes:${tenantId}:*`);
      
      if (quoteId) {
        await this.cacheService.invalidatePattern(`quote:${tenantId}:${quoteId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate quote caches for tenant ${tenantId}:`, error);
    }
  }
}