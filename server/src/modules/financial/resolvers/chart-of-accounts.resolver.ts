import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { CreateChartOfAccountInput, UpdateChartOfAccountInput } from '../graphql/inputs';
import { ChartOfAccount, AccountHierarchy, AccountBalance } from '../graphql/types';
import { AccountType } from '../graphql/enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';

@Resolver(() => ChartOfAccount)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class ChartOfAccountsResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {
    super(dataLoaderService);
  }

  @Mutation(() => ChartOfAccount)
  @RequirePermission('financial:manage')
  async createAccount(
    @Args('input') input: CreateChartOfAccountInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChartOfAccount> {
    return await this.chartOfAccountsService.createAccount(tenantId, input, user.id);
  }

  @Query(() => [ChartOfAccount])
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
    return accounts;
  }

  @Query(() => ChartOfAccount)
  @RequirePermission('financial:read')
  async account(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ChartOfAccount> {
    return await this.chartOfAccountsService.findAccountById(tenantId, id);
  }

  @Query(() => [AccountHierarchy])
  @RequirePermission('financial:read')
  async accountHierarchy(
    @CurrentTenant() tenantId: string,
    @Args('rootAccountId', { nullable: true }) rootAccountId?: string,
  ): Promise<AccountHierarchy[]> {
    return await this.chartOfAccountsService.getAccountHierarchy(tenantId, rootAccountId);
  }

  @Query(() => [ChartOfAccount])
  @RequirePermission('financial:read')
  async searchAccounts(
    @Args('searchTerm') searchTerm: string,
    @CurrentTenant() tenantId: string,
    @Args('limit', { nullable: true }) limit?: number,
  ): Promise<ChartOfAccount[]> {
    return await this.chartOfAccountsService.searchAccounts(tenantId, searchTerm, limit);
  }

  @Mutation(() => ChartOfAccount)
  @RequirePermission('financial:manage')
  async updateAccount(
    @Args('input') input: UpdateChartOfAccountInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChartOfAccount> {
    return await this.chartOfAccountsService.updateAccount(tenantId, input.id, input, user.id);
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

  // Field Resolvers with DataLoader optimization
  @ResolveField(() => ChartOfAccount, { nullable: true })
  async parentAccount(
    @Parent() account: ChartOfAccount,
    @CurrentTenant() tenantId: string,
  ): Promise<ChartOfAccount | null> {
    if (!account.parentAccountId) return null;
    
    return await this.dataLoaderService.getLoader(
      'chartOfAccount',
      async (ids: readonly string[]) => {
        const accounts = await Promise.all(
          ids.map(id => this.chartOfAccountsService.findAccountById(tenantId, id))
        );
        return accounts;
      }
    ).load(account.parentAccountId);
  }

  @ResolveField(() => [ChartOfAccount])
  async childAccounts(
    @Parent() account: ChartOfAccount,
    @CurrentTenant() tenantId: string,
  ): Promise<ChartOfAccount[]> {
    return await this.chartOfAccountsService.getAllAccounts(tenantId, {
      parentAccountId: account.id,
      isActive: true,
    });
  }

  @ResolveField(() => AccountBalance)
  async currentAccountBalance(
    @Parent() account: ChartOfAccount,
    @CurrentTenant() tenantId: string,
  ): Promise<AccountBalance> {
    const balanceString = await this.chartOfAccountsService.getAccountBalance(tenantId, account.id);
    const balance = parseFloat(balanceString) || 0;
    
    // Determine if this is a debit or credit balance based on account type and normal balance
    const isDebitBalance = account.normalBalance === 'debit';
    
    return {
      accountId: account.id,
      account,
      debitBalance: isDebitBalance && balance > 0 ? balance.toFixed(2) : '0.00',
      creditBalance: !isDebitBalance && balance > 0 ? balance.toFixed(2) : '0.00',
      netBalance: balance.toFixed(2),
      asOfDate: new Date(),
      tenantId,
    };
  }

  @ResolveField(() => Boolean)
  async hasTransactions(
    @Parent() account: ChartOfAccount,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    // This would check if the account has any journal entry lines
    // Implementation would depend on JournalEntryService
    return false; // Placeholder
  }

  @ResolveField(() => String)
  async accountPath(
    @Parent() account: ChartOfAccount,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    // Build full account path (e.g., "Assets > Current Assets > Cash")
    const path = [account.accountName];
    let currentAccount = account;
    
    while (currentAccount.parentAccountId) {
      const parent = await this.chartOfAccountsService.findAccountById(tenantId, currentAccount.parentAccountId);
      if (parent) {
        path.unshift(parent.accountName);
        currentAccount = parent;
      } else {
        break;
      }
    }
    
    return path.join(' > ');
  }
}