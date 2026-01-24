/**
 * Analytics Utilities
 * Helper functions for analytics data processing and formatting
 */

import type {
  Metric,
  KPI,
  Trend,
  TrendDataPoint,
  ComparisonResult,
  MetricValue,
  ForecastDataPoint,
  TimePeriod,
  MetricCategory,
} from '@/types/analytics';

// ============================================================================
// DATA FORMATTING UTILITIES
// ============================================================================

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Format a number with appropriate units (K, M, B)
 */
export function formatNumber(value: number, decimals = 1): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
}

/**
 * Format a percentage value
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a metric value based on its unit
 */
export function formatMetricValue(metric: Metric): string {
  switch (metric.unit.toLowerCase()) {
    case 'currency':
    case 'usd':
    case 'dollar':
    case 'dollars':
      return formatCurrency(metric.value);
    case 'percentage':
    case 'percent':
    case '%':
      return formatPercentage(metric.value);
    case 'count':
    case 'number':
    default:
      return formatNumber(metric.value);
  }
}

/**
 * Format a date for display
 */
export function formatDate(date: Date, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const options: Intl.DateTimeFormatOptions = {
    short: { month: 'short', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  };

  return new Intl.DateTimeFormat('en-US', options[format]).format(date);
}

/**
 * Format a time period for display
 */
export function formatTimePeriod(period: TimePeriod): string {
  const periodLabels: Record<TimePeriod, string> = {
    [TimePeriod.HOUR]: 'Hour',
    [TimePeriod.DAY]: 'Day',
    [TimePeriod.WEEK]: 'Week',
    [TimePeriod.MONTH]: 'Month',
    [TimePeriod.QUARTER]: 'Quarter',
    [TimePeriod.YEAR]: 'Year',
  };

  return periodLabels[period] || period;
}

// ============================================================================
// DATA PROCESSING UTILITIES
// ============================================================================

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate variance between two values
 */
export function calculateVariance(current: number, comparison: number): number {
  return current - comparison;
}

/**
 * Determine trend direction based on percentage change
 */
export function getTrendDirection(percentageChange: number, threshold = 0.1): 'up' | 'down' | 'stable' {
  if (percentageChange > threshold) return 'up';
  if (percentageChange < -threshold) return 'down';
  return 'stable';
}

/**
 * Get trend color based on direction and context
 */
export function getTrendColor(
  direction: 'up' | 'down' | 'stable',
  isPositiveGood = true
): 'green' | 'red' | 'gray' {
  if (direction === 'stable') return 'gray';
  
  if (isPositiveGood) {
    return direction === 'up' ? 'green' : 'red';
  } else {
    return direction === 'up' ? 'red' : 'green';
  }
}

/**
 * Calculate moving average for trend data
 */
export function calculateMovingAverage(
  dataPoints: TrendDataPoint[],
  windowSize = 7
): TrendDataPoint[] {
  if (dataPoints.length < windowSize) return dataPoints;

  return dataPoints.map((point, index) => {
    if (index < windowSize - 1) return point;

    const window = dataPoints.slice(index - windowSize + 1, index + 1);
    const average = window.reduce((sum, p) => sum + p.value, 0) / windowSize;

    return {
      ...point,
      value: average,
    };
  });
}

/**
 * Smooth trend data using exponential smoothing
 */
export function smoothTrendData(
  dataPoints: TrendDataPoint[],
  alpha = 0.3
): TrendDataPoint[] {
  if (dataPoints.length === 0) return [];

  const smoothed = [dataPoints[0]];

  for (let i = 1; i < dataPoints.length; i++) {
    const smoothedValue = alpha * dataPoints[i].value + (1 - alpha) * smoothed[i - 1].value;
    smoothed.push({
      ...dataPoints[i],
      value: smoothedValue,
    });
  }

  return smoothed;
}

/**
 * Calculate linear regression slope for trend analysis
 */
export function calculateTrendSlope(dataPoints: TrendDataPoint[]): number {
  const n = dataPoints.length;
  if (n < 2) return 0;

  const sumX = dataPoints.reduce((sum, _, i) => sum + i, 0);
  const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
  const sumXY = dataPoints.reduce((sum, point, i) => sum + i * point.value, 0);
  const sumX2 = dataPoints.reduce((sum, _, i) => sum + i * i, 0);

  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

// ============================================================================
// DATA AGGREGATION UTILITIES
// ============================================================================

/**
 * Group metrics by category
 */
export function groupMetricsByCategory(metrics: Metric[]): Record<string, Metric[]> {
  return metrics.reduce((groups, metric) => {
    const category = metric.category || 'OTHER';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(metric);
    return groups;
  }, {} as Record<string, Metric[]>);
}

/**
 * Aggregate metrics by time period
 */
export function aggregateMetricsByPeriod(
  metrics: Metric[],
  period: TimePeriod
): Record<string, Metric[]> {
  return metrics.reduce((groups, metric) => {
    const date = new Date(metric.timestamp);
    let key: string;

    switch (period) {
      case TimePeriod.HOUR:
        key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
        break;
      case TimePeriod.DAY:
        key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        break;
      case TimePeriod.WEEK:
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
        break;
      case TimePeriod.MONTH:
        key = `${date.getFullYear()}-${date.getMonth()}`;
        break;
      case TimePeriod.QUARTER:
        key = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
        break;
      case TimePeriod.YEAR:
        key = `${date.getFullYear()}`;
        break;
      default:
        key = date.toISOString();
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(metric);
    return groups;
  }, {} as Record<string, Metric[]>);
}

/**
 * Calculate summary statistics for a set of values
 */
export function calculateSummaryStats(values: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, median, stdDev };
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

/**
 * Compare two metric values and return comparison result
 */
export function compareMetrics(
  current: MetricValue,
  comparison: MetricValue,
  currentLabel = 'Current',
  comparisonLabel = 'Previous'
): ComparisonResult {
  const variance = calculateVariance(current.value, comparison.value);
  const percentageChange = calculatePercentageChange(current.value, comparison.value);

  return {
    id: `comparison_${current.name}_${Date.now()}`,
    comparisonType: 'METRIC',
    metricName: current.name,
    currentValue: current.value,
    comparisonValue: comparison.value,
    variance,
    percentageChange,
    currentLabel,
    comparisonLabel,
  };
}

/**
 * Rank items by metric value
 */
export function rankByMetric<T extends { metrics: MetricValue[] }>(
  items: T[],
  metricName: string,
  descending = true
): (T & { rank: number })[] {
  const itemsWithMetric = items
    .map(item => ({
      ...item,
      metricValue: item.metrics.find(m => m.name === metricName)?.value || 0,
    }))
    .sort((a, b) => descending ? b.metricValue - a.metricValue : a.metricValue - b.metricValue)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return itemsWithMetric;
}

// ============================================================================
// FORECASTING UTILITIES
// ============================================================================

/**
 * Calculate confidence intervals for forecast data
 */
export function calculateConfidenceIntervals(
  predictions: ForecastDataPoint[],
  confidence = 0.95
): ForecastDataPoint[] {
  const values = predictions.map(p => p.value);
  const stats = calculateSummaryStats(values);
  const zScore = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.58 : 1.64;
  const margin = zScore * stats.stdDev;

  return predictions.map(point => ({
    ...point,
    lowerBound: point.lowerBound || point.value - margin,
    upperBound: point.upperBound || point.value + margin,
  }));
}

/**
 * Detect outliers in forecast data using IQR method
 */
export function detectOutliers(dataPoints: TrendDataPoint[]): TrendDataPoint[] {
  const values = dataPoints.map(p => p.value);
  const sorted = [...values].sort((a, b) => a - b);
  
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return dataPoints.filter(point => 
    point.value >= lowerBound && point.value <= upperBound
  );
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate metric data
 */
export function validateMetric(metric: Partial<Metric>): string[] {
  const errors: string[] = [];

  if (!metric.name || metric.name.trim() === '') {
    errors.push('Metric name is required');
  }

  if (typeof metric.value !== 'number' || isNaN(metric.value)) {
    errors.push('Metric value must be a valid number');
  }

  if (!metric.unit || metric.unit.trim() === '') {
    errors.push('Metric unit is required');
  }

  if (!metric.timestamp || !(metric.timestamp instanceof Date)) {
    errors.push('Metric timestamp must be a valid date');
  }

  return errors;
}

/**
 * Validate KPI data
 */
export function validateKPI(kpi: Partial<KPI>): string[] {
  const errors: string[] = [];

  if (!kpi.name || kpi.name.trim() === '') {
    errors.push('KPI name is required');
  }

  if (typeof kpi.currentValue !== 'number' || isNaN(kpi.currentValue)) {
    errors.push('KPI current value must be a valid number');
  }

  if (kpi.targetValue !== undefined && (typeof kpi.targetValue !== 'number' || isNaN(kpi.targetValue))) {
    errors.push('KPI target value must be a valid number');
  }

  return errors;
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Convert analytics data to CSV format
 */
export function convertToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',')
  );

  return [csvHeaders, ...csvRows].join('\n');
}

/**
 * Download data as CSV file
 */
export function downloadCSV(data: any[], filename: string, headers: string[]): void {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Generate analytics report summary
 */
export function generateReportSummary(metrics: Metric[], kpis: KPI[]): {
  totalMetrics: number;
  totalKPIs: number;
  categoryCounts: Record<string, number>;
  averageValues: Record<string, number>;
  trendingSummary: string;
} {
  const categoryCounts = metrics.reduce((counts, metric) => {
    const category = metric.category || 'OTHER';
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const averageValues = metrics.reduce((averages, metric) => {
    const category = metric.category || 'OTHER';
    if (!averages[category]) {
      averages[category] = 0;
    }
    averages[category] += metric.value;
    return averages;
  }, {} as Record<string, number>);

  // Calculate actual averages
  Object.keys(averageValues).forEach(category => {
    averageValues[category] = averageValues[category] / categoryCounts[category];
  });

  const improvingKPIs = kpis.filter(kpi => kpi.changePercentage > 0).length;
  const decliningKPIs = kpis.filter(kpi => kpi.changePercentage < 0).length;
  const stableKPIs = kpis.filter(kpi => kpi.changePercentage === 0).length;

  let trendingSummary = '';
  if (improvingKPIs > decliningKPIs) {
    trendingSummary = `${improvingKPIs} KPIs improving, ${decliningKPIs} declining`;
  } else if (decliningKPIs > improvingKPIs) {
    trendingSummary = `${decliningKPIs} KPIs declining, ${improvingKPIs} improving`;
  } else {
    trendingSummary = `${stableKPIs} KPIs stable, ${improvingKPIs} improving, ${decliningKPIs} declining`;
  }

  return {
    totalMetrics: metrics.length,
    totalKPIs: kpis.length,
    categoryCounts,
    averageValues,
    trendingSummary,
  };
}