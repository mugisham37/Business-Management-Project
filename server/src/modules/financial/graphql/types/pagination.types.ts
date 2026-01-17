import { ObjectType, Field, Int } from '@nestjs/graphql';
import { 
  ChartOfAccount, 
  JournalEntry, 
  Budget, 
  ARAPInvoice, 
  Reconciliation,
  FiscalPeriod,
  TaxReturn
} from './index';

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage!: boolean;

  @Field()
  hasPreviousPage!: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;
}

// Chart of Accounts Connection
@ObjectType()
export class ChartOfAccountEdge {
  @Field(() => ChartOfAccount)
  node!: ChartOfAccount;

  @Field()
  cursor!: string;
}

@ObjectType()
export class ChartOfAccountConnection {
  @Field(() => [ChartOfAccountEdge])
  edges!: ChartOfAccountEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Journal Entry Connection
@ObjectType()
export class JournalEntryEdge {
  @Field(() => JournalEntry)
  node!: JournalEntry;

  @Field()
  cursor!: string;
}

@ObjectType()
export class JournalEntryConnection {
  @Field(() => [JournalEntryEdge])
  edges!: JournalEntryEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Budget Connection
@ObjectType()
export class BudgetEdge {
  @Field(() => Budget)
  node!: Budget;

  @Field()
  cursor!: string;
}

@ObjectType()
export class BudgetConnection {
  @Field(() => [BudgetEdge])
  edges!: BudgetEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Invoice Connection
@ObjectType()
export class ARAPInvoiceEdge {
  @Field(() => ARAPInvoice)
  node!: ARAPInvoice;

  @Field()
  cursor!: string;
}

@ObjectType()
export class ARAPInvoiceConnection {
  @Field(() => [ARAPInvoiceEdge])
  edges!: ARAPInvoiceEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Reconciliation Connection
@ObjectType()
export class ReconciliationEdge {
  @Field(() => Reconciliation)
  node!: Reconciliation;

  @Field()
  cursor!: string;
}

@ObjectType()
export class ReconciliationConnection {
  @Field(() => [ReconciliationEdge])
  edges!: ReconciliationEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Fiscal Period Connection
@ObjectType()
export class FiscalPeriodEdge {
  @Field(() => FiscalPeriod)
  node!: FiscalPeriod;

  @Field()
  cursor!: string;
}

@ObjectType()
export class FiscalPeriodConnection {
  @Field(() => [FiscalPeriodEdge])
  edges!: FiscalPeriodEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Tax Return Connection
@ObjectType()
export class TaxReturnEdge {
  @Field(() => TaxReturn)
  node!: TaxReturn;

  @Field()
  cursor!: string;
}

@ObjectType()
export class TaxReturnConnection {
  @Field(() => [TaxReturnEdge])
  edges!: TaxReturnEdge[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Int)
  totalCount!: number;
}

// Batch Operation Results
@ObjectType()
export class BatchOperationResult {
  @Field(() => Int)
  totalProcessed!: number;

  @Field(() => Int)
  successCount!: number;

  @Field(() => Int)
  errorCount!: number;

  @Field(() => [String])
  errors!: string[];

  @Field(() => [String])
  warnings!: string[];

  @Field()
  batchId!: string;

  @Field()
  completedAt!: Date;
}