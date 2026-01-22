import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { LocationService } from './location.service';
import { FinancialReportingService } from '../../financial/services/financial-reporting.service';
import { InventoryReportingService } from '../../inventory/services/inventory-reporting.service';
import { CustomerAnalyticsService } from '../../crm/services/customer-analytics.service';
import { ProcurementAnalyticsService } from '../../supplier/services/procurement-analytics.service';
import { TransactionService } from '../../pos/services/transaction.service';
import { Location } from '../entities/location.entity';
import { LocationStatus } from '../dto/location.dto';
import { ReportType, ComparisonType, GroupByType, DrillDownLevel } from '../dto/location-reporting.dto';

export interface ConsolidatedReportQuery {
  locationIds?: string[];
  startDate: Date;
  endDate: Date;
  reportType: ReportType;
  groupBy?: GroupByType;
  includeComparisons?: boolean;
  includeBenchmarks?: boolean;
  drillDownLevel?: DrillDownLevel;
}

export interface LocationPerformanceMetrics {
  locationId: string;
  locationName: string;
  locationCode: string;
  locationType: string;
  region?: string;
  managerId?: string;
  managerName?: string;
  
  // Financial Metrics
  revenue: number;
  grossProfit: number;
  netProfit: number;
  expenses: number;
  profitMargin: number;
  
  // Sales Metrics
  transactionCount: number;
  averageTransactionValue: number;
  itemsSold: number;
  refundAmount: number;
  refundRate: number;
  
  // Inventory Metrics
  inventoryValue: number;
  inventoryTurnover: number;
  stockoutEvents: number;
  excessInventoryValue: number;
  
  // Customer Metrics
  uniqueCustomers: number;
  repeatCustomerRate: number;
  customerLifetimeValue: number;
  customerSatisfactionScore?: number;
  
  // Operational Metrics
  employeeCount: number;
  salesPerEmployee: number;
  operatingHours: number;
  salesPerHour: number;
  
  // Comparative Metrics (when comparisons enabled)
  previousPeriodGrowth?: number;
  benchmarkComparison?: number;
  rankAmongLocations?: number;
}

export interface ConsolidatedReport {
  reportId: string;
  tenantId: string;
  reportType: ReportType;
  generatedAt: Date;
  query: ConsolidatedReportQuery;
  
  // Summary Data
  totalLocations: number;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
    daysInPeriod: number;
  };
  
  // Aggregated Metrics
  aggregatedMetrics: {
    totalRevenue: number;
    totalTransactions: number;
    totalCustomers: number;
    totalInventoryValue: number;
    averageProfitMargin: number;
    topPerformingLocationId: string;
    lowestPerformingLocationId: string;
  };
  
  // Location-specific data
  locationMetrics: LocationPerformanceMetrics[];
  
  // Comparative Analysis (when enabled)
  comparativeAnalysis?: {
    periodOverPeriodGrowth: number;
    bestPerformingMetrics: string[];
    improvementOpportunities: string[];
    benchmarkAnalysis?: {
      aboveAverage: number;
      belowAverage: number;
      averagePerformance: LocationPerformanceMetrics;
    };
  };
  
  // Drill-down data (when requested)
  drillDownData?: {
    [locationId: string]: {
      dailyMetrics?: any[];
      topProducts?: any[];
      topCustomers?: any[];
      transactionDetails?: any[];
    };
  };
}

export interface LocationComparisonReport {
  comparisonId: string;
  tenantId: string;
  generatedAt: Date;
  comparisonType: ComparisonType;
  
  locations: {
    locationId: string;
    locationName: string;
    metrics: LocationPerformanceMetrics;
    ranking: number;
    percentileRank: number;
    strengthAreas: string[];
    improvementAreas: string[];
  }[];
  
  insights: {
    topPerformers: string[];
    underperformers: string[];
    keySuccessFactors: string[];
    recommendedActions: {
      locationId: string;
      recommendations: string[];
    }[];
  };
}

@Injectable()
export class LocationReportingService {
  private readonly logger = new Logger(LocationReportingService.name);

  constructor(
    private readonly locationService: LocationService,
    private readonly financialReportingService: FinancialReportingService,
    private readonly inventoryReportingService: InventoryReportingService,
    private readonly customerAnalyticsService: CustomerAnalyticsService,
    private readonly procurementAnalyticsService: ProcurementAnalyticsService,
    private readonly transactionService: TransactionService,
  ) {}

  async generateConsolidatedReport(
    tenantId: string,
    query: ConsolidatedReportQuery,
  ): Promise<ConsolidatedReport> {
    try {
      this.logger.log(`Generating consolidated report for tenant: ${tenantId}`);
      
      // Validate query parameters
      this.validateReportQuery(query);
      
      // Get locations to include in report
      const locations = await this.getReportLocations(tenantId, query.locationIds);
      
      if (locations.length === 0) {
        throw new BadRequestException('No locations found for the specified criteria');
      }
      
      // Generate metrics for each location
      const locationMetrics = await Promise.all(
        locations.map(location => 
          this.generateLocationMetrics(tenantId, location, query)
        )
      );
      
      // Calculate aggregated metrics
      const aggregatedMetrics = this.calculateAggregatedMetrics(locationMetrics);
      
      // Generate comparative analysis if requested
      let comparativeAnalysis;
      if (query.includeComparisons) {
        comparativeAnalysis = await this.generateComparativeAnalysis(
          tenantId,
          locationMetrics,
          query
        );
      }
      
      // Generate drill-down data if requested
      let drillDownData;
      if (query.drillDownLevel && query.drillDownLevel !== 'summary') {
        drillDownData = await this.generateDrillDownData(
          tenantId,
          locations,
          query
        );
      }
      
      const report: ConsolidatedReport = {
        reportId: this.generateReportId(),
        tenantId,
        reportType: query.reportType,
        generatedAt: new Date(),
        query,
        totalLocations: locations.length,
        reportPeriod: {
          startDate: query.startDate,
          endDate: query.endDate,
          daysInPeriod: this.calculateDaysInPeriod(query.startDate, query.endDate),
        },
        aggregatedMetrics,
        locationMetrics,
        comparativeAnalysis,
        drillDownData,
      };
      
      this.logger.log(`Consolidated report generated successfully: ${report.reportId}`);
      return report;
      
    } catch (error: any) {
      this.logger.error(`Failed to generate consolidated report: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateLocationComparison(
    tenantId: string,
    locationIds: string[],
    comparisonType: ComparisonType,
    startDate: Date,
    endDate: Date,
  ): Promise<LocationComparisonReport> {
    try {
      this.logger.log(`Generating location comparison report for tenant: ${tenantId}`);
      
      const locations = await this.getReportLocations(tenantId, locationIds);
      
      if (locations.length < 2) {
        throw new BadRequestException('At least 2 locations required for comparison');
      }
      
      // Generate metrics for comparison
      const query: ConsolidatedReportQuery = {
        locationIds,
        startDate,
        endDate,
        reportType: ReportType.COMPREHENSIVE,
        includeComparisons: true,
        includeBenchmarks: comparisonType === ComparisonType.BENCHMARK,
      };
      
      const locationMetrics = await Promise.all(
        locations.map(location => 
          this.generateLocationMetrics(tenantId, location, query)
        )
      );
      
      // Rank locations by overall performance
      const rankedLocations = this.rankLocationsByPerformance(locationMetrics);
      
      // Generate insights and recommendations
      const insights = this.generateComparisonInsights(rankedLocations);
      
      const comparisonReport: LocationComparisonReport = {
        comparisonId: this.generateReportId(),
        tenantId,
        generatedAt: new Date(),
        comparisonType,
        locations: rankedLocations,
        insights,
      };
      
      this.logger.log(`Location comparison report generated: ${comparisonReport.comparisonId}`);
      return comparisonReport;
      
    } catch (error: any) {
      this.logger.error(`Failed to generate location comparison: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateLocationBenchmarks(
    tenantId: string,
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    location: LocationPerformanceMetrics;
    benchmarks: {
      tenantAverage: LocationPerformanceMetrics;
      topQuartile: LocationPerformanceMetrics;
      industryAverage?: LocationPerformanceMetrics;
    };
    recommendations: string[];
  }> {
    try {
      this.logger.log(`Generating benchmarks for location: ${locationId}`);
      
      const location = await this.locationService.findById(tenantId, locationId);
      
      const query: ConsolidatedReportQuery = {
        startDate,
        endDate,
        reportType: ReportType.COMPREHENSIVE,
        includeBenchmarks: true,
      };
      
      // Get metrics for the specific location
      const locationMetrics = await this.generateLocationMetrics(tenantId, location, query);
      
      // Get all locations for tenant-wide benchmarks
      const allLocations = await this.getReportLocations(tenantId);
      const allLocationMetrics = await Promise.all(
        allLocations.map(loc => this.generateLocationMetrics(tenantId, loc, query))
      );
      
      // Calculate benchmarks
      const tenantAverage = this.calculateAverageMetrics(allLocationMetrics);
      const topQuartile = this.calculateTopQuartileMetrics(allLocationMetrics);
      
      // Generate recommendations based on benchmark comparison
      const recommendations = this.generateBenchmarkRecommendations(
        locationMetrics,
        tenantAverage,
        topQuartile
      );
      
      return {
        location: locationMetrics,
        benchmarks: {
          tenantAverage,
          topQuartile,
        },
        recommendations,
      };
      
    } catch (error: any) {
      this.logger.error(`Failed to generate location benchmarks: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async getReportLocations(tenantId: string, locationIds?: string[]): Promise<Location[]> {
    if (locationIds && locationIds.length > 0) {
      // Get specific locations
      const locations = await Promise.all(
        locationIds.map(id => this.locationService.findById(tenantId, id))
      );
      return locations.filter(Boolean);
    } else {
      // Get all active locations
      const { locations } = await this.locationService.findAll(tenantId, {
        limit: 1000,
        status: LocationStatus.ACTIVE,
      });
      return locations;
    }
  }

  private async generateLocationMetrics(
    tenantId: string,
    location: Location,
    query: ConsolidatedReportQuery,
  ): Promise<LocationPerformanceMetrics> {
    try {
      // Get financial metrics
      const financialMetrics = await this.getFinancialMetrics(
        tenantId,
        location.id,
        query.startDate,
        query.endDate
      );
      
      // Get inventory metrics
      const inventoryMetrics = await this.getInventoryMetrics(
        tenantId,
        location.id,
        query.startDate,
        query.endDate
      );
      
      // Get customer metrics
      const customerMetrics = await this.getCustomerMetrics(
        tenantId,
        location.id,
        query.startDate,
        query.endDate
      );
      
      // Get operational metrics
      const operationalMetrics = await this.getOperationalMetrics(
        tenantId,
        location.id,
        query.startDate,
        query.endDate
      );
      
      const result: LocationPerformanceMetrics = {
        locationId: location.id,
        locationName: location.name,
        locationCode: location.code,
        locationType: location.type,
        revenue: financialMetrics.revenue || 0,
        grossProfit: financialMetrics.grossProfit || 0,
        netProfit: financialMetrics.netProfit || 0,
        expenses: financialMetrics.expenses || 0,
        profitMargin: financialMetrics.profitMargin || 0,
        inventoryValue: inventoryMetrics.inventoryValue || 0,
        inventoryTurnover: inventoryMetrics.inventoryTurnover || 0,
        stockoutEvents: inventoryMetrics.stockoutEvents || 0,
        excessInventoryValue: inventoryMetrics.excessInventoryValue || 0,
        uniqueCustomers: customerMetrics.uniqueCustomers || 0,
        repeatCustomerRate: customerMetrics.repeatCustomerRate || 0,
        customerLifetimeValue: customerMetrics.customerLifetimeValue || 0,
        transactionCount: operationalMetrics.transactionCount || 0,
        averageTransactionValue: operationalMetrics.averageTransactionValue || 0,
        itemsSold: operationalMetrics.itemsSold || 0,
        refundAmount: operationalMetrics.refundAmount || 0,
        refundRate: operationalMetrics.refundRate || 0,
        employeeCount: operationalMetrics.employeeCount || 0,
        salesPerEmployee: operationalMetrics.salesPerEmployee || 0,
        operatingHours: operationalMetrics.operatingHours || 0,
        salesPerHour: operationalMetrics.salesPerHour || 0,
      };
      
      // Add optional properties only if they exist
      if (location.managerId) {
        result.managerId = location.managerId;
      }
      
      return result;
      
    } catch (error: any) {
      this.logger.error(`Failed to generate metrics for location ${location.id}: ${error.message}`);
      // Return default metrics to prevent report failure
      return this.getDefaultLocationMetrics(location);
    }
  }

  private async getFinancialMetrics(
    tenantId: string,
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Partial<LocationPerformanceMetrics>> {
    try {
      // Generate income statement for the location and period
      const incomeStatement = await this.financialReportingService.generateIncomeStatement(
        tenantId,
        startDate,
        endDate,
        'system'
      );

      const isData = incomeStatement.data;
      const revenue = isData.revenue.totalRevenue;
      const grossProfit = isData.costOfGoodsSold.grossProfit;
      const netProfit = isData.netIncome;
      const expenses = isData.operatingExpenses.totalOperatingExpenses + isData.otherExpenses.totalOtherExpenses;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        revenue,
        grossProfit,
        netProfit,
        expenses,
        profitMargin,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to get financial metrics for location ${locationId}: ${error?.message || 'Unknown error'}`);
      return {
        revenue: 0,
        grossProfit: 0,
        netProfit: 0,
        expenses: 0,
        profitMargin: 0,
      };
    }
  }

  private async getInventoryMetrics(
    tenantId: string,
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Partial<LocationPerformanceMetrics>> {
    try {
      // Get inventory reports for the location
      const stockLevelReport = await this.inventoryReportingService.generateStockLevelReport(tenantId, {
        locationId,
        dateTo: endDate,
      });

      const turnoverReport = await this.inventoryReportingService.generateTurnoverReport(tenantId, {
        locationId,
        dateFrom: startDate,
        dateTo: endDate,
      });

      const movementReport = await this.inventoryReportingService.generateMovementReport(tenantId, {
        locationId,
        dateFrom: startDate,
        dateTo: endDate,
      });

      const stockData = stockLevelReport.data as any;
      const turnoverData = turnoverReport.data as any;
      const movementData = movementReport.data as any;

      // Calculate inventory metrics
      const inventoryValue = stockData.summary.totalValue;
      const averageTurnover = turnoverData.summary.averageTurnover;
      
      // Count stockout events from movements
      const stockoutEvents = movementData.movements.filter((m: any) => 
        m.newLevel === 0 && m.previousLevel > 0
      ).length;

      // Calculate excess inventory (items with very low turnover)
      const excessInventoryValue = stockData.products
        .filter((p: any) => p.status === 'overstock')
        .reduce((sum: number, p: any) => sum + p.totalValue, 0);

      return {
        inventoryValue,
        inventoryTurnover: averageTurnover,
        stockoutEvents,
        excessInventoryValue,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to get inventory metrics for location ${locationId}: ${error?.message || 'Unknown error'}`);
      return {
        inventoryValue: 0,
        inventoryTurnover: 0,
        stockoutEvents: 0,
        excessInventoryValue: 0,
      };
    }
  }

  private async getCustomerMetrics(
    tenantId: string,
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Partial<LocationPerformanceMetrics>> {
    try {
      // Get customer analytics for the location
      const customerMetrics = await this.customerAnalyticsService.getCustomerMetrics(tenantId);

      // Calculate location-specific customer metrics
      // Note: This is simplified - in a real implementation, you'd filter by location
      const totalCustomers = customerMetrics.totalCustomers;
      const avgLifetimeValue = customerMetrics.averageLifetimeValue;
      const repeatCustomerRate = (customerMetrics.retentionRate || 95);

      return {
        uniqueCustomers: Math.max(customerMetrics.newCustomersThisMonth || 0, Math.floor(totalCustomers * 0.1)), // Estimate location share
        repeatCustomerRate,
        customerLifetimeValue: avgLifetimeValue,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to get customer metrics for location ${locationId}: ${error?.message || 'Unknown error'}`);
      return {
        uniqueCustomers: 0,
        repeatCustomerRate: 0,
        customerLifetimeValue: 0,
      };
    }
  }

  private async getOperationalMetrics(
    tenantId: string,
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Partial<LocationPerformanceMetrics>> {
    try {
      // Get transaction summary for the location and period
      const transactionSummary = await this.transactionService.getTransactionSummary(
        tenantId,
        locationId,
        startDate,
        endDate
      );

      // Get detailed transactions for refund calculations
      const { transactions } = await this.transactionService.findTransactionsByTenant(tenantId, {
        locationId,
        startDate,
        endDate,
        limit: 10000,
      });

      // Calculate refund metrics
      const refundTransactions = transactions.filter(t => t.status === 'refunded');
      const refundAmount = refundTransactions.reduce((sum, t) => sum + t.total, 0);
      const refundRate = transactionSummary.totalAmount > 0 
        ? (refundAmount / transactionSummary.totalAmount) * 100 
        : 0;

      // Calculate items sold (would need transaction items data)
      const itemsSold = transactions.reduce((sum, t) => sum + (t.itemCount || 0), 0);

      // Get employee count for the location (simplified - would need employee service integration)
      const employeeCount = 5; // Placeholder - would integrate with employee service

      // Calculate derived metrics
      const salesPerEmployee = employeeCount > 0 ? transactionSummary.totalAmount / employeeCount : 0;
      const operatingHours = 12; // Placeholder - would get from location settings
      const salesPerHour = operatingHours > 0 ? transactionSummary.totalAmount / operatingHours : 0;

      return {
        transactionCount: transactionSummary.totalTransactions,
        averageTransactionValue: transactionSummary.averageTransactionValue,
        itemsSold,
        refundAmount,
        refundRate,
        employeeCount,
        salesPerEmployee,
        operatingHours,
        salesPerHour,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to get operational metrics for location ${locationId}: ${error?.message || 'Unknown error'}`);
      return {
        transactionCount: 0,
        averageTransactionValue: 0,
        itemsSold: 0,
        refundAmount: 0,
        refundRate: 0,
        employeeCount: 0,
        salesPerEmployee: 0,
        operatingHours: 0,
        salesPerHour: 0,
      };
    }
  }

  private calculateAggregatedMetrics(locationMetrics: LocationPerformanceMetrics[]): any {
    const totalRevenue = locationMetrics.reduce((sum, loc) => sum + loc.revenue, 0);
    const totalTransactions = locationMetrics.reduce((sum, loc) => sum + loc.transactionCount, 0);
    const totalCustomers = locationMetrics.reduce((sum, loc) => sum + loc.uniqueCustomers, 0);
    const totalInventoryValue = locationMetrics.reduce((sum, loc) => sum + loc.inventoryValue, 0);
    
    const averageProfitMargin = locationMetrics.length > 0 
      ? locationMetrics.reduce((sum, loc) => sum + loc.profitMargin, 0) / locationMetrics.length
      : 0;
    
    // Find top and bottom performing locations by revenue
    const sortedByRevenue = [...locationMetrics].sort((a, b) => b.revenue - a.revenue);
    const topPerformingLocationId = sortedByRevenue[0]?.locationId || '';
    const lowestPerformingLocationId = sortedByRevenue[sortedByRevenue.length - 1]?.locationId || '';
    
    return {
      totalRevenue,
      totalTransactions,
      totalCustomers,
      totalInventoryValue,
      averageProfitMargin,
      topPerformingLocationId,
      lowestPerformingLocationId,
    };
  }

  private async generateComparativeAnalysis(
    tenantId: string,
    locationMetrics: LocationPerformanceMetrics[],
    query: ConsolidatedReportQuery,
  ): Promise<any> {
    // This would implement period-over-period comparison logic
    return {
      periodOverPeriodGrowth: 0,
      bestPerformingMetrics: ['revenue', 'profitMargin'],
      improvementOpportunities: ['inventory turnover', 'customer retention'],
    };
  }

  private async generateDrillDownData(
    tenantId: string,
    locations: Location[],
    query: ConsolidatedReportQuery,
  ): Promise<any> {
    // This would implement detailed drill-down data generation
    const drillDownData: any = {};
    
    for (const location of locations) {
      drillDownData[location.id] = {
        dailyMetrics: [],
        topProducts: [],
        topCustomers: [],
        transactionDetails: query.drillDownLevel === 'transaction' ? [] : undefined,
      };
    }
    
    return drillDownData;
  }

  private rankLocationsByPerformance(locationMetrics: LocationPerformanceMetrics[]): any[] {
    // Calculate composite performance score
    const scoredLocations = locationMetrics.map(location => {
      const performanceScore = this.calculatePerformanceScore(location);
      return {
        locationId: location.locationId,
        locationName: location.locationName,
        metrics: location,
        performanceScore,
      };
    });
    
    // Sort by performance score
    scoredLocations.sort((a, b) => b.performanceScore - a.performanceScore);
    
    // Add ranking and percentile information
    return scoredLocations.map((location, index) => ({
      ...location,
      ranking: index + 1,
      percentileRank: ((scoredLocations.length - index) / scoredLocations.length) * 100,
      strengthAreas: this.identifyStrengthAreas(location.metrics, locationMetrics),
      improvementAreas: this.identifyImprovementAreas(location.metrics, locationMetrics),
    }));
  }

  private calculatePerformanceScore(metrics: LocationPerformanceMetrics): number {
    // Weighted composite score based on key metrics
    const weights = {
      profitMargin: 0.3,
      revenue: 0.25,
      customerSatisfaction: 0.2,
      inventoryTurnover: 0.15,
      salesPerEmployee: 0.1,
    };
    
    // Normalize metrics to 0-100 scale and calculate weighted score
    let score = 0;
    score += (metrics.profitMargin || 0) * weights.profitMargin;
    score += Math.min((metrics.revenue || 0) / 100000, 1) * 100 * weights.revenue;
    score += (metrics.customerSatisfactionScore || 0) * weights.customerSatisfaction;
    score += Math.min((metrics.inventoryTurnover || 0) / 12, 1) * 100 * weights.inventoryTurnover;
    score += Math.min((metrics.salesPerEmployee || 0) / 100000, 1) * 100 * weights.salesPerEmployee;
    
    return Math.round(score);
  }

  private identifyStrengthAreas(
    locationMetrics: LocationPerformanceMetrics,
    allMetrics: LocationPerformanceMetrics[],
  ): string[] {
    const strengths: string[] = [];
    
    // Compare against average performance
    const avgRevenue = allMetrics.reduce((sum, m) => sum + m.revenue, 0) / allMetrics.length;
    const avgProfitMargin = allMetrics.reduce((sum, m) => sum + m.profitMargin, 0) / allMetrics.length;
    
    if (locationMetrics.revenue > avgRevenue * 1.2) {
      strengths.push('High Revenue Generation');
    }
    
    if (locationMetrics.profitMargin > avgProfitMargin * 1.1) {
      strengths.push('Strong Profit Margins');
    }
    
    if (locationMetrics.inventoryTurnover > 6) {
      strengths.push('Efficient Inventory Management');
    }
    
    if (locationMetrics.repeatCustomerRate > 0.6) {
      strengths.push('Strong Customer Retention');
    }
    
    return strengths;
  }

  private identifyImprovementAreas(
    locationMetrics: LocationPerformanceMetrics,
    allMetrics: LocationPerformanceMetrics[],
  ): string[] {
    const improvements: string[] = [];
    
    // Compare against average performance
    const avgRevenue = allMetrics.reduce((sum, m) => sum + m.revenue, 0) / allMetrics.length;
    const avgProfitMargin = allMetrics.reduce((sum, m) => sum + m.profitMargin, 0) / allMetrics.length;
    
    if (locationMetrics.revenue < avgRevenue * 0.8) {
      improvements.push('Revenue Growth Opportunities');
    }
    
    if (locationMetrics.profitMargin < avgProfitMargin * 0.9) {
      improvements.push('Cost Management');
    }
    
    if (locationMetrics.inventoryTurnover < 3) {
      improvements.push('Inventory Optimization');
    }
    
    if (locationMetrics.repeatCustomerRate < 0.4) {
      improvements.push('Customer Retention Programs');
    }
    
    return improvements;
  }

  private generateComparisonInsights(rankedLocations: any[]): any {
    const topPerformers = rankedLocations.slice(0, Math.ceil(rankedLocations.length * 0.2))
      .map(loc => loc.locationName);
    
    const underperformers = rankedLocations.slice(-Math.ceil(rankedLocations.length * 0.2))
      .map(loc => loc.locationName);
    
    // Analyze common success factors among top performers
    const keySuccessFactors = this.analyzeSuccessFactors(rankedLocations.slice(0, 3));
    
    // Generate specific recommendations for underperformers
    const recommendedActions = rankedLocations.slice(-3).map(location => ({
      locationId: location.locationId,
      recommendations: this.generateLocationRecommendations(location.metrics),
    }));
    
    return {
      topPerformers,
      underperformers,
      keySuccessFactors,
      recommendedActions,
    };
  }

  private analyzeSuccessFactors(topPerformers: any[]): string[] {
    const factors: string[] = [];
    
    // Analyze common characteristics of top performers
    const avgProfitMargin = topPerformers.reduce((sum, loc) => sum + loc.metrics.profitMargin, 0) / topPerformers.length;
    const avgInventoryTurnover = topPerformers.reduce((sum, loc) => sum + loc.metrics.inventoryTurnover, 0) / topPerformers.length;
    
    if (avgProfitMargin > 15) {
      factors.push('Maintaining healthy profit margins above 15%');
    }
    
    if (avgInventoryTurnover > 8) {
      factors.push('Efficient inventory management with high turnover rates');
    }
    
    factors.push('Strong operational efficiency');
    factors.push('Effective customer relationship management');
    
    return factors;
  }

  private generateLocationRecommendations(metrics: LocationPerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.profitMargin < 10) {
      recommendations.push('Review pricing strategy and cost structure to improve profit margins');
    }
    
    if (metrics.inventoryTurnover < 4) {
      recommendations.push('Optimize inventory levels and improve demand forecasting');
    }
    
    if (metrics.repeatCustomerRate < 0.5) {
      recommendations.push('Implement customer loyalty programs and improve service quality');
    }
    
    if (metrics.salesPerEmployee < 50000) {
      recommendations.push('Provide additional training to staff and optimize scheduling');
    }
    
    return recommendations;
  }

  private calculateAverageMetrics(allMetrics: LocationPerformanceMetrics[]): LocationPerformanceMetrics {
    const count = allMetrics.length;
    if (count === 0) return this.getDefaultLocationMetrics();
    
    return {
      locationId: 'average',
      locationName: 'Tenant Average',
      locationCode: 'AVG',
      locationType: 'average',
      revenue: allMetrics.reduce((sum, m) => sum + m.revenue, 0) / count,
      grossProfit: allMetrics.reduce((sum, m) => sum + m.grossProfit, 0) / count,
      netProfit: allMetrics.reduce((sum, m) => sum + m.netProfit, 0) / count,
      expenses: allMetrics.reduce((sum, m) => sum + m.expenses, 0) / count,
      profitMargin: allMetrics.reduce((sum, m) => sum + m.profitMargin, 0) / count,
      transactionCount: allMetrics.reduce((sum, m) => sum + m.transactionCount, 0) / count,
      averageTransactionValue: allMetrics.reduce((sum, m) => sum + m.averageTransactionValue, 0) / count,
      itemsSold: allMetrics.reduce((sum, m) => sum + m.itemsSold, 0) / count,
      refundAmount: allMetrics.reduce((sum, m) => sum + m.refundAmount, 0) / count,
      refundRate: allMetrics.reduce((sum, m) => sum + m.refundRate, 0) / count,
      inventoryValue: allMetrics.reduce((sum, m) => sum + m.inventoryValue, 0) / count,
      inventoryTurnover: allMetrics.reduce((sum, m) => sum + m.inventoryTurnover, 0) / count,
      stockoutEvents: allMetrics.reduce((sum, m) => sum + m.stockoutEvents, 0) / count,
      excessInventoryValue: allMetrics.reduce((sum, m) => sum + m.excessInventoryValue, 0) / count,
      uniqueCustomers: allMetrics.reduce((sum, m) => sum + m.uniqueCustomers, 0) / count,
      repeatCustomerRate: allMetrics.reduce((sum, m) => sum + m.repeatCustomerRate, 0) / count,
      customerLifetimeValue: allMetrics.reduce((sum, m) => sum + m.customerLifetimeValue, 0) / count,
      employeeCount: allMetrics.reduce((sum, m) => sum + m.employeeCount, 0) / count,
      salesPerEmployee: allMetrics.reduce((sum, m) => sum + m.salesPerEmployee, 0) / count,
      operatingHours: allMetrics.reduce((sum, m) => sum + m.operatingHours, 0) / count,
      salesPerHour: allMetrics.reduce((sum, m) => sum + m.salesPerHour, 0) / count,
    };
  }

  private calculateTopQuartileMetrics(allMetrics: LocationPerformanceMetrics[]): LocationPerformanceMetrics {
    if (allMetrics.length === 0) return this.getDefaultLocationMetrics();
    
    const sortedMetrics = [...allMetrics].sort((a, b) => b.revenue - a.revenue);
    const topQuartileCount = Math.ceil(sortedMetrics.length * 0.25);
    const topQuartile = sortedMetrics.slice(0, topQuartileCount);
    
    return this.calculateAverageMetrics(topQuartile);
  }

  private generateBenchmarkRecommendations(
    locationMetrics: LocationPerformanceMetrics,
    tenantAverage: LocationPerformanceMetrics,
    topQuartile: LocationPerformanceMetrics,
  ): string[] {
    const recommendations: string[] = [];
    
    if (locationMetrics.revenue < tenantAverage.revenue * 0.9) {
      recommendations.push(`Revenue is ${Math.round(((tenantAverage.revenue - locationMetrics.revenue) / tenantAverage.revenue) * 100)}% below tenant average. Focus on sales growth initiatives.`);
    }
    
    if (locationMetrics.profitMargin < tenantAverage.profitMargin * 0.9) {
      recommendations.push(`Profit margin is below average. Review cost structure and pricing strategy.`);
    }
    
    if (locationMetrics.inventoryTurnover < tenantAverage.inventoryTurnover * 0.8) {
      recommendations.push(`Inventory turnover is significantly below average. Optimize inventory management.`);
    }
    
    if (locationMetrics.repeatCustomerRate < tenantAverage.repeatCustomerRate * 0.9) {
      recommendations.push(`Customer retention is below average. Implement loyalty programs and improve service quality.`);
    }
    
    // Aspirational recommendations based on top quartile
    if (locationMetrics.revenue < topQuartile.revenue * 0.7) {
      recommendations.push(`Revenue opportunity: Top quartile locations generate ${Math.round(((topQuartile.revenue - locationMetrics.revenue) / locationMetrics.revenue) * 100)}% more revenue.`);
    }
    
    return recommendations;
  }

  private getDefaultLocationMetrics(location?: Location): LocationPerformanceMetrics {
    const result: LocationPerformanceMetrics = {
      locationId: location?.id || '',
      locationName: location?.name || '',
      locationCode: location?.code || '',
      locationType: location?.type || '',
      revenue: 0,
      grossProfit: 0,
      netProfit: 0,
      expenses: 0,
      profitMargin: 0,
      transactionCount: 0,
      averageTransactionValue: 0,
      itemsSold: 0,
      refundAmount: 0,
      refundRate: 0,
      inventoryValue: 0,
      inventoryTurnover: 0,
      stockoutEvents: 0,
      excessInventoryValue: 0,
      uniqueCustomers: 0,
      repeatCustomerRate: 0,
      customerLifetimeValue: 0,
      employeeCount: 0,
      salesPerEmployee: 0,
      operatingHours: 0,
      salesPerHour: 0,
    };
    
    // Add optional properties only if they exist
    if (location?.managerId) {
      result.managerId = location.managerId;
    }
    
    return result;
  }

  private validateReportQuery(query: ConsolidatedReportQuery): void {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Start date and end date are required');
    }
    
    if (query.startDate >= query.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }
    
    const maxDays = 365;
    const daysDiff = this.calculateDaysInPeriod(query.startDate, query.endDate);
    if (daysDiff > maxDays) {
      throw new BadRequestException(`Report period cannot exceed ${maxDays} days`);
    }
    
    const validReportTypes = Object.values(ReportType);
    if (!validReportTypes.includes(query.reportType)) {
      throw new BadRequestException(`Invalid report type. Must be one of: ${validReportTypes.join(', ')}`);
    }
  }

  private calculateDaysInPeriod(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Get location sales report
   */
  async getLocationSalesReport(
    tenantId: string,
    locationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    locationId: string;
    locationName: string;
    period: { startDate: Date; endDate: Date };
    totalSales: number;
    totalTransactions: number;
    averageTransactionValue: number;
    topProducts: Array<{ productId: string; productName: string; quantity: number; revenue: number }>;
    salesByDay: Array<{ date: Date; sales: number; transactions: number }>;
    salesByHour: Array<{ hour: number; sales: number; transactions: number }>;
    paymentMethods: Array<{ method: string; amount: number; percentage: number }>;
    refunds: { amount: number; count: number; rate: number };
  }> {
    try {
      const location = await this.locationService.findById(tenantId, locationId);
      if (!location) {
        throw new NotFoundException('Location not found');
      }

      const reportPeriod = this.getReportPeriod(startDate, endDate);
      
      // Mock data - in real implementation, this would query transaction data
      const mockSalesData = {
        locationId,
        locationName: location.name,
        period: reportPeriod,
        totalSales: 125000,
        totalTransactions: 850,
        averageTransactionValue: 147.06,
        topProducts: [
          { productId: 'prod-1', productName: 'Product A', quantity: 120, revenue: 24000 },
          { productId: 'prod-2', productName: 'Product B', quantity: 95, revenue: 19000 },
          { productId: 'prod-3', productName: 'Product C', quantity: 80, revenue: 16000 },
        ],
        salesByDay: this.generateDailySalesData(reportPeriod.startDate, reportPeriod.endDate),
        salesByHour: this.generateHourlySalesData(),
        paymentMethods: [
          { method: 'Credit Card', amount: 75000, percentage: 60 },
          { method: 'Cash', amount: 37500, percentage: 30 },
          { method: 'Digital Wallet', amount: 12500, percentage: 10 },
        ],
        refunds: { amount: 2500, count: 15, rate: 0.02 },
      };

      return mockSalesData;
    } catch (error: any) {
      this.logger.error(`Failed to get location sales report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get location inventory report
   */
  async getLocationInventoryReport(
    tenantId: string,
    locationId: string,
  ): Promise<{
    locationId: string;
    locationName: string;
    totalValue: number;
    totalItems: number;
    lowStockItems: Array<{ productId: string; productName: string; currentStock: number; minStock: number }>;
    overStockItems: Array<{ productId: string; productName: string; currentStock: number; maxStock: number }>;
    topMovingItems: Array<{ productId: string; productName: string; turnoverRate: number }>;
    slowMovingItems: Array<{ productId: string; productName: string; turnoverRate: number }>;
    categoryBreakdown: Array<{ category: string; value: number; percentage: number }>;
    ageAnalysis: Array<{ ageRange: string; value: number; percentage: number }>;
  }> {
    try {
      const location = await this.locationService.findById(tenantId, locationId);
      if (!location) {
        throw new NotFoundException('Location not found');
      }

      // Mock data - in real implementation, this would query inventory data
      const mockInventoryData = {
        locationId,
        locationName: location.name,
        totalValue: 450000,
        totalItems: 1250,
        lowStockItems: [
          { productId: 'prod-1', productName: 'Product A', currentStock: 5, minStock: 20 },
          { productId: 'prod-2', productName: 'Product B', currentStock: 8, minStock: 15 },
        ],
        overStockItems: [
          { productId: 'prod-3', productName: 'Product C', currentStock: 200, maxStock: 100 },
        ],
        topMovingItems: [
          { productId: 'prod-4', productName: 'Product D', turnoverRate: 12.5 },
          { productId: 'prod-5', productName: 'Product E', turnoverRate: 10.2 },
        ],
        slowMovingItems: [
          { productId: 'prod-6', productName: 'Product F', turnoverRate: 1.2 },
        ],
        categoryBreakdown: [
          { category: 'Electronics', value: 200000, percentage: 44.4 },
          { category: 'Clothing', value: 150000, percentage: 33.3 },
          { category: 'Home & Garden', value: 100000, percentage: 22.2 },
        ],
        ageAnalysis: [
          { ageRange: '0-30 days', value: 200000, percentage: 44.4 },
          { ageRange: '31-60 days', value: 150000, percentage: 33.3 },
          { ageRange: '61-90 days', value: 75000, percentage: 16.7 },
          { ageRange: '90+ days', value: 25000, percentage: 5.6 },
        ],
      };

      return mockInventoryData;
    } catch (error: any) {
      this.logger.error(`Failed to get location inventory report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get location performance report
   */
  async getLocationPerformanceReport(
    tenantId: string,
    locationId: string,
    period: string = 'monthly',
  ): Promise<{
    locationId: string;
    locationName: string;
    period: string;
    metrics: LocationPerformanceMetrics;
    trends: Array<{ metric: string; trend: 'up' | 'down' | 'stable'; percentage: number }>;
    benchmarks: {
      tenantAverage: LocationPerformanceMetrics;
      topQuartile: LocationPerformanceMetrics;
    };
    recommendations: string[];
  }> {
    try {
      const location = await this.locationService.findById(tenantId, locationId);
      if (!location) {
        throw new NotFoundException('Location not found');
      }

      const metrics = await this.calculateLocationPerformanceMetrics(tenantId, locationId, period);
      const allLocations = await this.locationService.findByTenant(tenantId);
      const allMetrics = await Promise.all(
        allLocations.map(loc => this.calculateLocationPerformanceMetrics(tenantId, loc.id, period))
      );

      const tenantAverage = this.calculateAverageMetrics(allMetrics);
      const topQuartile = this.calculateTopQuartileMetrics(allMetrics);

      const trends = this.calculatePerformanceTrends(metrics, period);
      const recommendations = this.generateBenchmarkRecommendations(metrics, tenantAverage, topQuartile);

      return {
        locationId,
        locationName: location.name,
        period,
        metrics,
        trends,
        benchmarks: {
          tenantAverage,
          topQuartile,
        },
        recommendations,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get location performance report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Compare multiple locations
   */
  async compareLocations(
    tenantId: string,
    locationIds: string[],
    metrics: string[],
    period: string = 'monthly',
  ): Promise<{
    period: string;
    metrics: string[];
    locations: Array<{
      locationId: string;
      locationName: string;
      data: Record<string, number>;
      ranking: Record<string, number>;
    }>;
    summary: {
      bestPerforming: { locationId: string; locationName: string; metric: string; value: number };
      worstPerforming: { locationId: string; locationName: string; metric: string; value: number };
      averages: Record<string, number>;
    };
  }> {
    try {
      const locations = await Promise.all(
        locationIds.map(id => this.locationService.findById(tenantId, id))
      );

      const validLocations = locations.filter(loc => loc !== null);
      if (validLocations.length === 0) {
        throw new NotFoundException('No valid locations found');
      }

      const locationMetrics = await Promise.all(
        validLocations.map(async (location) => {
          const performanceMetrics = await this.calculateLocationPerformanceMetrics(tenantId, location.id, period);
          return {
            locationId: location.id,
            locationName: location.name,
            metrics: performanceMetrics,
          };
        })
      );

      // Extract requested metrics and calculate rankings
      const comparisonData = locationMetrics.map(({ locationId, locationName, metrics: perfMetrics }) => {
        const data: Record<string, number> = {};
        const ranking: Record<string, number> = {};

        metrics.forEach(metric => {
          data[metric] = (perfMetrics as any)[metric] || 0;
        });

        return { locationId, locationName, data, ranking };
      });

      // Calculate rankings for each metric
      metrics.forEach(metric => {
        const sortedByMetric = [...comparisonData].sort((a, b) => {
          const bValue = b.data[metric] ?? 0;
          const aValue = a.data[metric] ?? 0;
          return bValue - aValue;
        });
        sortedByMetric.forEach((item, index) => {
          const originalItem = comparisonData.find(d => d.locationId === item.locationId);
          if (originalItem) {
            originalItem.ranking[metric] = index + 1;
          }
        });
      });

      // Calculate summary statistics
      const averages: Record<string, number> = {};
      metrics.forEach(metric => {
        const values = comparisonData.map(d => d.data[metric] ?? 0);
        averages[metric] = values.reduce((sum, val) => (sum ?? 0) + (val ?? 0), 0) / Math.max(values.length, 1);
      });

      // Find best and worst performing
      let bestPerforming = { locationId: '', locationName: '', metric: '', value: -Infinity };
      let worstPerforming = { locationId: '', locationName: '', metric: '', value: Infinity };

      comparisonData.forEach(({ locationId, locationName, data }) => {
        metrics.forEach(metric => {
          const metricValue = data[metric] ?? 0;
          if (metricValue > bestPerforming.value) {
            bestPerforming = { locationId, locationName, metric, value: metricValue };
          }
          if (metricValue < worstPerforming.value) {
            worstPerforming = { locationId, locationName, metric, value: metricValue };
          }
        });
      });

      return {
        period,
        metrics,
        locations: comparisonData,
        summary: {
          bestPerforming,
          worstPerforming,
          averages,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to compare locations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper method to get report period
   */
  private getReportPeriod(startDate?: Date, endDate?: Date): { startDate: Date; endDate: Date } {
    const now = new Date();
    const defaultEndDate = endDate || now;
    const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    
    return {
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    };
  }

  /**
   * Generate daily sales data for the period
   */
  private generateDailySalesData(startDate: Date, endDate: Date): Array<{ date: Date; sales: number; transactions: number }> {
    const data: Array<{ date: Date; sales: number; transactions: number }> = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      data.push({
        date: new Date(currentDate),
        sales: Math.floor(Math.random() * 5000) + 1000,
        transactions: Math.floor(Math.random() * 50) + 10,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return data;
  }

  /**
   * Generate hourly sales data
   */
  private generateHourlySalesData(): Array<{ hour: number; sales: number; transactions: number }> {
    const data: Array<{ hour: number; sales: number; transactions: number }> = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const isBusinessHour = hour >= 9 && hour <= 21;
      const baseSales = isBusinessHour ? Math.floor(Math.random() * 1000) + 500 : Math.floor(Math.random() * 200);
      const baseTransactions = isBusinessHour ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 5);
      
      data.push({
        hour,
        sales: baseSales,
        transactions: baseTransactions,
      });
    }
    
    return data;
  }

  /**
   * Calculate performance trends
   */
  private calculatePerformanceTrends(
    metrics: LocationPerformanceMetrics,
    period: string,
  ): Array<{ metric: string; trend: 'up' | 'down' | 'stable'; percentage: number }> {
    // Mock trend data - in real implementation, this would compare with previous period
    return [
      { metric: 'revenue', trend: 'up', percentage: 12.5 },
      { metric: 'profitMargin', trend: 'down', percentage: -2.3 },
      { metric: 'transactionCount', trend: 'up', percentage: 8.7 },
      { metric: 'inventoryTurnover', trend: 'stable', percentage: 0.5 },
      { metric: 'repeatCustomerRate', trend: 'up', percentage: 5.2 },
    ];
  }

  /**
   * Calculate performance metrics for a location
   */
  private async calculateLocationPerformanceMetrics(
    tenantId: string,
    locationId: string,
    period?: string,
  ): Promise<LocationPerformanceMetrics> {
    const location = await this.locationService.findById(tenantId, locationId);
    if (!location) {
      throw new NotFoundException(`Location with ID '${locationId}' not found`);
    }

    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const query: ConsolidatedReportQuery = {
      locationIds: [locationId],
      startDate: monthAgo,
      endDate: now,
      reportType: ReportType.COMPREHENSIVE,
    };

    return this.generateLocationMetrics(tenantId, location, query);
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}