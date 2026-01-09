import { IsString, IsNumber, IsBoolean, IsOptional, IsDateString, IsArray, IsEnum, IsUUID, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TaxType {
  SALES = 'sales',
  VAT = 'vat',
  GST = 'gst',
  INCOME = 'income',
  PROPERTY = 'property',
  EXCISE = 'excise',
}

export enum JurisdictionType {
  FEDERAL = 'federal',
  STATE = 'state',
  COUNTY = 'county',
  CITY = 'city',
  CUSTOM = 'custom',
}

export enum CalculationMethod {
  PERCENTAGE = 'percentage',
  FLAT = 'flat',
  TIERED = 'tiered',
}

export enum PeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

export enum FilingStatus {
  DRAFT = 'draft',
  FILED = 'filed',
  AMENDED = 'amended',
  VOIDED = 'voided',
}

export class CreateTaxJurisdictionDto {
  @ApiProperty({ description: 'Jurisdiction code' })
  @IsString()
  jurisdictionCode: string;

  @ApiProperty({ description: 'Jurisdiction name' })
  @IsString()
  jurisdictionName: string;

  @ApiProperty({ enum: JurisdictionType, description: 'Type of jurisdiction' })
  @IsEnum(JurisdictionType)
  jurisdictionType: JurisdictionType;

  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-3)' })
  @IsString()
  country: string;

  @ApiPropertyOptional({ description: 'State or province' })
  @IsOptional()
  @IsString()
  stateProvince?: string;

  @ApiPropertyOptional({ description: 'County' })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Tax authority name' })
  @IsOptional()
  @IsString()
  taxAuthorityName?: string;

  @ApiPropertyOptional({ description: 'Tax authority ID' })
  @IsOptional()
  @IsString()
  taxAuthorityId?: string;

  @ApiProperty({ description: 'Effective date' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Additional settings', type: 'object' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateTaxJurisdictionDto {
  @ApiPropertyOptional({ description: 'Jurisdiction name' })
  @IsOptional()
  @IsString()
  jurisdictionName?: string;

  @ApiPropertyOptional({ description: 'Tax authority name' })
  @IsOptional()
  @IsString()
  taxAuthorityName?: string;

  @ApiPropertyOptional({ description: 'Tax authority ID' })
  @IsOptional()
  @IsString()
  taxAuthorityId?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Additional settings', type: 'object' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class CreateTaxRateDto {
  @ApiProperty({ description: 'Jurisdiction ID' })
  @IsUUID()
  jurisdictionId: string;

  @ApiProperty({ enum: TaxType, description: 'Type of tax' })
  @IsEnum(TaxType)
  taxType: TaxType;

  @ApiProperty({ description: 'Tax name' })
  @IsString()
  taxName: string;

  @ApiProperty({ description: 'Tax code' })
  @IsString()
  taxCode: string;

  @ApiProperty({ description: 'Tax rate as decimal (e.g., 0.0825 for 8.25%)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;

  @ApiPropertyOptional({ description: 'Flat amount (if applicable)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatAmount?: number;

  @ApiPropertyOptional({ enum: CalculationMethod, description: 'Calculation method' })
  @IsOptional()
  @IsEnum(CalculationMethod)
  calculationMethod?: CalculationMethod;

  @ApiPropertyOptional({ description: 'Compounding order for multiple taxes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  compoundingOrder?: number;

  @ApiPropertyOptional({ description: 'Applies to products' })
  @IsOptional()
  @IsBoolean()
  applicableToProducts?: boolean;

  @ApiPropertyOptional({ description: 'Applies to services' })
  @IsOptional()
  @IsBoolean()
  applicableToServices?: boolean;

  @ApiPropertyOptional({ description: 'Applies to shipping' })
  @IsOptional()
  @IsBoolean()
  applicableToShipping?: boolean;

  @ApiPropertyOptional({ description: 'Minimum taxable amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumTaxableAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum taxable amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumTaxableAmount?: number;

  @ApiProperty({ description: 'Effective date' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Reporting category' })
  @IsOptional()
  @IsString()
  reportingCategory?: string;

  @ApiPropertyOptional({ description: 'GL Account ID for tax liability' })
  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @ApiPropertyOptional({ description: 'Additional settings', type: 'object' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateTaxRateDto {
  @ApiPropertyOptional({ description: 'Tax name' })
  @IsOptional()
  @IsString()
  taxName?: string;

  @ApiPropertyOptional({ description: 'Tax rate as decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rate?: number;

  @ApiPropertyOptional({ description: 'Flat amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatAmount?: number;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Additional settings', type: 'object' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class TaxCalculationInputDto {
  @ApiProperty({ description: 'Source type (e.g., transaction, invoice)' })
  @IsString()
  sourceType: string;

  @ApiProperty({ description: 'Source ID' })
  @IsUUID()
  sourceId: string;

  @ApiProperty({ description: 'Taxable amount' })
  @IsNumber()
  @Min(0)
  taxableAmount: number;

  @ApiPropertyOptional({ description: 'Product type', enum: ['product', 'service', 'shipping'] })
  @IsOptional()
  @IsString()
  productType?: 'product' | 'service' | 'shipping';

  @ApiPropertyOptional({ description: 'Specific jurisdiction codes to use' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  jurisdictionCodes?: string[];

  @ApiPropertyOptional({ description: 'Calculation date' })
  @IsOptional()
  @IsDateString()
  calculationDate?: string;
}

export class CreateTaxReturnDto {
  @ApiProperty({ description: 'Jurisdiction ID' })
  @IsUUID()
  jurisdictionId: string;

  @ApiProperty({ enum: PeriodType, description: 'Period type' })
  @IsEnum(PeriodType)
  periodType: PeriodType;

  @ApiProperty({ description: 'Period year' })
  @IsNumber()
  @Min(2000)
  @Max(2100)
  periodYear: number;

  @ApiProperty({ description: 'Period number (1-12 for monthly, 1-4 for quarterly, 1 for annual)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  periodNumber: number;

  @ApiProperty({ description: 'Period start date' })
  @IsDateString()
  periodStartDate: string;

  @ApiProperty({ description: 'Period end date' })
  @IsDateString()
  periodEndDate: string;

  @ApiProperty({ description: 'Due date' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Return number (auto-generated if not provided)' })
  @IsOptional()
  @IsString()
  returnNumber?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateTaxReturnDto {
  @ApiProperty({ description: 'Jurisdiction ID' })
  @IsUUID()
  jurisdictionId: string;

  @ApiProperty({ description: 'Period year' })
  @IsNumber()
  @Min(2000)
  @Max(2100)
  periodYear: number;

  @ApiProperty({ description: 'Period number' })
  @IsNumber()
  @Min(1)
  @Max(12)
  periodNumber: number;

  @ApiProperty({ enum: PeriodType, description: 'Period type' })
  @IsEnum(PeriodType)
  periodType: PeriodType;
}

export class UpdateTaxReturnDto {
  @ApiPropertyOptional({ enum: FilingStatus, description: 'Filing status' })
  @IsOptional()
  @IsEnum(FilingStatus)
  filingStatus?: FilingStatus;

  @ApiPropertyOptional({ description: 'Filing date' })
  @IsOptional()
  @IsDateString()
  filingDate?: string;

  @ApiPropertyOptional({ description: 'Total payments made' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPayments?: number;

  @ApiPropertyOptional({ description: 'External filing ID' })
  @IsOptional()
  @IsString()
  externalFilingId?: string;

  @ApiPropertyOptional({ description: 'Confirmation number' })
  @IsOptional()
  @IsString()
  confirmationNumber?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TaxJurisdictionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jurisdictionCode: string;

  @ApiProperty()
  jurisdictionName: string;

  @ApiProperty({ enum: JurisdictionType })
  jurisdictionType: JurisdictionType;

  @ApiProperty()
  country: string;

  @ApiPropertyOptional()
  stateProvince?: string;

  @ApiPropertyOptional()
  county?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  postalCode?: string;

  @ApiPropertyOptional()
  taxAuthorityName?: string;

  @ApiPropertyOptional()
  taxAuthorityId?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  effectiveDate: Date;

  @ApiPropertyOptional()
  expirationDate?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TaxRateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jurisdictionId: string;

  @ApiProperty({ enum: TaxType })
  taxType: TaxType;

  @ApiProperty()
  taxName: string;

  @ApiProperty()
  taxCode: string;

  @ApiProperty()
  rate: number;

  @ApiProperty()
  flatAmount: number;

  @ApiProperty({ enum: CalculationMethod })
  calculationMethod: CalculationMethod;

  @ApiProperty()
  compoundingOrder: number;

  @ApiProperty()
  applicableToProducts: boolean;

  @ApiProperty()
  applicableToServices: boolean;

  @ApiProperty()
  applicableToShipping: boolean;

  @ApiProperty()
  minimumTaxableAmount: number;

  @ApiPropertyOptional()
  maximumTaxableAmount?: number;

  @ApiProperty()
  effectiveDate: Date;

  @ApiPropertyOptional()
  expirationDate?: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  reportingCategory?: string;

  @ApiPropertyOptional()
  glAccountId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TaxCalculationResultDto {
  @ApiProperty()
  totalTaxAmount: number;

  @ApiProperty({ type: [Object] })
  calculations: Array<{
    jurisdictionId: string;
    jurisdictionName: string;
    taxRateId: string;
    taxName: string;
    taxType: string;
    taxableAmount: number;
    taxRate: number;
    taxAmount: number;
    roundingAdjustment: number;
  }>;
}

export class TaxReturnResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  returnNumber: string;

  @ApiProperty()
  jurisdictionId: string;

  @ApiProperty({ enum: PeriodType })
  periodType: PeriodType;

  @ApiProperty()
  periodYear: number;

  @ApiProperty()
  periodNumber: number;

  @ApiProperty()
  periodStartDate: Date;

  @ApiProperty()
  periodEndDate: Date;

  @ApiProperty({ enum: FilingStatus })
  filingStatus: FilingStatus;

  @ApiPropertyOptional()
  filingDate?: Date;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty()
  totalTaxableAmount: number;

  @ApiProperty()
  totalTaxAmount: number;

  @ApiProperty()
  totalPayments: number;

  @ApiProperty()
  amountDue: number;

  @ApiPropertyOptional()
  preparedBy?: string;

  @ApiPropertyOptional()
  reviewedBy?: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  externalFilingId?: string;

  @ApiPropertyOptional()
  confirmationNumber?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}