import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseDatePipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentTenant } from '../../auth/decorators/auth.decorators';
import { ProcurementAnalyticsService } from '../services/procurement-analytics.service';

@Controller('api/v1/procurement/analytics')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('procurement-analytics')
@ApiTags('Procurement Analytics')
export class ProcurementAnalyticsController {
  constructor(
    private readonly procurementAnalyticsService: ProcurementAnalyticsService,
  ) {}

  @Get('spend-analysis')
  @ApiOperation({ summary: 'Generate comprehensive spend analysis' })
  @ApiResponse({ status: 200, description: 'Spend analysis generated successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  async getSpendAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
  ) {
    return await this.procurementAnalyticsService.generateSpendAnalysis(
      tenantId,
      startDate,
      endDate,
    );
  }

  @Get('supplier-performance')
  @ApiOperation({ summary: 'Calculate supplier performance metrics' })
  @ApiResponse({ status: 200, description: 'Supplier performance metrics calculated successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'supplierId', type: String, required: false, description: 'Specific supplier ID' })
  async getSupplierPerformance(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
    @Query('supplierId') supplierId?: string,
  ) {
    return await this.procurementAnalyticsService.calculateSupplierPerformanceMetrics(
      tenantId,
      startDate,
      endDate,
      supplierId,
    );
  }

  @Get('cost-optimization')
  @ApiOperation({ summary: 'Generate cost optimization recommendations' })
  @ApiResponse({ status: 200, description: 'Cost optimization recommendations generated successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  async getCostOptimizationRecommendations(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
  ) {
    return await this.procurementAnalyticsService.generateCostOptimizationRecommendations(
      tenantId,
      startDate,
      endDate,
    );
  }

  @Get('report')
  @ApiOperation({ summary: 'Generate comprehensive procurement report' })
  @ApiResponse({ status: 200, description: 'Procurement report generated successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ 
    name: 'reportType', 
    type: String, 
    required: false, 
    description: 'Report type (comprehensive, summary, performance)',
    enum: ['comprehensive', 'summary', 'performance']
  })
  async getProcurementReport(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
    @Query('reportType', new DefaultValuePipe('comprehensive')) reportType: string,
  ) {
    return await this.procurementAnalyticsService.generateProcurementReport(
      tenantId,
      startDate,
      endDate,
      reportType,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get procurement dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics retrieved successfully' })
  @ApiQuery({ 
    name: 'period', 
    type: String, 
    required: false, 
    description: 'Time period for metrics',
    enum: ['week', 'month', 'quarter', 'year']
  })
  async getDashboardMetrics(
    @CurrentTenant() tenantId: string,
    @Query('period', new DefaultValuePipe('month')) period: 'week' | 'month' | 'quarter' | 'year',
  ) {
    return await this.procurementAnalyticsService.getDashboardMetrics(tenantId, period);
  }

  @Get('spend-trends')
  @ApiOperation({ summary: 'Get spending trends over time' })
  @ApiResponse({ status: 200, description: 'Spending trends retrieved successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'supplierId', type: String, required: false, description: 'Specific supplier ID' })
  async getSpendTrends(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
    @Query('supplierId') supplierId?: string,
  ) {
    const spendAnalysis = await this.procurementAnalyticsService.generateSpendAnalysis(
      tenantId,
      startDate,
      endDate,
    );

    if (supplierId) {
      // Filter trends for specific supplier
      const supplierSpend = spendAnalysis.spendBySupplier.find(s => s.supplierId === supplierId);
      return {
        supplier: supplierSpend,
        monthlyTrends: spendAnalysis.spendByMonth,
      };
    }

    return {
      totalSpend: spendAnalysis.totalSpend,
      monthlyTrends: spendAnalysis.spendByMonth,
      topSuppliers: spendAnalysis.topSuppliers,
    };
  }

  @Get('supplier-comparison')
  @ApiOperation({ summary: 'Compare supplier performance metrics' })
  @ApiResponse({ status: 200, description: 'Supplier comparison completed successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'supplierIds', type: String, description: 'Comma-separated supplier IDs' })
  async compareSuppliers(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
    @Query('supplierIds') supplierIds: string,
  ) {
    const supplierIdArray = supplierIds.split(',').map(id => id.trim());
    
    const comparisons = await Promise.all(
      supplierIdArray.map(async (supplierId) => {
        const [performance] = await this.procurementAnalyticsService.calculateSupplierPerformanceMetrics(
          tenantId,
          startDate,
          endDate,
          supplierId,
        );
        return performance;
      }),
    );

    // Filter out undefined values
    const validComparisons = comparisons.filter((c): c is NonNullable<typeof c> => c !== undefined && c !== null);

    // Calculate averages for comparison
    const averages = {
      overallScore: validComparisons.length > 0 ? validComparisons.reduce((sum, s) => sum + s.overallScore, 0) / validComparisons.length : 0,
      qualityScore: validComparisons.length > 0 ? validComparisons.reduce((sum, s) => sum + s.qualityScore, 0) / validComparisons.length : 0,
      deliveryScore: validComparisons.length > 0 ? validComparisons.reduce((sum, s) => sum + s.deliveryScore, 0) / validComparisons.length : 0,
      serviceScore: validComparisons.length > 0 ? validComparisons.reduce((sum, s) => sum + s.serviceScore, 0) / validComparisons.length : 0,
      onTimeDeliveryRate: validComparisons.length > 0 ? validComparisons.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) / validComparisons.length : 0,
      totalSpend: validComparisons.reduce((sum, s) => sum + s.totalSpend, 0),
    };

    const bestPerformer = validComparisons.length > 0 
      ? validComparisons.reduce((best, current) => 
          current.overallScore > best.overallScore ? current : best
        )
      : null;

    const worstPerformer = validComparisons.length > 0
      ? validComparisons.reduce((worst, current) => 
          current.overallScore < worst.overallScore ? current : worst
        )
      : null;

    return {
      suppliers: validComparisons,
      averages,
      bestPerformer,
      worstPerformer,
    };
  }

  @Get('category-analysis')
  @ApiOperation({ summary: 'Analyze spending by category' })
  @ApiResponse({ status: 200, description: 'Category analysis completed successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  async getCategoryAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
  ) {
    const spendAnalysis = await this.procurementAnalyticsService.generateSpendAnalysis(
      tenantId,
      startDate,
      endDate,
    );

    const performanceMetrics = await this.procurementAnalyticsService.calculateSupplierPerformanceMetrics(
      tenantId,
      startDate,
      endDate,
    );

    // Group performance by category
    const categoryPerformance = spendAnalysis.spendByCategory.map(category => {
      const categorySuppliers = performanceMetrics.filter(supplier => {
        const supplierSpend = spendAnalysis.spendBySupplier.find(s => s.supplierId === supplier.supplierId);
        return supplierSpend && category.category === 'Uncategorized'; // This would need proper category mapping
      });

      const avgPerformance = categorySuppliers.length > 0 ? {
        overallScore: categorySuppliers.reduce((sum, s) => sum + s.overallScore, 0) / categorySuppliers.length,
        qualityScore: categorySuppliers.reduce((sum, s) => sum + s.qualityScore, 0) / categorySuppliers.length,
        deliveryScore: categorySuppliers.reduce((sum, s) => sum + s.deliveryScore, 0) / categorySuppliers.length,
        serviceScore: categorySuppliers.reduce((sum, s) => sum + s.serviceScore, 0) / categorySuppliers.length,
      } : { overallScore: 0, qualityScore: 0, deliveryScore: 0, serviceScore: 0 };

      return {
        ...category,
        supplierCount: categorySuppliers.length,
        averagePerformance: avgPerformance,
        topSupplier: categorySuppliers.length > 0 
          ? categorySuppliers.reduce((best, current) => 
              current.overallScore > best.overallScore ? current : best
            )
          : null,
      };
    });

    return {
      categories: categoryPerformance,
      totalCategories: spendAnalysis.spendByCategory.length,
      totalSpend: spendAnalysis.totalSpend,
    };
  }

  @Get('savings-opportunities')
  @ApiOperation({ summary: 'Identify potential cost savings opportunities' })
  @ApiResponse({ status: 200, description: 'Savings opportunities identified successfully' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ 
    name: 'minSavings', 
    type: Number, 
    required: false, 
    description: 'Minimum savings threshold'
  })
  async getSavingsOpportunities(
    @CurrentTenant() tenantId: string,
    @Query('startDate', ParseDatePipe) startDate: Date,
    @Query('endDate', ParseDatePipe) endDate: Date,
    @Query('minSavings') minSavings?: number,
  ) {
    const recommendations = await this.procurementAnalyticsService.generateCostOptimizationRecommendations(
      tenantId,
      startDate,
      endDate,
    );

    const filteredRecommendations = minSavings 
      ? recommendations.filter(r => r.potentialSavings >= minSavings)
      : recommendations;

    const totalPotentialSavings = filteredRecommendations.reduce(
      (sum, r) => sum + r.potentialSavings, 
      0
    );

    const opportunitiesByType = filteredRecommendations.reduce((acc, r) => {
      if (!acc[r.type]) {
        acc[r.type] = {
          count: 0,
          totalSavings: 0,
          recommendations: [],
        };
      }
      acc[r.type].count++;
      acc[r.type].totalSavings += r.potentialSavings;
      acc[r.type].recommendations.push(r);
      return acc;
    }, {} as Record<string, any>);

    return {
      totalOpportunities: filteredRecommendations.length,
      totalPotentialSavings,
      opportunitiesByType,
      topOpportunities: filteredRecommendations.slice(0, 5),
      quickWins: filteredRecommendations.filter(r => 
        r.priority === 'high' && 
        r.estimatedImplementationTime.includes('1-2') || 
        r.estimatedImplementationTime.includes('2-3')
      ),
    };
  }
}