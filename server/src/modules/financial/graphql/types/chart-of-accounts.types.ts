import { ObjectType, Field, ID } from '@nestjs/graphql';
import { AccountType, AccountSubType, NormalBalance } from '../enums';
import { DecimalScalar } from '../scalars';

@ObjectType()
export class ChartOfAccount {
  @Field(() => ID)
  id!: string;

  @Field()
  accountNumber!: string;

  @Field()
  accountName!: string;

  @Field(() => AccountType)
  accountType!: AccountType;

  @Field(() => AccountSubType)
  accountSubType!: AccountSubType;

  @Field(() => ID, { nullable: true })
  parentAccountId?: string;

  @Field(() => ChartOfAccount, { nullable: true })
  parentAccount?: ChartOfAccount;

  @Field(() => [ChartOfAccount])
  childAccounts!: ChartOfAccount[];

  @Field(() => NormalBalance)
  normalBalance!: NormalBalance;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  taxReportingCategory?: string;

  @Field()
  isActive!: boolean;

  @Field()
  isSystemAccount!: boolean;

  @Field()
  allowManualJournalEntries!: boolean;

  @Field()
  requireDepartment!: boolean;

  @Field()
  requireProject!: boolean;

  @Field()
  requireCustomer!: boolean;

  @Field()
  requireSupplier!: boolean;

  @Field(() => DecimalScalar)
  currentBalance!: string;

  @Field(() => DecimalScalar)
  beginningBalance!: string;

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
export class AccountBalance {
  @Field(() => ID)
  accountId!: string;

  @Field(() => ChartOfAccount)
  account!: ChartOfAccount;

  @Field(() => DecimalScalar)
  debitBalance!: string;

  @Field(() => DecimalScalar)
  creditBalance!: string;

  @Field(() => DecimalScalar)
  netBalance!: string;

  @Field()
  asOfDate!: Date;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class AccountHierarchy {
  @Field(() => ChartOfAccount)
  account!: ChartOfAccount;

  @Field(() => [AccountHierarchy])
  children!: AccountHierarchy[];

  @Field()
  level!: number;

  @Field()
  hasChildren!: boolean;
}