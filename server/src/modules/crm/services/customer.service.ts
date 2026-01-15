import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CustomerRepository } from '../repositories/customer.repository';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from '../dto/customer.dto';
import { Customer } from '../entities/customer.entity';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, data: CreateCustomerDto, userId: string): Promise<Customer> {
    try {
      // Validate business rules
      await this.validateCustomerData(tenantId, data);

      // Create customer
      const customer = await this.customerRepository.create(tenantId, data, userId);

      // Clear relevant caches
      await this.invalidateCustomerCaches(tenantId);

      // Emit customer created event
      this.eventEmitter.emit('customer.created', {
        tenantId,
        customerId: customer.id,
        customer,
        userId,
      });

      this.logger.log(`Created customer ${customer.id} for tenant ${tenantId}`);
      return customer;
    } catch (error) {
      this.logger.error(`Failed to create customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Customer> {
    try {
      const cacheKey = `customer:${tenantId}:${id}`;
      
      // Try cache first
      let customer = await this.cacheService.get<Customer>(cacheKey);
      
      if (!customer) {
        customer = await this.customerRepository.findById(tenantId, id);
        
        if (!customer) {
          throw new NotFoundException(`Customer ${id} not found`);
        }

        await this.cacheService.set(cacheKey, customer, { ttl: 300, tenantId });
      }

      return customer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to find customer ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findByEmail(tenantId: string, email: string): Promise<Customer | null> {
    try {
      const cacheKey = `customer:email:${tenantId}:${email}`;
      
      // Try cache first
      let customer = await this.cacheService.get<Customer>(cacheKey);
      
      if (customer === undefined) {
        customer = await this.customerRepository.findByEmail(tenantId, email);
        
        // Cache for 5 minutes (including null results)
        await this.cacheService.set(cacheKey, customer, { ttl: 300, tenantId });
      }

      return customer;
    } catch (error) {
      this.logger.error(`Failed to find customer by email ${email} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findByPhone(tenantId: string, phone: string): Promise<Customer | null> {
    try {
      const cacheKey = `customer:phone:${tenantId}:${phone}`;
      
      // Try cache first
      let customer = await this.cacheService.get<Customer>(cacheKey);
      
      if (customer === undefined) {
        customer = await this.customerRepository.findByPhone(tenantId, phone);
        
        // Cache for 5 minutes (including null results)
        await this.cacheService.set(cacheKey, customer, { ttl: 300, tenantId });
      }

      return customer;
    } catch (error) {
      this.logger.error(`Failed to find customer by phone ${phone} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async findMany(tenantId: string, query: CustomerQueryDto): Promise<{ customers: Customer[]; total: number }> {
    try {
      const cacheKey = `customers:${tenantId}:${JSON.stringify(query)}`;
      
      // Try cache first for common queries
      let result = await this.cacheService.get<{ customers: Customer[]; total: number }>(cacheKey);
      
      if (!result) {
        result = await this.customerRepository.findMany(tenantId, query);
        
        // Cache for 2 minutes
        await this.cacheService.set(cacheKey, result, { ttl: 120, tenantId });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to find customers for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: UpdateCustomerDto, userId: string): Promise<Customer> {
    try {
      // Check if customer exists
      const existingCustomer = await this.findById(tenantId, id);

      // Validate business rules for updates
      await this.validateCustomerUpdateData(tenantId, id, data);

      // Update customer
      const customer = await this.customerRepository.update(tenantId, id, data, userId);

      // Clear relevant caches
      await this.invalidateCustomerCaches(tenantId, id);

      // Emit customer updated event
      this.eventEmitter.emit('customer.updated', {
        tenantId,
        customerId: id,
        customer,
        previousData: existingCustomer,
        userId,
      });

      this.logger.log(`Updated customer ${id} for tenant ${tenantId}`);
      return customer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update customer ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    try {
      // Check if customer exists
      const customer = await this.findById(tenantId, id);

      // Soft delete customer
      await this.customerRepository.delete(tenantId, id, userId);

      // Clear relevant caches
      await this.invalidateCustomerCaches(tenantId, id);

      // Emit customer deleted event
      this.eventEmitter.emit('customer.deleted', {
        tenantId,
        customerId: id,
        customer,
        userId,
      });

      this.logger.log(`Deleted customer ${id} for tenant ${tenantId}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete customer ${id} for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updatePurchaseStats(tenantId: string, customerId: string, orderValue: number, orderDate: Date): Promise<void> {
    try {
      await this.customerRepository.updatePurchaseStats(tenantId, customerId, orderValue, orderDate);

      // Clear customer cache
      await this.invalidateCustomerCaches(tenantId, customerId);

      // Emit purchase stats updated event
      this.eventEmitter.emit('customer.purchase-stats.updated', {
        tenantId,
        customerId,
        orderValue,
        orderDate,
      });

      this.logger.log(`Updated purchase stats for customer ${customerId}: $${orderValue}`);
    } catch (error) {
      this.logger.error(`Failed to update purchase stats for customer ${customerId}:`, error);
      throw error;
    }
  }

  async updateLoyaltyPoints(tenantId: string, customerId: string, pointsChange: number, reason: string): Promise<void> {
    try {
      await this.customerRepository.updateLoyaltyPoints(tenantId, customerId, pointsChange);

      // Clear customer cache
      await this.invalidateCustomerCaches(tenantId, customerId);

      // Emit loyalty points updated event
      this.eventEmitter.emit('customer.loyalty-points.updated', {
        tenantId,
        customerId,
        pointsChange,
        reason,
      });

      this.logger.log(`Updated loyalty points for customer ${customerId}: ${pointsChange} points (${reason})`);
    } catch (error) {
      this.logger.error(`Failed to update loyalty points for customer ${customerId}:`, error);
      throw error;
    }
  }

  async getCustomerStats(tenantId: string): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    newCustomersThisMonth: number;
    averageLifetimeValue: number;
    topLoyaltyTier: { tier: string; count: number };
  }> {
    try {
      const cacheKey = `customer-stats:${tenantId}`;
      
      // Try cache first
      let stats = await this.cacheService.get<any>(cacheKey);
      
      if (!stats) {
        // Calculate stats from repository
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const [allCustomers, newCustomers] = await Promise.all([
          this.customerRepository.findMany(tenantId, { page: 1, limit: 1000000 }),
          this.customerRepository.findMany(tenantId, { 
            createdAfter: currentMonth.toISOString(),
            page: 1, 
            limit: 1000000 
          }),
        ]);

        const activeCustomers = allCustomers.customers.filter(c => c.status === 'active');
        const totalLifetimeValue = activeCustomers.reduce((sum, c) => sum + c.lifetimeValue, 0);
        const averageLifetimeValue = activeCustomers.length > 0 ? totalLifetimeValue / activeCustomers.length : 0;

        // Calculate top loyalty tier
        const tierCounts = activeCustomers.reduce((acc, c) => {
          acc[c.loyaltyTier] = (acc[c.loyaltyTier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topTier = Object.entries(tierCounts).reduce((max, [tier, count]) => 
          count > max.count ? { tier, count } : max, 
          { tier: 'bronze', count: 0 }
        );

        stats = {
          totalCustomers: allCustomers.total,
          activeCustomers: activeCustomers.length,
          newCustomersThisMonth: newCustomers.total,
          averageLifetimeValue,
          topLoyaltyTier: topTier,
        };

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, stats, { ttl: 600, tenantId });
      }

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get customer stats for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  private async validateCustomerData(tenantId: string, data: CreateCustomerDto): Promise<void> {
    // Check for duplicate email
    if (data.email) {
      const existingByEmail = await this.customerRepository.findByEmail(tenantId, data.email);
      if (existingByEmail) {
        throw new ConflictException(`Customer with email ${data.email} already exists`);
      }
    }

    // Check for duplicate phone
    if (data.phone) {
      const existingByPhone = await this.customerRepository.findByPhone(tenantId, data.phone);
      if (existingByPhone) {
        throw new ConflictException(`Customer with phone ${data.phone} already exists`);
      }
    }

    // Validate business customer requirements
    if (data.type === 'business' && !data.companyName) {
      throw new BadRequestException('Company name is required for business customers');
    }

    // Validate individual customer requirements
    if (data.type === 'individual' && !data.firstName && !data.lastName) {
      throw new BadRequestException('First name or last name is required for individual customers');
    }

    // Validate credit limit for business customers
    if (data.type === 'business' && data.creditLimit && data.creditLimit < 0) {
      throw new BadRequestException('Credit limit cannot be negative');
    }

    // Validate payment terms
    if (data.paymentTerms && (data.paymentTerms < 0 || data.paymentTerms > 365)) {
      throw new BadRequestException('Payment terms must be between 0 and 365 days');
    }

    // Validate discount percentage
    if (data.discountPercentage && (data.discountPercentage < 0 || data.discountPercentage > 100)) {
      throw new BadRequestException('Discount percentage must be between 0 and 100');
    }
  }

  private async validateCustomerUpdateData(tenantId: string, customerId: string, data: UpdateCustomerDto): Promise<void> {
    // Check for duplicate email (excluding current customer)
    if (data.email) {
      const existingByEmail = await this.customerRepository.findByEmail(tenantId, data.email);
      if (existingByEmail && existingByEmail.id !== customerId) {
        throw new ConflictException(`Customer with email ${data.email} already exists`);
      }
    }

    // Check for duplicate phone (excluding current customer)
    if (data.phone) {
      const existingByPhone = await this.customerRepository.findByPhone(tenantId, data.phone);
      if (existingByPhone && existingByPhone.id !== customerId) {
        throw new ConflictException(`Customer with phone ${data.phone} already exists`);
      }
    }

    // Validate business customer requirements
    if (data.type === 'business' && data.companyName === '') {
      throw new BadRequestException('Company name cannot be empty for business customers');
    }

    // Validate credit limit
    if (data.creditLimit !== undefined && data.creditLimit < 0) {
      throw new BadRequestException('Credit limit cannot be negative');
    }

    // Validate payment terms
    if (data.paymentTerms !== undefined && (data.paymentTerms < 0 || data.paymentTerms > 365)) {
      throw new BadRequestException('Payment terms must be between 0 and 365 days');
    }

    // Validate discount percentage
    if (data.discountPercentage !== undefined && (data.discountPercentage < 0 || data.discountPercentage > 100)) {
      throw new BadRequestException('Discount percentage must be between 0 and 100');
    }
  }

  private async invalidateCustomerCaches(tenantId: string, customerId?: string): Promise<void> {
    try {
      // Invalidate general customer caches
      await this.cacheService.invalidatePattern(`customers:${tenantId}:*`);
      await this.cacheService.invalidatePattern(`customer-stats:${tenantId}`);

      // Invalidate specific customer caches
      if (customerId) {
        await this.cacheService.invalidatePattern(`customer:${tenantId}:${customerId}`);
        
        // Also invalidate email and phone caches (we don't know the values, so invalidate all)
        await this.cacheService.invalidatePattern(`customer:email:${tenantId}:*`);
        await this.cacheService.invalidatePattern(`customer:phone:${tenantId}:*`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate customer caches for tenant ${tenantId}:`, error);
    }
  }
}