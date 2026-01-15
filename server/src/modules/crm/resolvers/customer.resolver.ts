import { Resolver, Query, Mutation, Args, ID, Int, Context } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { CustomerService } from '../services/customer.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from '../dto/customer.dto';
import { Customer } from '../entities/customer.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => Customer)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('customer-management')
export class CustomerResolver {
  constructor(private readonly customerService: CustomerService) {}

  @Query(() => [Customer])
  @RequirePermission('customers:read')
  async customers(
    @Args('query', { type: () => CustomerQueryDto, nullable: true }) query: CustomerQueryDto = {},
    @CurrentTenant() tenantId: string,
  ): Promise<Customer[]> {
    const result = await this.customerService.findMany(tenantId, query);
    return result.customers;
  }

  @Query(() => Customer)
  @RequirePermission('customers:read')
  async customer(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer> {
    return this.customerService.findById(tenantId, id);
  }

  @Query(() => Customer, { nullable: true })
  @RequirePermission('customers:read')
  async customerByEmail(
    @Args('email') email: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer | null> {
    return this.customerService.findByEmail(tenantId, email);
  }

  @Query(() => Customer, { nullable: true })
  @RequirePermission('customers:read')
  async customerByPhone(
    @Args('phone') phone: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer | null> {
    return this.customerService.findByPhone(tenantId, phone);
  }

  @Mutation(() => Customer)
  @RequirePermission('customers:create')
  async createCustomer(
    @Args('input') input: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer> {
    return this.customerService.create(tenantId, input, user.id);
  }

  @Mutation(() => Customer)
  @RequirePermission('customers:update')
  async updateCustomer(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer> {
    return this.customerService.update(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean)
  @RequirePermission('customers:delete')
  async deleteCustomer(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.customerService.delete(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermission('customers:update')
  async updateCustomerPurchaseStats(
    @Args('id', { type: () => ID }) id: string,
    @Args('orderValue', { type: () => Int }) orderValue: number,
    @CurrentTenant() tenantId: string,
    @Args('orderDate', { nullable: true }) orderDate?: Date,
  ): Promise<boolean> {
    const date = orderDate || new Date();
    await this.customerService.updatePurchaseStats(tenantId, id, orderValue, date);
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermission('customers:update')
  @RequireFeature('loyalty-program')
  async updateCustomerLoyaltyPoints(
    @Args('id', { type: () => ID }) id: string,
    @Args('pointsChange', { type: () => Int }) pointsChange: number,
    @Args('reason') reason: string,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.customerService.updateLoyaltyPoints(tenantId, id, pointsChange, reason);
    return true;
  }
}