import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsUUID, IsDateString, IsArray, ValidateNested, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JournalEntryStatus } from '../enums';
import { DecimalScalar } from '../scalars';

@InputType()
export class CreateJournalEntryLineInput {
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
  debitAmount!: string;

  @Field(() => DecimalScalar)
  creditAmount!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  externalReference?: string;
}

@InputType()
export class CreateJournalEntryInput {
  @Field()
  @IsDateString()
  entryDate!: string;

  @Field()
  @IsString()
  description!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @Field(() => [CreateJournalEntryLineInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineInput)
  lines!: CreateJournalEntryLineInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  requiresApproval?: boolean;
}

@InputType()
export class UpdateJournalEntryLineInput {
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
  debitAmount!: string;

  @Field(() => DecimalScalar)
  creditAmount!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  externalReference?: string;
}

@InputType()
export class UpdateJournalEntryInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @Field(() => [UpdateJournalEntryLineInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateJournalEntryLineInput)
  lines?: UpdateJournalEntryLineInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class PostJournalEntryInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  postDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class ReverseJournalEntryInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field()
  @IsDateString()
  reversalDate!: string;

  @Field()
  @IsString()
  reversalReason!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class JournalEntryQueryInput {
  @Field(() => JournalEntryStatus, { nullable: true })
  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}