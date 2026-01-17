import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, IsDateString, IsUUID, Min } from 'class-validator';

@InputType()
export class CreateFiscalPeriodInput {
  @Field()
  @IsString()
  periodName!: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1900)
  fiscalYear!: number;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  periodNumber!: number;

  @Field()
  @IsDateString()
  startDate!: string;

  @Field()
  @IsDateString()
  endDate!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class UpdateFiscalPeriodInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  periodName?: string;

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
  notes?: string;
}

@InputType()
export class CloseFiscalPeriodInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  closedDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class CreateStandardFiscalYearInput {
  @Field(() => Int)
  @IsNumber()
  @Min(1900)
  fiscalYear!: number;

  @Field()
  @IsDateString()
  startDate!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  periodType?: string; // 'monthly', 'quarterly'

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class ProcessYearEndInput {
  @Field(() => Int)
  @IsNumber()
  @Min(1900)
  fiscalYear!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  processDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}