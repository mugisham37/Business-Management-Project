import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { TaxType, JurisdictionType, CalculationMethod, PeriodType, FilingStatus } from '../enums';
import { DecimalScalar } from '../scalars';

@ObjectType()
export class TaxJurisdiction {
  @Field(() => ID)
  id!: string;

  @Field()
  jurisdictionCode!: string;

  @Field()
  jurisdictionName!: string;

  @Field(() => JurisdictionType)
  jurisdictionType!: JurisdictionType;

  @Field()
  country!: string;

  @Field({ nullable: true })
  stateProvince?: string;

  @Field({ nullable: true })
  county?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  postalCode?: string;

  @Field({ nullable: true })
  taxAuthorityName?: string;

  @Field({ nullable: true })
  taxAuthorityId?: string;

  @Field()
  effectiveDate!: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field()
  isActive!: boolean;

  @Field(() => [TaxRate])
  taxRates!: TaxRate[];

  @Field({ nullable: true })
  settings?: string; // JSON string

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
export class TaxRate {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  jurisdictionId!: string;

  @Field(() => TaxJurisdiction)
  jurisdiction!: TaxJurisdiction;

  @Field(() => TaxType)
  taxType!: TaxType;

  @Field()
  rateName!: string;

  @Field(() => Float)
  rate!: number;

  @Field(() => CalculationMethod)
  calculationMethod!: CalculationMethod;

  @Field(() => DecimalScalar, { nullable: true })
  minimumAmount?: string;

  @Field(() => DecimalScalar, { nullable: true })
  maximumAmount?: string;

  @Field({ nullable: true })
  productCategory?: string;

  @Field()
  effectiveDate!: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field()
  isActive!: boolean;

  @Field(() => ID, { nullable: true })
  glAccountId?: string;

  @Field({ nullable: true })
  settings?: string; // JSON string

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
export class TaxCalculationResult {
  @Field(() => DecimalScalar)
  taxableAmount!: string;

  @Field(() => DecimalScalar)
  totalTaxAmount!: string;

  @Field(() => [TaxCalculationDetail])
  taxDetails!: TaxCalculationDetail[];

  @Field()
  calculationDate!: Date;

  @Field({ nullable: true })
  sourceType?: string;

  @Field(() => ID, { nullable: true })
  sourceId?: string;
}

@ObjectType()
export class TaxCalculationDetail {
  @Field(() => ID)
  jurisdictionId!: string;

  @Field(() => TaxJurisdiction)
  jurisdiction!: TaxJurisdiction;

  @Field(() => ID)
  taxRateId!: string;

  @Field(() => TaxRate)
  taxRate!: TaxRate;

  @Field(() => DecimalScalar)
  taxableAmount!: string;

  @Field(() => DecimalScalar)
  taxAmount!: string;

  @Field(() => Float)
  effectiveRate!: number;
}

@ObjectType()
export class TaxReturn {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  jurisdictionId!: string;

  @Field(() => TaxJurisdiction)
  jurisdiction!: TaxJurisdiction;

  @Field(() => TaxType)
  taxType!: TaxType;

  @Field(() => PeriodType)
  periodType!: PeriodType;

  @Field()
  periodStartDate!: Date;

  @Field()
  periodEndDate!: Date;

  @Field()
  dueDate!: Date;

  @Field(() => FilingStatus)
  filingStatus!: FilingStatus;

  @Field(() => DecimalScalar)
  totalTaxableAmount!: string;

  @Field(() => DecimalScalar)
  totalTaxAmount!: string;

  @Field(() => DecimalScalar)
  totalPayments!: string;

  @Field(() => DecimalScalar)
  amountDue!: string;

  @Field({ nullable: true })
  filedDate?: Date;

  @Field(() => ID, { nullable: true })
  filedBy?: string;

  @Field({ nullable: true })
  confirmationNumber?: string;

  @Field({ nullable: true })
  returnData?: string; // JSON string

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