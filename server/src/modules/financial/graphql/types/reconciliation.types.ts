import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { DecimalScalar } from '../scalars';
import { ChartOfAccount } from './chart-of-accounts.types';
import { JournalEntryLine } from './journal-entry.types';

@ObjectType()
export class Reconciliation {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  accountId!: string;

  @Field(() => ChartOfAccount)
  account!: ChartOfAccount;

  @Field()
  reconciliationDate!: Date;

  @Field()
  statementDate!: Date;

  @Field(() => DecimalScalar)
  beginningBalance!: string;

  @Field(() => DecimalScalar)
  endingBalance!: string;

  @Field(() => DecimalScalar)
  statementBalance!: string;

  @Field(() => DecimalScalar)
  adjustedBalance!: string;

  @Field()
  status!: string;

  @Field(() => [ReconciliationItem])
  items!: ReconciliationItem[];

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  completedDate?: Date;

  @Field(() => ID, { nullable: true })
  completedBy?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ID)
  createdBy!: string;

  @Field(() => ID, { nullable: true })
  updatedBy?: string;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class ReconciliationItem {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  reconciliationId!: string;

  @Field(() => Reconciliation)
  reconciliation!: Reconciliation;

  @Field(() => ID)
  journalEntryLineId!: string;

  @Field(() => JournalEntryLine)
  journalEntryLine!: JournalEntryLine;

  @Field()
  transactionDate!: Date;

  @Field()
  description!: string;

  @Field(() => DecimalScalar)
  amount!: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  clearedDate?: Date;

  @Field({ nullable: true })
  disputeReason?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class ReconciliationSummary {
  @Field(() => ID)
  accountId!: string;

  @Field(() => ChartOfAccount)
  account!: ChartOfAccount;

  @Field(() => Int)
  totalReconciliations!: number;

  @Field(() => Int)
  completedReconciliations!: number;

  @Field(() => Int)
  pendingReconciliations!: number;

  @Field(() => Int)
  disputedItems!: number;

  @Field(() => DecimalScalar)
  totalReconciledAmount!: string;

  @Field(() => DecimalScalar)
  totalUnreconciledAmount!: string;

  @Field()
  lastReconciliationDate?: Date;

  @Field()
  nextReconciliationDue?: Date;
}