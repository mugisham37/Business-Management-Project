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
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import {
  CreateChartOfAccountDto,
  UpdateChartOfAccountDto,
  ChartOfAccountResponseDto,
  AccountHierarchyDto,
  AccountType,
} from '../dto/chart-of-accounts.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/chart-of-accounts')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
@ApiTags('Financial')
export class ChartOfAccountsController {
  constructor(private readonly chartOfAccountsService: ChartOfAccountsService) {}

  @Post()
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({ status: 201, description: 'Account created successfully', type: ChartOfAccountResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Account number already exists' })
  async createAccount(
    @Body() dto: CreateChartOfAccountDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChartOfAccountResponseDto> {
    return await this.chartOfAccountsService.createAccount(tenantId, dto, user.id);
  }

  @Get()
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get all accounts' })
  @ApiQuery({ name: 'accountType', enum: AccountType, required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'parentAccountId', type: String, required: false })
  @ApiQuery({ name: 'includeInactive', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully', type: [ChartOfAccountResponseDto] })
  async getAllAccounts(
    @CurrentTenant() tenantId: string,
    @Query('accountType') accountType?: AccountType,
    @Query('isActive') isActive?: boolean,
    @Query('parentAccountId') parentAccountId?: string,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<ChartOfAccountResponseDto[]> {
    const filters: { accountType?: AccountType; isActive?: boolean; parentAccountId?: string; includeInactive?: boolean } = {};
    if (accountType !== undefined) filters.accountType = accountType;
    if (isActive !== undefined) filters.isActive = isActive;
    if (parentAccountId !== undefined) filters.parentAccountId = parentAccountId;
    if (includeInactive !== undefined) filters.includeInactive = includeInactive;
    
    return await this.chartOfAccountsService.getAllAccounts(tenantId, filters);
  }

  @Get('hierarchy')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get account hierarchy' })
  @ApiQuery({ name: 'rootAccountId', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Account hierarchy retrieved successfully', type: [AccountHierarchyDto] })
  async getAccountHierarchy(
    @CurrentTenant() tenantId: string,
    @Query('rootAccountId') rootAccountId?: string,
  ): Promise<AccountHierarchyDto[]> {
    return await this.chartOfAccountsService.getAccountHierarchy(tenantId, rootAccountId);
  }

  @Get('search')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Search accounts' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'Maximum number of results' })
  @ApiResponse({ status: 200, description: 'Search results', type: [ChartOfAccountResponseDto] })
  async searchAccounts(
    @CurrentTenant() tenantId: string,
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
  ): Promise<ChartOfAccountResponseDto[]> {
    return await this.chartOfAccountsService.searchAccounts(tenantId, searchTerm, limit);
  }

  @Get('by-type')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get accounts by type' })
  @ApiQuery({ name: 'types', description: 'Comma-separated account types' })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully', type: [ChartOfAccountResponseDto] })
  async getAccountsByType(
    @CurrentTenant() tenantId: string,
    @Query('types') types: string,
  ): Promise<ChartOfAccountResponseDto[]> {
    const accountTypes = types.split(',') as AccountType[];
    return await this.chartOfAccountsService.getAccountsByType(tenantId, accountTypes);
  }

  @Get(':id')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully', type: ChartOfAccountResponseDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ChartOfAccountResponseDto> {
    return await this.chartOfAccountsService.findAccountById(tenantId, id);
  }

  @Get(':id/balance')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get account balance' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Account balance retrieved successfully' })
  async getAccountBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ accountId: string; balance: string }> {
    const balance = await this.chartOfAccountsService.getAccountBalance(tenantId, id);
    return { accountId: id, balance };
  }

  @Put(':id')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Update account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 200, description: 'Account updated successfully', type: ChartOfAccountResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChartOfAccountDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChartOfAccountResponseDto> {
    return await this.chartOfAccountsService.updateAccount(tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('financial:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({ status: 204, description: 'Account deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete account' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async deleteAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.chartOfAccountsService.deleteAccount(tenantId, id, user.id);
  }

  @Post('initialize-defaults')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Initialize default chart of accounts' })
  @ApiResponse({ status: 201, description: 'Default accounts created successfully' })
  async initializeDefaultAccounts(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string; accountsCreated: number }> {
    const accounts = await this.chartOfAccountsService.initializeDefaultChartOfAccounts(tenantId, user.id);
    return {
      message: 'Default chart of accounts initialized successfully',
      accountsCreated: accounts.length,
    };
  }
}