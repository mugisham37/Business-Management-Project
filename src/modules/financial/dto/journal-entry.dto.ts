import { IsString, IsOptional, IsUUID, IsDateString, IsArray, ValidateNested, IsDecimal, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  REVERSED = 'reversed',
  VOIDED = 'voided',
}

export enum ReconciliationStatus {
  UNRECONCILED = 'unreconciled',
  RECONCILED = 'reconciled',
  DISPUTED = 'disputed',
}

export class CreateJournalEntryLineDto {
  @ApiProperty({ description: 'Account ID' })
  @IsUUID()
  accountId!: string;

  @ApiProperty({ description: 'Line number' })
  @IsNumber()
  @Min(1)
  lineNumber!: number;

  @ApiPropertyOptional({ description: 'Line description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Debit amount', example: '100.00' })
  @IsDecimal({ decimal_digits: '0,2' })
  debitAmount!: string;

  @ApiProperty({ description: 'Credit amount', example: '0.00' })
  @IsDecimal({ decimal_digits: '0,2' })
  creditAmount!: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Location ID' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Customer ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Line reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'External reference' })
  @IsOptional()
  @IsString()
  externalReference?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ description: 'Entry date' })
  @IsDateString()
  entryDate!: string;

  @ApiProperty({ description: 'Entry description' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: 'Reference (invoice number, check number, etc.)' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Source type (manual, pos_transaction, payroll, etc.)' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Source record ID' })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Attachments' })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiProperty({ description: 'Journal entry lines', type: [CreateJournalEntryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines!: CreateJournalEntryLineDto[];
}

export class UpdateJournalEntryDto {
  @ApiPropertyOptional({ description: 'Entry date' })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiPropertyOptional({ description: 'Entry description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Attachments' })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiPropertyOptional({ description: 'Journal entry lines', type: [CreateJournalEntryLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines?: CreateJournalEntryLineDto[];
}

export class JournalEntryLineResponseDto {
  @ApiProperty({ description: 'Line ID' })
  id!: string;

  @ApiProperty({ description: 'Journal entry ID' })
  journalEntryId!: string;

  @ApiProperty({ description: 'Account ID' })
  accountId!: string;

  @ApiProperty({ description: 'Line number' })
  lineNumber!: number;

  @ApiPropertyOptional({ description: 'Line description' })
  description?: string;

  @ApiProperty({ description: 'Debit amount' })
  debitAmount!: string;

  @ApiProperty({ description: 'Credit amount' })
  creditAmount!: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  projectId?: string;

  @ApiPropertyOptional({ description: 'Location ID' })
  locationId?: string;

  @ApiPropertyOptional({ description: 'Customer ID' })
  customerId?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  supplierId?: string;

  @ApiProperty({ enum: ReconciliationStatus, description: 'Reconciliation status' })
  reconciliationStatus!: ReconciliationStatus;

  @ApiPropertyOptional({ description: 'Reconciled timestamp' })
  reconciledAt?: Date;

  @ApiPropertyOptional({ description: 'Reconciled by user ID' })
  reconciledBy?: string;

  @ApiPropertyOptional({ description: 'Line reference' })
  reference?: string;

  @ApiPropertyOptional({ description: 'External reference' })
  externalReference?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class JournalEntryResponseDto {
  @ApiProperty({ description: 'Entry ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Entry number' })
  entryNumber!: string;

  @ApiProperty({ description: 'Entry date' })
  entryDate!: Date;

  @ApiPropertyOptional({ description: 'Posting date' })
  postingDate?: Date;

  @ApiProperty({ description: 'Entry description' })
  description!: string;

  @ApiPropertyOptional({ description: 'Reference' })
  reference?: string;

  @ApiProperty({ enum: JournalEntryStatus, description: 'Entry status' })
  status!: JournalEntryStatus;

  @ApiPropertyOptional({ description: 'Source type' })
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Source ID' })
  sourceId?: string;

  @ApiPropertyOptional({ description: 'Approved by user ID' })
  approvedBy?: string;

  @ApiPropertyOptional({ description: 'Approved timestamp' })
  approvedAt?: Date;

  @ApiPropertyOptional({ description: 'Reversed by user ID' })
  reversedBy?: string;

  @ApiPropertyOptional({ description: 'Reversed timestamp' })
  reversedAt?: Date;

  @ApiPropertyOptional({ description: 'Reversal reason' })
  reversalReason?: string;

  @ApiPropertyOptional({ description: 'Original entry ID (for reversals)' })
  originalEntryId?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Attachments' })
  attachments?: any[];

  @ApiProperty({ description: 'Total debits' })
  totalDebits!: string;

  @ApiProperty({ description: 'Total credits' })
  totalCredits!: string;

  @ApiProperty({ description: 'Created by user ID' })
  createdBy!: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Journal entry lines', type: [JournalEntryLineResponseDto] })
  lines!: JournalEntryLineResponseDto[];
}

export class PostJournalEntryDto {
  @ApiPropertyOptional({ description: 'Posting date (defaults to current date)' })
  @IsOptional()
  @IsDateString()
  postingDate?: string;
}

export class ReverseJournalEntryDto {
  @ApiProperty({ description: 'Reversal reason' })
  @IsString()
  reversalReason!: string;

  @ApiPropertyOptional({ description: 'Reversal date (defaults to current date)' })
  @IsOptional()
  @IsDateString()
  reversalDate?: string;
}

export class JournalEntryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;

  @ApiPropertyOptional({ description: 'Filter by account ID' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filter by source type' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search in description and reference' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}