import { InputType, Field, ID, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEnum, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethodEnum, TransactionStatusEnum } from '../types/pos.types';

@InputType({ description: 'Transaction item input' })
export class CreateTransactionItemInput {
  @Field(() => ID)
  @IsString()
  productId!: string;

  @Field()
  @IsString()
  productSku!: string;

  @Field()
  @IsString()
  productName!: string;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  variantInfo?: Record<string, any>;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType({ description: 'Create transaction input' })
export class CreateTransactionInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  customerId?: string;

  @Field(() => ID)
  @IsString()
  locationId!: string;

  @Field(() => [CreateTransactionItemInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionItemInput)
  items!: CreateTransactionItemInput[];

  @Field(() => PaymentMethodEnum)
  @IsEnum(PaymentMethodEnum)
  paymentMethod!: PaymentMethodEnum;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tipAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isOfflineTransaction?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType({ description: 'Update transaction input' })
export class UpdateTransactionInput {
  @Field(() => TransactionStatusEnum, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionStatusEnum)
  status?: TransactionStatusEnum;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType({ description: 'Void transaction input' })
export class VoidTransactionInput {
  @Field()
  @IsString()
  reason!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'Refund transaction input' })
export class RefundTransactionInput {
  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @Field()
  @IsString()
  reason!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'Transaction query filters' })
export class TransactionQueryInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  locationId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  customerId?: string;

  @Field({ nullable: true })
  @IsOptional()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  endDate?: Date;

  @Field(() => TransactionStatusEnum, { nullable: true })
  @IsOptional()
  @IsEnum(TransactionStatusEnum)
  status?: TransactionStatusEnum;
}

// Payment-related input types
@InputType({ description: 'Payment request input' })
export class PaymentRequestInput {
  @Field(() => PaymentMethodEnum)
  @IsEnum(PaymentMethodEnum)
  paymentMethod!: PaymentMethodEnum;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @Field({ nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

// Receipt-related input types
@InputType({ description: 'Email receipt options input' })
export class EmailReceiptOptionsInput {
  @Field()
  @IsString()
  to!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  template?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeItemDetails?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeTaxBreakdown?: boolean;
}

@InputType({ description: 'SMS receipt options input' })
export class SmsReceiptOptionsInput {
  @Field()
  @IsString()
  to!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  template?: string;

  @Field()
  @IsBoolean()
  includeTotal!: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeItems?: boolean;
}
