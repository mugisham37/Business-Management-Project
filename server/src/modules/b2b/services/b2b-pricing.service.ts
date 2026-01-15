import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  customerPricingRules,
  contracts,
  b2bCustomers,
  products,
  customers
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, isNull } from 'drizzle-orm';

export interface PricingRule {
  id: string;
  ruleType: string;
  targetId?: string | null;
  targetType?: string | null;
  discountType: string;
  discountValue: number;
  minimumQuantity?: number | null;
  maximumQuantity?: number | null;
  minimumAmount?: number | null;
  effectiveDate: Date;
  expirationDate?: Date | null;
  priority: number;
  description?: string | null;
}

export interface CustomerPricing {
  customerId: string;
  productId: string;
  quantity: number;
  listPrice: number;
  customerPrice: number;
  discountPercentage: number;
  discountAmount: number;
  appliedRules: PricingRule[];
  pricingTier: string;
  contractPricing?: any;
}

@Injectable()
export class B2BPricingService {
  private readonly logger = new Logger(B2BPricingService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  async getCustomerPrice(
    tenantId: string,
    customerId: string,
    productId: string,
    quantity: number = 1
  ): Promise<number | null> {
    try {
      const cacheKey = `customer-price:${tenantId}:${customerId}:${productId}:${quantity}`;
      
      // Try cache first
      let customerPrice = await this.cacheService.get<number>(cacheKey);
      
      if (customerPrice === null || customerPrice === undefined) {
        // Get product base price
        const [product] = await this.drizzle.getDb()
          .select()
          .from(products)
          .where(and(
            eq(products.tenantId, tenantId),
            eq(products.id, productId),
            isNull(products.deletedAt)
          ));

        if (!product) {
          return null;
        }

        const listPrice = parseFloat(product.basePrice);

        // Get customer B2B info
        const [b2bCustomer] = await this.drizzle.getDb()
          .select()
          .from(b2bCustomers)
          .innerJoin(customers, eq(b2bCustomers.customerId, customers.id))
          .where(and(
            eq(b2bCustomers.tenantId, tenantId),
            eq(b2bCustomers.customerId, customerId),
            isNull(b2bCustomers.deletedAt)
          ));

        if (!b2bCustomer) {
          // Not a B2B customer, return list price
          return listPrice;
        }

        // Get applicable pricing rules
        const pricingRules = await this.getApplicablePricingRules(
          tenantId,
          customerId,
          productId,
          quantity,
          listPrice * quantity
        );

        // Calculate best price from all applicable rules
        customerPrice = this.calculateBestPrice(listPrice, quantity, pricingRules, b2bCustomer.b2b_customers);

        // Cache for 30 minutes
        await this.cacheService.set(cacheKey, customerPrice, { ttl: 1800 });
      }

      return customerPrice;
    } catch (error) {
      this.logger.error(`Failed to get customer price for ${customerId}/${productId}:`, error);
      return null;
    }
  }

  async getCustomerPricing(
    tenantId: string,
    customerId: string,
    productId: string,
    quantity: number = 1
  ): Promise<CustomerPricing | null> {
    try {
      // Get product base price
      const [product] = await this.drizzle.getDb()
        .select()
        .from(products)
        .where(and(
          eq(products.tenantId, tenantId),
          eq(products.id, productId),
          isNull(products.deletedAt)
        ));

      if (!product) {
        return null;
      }

      const listPrice = parseFloat(product.basePrice);

      // Get customer B2B info
      const [b2bCustomer] = await this.drizzle.getDb()
        .select()
        .from(b2bCustomers)
        .innerJoin(customers, eq(b2bCustomers.customerId, customers.id))
        .where(and(
          eq(b2bCustomers.tenantId, tenantId),
          eq(b2bCustomers.customerId, customerId),
          isNull(b2bCustomers.deletedAt)
        ));

      if (!b2bCustomer) {
        return null;
      }

      // Get applicable pricing rules
      const pricingRules = await this.getApplicablePricingRules(
        tenantId,
        customerId,
        productId,
        quantity,
        listPrice * quantity
      );

      // Calculate pricing
      const customerPrice = this.calculateBestPrice(listPrice, quantity, pricingRules, b2bCustomer.b2b_customers);
      const discountAmount = (listPrice - customerPrice) * quantity;
      const discountPercentage = listPrice > 0 ? ((listPrice - customerPrice) / listPrice) * 100 : 0;

      // Check for contract pricing
      const contractPricing = await this.getContractPricing(tenantId, customerId, productId);

      return {
        customerId,
        productId,
        quantity,
        listPrice,
        customerPrice,
        discountPercentage,
        discountAmount,
        appliedRules: pricingRules,
        pricingTier: b2bCustomer.b2b_customers.pricingTier,
        contractPricing,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer pricing for ${customerId}/${productId}:`, error);
      return null;
    }
  }

  async getBulkPricing(
    tenantId: string,
    customerId: string,
    items: Array<{ productId: string; quantity: number }>
  ): Promise<CustomerPricing[]> {
    try {
      const pricingResults = [];

      for (const item of items) {
        const pricing = await this.getCustomerPricing(
          tenantId,
          customerId,
          item.productId,
          item.quantity
        );
        
        if (pricing) {
          pricingResults.push(pricing);
        }
      }

      return pricingResults;
    } catch (error) {
      this.logger.error(`Failed to get bulk pricing for customer ${customerId}:`, error);
      return [];
    }
  }

  async createPricingRule(
    tenantId: string,
    customerId: string,
    ruleData: {
      ruleType: string;
      targetId?: string;
      targetType?: string;
      discountType: string;
      discountValue: number;
      minimumQuantity?: number;
      maximumQuantity?: number;
      minimumAmount?: number;
      effectiveDate?: Date;
      expirationDate?: Date;
      priority?: number;
      description?: string;
    },
    userId: string
  ): Promise<PricingRule> {
    try {
      const [pricingRule] = await this.drizzle.getDb()
        .insert(customerPricingRules)
        .values({
          tenantId,
          customerId,
          ruleType: ruleData.ruleType,
          targetId: ruleData.targetId || null,
          targetType: ruleData.targetType || null,
          discountType: ruleData.discountType,
          discountValue: ruleData.discountValue.toString(),
          minimumQuantity: ruleData.minimumQuantity || null,
          maximumQuantity: ruleData.maximumQuantity || null,
          minimumAmount: ruleData.minimumAmount?.toString() || null,
          effectiveDate: ruleData.effectiveDate || new Date(),
          expirationDate: ruleData.expirationDate || null,
          priority: ruleData.priority || 0,
          description: ruleData.description || null,
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!pricingRule) {
        throw new Error('Failed to create pricing rule');
      }

      // Clear pricing caches for this customer
      await this.invalidatePricingCaches(tenantId, customerId);

      return {
        id: pricingRule.id,
        ruleType: pricingRule.ruleType,
        targetId: pricingRule.targetId,
        targetType: pricingRule.targetType,
        discountType: pricingRule.discountType,
        discountValue: parseFloat(pricingRule.discountValue),
        minimumQuantity: pricingRule.minimumQuantity,
        maximumQuantity: pricingRule.maximumQuantity,
        minimumAmount: pricingRule.minimumAmount ? parseFloat(pricingRule.minimumAmount) : null,
        effectiveDate: pricingRule.effectiveDate,
        expirationDate: pricingRule.expirationDate,
        priority: pricingRule.priority,
        description: pricingRule.description,
      };
    } catch (error) {
      this.logger.error(`Failed to create pricing rule for customer ${customerId}:`, error);
      throw error;
    }
  }

  private async getApplicablePricingRules(
    tenantId: string,
    customerId: string,
    productId: string,
    quantity: number,
    totalAmount: number
  ): Promise<PricingRule[]> {
    const now = new Date();
    
    const conditions = [
      eq(customerPricingRules.tenantId, tenantId),
      eq(customerPricingRules.customerId, customerId),
      eq(customerPricingRules.isActive, true),
      isNull(customerPricingRules.deletedAt),
      lte(customerPricingRules.effectiveDate, now)
    ];

    // Add expiration date filter
    conditions.push(
      or(
        isNull(customerPricingRules.expirationDate),
        gte(customerPricingRules.expirationDate, now)
      )!
    );

    // Add target filters
    conditions.push(
      or(
        eq(customerPricingRules.targetType, 'all'),
        and(
          eq(customerPricingRules.targetType, 'product'),
          eq(customerPricingRules.targetId, productId)
        )!
      )!
    );

    const rules = await this.drizzle.getDb()
      .select()
      .from(customerPricingRules)
      .where(and(...conditions))
      .orderBy(desc(customerPricingRules.priority), desc(customerPricingRules.createdAt));

    // Filter rules by quantity and amount constraints
    const applicableRules = rules.filter(rule => {
      // Check minimum quantity
      if (rule.minimumQuantity && quantity < rule.minimumQuantity) {
        return false;
      }

      // Check maximum quantity
      if (rule.maximumQuantity && quantity > rule.maximumQuantity) {
        return false;
      }

      // Check minimum amount
      if (rule.minimumAmount && totalAmount < parseFloat(rule.minimumAmount)) {
        return false;
      }

      return true;
    });

    return applicableRules.map(rule => ({
      id: rule.id,
      ruleType: rule.ruleType,
      targetId: rule.targetId,
      targetType: rule.targetType,
      discountType: rule.discountType,
      discountValue: parseFloat(rule.discountValue),
      minimumQuantity: rule.minimumQuantity,
      maximumQuantity: rule.maximumQuantity,
      minimumAmount: rule.minimumAmount ? parseFloat(rule.minimumAmount) : null,
      effectiveDate: rule.effectiveDate,
      expirationDate: rule.expirationDate,
      priority: rule.priority,
      description: rule.description,
    }));
  }

  private calculateBestPrice(
    listPrice: number,
    quantity: number,
    pricingRules: PricingRule[],
    b2bCustomer: any
  ): number {
    let bestPrice = listPrice;

    // Apply tier-based discount first
    if (b2bCustomer.volumeDiscountPercentage) {
      const tierDiscount = parseFloat(b2bCustomer.volumeDiscountPercentage) / 100;
      bestPrice = listPrice * (1 - tierDiscount);
    }

    // Apply pricing rules (highest priority first)
    for (const rule of pricingRules) {
      let rulePrice = listPrice;

      switch (rule.discountType) {
        case 'percentage':
          rulePrice = listPrice * (1 - rule.discountValue / 100);
          break;
        case 'fixed_amount':
          rulePrice = listPrice - rule.discountValue;
          break;
        case 'fixed_price':
          rulePrice = rule.discountValue;
          break;
      }

      // Use the best (lowest) price
      if (rulePrice < bestPrice) {
        bestPrice = rulePrice;
      }
    }

    // Ensure price doesn't go below zero
    return Math.max(0, bestPrice);
  }

  private async getContractPricing(
    tenantId: string,
    customerId: string,
    productId: string
  ): Promise<any | null> {
    try {
      const now = new Date();
      
      const [activeContract] = await this.drizzle.getDb()
        .select()
        .from(contracts)
        .where(and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.customerId, customerId),
          eq(contracts.status, 'active'),
          lte(contracts.startDate, now),
          gte(contracts.endDate, now),
          isNull(contracts.deletedAt)
        ))
        .orderBy(desc(contracts.createdAt))
        .limit(1);

      if (!activeContract) {
        return null;
      }

      // Check if contract has pricing terms for this product
      const pricingTerms = activeContract.pricingTerms as any;
      if (pricingTerms && pricingTerms.products && pricingTerms.products[productId]) {
        return {
          contractId: activeContract.id,
          contractNumber: activeContract.contractNumber,
          pricingModel: activeContract.pricingModel,
          productPricing: pricingTerms.products[productId],
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get contract pricing for ${customerId}/${productId}:`, error);
      return null;
    }
  }

  private async invalidatePricingCaches(tenantId: string, customerId?: string): Promise<void> {
    try {
      if (customerId) {
        await this.cacheService.invalidatePattern(`customer-price:${tenantId}:${customerId}:*`);
      } else {
        await this.cacheService.invalidatePattern(`customer-price:${tenantId}:*`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate pricing caches for tenant ${tenantId}:`, error);
    }
  }
}