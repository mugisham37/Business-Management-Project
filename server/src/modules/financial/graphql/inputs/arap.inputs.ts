import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsDateString, IsUUID, IsArray, ValidateNested, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DecimalScalar } from '../scalars';
import { InvoiceType, PaymentType, PaymentMethod, ReportType } from '../enums';

@InputType()
export class CreateARAPInvoiceInput {
  @Field(() => InvoiceType)
  @IsEnum(InvoiceType)
  invoiceType!: InvoiceType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field()
  @IsDateString()
  invoiceDate!: string;

  @Field()
  @IsDateString()
  dueDate!: string;

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
  terms?: string;

  @Field(() => [CreateARAPInvoiceLineInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateARAPInvoiceLineInput)
  lines!: CreateARAPInvoiceLineInput[];
}

@InputType()
export class CreateARAPInvoiceLineInput {
  @Field(() => Int)
  @Min(1)
  lineNumber!: number;

  @Field()
  @IsString()
  description!: string;

  @Field(() => DecimalScalar)
  quantity!: string;

  @Field(() => DecimalScalar)
  unitPrice!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  taxCode?: string;
}

@InputType()
export class UpdateARAPInvoiceInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

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
  terms?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}

@InputType()
export class CreateARAPPaymentInput {
  @Field(() => PaymentType)
  @IsEnum(PaymentType)
  paymentType!: PaymentType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field()
  @IsDateString()
  paymentDate!: string;

  @Field(() => DecimalScalar)
  paymentAmount!: string;

  @Field(() => PaymentMethod)
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  checkNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class ApplyPaymentToInvoiceInput {
  @Field(() => ID)
  @IsUUID()
  paymentId!: string;

  @Field(() => ID)
  @IsUUID()
  invoiceId!: string;

  @Field(() => DecimalScalar)
  appliedAmount!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class GenerateAgingReportInput {
  @Field(() => ReportType)
  @IsEnum(ReportType)
  reportType!: ReportType;

  @Field()
  @IsDateString()
  asOfDate!: string;

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
  includeZeroBalances?: boolean;
}