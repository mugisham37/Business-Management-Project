import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { 
  customers,
  b2bCustomers,
  products,
  inventoryLevels
} from '../../database/schema';
import { eq, and, or, gte, lte, desc, asc, sql, isNull, ilike, inArray } from 'drizzle-orm';
import { 
  CustomerPortalLoginDto, 
  CustomerPortalRegistrationDto, 
  CreatePortalOrderDto, 
  PortalOrderQueryDto,
  ProductCatalogQueryDto,
  UpdateAccountInfoDto,
  ChangePasswordDto
} from '../dto/customer-portal.dto';
import { B2BOrderService } from './b2b-order.service';
import { B2BPricingService } from './b2b-pricing.service';

export interface PortalCustomer {
  id: string;
  tenantId: string;
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  creditLimit: number;
  availableCredit: number;
  paymentTerms: string;
  pricingTier: string;
  billingAddress: any;
  shippingAddress: any;
  accountManagerId?: string;
  salesRepId?: string;
}

export interface PortalProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  customerPrice: number;
  discountPercentage: number;
  availableQuantity: number;
  minimumOrderQuantity: number;
  images: string[];
  specifications: Record<string, any>;
}

export interface PortalOrder {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  confirmedDeliveryDate?: Date;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  trackingNumber?: string;
  items: PortalOrderItem[];
}

export interface PortalOrderItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  quantityShipped: number;
}

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
    private readonly b2bOrderService: B2BOrderService,
    private readonly pricingService: B2BPricingService,
  ) {}

  async login(tenantId: string, loginDto: CustomerPortalLoginDto): Promise<{ customer: PortalCustomer; accessToken: string }> {
    try {
      // Find customer by email
      const [customerRecord] = await this.drizzle.getDb()
        .select({
          customer: customers,
          b2bCustomer: b2bCustomers,
        })
        .from(customers)
        .innerJoin(b2bCustomers, eq(customers.id, b2bCustomers.customerId))
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.email, loginDto.email),
          eq(customers.type, 'business'),
          isNull(customers.deletedAt),
          isNull(b2bCustomers.deletedAt)
        ));

      if (!customerRecord) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Verify password (assuming password is stored in b2bCustomer metadata)
      const b2bMetadata = customerRecord.b2bCustomer.b2bMetadata as any;
      const storedPasswordHash = b2bMetadata?.passwordHash;
      if (!storedPasswordHash || !await bcrypt.compare(loginDto.password, storedPasswordHash)) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Generate JWT token
      const payload = {
        sub: customerRecord.customer.id,
        email: customerRecord.customer.email,
        tenantId: customerRecord.customer.tenantId,
        type: 'customer_portal',
      };

      const accessToken = this.jwtService.sign(payload);

      // Map to portal customer
      const portalCustomer = await this.mapToPortalCustomer(customerRecord.customer, customerRecord.b2bCustomer);

      // Log successful login
      this.eventEmitter.emit('customer-portal.login', {
        tenantId,
        customerId: customerRecord.customer.id,
        email: loginDto.email,
      });

      return {
        customer: portalCustomer,
        accessToken,
      };
    } catch (error) {
      this.logger.error(`Failed to login customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async register(tenantId: string, registrationDto: CustomerPortalRegistrationDto): Promise<{ customer: PortalCustomer; accessToken: string }> {
    try {
      // Check if email already exists
      const existingCustomers = await this.drizzle.getDb()
        .select()
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.email, registrationDto.email),
          isNull(customers.deletedAt)
        ))
        .limit(1);

      if (existingCustomers.length > 0) {
        throw new BadRequestException('Email address already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(registrationDto.password, 10);

      // Create base customer record
      const customerRecords = await this.drizzle.getDb()
        .insert(customers)
        .values({
          tenantId,
          type: 'business',
          companyName: registrationDto.companyName,
          firstName: registrationDto.firstName,
          lastName: registrationDto.lastName,
          email: registrationDto.email,
          phone: registrationDto.phone,
          taxId: registrationDto.taxId,
          industry: registrationDto.industry,
          billingAddress: {
            line1: registrationDto.billingAddressLine1,
            city: registrationDto.billingCity,
            state: registrationDto.billingState,
            postalCode: registrationDto.billingPostalCode,
            country: registrationDto.billingCountry,
          },
          shippingAddress: {
            line1: registrationDto.billingAddressLine1, // Default to billing address
            city: registrationDto.billingCity,
            state: registrationDto.billingState,
            postalCode: registrationDto.billingPostalCode,
            country: registrationDto.billingCountry,
          },
          metadata: {},
          createdBy: 'portal_registration',
          updatedBy: 'portal_registration',
        })
        .returning() as any[];

      const customerRecord = customerRecords[0];

      // Create B2B customer extension with default values
      const [b2bCustomerRecord] = await this.drizzle.getDb()
        .insert(b2bCustomers)
        .values({
          tenantId,
          customerId: customerRecord.id,
          paymentTermsType: 'net_30',
          pricingTier: 'standard',
          creditStatus: 'pending',
          b2bMetadata: {
            passwordHash,
            registrationSource: 'customer_portal',
            registrationDate: new Date().toISOString(),
          },
          createdBy: 'portal_registration',
          updatedBy: 'portal_registration',
        })
        .returning();

      // Generate JWT token
      const payload = {
        sub: customerRecord.id,
        email: customerRecord.email,
        tenantId: customerRecord.tenantId,
        type: 'customer_portal',
      };

      const accessToken = this.jwtService.sign(payload);

      // Map to portal customer
      const portalCustomer = await this.mapToPortalCustomer(customerRecord, b2bCustomerRecord);

      // Emit registration event
      this.eventEmitter.emit('customer-portal.registration', {
        tenantId,
        customerId: customerRecord.id,
        companyName: registrationDto.companyName,
        email: registrationDto.email,
      });

      this.logger.log(`Customer portal registration completed for ${registrationDto.email}`);

      return {
        customer: portalCustomer,
        accessToken,
      };
    } catch (error) {
      this.logger.error(`Failed to register customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async getCustomerProfile(tenantId: string, customerId: string): Promise<PortalCustomer> {
    try {
      const cacheKey = `portal-customer:${tenantId}:${customerId}`;
      
      // Try cache first
      let portalCustomer = await this.cacheService.get<PortalCustomer>(cacheKey);
      
      if (!portalCustomer) {
        const [customerRecord] = await this.drizzle.getDb()
          .select({
            customer: customers,
            b2bCustomer: b2bCustomers,
          })
          .from(customers)
          .innerJoin(b2bCustomers, eq(customers.id, b2bCustomers.customerId))
          .where(and(
            eq(customers.tenantId, tenantId),
            eq(customers.id, customerId),
            isNull(customers.deletedAt),
            isNull(b2bCustomers.deletedAt)
          ));

        if (!customerRecord) {
          throw new NotFoundException(`Customer ${customerId} not found`);
        }

        portalCustomer = await this.mapToPortalCustomer(customerRecord.customer, customerRecord.b2bCustomer);

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, portalCustomer, { ttl: 600 });
      }

      return portalCustomer;
    } catch (error) {
      this.logger.error(`Failed to get customer profile ${customerId}:`, error);
      throw error;
    }
  }

  async updateAccountInfo(tenantId: string, customerId: string, updateDto: UpdateAccountInfoDto): Promise<PortalCustomer> {
    try {
      // Update base customer record
      const customerUpdateData: any = {};
      
      if (updateDto.companyName) customerUpdateData.companyName = updateDto.companyName;
      if (updateDto.firstName) customerUpdateData.firstName = updateDto.firstName;
      if (updateDto.lastName) customerUpdateData.lastName = updateDto.lastName;
      if (updateDto.phone) customerUpdateData.phone = updateDto.phone;

      // Update addresses
      if (updateDto.billingAddressLine1 || updateDto.billingCity || updateDto.billingState || updateDto.billingPostalCode || updateDto.billingCountry) {
        const existingCustomer = await this.getCustomerProfile(tenantId, customerId);
        customerUpdateData.billingAddress = {
          ...existingCustomer.billingAddress,
          line1: updateDto.billingAddressLine1 || existingCustomer.billingAddress?.line1,
          line2: updateDto.billingAddressLine2 || existingCustomer.billingAddress?.line2,
          city: updateDto.billingCity || existingCustomer.billingAddress?.city,
          state: updateDto.billingState || existingCustomer.billingAddress?.state,
          postalCode: updateDto.billingPostalCode || existingCustomer.billingAddress?.postalCode,
          country: updateDto.billingCountry || existingCustomer.billingAddress?.country,
        };
      }

      if (updateDto.shippingAddressLine1 || updateDto.shippingCity || updateDto.shippingState || updateDto.shippingPostalCode || updateDto.shippingCountry) {
        const existingCustomer = await this.getCustomerProfile(tenantId, customerId);
        customerUpdateData.shippingAddress = {
          ...existingCustomer.shippingAddress,
          line1: updateDto.shippingAddressLine1 || existingCustomer.shippingAddress?.line1,
          line2: updateDto.shippingAddressLine2 || existingCustomer.shippingAddress?.line2,
          city: updateDto.shippingCity || existingCustomer.shippingAddress?.city,
          state: updateDto.shippingState || existingCustomer.shippingAddress?.state,
          postalCode: updateDto.shippingPostalCode || existingCustomer.shippingAddress?.postalCode,
          country: updateDto.shippingCountry || existingCustomer.shippingAddress?.country,
        };
      }

      if (Object.keys(customerUpdateData).length > 0) {
        customerUpdateData.updatedBy = customerId;
        
        await this.drizzle.getDb()
          .update(customers)
          .set(customerUpdateData)
          .where(and(
            eq(customers.tenantId, tenantId),
            eq(customers.id, customerId)
          ));
      }

      // Clear cache
      await this.cacheService.invalidatePattern(`portal-customer:${tenantId}:${customerId}`);

      // Emit event
      this.eventEmitter.emit('customer-portal.account-updated', {
        tenantId,
        customerId,
        updatedFields: Object.keys(customerUpdateData),
      });

      return this.getCustomerProfile(tenantId, customerId);
    } catch (error) {
      this.logger.error(`Failed to update account info for customer ${customerId}:`, error);
      throw error;
    }
  }

  async changePassword(tenantId: string, customerId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    try {
      if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
        throw new BadRequestException('New password and confirmation do not match');
      }

      // Get current password hash
      const [b2bCustomerRecord] = await this.drizzle.getDb()
        .select()
        .from(b2bCustomers)
        .where(and(
          eq(b2bCustomers.tenantId, tenantId),
          eq(b2bCustomers.customerId, customerId),
          isNull(b2bCustomers.deletedAt)
        ));

      if (!b2bCustomerRecord) {
        throw new NotFoundException('Customer not found');
      }

      // Verify current password
      const b2bMetadata = b2bCustomerRecord.b2bMetadata as any;
      const currentPasswordHash = b2bMetadata?.passwordHash;
      if (!currentPasswordHash || !await bcrypt.compare(changePasswordDto.currentPassword, currentPasswordHash)) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);

      // Update password
      await this.drizzle.getDb()
        .update(b2bCustomers)
        .set({
          b2bMetadata: {
            ...(b2bMetadata || {}),
            passwordHash: newPasswordHash,
            passwordChangedAt: new Date().toISOString(),
          },
          updatedBy: customerId,
        })
        .where(and(
          eq(b2bCustomers.tenantId, tenantId),
          eq(b2bCustomers.customerId, customerId)
        ));

      // Emit event
      this.eventEmitter.emit('customer-portal.password-changed', {
        tenantId,
        customerId,
      });

      this.logger.log(`Password changed for customer ${customerId}`);
    } catch (error) {
      this.logger.error(`Failed to change password for customer ${customerId}:`, error);
      throw error;
    }
  }

  async getProductCatalog(tenantId: string, customerId: string, query: ProductCatalogQueryDto): Promise<{ products: PortalProduct[]; total: number }> {
    try {
      const cacheKey = `portal-catalog:${tenantId}:${customerId}:${JSON.stringify(query)}`;
      
      // Try cache first
      let result = await this.cacheService.get<{ products: PortalProduct[]; total: number }>(cacheKey);
      
      if (!result) {
        const conditions = [
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          isNull(products.deletedAt)
        ];

        // Add search conditions
        if (query.search) {
          conditions.push(
            or(
              ilike(products.name, `%${query.search}%`),
              ilike(products.sku, `%${query.search}%`)
            )!
          );
        }

        if (query.category) {
          conditions.push(eq(products.categoryId, query.category));
        }

        if (query.minPrice !== undefined) {
          conditions.push(gte(products.basePrice, query.minPrice.toString()));
        }

        if (query.maxPrice !== undefined) {
          conditions.push(lte(products.basePrice, query.maxPrice.toString()));
        }

        const whereClause = and(...conditions);

        // Get total count
        const [countResult] = await this.drizzle.getDb()
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .where(whereClause);

        const total = countResult?.count || 0;

        // Get paginated results
        const offset = ((query.page || 1) - 1) * (query.limit || 20);
        let sortByField: any = products.name;
        if (query.sortBy && query.sortBy in products) {
          const field = products[query.sortBy as keyof typeof products];
          if (field && typeof field !== 'function') {
            sortByField = field;
          }
        }
        const orderBy = query.sortOrder === 'asc' 
          ? asc(sortByField)
          : desc(sortByField);

        const productsList = await this.drizzle.getDb()
          .select({
            product: products,
            inventory: inventoryLevels,
          })
          .from(products)
          .leftJoin(inventoryLevels, eq(products.id, inventoryLevels.productId))
          .where(whereClause)
          .orderBy(orderBy)
          .limit(query.limit || 20)
          .offset(offset);

        // Map to portal products with customer-specific pricing
        const portalProducts = await Promise.all(
          productsList.map(async (row) => {
            const customerPrice = await this.pricingService.getCustomerPrice(
              tenantId,
              customerId,
              row.product.id,
              1 // Default quantity for catalog display
            );

            return this.mapToPortalProduct(row.product, row.inventory, customerPrice ?? undefined);
          })
        );

        result = {
          products: portalProducts,
          total: total,
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, { ttl: 300 });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get product catalog for customer ${customerId}:`, error);
      throw error;
    }
  }

  async createOrder(tenantId: string, customerId: string, orderDto: CreatePortalOrderDto): Promise<PortalOrder> {
    try {
      // Get customer's default payment terms
      const [b2bCustomer] = await this.drizzle.getDb()
        .select()
        .from(b2bCustomers)
        .where(and(
          eq(b2bCustomers.tenantId, tenantId),
          eq(b2bCustomers.customerId, customerId),
          isNull(b2bCustomers.deletedAt)
        ));

      const paymentTerms = b2bCustomer?.paymentTermsType || 'net_30';

      // Convert portal order to B2B order format
      const b2bOrderData: any = {
        customerId,
        items: orderDto.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          description: item.specialInstructions,
          metadata: {},
        })),
        paymentTerms,
        shippingAddress: orderDto.shippingAddress || undefined,
        billingAddress: undefined, // Use customer's default billing address
        metadata: {
          source: 'customer_portal',
          purchaseOrderNumber: orderDto.purchaseOrderNumber,
        },
      };

      if (orderDto.requestedDeliveryDate) {
        b2bOrderData.requestedDeliveryDate = orderDto.requestedDeliveryDate;
      }
      if (orderDto.shippingMethod) {
        b2bOrderData.shippingMethod = orderDto.shippingMethod;
      }
      if (orderDto.specialInstructions) {
        b2bOrderData.specialInstructions = orderDto.specialInstructions;
      }

      // Create B2B order
      const b2bOrder = await this.b2bOrderService.createB2BOrder(tenantId, b2bOrderData, customerId);

      // Map to portal order
      const portalOrder = this.mapToPortalOrder(b2bOrder);

      // Emit event
      this.eventEmitter.emit('customer-portal.order-created', {
        tenantId,
        customerId,
        orderId: b2bOrder.id,
        totalAmount: b2bOrder.totalAmount,
      });

      return portalOrder;
    } catch (error) {
      this.logger.error(`Failed to create order for customer ${customerId}:`, error);
      throw error;
    }
  }

  async getOrders(tenantId: string, customerId: string, query: PortalOrderQueryDto): Promise<{ orders: PortalOrder[]; total: number }> {
    try {
      // Convert portal query to B2B order query
      const b2bQuery: any = {
        customerId,
        status: query.status,
        startDate: query.orderDateFrom,
        endDate: query.orderDateTo,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy === 'orderDate' ? 'orderDate' : query.sortBy,
        sortOrder: query.sortOrder,
      };

      if (query.search) {
        b2bQuery.search = query.search;
      }

      const b2bResult = await this.b2bOrderService.findB2BOrders(tenantId, b2bQuery);

      // Map to portal orders
      const portalOrders = b2bResult.orders.map(order => this.mapToPortalOrder(order));

      return {
        orders: portalOrders,
        total: b2bResult.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get orders for customer ${customerId}:`, error);
      throw error;
    }
  }

  async getOrderById(tenantId: string, customerId: string, orderId: string): Promise<PortalOrder> {
    try {
      const b2bOrder = await this.b2bOrderService.findB2BOrderById(tenantId, orderId);

      // Verify order belongs to customer
      if (b2bOrder.customerId !== customerId) {
        throw new NotFoundException('Order not found');
      }

      return this.mapToPortalOrder(b2bOrder);
    } catch (error) {
      this.logger.error(`Failed to get order ${orderId} for customer ${customerId}:`, error);
      throw error;
    }
  }

  private async mapToPortalCustomer(customerRecord: any, b2bCustomerRecord: any): Promise<PortalCustomer> {
    // Calculate available credit (would need to query outstanding invoices/orders)
    const creditLimit = 5000; // Default credit limit since it's not in the schema
    const usedCredit = 0; // Would calculate from outstanding orders/invoices
    const availableCredit = creditLimit - usedCredit;

    return {
      id: customerRecord.id,
      tenantId: customerRecord.tenantId,
      companyName: customerRecord.companyName,
      firstName: customerRecord.firstName,
      lastName: customerRecord.lastName,
      email: customerRecord.email,
      phone: customerRecord.phone,
      creditLimit,
      availableCredit,
      paymentTerms: b2bCustomerRecord.paymentTermsType || 'net_30',
      pricingTier: b2bCustomerRecord.pricingTier,
      billingAddress: customerRecord.billingAddress,
      shippingAddress: customerRecord.shippingAddress,
      accountManagerId: b2bCustomerRecord.accountManagerId,
      salesRepId: b2bCustomerRecord.salesRepId,
    };
  }

  private mapToPortalProduct(productRecord: any, inventoryRecord: any, customerPrice?: number): PortalProduct {
    const basePrice = parseFloat(productRecord.basePrice);
    const finalPrice = customerPrice || basePrice;
    const discountPercentage = customerPrice ? ((basePrice - customerPrice) / basePrice) * 100 : 0;

    return {
      id: productRecord.id,
      sku: productRecord.sku,
      name: productRecord.name,
      description: productRecord.description,
      category: productRecord.category,
      basePrice,
      customerPrice: finalPrice,
      discountPercentage,
      availableQuantity: inventoryRecord ? parseFloat(inventoryRecord.currentLevel || '0') : 0,
      minimumOrderQuantity: 1, // Would come from product configuration
      images: [], // Would come from product metadata
      specifications: productRecord.attributes || {},
    };
  }

  private mapToPortalOrder(b2bOrder: any): PortalOrder {
    return {
      id: b2bOrder.id,
      orderNumber: b2bOrder.orderNumber,
      status: b2bOrder.status,
      orderDate: b2bOrder.orderDate,
      requestedDeliveryDate: b2bOrder.requestedDeliveryDate,
      confirmedDeliveryDate: b2bOrder.confirmedDeliveryDate,
      subtotal: b2bOrder.subtotal,
      taxAmount: b2bOrder.taxAmount,
      shippingAmount: b2bOrder.shippingAmount,
      totalAmount: b2bOrder.totalAmount,
      trackingNumber: b2bOrder.trackingNumber,
      items: b2bOrder.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        quantityShipped: item.quantityShipped,
      })),
    };
  }
}