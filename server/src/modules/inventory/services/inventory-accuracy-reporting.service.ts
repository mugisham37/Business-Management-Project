import { Injectable } from '@nestjs/common';
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryMovementRepository } from '../repositories/inventory-movement.repository';
import { CycleCountingRepository } from '../repositories/cycle-counting.repository';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Import the DTOs from cycle counting service
export interface StockCountSessionQueryDto {
  locationId?: string;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  scheduledDateFrom?: Date;
  scheduledDateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Inventory accuracy reporting DTOs
export interface AccuracyReportQueryDto {
  locationId?: string;
  productId?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  reportType: 'summary' | 'detailed' | 'trends' | 'comparative';
  groupBy?: 'location' | 'product' | 'category' | 'user' | 'time';
  includeZeroVariances?: boolean;
}

export interface InventoryAccuracyReport {
  reportType: string;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  parameters: AccuracyReportQueryDto;
  summary: AccuracySummary;
  data: any;
}

export interface AccuracySummary {
  totalLocations: number;
  totalProducts: number;
  totalCountSessions: number;
  overallAccuracyPercentage: number;
  totalVariances: number;
  totalVarianceValue: number;
  averageVariancePerProduct: number;
  bestPerformingLocation: {
    locationId: string;
    accuracyPercentage: number;
  };
  worstPerformingLocation: {
    locationId: string;
    accuracyPercentage: number;
  };
}

export interface DetailedAccuracyData {
  locations: LocationAccuracy[];
  products: ProductAccuracy[];
  countSessions: CountSessionAccuracy[];
  varianceAnalysis: VarianceAnalysis;
}

export interface LocationAccuracy {
  locationId: string;
  locationName?: string;
  totalProducts: number;
  countedProducts: number;
  productsWithVariances: number;
  accuracyPercentage: number;
  totalVariances: number;
  totalVarianceValue: number;
  lastCountDate: Date;
  countFrequency: number; // counts per month
  averageVarianceSize: number;
  topVarianceReasons: { reason: string; count: number; value: number }[];
}

export interface ProductAccuracy {
  productId: string;
  productName: string;
  sku: string;
  categoryId?: string;
  categoryName?: string;
  totalCounts: number;
  countsWithVariances: number;
  accuracyPercentage: number;
  totalVariance: number;
  totalVarianceValue: number;
  averageVarianceSize: number;
  lastCountDate: Date;
  varianceTrend: 'improving' | 'stable' | 'worsening';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CountSessionAccuracy {
  sessionId: string;
  sessionNumber: string;
  locationId: string;
  countDate: Date;
  totalItems: number;
  itemsWithVariances: number;
  accuracyPercentage: number;
  totalVarianceValue: number;
  countDuration?: number; // in hours
  countersInvolved: string[];
  completionRate: number;
}

export interface VarianceAnalysis {
  byReason: {
    reason: string;
    count: number;
    percentage: number;
    totalValue: number;
    averageValue: number;
  }[];
  byMagnitude: {
    range: string;
    count: number;
    percentage: number;
    totalValue: number;
  }[];
  byProduct: {
    productId: string;
    productName: string;
    varianceCount: number;
    totalVariance: number;
    riskScore: number;
  }[];
  byUser: {
    userId: string;
    userName?: string;
    countsPerformed: number;
    variancesFound: number;
    accuracyRate: number;
  }[];
}

export interface AccuracyTrendsData {
  monthlyTrends: {
    month: string;
    accuracyPercentage: number;
    totalCounts: number;
    totalVariances: number;
    totalVarianceValue: number;
  }[];
  weeklyTrends: {
    week: string;
    accuracyPercentage: number;
    totalCounts: number;
    totalVariances: number;
  }[];
  dailyTrends: {
    date: string;
    accuracyPercentage: number;
    countSessions: number;
    varianceCount: number;
  }[];
  seasonalPatterns: {
    season: string;
    averageAccuracy: number;
    varianceVolatility: number;
  }[];
  forecastedAccuracy: {
    nextMonth: number;
    confidence: number;
    factors: string[];
  };
}

export interface ComparativeAccuracyData {
  locationComparison: {
    locationId: string;
    locationName?: string;
    currentAccuracy: number;
    previousPeriodAccuracy: number;
    change: number;
    trend: 'improving' | 'stable' | 'declining';
    rank: number;
  }[];
  productComparison: {
    productId: string;
    productName: string;
    currentAccuracy: number;
    previousPeriodAccuracy: number;
    change: number;
    trend: 'improving' | 'stable' | 'declining';
    riskLevel: 'low' | 'medium' | 'high';
  }[];
  benchmarks: {
    industryAverage: number;
    bestInClass: number;
    companyTarget: number;
    currentPerformance: number;
    gap: number;
  };
}

@Injectable()
export class InventoryAccuracyReportingService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly movementRepository: InventoryMovementRepository,
    private readonly cycleCountRepository: CycleCountingRepository,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  async generateAccuracyReport(
    tenantId: string,
    query: AccuracyReportQueryDto,
  ): Promise<InventoryAccuracyReport> {
    const cacheKey = `accuracy-report:${tenantId}:${JSON.stringify(query)}`;
    let report = await this.cacheService.get<InventoryAccuracyReport>(cacheKey);

    if (!report) {
      const period = {
        startDate: query.dateFrom || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Default 90 days
        endDate: query.dateTo || new Date(),
      };

      let data: any;
      let summary: AccuracySummary;

      switch (query.reportType) {
        case 'summary':
          data = await this.generateSummaryData(tenantId, query, period);
          summary = data.summary;
          break;
        case 'detailed':
          data = await this.generateDetailedData(tenantId, query, period);
          summary = await this.calculateSummaryFromDetailed(data);
          break;
        case 'trends':
          data = await this.generateTrendsData(tenantId, query, period);
          summary = await this.calculateSummaryFromTrends(data);
          break;
        case 'comparative':
          data = await this.generateComparativeData(tenantId, query, period);
          summary = await this.calculateSummaryFromComparative(data);
          break;
        default:
          throw new Error(`Unsupported report type: ${query.reportType}`);
      }

      report = {
        reportType: query.reportType,
        generatedAt: new Date(),
        period,
        parameters: query,
        summary,
        data,
      };

      await this.cacheService.set(cacheKey, report, { ttl: 600 }); // 10 minutes
    }

    return report;
  }

  private async generateSummaryData(
    tenantId: string,
    query: AccuracyReportQueryDto,
    period: { startDate: Date; endDate: Date },
  ): Promise<{ summary: AccuracySummary }> {
    // Get all count sessions in period
    const sessionQuery: StockCountSessionQueryDto = {
      scheduledDateFrom: period.startDate,
      scheduledDateTo: period.endDate,
      status: 'completed' as const,
      limit: 1000,
    };

    // Only add locationId if it's defined and not undefined
    if (query.locationId !== undefined) {
      sessionQuery.locationId = query.locationId;
    }

    const sessions = await this.cycleCountRepository.findSessions(tenantId, sessionQuery);

    let totalVariances = 0;
    let totalVarianceValue = 0;
    let totalProducts = 0;
    const locationAccuracies: { [locationId: string]: { accuracy: number; count: number } } = {};

    for (const session of sessions.sessions) {
      const sessionVariances = session.totalVariances ?? 0;
      const sessionItemsCounted = session.totalItemsCounted ?? 0;
      const sessionAdjustmentValue = session.totalAdjustmentValue ?? 0;

      totalVariances += sessionVariances;
      totalVarianceValue += sessionAdjustmentValue;
      totalProducts += sessionItemsCounted;

      // Calculate session accuracy
      const sessionAccuracy = sessionItemsCounted > 0 ? 
        ((sessionItemsCounted - sessionVariances) / sessionItemsCounted) * 100 : 100;

      const locationId = session.locationId;
      if (locationId) {
        if (!locationAccuracies[locationId]) {
          locationAccuracies[locationId] = { accuracy: 0, count: 0 };
        }
        locationAccuracies[locationId]!.accuracy += sessionAccuracy;
        locationAccuracies[locationId]!.count++;
      }
    }

    // Calculate overall accuracy
    const overallAccuracyPercentage = totalProducts > 0 ? 
      ((totalProducts - totalVariances) / totalProducts) * 100 : 100;

    // Find best and worst performing locations
    let bestLocation = { locationId: '', accuracyPercentage: 0 };
    let worstLocation = { locationId: '', accuracyPercentage: 100 };

    for (const [locationId, data] of Object.entries(locationAccuracies)) {
      const avgAccuracy = data.count > 0 ? data.accuracy / data.count : 0;
      
      if (avgAccuracy > bestLocation.accuracyPercentage) {
        bestLocation = { locationId, accuracyPercentage: avgAccuracy };
      }
      
      if (avgAccuracy < worstLocation.accuracyPercentage) {
        worstLocation = { locationId, accuracyPercentage: avgAccuracy };
      }
    }

    const summary: AccuracySummary = {
      totalLocations: Object.keys(locationAccuracies).length,
      totalProducts: totalProducts,
      totalCountSessions: sessions.sessions.length,
      overallAccuracyPercentage,
      totalVariances,
      totalVarianceValue,
      averageVariancePerProduct: totalProducts > 0 ? totalVariances / totalProducts : 0,
      bestPerformingLocation: bestLocation,
      worstPerformingLocation: worstLocation,
    };

    return { summary };
  }

  private async generateDetailedData(
    tenantId: string,
    query: AccuracyReportQueryDto,
    period: { startDate: Date; endDate: Date },
  ): Promise<DetailedAccuracyData> {
    // Get count sessions
    const sessionQuery2: StockCountSessionQueryDto = {
      scheduledDateFrom: period.startDate,
      scheduledDateTo: period.endDate,
      status: 'completed' as const,
      limit: 1000,
    };

    // Only add locationId if it's defined and not undefined
    if (query.locationId !== undefined) {
      sessionQuery2.locationId = query.locationId;
    }

    const sessions = await this.cycleCountRepository.findSessions(tenantId, sessionQuery2);

    // Get all count items for variance analysis
    const allCountItems: any[] = [];
    for (const session of sessions.sessions) {
      const items = await this.cycleCountRepository.findCountItems(tenantId, {
        sessionId: session.id,
        limit: 10000,
      });
      allCountItems.push(...items.items);
    }

    // Calculate location accuracy
    const locationAccuracies = await this.calculateLocationAccuracies(tenantId, sessions.sessions, allCountItems);

    // Calculate product accuracy
    const productAccuracies = await this.calculateProductAccuracies(tenantId, allCountItems, period);

    // Calculate count session accuracy
    const countSessionAccuracies = await this.calculateCountSessionAccuracies(sessions.sessions, allCountItems);

    // Perform variance analysis
    const varianceAnalysis = await this.performVarianceAnalysis(allCountItems);

    return {
      locations: locationAccuracies,
      products: productAccuracies,
      countSessions: countSessionAccuracies,
      varianceAnalysis,
    };
  }

  private async generateTrendsData(
    tenantId: string,
    query: AccuracyReportQueryDto,
    period: { startDate: Date; endDate: Date },
  ): Promise<AccuracyTrendsData> {
    // Get extended period for trend analysis (6 months)
    const extendedStartDate = new Date(period.startDate.getTime() - 180 * 24 * 60 * 60 * 1000);

    const sessionQuery: StockCountSessionQueryDto = {
      scheduledDateFrom: extendedStartDate,
      scheduledDateTo: period.endDate,
      status: 'completed',
      limit: 2000,
    };

    // Only add locationId if it's defined and not undefined
    if (query.locationId !== undefined) {
      sessionQuery.locationId = query.locationId;
    }

    const sessions = await this.cycleCountRepository.findSessions(tenantId, sessionQuery);

    // Group sessions by time periods
    const monthlyData: { [month: string]: { sessions: any[]; totalItems: number; totalVariances: number; totalValue: number } } = {};
    const weeklyData: { [week: string]: { sessions: any[]; totalItems: number; totalVariances: number } } = {};
    const dailyData: { [date: string]: { sessions: any[]; varianceCount: number } } = {};

    for (const session of sessions.sessions) {
      const date = new Date(session.completedAt || session.scheduledDate || new Date());
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const weekKey = this.getWeekKey(date);
      const dateKey = date.toISOString().split('T')[0];

      const totalItemsCounted = session.totalItemsCounted ?? 0;
      const totalVariances = session.totalVariances ?? 0;
      const totalAdjustmentValue = session.totalAdjustmentValue ?? 0;

      // Monthly - ensure monthKey is valid
      if (monthKey) {
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { sessions: [], totalItems: 0, totalVariances: 0, totalValue: 0 };
        }
        monthlyData[monthKey]!.sessions.push(session);
        monthlyData[monthKey]!.totalItems += totalItemsCounted;
        monthlyData[monthKey]!.totalVariances += totalVariances;
        monthlyData[monthKey]!.totalValue += totalAdjustmentValue;
      }

      // Weekly - ensure weekKey is valid
      if (weekKey) {
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { sessions: [], totalItems: 0, totalVariances: 0 };
        }
        weeklyData[weekKey]!.sessions.push(session);
        weeklyData[weekKey]!.totalItems += totalItemsCounted;
        weeklyData[weekKey]!.totalVariances += totalVariances;
      }

      // Daily - ensure dateKey is valid
      if (dateKey) {
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { sessions: [], varianceCount: 0 };
        }
        dailyData[dateKey]!.sessions.push(session);
        dailyData[dateKey]!.varianceCount += totalVariances;
      }
    }

    // Calculate trends
    const monthlyTrends = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      accuracyPercentage: data.totalItems > 0 ? ((data.totalItems - data.totalVariances) / data.totalItems) * 100 : 100,
      totalCounts: data.sessions.length,
      totalVariances: data.totalVariances,
      totalVarianceValue: data.totalValue,
    })).sort((a, b) => a.month.localeCompare(b.month));

    const weeklyTrends = Object.entries(weeklyData).map(([week, data]) => ({
      week,
      accuracyPercentage: data.totalItems > 0 ? ((data.totalItems - data.totalVariances) / data.totalItems) * 100 : 100,
      totalCounts: data.sessions.length,
      totalVariances: data.totalVariances,
    })).sort((a, b) => a.week.localeCompare(b.week));

    const dailyTrends = Object.entries(dailyData).map(([date, data]) => ({
      date,
      accuracyPercentage: data.sessions.length > 0 ? 
        data.sessions.reduce((sum, s) => sum + (s.totalItemsCounted > 0 ? ((s.totalItemsCounted - s.totalVariances) / s.totalItemsCounted) * 100 : 100), 0) / data.sessions.length : 100,
      countSessions: data.sessions.length,
      varianceCount: data.varianceCount,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Simple seasonal analysis
    const seasonalPatterns = this.calculateSeasonalPatterns(monthlyTrends);

    // Basic forecasting (simple linear trend)
    const forecastedAccuracy = this.forecastAccuracy(monthlyTrends);

    return {
      monthlyTrends,
      weeklyTrends,
      dailyTrends,
      seasonalPatterns,
      forecastedAccuracy,
    };
  }

  private async generateComparativeData(
    tenantId: string,
    query: AccuracyReportQueryDto,
    period: { startDate: Date; endDate: Date },
  ): Promise<ComparativeAccuracyData> {
    // Get current period data
    const currentSessionQuery: StockCountSessionQueryDto = {
      scheduledDateFrom: period.startDate,
      scheduledDateTo: period.endDate,
      status: 'completed',
      limit: 1000,
    };

    // Only add locationId if it's defined and not undefined
    if (query.locationId !== undefined) {
      currentSessionQuery.locationId = query.locationId;
    }

    const currentSessions = await this.cycleCountRepository.findSessions(tenantId, currentSessionQuery);

    // Get previous period data (same duration)
    const periodDuration = period.endDate.getTime() - period.startDate.getTime();
    const previousPeriodEnd = period.startDate;
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDuration);

    const previousSessionQuery: StockCountSessionQueryDto = {
      scheduledDateFrom: previousPeriodStart,
      scheduledDateTo: previousPeriodEnd,
      status: 'completed',
      limit: 1000,
    };

    // Only add locationId if it's defined and not undefined
    if (query.locationId !== undefined) {
      previousSessionQuery.locationId = query.locationId;
    }

    const previousSessions = await this.cycleCountRepository.findSessions(tenantId, previousSessionQuery);

    // Calculate location comparisons
    const locationComparison = await this.calculateLocationComparisons(
      currentSessions.sessions,
      previousSessions.sessions,
    );

    // Calculate product comparisons (simplified)
    const productComparison = await this.calculateProductComparisons(
      tenantId,
      currentSessions.sessions,
      previousSessions.sessions,
    );

    // Industry benchmarks (would typically come from external data)
    const benchmarks = {
      industryAverage: 92.5,
      bestInClass: 98.5,
      companyTarget: 95.0,
      currentPerformance: locationComparison.length > 0 ? 
        locationComparison.reduce((sum, loc) => sum + loc.currentAccuracy, 0) / locationComparison.length : 0,
      gap: 0,
    };
    benchmarks.gap = benchmarks.companyTarget - benchmarks.currentPerformance;

    return {
      locationComparison,
      productComparison,
      benchmarks,
    };
  }

  private async calculateLocationAccuracies(
    tenantId: string,
    sessions: any[],
    countItems: any[],
  ): Promise<LocationAccuracy[]> {
    const locationData: { [locationId: string]: any } = {};

    // Group sessions by location
    for (const session of sessions) {
      if (!locationData[session.locationId]) {
        locationData[session.locationId] = {
          locationId: session.locationId,
          sessions: [],
          totalProducts: 0,
          countedProducts: 0,
          productsWithVariances: 0,
          totalVariances: 0,
          totalVarianceValue: 0,
          lastCountDate: new Date(0),
        };
      }

      const data = locationData[session.locationId];
      data.sessions.push(session);
      data.totalProducts += session.totalItemsCounted;
      data.countedProducts += session.totalItemsCounted;
      data.productsWithVariances += session.totalVariances;
      data.totalVariances += session.totalVariances;
      data.totalVarianceValue += session.totalAdjustmentValue;

      if (session.completedAt > data.lastCountDate) {
        data.lastCountDate = session.completedAt;
      }
    }

    // Calculate metrics for each location
    return Object.values(locationData).map((data: any) => {
      const accuracyPercentage = data.totalProducts > 0 ? 
        ((data.totalProducts - data.productsWithVariances) / data.totalProducts) * 100 : 100;

      const countFrequency = data.sessions.length; // Simplified - would calculate per month
      const averageVarianceSize = data.totalVariances > 0 ? data.totalVarianceValue / data.totalVariances : 0;

      // Calculate top variance reasons (simplified)
      const topVarianceReasons = [
        { reason: 'cycle_count', count: Math.floor(data.totalVariances * 0.4), value: data.totalVarianceValue * 0.4 },
        { reason: 'manual_count', count: Math.floor(data.totalVariances * 0.3), value: data.totalVarianceValue * 0.3 },
        { reason: 'system_error', count: Math.floor(data.totalVariances * 0.2), value: data.totalVarianceValue * 0.2 },
      ];

      return {
        locationId: data.locationId,
        totalProducts: data.totalProducts,
        countedProducts: data.countedProducts,
        productsWithVariances: data.productsWithVariances,
        accuracyPercentage,
        totalVariances: data.totalVariances,
        totalVarianceValue: data.totalVarianceValue,
        lastCountDate: data.lastCountDate,
        countFrequency,
        averageVarianceSize,
        topVarianceReasons,
      };
    });
  }

  private async calculateProductAccuracies(
    tenantId: string,
    countItems: any[],
    period: { startDate: Date; endDate: Date },
  ): Promise<ProductAccuracy[]> {
    const productData: { [productId: string]: any } = {};

    for (const item of countItems) {
      if (!productData[item.productId]) {
        productData[item.productId] = {
          productId: item.productId,
          productName: item.product?.name || 'Unknown',
          sku: item.product?.sku || '',
          totalCounts: 0,
          countsWithVariances: 0,
          totalVariance: 0,
          totalVarianceValue: 0,
          lastCountDate: new Date(0),
          variances: [],
        };
      }

      const data = productData[item.productId];
      data.totalCounts++;

      if (item.variance && Math.abs(item.variance) > 0.001) {
        data.countsWithVariances++;
        data.totalVariance += Math.abs(item.variance);
        data.totalVarianceValue += Math.abs(item.variance * (item.product?.averageCost || 0));
        data.variances.push(item.variance);
      }

      if (item.countedAt > data.lastCountDate) {
        data.lastCountDate = item.countedAt;
      }
    }

    return Object.values(productData).map((data: any) => {
      const accuracyPercentage = data.totalCounts > 0 ? 
        ((data.totalCounts - data.countsWithVariances) / data.totalCounts) * 100 : 100;

      const averageVarianceSize = data.countsWithVariances > 0 ? 
        data.totalVariance / data.countsWithVariances : 0;

      // Simple trend analysis
      const recentVariances = data.variances.slice(-5); // Last 5 counts
      const olderVariances = data.variances.slice(0, -5);
      const recentAvg = recentVariances.length > 0 ? 
        recentVariances.reduce((sum: number, v: number) => sum + Math.abs(v), 0) / recentVariances.length : 0;
      const olderAvg = olderVariances.length > 0 ? 
        olderVariances.reduce((sum: number, v: number) => sum + Math.abs(v), 0) / olderVariances.length : 0;

      let varianceTrend: 'improving' | 'stable' | 'worsening' = 'stable';
      if (recentAvg < olderAvg * 0.8) varianceTrend = 'improving';
      else if (recentAvg > olderAvg * 1.2) varianceTrend = 'worsening';

      // Risk level based on accuracy and variance frequency
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (accuracyPercentage < 90 || data.countsWithVariances > data.totalCounts * 0.3) riskLevel = 'high';
      else if (accuracyPercentage < 95 || data.countsWithVariances > data.totalCounts * 0.1) riskLevel = 'medium';

      return {
        productId: data.productId,
        productName: data.productName,
        sku: data.sku,
        totalCounts: data.totalCounts,
        countsWithVariances: data.countsWithVariances,
        accuracyPercentage,
        totalVariance: data.totalVariance,
        totalVarianceValue: data.totalVarianceValue,
        averageVarianceSize,
        lastCountDate: data.lastCountDate,
        varianceTrend,
        riskLevel,
      };
    });
  }

  private async calculateCountSessionAccuracies(
    sessions: any[],
    allCountItems: any[],
  ): Promise<CountSessionAccuracy[]> {
    return sessions.map(session => {
      const sessionItems = allCountItems.filter(item => item.sessionId === session.id);
      const itemsWithVariances = sessionItems.filter(item => 
        item.variance && Math.abs(item.variance) > 0.001
      ).length;

      const totalItemsCounted = session.totalItemsCounted ?? 0;
      const accuracyPercentage = totalItemsCounted > 0 ? 
        ((totalItemsCounted - itemsWithVariances) / totalItemsCounted) * 100 : 100;

      // Calculate count duration
      const countDuration = session.startedAt && session.completedAt ? 
        (session.completedAt.getTime() - session.startedAt.getTime()) / (1000 * 60 * 60) : undefined;

      // Get unique counters
      const countersInvolved = [...new Set(sessionItems
        .filter(item => item.countedBy)
        .map(item => item.countedBy)
      )];

      // Calculate completion rate
      const completionRate = totalItemsCounted > 0 ? 
        (sessionItems.filter(item => item.status === 'counted' || item.status === 'adjusted').length / totalItemsCounted) * 100 : 0;

      const result: CountSessionAccuracy = {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        locationId: session.locationId,
        countDate: session.completedAt || session.scheduledDate,
        totalItems: totalItemsCounted,
        itemsWithVariances,
        accuracyPercentage,
        totalVarianceValue: session.totalAdjustmentValue ?? 0,
        countersInvolved,
        completionRate,
      };

      // Only add countDuration if it's defined
      if (countDuration !== undefined) {
        result.countDuration = countDuration;
      }

      return result;
    });
  }

  private async performVarianceAnalysis(countItems: any[]): Promise<VarianceAnalysis> {
    const varianceItems = countItems.filter(item => item.variance && Math.abs(item.variance) > 0.001);

    // By reason
    const reasonCounts: { [reason: string]: { count: number; totalValue: number } } = {};
    const magnitudeCounts: { [range: string]: { count: number; totalValue: number } } = {};
    const productCounts: { [productId: string]: { count: number; totalVariance: number; productName: string } } = {};
    const userCounts: { [userId: string]: { counts: number; variances: number } } = {};

    for (const item of varianceItems) {
      // By reason (would come from adjustment records)
      const reason = 'cycle_count'; // Simplified
      if (!reasonCounts[reason]) {
        reasonCounts[reason] = { count: 0, totalValue: 0 };
      }
      reasonCounts[reason].count++;
      reasonCounts[reason].totalValue += Math.abs(item.variance * (item.product?.averageCost || 0));

      // By magnitude
      const absVariance = Math.abs(item.variance);
      let range: string;
      if (absVariance <= 1) range = '0-1';
      else if (absVariance <= 5) range = '1-5';
      else if (absVariance <= 10) range = '5-10';
      else if (absVariance <= 50) range = '10-50';
      else range = '50+';

      if (!magnitudeCounts[range]) {
        magnitudeCounts[range] = { count: 0, totalValue: 0 };
      }
      magnitudeCounts[range]!.count++;
      magnitudeCounts[range]!.totalValue += Math.abs(item.variance * (item.product?.averageCost || 0));

      // By product
      if (!productCounts[item.productId]) {
        productCounts[item.productId] = {
          count: 0,
          totalVariance: 0,
          productName: item.product?.name || 'Unknown',
        };
      }
      productCounts[item.productId]!.count++;
      productCounts[item.productId]!.totalVariance += Math.abs(item.variance);

      // By user
      if (item.countedBy) {
        if (!userCounts[item.countedBy]) {
          userCounts[item.countedBy] = { counts: 0, variances: 0 };
        }
        userCounts[item.countedBy]!.variances++;
      }
    }

    // Count total counts per user
    for (const item of countItems) {
      if (item.countedBy) {
        if (!userCounts[item.countedBy]) {
          userCounts[item.countedBy] = { counts: 0, variances: 0 };
        }
        userCounts[item.countedBy]!.counts++;
      }
    }

    const totalVariances = varianceItems.length;

    return {
      byReason: Object.entries(reasonCounts).map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: totalVariances > 0 ? (data.count / totalVariances) * 100 : 0,
        totalValue: data.totalValue,
        averageValue: data.count > 0 ? data.totalValue / data.count : 0,
      })),
      byMagnitude: Object.entries(magnitudeCounts).map(([range, data]) => ({
        range,
        count: data.count,
        percentage: totalVariances > 0 ? (data.count / totalVariances) * 100 : 0,
        totalValue: data.totalValue,
      })),
      byProduct: Object.entries(productCounts)
        .map(([productId, data]) => ({
          productId,
          productName: data.productName,
          varianceCount: data.count,
          totalVariance: data.totalVariance,
          riskScore: data.count * (data.totalVariance / data.count), // Simple risk calculation
        }))
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 20), // Top 20 risky products
      byUser: Object.entries(userCounts).map(([userId, data]) => ({
        userId,
        countsPerformed: data.counts,
        variancesFound: data.variances,
        accuracyRate: data.counts > 0 ? ((data.counts - data.variances) / data.counts) * 100 : 100,
      })),
    };
  }

  private calculateSeasonalPatterns(monthlyTrends: any[]): any[] {
    // Simple seasonal grouping
    const seasons = {
      'Q1': monthlyTrends.filter(m => ['01', '02', '03'].includes(m.month.split('-')[1])),
      'Q2': monthlyTrends.filter(m => ['04', '05', '06'].includes(m.month.split('-')[1])),
      'Q3': monthlyTrends.filter(m => ['07', '08', '09'].includes(m.month.split('-')[1])),
      'Q4': monthlyTrends.filter(m => ['10', '11', '12'].includes(m.month.split('-')[1])),
    };

    return Object.entries(seasons).map(([season, data]) => {
      const avgAccuracy = data.length > 0 ? 
        data.reduce((sum, d) => sum + d.accuracyPercentage, 0) / data.length : 0;
      
      const accuracies = data.map(d => d.accuracyPercentage);
      const mean = avgAccuracy;
      const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
      const volatility = Math.sqrt(variance);

      return {
        season,
        averageAccuracy: avgAccuracy,
        varianceVolatility: volatility,
      };
    });
  }

  private forecastAccuracy(monthlyTrends: any[]): any {
    if (monthlyTrends.length < 3) {
      return {
        nextMonth: 95, // Default
        confidence: 0.5,
        factors: ['Insufficient historical data'],
      };
    }

    // Simple linear trend
    const recentTrends = monthlyTrends.slice(-6); // Last 6 months
    const avgAccuracy = recentTrends.reduce((sum, t) => sum + t.accuracyPercentage, 0) / recentTrends.length;
    
    // Calculate trend slope
    const x = recentTrends.map((_, i) => i);
    const y = recentTrends.map(t => t.accuracyPercentage);
    const n = recentTrends.length;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const nextMonth = avgAccuracy + slope;

    return {
      nextMonth: Math.max(0, Math.min(100, nextMonth)),
      confidence: 0.7, // Simplified confidence
      factors: [
        slope > 0 ? 'Improving trend' : slope < 0 ? 'Declining trend' : 'Stable trend',
        'Based on 6-month historical data',
      ],
    };
  }

  private async calculateLocationComparisons(
    currentSessions: any[],
    previousSessions: any[],
  ): Promise<any[]> {
    const locationData: { [locationId: string]: any } = {};

    // Process current sessions
    for (const session of currentSessions) {
      const locationId = session.locationId;
      if (locationId) {
        if (!locationData[locationId]) {
          locationData[locationId] = {
            locationId: locationId,
            currentAccuracy: 0,
            currentCount: 0,
            previousAccuracy: 0,
            previousCount: 0,
          };
        }

        const accuracy = session.totalItemsCounted > 0 ? 
          ((session.totalItemsCounted - session.totalVariances) / session.totalItemsCounted) * 100 : 100;
        
        locationData[locationId]!.currentAccuracy += accuracy;
        locationData[locationId]!.currentCount++;
      }
    }

    // Process previous sessions
    for (const session of previousSessions) {
      const locationId = session.locationId;
      if (locationId) {
        if (!locationData[locationId]) {
          locationData[locationId] = {
            locationId: locationId,
            currentAccuracy: 0,
            currentCount: 0,
            previousAccuracy: 0,
            previousCount: 0,
          };
        }

        const accuracy = session.totalItemsCounted > 0 ? 
          ((session.totalItemsCounted - session.totalVariances) / session.totalItemsCounted) * 100 : 100;
        
        locationData[locationId]!.previousAccuracy += accuracy;
        locationData[locationId]!.previousCount++;
      }
    }

    // Calculate averages and comparisons
    const comparisons = Object.values(locationData).map((data: any) => {
      const currentAccuracy = data.currentCount > 0 ? data.currentAccuracy / data.currentCount : 0;
      const previousAccuracy = data.previousCount > 0 ? data.previousAccuracy / data.previousCount : 0;
      const change = currentAccuracy - previousAccuracy;

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (change > 2) trend = 'improving';
      else if (change < -2) trend = 'declining';

      return {
        locationId: data.locationId,
        currentAccuracy,
        previousPeriodAccuracy: previousAccuracy,
        change,
        trend,
        rank: 0, // Will be set after sorting
      };
    });

    // Set ranks
    comparisons.sort((a, b) => b.currentAccuracy - a.currentAccuracy);
    comparisons.forEach((comp, index) => {
      comp.rank = index + 1;
    });

    return comparisons;
  }

  private async calculateProductComparisons(
    tenantId: string,
    currentSessions: any[],
    previousSessions: any[],
  ): Promise<any[]> {
    // Simplified product comparison - would need to get count items for each session
    return []; // Placeholder
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  private async calculateSummaryFromDetailed(data: DetailedAccuracyData): Promise<AccuracySummary> {
    const totalLocations = data.locations.length;
    const totalProducts = data.products.length;
    const totalCountSessions = data.countSessions.length;

    const overallAccuracyPercentage = data.locations.length > 0 ? 
      data.locations.reduce((sum, loc) => sum + loc.accuracyPercentage, 0) / data.locations.length : 100;

    const totalVariances = data.locations.reduce((sum, loc) => sum + loc.totalVariances, 0);
    const totalVarianceValue = data.locations.reduce((sum, loc) => sum + loc.totalVarianceValue, 0);
    const totalProductCount = data.locations.reduce((sum, loc) => sum + loc.totalProducts, 0);

    const bestLocation = data.locations.reduce((best, loc) => 
      loc.accuracyPercentage > best.accuracyPercentage ? loc : best, 
      { locationId: '', accuracyPercentage: 0 }
    );

    const worstLocation = data.locations.reduce((worst, loc) => 
      loc.accuracyPercentage < worst.accuracyPercentage ? loc : worst, 
      { locationId: '', accuracyPercentage: 100 }
    );

    return {
      totalLocations,
      totalProducts,
      totalCountSessions,
      overallAccuracyPercentage,
      totalVariances,
      totalVarianceValue,
      averageVariancePerProduct: totalProductCount > 0 ? totalVariances / totalProductCount : 0,
      bestPerformingLocation: {
        locationId: bestLocation.locationId,
        accuracyPercentage: bestLocation.accuracyPercentage,
      },
      worstPerformingLocation: {
        locationId: worstLocation.locationId,
        accuracyPercentage: worstLocation.accuracyPercentage,
      },
    };
  }

  private async calculateSummaryFromTrends(data: AccuracyTrendsData): Promise<AccuracySummary> {
    const latestMonth = data.monthlyTrends[data.monthlyTrends.length - 1];
    
    return {
      totalLocations: 1, // Simplified
      totalProducts: 0, // Would need additional data
      totalCountSessions: latestMonth?.totalCounts || 0,
      overallAccuracyPercentage: latestMonth?.accuracyPercentage || 0,
      totalVariances: latestMonth?.totalVariances || 0,
      totalVarianceValue: latestMonth?.totalVarianceValue || 0,
      averageVariancePerProduct: 0, // Would need additional calculation
      bestPerformingLocation: { locationId: '', accuracyPercentage: 0 },
      worstPerformingLocation: { locationId: '', accuracyPercentage: 0 },
    };
  }

  private async calculateSummaryFromComparative(data: ComparativeAccuracyData): Promise<AccuracySummary> {
    const avgCurrentAccuracy = data.locationComparison.length > 0 ? 
      data.locationComparison.reduce((sum, loc) => sum + loc.currentAccuracy, 0) / data.locationComparison.length : 0;

    const bestLocation = data.locationComparison.reduce((best, loc) => 
      loc.currentAccuracy > best.currentAccuracy ? loc : best, 
      { locationId: '', currentAccuracy: 0 }
    );

    const worstLocation = data.locationComparison.reduce((worst, loc) => 
      loc.currentAccuracy < worst.currentAccuracy ? loc : worst, 
      { locationId: '', currentAccuracy: 100 }
    );

    return {
      totalLocations: data.locationComparison.length,
      totalProducts: data.productComparison.length,
      totalCountSessions: 0, // Would need additional data
      overallAccuracyPercentage: avgCurrentAccuracy,
      totalVariances: 0, // Would need additional data
      totalVarianceValue: 0, // Would need additional data
      averageVariancePerProduct: 0, // Would need additional data
      bestPerformingLocation: {
        locationId: bestLocation.locationId,
        accuracyPercentage: bestLocation.currentAccuracy,
      },
      worstPerformingLocation: {
        locationId: worstLocation.locationId,
        accuracyPercentage: worstLocation.currentAccuracy,
      },
    };
  }
}