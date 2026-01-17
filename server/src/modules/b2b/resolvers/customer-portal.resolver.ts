import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CustomerPortalService } from '../services/customer-portal.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import {
  CustomerPortalLoginInput,
  CustomerPortalRegistrationInput,
  CreatePortalOrderInput,
  PortalOrderQueryInput,
  ProductCatalogQueryInput,
  UpdateAccountInfoInput,
  ChangePasswordInput,
  InvoiceQueryInput,
  PortalCustomerType,
  PortalOrderType,
  PortalProductType,
  PortalDashboardType,
  PortalOrdersResponse,
  PortalProductCatalogResponse,
  PortalAuthResponse,
  PortalRegistrationResponse,
  AccountUpdateResponse,
  PasswordChangeResponse
} from '../types/customer-portal.types';

/**
 * GraphQL resolver for B2B customer portal operations
 * 
 * Provides customer-facing operations for:
 * - Portal authentication and registration
 * - Customer profile management
 * - Product catalog browsing with customer-specific pricing
 * - Order placement and tracking
 * - Account information updates
 * 
 * @requires JwtAuthGuard - Authentication required for most operations
 * @requires TenantGuard - Tenant isolation enforced
 * @requires PermissionsGuard - Customer-specific permissions
 */
@Resolver(() => PortalCustomerType)
@UseGuards(JwtAuthGuard, TenantGuard)
export class CustomerPortalResolver extends BaseResolver {
  private readonly logger = new Logger(CustomerPortalResolver.name);

  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly customerPortalService: CustomerPortalService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Query: Get customer portal dashboard data
   * Returns overview information for the authenticated customer
   * @permission portal:read
   */
  @Query(() => PortalDashboardType)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:read')
  async getPortalDashboard(
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PortalDashboardType> {
    try {
      this.logger.debug(`Fetching portal dashboard for customer ${user.id}`);
      
      // Get customer profile
      const customer = await this.customerPortalService.getCustomerProfile(tenantId, user.id);
      
      // Get recent orders
      const recentOrders = await this.customerPortalService.getOrders(tenantId, user.id, {
        page: 1,
        limit: 5,
        sortBy: 'orderDate',
        sortOrder: 'desc',
      });

      return {
        customer,
        recentOrders: recentOrders.orders,
        summary: JSON.stringify({
          totalOrders: recentOrders.total,
          availableCredit: customer.availableCredit,
          creditLimit: customer.creditLimit,
        }),
      };
    } catch (error) {
      this.logger.error(`Failed to get portal dashboard:`, error);
      throw error;
    }
  }

  /**
   * Query: Get customer's orders with filtering and pagination
   * @permission portal:read
   */
  @Query(() => PortalOrdersResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:read')
  async getPortalOrders(
    @Args('query') query: PortalOrderQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PortalOrdersResponse> {
    try {
      this.logger.debug(`Fetching portal orders for customer ${user.id}`);
      
      const result = await this.customerPortalService.getOrders(tenantId, user.id, query);
      
      return {
        orders: result.orders,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get portal orders:`, error);
      throw error;
    }
  }

  /**
   * Query: Get a specific order by ID
   * @permission portal:read
   */
  @Query(() => PortalOrderType)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:read')
  async getPortalOrder(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PortalOrderType> {
    try {
      this.logger.debug(`Fetching portal order ${id} for customer ${user.id}`);
      return await this.customerPortalService.getOrderById(tenantId, user.id, id);
    } catch (error) {
      this.logger.error(`Failed to get portal order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Query: Get product catalog with customer-specific pricing
   * @permission portal:read
   */
  @Query(() => PortalProductCatalogResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:read')
  async getPortalProductCatalog(
    @Args('query') query: ProductCatalogQueryInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PortalProductCatalogResponse> {
    try {
      this.logger.debug(`Fetching product catalog for customer ${user.id}`);
      
      const result = await this.customerPortalService.getProductCatalog(
        tenantId,
        user.id,
        query,
      );
      
      return {
        products: result.products,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get product catalog:`, error);
      throw error;
    }
  }

  /**
   * Query: Get customer profile information
   * @permission portal:read
   */
  @Query(() => PortalCustomerType)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:read')
  async getPortalProfile(
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PortalCustomerType> {
    try {
      this.logger.debug(`Fetching portal profile for customer ${user.id}`);
      return await this.customerPortalService.getCustomerProfile(tenantId, user.id);
    } catch (error) {
      this.logger.error(`Failed to get portal profile:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Submit a new order through the portal
   * @permission portal:order
   */
  @Mutation(() => PortalOrderType)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:order')
  async submitPortalOrder(
    @Args('input') input: CreatePortalOrderInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PortalOrderType> {
    try {
      this.logger.log(`Submitting portal order for customer ${user.id}`);
      
      const order = await this.customerPortalService.createOrder(
        tenantId,
        user.id,
        input,
      );

      this.logger.log(`Created portal order ${order.orderNumber} for customer ${user.id}`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to submit portal order:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Update customer account information
   * @permission portal:update
   */
  @Mutation(() => AccountUpdateResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:update')
  async updatePortalAccount(
    @Args('input') input: UpdateAccountInfoInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<AccountUpdateResponse> {
    try {
      this.logger.log(`Updating portal account for customer ${user.id}`);
      
      const customer = await this.customerPortalService.updateAccountInfo(
        tenantId,
        user.id,
        input,
      );

      this.logger.log(`Updated portal account for customer ${user.id}`);
      return {
        customer,
        message: 'Account updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update portal account:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Change customer password
   * @permission portal:update
   */
  @Mutation(() => PasswordChangeResponse)
  @UseGuards(PermissionsGuard)
  @Permissions('portal:update')
  async changePortalPassword(
    @Args('input') input: ChangePasswordInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<PasswordChangeResponse> {
    try {
      this.logger.log(`Changing password for customer ${user.id}`);
      
      await this.customerPortalService.changePassword(
        tenantId,
        user.id,
        input,
      );

      this.logger.log(`Password changed for customer ${user.id}`);
      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to change portal password:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Register a new customer portal account
   * Public endpoint - no authentication required
   */
  @Mutation(() => PortalRegistrationResponse)
  async registerPortalAccount(
    @Args('input') input: CustomerPortalRegistrationInput,
    @Args('tenantId') tenantId: string,
  ): Promise<PortalRegistrationResponse> {
    try {
      this.logger.log(`Registering new portal account for ${input.email}`);
      
      const result = await this.customerPortalService.register(tenantId, input);

      this.logger.log(`Registered portal account for ${input.email}`);
      return {
        customer: result.customer,
        message: 'Account registered successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to register portal account:`, error);
      throw error;
    }
  }

  /**
   * Mutation: Login to customer portal
   * Public endpoint - no authentication required
   */
  @Mutation(() => PortalAuthResponse)
  async loginPortal(
    @Args('input') input: CustomerPortalLoginInput,
    @Args('tenantId') tenantId: string,
  ): Promise<PortalAuthResponse> {
    try {
      this.logger.log(`Portal login attempt for ${input.email}`);
      
      const result = await this.customerPortalService.login(tenantId, input);

      this.logger.log(`Portal login successful for ${input.email}`);
      return {
        customer: result.customer,
        accessToken: result.accessToken,
      };
    } catch (error) {
      this.logger.error(`Failed to login to portal:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load account manager for customer
   * Uses DataLoader for batch loading
   */
  @ResolveField('accountManager')
  async getAccountManager(
    @Parent() customer: any,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!customer.accountManagerId) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: customer.accountManagerId,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load account manager for customer ${customer.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Load sales representative for customer
   * Uses DataLoader for batch loading
   */
  @ResolveField('salesRep')
  async getSalesRep(
    @Parent() customer: any,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      if (!customer.salesRepId) {
        return null;
      }

      // DataLoader implementation would go here
      return {
        id: customer.salesRepId,
        // Additional user fields would be loaded via DataLoader
      };
    } catch (error) {
      this.logger.error(`Failed to load sales rep for customer ${customer.id}:`, error);
      throw error;
    }
  }

  /**
   * Field Resolver: Calculate credit utilization percentage
   * Computed field based on available credit and credit limit
   */
  @ResolveField('creditUtilization')
  async getCreditUtilization(
    @Parent() customer: any,
  ) {
    try {
      if (!customer.creditLimit || customer.creditLimit === 0) {
        return 0;
      }

      const usedCredit = customer.creditLimit - customer.availableCredit;
      return (usedCredit / customer.creditLimit) * 100;
    } catch (error) {
      this.logger.error(`Failed to calculate credit utilization for customer ${customer.id}:`, error);
      return 0;
    }
  }

  /**
   * Field Resolver: Get customer's active contracts
   * Returns contracts associated with the customer
   */
  @ResolveField('activeContracts')
  async getActiveContracts(
    @Parent() customer: any,
    @CurrentTenant() tenantId: string,
  ) {
    try {
      // Placeholder - would integrate with contract service
      return [];
    } catch (error) {
      this.logger.error(`Failed to load active contracts for customer ${customer.id}:`, error);
      throw error;
    }
  }
}
