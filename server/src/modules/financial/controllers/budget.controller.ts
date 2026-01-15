import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BudgetService } from '../services/budget.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/budgets')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
@ApiTags('Financial')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Create a new budget' })
  @ApiResponse({ status: 201, description: 'Budget created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createBudget(
    @Body() dto: {
      budgetName: string;
      budgetType: string;
      fiscalYear: number;
      startDate: string;
      endDate: string;
      description?: string;
      notes?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const budgetData = {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    };
    return await this.budgetService.createBudget(tenantId, budgetData, user.id);
  }

  @Get()
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get all budgets' })
  @ApiQuery({ name: 'fiscalYear', type: Number, required: false })
  @ApiQuery({ name: 'status', type: String, required: false })
  @ApiQuery({ name: 'budgetType', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Budgets retrieved successfully' })
  async getAllBudgets(
    @CurrentTenant() tenantId: string,
    @Query('fiscalYear') fiscalYear?: number,
    @Query('status') status?: string,
    @Query('budgetType') budgetType?: string,
  ) {
    const filters: { fiscalYear?: number; status?: string; budgetType?: string } = {};
    if (fiscalYear !== undefined) filters.fiscalYear = fiscalYear;
    if (status !== undefined) filters.status = status;
    if (budgetType !== undefined) filters.budgetType = budgetType;
    
    return await this.budgetService.findAllBudgets(tenantId, filters);
  }

  @Get(':id')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get budget by ID' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async getBudgetById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.budgetService.findBudgetById(tenantId, id);
  }

  @Get(':id/with-lines')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get budget with lines' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget with lines retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async getBudgetWithLines(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.budgetService.getBudgetWithLines(tenantId, id);
  }

  @Get(':id/variance-analysis')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get budget variance analysis' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiQuery({ name: 'asOfDate', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Variance analysis retrieved successfully' })
  async getBudgetVarianceAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const date = asOfDate ? new Date(asOfDate) : undefined;
    return await this.budgetService.getBudgetVarianceAnalysis(tenantId, id, date);
  }

  @Put(':id')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Update budget' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or budget cannot be updated' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async updateBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: {
      budgetName?: string;
      description?: string;
      notes?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.budgetService.updateBudget(tenantId, id, dto, user.id);
  }

  @Post(':id/approve')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Approve budget' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget approved successfully' })
  @ApiResponse({ status: 400, description: 'Budget cannot be approved' })
  async approveBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.budgetService.approveBudget(tenantId, id, user.id);
  }

  @Post(':id/activate')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Activate budget' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget activated successfully' })
  @ApiResponse({ status: 400, description: 'Budget cannot be activated' })
  async activateBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.budgetService.activateBudget(tenantId, id, user.id);
  }

  @Post(':id/close')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Close budget' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget closed successfully' })
  async closeBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.budgetService.closeBudget(tenantId, id, user.id);
  }

  @Post(':id/lines')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Add budget line' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 201, description: 'Budget line added successfully' })
  async addBudgetLine(
    @Param('id', ParseUUIDPipe) budgetId: string,
    @Body() dto: {
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
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.budgetService.addBudgetLine(tenantId, budgetId, dto, user.id);
  }

  @Put(':id/lines/:lineId')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Update budget line' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiParam({ name: 'lineId', description: 'Budget line ID' })
  @ApiResponse({ status: 200, description: 'Budget line updated successfully' })
  async updateBudgetLine(
    @Param('id', ParseUUIDPipe) budgetId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: {
      annualAmount?: string;
      q1Amount?: string;
      q2Amount?: string;
      q3Amount?: string;
      q4Amount?: string;
      monthlyAmounts?: Record<string, any>;
      notes?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.budgetService.updateBudgetLine(tenantId, budgetId, lineId, dto, user.id);
  }

  @Delete(':id/lines/:lineId')
  @RequirePermission('financial:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete budget line' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiParam({ name: 'lineId', description: 'Budget line ID' })
  @ApiResponse({ status: 204, description: 'Budget line deleted successfully' })
  async deleteBudgetLine(
    @Param('id', ParseUUIDPipe) budgetId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.budgetService.deleteBudgetLine(tenantId, budgetId, lineId, user.id);
  }

  @Post(':id/copy')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Copy budget' })
  @ApiParam({ name: 'id', description: 'Source budget ID' })
  @ApiResponse({ status: 201, description: 'Budget copied successfully' })
  async copyBudget(
    @Param('id', ParseUUIDPipe) sourceBudgetId: string,
    @Body() dto: {
      budgetName: string;
      fiscalYear: number;
      startDate: string;
      endDate: string;
      description?: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const newBudgetData = {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    };
    return await this.budgetService.copyBudget(tenantId, sourceBudgetId, newBudgetData, user.id);
  }

  @Delete(':id')
  @RequirePermission('financial:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete budget' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 204, description: 'Budget deleted successfully' })
  @ApiResponse({ status: 400, description: 'Budget cannot be deleted' })
  async deleteBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.budgetService.deleteBudget(tenantId, id, user.id);
  }
}