import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { customers, customerSegments, customerSegmentMemberships, customerCommunications, customerPreferences } from '../../database/schema';
import { eq, and, or, like, ilike, gte, lte, desc, asc, sql, inArray, isNull, isNotNull } from 'drizzle-orm';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from '../dto/customer.dto';
import { Customer } from '../entities/customer.entity';

@Injectable()
export class CustomerRepository {
  private readonly logger = new Logger(CustomerRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, data: CreateCustomerDto, userId: string): Promise<Customer> {
    try {
      // Generate customer number
      const customerNumber = await this.generateCustomerNumber(tenantId);

      // Calculate display name
      const displayName = this.calculateDisplayName(data);

      const [customer] = await this.drizzle.db
        .insert(customers)
        .values({
          tenantId,
          customerNumber,
          displayName,
          createdBy: userId,
          updatedBy: userId,
          ...data,
          // Set defaults
          status: 'active',
          loyaltyTier: 'bronze',
          loyaltyPoints: 0,
          loyaltyPointsLifetime: 0,
          totalSpent: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          lifetimeValue: 0,
          predictedLifetimeValue: 0,
          creditLimit: data.creditLimit || 0,
          paymentTerms: data.paymentTerms || 0,
          discountPercentage: data.discountPercentage || 0,
          marketingOptIn: data.marketingOptIn || false,
          emailOptIn: data.emailOptIn || false,
          smsOptIn: data.smsOptIn || false,
          tags: data.tags || [],
          customFields: data.customFields || {},
          preferences: data.preferences || {},
          socialProfiles: data.socialProfiles || {},
        })
        .returning();

      this.logger.log(`Created customer ${customer.id} for tenant ${tenantId}`);
      return this.mapToEntity(customer);
    } catch (error) {
      this.logger.error(`Failed to create customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Customer | null> {
    try {
      const [customer] = await this.drizzle.db
        .select()
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, id),
          isNull(customers.deletedAt)
        ));

      return customer ? this.mapToEntity(customer) : null;
    } catch (error) {
      this.logger.error(`Failed to find customer ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findByEmail(tenantId: string, email: string): Promise<Customer | null> {
    try {
      const [customer] = await this.drizzle.db
        .select()
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.email, email),
          isNull(customers.deletedAt)
        ));

      return customer ? this.mapToEntity(customer) : null;
    } catch (error) {
      this.logger.error(`Failed to find customer by email ${email} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findByPhone(tenantId: string, phone: string): Promise<Customer | null> {
    try {
      const [customer] = await this.drizzle.db
        .select()
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          or(
            eq(customers.phone, phone),
            eq(customers.alternatePhone, phone)
          ),
          isNull(customers.deletedAt)
        ));

      return customer ? this.mapToEntity(customer) : null;
    } catch (error) {
      this.logger.error(`Failed to find customer by phone ${phone} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findMany(tenantId: string, query: CustomerQueryDto): Promise<{ customers: Customer[]; total: number }> {
    try {
      const conditions = [
        eq(customers.tenantId, tenantId),
        isNull(customers.deletedAt)
      ];

      // Add search conditions
      if (query.search) {
        conditions.push(
          or(
            ilike(customers.firstName, `%${query.search}%`),
            ilike(customers.lastName, `%${query.search}%`),
            ilike(customers.displayName, `%${query.search}%`),
            ilike(customers.companyName, `%${query.search}%`),
            ilike(customers.email, `%${query.search}%`),
            ilike(customers.phone, `%${query.search}%`),
            ilike(customers.customerNumber, `%${query.search}%`)
          )
        );
      }

      // Add filter conditions
      if (query.type) {
        conditions.push(eq(customers.type, query.type));
      }

      if (query.status) {
        conditions.push(eq(customers.status, query.status));
      }

      if (query.loyaltyTier) {
        conditions.push(eq(customers.loyaltyTier, query.loyaltyTier));
      }

      if (query.city) {
        conditions.push(ilike(customers.city, `%${query.city}%`));
      }

      if (query.state) {
        conditions.push(ilike(customers.state, `%${query.state}%`));
      }

      if (query.country) {
        conditions.push(ilike(customers.country, `%${query.country}%`));
      }

      if (query.minTotalSpent !== undefined) {
        conditions.push(gte(customers.totalSpent, query.minTotalSpent.toString()));
      }

      if (query.maxTotalSpent !== undefined) {
        conditions.push(lte(customers.totalSpent, query.maxTotalSpent.toString()));
      }

      if (query.minChurnRisk !== undefined) {
        conditions.push(gte(customers.churnRisk, query.minChurnRisk.toString()));
      }

      if (query.maxChurnRisk !== undefined) {
        conditions.push(lte(customers.churnRisk, query.maxChurnRisk.toString()));
      }

      if (query.createdAfter) {
        conditions.push(gte(customers.createdAt, new Date(query.createdAfter)));
      }

      if (query.createdBefore) {
        conditions.push(lte(customers.createdAt, new Date(query.createdBefore)));
      }

      if (query.lastPurchaseAfter) {
        conditions.push(gte(customers.lastPurchaseDate, new Date(query.lastPurchaseAfter)));
      }

      if (query.lastPurchaseBefore) {
        conditions.push(lte(customers.lastPurchaseDate, new Date(query.lastPurchaseBefore)));
      }

      // Handle tags filter
      if (query.tags && query.tags.length > 0) {
        conditions.push(
          sql`${customers.tags} @> ${JSON.stringify(query.tags)}`
        );
      }

      const whereClause = and(...conditions);

      // Get total count
      const [{ count }] = await this.drizzle.db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(whereClause);

      // Get paginated results
      const offset = (query.page - 1) * query.limit;
      const orderBy = query.sortOrder === 'asc' 
        ? asc(customers[query.sortBy as keyof typeof customers] || customers.createdAt)
        : desc(customers[query.sortBy as keyof typeof customers] || customers.createdAt);

      const results = await this.drizzle.db
        .select()
        .from(customers)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset);

      return {
        customers: results.map(customer => this.mapToEntity(customer)),
        total: count,
      };
    } catch (error) {
      this.logger.error(`Failed to find customers for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: UpdateCustomerDto, userId: string): Promise<Customer> {
    try {
      // Calculate display name if name fields are being updated
      const updateData: any = { ...data, updatedBy: userId };
      if (data.firstName || data.lastName || data.companyName) {
        updateData.displayName = this.calculateDisplayName({
          ...data,
          type: data.type || 'individual', // Default type for display name calculation
        });
      }

      const [customer] = await this.drizzle.db
        .update(customers)
        .set(updateData)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, id),
          isNull(customers.deletedAt)
        ))
        .returning();

      if (!customer) {
        throw new Error(`Customer ${id} not found`);
      }

      this.logger.log(`Updated customer ${id} for tenant ${tenantId}`);
      return this.mapToEntity(customer);
    } catch (error) {
      this.logger.error(`Failed to update customer ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    try {
      await this.drizzle.db
        .update(customers)
        .set({
          deletedAt: new Date(),
          updatedBy: userId,
        })
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, id),
          isNull(customers.deletedAt)
        ));

      this.logger.log(`Deleted customer ${id} for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to delete customer ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updatePurchaseStats(
    tenantId: string, 
    customerId: string, 
    orderValue: number, 
    orderDate: Date
  ): Promise<void> {
    try {
      // Get current customer data
      const customer = await this.findById(tenantId, customerId);
      if (!customer) {
        throw new Error(`Customer ${customerId} not found`);
      }

      // Calculate new stats
      const newTotalOrders = customer.totalOrders + 1;
      const newTotalSpent = customer.totalSpent + orderValue;
      const newAverageOrderValue = newTotalSpent / newTotalOrders;

      // Update first purchase date if this is the first purchase
      const updateData: any = {
        totalOrders: newTotalOrders,
        totalSpent: newTotalSpent,
        averageOrderValue: newAverageOrderValue,
        lastPurchaseDate: orderDate,
      };

      if (!customer.firstPurchaseDate) {
        updateData.firstPurchaseDate = orderDate;
      }

      await this.drizzle.db
        .update(customers)
        .set(updateData)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, customerId)
        ));

      this.logger.log(`Updated purchase stats for customer ${customerId}`);
    } catch (error) {
      this.logger.error(`Failed to update purchase stats for customer ${customerId}:`, error);
      throw error;
    }
  }

  async updateLoyaltyPoints(tenantId: string, customerId: string, pointsChange: number): Promise<void> {
    try {
      const customer = await this.findById(tenantId, customerId);
      if (!customer) {
        throw new Error(`Customer ${customerId} not found`);
      }

      const newPoints = Math.max(0, customer.loyaltyPoints + pointsChange);
      const newLifetimePoints = pointsChange > 0 
        ? customer.loyaltyPointsLifetime + pointsChange 
        : customer.loyaltyPointsLifetime;

      // Calculate new loyalty tier based on lifetime points
      const newTier = this.calculateLoyaltyTier(newLifetimePoints);

      await this.drizzle.db
        .update(customers)
        .set({
          loyaltyPoints: newPoints,
          loyaltyPointsLifetime: newLifetimePoints,
          loyaltyTier: newTier,
        })
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, customerId)
        ));

      this.logger.log(`Updated loyalty points for customer ${customerId}: ${pointsChange} points`);
    } catch (error) {
      this.logger.error(`Failed to update loyalty points for customer ${customerId}:`, error);
      throw error;
    }
  }

  private async generateCustomerNumber(tenantId: string): Promise<string> {
    // Get the count of existing customers for this tenant
    const [{ count }] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    // Generate customer number with prefix and zero-padded number
    const customerNumber = `CUST-${String(count + 1).padStart(6, '0')}`;
    
    // Check if this number already exists (unlikely but possible)
    const existing = await this.drizzle.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        eq(customers.customerNumber, customerNumber)
      ));

    if (existing.length > 0) {
      // If it exists, use timestamp to make it unique
      return `CUST-${Date.now()}`;
    }

    return customerNumber;
  }

  private calculateDisplayName(data: Partial<CreateCustomerDto | UpdateCustomerDto>): string {
    if (data.type === 'business' && data.companyName) {
      return data.companyName;
    }

    if (data.firstName && data.lastName) {
      return `${data.firstName} ${data.lastName}`;
    }

    if (data.firstName) {
      return data.firstName;
    }

    if (data.lastName) {
      return data.lastName;
    }

    if (data.companyName) {
      return data.companyName;
    }

    return 'Unknown Customer';
  }

  private calculateLoyaltyTier(lifetimePoints: number): string {
    if (lifetimePoints >= 10000) return 'diamond';
    if (lifetimePoints >= 5000) return 'platinum';
    if (lifetimePoints >= 2000) return 'gold';
    if (lifetimePoints >= 500) return 'silver';
    return 'bronze';
  }

  private mapToEntity(customer: any): Customer {
    return {
      id: customer.id,
      tenantId: customer.tenantId,
      customerNumber: customer.customerNumber,
      type: customer.type,
      status: customer.status,
      firstName: customer.firstName,
      lastName: customer.lastName,
      displayName: customer.displayName,
      companyName: customer.companyName,
      email: customer.email,
      phone: customer.phone,
      alternatePhone: customer.alternatePhone,
      website: customer.website,
      addressLine1: customer.addressLine1,
      addressLine2: customer.addressLine2,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postalCode,
      country: customer.country,
      taxId: customer.taxId,
      creditLimit: parseFloat(customer.creditLimit || '0'),
      paymentTerms: customer.paymentTerms,
      discountPercentage: parseFloat(customer.discountPercentage || '0'),
      loyaltyTier: customer.loyaltyTier,
      loyaltyPoints: customer.loyaltyPoints,
      loyaltyPointsLifetime: customer.loyaltyPointsLifetime,
      totalSpent: parseFloat(customer.totalSpent || '0'),
      totalOrders: customer.totalOrders,
      averageOrderValue: parseFloat(customer.averageOrderValue || '0'),
      lastPurchaseDate: customer.lastPurchaseDate,
      firstPurchaseDate: customer.firstPurchaseDate,
      lifetimeValue: parseFloat(customer.lifetimeValue || '0'),
      predictedLifetimeValue: parseFloat(customer.predictedLifetimeValue || '0'),
      churnRisk: customer.churnRisk ? parseFloat(customer.churnRisk) : null,
      marketingOptIn: customer.marketingOptIn,
      emailOptIn: customer.emailOptIn,
      smsOptIn: customer.smsOptIn,
      tags: customer.tags || [],
      notes: customer.notes,
      referralCode: customer.referralCode,
      dateOfBirth: customer.dateOfBirth,
      anniversary: customer.anniversary,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      deletedAt: customer.deletedAt,
    };
  }
}