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
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../../common/interceptors/cache.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { ComparativeAnalysisService } from '../services/comparative-analysis.service';
import {
  PeriodComparison,
  LocationBenchmark,
  IndustryBenchmark,
  TrendAnalysis,
  ComparativeReport,
} from '../services/comparative-analysis.service';

// DTOs for request validation
export class CreatePeriodComparisonDto {
  name!: string;
  metric!: string;
  currentPeriod!: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  comparisonPeriod!: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  dimensions?: string[];
  filters?: Record<string, any>;
}

export class CreateLocationBenchmarkDto {
  metric!: string;
  timeRange!: {
    startDate: Date;
    endDate: Date;
  };
  locations!: string[];
  benchmarkType!: 'performance' | 'efficiency' | 'growth' | 'custom';
  normalizationMethod!: 'per_employee' | 'per_sqft' | 'per_customer' | 'absolute';
}

export class CreateIndustryBenchmarkDto {
  industry!: string;
  businessSize!: 'micro' | 'small' | 'medium' | 'large';
  metrics!: string[];
  timeRange!: {
    startDate: Date;
    endDate: Date;
  };
  region?: string;
}

export class CreateTrendAnalysisDto {
  metric!: string;
  timeRange!: {
    startDate: Date;
    endDate: Date;
  };
  granularity!: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dimensions?: string[];
  seasonalityDetection?: boolean;
  anomalyDetection?: boolean;
}

export class CreateComparativeReportDto {
  name!: string;
  description!: string;
  type!: 'period_comparison' | 'location_benchmark' | 'industry_benchmark' | 'trend_analysis' | 'custom';
  analyses!: string[];
  layout!: 'summary' | 'detailed' | 'executive';
  visualizations!: Array<{
    type: 'chart' | 'table' | 'scorecard' | 'heatmap';
    analysisId: string;
    position: number;
    styling: Record<string, any>;
  }>;
  filters?: Record<string, any>;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    recipients: string[];
    format: 'pdf' | 'excel' | 'email';
  };
}

@Controller('api/v1/analytics/comparative')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('comparative-analysis')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiTags('Comparative Analytics')
export class ComparativeAnalysisController {
  constructor(
    private readonly comparativeAnalysisService: ComparativeAnalysisService,
  ) {}

  // Period Comparison Endpoints

  @Post('period-comparisons')
  @RequirePermission('analytics:create-comparison')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a period-over-period comparison analysis' })
  @ApiResponse({ status: 201, description: 'Period comparison created successfully' })
  async createPeriodComparison(
    @Body(ValidationPipe) dto: CreatePeriodComparisonDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<PeriodComparison> {
    return this.comparativeAnalysisService.createPeriodComparison(
      tenantId,
      user.id,
      dto,
    );
  }

  @Get('period-comparisons/:id')
  @RequirePermission('analytics:read-comparison')
  @ApiOperation({ summary: 'Get period comparison by ID' })
  @ApiParam({ name: 'id', description: 'Period comparison ID' })
  @ApiResponse({ status: 200, description: 'Period comparison retrieved successfully' })
  async getPeriodComparison(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<PeriodComparison> {
    const comparison = await this.comparativeAnalysisService.getComparativeAnalysis(
      tenantId,
      id,
      'period_comparison',
    );
    
    if (!comparison) {
      throw new Error('Period comparison not found');
    }
    
    return comparison as PeriodComparison;
  }

  // Location Benchmark Endpoints

  @Post('location-benchmarks')
  @RequirePermission('analytics:create-benchmark')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a location benchmarking analysis' })
  @ApiResponse({ status: 201, description: 'Location benchmark created successfully' })
  async createLocationBenchmark(
    @Body(ValidationPipe) dto: CreateLocationBenchmarkDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationBenchmark> {
    return this.comparativeAnalysisService.createLocationBenchmark(
      tenantId,
      user.id,
      dto,
    );
  }

  @Get('location-benchmarks/:id')
  @RequirePermission('analytics:read-benchmark')
  @ApiOperation({ summary: 'Get location benchmark by ID' })
  @ApiParam({ name: 'id', description: 'Location benchmark ID' })
  @ApiResponse({ status: 200, description: 'Location benchmark retrieved successfully' })
  async getLocationBenchmark(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationBenchmark> {
    const benchmark = await this.comparativeAnalysisService.getComparativeAnalysis(
      tenantId,
      id,
      'location_benchmark',
    );
    
    if (!benchmark) {
      throw new Error('Location benchmark not found');
    }
    
    return benchmark as LocationBenchmark;
  }

  // Industry Benchmark Endpoints

  @Post('industry-benchmarks')
  @RequirePermission('analytics:create-benchmark')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an industry benchmarking analysis' })
  @ApiResponse({ status: 201, description: 'Industry benchmark created successfully' })
  async createIndustryBenchmark(
    @Body(ValidationPipe) dto: CreateIndustryBenchmarkDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<IndustryBenchmark> {
    return this.comparativeAnalysisService.createIndustryBenchmark(
      tenantId,
      user.id,
      dto,
    );
  }

  @Get('industry-benchmarks/:id')
  @RequirePermission('analytics:read-benchmark')
  @ApiOperation({ summary: 'Get industry benchmark by ID' })
  @ApiParam({ name: 'id', description: 'Industry benchmark ID' })
  @ApiResponse({ status: 200, description: 'Industry benchmark retrieved successfully' })
  async getIndustryBenchmark(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<IndustryBenchmark> {
    const benchmark = await this.comparativeAnalysisService.getComparativeAnalysis(
      tenantId,
      id,
      'industry_benchmark',
    );
    
    if (!benchmark) {
      throw new Error('Industry benchmark not found');
    }
    
    return benchmark as IndustryBenchmark;
  }

  // Trend Analysis Endpoints

  @Post('trend-analyses')
  @RequirePermission('analytics:create-analysis')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a trend analysis' })
  @ApiResponse({ status: 201, description: 'Trend analysis created successfully' })
  async createTrendAnalysis(
    @Body(ValidationPipe) dto: CreateTrendAnalysisDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<TrendAnalysis> {
    return this.comparativeAnalysisService.createTrendAnalysis(
      tenantId,
      user.id,
      dto,
    );
  }

  @Get('trend-analyses/:id')
  @RequirePermission('analytics:read-analysis')
  @ApiOperation({ summary: 'Get trend analysis by ID' })
  @ApiParam({ name: 'id', description: 'Trend analysis ID' })
  @ApiResponse({ status: 200, description: 'Trend analysis retrieved successfully' })
  async getTrendAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<TrendAnalysis> {
    const analysis = await this.comparativeAnalysisService.getComparativeAnalysis(
      tenantId,
      id,
      'trend_analysis',
    );
    
    if (!analysis) {
      throw new Error('Trend analysis not found');
    }
    
    return analysis as TrendAnalysis;
  }

  // General Comparative Analysis Endpoints

  @Get('analyses')
  @RequirePermission('analytics:read-analysis')
  @ApiOperation({ summary: 'List all comparative analyses for tenant' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by analysis type' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  @ApiResponse({ status: 200, description: 'Comparative analyses retrieved successfully' })
  async listComparativeAnalyses(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: 'period_comparison' | 'location_benchmark' | 'industry_benchmark' | 'trend_analysis',
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy?: 'created' | 'updated' | 'name',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<{
    analyses: Array<{
      id: string;
      name: string;
      type: string;
      lastCalculated: Date;
      summary: any;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    const queryParams: { type?: 'period_comparison' | 'location_benchmark' | 'industry_benchmark' | 'trend_analysis'; limit?: number; offset?: number; sortBy?: 'name' | 'created' | 'updated'; sortOrder?: 'asc' | 'desc' } = {};
    if (type !== undefined) queryParams.type = type;
    if (limit !== undefined) queryParams.limit = parseInt(String(limit));
    if (offset !== undefined) queryParams.offset = parseInt(String(offset));
    if (sortBy !== undefined) queryParams.sortBy = sortBy;
    if (sortOrder !== undefined) queryParams.sortOrder = sortOrder;
    
    return this.comparativeAnalysisService.listComparativeAnalyses(tenantId, queryParams);
  }

  // Comparative Report Endpoints

  @Post('reports')
  @RequirePermission('analytics:create-report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a comparative analysis report' })
  @ApiResponse({ status: 201, description: 'Comparative report created successfully' })
  async generateComparativeReport(
    @Body(ValidationPipe) dto: CreateComparativeReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ComparativeReport> {
    return this.comparativeAnalysisService.generateComparativeReport(
      tenantId,
      user.id,
      dto,
    );
  }

  @Get('reports/:id')
  @RequirePermission('analytics:read-report')
  @ApiOperation({ summary: 'Get comparative report by ID' })
  @ApiParam({ name: 'id', description: 'Comparative report ID' })
  @ApiResponse({ status: 200, description: 'Comparative report retrieved successfully' })
  async getComparativeReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ComparativeReport> {
    // This would load the report from the database
    // For now, return a mock response
    throw new Error('Report retrieval not yet implemented');
  }

  // Quick Analysis Endpoints

  @Post('quick-comparison')
  @RequirePermission('analytics:create-comparison')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform a quick period comparison without saving' })
  @ApiResponse({ status: 200, description: 'Quick comparison completed successfully' })
  async quickPeriodComparison(
    @Body(ValidationPipe) dto: CreatePeriodComparisonDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    currentValue: number;
    comparisonValue: number;
    absoluteChange: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
    significance: 'high' | 'medium' | 'low';
  }> {
    const comparison = await this.comparativeAnalysisService.createPeriodComparison(
      tenantId,
      user.id,
      { ...dto, name: 'Quick Comparison' },
    );

    return {
      currentValue: comparison.results.currentValue,
      comparisonValue: comparison.results.comparisonValue,
      absoluteChange: comparison.results.absoluteChange,
      percentageChange: comparison.results.percentageChange,
      trend: comparison.results.trend,
      significance: comparison.results.significance,
    };
  }

  @Post('quick-benchmark')
  @RequirePermission('analytics:create-benchmark')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform a quick location benchmark without saving' })
  @ApiResponse({ status: 200, description: 'Quick benchmark completed successfully' })
  async quickLocationBenchmark(
    @Body(ValidationPipe) dto: CreateLocationBenchmarkDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    topPerformer?: {
      locationId: string;
      locationName: string;
      value: number;
      rank: number;
    };
    bottomPerformer?: {
      locationId: string;
      locationName: string;
      value: number;
      rank: number;
    };
    average: number;
    spread: number;
  }> {
    const benchmark = await this.comparativeAnalysisService.createLocationBenchmark(
      tenantId,
      user.id,
      dto,
    );

    const rankings = benchmark.results.rankings;
    const topPerformer = rankings[0];
    const bottomPerformer = rankings[rankings.length - 1];

    return {
      ...(topPerformer ? {
        topPerformer: {
          locationId: topPerformer.locationId,
          locationName: topPerformer.locationName,
          value: topPerformer.normalizedValue,
          rank: topPerformer.rank,
        },
      } : {}),
      ...(bottomPerformer ? {
        bottomPerformer: {
          locationId: bottomPerformer.locationId,
          locationName: bottomPerformer.locationName,
          value: bottomPerformer.normalizedValue,
          rank: bottomPerformer.rank,
        },
      } : {}),
      average: benchmark.results.statistics.average,
      spread: benchmark.results.statistics.range,
    };
  }

  // Insights and Recommendations Endpoints

  @Get('insights/period-comparison/:id')
  @RequirePermission('analytics:read-insights')
  @ApiOperation({ summary: 'Get insights from period comparison' })
  @ApiParam({ name: 'id', description: 'Period comparison ID' })
  @ApiResponse({ status: 200, description: 'Insights retrieved successfully' })
  async getPeriodComparisonInsights(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    insights: Array<{
      type: 'positive' | 'negative' | 'neutral';
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      recommendations: string[];
    }>;
    summary: string;
  }> {
    const comparison = await this.comparativeAnalysisService.getComparativeAnalysis(
      tenantId,
      id,
      'period_comparison',
    ) as PeriodComparison;

    if (!comparison) {
      throw new Error('Period comparison not found');
    }

    // Generate insights based on the comparison results
    const insights = [];
    
    if (comparison.results.trend === 'up' && comparison.results.significance === 'high') {
      insights.push({
        type: 'positive' as const,
        title: 'Strong Growth Detected',
        description: `${comparison.configuration.metric} increased by ${comparison.results.percentageChange.toFixed(1)}% compared to the previous period`,
        impact: 'high' as const,
        recommendations: [
          'Analyze what drove this growth to replicate success',
          'Consider scaling successful strategies',
          'Monitor sustainability of growth rate',
        ],
      });
    } else if (comparison.results.trend === 'down' && comparison.results.significance === 'high') {
      insights.push({
        type: 'negative' as const,
        title: 'Significant Decline Observed',
        description: `${comparison.configuration.metric} decreased by ${Math.abs(comparison.results.percentageChange).toFixed(1)}% compared to the previous period`,
        impact: 'high' as const,
        recommendations: [
          'Investigate root causes of the decline',
          'Implement corrective measures immediately',
          'Review and adjust current strategies',
        ],
      });
    }

    // Add breakdown insights
    if (comparison.results.breakdown.length > 0) {
      const topGainer = comparison.results.breakdown.reduce((max, item) => 
        item.changePercent > max.changePercent ? item : max
      );
      
      if (topGainer.changePercent > 10) {
        insights.push({
          type: 'positive' as const,
          title: 'Top Performing Segment',
          description: `${topGainer.dimension} showed exceptional growth of ${topGainer.changePercent.toFixed(1)}%`,
          impact: 'medium' as const,
          recommendations: [
            'Study success factors in this segment',
            'Apply learnings to other segments',
            'Allocate more resources to high-performing areas',
          ],
        });
      }
    }

    const summary = `Overall ${comparison.configuration.metric} ${comparison.results.trend === 'up' ? 'increased' : comparison.results.trend === 'down' ? 'decreased' : 'remained stable'} by ${Math.abs(comparison.results.percentageChange).toFixed(1)}% with ${comparison.results.significance} significance.`;

    return { insights, summary };
  }

  @Get('insights/location-benchmark/:id')
  @RequirePermission('analytics:read-insights')
  @ApiOperation({ summary: 'Get insights from location benchmark' })
  @ApiParam({ name: 'id', description: 'Location benchmark ID' })
  @ApiResponse({ status: 200, description: 'Insights retrieved successfully' })
  async getLocationBenchmarkInsights(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    insights: Array<{
      type: 'positive' | 'negative' | 'neutral';
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      recommendations: string[];
    }>;
    summary: string;
  }> {
    const benchmark = await this.comparativeAnalysisService.getComparativeAnalysis(
      tenantId,
      id,
      'location_benchmark',
    ) as LocationBenchmark;

    if (!benchmark) {
      throw new Error('Location benchmark not found');
    }

    const insights = [];
    const rankings = benchmark.results.rankings;
    const stats = benchmark.results.statistics;

    // Top performer insight
    if (rankings.length > 0) {
      const topPerformer = rankings[0]!;
      insights.push({
        type: 'positive' as const,
        title: 'Top Performing Location',
        description: `${topPerformer.locationName} leads with ${topPerformer.normalizedValue.toFixed(2)} (${topPerformer.percentile.toFixed(0)}th percentile)`,
        impact: 'high' as const,
        recommendations: [
          'Study best practices from this location',
          'Share successful strategies across network',
          'Consider this location as a training hub',
        ],
      });
    }

    // Performance spread insight
    if (stats.range > stats.average * 0.5) {
      insights.push({
        type: 'negative' as const,
        title: 'High Performance Variability',
        description: `Large performance gap detected (range: ${stats.range.toFixed(2)}, std dev: ${stats.standardDeviation.toFixed(2)})`,
        impact: 'medium' as const,
        recommendations: [
          'Standardize operations across locations',
          'Provide additional support to underperforming locations',
          'Implement performance monitoring systems',
        ],
      });
    }

    // Underperformer insight
    if (rankings.length > 1) {
      const bottomPerformer = rankings[rankings.length - 1]!;
      if (bottomPerformer.normalizedValue < stats.average * 0.7) {
        insights.push({
          type: 'negative' as const,
          title: 'Underperforming Location Identified',
          description: `${bottomPerformer.locationName} significantly below average (${bottomPerformer.percentile.toFixed(0)}th percentile)`,
          impact: 'high' as const,
          recommendations: [
            'Conduct detailed performance review',
            'Provide targeted support and resources',
            'Consider management or operational changes',
          ],
        });
      }
    }

    const summary = `Performance analysis across ${rankings.length} locations shows average ${benchmark.configuration.metric} of ${stats.average.toFixed(2)} with ${stats.standardDeviation > stats.average * 0.3 ? 'high' : 'moderate'} variability.`;

    return { insights, summary };
  }

  // Export and Sharing Endpoints

  @Post('export/:analysisId')
  @RequirePermission('analytics:export-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export comparative analysis data' })
  @ApiParam({ name: 'analysisId', description: 'Analysis ID to export' })
  @ApiResponse({ status: 200, description: 'Export initiated successfully' })
  async exportAnalysis(
    @Param('analysisId', ParseUUIDPipe) analysisId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() options: {
      format: 'csv' | 'excel' | 'pdf';
      includeCharts?: boolean;
      includeInsights?: boolean;
    },
  ): Promise<{
    exportId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    estimatedCompletion?: Date;
  }> {
    // This would queue an export job
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      exportId,
      status: 'queued',
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };
  }

  @Get('export/:exportId/status')
  @RequirePermission('analytics:export-data')
  @ApiOperation({ summary: 'Check export status' })
  @ApiParam({ name: 'exportId', description: 'Export ID to check' })
  @ApiResponse({ status: 200, description: 'Export status retrieved successfully' })
  async getExportStatus(
    @Param('exportId') exportId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    exportId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress?: number;
    downloadUrl?: string;
    error?: string;
  }> {
    // Mock export status
    return {
      exportId,
      status: 'completed',
      progress: 100,
      downloadUrl: `https://storage.example.com/exports/${exportId}.xlsx`,
    };
  }
}