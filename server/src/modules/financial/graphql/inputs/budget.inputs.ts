import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DecimalScalar } from '../scalars';

@InputType()
export class CreateBudgetInput {
  @Field()
  @IsString()
  budgetName!: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1900)
  budgetYear!: number;

  @Field()
  @IsDateString()
  startDate!: string;

  @Field()
  @IsDateString()
  endDate!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => [CreateBudgetLineInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineInput)
  budgetLines!: CreateBudgetLineInput[];
}

@InputType()
export class CreateBudgetLineInput {
  @Field(() => ID)
  @IsUUID()
  accountId!: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  lineNumber!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => DecimalScalar)
  budgetAmount!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class UpdateBudgetInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  budgetName?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1900)
  budgetYear?: number;

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
  description?: string;

  @Field(() => [UpdateBudgetLineInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBudgetLineInput)
  budgetLines?: UpdateBudgetLineInput[];
}

@InputType()
export class UpdateBudgetLineInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  id?: string;

  @Field(() => ID)
  @IsUUID()
  accountId!: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  lineNumber!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => DecimalScalar)
  budgetAmount!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class CopyBudgetInput {
  @Field(() => ID)
  @IsUUID()
  sourceBudgetId!: string;

  @Field()
  @IsString()
  newBudgetName!: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1900)
  newBudgetYear!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  adjustmentPercentage?: number;
}

@InputType()
export class BudgetVarianceQueryInput {
  @Field(() => ID)
  @IsUUID()
  budgetId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountType?: string;

  @Field({ nullable: true })
  @IsOptional()
  varianceThreshold?: number;
}