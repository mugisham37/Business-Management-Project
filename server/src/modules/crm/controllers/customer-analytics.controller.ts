import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseFloatPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomerAnalyticsService } from '../services/customer-analytics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../../common/interceptors/cache.interceptor';

@Controller('api/v1/customer-analytics')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-crm')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Customer Analytics')
@ApiBearerAuth()
export class CustomerAnalyticsController {
  constructor(private readonly customerAnalyticsService: CustomerAnalyticsService) {}

  @Get('lifetime-value/:customerId')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer lifetime value analysis' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Customer lifetime value data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        currentValue: { type: 'number' },
        predictedValue: { type: 'number' },
        totalOrders: { type: 'number' },
        averageOrderValue: { type: 'number' },
        daysSinceFirstPurchase: { type: 'number' },
        daysSinceLastPurchase: { type: 'number' },
        purchaseFrequency: { type: 'number' },
        churnRisk: { type: 'number' }
      }
    }
  })
  async getCustomerLifetimeValue(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.customerAnalyticsService.calculateCustomerLifetimeValue(tenantId, customerId);
  }

  @Get('purchase-patterns/:customerId')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer purchase pattern analysis' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Purchase patterns retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        seasonalPatterns: { type: 'object' },
        dayOfWeekPatterns: { type: 'object' },
        categoryPreferences: { type: 'object' },
        averageTimeBetweenPurchases: { type: 'number' },
        preferredPurchaseTime: { type: 'string' },
        spendingTrend: { type: 'string', enum: ['increasing', 'decreasing', 'stable'] }
      }
    }
  })
  async getPurchasePatterns(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.customerAnalyticsService.analyzePurchasePatterns(tenantId, customerId);
  }

  @Get('churn-prediction/:customerId')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer churn risk prediction' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Churn prediction data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        churnRisk: { type: 'number' },
        riskFactors: { type: 'array', items: { type: 'string' } },
        lastPurchaseDate: { type: 'string', format: 'date-time' },
        daysSinceLastPurchase: { type: 'number' },
        expectedNextPurchaseDate: { type: 'string', format: 'date-time' },
        recommendedActions: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async getChurnPrediction(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.customerAnalyticsService.predictChurnRisk(tenantId, customerId);
  }

  @Get('segments')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer segment analytics' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Segment analytics retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          segmentName: { type: 'string' },
          customerCount: { type: 'number' },
          averageLifetimeValue: { type: 'number' },
          averageOrderValue: { type: 'number' },
          averagePurchaseFrequency: { type: 'number' },
          churnRate: { type: 'number' },
          loyaltyTierDistribution: { type: 'object' }
        }
      }
    }
  })
  async getSegmentAnalytics(@CurrentTenant() tenantId: string) {
    return this.customerAnalyticsService.getCustomerSegmentAnalytics(tenantId);
  }

  @Get('top-customers')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get top customers by lifetime value' })
  @ApiQuery({ name: 'limit', description: 'Number of customers to return', required: false })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Top customers retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          displayName: { type: 'string' },
          email: { type: 'string' },
          lifetimeValue: { type: 'number' },
          totalOrders: { type: 'number' },
          averageOrderValue: { type: 'number' },
          loyaltyTier: { type: 'string' },
          loyaltyPoints: { type: 'number' }
        }
      }
    }
  })
  async getTopCustomers(
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @CurrentTenant() tenantId: string,
  ) {
    return this.customerAnalyticsService.getTopCustomersByValue(tenantId, limit);
  }

  @Get('at-risk')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customers at risk of churning' })
  @ApiQuery({ name: 'riskThreshold', description: 'Minimum churn risk threshold (0-1)', required: false })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'At-risk customers retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          displayName: { type: 'string' },
          email: { type: 'string' },
          churnRisk: { type: 'number' },
          daysSinceLastPurchase: { type: 'number' },
          lifetimeValue: { type: 'number' },
          totalOrders: { type: 'number' }
        }
      }
    }
  })
  async getAtRiskCustomers(
    @Query('riskThreshold', new ParseFloatPipe({ optional: true })) riskThreshold: number = 0.6,
    @CurrentTenant() tenantId: string,
  ) {
    return this.customerAnalyticsService.getCustomersAtRisk(tenantId, riskThreshold);
  }

  @Get('growth-metrics')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer growth metrics' })
  @ApiQuery({ name: 'days', description: 'Number of days to analyze', required: false })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Growth metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        newCustomers: { type: 'number' },
        returningCustomers: { type: 'number' },
        churnedCustomers: { type: 'number' },
        reactivatedCustomers: { type: 'number' },
        growthRate: { type: 'number' }
      }
    }
  })
  async getGrowthMetrics(
    @Query('days', new ParseIntPipe({ optional: true })) days: number = 30,
    @CurrentTenant() tenantId: string,
  ) {
    return this.customerAnalyticsService.getCustomerGrowthMetrics(tenantId, days);
  }
}