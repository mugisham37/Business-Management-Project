import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { DecimalScalar } from '../scalars';
import { ChartOfAccount } from './chart-of-accounts.types';

@ObjectType()
export class Budget {
  @Field(() => ID)
  id!: string;

  @Field()
  budgetName!: string;

  @Field()
  budgetYear!: number;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  status!: string;

  @Field(() => DecimalScalar)
  totalBudgetAmount!: string;

  @Field(() => DecimalScalar)
  totalActualAmount!: string;

  @Field(() => DecimalScalar)
  totalVariance!: string;

  @Field(() => [BudgetLine])
  budgetLines!: BudgetLine[];

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  approvedDate?: Date;

  @Field(() => ID, { nullable: true })
  approvedBy?: string;

  @Field()
  isActive!: boolean;

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
export class BudgetLine {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  budgetId!: string;

  @Field(() => Budget)
  budget!: Budget;

  @Field(() => ID)
  accountId!: string;

  @Field(() => ChartOfAccount)
  account!: ChartOfAccount;

  @Field(() => Int)
  lineNumber!: number;

  @Field({ nullable: true })
  description?: string;

  @Field(() => DecimalScalar)
  budgetAmount!: string;

  @Field(() => DecimalScalar)
  actualAmount!: string;

  @Field(() => DecimalScalar)
  variance!: string;

  @Field(() => DecimalScalar)
  variancePercentage!: string;

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
export class BudgetVarianceAnalysis {
  @Field(() => ID)
  budgetId!: string;

  @Field(() => Budget)
  budget!: Budget;

  @Field(() => DecimalScalar)
  totalBudget!: string;

  @Field(() => DecimalScalar)
  totalActual!: string;

  @Field(() => DecimalScalar)
  totalVariance!: string;

  @Field(() => DecimalScalar)
  variancePercentage!: string;

  @Field(() => [BudgetVarianceByAccount])
  accountVariances!: BudgetVarianceByAccount[];

  @Field()
  analysisDate!: Date;
}

@ObjectType()
export class BudgetVarianceByAccount {
  @Field(() => ID)
  accountId!: string;

  @Field(() => ChartOfAccount)
  account!: ChartOfAccount;

  @Field(() => DecimalScalar)
  budgetAmount!: string;

  @Field(() => DecimalScalar)
  actualAmount!: string;

  @Field(() => DecimalScalar)
  variance!: string;

  @Field(() => DecimalScalar)
  variancePercentage!: string;

  @Field()
  isFavorable!: boolean;
}