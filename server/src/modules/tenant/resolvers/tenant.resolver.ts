import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantService } from '../services/tenant.service';
import { BusinessMetricsService } from '../services/business-metrics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { AuthenticatedUser } from '../guards/tenant.guard';
import {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateBusinessMetricsDto,
  TenantQueryDto,
} from '../dto/tenant.dto';
import { Tenant, BusinessTier } from '../entities/tenant.entity';

@Resolver(() => Tenant)
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
export class TenantResolver {
  constructor(
    private readonly tenantService: TenantService,
    private readonly businessMetricsService: BusinessMetricsService,
  ) {}

  @Query(() => Tenant, { name: 'tenant' })
  @UseGuards(TenantGuard)
  async getTenant(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Users can only access their own tenant or super admins can access any
    if (user.tenantId !== id && !user.permissions.includes('tenants:read-all')) {
      throw new Error('Access denied: Cannot access other tenant data');
    }

    const tenant = await this.tenantService.findById(id);
    if (!tenant) {
      throw new Error(`Tenant with ID '${id}' not found`);
    }

    return tenant;
  }

  @Query(() => [Tenant], { name: 'tenants' })
  async getTenants(
    @Args('query', { type: () => TenantQueryDto, nullable: true }) query: TenantQueryDto = {},
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant[]> {
    // Only super admins can list all tenants
    if (!user.permissions.includes('tenants:read-all')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    const { tenants } = await this.tenantService.findAll(query);
    return tenants;
  }

  @Mutation(() => Tenant)
  async createTenant(
    @Args('input') input: CreateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Only super admins can create tenants
    if (!user.permissions.includes('tenants:create')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    return this.tenantService.create(input, user.id);
  }

  @Mutation(() => Tenant)
  @UseGuards(TenantGuard)
  async updateTenant(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Users can only update their own tenant or super admins can update any
    if (user.tenantId !== id && !user.permissions.includes('tenants:update-all')) {
      throw new Error('Access denied: Cannot update other tenant data');
    }

    return this.tenantService.update(id, input, user.id);
  }

  @Mutation(() => Tenant)
  @UseGuards(TenantGuard)
  async updateBusinessMetrics(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateBusinessMetricsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Users can only update their own tenant metrics
    if (user.tenantId !== id && !user.permissions.includes('tenants:update-all')) {
      throw new Error('Access denied: Cannot update other tenant metrics');
    }

    return this.tenantService.updateBusinessMetrics(id, input, user.id);
  }

  @Mutation(() => Boolean)
  async deleteTenant(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    // Only super admins can delete tenants
    if (!user.permissions.includes('tenants:delete')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    await this.tenantService.delete(id, user.id);
    return true;
  }

  @Query(() => String, { name: 'calculateBusinessTier' })
  calculateBusinessTier(
    @Args('employeeCount') employeeCount: number,
    @Args('locationCount') locationCount: number,
    @Args('monthlyTransactionVolume') monthlyTransactionVolume: number,
    @Args('monthlyRevenue') monthlyRevenue: number,
  ): BusinessTier {
    return this.businessMetricsService.calculateBusinessTier({
      employeeCount,
      locationCount,
      monthlyTransactionVolume,
      monthlyRevenue,
    });
  }

  @Query(() => String, { name: 'getUpgradeRequirements' })
  @UseGuards(TenantGuard)
  getUpgradeRequirements(
    @CurrentUser() user: AuthenticatedUser,
  ): any {
    // This would need the current tenant's business tier
    // Implementation would fetch current tenant and return upgrade requirements
    return this.businessMetricsService.getUpgradeRequirements(BusinessTier.MICRO);
  }
}