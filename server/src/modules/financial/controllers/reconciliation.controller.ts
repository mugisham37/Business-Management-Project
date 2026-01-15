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
import { ReconciliationService } from '../services/reconciliation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/reconciliations')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
@ApiTags('Financial')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post()
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Create a new reconciliation' })
  @ApiResponse({ status: 201, description: 'Reconciliation created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createReconciliation(
    @Body() dto: {
      accountId: string;
      reconciliationDate: string;
      statementDate: string;
      statementBalance: string;
      notes?: string;
      attachments?: any[];
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const reconciliationData = {
      ...dto,
      reconciliationDate: new Date(dto.reconciliationDate),
      statementDate: new Date(dto.statementDate),
    };
    return await this.reconciliationService.createReconciliation(tenantId, reconciliationData, user.id);
  }

  @Get()
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get all reconciliations' })
  @ApiQuery({ name: 'accountId', type: String, required: false })
  @ApiQuery({ name: 'dateFrom', type: String, required: false })
  @ApiQuery({ name: 'dateTo', type: String, required: false })
  @ApiQuery({ name: 'status', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Reconciliations retrieved successfully' })
  async getAllReconciliations(
    @CurrentTenant() tenantId: string,
    @Query('accountId') accountId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
  ) {
    const options: { dateFrom?: Date; dateTo?: Date; status?: string; limit?: number } = {};
    if (dateFrom) options.dateFrom = new Date(dateFrom);
    if (dateTo) options.dateTo = new Date(dateTo);
    if (status !== undefined) options.status = status;
    
    if (accountId) {
      return await this.reconciliationService.findReconciliationsByAccount(tenantId, accountId, options);
    }
    
    // This would require a findAll method in the service
    throw new Error('Account ID is required');
  }

  @Get('by-account/:accountId')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get reconciliations by account' })
  @ApiParam({ name: 'accountId', description: 'Account ID' })
  @ApiQuery({ name: 'dateFrom', type: String, required: false })
  @ApiQuery({ name: 'dateTo', type: String, required: false })
  @ApiQuery({ name: 'status', type: String, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Reconciliations retrieved successfully' })
  async getReconciliationsByAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    const options: { dateFrom?: Date; dateTo?: Date; status?: string; limit?: number } = {};
    if (dateFrom) options.dateFrom = new Date(dateFrom);
    if (dateTo) options.dateTo = new Date(dateTo);
    if (status !== undefined) options.status = status;
    if (limit !== undefined) options.limit = limit;
    
    return await this.reconciliationService.findReconciliationsByAccount(tenantId, accountId, options);
  }

  @Get(':id')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get reconciliation by ID' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Reconciliation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Reconciliation not found' })
  async getReconciliationById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.reconciliationService.findReconciliationById(tenantId, id);
  }

  @Get(':id/items')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get reconciliation items' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Reconciliation items retrieved successfully' })
  async getReconciliationItems(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return await this.reconciliationService.getReconciliationItems(tenantId, id);
  }

  @Get('summary/:accountId')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get reconciliation summary for account' })
  @ApiParam({ name: 'accountId', description: 'Account ID' })
  @ApiQuery({ name: 'dateFrom', type: String, required: false })
  @ApiQuery({ name: 'dateTo', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Reconciliation summary retrieved successfully' })
  async getReconciliationSummary(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const fromDate = dateFrom ? new Date(dateFrom) : undefined;
    const toDate = dateTo ? new Date(dateTo) : undefined;
    return await this.reconciliationService.getReconciliationSummary(tenantId, accountId, fromDate, toDate);
  }

  @Put(':id')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Update reconciliation' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Reconciliation updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or reconciliation cannot be updated' })
  @ApiResponse({ status: 404, description: 'Reconciliation not found' })
  async updateReconciliation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: {
      reconciliationDate?: string;
      statementDate?: string;
      statementBalance?: string;
      notes?: string;
      attachments?: any[];
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updateData: any = { ...dto };
    if (dto.reconciliationDate) updateData.reconciliationDate = new Date(dto.reconciliationDate);
    if (dto.statementDate) updateData.statementDate = new Date(dto.statementDate);
    
    return await this.reconciliationService.updateReconciliation(tenantId, id, updateData, user.id);
  }

  @Post(':id/reconcile')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Mark reconciliation as reconciled' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Reconciliation marked as reconciled successfully' })
  @ApiResponse({ status: 400, description: 'Reconciliation cannot be marked as reconciled' })
  async markAsReconciled(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.reconciliationService.markAsReconciled(tenantId, id, user.id);
  }

  @Post(':id/dispute')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Mark reconciliation as disputed' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Reconciliation marked as disputed successfully' })
  async markAsDisputed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { notes?: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.reconciliationService.markAsDisputed(tenantId, id, user.id, dto.notes);
  }

  @Post('auto-reconcile')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Auto-reconcile account' })
  @ApiResponse({ status: 201, description: 'Auto-reconciliation completed successfully' })
  async autoReconcile(
    @Body() dto: {
      accountId: string;
      reconciliationDate: string;
      statementBalance: string;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.reconciliationService.autoReconcile(
      tenantId,
      dto.accountId,
      new Date(dto.reconciliationDate),
      dto.statementBalance,
      user.id
    );
  }

  @Delete(':id')
  @RequirePermission('financial:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete reconciliation' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 204, description: 'Reconciliation deleted successfully' })
  @ApiResponse({ status: 400, description: 'Reconciliation cannot be deleted' })
  async deleteReconciliation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.reconciliationService.deleteReconciliation(tenantId, id, user.id);
  }
}