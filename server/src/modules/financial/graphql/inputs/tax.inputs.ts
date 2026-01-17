import { InputType, Field, ID, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsBoolean, IsOptional, IsDateString, IsArray, IsEnum, IsUUID, Min, Max } from 'class-validator';
import { TaxType, JurisdictionType, CalculationMethod, PeriodType, FilingStatus } from '../enums';
import { DecimalScalar } from '../scalars';

@InputType()
export class CreateTaxJurisdictionInput {
  @Field()
  @IsString()
  jurisdictionCode!: string;

  @Field()
  @IsString()
  jurisdictionName!: string;

  @Field(() => JurisdictionType)
  @IsEnum(JurisdictionType)
  jurisdictionType!: JurisdictionType;

  @Field()
  @IsString()
  country!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  stateProvince?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  county?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  taxAuthorityName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  taxAuthorityId?: string;

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
  settings?: string; // JSON string
}

@InputType()
export class UpdateTaxJurisdictionInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  jurisdictionCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  jurisdictionName?: string;

  @Field(() => JurisdictionType, { nullable: true })
  @IsOptional()
  @IsEnum(JurisdictionType)
  jurisdictionType?: JurisdictionType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  country?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  stateProvince?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  county?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  taxAuthorityName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  taxAuthorityId?: string;

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
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  settings?: string; // JSON string
}

@InputType()
export class CreateTaxRateInput {
  @Field(() => ID)
  @IsUUID()
  jurisdictionId!: string;

  @Field(() => TaxType)
  @IsEnum(TaxType)
  taxType!: TaxType;

  @Field()
  @IsString()
  rateName!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;

  @Field(() => CalculationMethod)
  @IsEnum(CalculationMethod)
  calculationMethod!: CalculationMethod;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  minimumAmount?: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  maximumAmount?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  productCategory?: string;

  @Field()
  @IsDateString()
  effectiveDate!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  settings?: string; // JSON string
}

@InputType()
export class UpdateTaxRateInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  jurisdictionId?: string;

  @Field(() => TaxType, { nullable: true })
  @IsOptional()
  @IsEnum(TaxType)
  taxType?: TaxType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  rateName?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rate?: number;

  @Field(() => CalculationMethod, { nullable: true })
  @IsOptional()
  @IsEnum(CalculationMethod)
  calculationMethod?: CalculationMethod;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  minimumAmount?: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  maximumAmount?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  productCategory?: string;

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
  @IsBoolean()
  isActive?: boolean;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  settings?: string; // JSON string
}

@InputType()
export class TaxCalculationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @Field(() => DecimalScalar)
  taxableAmount!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  productType?: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  jurisdictionCodes!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  calculationDate?: string;
}

@InputType()
export class CreateTaxReturnInput {
  @Field(() => ID)
  @IsUUID()
  jurisdictionId!: string;

  @Field(() => TaxType)
  @IsEnum(TaxType)
  taxType!: TaxType;

  @Field(() => PeriodType)
  @IsEnum(PeriodType)
  periodType!: PeriodType;

  @Field()
  @IsDateString()
  periodStartDate!: string;

  @Field()
  @IsDateString()
  periodEndDate!: string;

  @Field()
  @IsDateString()
  dueDate!: string;

  @Field(() => DecimalScalar)
  totalTaxableAmount!: string;

  @Field(() => DecimalScalar)
  totalTaxAmount!: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  totalPayments?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  returnData?: string; // JSON string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class UpdateTaxReturnInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field(() => FilingStatus, { nullable: true })
  @IsOptional()
  @IsEnum(FilingStatus)
  filingStatus?: FilingStatus;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  totalTaxableAmount?: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  totalTaxAmount?: string;

  @Field(() => DecimalScalar, { nullable: true })
  @IsOptional()
  totalPayments?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  filedDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  confirmationNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  returnData?: string; // JSON string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}