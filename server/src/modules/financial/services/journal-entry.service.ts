import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JournalEntryRepository } from '../repositories/journal-entry.repository';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateJournalEntryDto, UpdateJournalEntryDto, JournalEntryStatus, JournalEntryQueryDto, JournalEntryResponseDto } from '../dto/journal-entry.dto';
import { AccountingService } from './accounting.service';
import { isDebitAccount } from '../utils/type-transformers';

@Injectable()
export class JournalEntryService {
  constructor(
    private readonly journalEntryRepository: JournalEntryRepository,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly accountingService: AccountingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createJournalEntry(tenantId: string, dto: CreateJournalEntryDto, userId: string) {
    // Validate journal entry
    await this.validateJournalEntry(tenantId, dto);

    const journalEntry = await this.journalEntryRepository.create(tenantId, dto, userId);

    // Emit event
    this.eventEmitter.emit('journal-entry.created', {
      tenantId,
      journalEntryId: journalEntry.id,
      userId,
    });

    return journalEntry;
  }

  async findJournalEntryById(tenantId: string, id: string) {
    const journalEntry = await this.journalEntryRepository.findById(tenantId, id);
    
    if (!journalEntry) {
      throw new NotFoundException('Journal entry not found');
    }

    return journalEntry;
  }

  async findAllJournalEntries(tenantId: string, query: JournalEntryQueryDto = {}): Promise<JournalEntryResponseDto[]> {
    const results = await this.journalEntryRepository.findAll(tenantId, query);
    
    // Transform the results to match JournalEntryResponseDto structure
    // The repository returns objects with nested lines, but we need to ensure all required properties are present
    return results.map((result: any) => {
      // Create a safe transformation with defaults for missing properties
      return {
        id: result.id || '',
        tenantId: result.tenantId || tenantId,
        entryNumber: result.entryNumber || '',
        entryDate: result.entryDate || new Date(),
        postingDate: result.postingDate || undefined,
        description: result.description || '',
        reference: result.reference || undefined,
        status: result.status || JournalEntryStatus.DRAFT,
        sourceType: result.sourceType || undefined,
        sourceId: result.sourceId || undefined,
        approvedBy: result.approvedBy || undefined,
        approvedAt: result.approvedAt || undefined,
        reversedBy: result.reversedBy || undefined,
        reversedAt: result.reversedAt || undefined,
        reversalReason: result.reversalReason || undefined,
        originalEntryId: result.originalEntryId || undefined,
        notes: result.notes || undefined,
        attachments: result.attachments || [],
        totalDebits: result.totalDebits || '0.00',
        totalCredits: result.totalCredits || '0.00',
        createdBy: result.createdBy || '',
        createdAt: result.createdAt || new Date(),
        updatedAt: result.updatedAt || new Date(),
        lines: result.lines || [],
      } as JournalEntryResponseDto;
    });
  }

  async findJournalEntriesByAccount(tenantId: string, accountId: string, options?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: JournalEntryStatus;
    limit?: number;
  }) {
    // Verify account exists
    await this.chartOfAccountsService.findAccountById(tenantId, accountId);

    return await this.journalEntryRepository.findByAccount(tenantId, accountId, options);
  }

  async updateJournalEntry(tenantId: string, id: string, dto: UpdateJournalEntryDto, userId: string) {
    // Validate update data if lines are provided
    if (dto.lines) {
      await this.validateJournalEntry(tenantId, dto as CreateJournalEntryDto);
    }

    const updatedEntry = await this.journalEntryRepository.update(tenantId, id, dto, userId);

    if (!updatedEntry) {
      throw new NotFoundException('Journal entry not found or cannot be updated');
    }

    // Emit event
    this.eventEmitter.emit('journal-entry.updated', {
      tenantId,
      journalEntryId: id,
      userId,
    });

    return updatedEntry;
  }

  async postJournalEntry(tenantId: string, id: string, userId: string, postingDate?: Date) {
    const journalEntry = await this.findJournalEntryById(tenantId, id);

    if (journalEntry.status !== JournalEntryStatus.DRAFT) {
      throw new BadRequestException('Only draft journal entries can be posted');
    }

    // Validate that all accounts still exist and are active
    for (const line of journalEntry.lines) {
      const account = await this.chartOfAccountsService.findAccountById(tenantId, line.accountId);
      if (!(account as any).isActive) {
        throw new BadRequestException(`Account ${(account as any).accountName} is not active`);
      }
      if (!(account as any).allowManualEntries && journalEntry.sourceType === 'manual') {
        throw new BadRequestException(`Manual entries are not allowed for account ${(account as any).accountName}`);
      }
    }

    const postedEntry = await this.journalEntryRepository.post(tenantId, id, userId, postingDate);

    if (!postedEntry) {
      throw new NotFoundException('Journal entry not found or already posted');
    }

    // Update account balances
    await this.updateAccountBalances(tenantId, journalEntry.lines);

    // Emit event
    this.eventEmitter.emit('journal-entry.posted', {
      tenantId,
      journalEntryId: id,
      userId,
      journalEntry: postedEntry,
    });

    return postedEntry;
  }

  async reverseJournalEntry(tenantId: string, id: string, userId: string, reason: string, reversalDate?: Date) {
    const journalEntry = await this.findJournalEntryById(tenantId, id);

    if (journalEntry.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException('Only posted journal entries can be reversed');
    }

    const reversalEntry = await this.journalEntryRepository.reverse(tenantId, id, userId, reason, reversalDate);

    // Update account balances for the reversal
    await this.updateAccountBalances(tenantId, reversalEntry.lines);

    // Emit event
    this.eventEmitter.emit('journal-entry.reversed', {
      tenantId,
      originalEntryId: id,
      reversalEntryId: reversalEntry.id,
      userId,
      reason,
    });

    return reversalEntry;
  }

  async deleteJournalEntry(tenantId: string, id: string, userId: string) {
    const deletedEntry = await this.journalEntryRepository.delete(tenantId, id, userId);

    if (!deletedEntry) {
      throw new NotFoundException('Journal entry not found or cannot be deleted');
    }

    // Emit event
    this.eventEmitter.emit('journal-entry.deleted', {
      tenantId,
      journalEntryId: id,
      userId,
    });

    return deletedEntry;
  }

  async getAccountLedger(tenantId: string, accountId: string, options?: {
    dateFrom?: Date;
    dateTo?: Date;
    includeUnposted?: boolean;
  }) {
    // Verify account exists
    await this.chartOfAccountsService.findAccountById(tenantId, accountId);

    const ledgerEntries = await this.journalEntryRepository.getAccountLedger(tenantId, accountId, options);

    // Calculate running balance
    let runningBalance = 0;
    const account = await this.chartOfAccountsService.findAccountById(tenantId, accountId);
    const isDebit = isDebitAccount((account as any).normalBalance);

    const ledgerWithBalance = ledgerEntries.map(entry => {
      const debitAmount = parseFloat(entry.debitAmount);
      const creditAmount = parseFloat(entry.creditAmount);

      if (isDebit) {
        runningBalance += debitAmount - creditAmount;
      } else {
        runningBalance += creditAmount - debitAmount;
      }

      return {
        ...entry,
        runningBalance: runningBalance.toFixed(2),
      };
    });

    return ledgerWithBalance;
  }

  async createAutomaticJournalEntry(
    tenantId: string,
    description: string,
    sourceType: string,
    sourceId: string,
    lines: Array<{
      accountId: string;
      debitAmount: string;
      creditAmount: string;
      description?: string;
      reference?: string;
      departmentId?: string;
      projectId?: string;
      locationId?: string;
      customerId?: string;
      supplierId?: string;
    }>,
    userId: string,
    autoPost = true
  ) {
    // Add line numbers
    const linesWithNumbers = lines.map((line, index) => ({
      ...line,
      lineNumber: index + 1,
    }));

    const dto: CreateJournalEntryDto = {
      entryDate: new Date().toISOString(),
      description,
      sourceType,
      sourceId,
      lines: linesWithNumbers,
    };

    const journalEntry = await this.createJournalEntry(tenantId, dto, userId);

    if (autoPost) {
      return await this.postJournalEntry(tenantId, journalEntry.id, userId);
    }

    return journalEntry;
  }

  private async validateJournalEntry(tenantId: string, dto: CreateJournalEntryDto | UpdateJournalEntryDto) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Journal entry must have at least one line');
    }

    // Validate that debits equal credits
    const totalDebits = dto.lines.reduce((sum, line) => sum + parseFloat(line.debitAmount), 0);
    const totalCredits = dto.lines.reduce((sum, line) => sum + parseFloat(line.creditAmount), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new BadRequestException('Total debits must equal total credits');
    }

    // Validate that each line has either debit or credit (not both or neither)
    for (const line of dto.lines) {
      const debitAmount = parseFloat(line.debitAmount);
      const creditAmount = parseFloat(line.creditAmount);

      if (debitAmount > 0 && creditAmount > 0) {
        throw new BadRequestException('A line cannot have both debit and credit amounts');
      }

      if (debitAmount === 0 && creditAmount === 0) {
        throw new BadRequestException('A line must have either a debit or credit amount');
      }

      if (debitAmount < 0 || creditAmount < 0) {
        throw new BadRequestException('Amounts cannot be negative');
      }

      // Validate account exists and is active
      const account = await this.chartOfAccountsService.findAccountById(tenantId, line.accountId);
      if (!(account as any).isActive) {
        throw new BadRequestException(`Account ${(account as any).accountName} is not active`);
      }

      // Check if manual entries are allowed for this account
      if (!(account as any).allowManualEntries && (dto as any).sourceType === 'manual') {
        throw new BadRequestException(`Manual entries are not allowed for account ${(account as any).accountName}`);
      }

      // Validate required dimensions
      if ((account as any).requireDepartment && !line.departmentId) {
        throw new BadRequestException(`Department is required for account ${(account as any).accountName}`);
      }

      if ((account as any).requireProject && !line.projectId) {
        throw new BadRequestException(`Project is required for account ${(account as any).accountName}`);
      }
    }

    // Validate line numbers are unique and sequential
    const lineNumbers = dto.lines.map(line => line.lineNumber);
    const uniqueLineNumbers = new Set(lineNumbers);
    
    if (lineNumbers.length !== uniqueLineNumbers.size) {
      throw new BadRequestException('Line numbers must be unique');
    }

    const sortedLineNumbers = [...lineNumbers].sort((a, b) => a - b);
    for (let i = 0; i < sortedLineNumbers.length; i++) {
      if (sortedLineNumbers[i] !== i + 1) {
        throw new BadRequestException('Line numbers must be sequential starting from 1');
      }
    }
  }

  private async updateAccountBalances(tenantId: string, lines: any[]) {
    for (const line of lines) {
      const account = await this.chartOfAccountsService.findAccountById(tenantId, line.accountId);
      const currentBalance = parseFloat((account as any).currentBalance || '0');
      const debitAmount = parseFloat(line.debitAmount);
      const creditAmount = parseFloat(line.creditAmount);

      let newBalance: number;
      if (isDebitAccount((account as any).normalBalance)) {
        newBalance = currentBalance + debitAmount - creditAmount;
      } else {
        newBalance = currentBalance + creditAmount - debitAmount;
      }

      await this.chartOfAccountsService.updateAccountBalance(
        tenantId,
        line.accountId,
        newBalance.toFixed(2)
      );
    }
  }

  async validateJournalEntryPermissions(tenantId: string, userId: string, action: string) {
    // This would integrate with the permission system
    // For now, we'll implement basic validation
    
    const allowedActions = ['create', 'read', 'update', 'delete', 'post', 'reverse'];
    if (!allowedActions.includes(action)) {
      throw new ForbiddenException('Invalid action');
    }

    // Additional permission checks would go here
    // e.g., check user roles, business tier, etc.
    
    return true;
  }
}