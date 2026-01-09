import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { 
  taxJurisdictions, 
  taxRates, 
  taxCalculations, 
  taxReturns, 
  taxReturnLines 
} from '../../database/schema/financial.schema';
import { eq, and, gte, lte, isNull, or, desc, asc } from 'drizzle-orm';

export interface TaxJurisdiction {
  id: string;
  tenantId: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  jurisdictionType: string;
  country: string;
  stateProvince?: string;
  county?: string;
  city?: string;
  postalCode?: string;
  taxAuthorityName?: string;
  taxAuthorityId?: string;
  isActive: boolean;
  effectiveDate: Date;
  expirationDate?: Date;
  settings: Record<string, any>;
}

export interface TaxRate {
  id: string;
  tenantId: string;
  jurisdictionId: string;
  taxType: string;
  taxName: string;
  taxCode: string;
  rate: number;
  flatAmount: number;
  calculationMethod: string;
  compoundingOrder: number;
  applicableToProducts: boolean;
  applicableToServices: boolean;
  applicableToShipping: boolean;
  minimumTaxableAmount: number;
  maximumTaxableAmount?: number;
  effectiveDate: Date;
  expirationDate?: Date;
  isActive: boolean;
  reportingCategory?: string;
  glAccountId?: string;
  settings: Record<string, any>;
}

export interface TaxCalculationInput {
  sourceType: string;
  sourceId: string;
  taxableAmount: number;
  productType?: 'product' | 'service' | 'shipping';
  jurisdictionCodes?: string[];
  calculationDate?: Date;
}

export interface TaxCalculationResult {
  totalTaxAmount: number;
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

export interface TaxReturn {
  id: string;
  tenantId: string;
  returnNumber: string;
  jurisdictionId: string;
  periodType: string;
  periodYear: number;
  periodNumber: number;
  periodStartDate: Date;
  periodEndDate: Date;
  filingStatus: string;
  filingDate?: Date;
  dueDate: Date;
  totalTaxableAmount: number;
  totalTaxAmount: number;
  totalPayments: number;
  amountDue: number;
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  externalFilingId?: string;
  confirmationNumber?: string;
  attachments: any[];
  notes?: string;
}

@Injectable()
export class TaxService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  // Tax Jurisdiction Management
  async createJurisdiction(tenantId: string, data: Partial<TaxJurisdiction>): Promise<TaxJurisdiction> {
    const jurisdiction = await this.drizzle.db
      .insert(taxJurisdictions)
      .values({
        ...data,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await this.invalidateJurisdictionCache(tenantId);
    return jurisdiction[0] as TaxJurisdiction;
  }

  async getJurisdictions(tenantId: string, activeOnly: boolean = true): Promise<TaxJurisdiction[]> {
    const cacheKey = `tax:jurisdictions:${tenantId}:${activeOnly}`;
    let jurisdictions = await this.cacheService.get<TaxJurisdiction[]>(cacheKey);

    if (!jurisdictions) {
      const conditions = [eq(taxJurisdictions.tenantId, tenantId)];
      if (activeOnly) {
        conditions.push(eq(taxJurisdictions.isActive, true));
      }

      jurisdictions = await this.drizzle.db
        .select()
        .from(taxJurisdictions)
        .where(and(...conditions))
        .orderBy(asc(taxJurisdictions.jurisdictionName));

      await this.cacheService.set(cacheKey, jurisdictions, 300); // 5 minutes
    }

    return jurisdictions as TaxJurisdiction[];
  }

  async getJurisdictionByCode(tenantId: string, jurisdictionCode: string): Promise<TaxJurisdiction | null> {
    const cacheKey = `tax:jurisdiction:${tenantId}:${jurisdictionCode}`;
    let jurisdiction = await this.cacheService.get<TaxJurisdiction>(cacheKey);

    if (!jurisdiction) {
      const result = await this.drizzle.db
        .select()
        .from(taxJurisdictions)
        .where(
          and(
            eq(taxJurisdictions.tenantId, tenantId),
            eq(taxJurisdictions.jurisdictionCode, jurisdictionCode),
            eq(taxJurisdictions.isActive, true)
          )
        )
        .limit(1);

      jurisdiction = result[0] as TaxJurisdiction || null;
      if (jurisdiction) {
        await this.cacheService.set(cacheKey, jurisdiction, 300);
      }
    }

    return jurisdiction;
  }

  // Tax Rate Management
  async createTaxRate(tenantId: string, data: Partial<TaxRate>): Promise<TaxRate> {
    const taxRate = await this.drizzle.db
      .insert(taxRates)
      .values({
        ...data,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await this.invalidateTaxRateCache(tenantId);
    return taxRate[0] as TaxRate;
  }

  async getTaxRates(
    tenantId: string, 
    jurisdictionId?: string, 
    activeOnly: boolean = true
  ): Promise<TaxRate[]> {
    const cacheKey = `tax:rates:${tenantId}:${jurisdictionId || 'all'}:${activeOnly}`;
    let rates = await this.cacheService.get<TaxRate[]>(cacheKey);

    if (!rates) {
      const conditions = [eq(taxRates.tenantId, tenantId)];
      
      if (jurisdictionId) {
        conditions.push(eq(taxRates.jurisdictionId, jurisdictionId));
      }
      
      if (activeOnly) {
        conditions.push(eq(taxRates.isActive, true));
        conditions.push(
          or(
            isNull(taxRates.expirationDate),
            gte(taxRates.expirationDate, new Date())
          )
        );
      }

      rates = await this.drizzle.db
        .select()
        .from(taxRates)
        .where(and(...conditions))
        .orderBy(asc(taxRates.compoundingOrder), asc(taxRates.taxName));

      await this.cacheService.set(cacheKey, rates, 300);
    }

    return rates as TaxRate[];
  }

  // Tax Calculation Engine
  async calculateTax(tenantId: string, input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const { sourceType, sourceId, taxableAmount, productType = 'product', jurisdictionCodes, calculationDate = new Date() } = input;

    // Get applicable jurisdictions
    let jurisdictions: TaxJurisdiction[];
    if (jurisdictionCodes && jurisdictionCodes.length > 0) {
      jurisdictions = await Promise.all(
        jurisdictionCodes.map(code => this.getJurisdictionByCode(tenantId, code))
      ).then(results => results.filter(Boolean) as TaxJurisdiction[]);
    } else {
      jurisdictions = await this.getJurisdictions(tenantId, true);
    }

    const calculations: TaxCalculationResult['calculations'] = [];
    let totalTaxAmount = 0;

    // Calculate tax for each jurisdiction
    for (const jurisdiction of jurisdictions) {
      const rates = await this.getTaxRates(tenantId, jurisdiction.id, true);
      
      for (const rate of rates) {
        // Check if rate applies to this product type
        const applies = this.doesRateApply(rate, productType, taxableAmount, calculationDate);
        if (!applies) continue;

        // Calculate tax amount
        const taxAmount = this.calculateTaxAmount(rate, taxableAmount);
        const roundingAdjustment = this.applyRounding(taxAmount) - taxAmount;
        const finalTaxAmount = taxAmount + roundingAdjustment;

        // Store calculation for audit trail
        await this.drizzle.db
          .insert(taxCalculations)
          .values({
            tenantId,
            sourceType,
            sourceId,
            jurisdictionId: jurisdiction.id,
            taxRateId: rate.id,
            taxableAmount,
            taxRate: rate.rate,
            taxAmount: finalTaxAmount,
            roundingAdjustment,
            calculationDate,
            calculationMethod: rate.calculationMethod,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

        calculations.push({
          jurisdictionId: jurisdiction.id,
          jurisdictionName: jurisdiction.jurisdictionName,
          taxRateId: rate.id,
          taxName: rate.taxName,
          taxType: rate.taxType,
          taxableAmount,
          taxRate: rate.rate,
          taxAmount: finalTaxAmount,
          roundingAdjustment,
        });

        totalTaxAmount += finalTaxAmount;
      }
    }

    return {
      totalTaxAmount: this.applyRounding(totalTaxAmount),
      calculations,
    };
  }

  // Tax Return Management
  async createTaxReturn(tenantId: string, data: Partial<TaxReturn>): Promise<TaxReturn> {
    // Generate return number if not provided
    if (!data.returnNumber) {
      data.returnNumber = await this.generateReturnNumber(tenantId, data.jurisdictionId!, data.periodYear!, data.periodNumber!);
    }

    const taxReturn = await this.drizzle.db
      .insert(taxReturns)
      .values({
        ...data,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return taxReturn[0] as TaxReturn;
  }

  async getTaxReturns(
    tenantId: string,
    jurisdictionId?: string,
    periodYear?: number,
    filingStatus?: string
  ): Promise<TaxReturn[]> {
    const conditions = [eq(taxReturns.tenantId, tenantId)];
    
    if (jurisdictionId) {
      conditions.push(eq(taxReturns.jurisdictionId, jurisdictionId));
    }
    
    if (periodYear) {
      conditions.push(eq(taxReturns.periodYear, periodYear));
    }
    
    if (filingStatus) {
      conditions.push(eq(taxReturns.filingStatus, filingStatus));
    }

    return await this.drizzle.db
      .select()
      .from(taxReturns)
      .where(and(...conditions))
      .orderBy(desc(taxReturns.periodYear), desc(taxReturns.periodNumber));
  }

  async generateTaxReturn(
    tenantId: string,
    jurisdictionId: string,
    periodYear: number,
    periodNumber: number,
    periodType: string
  ): Promise<TaxReturn> {
    // Calculate period dates
    const { startDate, endDate, dueDate } = this.calculatePeriodDates(periodYear, periodNumber, periodType);

    // Get tax calculations for the period
    const calculations = await this.drizzle.db
      .select()
      .from(taxCalculations)
      .where(
        and(
          eq(taxCalculations.tenantId, tenantId),
          eq(taxCalculations.jurisdictionId, jurisdictionId),
          gte(taxCalculations.calculationDate, startDate),
          lte(taxCalculations.calculationDate, endDate)
        )
      );

    // Aggregate totals
    const totalTaxableAmount = calculations.reduce((sum, calc) => sum + Number(calc.taxableAmount), 0);
    const totalTaxAmount = calculations.reduce((sum, calc) => sum + Number(calc.taxAmount), 0);

    // Create tax return
    const taxReturn = await this.createTaxReturn(tenantId, {
      jurisdictionId,
      periodType,
      periodYear,
      periodNumber,
      periodStartDate: startDate,
      periodEndDate: endDate,
      dueDate,
      totalTaxableAmount,
      totalTaxAmount,
      totalPayments: 0,
      amountDue: totalTaxAmount,
      filingStatus: 'draft',
    });

    // Create line items grouped by tax rate
    const rateGroups = new Map<string, { taxableAmount: number; taxAmount: number; calculations: any[] }>();
    
    for (const calc of calculations) {
      const key = calc.taxRateId;
      if (!rateGroups.has(key)) {
        rateGroups.set(key, { taxableAmount: 0, taxAmount: 0, calculations: [] });
      }
      const group = rateGroups.get(key)!;
      group.taxableAmount += Number(calc.taxableAmount);
      group.taxAmount += Number(calc.taxAmount);
      group.calculations.push(calc);
    }

    let lineNumber = 1;
    for (const [taxRateId, group] of rateGroups) {
      const rate = await this.drizzle.db
        .select()
        .from(taxRates)
        .where(eq(taxRates.id, taxRateId))
        .limit(1);

      if (rate.length > 0) {
        await this.drizzle.db
          .insert(taxReturnLines)
          .values({
            tenantId,
            taxReturnId: taxReturn.id,
            taxRateId,
            lineNumber,
            lineDescription: rate[0].taxName,
            taxableAmount: group.taxableAmount,
            taxRate: Number(rate[0].rate),
            taxAmount: group.taxAmount,
            calculationMethod: 'aggregated',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        lineNumber++;
      }
    }

    return taxReturn;
  }

  // Helper Methods
  private doesRateApply(
    rate: TaxRate, 
    productType: string, 
    taxableAmount: number, 
    calculationDate: Date
  ): boolean {
    // Check product type applicability
    if (productType === 'product' && !rate.applicableToProducts) return false;
    if (productType === 'service' && !rate.applicableToServices) return false;
    if (productType === 'shipping' && !rate.applicableToShipping) return false;

    // Check amount thresholds
    if (taxableAmount < rate.minimumTaxableAmount) return false;
    if (rate.maximumTaxableAmount && taxableAmount > rate.maximumTaxableAmount) return false;

    // Check effective dates
    if (calculationDate < rate.effectiveDate) return false;
    if (rate.expirationDate && calculationDate > rate.expirationDate) return false;

    return true;
  }

  private calculateTaxAmount(rate: TaxRate, taxableAmount: number): number {
    switch (rate.calculationMethod) {
      case 'percentage':
        return taxableAmount * rate.rate;
      case 'flat':
        return rate.flatAmount;
      case 'tiered':
        // Implement tiered calculation based on settings
        return this.calculateTieredTax(rate, taxableAmount);
      default:
        return taxableAmount * rate.rate;
    }
  }

  private calculateTieredTax(rate: TaxRate, taxableAmount: number): number {
    // This would implement tiered tax calculation based on rate.settings
    // For now, fallback to percentage
    return taxableAmount * rate.rate;
  }

  private applyRounding(amount: number): number {
    // Round to nearest cent
    return Math.round(amount * 100) / 100;
  }

  private calculatePeriodDates(periodYear: number, periodNumber: number, periodType: string) {
    let startDate: Date;
    let endDate: Date;
    let dueDate: Date;

    switch (periodType) {
      case 'monthly':
        startDate = new Date(periodYear, periodNumber - 1, 1);
        endDate = new Date(periodYear, periodNumber, 0); // Last day of month
        dueDate = new Date(periodYear, periodNumber, 20); // 20th of next month
        break;
      case 'quarterly':
        const quarterStartMonth = (periodNumber - 1) * 3;
        startDate = new Date(periodYear, quarterStartMonth, 1);
        endDate = new Date(periodYear, quarterStartMonth + 3, 0);
        dueDate = new Date(periodYear, quarterStartMonth + 4, 15); // 15th of month after quarter
        break;
      case 'annual':
        startDate = new Date(periodYear, 0, 1);
        endDate = new Date(periodYear, 11, 31);
        dueDate = new Date(periodYear + 1, 2, 15); // March 15th of next year
        break;
      default:
        throw new BadRequestException(`Unsupported period type: ${periodType}`);
    }

    return { startDate, endDate, dueDate };
  }

  private async generateReturnNumber(
    tenantId: string, 
    jurisdictionId: string, 
    periodYear: number, 
    periodNumber: number
  ): Promise<string> {
    const jurisdiction = await this.drizzle.db
      .select()
      .from(taxJurisdictions)
      .where(eq(taxJurisdictions.id, jurisdictionId))
      .limit(1);

    if (jurisdiction.length === 0) {
      throw new NotFoundException('Jurisdiction not found');
    }

    const jurisdictionCode = jurisdiction[0].jurisdictionCode;
    return `${jurisdictionCode}-${periodYear}-${periodNumber.toString().padStart(2, '0')}`;
  }

  private async invalidateJurisdictionCache(tenantId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`tax:jurisdiction*:${tenantId}:*`);
  }

  private async invalidateTaxRateCache(tenantId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`tax:rates:${tenantId}:*`);
  }
}