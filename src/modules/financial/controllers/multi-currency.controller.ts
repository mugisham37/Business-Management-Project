import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseBoolPipe,
  ParseIntPipe,
  ParseFloatPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { 
  MultiCurrencyService, 
  Currency, 
  ExchangeRate, 
  ConversionResult,
  CurrencyRevaluation
} from '../services/multi-currency.service';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/financial/multi-currency')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('multi-currency')
@ApiTags('Multi-Currency')
export class MultiCurrencyController {
  constructor(private readonly multiCurrencyService: MultiCurrencyService) {}

  // Currency Management
  @Post('currencies')
  @RequirePermission('multi-currency:manage-currencies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new currency' })
  @ApiResponse({ status: 201, description: 'Currency created successfully' })
  async createCurrency(
    @Body() data: Partial<Currency>,
    @CurrentTenant() tenantId: string,
  ): Promise<Currency> {
    return this.multiCurrencyService.createCurrency(tenantId, data);
  }

  @Get('currencies')
  @RequirePermission('multi-currency:read-currencies')
  @ApiOperation({ summary: 'Get all currencies' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Currencies retrieved successfully' })
  async getCurrencies(
    @CurrentTenant() tenantId: string,
    @Query('activeOnly', new ParseBoolPipe({ optional: true })) activeOnly: boolean = true,
  ): Promise<Currency[]> {
    return this.multiCurrencyService.getCurrencies(tenantId, activeOnly);
  }

  @Get('currencies/base')
  @RequirePermission('multi-currency:read-currencies')
  @ApiOperation({ summary: 'Get base currency' })
  @ApiResponse({ status: 200, description: 'Base currency retrieved successfully' })
  async getBaseCurrency(
    @CurrentTenant() tenantId: string,
  ): Promise<Currency> {
    return this.multiCurrencyService.getBaseCurrency(tenantId);
  }

  @Get('currencies/code/:code')
  @RequirePermission('multi-currency:read-currencies')
  @ApiOperation({ summary: 'Get currency by code' })
  @ApiParam({ name: 'code', description: 'Currency code (e.g., USD, EUR)' })
  @ApiResponse({ status: 200, description: 'Currency retrieved successfully' })
  async getCurrencyByCode(
    @Param('code') code: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Currency | null> {
    return this.multiCurrencyService.getCurrencyByCode(tenantId, code);
  }

  // Exchange Rate Management
  @Post('exchange-rates')
  @RequirePermission('multi-currency:manage-rates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new exchange rate' })
  @ApiResponse({ status: 201, description: 'Exchange rate created successfully' })
  async createExchangeRate(
    @Body() data: Partial<ExchangeRate>,
    @CurrentTenant() tenantId: string,
  ): Promise<ExchangeRate> {
    return this.multiCurrencyService.createExchangeRate(tenantId, data);
  }

  @Get('exchange-rates/:fromCurrencyId/:toCurrencyId')
  @RequirePermission('multi-currency:read-rates')
  @ApiOperation({ summary: 'Get exchange rate between two currencies' })
  @ApiParam({ name: 'fromCurrencyId', description: 'From currency ID' })
  @ApiParam({ name: 'toCurrencyId', description: 'To currency ID' })
  @ApiQuery({ name: 'effectiveDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Exchange rate retrieved successfully' })
  async getExchangeRate(
    @Param('fromCurrencyId', ParseUUIDPipe) fromCurrencyId: string,
    @Param('toCurrencyId', ParseUUIDPipe) toCurrencyId: string,
    @CurrentTenant() tenantId: string,
    @Query('effectiveDate') effectiveDate?: string,
  ): Promise<ExchangeRate | null> {
    return this.multiCurrencyService.getExchangeRate(
      tenantId,
      fromCurrencyId,
      toCurrencyId,
      effectiveDate ? new Date(effectiveDate) : new Date()
    );
  }

  // Currency Conversion
  @Post('convert')
  @RequirePermission('multi-currency:convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert amount between currencies' })
  @ApiResponse({ status: 200, description: 'Amount converted successfully' })
  async convertAmount(
    @Body() data: {
      amount: number;
      fromCurrencyId: string;
      toCurrencyId: string;
      conversionDate?: string;
      sourceType?: string;
      sourceId?: string;
    },
    @CurrentTenant() tenantId: string,
  ): Promise<ConversionResult> {
    return this.multiCurrencyService.convertAmount(
      tenantId,
      data.amount,
      data.fromCurrencyId,
      data.toCurrencyId,
      data.conversionDate ? new Date(data.conversionDate) : new Date(),
      data.sourceType,
      data.sourceId
    );
  }

  @Post('convert-to-base')
  @RequirePermission('multi-currency:convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert amount to base currency' })
  @ApiResponse({ status: 200, description: 'Amount converted to base currency successfully' })
  async convertToBaseCurrency(
    @Body() data: {
      amount: number;
      fromCurrencyId: string;
      conversionDate?: string;
      sourceType?: string;
      sourceId?: string;
    },
    @CurrentTenant() tenantId: string,
  ): Promise<ConversionResult> {
    return this.multiCurrencyService.convertToBaseCurrency(
      tenantId,
      data.amount,
      data.fromCurrencyId,
      data.conversionDate ? new Date(data.conversionDate) : new Date(),
      data.sourceType,
      data.sourceId
    );
  }

  // Currency Revaluation
  @Post('revaluations')
  @RequirePermission('multi-currency:manage-revaluations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Perform currency revaluation' })
  @ApiResponse({ status: 201, description: 'Currency revaluation completed successfully' })
  async performCurrencyRevaluation(
    @Body() data: {
      currencyId: string;
      newExchangeRate: number;
      revaluationDate: string;
      fiscalYear: number;
      fiscalPeriod: number;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrencyRevaluation> {
    return this.multiCurrencyService.performCurrencyRevaluation(
      tenantId,
      data.currencyId,
      data.newExchangeRate,
      new Date(data.revaluationDate),
      data.fiscalYear,
      data.fiscalPeriod,
      user.id
    );
  }

  // Utility Endpoints
  @Post('format')
  @RequirePermission('multi-currency:read-currencies')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Format amount according to currency rules' })
  @ApiResponse({ status: 200, description: 'Amount formatted successfully' })
  async formatCurrencyAmount(
    @Body() data: {
      amount: number;
      currencyId: string;
    },
    @CurrentTenant() tenantId: string,
  ): Promise<{ formattedAmount: string }> {
    const formattedAmount = await this.multiCurrencyService.formatCurrencyAmount(
      data.amount,
      data.currencyId
    );
    return { formattedAmount };
  }

  // Quick conversion endpoint for UI
  @Get('quick-convert/:amount/:fromCode/:toCode')
  @RequirePermission('multi-currency:convert')
  @ApiOperation({ summary: 'Quick currency conversion by currency codes' })
  @ApiParam({ name: 'amount', description: 'Amount to convert' })
  @ApiParam({ name: 'fromCode', description: 'From currency code' })
  @ApiParam({ name: 'toCode', description: 'To currency code' })
  @ApiResponse({ status: 200, description: 'Quick conversion completed successfully' })
  async quickConvert(
    @Param('amount', ParseFloatPipe) amount: number,
    @Param('fromCode') fromCode: string,
    @Param('toCode') toCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ConversionResult> {
    // Get currencies by code
    const [fromCurrency, toCurrency] = await Promise.all([
      this.multiCurrencyService.getCurrencyByCode(tenantId, fromCode),
      this.multiCurrencyService.getCurrencyByCode(tenantId, toCode),
    ]);

    if (!fromCurrency || !toCurrency) {
      throw new Error('Currency not found');
    }

    return this.multiCurrencyService.convertAmount(
      tenantId,
      amount,
      fromCurrency.id,
      toCurrency.id
    );
  }
}