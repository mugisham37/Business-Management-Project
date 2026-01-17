import { InputType, Field, ID, Int, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, IsDateString, IsUUID, IsBoolean, Min, Max } from 'class-validator';
import { DecimalScalar } from '../scalars';

@InputType()
export class CreateCurrencyInput {
  @Field()
  @IsString()
  currencyCode!: string; // ISO 4217 code

  @Field()
  @IsString()
  currencyName!: string;

  @Field()
  @IsString()
  currencySymbol!: string;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  @Max(10)
  decimalPlaces!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isBaseCurrency?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class UpdateCurrencyInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  currencyName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  decimalPlaces?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class CreateExchangeRateInput {
  @Field(() => ID)
  @IsUUID()
  fromCurrencyId!: string;

  @Field(() => ID)
  @IsUUID()
  toCurrencyId!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  rate!: number;

  @Field()
  @IsDateString()
  effectiveDate!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  rateType?: string; // 'spot', 'forward', 'average'

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  source?: string; // 'manual', 'api', 'bank'
}

@InputType()
export class UpdateExchangeRateInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  rateType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  source?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class CurrencyConversionInput {
  @Field(() => ID)
  @IsUUID()
  fromCurrencyId!: string;

  @Field(() => ID)
  @IsUUID()
  toCurrencyId!: string;

  @Field(() => DecimalScalar)
  amount!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  conversionDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;
}

@InputType()
export class CurrencyRevaluationInput {
  @Field(() => ID)
  @IsUUID()
  currencyId!: string;

  @Field()
  @IsDateString()
  revaluationDate!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  newRate!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}