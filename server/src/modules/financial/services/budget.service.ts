import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BudgetRepository } from '../repositories/budget.repository';
import { ChartOfAccountsService } from './chart-of-accounts.service';

@Injectable()
export class BudgetService {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  async createBudget(tenantId: string, data: {
    budgetName: string;
    budgetType: string;
    fiscalYear: number;
    startDate: Date;
    endDate: Date;
    description?: string;
    notes?: string;
  }, userId: string) {
    // Validate date range
    if (data.startDate >= data.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const budget = await this.budgetRepository.create(tenantId, data, userId);
    return budget;
  }

  async findBudgetById(tenantId: string, id: string) {
    const budget = await this.budgetRepository.findById(tenantId, id);
    
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return budget;
  }

  async findAllBudgets(tenantId: string, options?: {
    fiscalYear?: number;
    status?: string;
    budgetType?: string;
  }) {
    return await this.budgetRepository.findAll(tenantId, options);
  }

  async updateBudget(tenantId: string, id: string, data: {
    budgetName?: string;
    description?: string;
    notes?: string;
  }, userId: string) {
    const budget = await this.findBudgetById(tenantId, id);

    if (budget.status === 'approved' || budget.status === 'active') {
      throw new BadRequestException('Cannot update approved or active budget');
    }

    return await this.budgetRepository.update(tenantId, id, data, userId);
  }

  async approveBudget(tenantId: string, id: string, userId: string) {
    const budget = await this.findBudgetById(tenantId, id);

    if (budget.status !== 'draft') {
      throw new BadRequestException('Only draft budgets can be approved');
    }

    return await this.budgetRepository.update(tenantId, id, {
      status: 'approved',
      approvedBy: userId,
      approvedAt: new Date(),
    }, userId);
  }

  async activateBudget(tenantId: string, id: string, userId: string) {
    const budget = await this.findBudgetById(tenantId, id);

    if (budget.status !== 'approved') {
      throw new BadRequestException('Only approved budgets can be activated');
    }

    // Deactivate other active budgets for the same fiscal year and type
    const existingBudgets = await this.budgetRepository.findAll(tenantId, {
      fiscalYear: budget.fiscalYear,
      budgetType: budget.budgetType,
    });

    for (const existingBudget of existingBudgets) {
      if (existingBudget.status === 'active' && existingBudget.id !== id) {
        await this.budgetRepository.update(tenantId, existingBudget.id, {
          status: 'closed',
        }, userId);
      }
    }

    return await this.budgetRepository.update(tenantId, id, {
      status: 'active',
    }, userId);
  }

  async closeBudget(tenantId: string, id: string, userId: string) {
    const budget = await this.findBudgetById(tenantId, id);

    if (budget.status === 'closed') {
      throw new BadRequestException('Budget is already closed');
    }

    return await this.budgetRepository.update(tenantId, id, {
      status: 'closed',
    }, userId);
  }

  async deleteBudget(tenantId: string, id: string, userId: string) {
    const budget = await this.findBudgetById(tenantId, id);

    if (budget.status === 'active') {
      throw new BadRequestException('Cannot delete active budget');
    }

    return await this.budgetRepository.delete(tenantId, id, userId);
  }

  // Budget Lines methods
  async addBudgetLine(tenantId: string, budgetId: string, data: {
    accountId: string;
    annualAmount: string;
    q1Amount?: string;
    q2Amount?: string;
    q3Amount?: string;
    q4Amount?: string;
    monthlyAmounts?: Record<string, any>;
    departmentId?: string;
    projectId?: string;
    locationId?: string;
    notes?: string;
  }, userId: string) {
    const budget = await this.findBudgetById(tenantId, budgetId);

    if (budget.status === 'active' || budget.status === 'closed') {
      throw new BadRequestException('Cannot modify active or closed budget');
    }

    // Verify account exists
    await this.chartOfAccountsService.findAccountById(tenantId, data.accountId);

    // Auto-calculate quarterly amounts if not provided
    const annualAmount = parseFloat(data.annualAmount);
    const quarterlyAmount = (annualAmount / 4).toFixed(2);

    const budgetLineData = {
      ...data,
      budgetId,
      q1Amount: data.q1Amount || quarterlyAmount,
      q2Amount: data.q2Amount || quarterlyAmount,
      q3Amount: data.q3Amount || quarterlyAmount,
      q4Amount: data.q4Amount || quarterlyAmount,
    };

    // Auto-calculate monthly amounts if not provided
    if (!data.monthlyAmounts) {
      const monthlyAmount = (annualAmount / 12).toFixed(2);
      budgetLineData.monthlyAmounts = {};
      for (let month = 1; month <= 12; month++) {
        budgetLineData.monthlyAmounts[month] = monthlyAmount;
      }
    }

    return await this.budgetRepository.createBudgetLine(tenantId, budgetLineData, userId);
  }

  async updateBudgetLine(tenantId: string, budgetId: string, lineId: string, data: {
    annualAmount?: string;
    q1Amount?: string;
    q2Amount?: string;
    q3Amount?: string;
    q4Amount?: string;
    monthlyAmounts?: Record<string, any>;
    notes?: string;
  }, userId: string) {
    const budget = await this.findBudgetById(tenantId, budgetId);

    if (budget.status === 'active' || budget.status === 'closed') {
      throw new BadRequestException('Cannot modify active or closed budget');
    }

    // If annual amount is updated, recalculate quarterly and monthly amounts
    if (data.annualAmount) {
      const annualAmount = parseFloat(data.annualAmount);
      const quarterlyAmount = (annualAmount / 4).toFixed(2);
      const monthlyAmount = (annualAmount / 12).toFixed(2);

      if (!data.q1Amount) data.q1Amount = quarterlyAmount;
      if (!data.q2Amount) data.q2Amount = quarterlyAmount;
      if (!data.q3Amount) data.q3Amount = quarterlyAmount;
      if (!data.q4Amount) data.q4Amount = quarterlyAmount;

      if (!data.monthlyAmounts) {
        data.monthlyAmounts = {};
        for (let month = 1; month <= 12; month++) {
          data.monthlyAmounts[month] = monthlyAmount;
        }
      }
    }

    return await this.budgetRepository.updateBudgetLine(tenantId, lineId, data, userId);
  }

  async deleteBudgetLine(tenantId: string, budgetId: string, lineId: string, userId: string) {
    const budget = await this.findBudgetById(tenantId, budgetId);

    if (budget.status === 'active' || budget.status === 'closed') {
      throw new BadRequestException('Cannot modify active or closed budget');
    }

    return await this.budgetRepository.deleteBudgetLine(tenantId, lineId, userId);
  }

  async getBudgetWithLines(tenantId: string, budgetId: string) {
    const budgetWithLines = await this.budgetRepository.getBudgetWithLines(tenantId, budgetId);
    
    if (!budgetWithLines) {
      throw new NotFoundException('Budget not found');
    }

    return budgetWithLines;
  }

  async getBudgetVarianceAnalysis(tenantId: string, budgetId: string, asOfDate?: Date) {
    const budgetWithLines = await this.getBudgetWithLines(tenantId, budgetId);
    const currentDate = asOfDate || new Date();

    // Calculate which period we're in
    const startDate = new Date(budgetWithLines.startDate);
    const endDate = new Date(budgetWithLines.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const percentComplete = Math.min(Math.max(daysPassed / totalDays, 0), 1);

    const analysis = {
      budget: budgetWithLines,
      asOfDate: currentDate,
      percentComplete: (percentComplete * 100).toFixed(2),
      lines: [] as Array<{
        accountId: string;
        budgetedAmount: string;
        expectedAmount: string;
        actualAmount: string;
        variance: string;
        variancePercent: string;
        isFavorable: boolean;
      }>,
      summary: {
        totalBudgeted: 0,
        totalActual: 0,
        totalVariance: 0,
        favorableVariances: 0,
        unfavorableVariances: 0,
      },
    };

    for (const line of budgetWithLines.lines) {
      const budgetedAmount = parseFloat(line.annualAmount);
      const expectedAmount = budgetedAmount * percentComplete;
      
      // Get actual amount from account balance
      // This would require integration with actual accounting data
      const actualAmount = 0; // Placeholder - would get from account ledger

      const variance = actualAmount - expectedAmount;
      const variancePercent = expectedAmount > 0 ? (variance / expectedAmount) * 100 : 0;

      const lineAnalysis = {
        accountId: line.accountId,
        budgetedAmount: budgetedAmount.toFixed(2),
        expectedAmount: expectedAmount.toFixed(2),
        actualAmount: actualAmount.toFixed(2),
        variance: variance.toFixed(2),
        variancePercent: variancePercent.toFixed(2),
        isFavorable: variance >= 0,
      };

      analysis.lines.push(lineAnalysis);
      analysis.summary.totalBudgeted += budgetedAmount;
      analysis.summary.totalActual += actualAmount;
      analysis.summary.totalVariance += variance;

      if (variance >= 0) {
        analysis.summary.favorableVariances++;
      } else {
        analysis.summary.unfavorableVariances++;
      }
    }

    analysis.summary.totalBudgeted = parseFloat(analysis.summary.totalBudgeted.toFixed(2));
    analysis.summary.totalActual = parseFloat(analysis.summary.totalActual.toFixed(2));
    analysis.summary.totalVariance = parseFloat(analysis.summary.totalVariance.toFixed(2));

    return analysis;
  }

  async copyBudget(tenantId: string, sourceBudgetId: string, newBudgetData: {
    budgetName: string;
    fiscalYear: number;
    startDate: Date;
    endDate: Date;
    description?: string;
  }, userId: string) {
    const sourceBudget = await this.getBudgetWithLines(tenantId, sourceBudgetId);

    // Create new budget
    const newBudget = await this.createBudget(tenantId, {
      ...newBudgetData,
      budgetType: sourceBudget.budgetType,
    }, userId);

    if (!newBudget) {
      throw new Error('Failed to create new budget');
    }

    // Copy budget lines
    for (const line of sourceBudget.lines) {
      const budgetLineData: any = {
        budgetId: newBudget.id,
        accountId: line.accountId,
        annualAmount: line.annualAmount,
        q1Amount: line.q1Amount,
        q2Amount: line.q2Amount,
        q3Amount: line.q3Amount,
        q4Amount: line.q4Amount,
        monthlyAmounts: line.monthlyAmounts as Record<string, any>,
      };

      // Only add optional properties if they have values
      if (line.departmentId) budgetLineData.departmentId = line.departmentId;
      if (line.projectId) budgetLineData.projectId = line.projectId;
      if (line.locationId) budgetLineData.locationId = line.locationId;
      if (line.notes) budgetLineData.notes = line.notes;

      await this.budgetRepository.createBudgetLine(tenantId, budgetLineData, userId);
    }

    return await this.getBudgetWithLines(tenantId, newBudget.id);
  }
}