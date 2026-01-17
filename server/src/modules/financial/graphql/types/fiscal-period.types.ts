import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { DecimalScalar } from '../scalars';

@ObjectType()
export class FiscalPeriod {
  @Field(() => ID)
  id!: string;

  @Field()
  periodName!: string;

  @Field(() => Int)
  fiscalYear!: number;

  @Field(() => Int)
  periodNumber!: number;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  status!: string;

  @Field()
  isClosed!: boolean;

  @Field({ nullable: true })
  closedDate?: Date;

  @Field(() => ID, { nullable: true })
  closedBy?: string;

  @Field(() => DecimalScalar, { nullable: true })
  totalRevenue?: string;

  @Field(() => DecimalScalar, { nullable: true })
  totalExpenses?: string;

  @Field(() => DecimalScalar, { nullable: true })
  netIncome?: string;

  @Field({ nullable: true })
  notes?: string;

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
export class FiscalYear {
  @Field(() => Int)
  year!: number;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field(() => [FiscalPeriod])
  periods!: FiscalPeriod[];

  @Field()
  status!: string;

  @Field(() => DecimalScalar)
  totalRevenue!: string;

  @Field(() => DecimalScalar)
  totalExpenses!: string;

  @Field(() => DecimalScalar)
  netIncome!: string;

  @Field(() => ID)
  tenantId!: string;
}

@ObjectType()
export class YearEndSummary {
  @Field(() => Int)
  fiscalYear!: number;

  @Field(() => DecimalScalar)
  totalRevenue!: string;

  @Field(() => DecimalScalar)
  totalExpenses!: string;

  @Field(() => DecimalScalar)
  netIncome!: string;

  @Field(() => DecimalScalar)
  retainedEarnings!: string;

  @Field(() => [AccountYearEndBalance])
  accountBalances!: AccountYearEndBalance[];

  @Field()
  processedDate!: Date;

  @Field(() => ID)
  processedBy!: string;
}

@ObjectType()
export class AccountYearEndBalance {
  @Field(() => ID)
  accountId!: string;

  @Field()
  accountNumber!: string;

  @Field()
  accountName!: string;

  @Field(() => DecimalScalar)
  beginningBalance!: string;

  @Field(() => DecimalScalar)
  endingBalance!: string;

  @Field(() => DecimalScalar)
  netChange!: string;
}