import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { CustomerRepository } from '../repositories/customer.repository';
import { CreateB2BCustomerDto, UpdateB2BCustomerDto, B2BCustomerQueryDto } from '../dto/b2b-customer.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  customers, 
  b2bCustomers, 
  customerPricingRules, 
  customerCreditHistory 
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, asc, sql, isNull, ilike, not } from 'drizzle-orm';

export interface B2BCustomer {
  id: string;
  tenantId: string;
  customerNumber: string;
  companyName: string;
  primaryContactFirstName?: string;
  primaryContactLastName?: string;
  primaryContactTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  dunsNumber?: string;
  creditLimit: number;
  paymentTermsType: string;
  customPaymentTermsDays?: number;
  earlyPaymentDiscountPercentage?: number;
  earlyPaymentDiscountDays?: number;
  creditStatus: string;
  pricingTier: string;
  volumeDiscountPercentage?: number;
  minimumOrderAmount?: number;
  salesRepId?: string;
  accountManagerId?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  contractStartDate?: Date;
  contractEndDate?: Date;
  contractValue?: number;
  autoRenewal: boolean;
  specialInstructions?: string;
  billingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  shippingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  b2bMetadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class B2BCustomerService {
  private readonly logger = new Logger(B2BCustomerService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly customerRepository: CustomerRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createB2BCustomer(tenantId: string, data: CreateB2BCustomerDto, userId: string): Promise<B2BCustomer> {
    try {
      // Validate B2B customer data
      await this.validateB2BCustomerData(tenantId, data);

      // Create base customer record
      const baseCustomer = await this.customerRepository.create(
        tenantId,
        {
          type: 'business' as any,
          companyName: data.companyName,
          firstName: data.primaryContactFirstName,
          lastName: data.primaryContactLastName,
          email: data.email,
          phone: data.phone,
          website: data.website,
          taxId: data.taxId,
          creditLimit: data.creditLimit,
          paymentTerms: this.convertPaymentTermsToDays(data.paymentTerms, data.customPaymentTermsDays),
          discountPercentage: data.volumeDiscountPercentage || 0,
          addressLine1: data.billingAddressLine1,
          addressLine2: data.billingAddressLine2,
          city: data.billingCity,
          state: data.billingState,
          postalCode: data.billingPostalCode,
          country: data.billingCountry,
        },
        userId
      );

      // Create B2B extension record
      const [b2bRecord] = await this.drizzle.getDb()
        .insert(b2bCustomers)
        .values({
          tenantId,
          customerId: baseCustomer.id,
          primaryContactFirstName: data.primaryContactFirstName,
          primaryContactLastName: data.primaryContactLastName,
          primaryContactTitle: data.primaryContactTitle,
          dunsNumber: data.dunsNumber,
          paymentTermsType: data.paymentTerms,
          customPaymentTermsDays: data.customPaymentTermsDays,
          earlyPaymentDiscountPercentage: data.earlyPaymentDiscountPercentage?.toString(),
          earlyPaymentDiscountDays: data.earlyPaymentDiscountDays,
          creditStatus: 'pending',
          pricingTier: data.pricingTier,
          volumeDiscountPercentage: data.volumeDiscountPercentage?.toString(),
          minimumOrderAmount: data.minimumOrderAmount?.toString(),
          salesRepId: data.salesRepId,
          accountManagerId: data.accountManagerId,
          industry: data.industry,
          employeeCount: data.employeeCount,
          annualRevenue: data.annualRevenue?.toString(),
          preferredCategories: data.preferredCategories || [],
          billingAddressLine1: data.billingAddressLine1,
          billingAddressLine2: data.billingAddressLine2,
          billingCity: data.billingCity,
          billingState: data.billingState,
          billingPostalCode: data.billingPostalCode,
          billingCountry: data.billingCountry,
          shippingAddressLine1: data.shippingAddressLine1,
          shippingAddressLine2: data.shippingAddressLine2,
          shippingCity: data.shippingCity,
          shippingState: data.shippingState,
          shippingPostalCode: data.shippingPostalCode,
          shippingCountry: data.shippingCountry,
          contractStartDate: data.contractStartDate ? new Date(data.contractStartDate) : null,
          contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
          specialInstructions: data.specialInstructions,
          b2bMetadata: data.b2bMetadata || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Create initial credit history record
      await this.drizzle.getDb()
        .insert(customerCreditHistory)
        .values({
          tenantId,
          customerId: baseCustomer.id,
          eventType: 'application',
          newCreditLimit: data.creditLimit.toString(),
          newStatus: 'pending',
          assessmentNotes: 'Initial B2B customer application',
          reviewedBy: userId,
          createdBy: userId,
          updatedBy: userId,
        });

      // Clear caches
      await this.invalidateB2BCaches(tenantId);

      // Emit event
      this.eventEmitter.emit('b2b-customer.created', {
        tenantId,
        customerId: baseCustomer.id,
        b2bCustomer: b2bRecord,
        userId,
      });

      this.logger.log(`Created B2B customer ${baseCustomer.id} for tenant ${tenantId}`);
      return this.mapToB2BCustomer(baseCustomer, b2bRecord);
    } catch (error) {
      this.logger.error(`Failed to create B2B customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findB2BCustomerById(tenantId: string, customerId: string): Promise<B2BCustomer> {
    try {
      const cacheKey = `b2b-customer:${tenantId}:${customerId}`;
      
      // Try cache first
      let b2bCustomer = await this.cacheService.get<B2BCustomer>(cacheKey);
      
      if (!b2bCustomer) {
        // Get base customer
        const baseCustomer = await this.customerRepository.findById(tenantId, customerId);
        if (!baseCustomer || baseCustomer.type !== 'business') {
          throw new NotFoundException(`B2B customer ${customerId} not found`);
        }

        // Get B2B extension
        const [b2bRecord] = await this.drizzle.getDb()
          .select()
          .from(b2bCustomers)
          .where(and(
            eq(b2bCustomers.tenantId, tenantId),
            eq(b2bCustomers.customerId, customerId),
            isNull(b2bCustomers.deletedAt)
          ));

        if (!b2bRecord) {
          throw new NotFoundException(`B2B customer extension for ${customerId} not found`);
        }

        b2bCustomer = this.mapToB2BCustomer(baseCustomer, b2bRecord);

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, b2bCustomer, { ttl: 600 });
      }

      return b2bCustomer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find B2B customer ${customerId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findB2BCustomers(tenantId: string, query: B2BCustomerQueryDto): Promise<{ customers: B2BCustomer[]; total: number }> {
    try {
      const cacheKey = `b2b-customers:${tenantId}:${JSON.stringify(query)}`;
      
      // Try cache first for common queries
      let result = await this.cacheService.get<{ customers: B2BCustomer[]; total: number }>(cacheKey);
      
      if (!result) {
        const conditions = [
          eq(customers.tenantId, tenantId),
          eq(customers.type, 'business'),
          isNull(customers.deletedAt),
          isNull(b2bCustomers.deletedAt)
        ];

        // Add search conditions
        if (query.search) {
          conditions.push(
            or(
              ilike(customers.companyName, `%${query.search}%`),
              ilike(b2bCustomers.primaryContactFirstName, `%${query.search}%`),
              ilike(b2bCustomers.primaryContactLastName, `%${query.search}%`),
              ilike(customers.email, `%${query.search}%`)
            )!
          );
        }

        // Add filter conditions
        if (query.creditStatus) {
          conditions.push(eq(b2bCustomers.creditStatus, query.creditStatus));
        }

        if (query.pricingTier) {
          conditions.push(eq(b2bCustomers.pricingTier, query.pricingTier));
        }

        if (query.paymentTerms) {
          conditions.push(eq(b2bCustomers.paymentTermsType, query.paymentTerms));
        }

        if (query.salesRepId) {
          conditions.push(eq(b2bCustomers.salesRepId, query.salesRepId));
        }

        if (query.accountManagerId) {
          conditions.push(eq(b2bCustomers.accountManagerId, query.accountManagerId));
        }

        if (query.industry) {
          conditions.push(ilike(b2bCustomers.industry, `%${query.industry}%`));
        }

        if (query.minCreditLimit !== undefined) {
          conditions.push(gte(customers.creditLimit, query.minCreditLimit.toString()));
        }

        if (query.maxCreditLimit !== undefined) {
          conditions.push(lte(customers.creditLimit, query.maxCreditLimit.toString()));
        }

        if (query.minAnnualRevenue !== undefined) {
          conditions.push(gte(b2bCustomers.annualRevenue, query.minAnnualRevenue.toString()));
        }

        if (query.maxAnnualRevenue !== undefined) {
          conditions.push(lte(b2bCustomers.annualRevenue, query.maxAnnualRevenue.toString()));
        }

        if (query.contractExpiringWithinDays !== undefined) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + query.contractExpiringWithinDays);
          conditions.push(
            and(
              not(isNull(b2bCustomers.contractEndDate)),
              lte(b2bCustomers.contractEndDate, futureDate)
            )!
          );
        }

        const whereClause = and(...conditions);

        // Get total count
        const [countResult] = await this.drizzle.getDb()
          .select({ count: sql<number>`count(*)` })
          .from(customers)
          .innerJoin(b2bCustomers, eq(customers.id, b2bCustomers.customerId))
          .where(whereClause);

        const total = countResult?.count || 0;

        // Get paginated results
        const offset = ((query.page || 1) - 1) * (query.limit || 20);
        const orderBy = query.sortOrder === 'asc' 
          ? asc(customers[query.sortBy as keyof typeof customers] || customers.companyName)
          : desc(customers[query.sortBy as keyof typeof customers] || customers.companyName);

        const results = await this.drizzle.getDb()
          .select()
          .from(customers)
          .innerJoin(b2bCustomers, eq(customers.id, b2bCustomers.customerId))
          .where(whereClause)
          .orderBy(orderBy)
          .limit(query.limit || 20)
          .offset(offset);

        const b2bCustomersList = results.map(row => 
          this.mapToB2BCustomer(row.customers, row.b2b_customers)
        );

        result = {
          customers: b2bCustomersList,
          total: total,
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, { ttl: 300 });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to find B2B customers for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateB2BCustomer(tenantId: string, customerId: string, data: UpdateB2BCustomerDto, userId: string): Promise<B2BCustomer> {
    try {
      // Check if B2B customer exists
      const existingCustomer = await this.findB2BCustomerById(tenantId, customerId);

      // Update base customer if needed
      const baseUpdateData: any = {};
      if (data.companyName) baseUpdateData.companyName = data.companyName;
      if (data.primaryContactFirstName) baseUpdateData.firstName = data.primaryContactFirstName;
      if (data.primaryContactLastName) baseUpdateData.lastName = data.primaryContactLastName;
      if (data.creditLimit !== undefined) baseUpdateData.creditLimit = data.creditLimit;

      if (Object.keys(baseUpdateData).length > 0) {
        await this.customerRepository.update(tenantId, customerId, baseUpdateData, userId);
      }

      // Update B2B extension
      const b2bUpdateData: any = { ...data, updatedBy: userId };
      
      // Convert decimal fields to strings
      if (data.creditLimit !== undefined) {
        b2bUpdateData.creditLimit = data.creditLimit.toString();
      }
      if (data.earlyPaymentDiscountPercentage !== undefined) {
        b2bUpdateData.earlyPaymentDiscountPercentage = data.earlyPaymentDiscountPercentage.toString();
      }
      if (data.volumeDiscountPercentage !== undefined) {
        b2bUpdateData.volumeDiscountPercentage = data.volumeDiscountPercentage.toString();
      }
      if (data.minimumOrderAmount !== undefined) {
        b2bUpdateData.minimumOrderAmount = data.minimumOrderAmount.toString();
      }
      if (data.annualRevenue !== undefined) {
        b2bUpdateData.annualRevenue = data.annualRevenue.toString();
      }

      // Convert date fields
      if (data.contractStartDate) {
        b2bUpdateData.contractStartDate = new Date(data.contractStartDate);
      }
      if (data.contractEndDate) {
        b2bUpdateData.contractEndDate = new Date(data.contractEndDate);
      }

      const [updatedB2BRecord] = await this.drizzle.getDb()
        .update(b2bCustomers)
        .set(b2bUpdateData)
        .where(and(
          eq(b2bCustomers.tenantId, tenantId),
          eq(b2bCustomers.customerId, customerId),
          isNull(b2bCustomers.deletedAt)
        ))
        .returning();

      if (!updatedB2BRecord) {
        throw new Error(`B2B customer ${customerId} not found for update`);
      }

      // Create credit history record if credit-related fields changed
      if (data.creditLimit !== undefined || data.creditStatus) {
        await this.drizzle.getDb()
          .insert(customerCreditHistory)
          .values({
            tenantId,
            customerId,
            eventType: data.creditStatus ? 'status_change' : 'limit_change',
            previousCreditLimit: existingCustomer.creditLimit.toString(),
            newCreditLimit: (data.creditLimit || existingCustomer.creditLimit).toString(),
            previousStatus: existingCustomer.creditStatus as any,
            newStatus: (data.creditStatus || existingCustomer.creditStatus) as any,
            assessmentNotes: `Updated by user ${userId}`,
            reviewedBy: userId,
            createdBy: userId,
            updatedBy: userId,
          });
      }

      // Clear caches
      await this.invalidateB2BCaches(tenantId, customerId);

      // Emit event
      this.eventEmitter.emit('b2b-customer.updated', {
        tenantId,
        customerId,
        previousData: existingCustomer,
        userId,
      });

      // Get updated customer
      const updatedBaseCustomer = await this.customerRepository.findById(tenantId, customerId);
      const updatedB2BCustomer = this.mapToB2BCustomer(updatedBaseCustomer, updatedB2BRecord);

      this.logger.log(`Updated B2B customer ${customerId} for tenant ${tenantId}`);
      return updatedB2BCustomer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update B2B customer ${customerId} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getCustomerPricing(tenantId: string, customerId: string, productId?: string, categoryId?: string): Promise<any[]> {
    try {
      const conditions = [
        eq(customerPricingRules.tenantId, tenantId),
        eq(customerPricingRules.customerId, customerId),
        eq(customerPricingRules.isActive, true),
        isNull(customerPricingRules.deletedAt)
      ];

      // Add current date filter
      const now = new Date();
      conditions.push(lte(customerPricingRules.effectiveDate, now));
      conditions.push(
        or(
          isNull(customerPricingRules.expirationDate),
          gte(customerPricingRules.expirationDate, now)
        )!
      );

      // Add target filters
      if (productId) {
        conditions.push(
          or(
            eq(customerPricingRules.targetType, 'all'),
            and(
              eq(customerPricingRules.targetType, 'product'),
              eq(customerPricingRules.targetId, productId)
            )!
          )!
        );
      }

      if (categoryId) {
        conditions.push(
          or(
            eq(customerPricingRules.targetType, 'all'),
            and(
              eq(customerPricingRules.targetType, 'category'),
              eq(customerPricingRules.targetId, categoryId)
            )!
          )!
        );
      }

      const pricingRules = await this.drizzle.getDb()
        .select()
        .from(customerPricingRules)
        .where(and(...conditions))
        .orderBy(desc(customerPricingRules.priority), desc(customerPricingRules.createdAt));

      return pricingRules.map(rule => ({
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
    } catch (error) {
      this.logger.error(`Failed to get customer pricing for ${customerId}:`, error);
      throw error;
    }
  }

  private async validateB2BCustomerData(tenantId: string, data: CreateB2BCustomerDto): Promise<void> {
    // Check for duplicate company name
    if (data.companyName) {
      const existing = await this.customerRepository.findMany(tenantId, {
        search: data.companyName,
        page: 1,
        limit: 1,
      });
      
      const duplicateCompany = existing.customers.find(c => 
        c.companyName?.toLowerCase() === data.companyName.toLowerCase()
      );
      
      if (duplicateCompany) {
        throw new ConflictException(`Company with name ${data.companyName} already exists`);
      }
    }

    // Validate credit limit
    if (data.creditLimit < 0) {
      throw new BadRequestException('Credit limit cannot be negative');
    }

    // Validate payment terms
    if (data.paymentTerms === 'custom' && !data.customPaymentTermsDays) {
      throw new BadRequestException('Custom payment terms days required when payment terms is custom');
    }

    // Validate early payment discount
    if (data.earlyPaymentDiscountPercentage && (data.earlyPaymentDiscountPercentage < 0 || data.earlyPaymentDiscountPercentage > 100)) {
      throw new BadRequestException('Early payment discount percentage must be between 0 and 100');
    }

    // Validate volume discount
    if (data.volumeDiscountPercentage && (data.volumeDiscountPercentage < 0 || data.volumeDiscountPercentage > 100)) {
      throw new BadRequestException('Volume discount percentage must be between 0 and 100');
    }

    // Validate contract dates
    if (data.contractStartDate && data.contractEndDate) {
      const start = new Date(data.contractStartDate);
      const end = new Date(data.contractEndDate);
      if (start >= end) {
        throw new BadRequestException('Contract end date must be after start date');
      }
    }
  }

  private convertPaymentTermsToDays(paymentTerms: string, customDays?: number): number {
    switch (paymentTerms) {
      case 'net_15': return 15;
      case 'net_30': return 30;
      case 'net_45': return 45;
      case 'net_60': return 60;
      case 'net_90': return 90;
      case 'cod': return 0;
      case 'prepaid': return -1;
      case 'custom': return customDays || 30;
      default: return 30;
    }
  }

  private mapToB2BCustomer(baseCustomer: any, b2bRecord: any): B2BCustomer {
    return {
      id: baseCustomer.id,
      tenantId: baseCustomer.tenantId,
      customerNumber: baseCustomer.customerNumber,
      companyName: baseCustomer.companyName,
      primaryContactFirstName: b2bRecord.primaryContactFirstName,
      primaryContactLastName: b2bRecord.primaryContactLastName,
      primaryContactTitle: b2bRecord.primaryContactTitle,
      email: baseCustomer.email,
      phone: baseCustomer.phone,
      website: baseCustomer.website,
      taxId: baseCustomer.taxId,
      dunsNumber: b2bRecord.dunsNumber,
      creditLimit: baseCustomer.creditLimit,
      paymentTermsType: b2bRecord.paymentTermsType,
      customPaymentTermsDays: b2bRecord.customPaymentTermsDays,
      earlyPaymentDiscountPercentage: b2bRecord.earlyPaymentDiscountPercentage ? parseFloat(b2bRecord.earlyPaymentDiscountPercentage) : undefined,
      earlyPaymentDiscountDays: b2bRecord.earlyPaymentDiscountDays,
      creditStatus: b2bRecord.creditStatus,
      pricingTier: b2bRecord.pricingTier,
      volumeDiscountPercentage: b2bRecord.volumeDiscountPercentage ? parseFloat(b2bRecord.volumeDiscountPercentage) : undefined,
      minimumOrderAmount: b2bRecord.minimumOrderAmount ? parseFloat(b2bRecord.minimumOrderAmount) : undefined,
      salesRepId: b2bRecord.salesRepId,
      accountManagerId: b2bRecord.accountManagerId,
      industry: b2bRecord.industry,
      employeeCount: b2bRecord.employeeCount,
      annualRevenue: b2bRecord.annualRevenue ? parseFloat(b2bRecord.annualRevenue) : undefined,
      contractStartDate: b2bRecord.contractStartDate,
      contractEndDate: b2bRecord.contractEndDate,
      contractValue: b2bRecord.contractValue ? parseFloat(b2bRecord.contractValue) : undefined,
      autoRenewal: b2bRecord.autoRenewal,
      specialInstructions: b2bRecord.specialInstructions,
      billingAddress: {
        line1: b2bRecord.billingAddressLine1,
        line2: b2bRecord.billingAddressLine2,
        city: b2bRecord.billingCity,
        state: b2bRecord.billingState,
        postalCode: b2bRecord.billingPostalCode,
        country: b2bRecord.billingCountry,
      },
      shippingAddress: {
        line1: b2bRecord.shippingAddressLine1,
        line2: b2bRecord.shippingAddressLine2,
        city: b2bRecord.shippingCity,
        state: b2bRecord.shippingState,
        postalCode: b2bRecord.shippingPostalCode,
        country: b2bRecord.shippingCountry,
      },
      b2bMetadata: b2bRecord.b2bMetadata || {},
      createdAt: baseCustomer.createdAt,
      updatedAt: baseCustomer.updatedAt,
    };
  }

  private async invalidateB2BCaches(tenantId: string, customerId?: string): Promise<void> {
    try {
      await this.cacheService.invalidatePattern(`b2b-customers:${tenantId}:*`);
      
      if (customerId) {
        await this.cacheService.invalidatePattern(`b2b-customer:${tenantId}:${customerId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate B2B caches for tenant ${tenantId}:`, error);
    }
  }
}