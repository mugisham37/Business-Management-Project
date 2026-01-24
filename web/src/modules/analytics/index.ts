/**
 * Analytics Module - Business Intelligence and Reporting
 * Requirements: 11.1, 11.2, 11.3
 */

import { lazy } from 'react';

// Lazy load components for better code splitting
export const AnalyticsDashboard = lazy(() => 
  import('./components/AnalyticsDashboard').then(module => ({
    default: module.AnalyticsDashboard
  }))
);

export const ReportsView = lazy(() => 
  import('./components/ReportsView').then(module => ({
    default: module.ReportsView
  }))
);

export const MetricsView = lazy(() => 
  import('./components/MetricsView').then(module => ({
    default: module.MetricsView
  }))
);

// Export hooks
export { useAnalytics } from './hooks/useAnalytics';
export { useReports } from './hooks/useReports';
export { useDashboards } from './hooks/useDashboards';
export { usePredictiveAnalytics } from './hooks/usePredictiveAnalytics';
export { useComparativeAnalysis } from './hooks/useComparativeAnalysis';
export { useDataWarehouse } from './hooks/useDataWarehouse';
export { useETL } from './hooks/useETL';

// Export module metadata
export const analyticsModule = {
  name: 'Analytics & Reporting',
  version: '1.0.0',
  description: 'Business intelligence and analytics platform',
  components: {
    AnalyticsDashboard,
    ReportsView,
    MetricsView,
  },
  routes: [
    '/analytics',
    '/analytics/reports',
    '/analytics/metrics',
  ],
  permissions: ['analytics:read', 'analytics:write'],
  businessTier: 'MEDIUM',
  dependencies: ['tenant', 'auth'],
} as const;

export const ANALYTICS_MODULE_CONFIG = {
  name: 'analytics',
  displayName: 'Analytics & Reporting',
  description: 'Comprehensive business intelligence and analytics platform with real-time metrics, predictive analytics, and advanced reporting',
  version: '1.0.0',
  features: [
    'Real-time business metrics and KPIs',
    'Interactive dashboards with customizable widgets',
    'Advanced predictive analytics and forecasting',
    'Comparative analysis across time periods, locations, and segments',
    'Custom report generation and scheduling',
    'Data warehouse operations and ETL pipelines',
    'Anomaly detection and alerting',
    'Export capabilities (CSV, PDF, Excel)',
    'Multi-tenant analytics with data isolation',
    'Real-time subscriptions and live updates',
    'Machine learning-powered insights',
    'Performance monitoring and optimization',
  ],
  dependencies: [
    '@apollo/client',
    'react',
    'recharts',
    'graphql-subscriptions',
  ],
  permissions: [
    'analytics:read',
    'analytics:write',
    'analytics:admin',
    'analytics:export',
    'analytics:schedule',
  ],
  endpoints: {
    queries: [
      'getMetrics',
      'getKPIs', 
      'getTrends',
      'getDashboard',
      'getWidgetData',
      'getReports',
      'getReport',
      'executeReport',
      'getReportExecution',
      'getForecast',
      'detectAnomalies',
      'generateDemandForecast',
      'predictCustomerChurn',
      'optimizeProductPricing',
      'optimizeInventoryLevels',
      'compareTimePeriods',
      'compareLocations',
      'compareSegments',
      'queryWarehouse',
      'getDataCube',
      'getDataCubes',
      'getWarehouseStatistics',
      'testWarehouseConnection',
      'getPipelines',
      'getPipelineStatus',
      'getPipelineLastRun',
      'getAnalyticsHealth',
      'getAvailableFields',
      'executeAnalyticsQuery',
    ],
    mutations: [
      'initializeAnalytics',
      'trackEvent',
      'createDashboard',
      'createReport',
      'updateReport',
      'deleteReport',
      'scheduleReport',
      'unscheduleReport',
      'exportReport',
      'createReports',
      'executeReports',
      'createTenantSchema',
      'optimizeWarehouse',
      'createPartitions',
      'setupETLPipelines',
      'executePipeline',
      'reconfigurePipelines',
      'createPipeline',
      'deletePipeline',
    ],
    subscriptions: [
      'metricsUpdated',
      'dashboardUpdated',
      'widgetDataUpdated',
      'reportExecutionUpdated',
      'anomalyDetected',
      'forecastUpdated',
      'pipelineStatusChanged',
      'pipelineExecuted',
      'kpiThresholdExceeded',
      'reportReady',
      'analyticsHealthChanged',
    ],
  },
  hooks: [
    'useAnalytics',
    'useReports',
    'useDashboards',
    'usePredictiveAnalytics',
    'useComparativeAnalysis',
    'useDataWarehouse',
    'useETL',
  ],
  utilities: [
    'formatCurrency',
    'formatNumber',
    'formatPercentage',
    'formatMetricValue',
    'calculatePercentageChange',
    'calculateVariance',
    'getTrendDirection',
    'calculateMovingAverage',
    'smoothTrendData',
    'calculateTrendSlope',
    'groupMetricsByCategory',
    'aggregateMetricsByPeriod',
    'calculateSummaryStats',
    'compareMetrics',
    'rankByMetric',
    'calculateConfidenceIntervals',
    'detectOutliers',
    'validateMetric',
    'validateKPI',
    'convertToCSV',
    'downloadCSV',
    'generateReportSummary',
  ],
};