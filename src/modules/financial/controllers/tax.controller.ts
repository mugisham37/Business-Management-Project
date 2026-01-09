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
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { TaxService, TaxJurisdiction, TaxRate, TaxCalculationInput, TaxReturn } from '../services/tax.service';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/tax')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('tax-management')
@ApiTags('Tax Management')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  // Tax Jurisdictions
  @Post('jurisdictions')
  @RequirePermission('tax:manage-jurisdictions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tax jurisdiction' })
  @ApiResponse({ status: 201, description: 'Tax jurisdiction created successfully' })
  async createJurisdiction(
    @Body() data: Partial<TaxJurisdiction>,
    @CurrentTenant() tenantId: string,
  ): Promise<TaxJurisdiction> {
    return this.taxService.createJurisdiction(tenantId, data);
  }

  @Get('jurisdictions')
  @RequirePermission('tax:read-jurisdictions')
  @ApiOperation({ summary: 'Get all tax jurisdictions' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Tax jurisdictions retrieved successfully' })
  async getJurisdictions(
    @CurrentTenant() tenantId: string,
    @Query('activeOnly', new ParseBoolPipe({ optional: true })) activeOnly: boolean = true,
  ): Promise<TaxJurisdiction[]> {
    return this.taxService.getJurisdictions(tenantId, activeOnly);
  }

  @Get('jurisdictions/:code')
  @RequirePermission('tax:read-jurisdictions')
  @ApiOperation({ summary: 'Get tax jurisdiction by code' })
  @ApiParam({ name: 'code', description: 'Jurisdiction code' })
  @ApiResponse({ status: 200, description: 'Tax jurisdiction retrieved successfully' })
  async getJurisdictionByCode(
    @Param('code') code: string,
    @CurrentTenant() tenantId: string,
  ): Promise<TaxJurisdiction | null> {
    return this.taxService.getJurisdictionByCode(tenantId, code);
  }

  // Tax Rates
  @Post('rates')
  @RequirePermission('tax:manage-rates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tax rate' })
  @ApiResponse({ status: 201, description: 'Tax rate created successfully' })
  async createTaxRate(
    @Body() data: Partial<TaxRate>,
    @CurrentTenant() tenantId: string,
  ): Promise<TaxRate> {
    return this.taxService.createTaxRate(tenantId, data);
  }

  @Get('rates')
  @RequirePermission('tax:read-rates')
  @ApiOperation({ summary: 'Get tax rates' })
  @ApiQuery({ name: 'jurisdictionId', required: false, type: String })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Tax rates retrieved successfully' })
  async getTaxRates(
    @CurrentTenant() tenantId: string,
    @Query('jurisdictionId') jurisdictionId?: string,
    @Query('activeOnly', new ParseBoolPipe({ optional: true })) activeOnly: boolean = true,
  ): Promise<TaxRate[]> {
    return this.taxService.getTaxRates(tenantId, jurisdictionId, activeOnly);
  }

  // Tax Calculations
  @Post('calculate')
  @RequirePermission('tax:calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate tax for a transaction' })
  @ApiResponse({ status: 200, description: 'Tax calculated successfully' })
  async calculateTax(
    @Body() input: TaxCalculationInput,
    @CurrentTenant() tenantId: string,
  ) {
    return this.taxService.calculateTax(tenantId, input);
  }

  // Tax Returns
  @Post('returns')
  @RequirePermission('tax:manage-returns')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tax return' })
  @ApiResponse({ status: 201, description: 'Tax return created successfully' })
  async createTaxReturn(
    @Body() data: Partial<TaxReturn>,
    @CurrentTenant() tenantId: string,
  ): Promise<TaxReturn> {
    return this.taxService.createTaxReturn(tenantId, data);
  }

  @Get('returns')
  @RequirePermission('tax:read-returns')
  @ApiOperation({ summary: 'Get tax returns' })
  @ApiQuery({ name: 'jurisdictionId', required: false, type: String })
  @ApiQuery({ name: 'periodYear', required: false, type: Number })
  @ApiQuery({ name: 'filingStatus', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Tax returns retrieved successfully' })
  async getTaxReturns(
    @CurrentTenant() tenantId: string,
    @Query('jurisdictionId') jurisdictionId?: string,
    @Query('periodYear', new ParseIntPipe({ optional: true })) periodYear?: number,
    @Query('filingStatus') filingStatus?: string,
  ): Promise<TaxReturn[]> {
    return this.taxService.getTaxReturns(tenantId, jurisdictionId, periodYear, filingStatus);
  }

  @Post('returns/generate')
  @RequirePermission('tax:manage-returns')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate tax return for a period' })
  @ApiResponse({ status: 201, description: 'Tax return generated successfully' })
  async generateTaxReturn(
    @Body() data: {
      jurisdictionId: string;
      periodYear: number;
      periodNumber: number;
      periodType: string;
    },
    @CurrentTenant() tenantId: string,
  ): Promise<TaxReturn> {
    const { jurisdictionId, periodYear, periodNumber, periodType } = data;
    return this.taxService.generateTaxReturn(tenantId, jurisdictionId, periodYear, periodNumber, periodType);
  }
}