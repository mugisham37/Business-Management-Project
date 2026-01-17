import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BudgetService } from '../services/budget.service';
import { 
  CreateBudgetInput,
  UpdateBudgetInput,
  CreateBudgetLineInput
} from '../graphql/inputs';
import { 
  Budget, 
  BudgetLine, 
  BudgetVarianceAnalysis 
} from '../graphql/types';
import { ChartOfAccount } from '../graphql/types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Resolver(() => Budget)
@UseGuards(JwtAuthGuard, TenantGuard)
export class BudgetResolver {
  constructor(
    private readonly budgetService: BudgetService,
  ) {}

  /**
   * Query: Get budget by ID
   * Returns a single budget with all details
   */
  @Query(() => Budget)
  @RequirePermission('financial:read')
  async budget(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Budget> {
    const budget = await this.budgetService.findBudgetById(tenantId, id);
    
    if (!budget) {
      throw new Error('Budget not found');
    }
    
    // Transform service result to GraphQL Budget type
    return {
      id: budget.id,
      budgetName: budget.budgetName,
      budgetYear: budget.fiscalYear,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      totalBudgetAmount: '0.00',
      totalActualAmount: '0.00',
      totalVariance: '0.00',
      budgetLines: [],
      description: budget.description,
      approvedDate: budget.approvedAt,
      approvedBy: budget.approvedBy,
      isActive: budget.isActive,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      createdBy: budget.createdBy,
      updatedBy: budget.updatedBy,
      tenantId: budget.tenantId,
    } as Budget;
  }

  /**
   * Query: Get all budgets
   * Returns list of budgets with optional filtering
   */
  @Query(() => [Budget])
  @RequirePermission('financial:read')
  async budgets(
    @CurrentTenant() tenantId: string,
    @Args('fiscalYear', { nullable: true }) fiscalYear?: number,
    @Args('status', { nullable: true }) status?: string,
    @Args('budgetType', { nullable: true }) budgetType?: string,
  ): Promise<Budget[]> {
    const budgets = await this.budgetService.findAllBudgets(tenantId, {
      ...(fiscalYear !== undefined && { fiscalYear }),
      ...(status !== undefined && { status }),
      ...(budgetType !== undefined && { budgetType }),
    });

    // Transform service results to GraphQL Budget type
    return budgets.map(budget => {
      if (!budget) {
        throw new Error('Budget data is invalid');
      }
      
      return {
        id: budget.id,
        budgetName: budget.budgetName,
        budgetYear: budget.fiscalYear,
        startDate: budget.startDate,
        endDate: budget.endDate,
        status: budget.status,
        totalBudgetAmount: '0.00',
        totalActualAmount: '0.00',
        totalVariance: '0.00',
        budgetLines: [],
        description: budget.description,
        approvedDate: budget.approvedAt,
        approvedBy: budget.approvedBy,
        isActive: budget.isActive,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
        createdBy: budget.createdBy,
        updatedBy: budget.updatedBy,
        tenantId: budget.tenantId,
      };
    }) as Budget[];
  }

  /**
   * Query: Get budget variance analysis
   * Returns variance analysis comparing budget to actual spending
   */
  @Query(() => BudgetVarianceAnalysis)
  @RequirePermission('financial:read')
  async getBudgetVariance(
    @Args('budgetId', { type: () => ID }) budgetId: string,
    @CurrentTenant() tenantId: string,
    @Args('asOfDate', { nullable: true }) asOfDate?: Date,
  ): Promise<BudgetVarianceAnalysis> {
    const analysis = await this.budgetService.getBudgetVarianceAnalysis(
      tenantId,
      budgetId,
      asOfDate,
    );

    if (!analysis || !analysis.budget) {
      throw new Error('Budget variance analysis not found');
    }

    // Transform to match GraphQL type
    return {
      budgetId,
      budget: {
        id: analysis.budget.id,
        budgetName: analysis.budget.budgetName,
        budgetYear: analysis.budget.fiscalYear,
        startDate: analysis.budget.startDate,
        endDate: analysis.budget.endDate,
        status: analysis.budget.status,
        totalBudgetAmount: analysis.summary.totalBudgeted.toString(),
        totalActualAmount: analysis.summary.totalActual.toString(),
        totalVariance: analysis.summary.totalVariance.toString(),
        budgetLines: [],
        description: analysis.budget.description,
        approvedDate: analysis.budget.approvedAt,
        approvedBy: analysis.budget.approvedBy,
        isActive: analysis.budget.isActive,
        createdAt: analysis.budget.createdAt,
        updatedAt: analysis.budget.updatedAt,
        createdBy: analysis.budget.createdBy,
        updatedBy: analysis.budget.updatedBy,
        tenantId: analysis.budget.tenantId,
      } as Budget,
      totalBudget: analysis.summary.totalBudgeted.toString(),
      totalActual: analysis.summary.totalActual.toString(),
      totalVariance: analysis.summary.totalVariance.toString(),
      variancePercentage: analysis.percentComplete,
      accountVariances: [],
      analysisDate: analysis.asOfDate,
    } as BudgetVarianceAnalysis;
  }

  /**
   * Mutation: Create budget
   * Creates a new budget for a fiscal period
   */
  @Mutation(() => Budget)
  @RequirePermission('financial:manage')
  async createBudget(
    @Args('input') input: CreateBudgetInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Budget> {
    const budget = await this.budgetService.createBudget(
      tenantId,
      {
        budgetName: input.budgetName,
        budgetType: 'operating', // Default type since it's not in input
        fiscalYear: input.budgetYear,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        ...(input.description && { description: input.description }),
      },
      user.id,
    );

    if (!budget) {
      throw new Error('Failed to create budget');
    }

    return {
      id: budget.id,
      budgetName: budget.budgetName,
      budgetYear: budget.fiscalYear,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      totalBudgetAmount: '0.00',
      totalActualAmount: '0.00',
      totalVariance: '0.00',
      budgetLines: [],
      description: budget.description,
      approvedDate: budget.approvedAt,
      approvedBy: budget.approvedBy,
      isActive: budget.isActive,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      createdBy: budget.createdBy,
      updatedBy: budget.updatedBy,
      tenantId: budget.tenantId,
    } as Budget;
  }

  /**
   * Mutation: Update budget
   * Updates an existing budget (only if not approved/active)
   */
  @Mutation(() => Budget)
  @RequirePermission('financial:manage')
  async updateBudget(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateBudgetInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Budget> {
    const budget = await this.budgetService.updateBudget(
      tenantId,
      id,
      {
        ...(input.budgetName && { budgetName: input.budgetName }),
        ...(input.description && { description: input.description }),
      },
      user.id,
    );

    if (!budget) {
      throw new Error('Failed to update budget');
    }

    return {
      id: budget.id,
      budgetName: budget.budgetName,
      budgetYear: budget.fiscalYear,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      totalBudgetAmount: '0.00',
      totalActualAmount: '0.00',
      totalVariance: '0.00',
      budgetLines: [],
      description: budget.description,
      approvedDate: budget.approvedAt,
      approvedBy: budget.approvedBy,
      isActive: budget.isActive,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      createdBy: budget.createdBy,
      updatedBy: budget.updatedBy,
      tenantId: budget.tenantId,
    } as Budget;
  }

  /**
   * Mutation: Approve budget
   * Approves a draft budget for activation
   */
  @Mutation(() => Budget)
  @RequirePermission('financial:approve')
  async approveBudget(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Budget> {
    const budget = await this.budgetService.approveBudget(tenantId, id, user.id);
    
    if (!budget) {
      throw new Error('Failed to approve budget');
    }
    
    return {
      id: budget.id,
      budgetName: budget.budgetName,
      budgetYear: budget.fiscalYear,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      totalBudgetAmount: '0.00',
      totalActualAmount: '0.00',
      totalVariance: '0.00',
      budgetLines: [],
      description: budget.description,
      approvedDate: budget.approvedAt,
      approvedBy: budget.approvedBy,
      isActive: budget.isActive,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      createdBy: budget.createdBy,
      updatedBy: budget.updatedBy,
      tenantId: budget.tenantId,
    } as Budget;
  }

  /**
   * Mutation: Delete budget
   * Deletes a budget (only if not active)
   */
  @Mutation(() => Boolean)
  @RequirePermission('financial:manage')
  async deleteBudget(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.budgetService.deleteBudget(tenantId, id, user.id);
    return true;
  }

  /**
   * Mutation: Add budget line
   * Adds a line item to a budget
   */
  @Mutation(() => BudgetLine)
  @RequirePermission('financial:manage')
  async addBudgetLine(
    @Args('budgetId', { type: () => ID }) budgetId: string,
    @Args('input') input: CreateBudgetLineInput,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BudgetLine> {
    const budgetLine = await this.budgetService.addBudgetLine(
      tenantId,
      budgetId,
      {
        accountId: input.accountId,
        annualAmount: input.budgetAmount,
        ...(input.notes && { notes: input.notes }),
      },
      user.id,
    );

    if (!budgetLine) {
      throw new Error('Failed to add budget line');
    }

    // Transform to GraphQL type
    return {
      id: budgetLine.id,
      budgetId: budgetLine.budgetId,
      budget: {} as Budget, // Will be resolved by field resolver
      accountId: budgetLine.accountId,
      account: {} as ChartOfAccount, // Will be resolved by field resolver
      lineNumber: input.lineNumber,
      description: input.description,
      budgetAmount: budgetLine.annualAmount,
      actualAmount: '0.00',
      variance: '0.00',
      variancePercentage: '0.00',
      notes: budgetLine.notes,
      createdAt: budgetLine.createdAt,
      updatedAt: budgetLine.updatedAt,
      tenantId: budgetLine.tenantId,
    } as BudgetLine;
  }

  /**
   * Field Resolver: Get actual spending for budget
   * Calculates actual spending against budget
   */
  @ResolveField(() => String)
  async actualSpending(
    @Parent() budget: Budget,
  ): Promise<string> {
    // In a real implementation, this would calculate actual spending from transactions
    // For now, return 0
    return '0.00';
  }

  /**
   * Field Resolver: Get variance for budget
   * Calculates variance between budget and actual
   */
  @ResolveField(() => BudgetVarianceAnalysis)
  async variance(
    @Parent() budget: Budget,
    @CurrentTenant() tenantId: string,
  ): Promise<BudgetVarianceAnalysis> {
    // Get variance analysis
    const analysis = await this.budgetService.getBudgetVarianceAnalysis(
      tenantId,
      budget.id,
    );

    if (!analysis) {
      throw new Error('Budget variance analysis not found');
    }

    return {
      budgetId: budget.id,
      budget,
      totalBudget: analysis.summary.totalBudgeted.toString(),
      totalActual: analysis.summary.totalActual.toString(),
      totalVariance: analysis.summary.totalVariance.toString(),
      variancePercentage: analysis.percentComplete,
      accountVariances: [],
      analysisDate: analysis.asOfDate,
    } as BudgetVarianceAnalysis;
  }
}