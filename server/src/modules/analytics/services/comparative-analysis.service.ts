import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';
import { DataWarehouseService } from './data-warehouse.service';

export interface PeriodComparison {
  id: string;
  name: string;
  tenantId: string;
  configuration: {
    metric: string;
    currentPeriod: {
      startDate: Date;
      endDate: Date;
      label: string;
    };
    comparisonPeriod: {
      startDate: Date;
      endDate: Date;
      label: string;
    };
    dimensions: string[]; // Fields to group by
    filters: Record<string, any>;
  };
  results: {
    currentValue: number;
    comparisonValue: number;
    absoluteChange: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
    significance: 'high' | 'medium' | 'low';
    breakdown: Array<{
      dimension: string;
      currentValue: number;
      comparisonValue: number;
      change: number;
      changePercent: number;
    }>;
  };
  metadata: {
    lastCalculated: Date;
    executionTime: number;
    dataPoints: number;
  };
}

export interface LocationBenchmark {
  id: string;
  tenantId: string;
  configuration: {
    metric: string;
    timeRange: {
      startDate: Date;
      endDate: Date;
    };
    locations: string[]; // Location IDs to compare
    benchmarkType: 'performance' | 'efficiency' | 'growth' | 'custom';
    normalizationMethod: 'per_employee' | 'per_sqft' | 'per_customer' | 'absolute';
  };
  results: {
    rankings: Array<{
      locationId: string;
      locationName: string;
      value: number;
      normalizedValue: number;
      rank: number;
      percentile: number;
      variance: number;
    }>;
    statistics: {
      average: number;
      median: number;
      standardDeviation: number;
      min: number;
      max: number;
      range: number;
    };
    insights: Array<{
      type: 'top_performer' | 'underperformer' | 'outlier' | 'trend';
      locationId: string;
      message: string;
      severity: 'info' | 'warning' | 'critical';
    }>;
  };
  metadata: {
    lastCalculated: Date;
    executionTime: number;
    locationsAnalyzed: number;
  };
}

export interface IndustryBenchmark {
  id: string;
  tenantId: string;
  configuration: {
    industry: string;
    businessSize: 'micro' | 'small' | 'medium' | 'large';
    metrics: string[];
    timeRange: {
      startDate: Date;
      endDate: Date;
    };
    region?: string;
  };
  results: {
    comparisons: Array<{
      metric: string;
      tenantValue: number;
      industryAverage: number;
      industryMedian: number;
      percentile: number;
      performance: 'above_average' | 'average' | 'below_average';
      gap: number;
      gapPercent: number;
    }>;
    overallScore: {
      score: number; // 0-100
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    };
    industryInsights: {
      trends: Array<{
        metric: string;
        direction: 'increasing' | 'decreasing' | 'stable';
        rate: number;
        description: string;
      }>;
      benchmarks: Array<{
        metric: string;
        topQuartile: number;
        median: number;
        bottomQuartile: number;
      }>;
    };
  };
  metadata: {
    lastUpdated: Date;
    dataSource: string;
    sampleSize: number;
    confidence: number;
  };
}

export interface TrendAnalysis {
  id: string;
  tenantId: string;
  configuration: {
    metric: string;
    timeRange: {
      startDate: Date;
      endDate: Date;
    };
    granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    dimensions: string[];
    seasonalityDetection: boolean;
    anomalyDetection: boolean;
  };
  results: {
    timeSeries: Array<{
      period: Date;
      value: number;
      trend: number;
      seasonal: number;
      residual: number;
      anomaly?: boolean;
      confidence: number;
    }>;
    trendAnalysis: {
      direction: 'increasing' | 'decreasing' | 'stable';
      strength: 'strong' | 'moderate' | 'weak';
      rate: number; // Change per period
      acceleration: number; // Change in rate
      r2: number; // Goodness of fit
    };
    seasonality: {
      detected: boolean;
      pattern: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'none';
      strength: number; // 0-1
      peaks: Date[];
      troughs: Date[];
    };
    anomalies: Array<{
      date: Date;
      value: number;
      expectedValue: number;
      deviation: number;
      severity: 'low' | 'medium' | 'high';
      type: 'spike' | 'dip' | 'shift';
    }>;
    forecasting: {
      nextPeriods: Array<{
        period: Date;
        predicted: number;
        upperBound: number;
        lowerBound: number;
        confidence: number;
      }>;
      accuracy: number;
      model: string;
    };
  };
  metadata: {
    lastCalculated: Date;
    executionTime: number;
    dataPoints: number;
    modelVersion: string;
  };
}

export interface ComparativeReport {
  id: string;
  name: string;
  description: string;
  tenantId: string;
  createdBy: string;
  type: 'period_comparison' | 'location_benchmark' | 'industry_benchmark' | 'trend_analysis' | 'custom';
  configuration: {
    analyses: string[]; // IDs of comparative analyses to include
    layout: 'summary' | 'detailed' | 'executive';
    visualizations: Array<{
      type: 'chart' | 'table' | 'scorecard' | 'heatmap';
      analysisId: string;
      position: number;
      styling: Record<string, any>;
    }>;
    filters: Record<string, any>;
  };
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    recipients: string[];
    format: 'pdf' | 'excel' | 'email';
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ComparativeAnalysisService {
  private readonly logger = new Logger(ComparativeAnalysisService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly dataWarehouseService: DataWarehouseService,
  ) {}

  /**
   * Create period-over-period comparison
   */
  async createPeriodComparison(
    tenantId: string,
    userId: string,
    config: {
      name: string;
      metric: string;
      currentPeriod: { startDate: Date; endDate: Date; label: string };
      comparisonPeriod: { startDate: Date; endDate: Date; label: string };
      dimensions?: string[];
      filters?: Record<string, any>;
    }
  ): Promise<PeriodComparison> {
    try {
      this.logger.log(`Creating period comparison for metric ${config.metric} in tenant ${tenantId}`);

      const comparison: PeriodComparison = {
        id: `period_comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: config.name,
        tenantId,
        configuration: {
          metric: config.metric,
          currentPeriod: config.currentPeriod,
          comparisonPeriod: config.comparisonPeriod,
          dimensions: config.dimensions || [],
          filters: config.filters || {},
        },
        results: {
          currentValue: 0,
          comparisonValue: 0,
          absoluteChange: 0,
          percentageChange: 0,
          trend: 'stable',
          significance: 'low',
          breakdown: [],
        },
        metadata: {
          lastCalculated: new Date(),
          executionTime: 0,
          dataPoints: 0,
        },
      };

      // Calculate comparison results
      await this.calculatePeriodComparison(comparison);

      // Store comparison
      await this.storePeriodComparison(comparison);

      // Cache results
      const cacheKey = `period-comparison:${tenantId}:${comparison.id}`;
      await this.cacheService.set(cacheKey, comparison, { ttl: 3600 }); // Cache for 1 hour

      return comparison;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to create period comparison: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create location benchmarking analysis
   */
  async createLocationBenchmark(
    tenantId: string,
    userId: string,
    config: {
      metric: string;
      timeRange: { startDate: Date; endDate: Date };
      locations: string[];
      benchmarkType: 'performance' | 'efficiency' | 'growth' | 'custom';
      normalizationMethod: 'per_employee' | 'per_sqft' | 'per_customer' | 'absolute';
    }
  ): Promise<LocationBenchmark> {
    try {
      this.logger.log(`Creating location benchmark for ${config.locations.length} locations in tenant ${tenantId}`);

      const benchmark: LocationBenchmark = {
        id: `location_bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        configuration: config,
        results: {
          rankings: [],
          statistics: {
            average: 0,
            median: 0,
            standardDeviation: 0,
            min: 0,
            max: 0,
            range: 0,
          },
          insights: [],
        },
        metadata: {
          lastCalculated: new Date(),
          executionTime: 0,
          locationsAnalyzed: config.locations.length,
        },
      };

      // Calculate benchmark results
      await this.calculateLocationBenchmark(benchmark);

      // Store benchmark
      await this.storeLocationBenchmark(benchmark);

      // Cache results
      const cacheKey = `location-benchmark:${tenantId}:${benchmark.id}`;
      await this.cacheService.set(cacheKey, benchmark, { ttl: 1800 }); // Cache for 30 minutes

      return benchmark;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to create location benchmark: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create industry benchmarking analysis
   */
  async createIndustryBenchmark(
    tenantId: string,
    userId: string,
    config: {
      industry: string;
      businessSize: 'micro' | 'small' | 'medium' | 'large';
      metrics: string[];
      timeRange: { startDate: Date; endDate: Date };
      region?: string;
    }
  ): Promise<IndustryBenchmark> {
    try {
      this.logger.log(`Creating industry benchmark for ${config.industry} industry in tenant ${tenantId}`);

      const benchmark: IndustryBenchmark = {
        id: `industry_bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        configuration: config,
        results: {
          comparisons: [],
          overallScore: {
            score: 0,
            grade: 'C',
            strengths: [],
            weaknesses: [],
            recommendations: [],
          },
          industryInsights: {
            trends: [],
            benchmarks: [],
          },
        },
        metadata: {
          lastUpdated: new Date(),
          dataSource: 'industry_data_provider',
          sampleSize: 0,
          confidence: 0.95,
        },
      };

      // Calculate industry benchmark results
      await this.calculateIndustryBenchmark(benchmark);

      // Store benchmark
      await this.storeIndustryBenchmark(benchmark);

      // Cache results
      const cacheKey = `industry-benchmark:${tenantId}:${benchmark.id}`;
      await this.cacheService.set(cacheKey, benchmark, { ttl: 7200 }); // Cache for 2 hours

      return benchmark;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to create industry benchmark: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create trend analysis
   */
  async createTrendAnalysis(
    tenantId: string,
    userId: string,
    config: {
      metric: string;
      timeRange: { startDate: Date; endDate: Date };
      granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      dimensions?: string[];
      seasonalityDetection?: boolean;
      anomalyDetection?: boolean;
    }
  ): Promise<TrendAnalysis> {
    try {
      this.logger.log(`Creating trend analysis for metric ${config.metric} in tenant ${tenantId}`);

      const analysis: TrendAnalysis = {
        id: `trend_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        configuration: {
          ...config,
          dimensions: config.dimensions || [],
          seasonalityDetection: config.seasonalityDetection !== false,
          anomalyDetection: config.anomalyDetection !== false,
        },
        results: {
          timeSeries: [],
          trendAnalysis: {
            direction: 'stable',
            strength: 'weak',
            rate: 0,
            acceleration: 0,
            r2: 0,
          },
          seasonality: {
            detected: false,
            pattern: 'none',
            strength: 0,
            peaks: [],
            troughs: [],
          },
          anomalies: [],
          forecasting: {
            nextPeriods: [],
            accuracy: 0,
            model: 'linear_regression',
          },
        },
        metadata: {
          lastCalculated: new Date(),
          executionTime: 0,
          dataPoints: 0,
          modelVersion: '1.0',
        },
      };

      // Calculate trend analysis results
      await this.calculateTrendAnalysis(analysis);

      // Store analysis
      await this.storeTrendAnalysis(analysis);

      // Cache results
      const cacheKey = `trend-analysis:${tenantId}:${analysis.id}`;
      await this.cacheService.set(cacheKey, analysis, { ttl: 1800 }); // Cache for 30 minutes

      return analysis;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to create trend analysis: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get comparative analysis by ID
   */
  async getComparativeAnalysis(
    tenantId: string,
    analysisId: string,
    type: 'period_comparison' | 'location_benchmark' | 'industry_benchmark' | 'trend_analysis'
  ): Promise<PeriodComparison | LocationBenchmark | IndustryBenchmark | TrendAnalysis | null> {
    try {
      const cacheKey = `${type.replace('_', '-')}:${tenantId}:${analysisId}`;
      let analysis = await this.cacheService.get<any>(cacheKey);

      if (!analysis) {
        switch (type) {
          case 'period_comparison':
            analysis = await this.loadPeriodComparison(tenantId, analysisId);
            break;
          case 'location_benchmark':
            analysis = await this.loadLocationBenchmark(tenantId, analysisId);
            break;
          case 'industry_benchmark':
            analysis = await this.loadIndustryBenchmark(tenantId, analysisId);
            break;
          case 'trend_analysis':
            analysis = await this.loadTrendAnalysis(tenantId, analysisId);
            break;
        }

        if (analysis) {
          await this.cacheService.set(cacheKey, analysis, { ttl: 1800 });
        }
      }

      return analysis;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to get comparative analysis: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List comparative analyses for tenant
   */
  async listComparativeAnalyses(
    tenantId: string,
    options: {
      type?: 'period_comparison' | 'location_benchmark' | 'industry_benchmark' | 'trend_analysis';
      limit?: number;
      offset?: number;
      sortBy?: 'created' | 'updated' | 'name';
      sortOrder?: 'asc' | 'desc';
    } = {}
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
    try {
      const cacheKey = `comparative-analyses:${tenantId}:${JSON.stringify(options)}`;
      let result = await this.cacheService.get<any>(cacheKey);

      if (!result) {
        result = await this.loadComparativeAnalysesList(tenantId, options);
        await this.cacheService.set(cacheKey, result, { ttl: 900 }); // Cache for 15 minutes
      }

      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to list comparative analyses: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate comparative report
   */
  async generateComparativeReport(
    tenantId: string,
    userId: string,
    config: {
      name: string;
      description: string;
      type: 'period_comparison' | 'location_benchmark' | 'industry_benchmark' | 'trend_analysis' | 'custom';
      analyses: string[];
      layout: 'summary' | 'detailed' | 'executive';
      visualizations: Array<{
        type: 'chart' | 'table' | 'scorecard' | 'heatmap';
        analysisId: string;
        position: number;
        styling: Record<string, any>;
      }>;
      filters?: Record<string, any>;
    }
  ): Promise<ComparativeReport> {
    try {
      this.logger.log(`Generating comparative report for tenant ${tenantId}`);

      const report: ComparativeReport = {
        id: `comp_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: config.name,
        description: config.description,
        tenantId,
        createdBy: userId,
        type: config.type,
        configuration: {
          analyses: config.analyses,
          layout: config.layout,
          visualizations: config.visualizations,
          filters: config.filters || {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store report
      await this.storeComparativeReport(report);

      // Generate report content
      await this.queueService.add('generate-comparative-report', {
        reportId: report.id,
        tenantId,
        userId,
      }, {
        priority: 2,
        attempts: 3,
      });

      return report;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to generate comparative report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Private calculation methods
   */

  private async calculatePeriodComparison(comparison: PeriodComparison): Promise<void> {
    const startTime = Date.now();

    try {
      // Get data for current period
      const currentData = await this.getMetricData(
        comparison.tenantId,
        comparison.configuration.metric,
        comparison.configuration.currentPeriod.startDate,
        comparison.configuration.currentPeriod.endDate,
        comparison.configuration.dimensions,
        comparison.configuration.filters
      );

      // Get data for comparison period
      const comparisonData = await this.getMetricData(
        comparison.tenantId,
        comparison.configuration.metric,
        comparison.configuration.comparisonPeriod.startDate,
        comparison.configuration.comparisonPeriod.endDate,
        comparison.configuration.dimensions,
        comparison.configuration.filters
      );

      // Calculate totals
      const currentValue = this.aggregateMetricData(currentData);
      const comparisonValue = this.aggregateMetricData(comparisonData);

      // Calculate changes
      const absoluteChange = currentValue - comparisonValue;
      const percentageChange = comparisonValue !== 0 ? (absoluteChange / comparisonValue) * 100 : 0;

      // Determine trend and significance
      const trend = this.determineTrend(percentageChange);
      const significance = this.determineSignificance(Math.abs(percentageChange));

      // Calculate breakdown by dimensions
      const breakdown = this.calculateDimensionBreakdown(currentData, comparisonData, comparison.configuration.dimensions);

      comparison.results = {
        currentValue,
        comparisonValue,
        absoluteChange,
        percentageChange,
        trend,
        significance,
        breakdown,
      };

      comparison.metadata = {
        lastCalculated: new Date(),
        executionTime: Date.now() - startTime,
        dataPoints: currentData.length + comparisonData.length,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to calculate period comparison: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async calculateLocationBenchmark(benchmark: LocationBenchmark): Promise<void> {
    const startTime = Date.now();

    try {
      const locationData: Array<{
        locationId: string;
        locationName: string;
        value: number;
        normalizedValue: number;
      }> = [];

      // Get data for each location
      for (const locationId of benchmark.configuration.locations) {
        const data = await this.getLocationMetricData(
          benchmark.tenantId,
          locationId,
          benchmark.configuration.metric,
          benchmark.configuration.timeRange.startDate,
          benchmark.configuration.timeRange.endDate
        );

        const value = this.aggregateMetricData(data);
        const normalizedValue = await this.normalizeLocationValue(
          benchmark.tenantId,
          locationId,
          value,
          benchmark.configuration.normalizationMethod
        );

        locationData.push({
          locationId,
          locationName: await this.getLocationName(benchmark.tenantId, locationId),
          value,
          normalizedValue,
        });
      }

      // Sort by normalized value and calculate rankings
      locationData.sort((a, b) => b.normalizedValue - a.normalizedValue);
      
      const rankings = locationData.map((location, index) => ({
        ...location,
        rank: index + 1,
        percentile: ((locationData.length - index) / locationData.length) * 100,
        variance: this.calculateVariance(location.normalizedValue, locationData.map(l => l.normalizedValue)),
      }));

      // Calculate statistics
      const values = locationData.map(l => l.normalizedValue);
      const statistics = {
        average: this.calculateMean(values),
        median: this.calculateMedian(values),
        standardDeviation: this.calculateStandardDeviation(values),
        min: Math.min(...values),
        max: Math.max(...values),
        range: Math.max(...values) - Math.min(...values),
      };

      // Generate insights
      const insights = this.generateLocationInsights(rankings, statistics);

      benchmark.results = {
        rankings,
        statistics,
        insights,
      };

      benchmark.metadata = {
        lastCalculated: new Date(),
        executionTime: Date.now() - startTime,
        locationsAnalyzed: benchmark.configuration.locations.length,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to calculate location benchmark: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async calculateIndustryBenchmark(benchmark: IndustryBenchmark): Promise<void> {
    const startTime = Date.now();

    try {
      const comparisons = [];
      let totalScore = 0;

      // Get tenant data for each metric
      for (const metric of benchmark.configuration.metrics) {
        const tenantData = await this.getMetricData(
          benchmark.tenantId,
          metric,
          benchmark.configuration.timeRange.startDate,
          benchmark.configuration.timeRange.endDate
        );

        const tenantValue = this.aggregateMetricData(tenantData);

        // Get industry benchmarks (mock data for now)
        const industryData = await this.getIndustryBenchmarkData(
          benchmark.configuration.industry,
          benchmark.configuration.businessSize,
          metric,
          benchmark.configuration.region
        );

        const percentile = this.calculatePercentile(tenantValue, industryData.distribution);
        const performance = this.determinePerformance(percentile);
        const gap = tenantValue - industryData.average;
        const gapPercent = industryData.average !== 0 ? (gap / industryData.average) * 100 : 0;

        comparisons.push({
          metric,
          tenantValue,
          industryAverage: industryData.average,
          industryMedian: industryData.median,
          percentile,
          performance,
          gap,
          gapPercent,
        });

        // Add to overall score (weighted by metric importance)
        totalScore += percentile * (industryData.weight || 1);
      }

      // Calculate overall score and grade
      const overallScore = totalScore / benchmark.configuration.metrics.length;
      const grade = this.calculateGrade(overallScore);
      const strengths = comparisons.filter(c => c.performance === 'above_average').map(c => c.metric);
      const weaknesses = comparisons.filter(c => c.performance === 'below_average').map(c => c.metric);
      const recommendations = this.generateIndustryRecommendations(comparisons);

      // Get industry insights
      const industryInsights = await this.getIndustryInsights(
        benchmark.configuration.industry,
        benchmark.configuration.businessSize
      );

      benchmark.results = {
        comparisons,
        overallScore: {
          score: overallScore,
          grade,
          strengths,
          weaknesses,
          recommendations,
        },
        industryInsights,
      };

      benchmark.metadata = {
        lastUpdated: new Date(),
        dataSource: 'industry_data_provider',
        sampleSize: 1000, // Mock sample size
        confidence: 0.95,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to calculate industry benchmark: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async calculateTrendAnalysis(analysis: TrendAnalysis): Promise<void> {
    const startTime = Date.now();

    try {
      // Get time series data
      const timeSeriesData = await this.getTimeSeriesData(
        analysis.tenantId,
        analysis.configuration.metric,
        analysis.configuration.timeRange.startDate,
        analysis.configuration.timeRange.endDate,
        analysis.configuration.granularity,
        analysis.configuration.dimensions
      );

      // Perform trend decomposition
      const decomposition = this.performTrendDecomposition(timeSeriesData);
      
      // Analyze trend
      const trendAnalysis = this.analyzeTrend(decomposition.trend);
      
      // Detect seasonality
      const seasonality = analysis.configuration.seasonalityDetection
        ? this.detectSeasonality(decomposition.seasonal)
        : { detected: false, pattern: 'none' as const, strength: 0, peaks: [], troughs: [] };
      
      // Detect anomalies
      const anomalies = analysis.configuration.anomalyDetection
        ? this.detectAnomalies(timeSeriesData, decomposition)
        : [];
      
      // Generate forecasts
      const forecasting = this.generateForecasts(timeSeriesData, analysis.configuration.granularity);

      analysis.results = {
        timeSeries: decomposition.timeSeries,
        trendAnalysis,
        seasonality,
        anomalies,
        forecasting,
      };

      analysis.metadata = {
        lastCalculated: new Date(),
        executionTime: Date.now() - startTime,
        dataPoints: timeSeriesData.length,
        modelVersion: '1.0',
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to calculate trend analysis: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper methods for calculations
   */

  private async getMetricData(
    tenantId: string,
    metric: string,
    startDate: Date,
    endDate: Date,
    dimensions: string[] = [],
    filters: Record<string, any> = {}
  ): Promise<any[]> {
    // Build query based on metric type
    let query = this.buildMetricQuery(metric, startDate, endDate, dimensions, filters);
    
    const result = await this.dataWarehouseService.executeAnalyticsQuery(
      tenantId,
      query,
      [],
      { useCache: true }
    );

    return result.data;
  }

  private buildMetricQuery(
    metric: string,
    startDate: Date,
    endDate: Date,
    dimensions: string[] = [],
    filters: Record<string, any> = {}
  ): string {
    // This would build appropriate SQL queries based on the metric
    // For now, return a mock query
    const dimensionFields = dimensions.length > 0 ? dimensions.join(', ') + ', ' : '';
    const groupBy = dimensions.length > 0 ? ` GROUP BY ${dimensions.join(', ')}` : '';
    
    let whereClause = `WHERE date >= '${startDate.toISOString()}' AND date <= '${endDate.toISOString()}'`;
    
    // Add filters
    for (const [key, value] of Object.entries(filters)) {
      whereClause += ` AND ${key} = '${value}'`;
    }

    return `
      SELECT 
        ${dimensionFields}
        ${this.getMetricExpression(metric)} as value,
        date
      FROM fact_transactions 
      ${whereClause}
      ${groupBy}
      ORDER BY date
    `;
  }

  private getMetricExpression(metric: string): string {
    switch (metric) {
      case 'revenue':
        return 'SUM(total_amount)';
      case 'transactions':
        return 'COUNT(*)';
      case 'avg_order_value':
        return 'AVG(total_amount)';
      case 'customers':
        return 'COUNT(DISTINCT customer_id)';
      default:
        return 'SUM(total_amount)';
    }
  }

  private aggregateMetricData(data: any[]): number {
    if (data.length === 0) return 0;
    return data.reduce((sum, row) => sum + (row.value || 0), 0);
  }

  private determineTrend(percentageChange: number): 'up' | 'down' | 'stable' {
    if (Math.abs(percentageChange) < 5) return 'stable';
    return percentageChange > 0 ? 'up' : 'down';
  }

  private determineSignificance(absolutePercentageChange: number): 'high' | 'medium' | 'low' {
    if (absolutePercentageChange > 20) return 'high';
    if (absolutePercentageChange > 10) return 'medium';
    return 'low';
  }

  private calculateDimensionBreakdown(
    currentData: any[],
    comparisonData: any[],
    dimensions: string[]
  ): Array<{
    dimension: string;
    currentValue: number;
    comparisonValue: number;
    change: number;
    changePercent: number;
  }> {
    if (dimensions.length === 0) return [];

    const breakdown = [];
    const currentByDimension = this.groupByDimensions(currentData, dimensions);
    const comparisonByDimension = this.groupByDimensions(comparisonData, dimensions);

    for (const dimension of Object.keys(currentByDimension)) {
      const currentData = currentByDimension[dimension];
      const currentValue = this.aggregateMetricData(currentData ?? []);
      const comparisonValue = this.aggregateMetricData(comparisonByDimension[dimension] || []);
      const change = currentValue - comparisonValue;
      const changePercent = comparisonValue !== 0 ? (change / comparisonValue) * 100 : 0;

      breakdown.push({
        dimension,
        currentValue,
        comparisonValue,
        change,
        changePercent,
      });
    }

    return breakdown;
  }

  private groupByDimensions(data: any[], dimensions: string[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const row of data) {
      const key = dimensions.map(dim => row[dim]).join('|');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }
    
    return grouped;
  }

  // Statistical helper methods
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length === 0) return 0;
    return sorted.length % 2 === 0 
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 
      : (sorted[mid] ?? 0);
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateVariance(value: number, allValues: number[]): number {
    const mean = this.calculateMean(allValues);
    return Math.abs(value - mean);
  }

  private calculatePercentile(value: number, distribution: number[]): number {
    const sorted = [...distribution].sort((a, b) => a - b);
    const index = sorted.findIndex(val => val >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  }

  // Mock data methods (would be replaced with real data sources)
  private async getLocationMetricData(
    tenantId: string,
    locationId: string,
    metric: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Mock location-specific data
    return [{ value: Math.random() * 10000 + 1000 }];
  }

  private async normalizeLocationValue(
    tenantId: string,
    locationId: string,
    value: number,
    method: string
  ): Promise<number> {
    // Mock normalization
    switch (method) {
      case 'per_employee':
        return value / (Math.random() * 50 + 10); // Mock employee count
      case 'per_sqft':
        return value / (Math.random() * 5000 + 1000); // Mock square footage
      case 'per_customer':
        return value / (Math.random() * 1000 + 100); // Mock customer count
      default:
        return value;
    }
  }

  private async getLocationName(tenantId: string, locationId: string): Promise<string> {
    return `Location ${locationId.slice(-4)}`;
  }

  private generateLocationInsights(rankings: any[], statistics: any): any[] {
    const insights = [];
    
    // Top performer
    if (rankings.length > 0) {
      insights.push({
        type: 'top_performer',
        locationId: rankings[0].locationId,
        message: `${rankings[0].locationName} is the top performer with ${rankings[0].normalizedValue.toFixed(2)}`,
        severity: 'info',
      });
    }

    // Underperformer
    if (rankings.length > 1) {
      const lastRank = rankings[rankings.length - 1];
      if (lastRank.normalizedValue < statistics.average * 0.7) {
        insights.push({
          type: 'underperformer',
          locationId: lastRank.locationId,
          message: `${lastRank.locationName} is underperforming at ${lastRank.normalizedValue.toFixed(2)}`,
          severity: 'warning',
        });
      }
    }

    return insights;
  }

  // More mock methods for industry benchmarking and trend analysis...
  private async getIndustryBenchmarkData(
    industry: string,
    businessSize: string,
    metric: string,
    region?: string
  ): Promise<{
    average: number;
    median: number;
    distribution: number[];
    weight: number;
  }> {
    // Mock industry data
    return {
      average: Math.random() * 10000 + 5000,
      median: Math.random() * 10000 + 4000,
      distribution: Array.from({ length: 100 }, () => Math.random() * 20000),
      weight: 1,
    };
  }

  private determinePerformance(percentile: number): 'above_average' | 'average' | 'below_average' {
    if (percentile > 60) return 'above_average';
    if (percentile > 40) return 'average';
    return 'below_average';
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateIndustryRecommendations(comparisons: any[]): string[] {
    const recommendations = [];
    
    for (const comparison of comparisons) {
      if (comparison.performance === 'below_average') {
        recommendations.push(`Improve ${comparison.metric} performance - currently ${comparison.gapPercent.toFixed(1)}% below industry average`);
      }
    }

    return recommendations;
  }

  private async getIndustryInsights(industry: string, businessSize: string): Promise<any> {
    // Mock industry insights
    return {
      trends: [
        {
          metric: 'revenue',
          direction: 'increasing',
          rate: 5.2,
          description: 'Industry revenue growing at 5.2% annually',
        },
      ],
      benchmarks: [
        {
          metric: 'revenue',
          topQuartile: 15000,
          median: 10000,
          bottomQuartile: 6000,
        },
      ],
    };
  }

  // Time series analysis methods (simplified implementations)
  private async getTimeSeriesData(
    tenantId: string,
    metric: string,
    startDate: Date,
    endDate: Date,
    granularity: string,
    dimensions: string[]
  ): Promise<Array<{ period: Date; value: number }>> {
    // Mock time series data
    const data = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let current = new Date(start);
    while (current <= end) {
      data.push({
        period: new Date(current),
        value: Math.random() * 1000 + 500 + Math.sin(current.getTime() / (1000 * 60 * 60 * 24 * 7)) * 100,
      });
      
      // Increment based on granularity
      switch (granularity) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'quarterly':
          current.setMonth(current.getMonth() + 3);
          break;
      }
    }
    
    return data;
  }

  private performTrendDecomposition(data: Array<{ period: Date; value: number }>): {
    timeSeries: Array<{
      period: Date;
      value: number;
      trend: number;
      seasonal: number;
      residual: number;
      anomaly?: boolean;
      confidence: number;
    }>;
    trend: number[];
    seasonal: number[];
  } {
    // Simplified trend decomposition
    const values = data.map(d => d.value);
    const trend = this.calculateMovingAverage(values, 7);
    const seasonal = values.map((val, i) => val - (trend[i] || val));
    
    const timeSeries = data.map((d, i) => ({
      period: d.period,
      value: d.value,
      trend: trend[i] || d.value,
      seasonal: seasonal[i] || 0,
      residual: d.value - (trend[i] || d.value) - (seasonal[i] || 0),
      confidence: 0.95,
    }));

    return { timeSeries, trend, seasonal };
  }

  private calculateMovingAverage(values: number[], window: number): number[] {
    const result = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(values.length, i + Math.ceil(window / 2));
      const slice = values.slice(start, end);
      result.push(slice.reduce((sum, val) => sum + val, 0) / slice.length);
    }
    return result;
  }

  private analyzeTrend(trendData: number[]): {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: 'strong' | 'moderate' | 'weak';
    rate: number;
    acceleration: number;
    r2: number;
  } {
    if (trendData.length < 2) {
      return {
        direction: 'stable',
        strength: 'weak',
        rate: 0,
        acceleration: 0,
        r2: 0,
      };
    }

    // Calculate linear regression
    const n = trendData.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = trendData;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * (y[i] ?? 0), 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R²
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, val, i) => sum + Math.pow(val - (slope * i + intercept), 2), 0);
    const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);

    const direction = Math.abs(slope) < 0.1 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing';
    const strength = r2 > 0.7 ? 'strong' : r2 > 0.4 ? 'moderate' : 'weak';

    return {
      direction,
      strength,
      rate: slope,
      acceleration: 0, // Would calculate second derivative
      r2,
    };
  }

  private detectSeasonality(seasonalData: number[]): {
    detected: boolean;
    pattern: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'none';
    strength: number;
    peaks: Date[];
    troughs: Date[];
  } {
    // Simplified seasonality detection
    const variance = this.calculateStandardDeviation(seasonalData);
    const detected = variance > 10; // Threshold for seasonality
    
    return {
      detected,
      pattern: detected ? 'weekly' : 'none',
      strength: detected ? variance / 100 : 0,
      peaks: [],
      troughs: [],
    };
  }

  private detectAnomalies(
    data: Array<{ period: Date; value: number }>,
    decomposition: any
  ): Array<{
    date: Date;
    value: number;
    expectedValue: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high';
    type: 'spike' | 'dip' | 'shift';
  }> {
    // Simplified anomaly detection using z-score
    const values = data.map(d => d.value);
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);
    
    const anomalies: Array<{
      date: Date;
      value: number;
      expectedValue: number;
      deviation: number;
      severity: 'low' | 'medium' | 'high';
      type: 'spike' | 'dip' | 'shift';
    }> = [];
    
    for (let i = 0; i < data.length; i++) {
      const dataPoint = data[i];
      if (!dataPoint) continue;
      const zScore = Math.abs((dataPoint.value - mean) / stdDev);
      
      if (zScore > 2) { // 2 standard deviations
        const severity: 'low' | 'medium' | 'high' = zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low';
        const type: 'spike' | 'dip' | 'shift' = dataPoint.value > mean ? 'spike' : 'dip';
        
        anomalies.push({
          date: dataPoint.period,
          value: dataPoint.value,
          expectedValue: mean,
          deviation: dataPoint.value - mean,
          severity,
          type,
        });
      }
    }
    
    return anomalies;
  }

  private generateForecasts(
    data: Array<{ period: Date; value: number }>,
    granularity: string
  ): {
    nextPeriods: Array<{
      period: Date;
      predicted: number;
      upperBound: number;
      lowerBound: number;
      confidence: number;
    }>;
    accuracy: number;
    model: string;
  } {
    // Simple linear extrapolation for forecasting
    if (!data || data.length === 0) {
      return {
        nextPeriods: [],
        accuracy: 0,
        model: 'linear',
      };
    }
    
    const values = data.map(d => d.value);
    const trend = this.analyzeTrend(values);
    const lastValue = values[values.length - 1] || 0;
    const lastDateObj = data[data.length - 1];
    const lastDate = lastDateObj ? lastDateObj.period : new Date();
    
    const forecasts = [];
    for (let i = 1; i <= 12; i++) { // Forecast next 12 periods
      const nextDate = new Date(lastDate);
      
      switch (granularity) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + i);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + i * 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + i);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + i * 3);
          break;
      }
      
      const predicted = lastValue + trend.rate * i;
      const confidence = Math.max(0.5, 0.95 - i * 0.05); // Decreasing confidence
      const margin = predicted * (1 - confidence) * 0.5;
      
      forecasts.push({
        period: nextDate,
        predicted,
        upperBound: predicted + margin,
        lowerBound: predicted - margin,
        confidence,
      });
    }
    
    return {
      nextPeriods: forecasts,
      accuracy: trend.r2,
      model: 'linear_regression',
    };
  }

  // Database operations (mocked for now)
  private async storePeriodComparison(comparison: PeriodComparison): Promise<void> {
    this.logger.debug(`Storing period comparison: ${comparison.id}`);
  }

  private async loadPeriodComparison(tenantId: string, id: string): Promise<PeriodComparison | null> {
    return null;
  }

  private async storeLocationBenchmark(benchmark: LocationBenchmark): Promise<void> {
    this.logger.debug(`Storing location benchmark: ${benchmark.id}`);
  }

  private async loadLocationBenchmark(tenantId: string, id: string): Promise<LocationBenchmark | null> {
    return null;
  }

  private async storeIndustryBenchmark(benchmark: IndustryBenchmark): Promise<void> {
    this.logger.debug(`Storing industry benchmark: ${benchmark.id}`);
  }

  private async loadIndustryBenchmark(tenantId: string, id: string): Promise<IndustryBenchmark | null> {
    return null;
  }

  private async storeTrendAnalysis(analysis: TrendAnalysis): Promise<void> {
    this.logger.debug(`Storing trend analysis: ${analysis.id}`);
  }

  private async loadTrendAnalysis(tenantId: string, id: string): Promise<TrendAnalysis | null> {
    return null;
  }

  private async storeComparativeReport(report: ComparativeReport): Promise<void> {
    this.logger.debug(`Storing comparative report: ${report.id}`);
  }

  private async loadComparativeAnalysesList(
    tenantId: string,
    options: any
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
    // Mock analyses list
    return {
      analyses: [],
      total: 0,
      hasMore: false,
    };
  }
}