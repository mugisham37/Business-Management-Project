import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { JournalEntryStatus, ReconciliationStatus } from '../enums';
import { DecimalScalar } from '../scalars';
import { ChartOfAccount } from './chart-of-accounts.types';

@ObjectType()
export class JournalEntryLine {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  journalEntryId!: string;

  @Field(() => ID)
  accountId!: string;

  @Field(() => ChartOfAccount)
  account!: ChartOfAccount;

  @Field(() => Int)
  lineNumber!: number;

  @Field({ nullable: true })
  description?: string;

  @Field(() => DecimalScalar)
  debitAmount!: string;

  @Field(() => DecimalScalar)
  creditAmount!: string;

  @Field(() => ID, { nullable: true })
  departmentId?: string;

  @Field(() => ID, { nullable: true })
  projectId?: string;

  @Field(() => ID, { nullable: true })
  locationId?: string;

  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => ID, { nullable: true })
  supplierId?: string;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  externalReference?: string;

  @Field(() => ReconciliationStatus)
  reconciliationStatus!: ReconciliationStatus;

  @Field({ nullable: true })
  reconciledDate?: Date;

  @Field(() => ID, { nullable: true })
  reconciledBy?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class JournalEntry {
  @Field(() => ID)
  id!: string;

  @Field()
  entryNumber!: string;

  @Field()
  entryDate!: Date;

  @Field()
  description!: string;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  sourceType?: string;

  @Field(() => ID, { nullable: true })
  sourceId?: string;

  @Field(() => JournalEntryStatus)
  status!: JournalEntryStatus;

  @Field(() => [JournalEntryLine])
  lines!: JournalEntryLine[];

  @Field(() => DecimalScalar)
  totalDebits!: string;

  @Field(() => DecimalScalar)
  totalCredits!: string;

  @Field()
  isBalanced!: boolean;

  @Field({ nullable: true })
  postedDate?: Date;

  @Field(() => ID, { nullable: true })
  postedBy?: string;

  @Field(() => ID, { nullable: true })
  reversalOfEntryId?: string;

  @Field(() => JournalEntry, { nullable: true })
  reversalOfEntry?: JournalEntry;

  @Field(() => ID, { nullable: true })
  reversedByEntryId?: string;

  @Field(() => JournalEntry, { nullable: true })
  reversedByEntry?: JournalEntry;

  @Field({ nullable: true })
  reversalReason?: string;

  @Field()
  requiresApproval!: boolean;

  @Field({ nullable: true })
  approvedDate?: Date;

  @Field(() => ID, { nullable: true })
  approvedBy?: string;

  @Field({ nullable: true })
  approvalNotes?: string;

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