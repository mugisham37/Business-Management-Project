import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsArray, ValidateNested, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { 
  CreateJournalEntryInput, 
  CreateChartOfAccountInput, 
  CreateBudgetInput,
  CreateARAPInvoiceInput,
  CreateTaxRateInput
} from './index';

// Pagination Input
@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  last?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  before?: string;
}

// Batch Journal Entry Operations
@InputType()
export class BatchCreateJournalEntriesInput {
  @Field(() => [CreateJournalEntryInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryInput)
  entries!: CreateJournalEntryInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  batchDescription?: string;

  @Field({ nullable: true })
  @IsOptional()
  autoPost?: boolean;
}

@InputType()
export class BatchPostJournalEntriesInput {
  @Field(() => [ID])
  @IsArray()
  entryIds!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  postingDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  batchNotes?: string;
}

// Batch Account Operations
@InputType()
export class BatchCreateAccountsInput {
  @Field(() => [CreateChartOfAccountInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChartOfAccountInput)
  accounts!: CreateChartOfAccountInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  batchDescription?: string;
}

@InputType()
export class BatchUpdateAccountBalancesInput {
  @Field(() => [AccountBalanceUpdateInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountBalanceUpdateInput)
  updates!: AccountBalanceUpdateInput[];
}

@InputType()
export class AccountBalanceUpdateInput {
  @Field(() => ID)
  accountId!: string;

  @Field()
  newBalance!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

// Batch Budget Operations
@InputType()
export class BatchCreateBudgetsInput {
  @Field(() => [CreateBudgetInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetInput)
  budgets!: CreateBudgetInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  batchDescription?: string;
}

// Batch Invoice Operations
@InputType()
export class BatchCreateInvoicesInput {
  @Field(() => [CreateARAPInvoiceInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateARAPInvoiceInput)
  invoices!: CreateARAPInvoiceInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  batchDescription?: string;
}

// Batch Tax Rate Operations
@InputType()
export class BatchCreateTaxRatesInput {
  @Field(() => [CreateTaxRateInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaxRateInput)
  taxRates!: CreateTaxRateInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  batchDescription?: string;
}

// Bulk Import Operations
@InputType()
export class BulkImportInput {
  @Field()
  @IsString()
  importType!: string; // 'accounts', 'journal_entries', 'budgets', etc.

  @Field()
  @IsString()
  fileFormat!: string; // 'csv', 'xlsx', 'json'

  @Field()
  @IsString()
  fileData!: string; // Base64 encoded file data

  @Field({ nullable: true })
  @IsOptional()
  validateOnly?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  mappingConfig?: string; // JSON string for field mapping
}