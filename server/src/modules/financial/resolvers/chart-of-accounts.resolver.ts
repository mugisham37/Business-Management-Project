import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { CreateChartOfAccountDto, UpdateChartOfAccountDto, AccountType } from '../dto/chart-of-accounts.dto';
import { ChartOfAccount } from '../types/chart-of-accounts.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { transformToChartOfAccountArray, transformHierarchyArrayToChartOfAccountArray } from '../utils/type-transformers';

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class ChartOfAccountsResolver {
  constructor(private readonly chartOfAccountsService: ChartOfAccountsService) {}

  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async createAccount(
    @Args('input') input: CreateChartOfAccountDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return await this.chartOfAccountsService.createAccount(tenantId, input, user.id);
  }

  @Query(() => [String])
  @RequirePermission('financial:read')
  async accounts(
    @CurrentTenant() tenantId: string,
    @Args('accountType', { nullable: true }) accountType?: AccountType,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('parentAccountId', { nullable: true }) parentAccountId?: string,
    @Args('includeInactive', { nullable: true }) includeInactive?: boolean,
  ): Promise<ChartOfAccount[]> {
    const options: {
      accountType?: AccountType;
      isActive?: boolean;
      parentAccountId?: string;
      includeInactive?: boolean;
    } = {};
    
    if (accountType !== undefined) options.accountType = accountType;
    if (isActive !== undefined) options.isActive = isActive;
    if (parentAccountId !== undefined) options.parentAccountId = parentAccountId;
    if (includeInactive !== undefined) options.includeInactive = includeInactive;
    
    const accounts = await this.chartOfAccountsService.getAllAccounts(tenantId, options);
    return transformToChartOfAccountArray(accounts);
  }

  @Query(() => String)
  @RequirePermission('financial:read')
  async account(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return await this.chartOfAccountsService.findAccountById(tenantId, id);
  }

  @Query(() => [String])
  @RequirePermission('financial:read')
  async accountHierarchy(
    @CurrentTenant() tenantId: string,
    @Args('rootAccountId', { nullable: true }) rootAccountId?: string,
  ): Promise<ChartOfAccount[]> {
    const hierarchy = await this.chartOfAccountsService.getAccountHierarchy(tenantId, rootAccountId);
    return transformHierarchyArrayToChartOfAccountArray(hierarchy);
  }

  @Query(() => [String])
  @RequirePermission('financial:read')
  async searchAccounts(
    @Args('searchTerm') searchTerm: string,
    @CurrentTenant() tenantId: string,
    @Args('limit', { nullable: true }) limit?: number,
  ): Promise<any[]> {
    return await this.chartOfAccountsService.searchAccounts(tenantId, searchTerm, limit);
  }

  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async updateAccount(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateChartOfAccountDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return await this.chartOfAccountsService.updateAccount(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean)
  @RequirePermission('financial:manage')
  async deleteAccount(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.chartOfAccountsService.deleteAccount(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => String)
  @RequirePermission('financial:manage')
  async initializeDefaultChartOfAccounts(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<string> {
    const accounts = await this.chartOfAccountsService.initializeDefaultChartOfAccounts(tenantId, user.id);
    return `Created ${accounts.length} default accounts`;
  }
}