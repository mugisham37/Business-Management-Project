import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/require-feature.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

import { 
  PredictiveAnalyticsService,
  DemandForecast,
  ChurnPrediction,
  PriceOptimization,
  InventoryOptimization,
  PredictiveModel
} from '../services/predictive-analytics.service';

export class DemandForecastRequestDto {
  productId: string;
  locationId: string;
  forecastPeriod: 'daily' | 'weekly' | 'monthly';
  forecastHorizon: number;
  includeSeasonality?: boolean;
  includePromotions?: boolean;
}

export class PriceOptimizationRequestDto {
  productId: string;
  locationId: string;
  includeCompetitorPricing?: boolean;
  includeSeasonality?: boolean;
  maxPriceChange?: number;
}

export class InventoryOptimizationRequestDto {
  productId: string;
  locationId: string;
  serviceLevel?: number;
  leadTime?: number;
  carryingCostRate?: number;
  stockoutCostPerUnit?: number;
}

export class TrainModelRequestDto {
  modelType: 'demand_forecast' | 'churn_prediction' | 'price_optimization' | 'inventory_optimization';
  algorithm?: string;
  features?: string[];
  hyperparameters?: Record<string, any>;
  trainingPeriod?: {
    startDate: string;
    endDate: string;
  };
}

@Controller('api/v1/analytics/predictive')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('advanced-analytics')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Predictive Analytics')
export class PredictiveAnalyticsController {
  constructor(
    private readonly predictiveAnalyticsService: PredictiveAnalyticsService,
  ) {}

  @Post('demand-forecast')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate demand forecast for a product' })
  @ApiResponse({ status: 200, description: 'Demand forecast generated successfully', type: Object })
  async generateDemandForecast(
    @Body(ValidationPipe) request: DemandForecastRequestDto,
    @CurrentTenant() tenantId: string,
  ): Promise<DemandForecast> {
    return this.predictiveAnalyticsService.generateDemandForecast(
      tenantId,
      request.productId,
      request.locationId,
      {
        forecastPeriod: request.forecastPeriod,
        forecastHorizon: request.forecastHorizon,
        includeSeasonality: request.includeSeasonality,
        includePromotions: request.includePromotions,
      }
    );
  }

  @Get('churn-prediction/:customerId')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Predict customer churn probability' })
  @ApiResponse({ status: 200, description: 'Churn prediction generated successfully', type: Object })
  @ApiParam({ name: 'customerId', type: 'string', description: 'Customer ID' })
  async predictCustomerChurn(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ChurnPrediction> {
    return this.predictiveAnalyticsService.predictCustomerChurn(tenantId, customerId);
  }

  @Post('price-optimization')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Optimize product pricing' })
  @ApiResponse({ status: 200, description: 'Price optimization completed successfully', type: Object })
  async optimizeProductPricing(
    @Body(ValidationPipe) request: PriceOptimizationRequestDto,
    @CurrentTenant() tenantId: string,
  ): Promise<PriceOptimization> {
    return this.predictiveAnalyticsService.optimizeProductPricing(
      tenantId,
      request.productId,
      request.locationId,
      {
        includeCompetitorPricing: request.includeCompetitorPricing,
        includeSeasonality: request.includeSeasonality,
        maxPriceChange: request.maxPriceChange,
      }
    );
  }

  @Post('inventory-optimization')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Optimize inventory levels' })
  @ApiResponse({ status: 200, description: 'Inventory optimization completed successfully', type: Object })
  async optimizeInventoryLevels(
    @Body(ValidationPipe) request: InventoryOptimizationRequestDto,
    @CurrentTenant() tenantId: string,
  ): Promise<InventoryOptimization> {
    return this.predictiveAnalyticsService.optimizeInventoryLevels(
      tenantId,
      request.productId,
      request.locationId,
      {
        serviceLevel: request.serviceLevel,
        leadTime: request.leadTime,
        carryingCostRate: request.carryingCostRate,
        stockoutCostPerUnit: request.stockoutCostPerUnit,
      }
    );
  }

  @Get('models')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get all predictive models for tenant' })
  @ApiResponse({ status: 200, description: 'Predictive models retrieved successfully', type: [Object] })
  async getPredictiveModels(
    @CurrentTenant() tenantId: string,
  ): Promise<PredictiveModel[]> {
    return this.predictiveAnalyticsService.getPredictiveModels(tenantId);
  }

  @Post('models/train')
  @RequirePermission('analytics:admin')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Train or retrain a predictive model' })
  @ApiResponse({ status: 202, description: 'Model training initiated successfully', type: Object })
  async trainPredictiveModel(
    @Body(ValidationPipe) request: TrainModelRequestDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PredictiveModel> {
    const trainingPeriod = request.trainingPeriod ? {
      startDate: new Date(request.trainingPeriod.startDate),
      endDate: new Date(request.trainingPeriod.endDate),
    } : undefined;

    return this.predictiveAnalyticsService.trainPredictiveModel(
      tenantId,
      request.modelType,
      {
        algorithm: request.algorithm,
        features: request.features,
        hyperparameters: request.hyperparameters,
        trainingPeriod,
      }
    );
  }

  @Get('demand-forecast/bulk')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Generate demand forecasts for multiple products' })
  @ApiResponse({ status: 200, description: 'Bulk demand forecasts generated successfully' })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  @ApiQuery({ name: 'productIds', required: false, type: String, description: 'Comma-separated product IDs' })
  @ApiQuery({ name: 'forecastPeriod', required: false, enum: ['daily', 'weekly', 'monthly'] })
  @ApiQuery({ name: 'forecastHorizon', required: false, type: Number })
  async generateBulkDemandForecasts(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
    @Query('productIds') productIds?: string,
    @Query('forecastPeriod') forecastPeriod: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('forecastHorizon') forecastHorizon: number = 30,
  ): Promise<{
    forecasts: DemandForecast[];
    summary: {
      totalProducts: number;
      averageAccuracy: number;
      generatedAt: Date;
    };
  }> {
    // This would generate forecasts for multiple products
    // For now, return a mock response
    const productIdList = productIds ? productIds.split(',') : ['product-1', 'product-2', 'product-3'];
    const defaultLocationId = locationId || 'default-location';

    const forecasts = await Promise.all(
      productIdList.map(productId =>
        this.predictiveAnalyticsService.generateDemandForecast(
          tenantId,
          productId,
          defaultLocationId,
          {
            forecastPeriod,
            forecastHorizon,
            includeSeasonality: true,
            includePromotions: true,
          }
        )
      )
    );

    const averageAccuracy = forecasts.reduce((sum, f) => sum + f.accuracy, 0) / forecasts.length;

    return {
      forecasts,
      summary: {
        totalProducts: forecasts.length,
        averageAccuracy,
        generatedAt: new Date(),
      },
    };
  }

  @Get('churn-prediction/bulk')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Generate churn predictions for multiple customers' })
  @ApiResponse({ status: 200, description: 'Bulk churn predictions generated successfully' })
  @ApiQuery({ name: 'customerIds', required: false, type: String, description: 'Comma-separated customer IDs' })
  @ApiQuery({ name: 'riskLevel', required: false, enum: ['low', 'medium', 'high'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async generateBulkChurnPredictions(
    @CurrentTenant() tenantId: string,
    @Query('customerIds') customerIds?: string,
    @Query('riskLevel') riskLevel?: 'low' | 'medium' | 'high',
    @Query('limit') limit: number = 100,
  ): Promise<{
    predictions: ChurnPrediction[];
    summary: {
      totalCustomers: number;
      riskDistribution: {
        high: number;
        medium: number;
        low: number;
      };
      averageChurnProbability: number;
      generatedAt: Date;
    };
  }> {
    // This would generate churn predictions for multiple customers
    // For now, return a mock response
    const customerIdList = customerIds 
      ? customerIds.split(',') 
      : Array.from({ length: Math.min(limit, 10) }, (_, i) => `customer-${i + 1}`);

    const predictions = await Promise.all(
      customerIdList.map(customerId =>
        this.predictiveAnalyticsService.predictCustomerChurn(tenantId, customerId)
      )
    );

    // Filter by risk level if specified
    const filteredPredictions = riskLevel 
      ? predictions.filter(p => p.riskLevel === riskLevel)
      : predictions;

    const riskDistribution = {
      high: predictions.filter(p => p.riskLevel === 'high').length,
      medium: predictions.filter(p => p.riskLevel === 'medium').length,
      low: predictions.filter(p => p.riskLevel === 'low').length,
    };

    const averageChurnProbability = predictions.reduce((sum, p) => sum + p.churnProbability, 0) / predictions.length;

    return {
      predictions: filteredPredictions,
      summary: {
        totalCustomers: predictions.length,
        riskDistribution,
        averageChurnProbability,
        generatedAt: new Date(),
      },
    };
  }

  @Get('insights/summary')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: 'Get predictive analytics insights summary' })
  @ApiResponse({ status: 200, description: 'Insights summary retrieved successfully' })
  async getPredictiveInsightsSummary(
    @CurrentTenant() tenantId: string,
  ): Promise<{
    demandForecasting: {
      totalForecasts: number;
      averageAccuracy: number;
      topGrowingProducts: Array<{ productId: string; growthRate: number }>;
      topDecliningProducts: Array<{ productId: string; declineRate: number }>;
    };
    churnPrediction: {
      totalCustomersAnalyzed: number;
      highRiskCustomers: number;
      averageChurnProbability: number;
      topChurnFactors: Array<{ factor: string; frequency: number }>;
    };
    priceOptimization: {
      totalProductsAnalyzed: number;
      averagePriceIncrease: number;
      expectedRevenueIncrease: number;
      topOpportunities: Array<{ productId: string; revenueImpact: number }>;
    };
    inventoryOptimization: {
      totalProductsAnalyzed: number;
      overStockedProducts: number;
      underStockedProducts: number;
      potentialCostSavings: number;
    };
    lastUpdated: Date;
  }> {
    // This would aggregate insights from all predictive analytics
    // For now, return mock data
    return {
      demandForecasting: {
        totalForecasts: 150,
        averageAccuracy: 0.82,
        topGrowingProducts: [
          { productId: 'product-1', growthRate: 0.15 },
          { productId: 'product-2', growthRate: 0.12 },
          { productId: 'product-3', growthRate: 0.08 },
        ],
        topDecliningProducts: [
          { productId: 'product-4', declineRate: -0.10 },
          { productId: 'product-5', declineRate: -0.08 },
        ],
      },
      churnPrediction: {
        totalCustomersAnalyzed: 1250,
        highRiskCustomers: 85,
        averageChurnProbability: 0.23,
        topChurnFactors: [
          { factor: 'Inactivity', frequency: 45 },
          { factor: 'Low Purchase Frequency', frequency: 32 },
          { factor: 'Support Issues', frequency: 18 },
        ],
      },
      priceOptimization: {
        totalProductsAnalyzed: 200,
        averagePriceIncrease: 0.08,
        expectedRevenueIncrease: 0.12,
        topOpportunities: [
          { productId: 'product-6', revenueImpact: 15000 },
          { productId: 'product-7', revenueImpact: 12000 },
          { productId: 'product-8', revenueImpact: 9500 },
        ],
      },
      inventoryOptimization: {
        totalProductsAnalyzed: 180,
        overStockedProducts: 25,
        underStockedProducts: 18,
        potentialCostSavings: 45000,
      },
      lastUpdated: new Date(),
    };
  }

  @Post('recommendations/generate')
  @RequirePermission('analytics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate actionable recommendations based on predictive analytics' })
  @ApiResponse({ status: 200, description: 'Recommendations generated successfully' })
  async generateRecommendations(
    @CurrentTenant() tenantId: string,
    @Body() filters: {
      includeChurnPrevention?: boolean;
      includePriceOptimization?: boolean;
      includeInventoryOptimization?: boolean;
      includeDemandPlanning?: boolean;
      priority?: 'high' | 'medium' | 'low';
      limit?: number;
    } = {},
  ): Promise<{
    recommendations: Array<{
      id: string;
      type: 'churn_prevention' | 'price_optimization' | 'inventory_optimization' | 'demand_planning';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      expectedImpact: {
        revenue?: number;
        cost?: number;
        customers?: number;
      };
      actions: Array<{
        action: string;
        deadline: Date;
        assignee?: string;
      }>;
      createdAt: Date;
    }>;
    summary: {
      totalRecommendations: number;
      highPriority: number;
      expectedTotalImpact: number;
    };
  }> {
    // This would generate actionable recommendations based on all predictive analytics
    // For now, return mock recommendations
    const allRecommendations = [
      {
        id: 'rec-1',
        type: 'churn_prevention' as const,
        title: 'Prevent High-Risk Customer Churn',
        description: '15 customers have >80% churn probability. Immediate intervention recommended.',
        priority: 'high' as const,
        expectedImpact: {
          revenue: 25000,
          customers: 15,
        },
        actions: [
          {
            action: 'Send personalized retention offers to high-risk customers',
            deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
            assignee: 'Customer Success Team',
          },
          {
            action: 'Schedule personal outreach calls',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            assignee: 'Account Managers',
          },
        ],
        createdAt: new Date(),
      },
      {
        id: 'rec-2',
        type: 'price_optimization' as const,
        title: 'Optimize Pricing for High-Margin Products',
        description: '8 products show potential for 10-15% price increases with minimal demand impact.',
        priority: 'medium' as const,
        expectedImpact: {
          revenue: 18000,
        },
        actions: [
          {
            action: 'Implement gradual price increases over 4 weeks',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
            assignee: 'Pricing Team',
          },
          {
            action: 'Monitor competitor pricing and customer response',
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            assignee: 'Market Research',
          },
        ],
        createdAt: new Date(),
      },
      {
        id: 'rec-3',
        type: 'inventory_optimization' as const,
        title: 'Reduce Overstock in Slow-Moving Items',
        description: '12 products are overstocked by 40%+. Reduce inventory to optimize cash flow.',
        priority: 'medium' as const,
        expectedImpact: {
          cost: -15000, // Cost savings
        },
        actions: [
          {
            action: 'Create promotional campaigns for overstocked items',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            assignee: 'Marketing Team',
          },
          {
            action: 'Adjust reorder points and quantities',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
            assignee: 'Inventory Manager',
          },
        ],
        createdAt: new Date(),
      },
      {
        id: 'rec-4',
        type: 'demand_planning' as const,
        title: 'Prepare for Seasonal Demand Surge',
        description: 'Forecast shows 25% demand increase for 5 products in next month.',
        priority: 'high' as const,
        expectedImpact: {
          revenue: 35000,
        },
        actions: [
          {
            action: 'Increase inventory levels for high-demand products',
            deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
            assignee: 'Procurement Team',
          },
          {
            action: 'Prepare marketing campaigns for seasonal products',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
            assignee: 'Marketing Team',
          },
        ],
        createdAt: new Date(),
      },
    ];

    // Apply filters
    let filteredRecommendations = allRecommendations;

    if (filters.includeChurnPrevention === false) {
      filteredRecommendations = filteredRecommendations.filter(r => r.type !== 'churn_prevention');
    }
    if (filters.includePriceOptimization === false) {
      filteredRecommendations = filteredRecommendations.filter(r => r.type !== 'price_optimization');
    }
    if (filters.includeInventoryOptimization === false) {
      filteredRecommendations = filteredRecommendations.filter(r => r.type !== 'inventory_optimization');
    }
    if (filters.includeDemandPlanning === false) {
      filteredRecommendations = filteredRecommendations.filter(r => r.type !== 'demand_planning');
    }
    if (filters.priority) {
      filteredRecommendations = filteredRecommendations.filter(r => r.priority === filters.priority);
    }
    if (filters.limit) {
      filteredRecommendations = filteredRecommendations.slice(0, filters.limit);
    }

    const highPriority = filteredRecommendations.filter(r => r.priority === 'high').length;
    const expectedTotalImpact = filteredRecommendations.reduce((sum, r) => {
      return sum + (r.expectedImpact.revenue || 0) + (r.expectedImpact.cost || 0);
    }, 0);

    return {
      recommendations: filteredRecommendations,
      summary: {
        totalRecommendations: filteredRecommendations.length,
        highPriority,
        expectedTotalImpact,
      },
    };
  }
}