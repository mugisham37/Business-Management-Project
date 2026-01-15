import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FiscalPeriodRepository } from '../repositories/fiscal-period.repository';

@Injectable()
export class FiscalPeriodService {
  constructor(
    private readonly fiscalPeriodRepository: FiscalPeriodRepository,
  ) {}

  async createFiscalPeriod(tenantId: string, data: {
    fiscalYear: number;
    periodNumber: number;
    periodName: string;
    startDate: Date;
    endDate: Date;
    isYearEnd?: boolean;
  }, userId: string) {
    // Validate date range
    if (data.startDate >= data.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check for overlapping periods
    const existingPeriod = await this.fiscalPeriodRepository.findByYearAndPeriod(
      tenantId,
      data.fiscalYear,
      data.periodNumber
    );

    if (existingPeriod) {
      throw new BadRequestException(`Period ${data.periodNumber} already exists for fiscal year ${data.fiscalYear}`);
    }

    return await this.fiscalPeriodRepository.create(tenantId, data, userId);
  }

  async findFiscalPeriodById(tenantId: string, id: string) {
    const period = await this.fiscalPeriodRepository.findById(tenantId, id);
    
    if (!period) {
      throw new NotFoundException('Fiscal period not found');
    }

    return period;
  }

  async findFiscalPeriodsByYear(tenantId: string, fiscalYear: number) {
    return await this.fiscalPeriodRepository.findByYear(tenantId, fiscalYear);
  }

  async findCurrentFiscalPeriod(tenantId: string, asOfDate?: Date) {
    const period = await this.fiscalPeriodRepository.findCurrentPeriod(tenantId, asOfDate);
    
    if (!period) {
      throw new NotFoundException('No active fiscal period found for the specified date');
    }

    return period;
  }

  async findOpenFiscalPeriods(tenantId: string) {
    return await this.fiscalPeriodRepository.findOpenPeriods(tenantId);
  }

  async updateFiscalPeriod(tenantId: string, id: string, data: {
    periodName?: string;
    startDate?: Date;
    endDate?: Date;
    isActive?: boolean;
  }, userId: string) {
    const period = await this.findFiscalPeriodById(tenantId, id);

    if (period.isClosed) {
      throw new BadRequestException('Cannot update closed fiscal period');
    }

    // Validate date range if dates are being updated
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    return await this.fiscalPeriodRepository.update(tenantId, id, data, userId);
  }

  async closeFiscalPeriod(tenantId: string, id: string, userId: string) {
    const period = await this.findFiscalPeriodById(tenantId, id);

    if (period.isClosed) {
      throw new BadRequestException('Fiscal period is already closed');
    }

    // Additional validation could be added here:
    // - Check if all transactions are posted
    // - Check if reconciliations are complete
    // - Check if required reports are generated

    return await this.fiscalPeriodRepository.closePeriod(tenantId, id, userId);
  }

  async processYearEnd(tenantId: string, id: string, userId: string) {
    const period = await this.findFiscalPeriodById(tenantId, id);

    if (!period.isYearEnd) {
      throw new BadRequestException('Only year-end periods can be processed for year-end');
    }

    if (!period.isClosed) {
      throw new BadRequestException('Period must be closed before year-end processing');
    }

    if (period.yearEndProcessed) {
      throw new BadRequestException('Year-end has already been processed for this period');
    }

    // Year-end processing logic would go here:
    // - Close revenue and expense accounts to retained earnings
    // - Generate year-end reports
    // - Create opening balances for next year

    return await this.fiscalPeriodRepository.processYearEnd(tenantId, id, userId);
  }

  async createStandardFiscalYear(tenantId: string, fiscalYear: number, startDate: Date, userId: string) {
    // Validate that fiscal year doesn't already exist
    const existingPeriods = await this.fiscalPeriodRepository.findByYear(tenantId, fiscalYear);
    
    if (existingPeriods.length > 0) {
      throw new BadRequestException(`Fiscal year ${fiscalYear} already exists`);
    }

    return await this.fiscalPeriodRepository.createStandardFiscalYear(tenantId, fiscalYear, startDate, userId);
  }

  async deleteFiscalPeriod(tenantId: string, id: string, userId: string) {
    const period = await this.findFiscalPeriodById(tenantId, id);

    if (period.isClosed) {
      throw new BadRequestException('Cannot delete closed fiscal period');
    }

    // Additional validation:
    // - Check if period has any journal entries
    // - Check if period is referenced in budgets

    return await this.fiscalPeriodRepository.delete(tenantId, id, userId);
  }

  async getFiscalYearSummary(tenantId: string, fiscalYear: number) {
    const periods = await this.fiscalPeriodRepository.findByYear(tenantId, fiscalYear);

    if (periods.length === 0) {
      throw new NotFoundException(`No periods found for fiscal year ${fiscalYear}`);
    }

    const summary = {
      fiscalYear,
      totalPeriods: periods.length,
      openPeriods: periods.filter(p => !p.isClosed).length,
      closedPeriods: periods.filter(p => p.isClosed).length,
      yearEndPeriod: periods.find(p => p.isYearEnd),
      yearEndProcessed: periods.some(p => p.isYearEnd && p.yearEndProcessed),
      startDate: periods[0]?.startDate,
      endDate: periods[periods.length - 1]?.endDate,
      periods: periods.map(p => ({
        id: p.id,
        periodNumber: p.periodNumber,
        periodName: p.periodName,
        startDate: p.startDate,
        endDate: p.endDate,
        isActive: p.isActive,
        isClosed: p.isClosed,
        isYearEnd: p.isYearEnd,
      })),
    };

    return summary;
  }

  async validateFiscalPeriodIntegrity(tenantId: string, fiscalYear: number) {
    const periods = await this.fiscalPeriodRepository.findByYear(tenantId, fiscalYear);
    const issues = [];

    if (periods.length === 0) {
      return {
        isValid: false,
        issues: [{ type: 'no_periods', message: `No periods defined for fiscal year ${fiscalYear}` }],
      };
    }

    // Check for gaps in period numbers
    const periodNumbers = periods.map(p => p.periodNumber).sort((a, b) => a - b);
    for (let i = 1; i <= periodNumbers.length; i++) {
      if (!periodNumbers.includes(i)) {
        issues.push({
          type: 'missing_period',
          message: `Period ${i} is missing for fiscal year ${fiscalYear}`,
        });
      }
    }

    // Check for overlapping dates
    const sortedPeriods = periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    for (let i = 0; i < sortedPeriods.length - 1; i++) {
      const current = sortedPeriods[i];
      const next = sortedPeriods[i + 1];
      
      if (current && next && current.endDate >= next.startDate) {
        issues.push({
          type: 'overlapping_periods',
          message: `Period ${current.periodNumber} overlaps with period ${next.periodNumber}`,
        });
      }
    }

    // Check for gaps in dates
    for (let i = 0; i < sortedPeriods.length - 1; i++) {
      const current = sortedPeriods[i];
      const next = sortedPeriods[i + 1];
      
      if (current && next) {
        const dayAfterCurrent = new Date(current.endDate);
        dayAfterCurrent.setDate(dayAfterCurrent.getDate() + 1);
        
        if (dayAfterCurrent.getTime() !== next.startDate.getTime()) {
          issues.push({
            type: 'date_gap',
            message: `Gap between period ${current.periodNumber} and period ${next.periodNumber}`,
          });
        }
      }
    }

    // Check for year-end period
    const yearEndPeriods = periods.filter(p => p.isYearEnd);
    if (yearEndPeriods.length === 0) {
      issues.push({
        type: 'no_year_end',
        message: `No year-end period defined for fiscal year ${fiscalYear}`,
      });
    } else if (yearEndPeriods.length > 1) {
      issues.push({
        type: 'multiple_year_end',
        message: `Multiple year-end periods defined for fiscal year ${fiscalYear}`,
      });
    }

    return {
      isValid: issues.length === 0,
      issues,
      summary: {
        totalPeriods: periods.length,
        openPeriods: periods.filter(p => !p.isClosed).length,
        closedPeriods: periods.filter(p => p.isClosed).length,
        yearEndProcessed: periods.some(p => p.isYearEnd && p.yearEndProcessed),
      },
    };
  }
}