import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsDateString, IsUUID, IsArray } from 'class-validator';
import { DecimalScalar } from '../scalars';

@InputType()
export class CreateReconciliationInput {
  @Field(() => ID)
  @IsUUID()
  accountId!: string;

  @Field()
  @IsDateString()
  reconciliationDate!: string;

  @Field()
  @IsDateString()
  statementDate!: string;

  @Field(() => DecimalScalar)
  beginningBalance!: string;

  @Field(() => DecimalScalar)
  endingBalance!: string;

  @Field(() => DecimalScalar)
  statementBalance!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class UpdateReconciliationInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  reconciliationDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  statementDate?: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  beginningBalance?: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  endingBalance?: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  statementBalance?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class MarkReconciliationItemInput {
  @Field(() => ID)
  @IsUUID()
  reconciliationId!: string;

  @Field(() => ID)
  @IsUUID()
  journalEntryLineId!: string;

  @Field()
  @IsString()
  status!: string; // 'reconciled', 'disputed', 'unreconciled'

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  clearedDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  disputeReason?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class AutoReconcileInput {
  @Field(() => ID)
  @IsUUID()
  reconciliationId!: string;

  @Field({ nullable: true })
  @IsOptional()
  toleranceAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  matchByReference?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  matchByAmount?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  matchByDate?: boolean;
}

@InputType()
export class ReconciliationQueryInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  limit?: number;
}