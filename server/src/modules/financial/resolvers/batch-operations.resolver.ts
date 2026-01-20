import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { 
  BatchCreateJournalEntriesInput,
  BatchPostJournalEntriesInput,
  BatchCreateAccountsInput,
  BatchUpdateAccountBalancesInput,
  BatchCreateBudgetsInput,
  BatchCreateInvoicesInput,
  BatchCreateTaxRatesInput,
  BulkImportInput,
  PaginationInput
} from '../graphql/inputs';
import { 
  BatchOperationResult,
  JournalEntryConnection,
  ChartOfAccountConnection,
  BudgetConnection,
  ARAPInvoiceConnection,
  PageInfo
} from '../graphql/types';
import { JournalEntry, ChartOfAccount, Budget, ARAPInvoice } from '../graphql/types';
import { JournalEntryService } from '../services/journal-entry.service';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { BudgetService } from '../services/budget.service';
import { AccountsReceivablePayableService } from '../services/accounts-receivable-payable.service';
import { TaxService } from '../services/tax.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
export class BatchOperationsResolver {
  constructor(
    private readonly journalEntryService: JournalEntryService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly budgetService: BudgetService,
    private readonly arapService: AccountsReceivablePayableService,
    private readonly taxService: TaxService,
  ) {}

  // Batch Journal Entry Operations
  @Mutation(() => BatchOperationResult)
  @RequirePermission('financial:manage')
  async batchCreateJournalEntries(
    @Args('input') input: BatchCreateJournalEntriesInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchOperationResult> {
    const batchId = `batch_je_${Date.now()}`;
    const results = {
      totalProcessed: input.entries.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as string[],
      warnings: [] as string[],
      batchId,
      completedAt: new Date(),
    };

    for (let i = 0; i < input.entries.length; i++) {
      try {
        const entryInput = input.entries[i];
        if (!entryInput) {
          results.errorCount++;
          results.errors.push(`Entry ${i + 1}: Entry data is undefined`);
          continue;
        }

        const entry = await this.journalEntryService.createJournalEntry(
          tenantId, 
          entryInput, 
          user.id
        );
        
        if (input.autoPost) {
          await this.journalEntryService.postJournalEntry(tenantId, entry.id, user.id);
        }
        
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Entry ${i + 1}: ${errorMessage}`);
      }
    }

    return results;
  }

  @Mutation(() => BatchOperationResult)
  @RequirePermission('financial:post')
  async batchPostJournalEntries(
    @Args('input') input: BatchPostJournalEntriesInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchOperationResult> {
    const batchId = `batch_post_${Date.now()}`;
    const results = {
      totalProcessed: input.entryIds.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as string[],
      warnings: [] as string[],
      batchId,
      completedAt: new Date(),
    };

    for (let i = 0; i < input.entryIds.length; i++) {
      try {
        const entryId = input.entryIds[i];
        if (!entryId) {
          results.errorCount++;
          results.errors.push(`Entry ${i + 1}: Entry ID is undefined`);
          continue;
        }

        await this.journalEntryService.postJournalEntry(
          tenantId, 
          entryId, 
          user.id,
          input.postingDate ? new Date(input.postingDate) : undefined
        );
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Entry ${input.entryIds[i]}: ${errorMessage}`);
      }
    }

    return results;
  }

  // Batch Account Operations
  @Mutation(() => BatchOperationResult)
  @RequirePermission('financial:manage')
  async batchCreateAccounts(
    @Args('input') input: BatchCreateAccountsInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchOperationResult> {
    const batchId = `batch_accounts_${Date.now()}`;
    const results = {
      totalProcessed: input.accounts.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as string[],
      warnings: [] as string[],
      batchId,
      completedAt: new Date(),
    };

    for (let i = 0; i < input.accounts.length; i++) {
      try {
        const accountInput = input.accounts[i];
        if (!accountInput) {
          results.errorCount++;
          results.errors.push(`Account ${i + 1}: Account data is undefined`);
          continue;
        }

        await this.chartOfAccountsService.createAccount(
          tenantId, 
          accountInput, 
          user.id
        );
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Account ${i + 1}: ${errorMessage}`);
      }
    }

    return results;
  }

  @Mutation(() => BatchOperationResult)
  @RequirePermission('financial:manage')
  async batchUpdateAccountBalances(
    @Args('input') input: BatchUpdateAccountBalancesInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchOperationResult> {
    const batchId = `batch_balances_${Date.now()}`;
    const results = {
      totalProcessed: input.updates.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as string[],
      warnings: [] as string[],
      batchId,
      completedAt: new Date(),
    };

    for (let i = 0; i < input.updates.length; i++) {
      try {
        const updateInput = input.updates[i];
        if (!updateInput) {
          results.errorCount++;
          results.errors.push(`Update ${i + 1}: Update data is undefined`);
          continue;
        }

        if (!updateInput.accountId) {
          results.errorCount++;
          results.errors.push(`Update ${i + 1}: Account ID is undefined`);
          continue;
        }

        await this.chartOfAccountsService.updateAccountBalance(
          tenantId, 
          updateInput.accountId, 
          updateInput.newBalance
        );
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Account ${input.updates[i]?.accountId || i + 1}: ${errorMessage}`);
      }
    }

    return results;
  }

  // Batch Budget Operations
  @Mutation(() => BatchOperationResult)
  @RequirePermission('financial:manage')
  async batchCreateBudgets(
    @Args('input') input: BatchCreateBudgetsInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchOperationResult> {
    const batchId = `batch_budgets_${Date.now()}`;
    const results = {
      totalProcessed: input.budgets.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as string[],
      warnings: [] as string[],
      batchId,
      completedAt: new Date(),
    };

    for (let i = 0; i < input.budgets.length; i++) {
      try {
        const budgetInput = input.budgets[i];
        if (!budgetInput) {
          results.errorCount++;
          results.errors.push(`Budget ${i + 1}: Budget data is undefined`);
          continue;
        }

        // Transform input to match service interface
        const serviceInput: any = {
          budgetName: budgetInput.budgetName,
          budgetType: 'annual', // Default type
          fiscalYear: budgetInput.budgetYear,
          startDate: new Date(budgetInput.startDate),
          endDate: new Date(budgetInput.endDate),
          description: budgetInput.description || undefined,
          notes: undefined,
        };

        await this.budgetService.createBudget(
          tenantId, 
          serviceInput, 
          user.id
        );
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Budget ${i + 1}: ${errorMessage}`);
      }
    }

    return results;
  }

  // Batch Invoice Operations
  @Mutation(() => BatchOperationResult)
  @RequirePermission('financial:manage')
  async batchCreateInvoices(
    @Args('input') input: BatchCreateInvoicesInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchOperationResult> {
    const batchId = `batch_invoices_${Date.now()}`;
    const results = {
      totalProcessed: input.invoices.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as string[],
      warnings: [] as string[],
      batchId,
      completedAt: new Date(),
    };

    for (let i = 0; i < input.invoices.length; i++) {
      try {
        const invoiceInput = input.invoices[i];
        if (!invoiceInput) {
          results.errorCount++;
          results.errors.push(`Invoice ${i + 1}: Invoice data is undefined`);
          continue;
        }

        // Transform input to match service interface
        const serviceInput: any = {
          invoiceType: invoiceInput.invoiceType as 'receivable' | 'payable',
          customerId: invoiceInput.customerId || undefined,
          supplierId: invoiceInput.supplierId || undefined,
          invoiceDate: new Date(invoiceInput.invoiceDate),
          dueDate: new Date(invoiceInput.dueDate),
          description: invoiceInput.description || undefined,
          notes: invoiceInput.reference || undefined,
          paymentTerms: invoiceInput.terms || undefined,
          lines: invoiceInput.lines.map((line: any) => ({
            description: line.description,
            quantity: parseFloat(line.quantity),
            unitPrice: parseFloat(line.unitPrice),
            glAccountId: line.accountId,
            notes: line.taxCode,
          })),
        };

        await this.arapService.createInvoice(
          tenantId, 
          serviceInput, 
          user.id
        );
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Invoice ${i + 1}: ${errorMessage}`);
      }
    }

    return results;
  }

  // Bulk Import Operations
  @Mutation(() => BatchOperationResult)
  @RequirePermission('financial:manage')
  async bulkImport(
    @Args('input') input: BulkImportInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchOperationResult> {
    const batchId = `bulk_import_${Date.now()}`;
    
    // This would implement file parsing and bulk import logic
    // For now, return a placeholder result
    return {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: ['Bulk import not yet implemented'],
      warnings: [],
      batchId,
      completedAt: new Date(),
    };
  }

  // Paginated Queries
  @Query(() => JournalEntryConnection)
  @RequirePermission('financial:read')
  async journalEntriesPaginated(
    @Args('pagination', { nullable: true }) pagination: PaginationInput,
    @CurrentTenant() tenantId: string,
  ): Promise<JournalEntryConnection> {
    // Implementation would use cursor-based pagination
    const entries = await this.journalEntryService.findAllJournalEntries(tenantId, {
      // Remove limit as it's not part of JournalEntryQueryInput
      // Pagination would be handled differently in a real implementation
    });

    return {
      edges: entries.map((entry, index) => ({
        node: entry,
        cursor: Buffer.from(`${entry.id}:${index}`).toString('base64'),
      })),
      pageInfo: {
        hasNextPage: entries.length === (pagination?.first || 20),
        hasPreviousPage: false,
        startCursor: entries.length > 0 ? Buffer.from(`${entries[0].id}:0`).toString('base64') : undefined,
        endCursor: entries.length > 0 ? Buffer.from(`${entries[entries.length - 1].id}:${entries.length - 1}`).toString('base64') : undefined,
      } as PageInfo,
      totalCount: entries.length, // This should be the actual total count from the database
    };
  }

  @Query(() => ChartOfAccountConnection)
  @RequirePermission('financial:read')
  async accountsPaginated(
    @Args('pagination', { nullable: true }) pagination: PaginationInput,
    @CurrentTenant() tenantId: string,
  ): Promise<ChartOfAccountConnection> {
    const accounts = await this.chartOfAccountsService.getAllAccounts(tenantId, {
      // Remove limit as it's not part of the getAllAccounts filter interface
      // Pagination would be handled differently in a real implementation
    });

    const firstAccount = accounts.length > 0 ? accounts[0] : null;
    const lastAccount = accounts.length > 0 ? accounts[accounts.length - 1] : null;

    return {
      edges: accounts.map((account, index) => ({
        node: account,
        cursor: Buffer.from(`${account.id}:${index}`).toString('base64'),
      })),
      pageInfo: {
        hasNextPage: accounts.length === (pagination?.first || 20),
        hasPreviousPage: false,
        startCursor: firstAccount ? Buffer.from(`${firstAccount.id}:0`).toString('base64') : undefined,
        endCursor: lastAccount ? Buffer.from(`${lastAccount.id}:${accounts.length - 1}`).toString('base64') : undefined,
      } as PageInfo,
      totalCount: accounts.length,
    };
  }
}