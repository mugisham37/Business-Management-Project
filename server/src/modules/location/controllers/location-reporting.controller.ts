import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LocationReportingService } from '../services/location-reporting.service';
import {
  ConsolidatedReportQueryDto,
  LocationComparisonQueryDto,
  LocationBenchmarkQueryDto,
  ConsolidatedReportDto,
  LocationComparisonReportDto,
  LocationBenchmarkReportDto,
  ReportType,
  GroupByType,
  DrillDownLevel,
} from '../dto/location-reporting.dto';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission, CurrentUser, CurrentTenant } from '../../auth/decorators/auth.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { CacheInterceptor } from '../../../common/interceptors/cache.interceptor';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';

@Controller('api/v1/locations/reporting')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiBearerAuth()
@ApiTags('Location Reporting')
export class LocationReportingController {
  constructor(
    private readonly locationReportingService: LocationReportingService,
  ) {}

  @Post('consolidated')
  @RequirePermission('locations:read')
  @RequirePermission('reports:generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Generate consolidated cross-location report',
    description: 'Creates a comprehensive report aggregating data across multiple locations with optional comparisons and drill-down capabilities'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Consolidated report generated successfully',
    type: ConsolidatedReportDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async generateConsolidatedReport(
    @Body() query: ConsolidatedReportQueryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsolidatedReportDto> {
    return this.locationReportingService.generateConsolidatedReport(tenantId, query);
  }

  @Post('comparison')
  @RequirePermission('locations:read')
  @RequirePermission('reports:generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Generate location comparison report',
    description: 'Compares performance metrics across multiple locations with ranking and insights'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Location comparison report generated successfully',
    type: LocationComparisonReportDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid comparison parameters or insufficient locations' })
  async generateLocationComparison(
    @Body() query: LocationComparisonQueryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LocationComparisonReportDto> {
    return this.locationReportingService.generateLocationComparison(
      tenantId,
      query.locationIds,
      query.comparisonType,
      query.startDate,
      query.endDate,
    );
  }

  @Get('benchmarks/:locationId')
  @RequirePermission('locations:read')
  @RequirePermission('reports:generate')
  @ApiOperation({ 
    summary: 'Generate location benchmark report',
    description: 'Benchmarks a specific location against tenant averages and top performers'
  })
  @ApiParam({ name: 'locationId', description: 'Location ID to benchmark' })
  @ApiQuery({ name: 'startDate', description: 'Benchmark start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', description: 'Benchmark end date (YYYY-MM-DD)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location benchmark report generated successfully',
    type: LocationBenchmarkReportDto 
  })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async generateLocationBenchmarks(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LocationBenchmarkReportDto> {
    return this.locationReportingService.generateLocationBenchmarks(
      tenantId,
      locationId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('performance-summary')
  @RequirePermission('locations:read')
  @ApiOperation({ 
    summary: 'Get quick performance summary for all locations',
    description: 'Returns a high-level performance summary for all locations in the tenant'
  })
  @ApiQuery({ name: 'startDate', description: 'Summary start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', description: 'Summary end date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'groupBy', required: false, description: 'Group results by region, type, or manager' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance summary retrieved successfully'
  })
  async getPerformanceSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentTenant() tenantId: string,
    @Query('groupBy') groupBy?: string,
  ): Promise<any> {
    const query: ConsolidatedReportQueryDto = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reportType: ReportType.COMPREHENSIVE,
      groupBy: groupBy as GroupByType,
      drillDownLevel: DrillDownLevel.SUMMARY,
    };

    const report = await this.locationReportingService.generateConsolidatedReport(tenantId, query);
    
    // Return simplified summary for quick dashboard views
    return {
      totalLocations: report.totalLocations,
      reportPeriod: report.reportPeriod,
      aggregatedMetrics: report.aggregatedMetrics,
      topPerformers: report.locationMetrics
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(loc => ({
          locationId: loc.locationId,
          locationName: loc.locationName,
          revenue: loc.revenue,
          profitMargin: loc.profitMargin,
        })),
      underperformers: report.locationMetrics
        .sort((a, b) => a.revenue - b.revenue)
        .slice(0, 3)
        .map(loc => ({
          locationId: loc.locationId,
          locationName: loc.locationName,
          revenue: loc.revenue,
          profitMargin: loc.profitMargin,
        })),
    };
  }

  @Get('trends/:locationId')
  @RequirePermission('locations:read')
  @ApiOperation({ 
    summary: 'Get performance trends for a specific location',
    description: 'Returns historical performance trends and projections for a location'
  })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiQuery({ name: 'months', required: false, description: 'Number of months of historical data (default: 12)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance trends retrieved successfully'
  })
  async getLocationTrends(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('months') months: string = '12',
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const monthsCount = parseInt(months, 10) || 12;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsCount);

    // Generate monthly reports for trend analysis
    const monthlyTrends = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const monthStart = new Date(currentDate);
      const monthEnd = new Date(currentDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0); // Last day of the month

      try {
        const monthlyReport = await this.locationReportingService.generateConsolidatedReport(
          tenantId,
          {
            locationIds: [locationId],
            startDate: monthStart,
            endDate: monthEnd,
            reportType: 'comprehensive' as any,
            drillDownLevel: 'summary' as any,
          }
        );

        if (monthlyReport.locationMetrics.length > 0) {
          const metrics = monthlyReport.locationMetrics[0];
          if (metrics) {
            monthlyTrends.push({
              month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
              revenue: metrics.revenue,
              profitMargin: metrics.profitMargin,
              transactionCount: metrics.transactionCount,
              averageTransactionValue: metrics.averageTransactionValue,
              uniqueCustomers: metrics.uniqueCustomers,
              inventoryTurnover: metrics.inventoryTurnover,
            });
          }
        }
      } catch (error) {
        // Skip months with no data
      }

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Calculate trend indicators
    const recentMonths = monthlyTrends.slice(-3);
    const previousMonths = monthlyTrends.slice(-6, -3);

    const recentAvgRevenue = recentMonths.reduce((sum, m) => sum + m.revenue, 0) / recentMonths.length;
    const previousAvgRevenue = previousMonths.reduce((sum, m) => sum + m.revenue, 0) / previousMonths.length;
    const revenueGrowthTrend = previousAvgRevenue > 0 ? ((recentAvgRevenue - previousAvgRevenue) / previousAvgRevenue) * 100 : 0;

    return {
      locationId,
      monthlyTrends,
      trendIndicators: {
        revenueGrowthTrend: Math.round(revenueGrowthTrend * 100) / 100,
        isGrowing: revenueGrowthTrend > 0,
        consistency: this.calculateConsistencyScore(monthlyTrends),
      },
      projections: this.generateSimpleProjections(monthlyTrends),
    };
  }

  @Get('regional-analysis')
  @RequirePermission('locations:read')
  @ApiOperation({ 
    summary: 'Get regional performance analysis',
    description: 'Analyzes performance across different regions or location types'
  })
  @ApiQuery({ name: 'startDate', description: 'Analysis start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', description: 'Analysis end date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'groupBy', required: false, description: 'Group by region or type (default: region)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Regional analysis retrieved successfully'
  })
  async getRegionalAnalysis(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: string = 'region',
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const report = await this.locationReportingService.generateConsolidatedReport(
      tenantId,
      {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reportType: 'comprehensive' as any,
        groupBy: groupBy as any,
        includeComparisons: true,
      }
    );

    // Group locations by the specified criteria
    const groupedData = this.groupLocationsByCriteria(report.locationMetrics, groupBy);
    
    // Calculate regional statistics
    const regionalStats = Object.entries(groupedData).map(([groupName, locations]) => {
      const totalRevenue = locations.reduce((sum, loc) => sum + loc.revenue, 0);
      const avgProfitMargin = locations.reduce((sum, loc) => sum + loc.profitMargin, 0) / locations.length;
      const totalTransactions = locations.reduce((sum, loc) => sum + loc.transactionCount, 0);
      
      return {
        groupName,
        locationCount: locations.length,
        totalRevenue,
        avgProfitMargin: Math.round(avgProfitMargin * 100) / 100,
        totalTransactions,
        avgRevenuePerLocation: Math.round(totalRevenue / locations.length),
        topLocation: locations.sort((a, b) => b.revenue - a.revenue)[0]?.locationName,
        performanceRank: 0, // Will be set after sorting
      };
    });

    // Rank regions by total revenue
    regionalStats.sort((a, b) => b.totalRevenue - a.totalRevenue);
    regionalStats.forEach((region, index) => {
      region.performanceRank = index + 1;
    });

    return {
      groupBy,
      reportPeriod: report.reportPeriod,
      totalLocations: report.totalLocations,
      regionalStats,
      insights: this.generateRegionalInsights(regionalStats),
    };
  }

  @Get('export/:reportId')
  @RequirePermission('locations:read')
  @RequirePermission('reports:export')
  @ApiOperation({ 
    summary: 'Export report data',
    description: 'Exports previously generated report data in various formats'
  })
  @ApiParam({ name: 'reportId', description: 'Report ID to export' })
  @ApiQuery({ name: 'format', required: false, description: 'Export format (csv, xlsx, pdf)', enum: ['csv', 'xlsx', 'pdf'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Report exported successfully'
  })
  async exportReport(
    @Param('reportId') reportId: string,
    @Query('format') format: string = 'csv',
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    // This would implement report export functionality
    // For now, return a placeholder response
    return {
      message: 'Report export functionality will be implemented in a future update',
      reportId,
      format,
      status: 'pending',
    };
  }

  private groupLocationsByCriteria(locations: any[], groupBy: string): Record<string, any[]> {
    return locations.reduce((groups, location) => {
      let groupKey: string;
      
      switch (groupBy) {
        case 'region':
          groupKey = location.region || 'Unassigned';
          break;
        case 'type':
          groupKey = location.locationType || 'Unknown';
          break;
        case 'manager':
          groupKey = location.managerName || 'Unassigned';
          break;
        default:
          groupKey = 'All Locations';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(location);
      
      return groups;
    }, {} as Record<string, any[]>);
  }

  private calculateConsistencyScore(monthlyTrends: any[]): number {
    if (monthlyTrends.length < 3) return 0;
    
    const revenues = monthlyTrends.map(m => m.revenue);
    const mean = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
    const variance = revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower coefficient of variation = higher consistency
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    const consistencyScore = Math.max(0, 100 - (coefficientOfVariation * 100));
    
    return Math.round(consistencyScore);
  }

  private generateSimpleProjections(monthlyTrends: any[]): any {
    if (monthlyTrends.length < 6) {
      return { message: 'Insufficient data for projections' };
    }
    
    const recentTrends = monthlyTrends.slice(-6);
    const avgGrowthRate = this.calculateAverageGrowthRate(recentTrends);
    const lastMonth = recentTrends[recentTrends.length - 1];
    
    const nextMonthProjection = {
      revenue: Math.round(lastMonth.revenue * (1 + avgGrowthRate)),
      confidence: this.calculateProjectionConfidence(recentTrends),
    };
    
    return {
      nextMonth: nextMonthProjection,
      avgMonthlyGrowthRate: Math.round(avgGrowthRate * 10000) / 100, // Convert to percentage
      trend: avgGrowthRate > 0.02 ? 'growing' : avgGrowthRate < -0.02 ? 'declining' : 'stable',
    };
  }

  private calculateAverageGrowthRate(trends: any[]): number {
    if (trends.length < 2) return 0;
    
    const growthRates = [];
    for (let i = 1; i < trends.length; i++) {
      const current = trends[i].revenue;
      const previous = trends[i - 1].revenue;
      if (previous > 0) {
        growthRates.push((current - previous) / previous);
      }
    }
    
    return growthRates.length > 0 
      ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length 
      : 0;
  }

  private calculateProjectionConfidence(trends: any[]): string {
    const consistency = this.calculateConsistencyScore(trends);
    
    if (consistency > 80) return 'high';
    if (consistency > 60) return 'medium';
    return 'low';
  }

  private generateRegionalInsights(regionalStats: any[]): any {
    const topRegion = regionalStats[0];
    const bottomRegion = regionalStats[regionalStats.length - 1];
    
    const insights = [];
    
    if (topRegion && bottomRegion && topRegion.totalRevenue > bottomRegion.totalRevenue * 2) {
      insights.push(`${topRegion.groupName} significantly outperforms other regions with ${Math.round(((topRegion.totalRevenue / bottomRegion.totalRevenue) - 1) * 100)}% higher revenue`);
    }
    
    const highMarginRegions = regionalStats.filter(r => r.avgProfitMargin > 25);
    if (highMarginRegions.length > 0) {
      insights.push(`${highMarginRegions.map(r => r.groupName).join(', ')} maintain${highMarginRegions.length === 1 ? 's' : ''} strong profit margins above 25%`);
    }
    
    const lowPerformingRegions = regionalStats.filter(r => r.avgProfitMargin < 15);
    if (lowPerformingRegions.length > 0) {
      insights.push(`${lowPerformingRegions.map(r => r.groupName).join(', ')} may benefit from cost optimization initiatives`);
    }
    
    return {
      keyInsights: insights,
      recommendations: this.generateRegionalRecommendations(regionalStats),
    };
  }

  private generateRegionalRecommendations(regionalStats: any[]): string[] {
    const recommendations = [];
    
    const avgRevenue = regionalStats.reduce((sum, r) => sum + r.totalRevenue, 0) / regionalStats.length;
    const underperformingRegions = regionalStats.filter(r => r.totalRevenue < avgRevenue * 0.8);
    
    if (underperformingRegions.length > 0) {
      recommendations.push(`Focus growth initiatives on ${underperformingRegions.map(r => r.groupName).join(', ')} to improve overall performance`);
    }
    
    const topRegion = regionalStats[0];
    if (topRegion) {
      recommendations.push(`Analyze and replicate success factors from ${topRegion.groupName} across other regions`);
    }
    
    const lowMarginRegions = regionalStats.filter(r => r.avgProfitMargin < 20);
    if (lowMarginRegions.length > 0) {
      recommendations.push(`Implement cost reduction strategies in ${lowMarginRegions.map(r => r.groupName).join(', ')} to improve profitability`);
    }
    
    return recommendations;
  }
}