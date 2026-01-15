import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, like, isNull, sql, gte, lte, or } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { journalEntries, journalEntryLines } from '../../database/schema/financial.schema';
import { CreateJournalEntryDto, UpdateJournalEntryDto, JournalEntryStatus, JournalEntryQueryDto } from '../dto/journal-entry.dto';

@Injectable()
export class JournalEntryRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(tenantId: string, dto: CreateJournalEntryDto, userId: string) {
    const entryNumber = await this.generateEntryNumber(tenantId);
    
    // Calculate totals
    const totalDebits = dto.lines.reduce((sum, line) => sum + parseFloat(line.debitAmount), 0);
    const totalCredits = dto.lines.reduce((sum, line) => sum + parseFloat(line.creditAmount), 0);

    // Validate that debits equal credits
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error('Total debits must equal total credits');
    }

    return await this.drizzle.getDb().transaction(async (tx) => {
      // Create journal entry
      const journalEntries_result = await tx
        .insert(journalEntries)
        .values({
          tenantId,
          entryNumber,
          entryDate: new Date(dto.entryDate),
          description: dto.description,
          reference: dto.reference,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          notes: dto.notes,
          attachments: dto.attachments || [],
          totalDebits: totalDebits.toFixed(2),
          totalCredits: totalCredits.toFixed(2),
          status: JournalEntryStatus.DRAFT,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const journalEntry = Array.isArray(journalEntries_result) ? journalEntries_result[0] : (journalEntries_result as any);

      // Create journal entry lines
      const lines = await Promise.all(
        dto.lines.map(async (line) => {
          const entryLines_result = await tx
            .insert(journalEntryLines)
            .values({
              tenantId,
              journalEntryId: journalEntry.id,
              accountId: line.accountId,
              lineNumber: line.lineNumber,
              description: line.description,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              departmentId: line.departmentId,
              projectId: line.projectId,
              locationId: line.locationId,
              customerId: line.customerId,
              supplierId: line.supplierId,
              reference: line.reference,
              externalReference: line.externalReference,
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();
          const entryLine = Array.isArray(entryLines_result) ? entryLines_result[0] : (entryLines_result as any);
          return entryLine;
        })
      );

      return { ...journalEntry, lines };
    });
  }

  async findById(tenantId: string, id: string) {
    const results = await this.drizzle.getDb()
      .select()
      .from(journalEntries)
      .where(and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.id, id),
        isNull(journalEntries.deletedAt)
      ));

    const journalEntry = Array.isArray(results) ? results[0] : (results as any);

    if (!journalEntry) {
      return null;
    }

    // Get lines
    const lines = await this.drizzle.getDb()
      .select()
      .from(journalEntryLines)
      .where(and(
        eq(journalEntryLines.tenantId, tenantId),
        eq(journalEntryLines.journalEntryId, id),
        isNull(journalEntryLines.deletedAt)
      ))
      .orderBy(asc(journalEntryLines.lineNumber));

    return { ...journalEntry, lines };
  }

  async findAll(tenantId: string, query: JournalEntryQueryDto = {}) {
    const conditions = [
      eq(journalEntries.tenantId, tenantId),
      isNull(journalEntries.deletedAt)
    ];

    // Apply filters
    if (query.status) {
      conditions.push(eq(journalEntries.status, query.status));
    }

    if (query.sourceType) {
      conditions.push(eq(journalEntries.sourceType, query.sourceType));
    }

    if (query.dateFrom) {
      conditions.push(gte(journalEntries.entryDate, new Date(query.dateFrom)));
    }

    if (query.dateTo) {
      conditions.push(lte(journalEntries.entryDate, new Date(query.dateTo)));
    }

    if (query.search) {
      conditions.push(
        or(
          like(journalEntries.description, `%${query.search}%`),
          like(journalEntries.reference, `%${query.search}%`),
          like(journalEntries.entryNumber, `%${query.search}%`)
        ) as any
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const entries = await this.drizzle.getDb()
      .select()
      .from(journalEntries)
      .where(and(...conditions))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(limit)
      .offset(offset);

    // Get lines for each entry
    const entriesWithLines = await Promise.all(
      entries.map(async (entry) => {
        const lines = await this.drizzle.getDb()
          .select()
          .from(journalEntryLines)
          .where(and(
            eq(journalEntryLines.tenantId, tenantId),
            eq(journalEntryLines.journalEntryId, entry.id),
            isNull(journalEntryLines.deletedAt)
          ))
          .orderBy(asc(journalEntryLines.lineNumber));

        return { ...entry, lines };
      })
    );

    return entriesWithLines;
  }

  async findByAccount(tenantId: string, accountId: string, options?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: JournalEntryStatus;
    limit?: number;
  }) {
    const conditions = [
      eq(journalEntryLines.tenantId, tenantId),
      eq(journalEntryLines.accountId, accountId),
      isNull(journalEntryLines.deletedAt),
      isNull(journalEntries.deletedAt)
    ];

    if (options?.dateFrom) {
      conditions.push(gte(journalEntries.entryDate, options.dateFrom));
    }

    if (options?.dateTo) {
      conditions.push(lte(journalEntries.entryDate, options.dateTo));
    }

    if (options?.status) {
      conditions.push(eq(journalEntries.status, options.status));
    }

    const query = this.drizzle.getDb()
      .select({
        journalEntry: journalEntries,
        line: journalEntryLines,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...conditions))
      .orderBy(desc(journalEntries.entryDate), asc(journalEntryLines.lineNumber));

    if (options?.limit) {
      query.limit(options.limit);
    }

    const results = await query;

    // Group by journal entry
    const entriesMap = new Map();
    for (const result of results) {
      const entryId = result.journalEntry.id;
      if (!entriesMap.has(entryId)) {
        entriesMap.set(entryId, {
          ...result.journalEntry,
          lines: []
        });
      }
      entriesMap.get(entryId).lines.push(result.line);
    }

    return Array.from(entriesMap.values());
  }

  async update(tenantId: string, id: string, dto: UpdateJournalEntryDto, userId: string) {
    return await this.drizzle.getDb().transaction(async (tx) => {
      // Check if entry can be updated (only draft entries)
      const existingResults = await tx
        .select({ status: journalEntries.status })
        .from(journalEntries)
        .where(and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.id, id),
          isNull(journalEntries.deletedAt)
        ));

      const existing = Array.isArray(existingResults) ? existingResults[0] : (existingResults as any);

      if (!existing) {
        throw new Error('Journal entry not found');
      }

      if (existing.status !== JournalEntryStatus.DRAFT) {
        throw new Error('Only draft journal entries can be updated');
      }

      // Update journal entry
      const updateData: any = {
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (dto.entryDate) updateData.entryDate = new Date(dto.entryDate);
      if (dto.description) updateData.description = dto.description;
      if (dto.reference !== undefined) updateData.reference = dto.reference;
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (dto.attachments !== undefined) updateData.attachments = dto.attachments;

      // If lines are provided, recalculate totals
      if (dto.lines) {
        const totalDebits = dto.lines.reduce((sum, line) => sum + parseFloat(line.debitAmount), 0);
        const totalCredits = dto.lines.reduce((sum, line) => sum + parseFloat(line.creditAmount), 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
          throw new Error('Total debits must equal total credits');
        }

        updateData.totalDebits = totalDebits.toFixed(2);
        updateData.totalCredits = totalCredits.toFixed(2);

        // Delete existing lines
        await tx
          .update(journalEntryLines)
          .set({
            deletedAt: new Date(),
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(and(
            eq(journalEntryLines.tenantId, tenantId),
            eq(journalEntryLines.journalEntryId, id),
            isNull(journalEntryLines.deletedAt)
          ));

        // Create new lines
        await Promise.all(
          dto.lines.map(async (line) => {
            await tx
              .insert(journalEntryLines)
              .values({
                tenantId,
                journalEntryId: id,
                accountId: line.accountId,
                lineNumber: line.lineNumber,
                description: line.description,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount,
                departmentId: line.departmentId,
                projectId: line.projectId,
                locationId: line.locationId,
                customerId: line.customerId,
                supplierId: line.supplierId,
                reference: line.reference,
                externalReference: line.externalReference,
                createdBy: userId,
                updatedBy: userId,
              });
          })
        );
      }

      const updatedEntryResults = await tx
        .update(journalEntries)
        .set(updateData)
        .where(and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.id, id),
          isNull(journalEntries.deletedAt)
        ))
        .returning();

      const updatedEntry = Array.isArray(updatedEntryResults) ? updatedEntryResults[0] : (updatedEntryResults as any);

      return updatedEntry;
    });
  }

  async post(tenantId: string, id: string, userId: string, postingDate?: Date) {
    const entryResults = await this.drizzle.getDb()
      .update(journalEntries)
      .set({
        status: JournalEntryStatus.POSTED,
        postingDate: postingDate || new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.id, id),
        eq(journalEntries.status, JournalEntryStatus.DRAFT),
        isNull(journalEntries.deletedAt)
      ))
      .returning();

    const entry = Array.isArray(entryResults) ? entryResults[0] : (entryResults as any);

    return entry;
  }

  async reverse(tenantId: string, id: string, userId: string, reason: string, reversalDate?: Date) {
    return await this.drizzle.getDb().transaction(async (tx) => {
      // Get original entry
      const original = await this.findById(tenantId, id);
      if (!original) {
        throw new Error('Journal entry not found');
      }

      const originalEntry = original as any;
      if (originalEntry.status !== JournalEntryStatus.POSTED) {
        throw new Error('Only posted journal entries can be reversed');
      }

      // Mark original as reversed
      await tx
        .update(journalEntries)
        .set({
          status: JournalEntryStatus.REVERSED,
          reversedBy: userId,
          reversedAt: new Date(),
          reversalReason: reason,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(journalEntries.id, id));

      // Create reversal entry
      const reversalEntryNumber = await this.generateEntryNumber(tenantId);
      const reversalEntryResults = await tx
        .insert(journalEntries)
        .values({
          tenantId,
          entryNumber: reversalEntryNumber,
          entryDate: reversalDate || new Date(),
          postingDate: reversalDate || new Date(),
          description: `REVERSAL: ${originalEntry.description}`,
          reference: originalEntry.reference,
          status: JournalEntryStatus.POSTED,
          sourceType: 'reversal',
          sourceId: originalEntry.id,
          originalEntryId: originalEntry.id,
          notes: `Reversal of entry ${originalEntry.entryNumber}: ${reason}`,
          totalDebits: originalEntry.totalCredits, // Swap debits and credits
          totalCredits: originalEntry.totalDebits,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const reversalEntry = Array.isArray(reversalEntryResults) ? reversalEntryResults[0] : (reversalEntryResults as any);

      // Create reversal lines (swap debits and credits)
      await Promise.all(
        originalEntry.lines.map(async (line: any) => {
          await tx
            .insert(journalEntryLines)
            .values({
              tenantId,
              journalEntryId: reversalEntry.id,
              accountId: line.accountId,
              lineNumber: line.lineNumber,
              description: `REVERSAL: ${line.description || ''}`,
              debitAmount: line.creditAmount, // Swap amounts
              creditAmount: line.debitAmount,
              departmentId: line.departmentId,
              projectId: line.projectId,
              locationId: line.locationId,
              customerId: line.customerId,
              supplierId: line.supplierId,
              reference: line.reference,
              externalReference: line.externalReference,
              createdBy: userId,
              updatedBy: userId,
            });
        })
      );

      return reversalEntry;
    });
  }

  async delete(tenantId: string, id: string, userId: string) {
    // Check if entry can be deleted (only draft entries)
    const existingResults = await this.drizzle.getDb()
      .select({ status: journalEntries.status })
      .from(journalEntries)
      .where(and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.id, id),
        isNull(journalEntries.deletedAt)
      ));

    const existing = Array.isArray(existingResults) ? existingResults[0] : (existingResults as any);

    if (!existing) {
      throw new Error('Journal entry not found');
    }

    if (existing.status !== JournalEntryStatus.DRAFT) {
      throw new Error('Only draft journal entries can be deleted');
    }

    return await this.drizzle.getDb().transaction(async (tx) => {
      // Soft delete lines
      await tx
        .update(journalEntryLines)
        .set({
          deletedAt: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(journalEntryLines.tenantId, tenantId),
          eq(journalEntryLines.journalEntryId, id),
          isNull(journalEntryLines.deletedAt)
        ));

      // Soft delete entry
      const deletedEntryResults = await tx
        .update(journalEntries)
        .set({
          deletedAt: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.id, id),
          isNull(journalEntries.deletedAt)
        ))
        .returning();

      const deletedEntry = Array.isArray(deletedEntryResults) ? deletedEntryResults[0] : (deletedEntryResults as any);

      return deletedEntry;
    });
  }

  private async generateEntryNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE${year}`;

    // Get the last entry number for this year
    const lastEntryResults = await this.drizzle.getDb()
      .select({ entryNumber: journalEntries.entryNumber })
      .from(journalEntries)
      .where(and(
        eq(journalEntries.tenantId, tenantId),
        like(journalEntries.entryNumber, `${prefix}%`)
      ))
      .orderBy(desc(journalEntries.entryNumber))
      .limit(1);

    const lastEntry = Array.isArray(lastEntryResults) ? lastEntryResults[0] : (lastEntryResults as any);

    let nextNumber = 1;
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entryNumber.replace(prefix, ''));
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  async getAccountLedger(tenantId: string, accountId: string, options?: {
    dateFrom?: Date;
    dateTo?: Date;
    includeUnposted?: boolean;
  }) {
    const conditions = [
      eq(journalEntryLines.tenantId, tenantId),
      eq(journalEntryLines.accountId, accountId),
      isNull(journalEntryLines.deletedAt),
      isNull(journalEntries.deletedAt)
    ];

    if (!options?.includeUnposted) {
      conditions.push(eq(journalEntries.status, JournalEntryStatus.POSTED));
    }

    if (options?.dateFrom) {
      conditions.push(gte(journalEntries.entryDate, options.dateFrom));
    }

    if (options?.dateTo) {
      conditions.push(lte(journalEntries.entryDate, options.dateTo));
    }

    const ledgerEntries = await this.drizzle.getDb()
      .select({
        entryDate: journalEntries.entryDate,
        entryNumber: journalEntries.entryNumber,
        description: journalEntries.description,
        reference: journalEntries.reference,
        status: journalEntries.status,
        debitAmount: journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
        lineDescription: journalEntryLines.description,
        lineReference: journalEntryLines.reference,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...conditions))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.entryNumber));

    return ledgerEntries;
  }
}