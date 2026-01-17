import { registerEnumType } from '@nestjs/graphql';

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

// Register enums with GraphQL
registerEnumType(TaxType, {
  name: 'TaxType',
  description: 'The type of tax',
});

registerEnumType(JurisdictionType, {
  name: 'JurisdictionType',
  description: 'The type of tax jurisdiction',
});

registerEnumType(CalculationMethod, {
  name: 'CalculationMethod',
  description: 'The method used to calculate tax',
});

registerEnumType(PeriodType, {
  name: 'PeriodType',
  description: 'The period type for tax reporting',
});

registerEnumType(FilingStatus, {
  name: 'FilingStatus',
  description: 'The filing status of a tax return',
});