import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { DecimalScalar } from '../scalars';

@ObjectType()
export class Currency {
  @Field(() => ID)
  id!: string;

  @Field()
  currencyCode!: string; // ISO 4217 code (USD, EUR, etc.)

  @Field()
  currencyName!: string;

  @Field()
  currencySymbol!: string;

  @Field(() => Int)
  decimalPlaces!: number;

  @Field()
  isBaseCurrency!: boolean;

  @Field()
  isActive!: boolean;

  @Field({ nullable: true })
  description?: string;

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
export class ExchangeRate {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  fromCurrencyId!: string;

  @Field(() => Currency)
  fromCurrency!: Currency;

  @Field(() => ID)
  toCurrencyId!: string;

  @Field(() => Currency)
  toCurrency!: Currency;

  @Field(() => Float)
  rate!: number;

  @Field()
  effectiveDate!: Date;

  @Field({ nullable: true })
  expirationDate?: Date;

  @Field()
  rateType!: string; // 'spot', 'forward', 'average'

  @Field({ nullable: true })
  source?: string; // 'manual', 'api', 'bank'

  @Field()
  isActive!: boolean;

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
export class CurrencyConversion {
  @Field(() => ID)
  fromCurrencyId!: string;

  @Field(() => Currency)
  fromCurrency!: Currency;

  @Field(() => ID)
  toCurrencyId!: string;

  @Field(() => Currency)
  toCurrency!: Currency;

  @Field(() => DecimalScalar)
  fromAmount!: string;

  @Field(() => DecimalScalar)
  toAmount!: string;

  @Field(() => Float)
  exchangeRate!: number;

  @Field()
  conversionDate!: Date;

  @Field({ nullable: true })
  reference?: string;
}

@ObjectType()
export class MultiCurrencyReport {
  @Field()
  reportDate!: Date;

  @Field(() => Currency)
  baseCurrency!: Currency;

  @Field(() => [CurrencyBalance])
  currencyBalances!: CurrencyBalance[];

  @Field(() => DecimalScalar)
  totalBaseCurrencyValue!: string;

  @Field(() => [CurrencyExposure])
  currencyExposures!: CurrencyExposure[];
}

@ObjectType()
export class CurrencyBalance {
  @Field(() => Currency)
  currency!: Currency;

  @Field(() => DecimalScalar)
  balance!: string;

  @Field(() => DecimalScalar)
  baseCurrencyValue!: string;

  @Field(() => Float)
  exchangeRate!: number;

  @Field(() => Int)
  accountCount!: number;
}

@ObjectType()
export class CurrencyExposure {
  @Field(() => Currency)
  currency!: Currency;

  @Field(() => DecimalScalar)
  netExposure!: string;

  @Field(() => DecimalScalar)
  unrealizedGainLoss!: string;

  @Field(() => Float)
  exposurePercentage!: number;
}

@ObjectType()
export class CurrencyRevaluation {
  @Field(() => ID)
  id!: string;

  @Field()
  revaluationDate!: Date;

  @Field(() => Currency)
  currency!: Currency;

  @Field(() => Float)
  oldRate!: number;

  @Field(() => Float)
  newRate!: number;

  @Field(() => DecimalScalar)
  revaluationAmount!: string;

  @Field(() => ID, { nullable: true })
  journalEntryId?: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt!: Date;

  @Field(() => ID)
  createdBy!: string;

  @Field(() => ID)
  tenantId!: string;
}