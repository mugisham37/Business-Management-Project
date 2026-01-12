import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AccountingService } from '../services/accounting.service';
import { AccountType } from '../dto/chart-of-accounts.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/accounting')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('financial-management')
@ApiTags('Financial')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('initialize')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Initialize accounting system for tenant' })
  @ApiResponse({ status: 201, description: 'Accounting system initialized successfully' })
  async initializeAccounting(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.accountingService.initializeTenantAccounting(tenantId, user.id);
  }

  @Get('trial-balance')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get trial balance' })
  @ApiQuery({ name: 'asOfDate', type: Date, required: false, description: 'As of date for trial balance' })
  @ApiResponse({ status: 200, description: 'Trial balance retrieved successfully' })
  async getTrialBalance(
    @CurrentTenant() tenantId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const date = asOfDate ? new Date(asOfDate) : undefined;
    return await this.accountingService.getTrialBalance(tenantId, date);
  }

  @Get('account-balances')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get account balances' })
  @ApiQuery({ name: 'accountType', enum: AccountType, required: false })
  @ApiQuery({ name: 'asOfDate', type: Date, required: false })
  @ApiResponse({ status: 200, description: 'Account balances retrieved successfully' })
  async getAccountBalances(
    @CurrentTenant() tenantId: string,
    @Query('accountType') accountType?: AccountType,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const date = asOfDate ? new Date(asOfDate) : undefined;
    return await this.accountingService.getAccountBalances(tenantId, accountType, date);
  }

  @Get('financial-summary')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Get financial summary' })
  @ApiQuery({ name: 'dateFrom', type: Date, required: false })
  @ApiQuery({ name: 'dateTo', type: Date, required: false })
  @ApiResponse({ status: 200, description: 'Financial summary retrieved successfully' })
  async getFinancialSummary(
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const fromDate = dateFrom ? new Date(dateFrom) : undefined;
    const toDate = dateTo ? new Date(dateTo) : undefined;
    return await this.accountingService.getFinancialSummary(tenantId, fromDate, toDate);
  }

  @Post('post-transaction')
  @RequirePermission('financial:manage')
  @ApiOperation({ summary: 'Post transaction to accounting' })
  @ApiBody({
    description: 'Transaction data to post',
    schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' },
        description: { type: 'string' },
        amount: { type: 'number' },
        customerId: { type: 'string' },
        locationId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
              totalPrice: { type: 'number' },
            },
          },
        },
        taxes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              taxType: { type: 'string' },
              rate: { type: 'number' },
              amount: { type: 'number' },
            },
          },
        },
        paymentMethod: { type: 'string' },
      },
      required: ['transactionId', 'description', 'amount', 'items', 'paymentMethod'],
    },
  })
  @ApiResponse({ status: 201, description: 'Transaction posted successfully' })
  async postTransaction(
    @Body() transactionData: any,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.accountingService.postTransactionToAccounting(tenantId, transactionData, user.id);
  }

  @Get('validate-integrity')
  @RequirePermission('financial:read')
  @ApiOperation({ summary: 'Validate accounting integrity' })
  @ApiResponse({ status: 200, description: 'Integrity validation completed' })
  async validateIntegrity(
    @CurrentTenant() tenantId: string,
  ) {
    return await this.accountingService.validateAccountingIntegrity(tenantId);
  }
}