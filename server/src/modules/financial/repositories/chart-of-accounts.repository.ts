import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, like, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { chartOfAccounts } from '../../database/schema/financial.schema';
import { CreateChartOfAccountDto, UpdateChartOfAccountDto, AccountType } from '../dto/chart-of-accounts.dto';

@Injectable()
export class ChartOfAccountsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, dto: CreateChartOfAccountDto, userId: string) {
    const accountPath = await this.generateAccountPath(tenantId, dto.parentAccountId, dto.accountNumber);
    const accountLevel = dto.parentAccountId ? await this.getAccountLevel(dto.parentAccountId) + 1 : 1;

    const accounts = await this.drizzle.getDb()
      .insert(chartOfAccounts)
      .values({
        tenantId,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        accountType: dto.accountType,
        accountSubType: dto.accountSubType,
        parentAccountId: dto.parentAccountId,
        accountLevel,
        accountPath,
        normalBalance: dto.normalBalance,
        description: dto.description,
        taxReportingCategory: dto.taxReportingCategory,
        isActive: dto.isActive ?? true,
        allowManualEntries: dto.allowManualEntries ?? true,
        requireDepartment: dto.requireDepartment ?? false,
        requireProject: dto.requireProject ?? false,
        externalAccountId: dto.externalAccountId,
        settings: dto.settings || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    const account = Array.isArray(accounts) ? accounts[0] : (accounts as any);
    return account;
  }

  async findById(tenantId: string, id: string) {
    const [account] = await this.drizzle.getDb()
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.id, id),
        isNull(chartOfAccounts.deletedAt)
      ));

    return account;
  }

  async findByAccountNumber(tenantId: string, accountNumber: string) {
    const [account] = await this.drizzle.getDb()
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.accountNumber, accountNumber),
        isNull(chartOfAccounts.deletedAt)
      ));

    return account;
  }

  async findAll(tenantId: string, options?: {
    accountType?: AccountType;
    isActive?: boolean;
    parentAccountId?: string;
    includeInactive?: boolean;
  }) {
    const conditions = [
      eq(chartOfAccounts.tenantId, tenantId),
      isNull(chartOfAccounts.deletedAt)
    ];

    if (options?.accountType) {
      conditions.push(eq(chartOfAccounts.accountType, options.accountType));
    }

    if (options?.isActive !== undefined) {
      conditions.push(eq(chartOfAccounts.isActive, options.isActive));
    }

    if (options?.parentAccountId !== undefined) {
      if (options.parentAccountId === null) {
        conditions.push(isNull(chartOfAccounts.parentAccountId));
      } else {
        conditions.push(eq(chartOfAccounts.parentAccountId, options.parentAccountId));
      }
    }

    if (!options?.includeInactive) {
      conditions.push(eq(chartOfAccounts.isActive, true));
    }

    const accounts = await this.drizzle.getDb()
      .select()
      .from(chartOfAccounts)
      .where(and(...conditions))
      .orderBy(asc(chartOfAccounts.accountNumber));

    return accounts;
  }

  async findHierarchy(tenantId: string, rootAccountId?: string) {
    // Get all accounts for the tenant
    const allAccounts = await this.findAll(tenantId, { includeInactive: true });
    
    // Build hierarchy
    const accountMap = new Map();
    const rootAccounts = [];

    // First pass: create map and identify root accounts
    for (const account of allAccounts) {
      accountMap.set(account.id, { ...account, children: [] });
      
      if (!account.parentAccountId || account.parentAccountId === rootAccountId) {
        rootAccounts.push(account.id);
      }
    }

    // Second pass: build parent-child relationships
    for (const account of allAccounts) {
      if (account.parentAccountId && accountMap.has(account.parentAccountId)) {
        const parent = accountMap.get(account.parentAccountId);
        parent.children.push(accountMap.get(account.id));
      }
    }

    // Return root accounts with their hierarchies
    return rootAccounts.map(id => accountMap.get(id));
  }

  async update(tenantId: string, id: string, dto: UpdateChartOfAccountDto, userId: string) {
    const [account] = await this.drizzle.getDb()
      .update(chartOfAccounts)
      .set({
        ...dto,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.id, id),
        isNull(chartOfAccounts.deletedAt)
      ))
      .returning();

    return account;
  }

  async updateBalance(tenantId: string, accountId: string, newBalance: string) {
    const [account] = await this.drizzle.getDb()
      .update(chartOfAccounts)
      .set({
        currentBalance: newBalance,
        updatedAt: new Date(),
      })
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.id, accountId),
        isNull(chartOfAccounts.deletedAt)
      ))
      .returning();

    return account;
  }

  async delete(tenantId: string, id: string, userId: string) {
    // Check if account has children
    const children = await this.drizzle.getDb()
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.parentAccountId, id),
        isNull(chartOfAccounts.deletedAt)
      ));

    if (children.length > 0) {
      throw new Error('Cannot delete account with child accounts');
    }

    // Soft delete
    const [account] = await this.drizzle.getDb()
      .update(chartOfAccounts)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.id, id),
        isNull(chartOfAccounts.deletedAt)
      ))
      .returning();

    return account;
  }

  async getAccountsByType(tenantId: string, accountTypes: AccountType[]) {
    const accounts = await this.drizzle.getDb()
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        sql`${chartOfAccounts.accountType} = ANY(${accountTypes})`,
        eq(chartOfAccounts.isActive, true),
        isNull(chartOfAccounts.deletedAt)
      ))
      .orderBy(asc(chartOfAccounts.accountNumber));

    return accounts;
  }

  async searchAccounts(tenantId: string, searchTerm: string, limit = 20) {
    const accounts = await this.drizzle.getDb()
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        sql`(${chartOfAccounts.accountName} ILIKE ${`%${searchTerm}%`} OR ${chartOfAccounts.accountNumber} ILIKE ${`%${searchTerm}%`})`,
        eq(chartOfAccounts.isActive, true),
        isNull(chartOfAccounts.deletedAt)
      ))
      .orderBy(asc(chartOfAccounts.accountNumber))
      .limit(limit);

    return accounts;
  }

  private async generateAccountPath(tenantId: string, parentAccountId?: string, accountNumber?: string): Promise<string> {
    if (!parentAccountId) {
      return accountNumber || '';
    }

    const parent = await this.findById(tenantId, parentAccountId);
    if (!parent) {
      throw new Error('Parent account not found');
    }

    return parent.accountPath ? `${parent.accountPath}/${accountNumber}` : accountNumber || '';
  }

  private async getAccountLevel(accountId: string): Promise<number> {
    const results = await this.drizzle.getDb()
      .select({ accountLevel: chartOfAccounts.accountLevel })
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.id, accountId));
    
    const account = results[0];
    return account?.accountLevel || 0;
  }

  async validateAccountNumber(tenantId: string, accountNumber: string, excludeId?: string): Promise<boolean> {
    const conditions = [
      eq(chartOfAccounts.tenantId, tenantId),
      eq(chartOfAccounts.accountNumber, accountNumber),
      isNull(chartOfAccounts.deletedAt)
    ];

    if (excludeId) {
      conditions.push(sql`${chartOfAccounts.id} != ${excludeId}`);
    }

    const results = await this.drizzle.getDb()
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .where(and(...conditions));

    const existing = results[0];
    return !existing; // Returns true if account number is available
  }

  async getAccountBalance(tenantId: string, accountId: string): Promise<string> {
    const results = await this.drizzle.getDb()
      .select({ currentBalance: chartOfAccounts.currentBalance })
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.tenantId, tenantId),
        eq(chartOfAccounts.id, accountId),
        isNull(chartOfAccounts.deletedAt)
      ));

    const account = results[0];
    return account?.currentBalance || '0.00';
  }
}