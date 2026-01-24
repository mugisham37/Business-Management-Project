// ============================================================================
// ANALYTICS TYPES - Complete TypeScript definitions for analytics module
// ============================================================================

// Core Analytics Types
export interface MetricDimension {
  name: string;
  value: string;
}

export interface TrendDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface MetricValue {
  name: string;
  value: number;
  unit?: string;
}

export interface ForecastDataPoint {
  timestamp: Date;
  value: number;
  lowerBound?: number;
  upperBound?: number;
}

export interface Metric {
  id: string;
  name: string;
  description?: string;
  value: number;
  unit: string;
  category: string;
  timestamp: Date;
  dimensions?: MetricDimension[];
}

export interface KPI {
  id: string;
  name: string;
  description?: string;
  currentValue: number;
  targetValue?: number;
  previousValue?: number;
  changePercentage: number;
  status: string;
  period: string;
  updatedAt: Date;
}

export interface Trend {
  id: string;
  metricName: string;
  dataPoints: TrendDataPoint[];
  direction: string;
  slope: number;
  startDate: Date;
  endDate: Date;
}

// Dashboard Types
export interface DashboardWidget {
  id: string;
  title: string;
  type: string;
  data: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
}

export interface WidgetData {
  widgetId: string;
  data: string;
  updatedAt: Date;
  fromCache: boolean;
}

// Reporting Types
export interface Report {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  reportType: string;
  status: string;
  metrics: string[];
  dimensions?: string[];
  schedule: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
}

export interface ReportExecution {
  id: string;
  reportId: string;
  status: string;
  jobId?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: string;
}

export interface ScheduledReport {
  id: string;
  reportId: string;
  schedule: string;
  isActive: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
}

// Comparative Analysis Types
export interface ComparisonResult {
  id: string;
  comparisonType: string;
  metricName: string;
  currentValue: number;
  comparisonValue: number;
  variance: number;
  percentageChange: number;
  currentLabel: string;
  comparisonLabel: string;
  context?: string;
}

export interface LocationComparison {
  locationId: string;
  locationName: string;
  metrics: MetricValue[];
  rank: number;
}

export interface SegmentComparison {
  segmentId: string;
  segmentName: string;
  metrics: MetricValue[];
  size: number;
}

// Predictive Analytics Types
export interface Forecast {
  id: string;
  metricName: string;
  predictions: ForecastDataPoint[];
  confidence: number;
  model: string;
}

export interface Anomaly {
  id: string;
  metricName: string;
  timestamp: Date;
  actualValue: number;
  expectedValue: number;
  deviationScore: number;
  severity: string;
}

export interface DemandForecast {
  id: string;
  productId: string;
  locationId: string;
  predictions: ForecastDataPoint[];
  confidence: number;
  model: string;
  forecastPeriod: string;
  createdAt: Date;
}

export interface ChurnPrediction {
  id: string;
  customerId: string;
  churnProbability: number;
  riskLevel: string;
  riskFactors: string[];
  recommendedActions?: string;
  predictionDate: Date;
  createdAt: Date;
}

export interface PriceOptimization {
  id: string;
  productId: string;
  locationId?: string;
  currentPrice: number;
  recommendedPrice: number;
  expectedRevenueLift: number;
  confidence: number;
  reasoning?: string;
  createdAt: Date;
}

export interface InventoryOptimization {
  id: string;
  productId: string;
  locationId: string;
  currentStock: number;
  recommendedStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  expectedServiceLevel: number;
  createdAt: Date;
}

// Data Warehouse Types
export interface DataCube {
  id: string;
  name: string;
  dimensions: string[];
  measures: string[];
  data: string;
}

export interface WarehouseStatistics {
  id: string;
  tenantId: string;
  totalStorageGB: number;
  totalTables: number;
  totalRows: number;
  compressionRatio: number;
  queryPerformanceScore: number;
  lastOptimizedAt: Date;
  updatedAt: Date;
}

export interface QueryPerformanceStats {
  id: string;
  queryName: string;
  averageExecutionTime: number;
  executionCount: number;
  cacheHitRate: number;
  averageRowsReturned: number;
  lastExecutedAt: Date;
  createdAt: Date;
}

// ETL Types
export interface ETLPipeline {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  sourceConfig: string;
  transformConfig: string;
  destinationConfig: string;
  schedule?: string;
  isActive: boolean;
  status: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ETLJobResult {
  id: string;
  pipelineId: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  errorMessage?: string;
  executionLog?: string;
}

// Predictive Model Types
export interface PredictiveModel {
  id: string;
  name: string;
  modelType: string;
  features: string[];
  targetVariable: string;
  status: string;
  accuracy?: number;
  trainingConfig?: string;
  lastTrainedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Configuration Types
export interface AnalyticsConfiguration {
  id: string;
  tenantId: string;
  dataRetentionPeriod: string;
  aggregationLevel: string;
  enabledMetrics: string[];
  customSettings?: string;
  enableRealTimeProcessing: boolean;
  enablePredictiveAnalytics: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricDefinition {
  id: string;
  name: string;
  description?: string;
  dataType: string;
  aggregationType: string;
  dimensions: string[];
  formula?: string;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailableFields {
  dimensions: string[];
  measures: string[];
  filters: string[];
  dateSources: string[];
}

// Enums
export enum MetricCategory {
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  CUSTOMER = 'CUSTOMER',
  FINANCIAL = 'FINANCIAL',
  OPERATIONAL = 'OPERATIONAL',
}

export enum TimePeriod {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

export enum ReportStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ExecutionStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Filter Types
export interface MetricsFilter {
  categories?: MetricCategory[];
  startDate?: Date;
  endDate?: Date;
  metricNames?: string[];
  dimensions?: string[];
}

export interface KPIFilter {
  kpiNames?: string[];
  status?: string;
  period?: TimePeriod;
}

export interface TrendFilter {
  metricNames?: string[];
  startDate?: Date;
  endDate?: Date;
  granularity?: TimePeriod;
  limit?: number;
}

export interface DashboardFilter {
  name?: string;
  createdBy?: string;
  isPublic?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ReportFilter {
  name?: string;
  reportType?: string;
  status?: string;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

// Input Types for Mutations
export interface CreateReportInput {
  name: string;
  description?: string;
  reportType: string;
  metrics: string[];
  dimensions?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateReportInput {
  name?: string;
  description?: string;
  reportType?: string;
  metrics?: string[];
  dimensions?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface ExecuteReportInput {
  reportId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ScheduleReportInput {
  reportId: string;
  schedule: string;
  timezone?: string;
}

export interface TimePeriodComparisonInput {
  currentStartDate: Date;
  currentEndDate: Date;
  comparisonStartDate: Date;
  comparisonEndDate: Date;
  metricNames?: string[];
}

export interface LocationComparisonInput {
  locationIds: string[];
  metricNames: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface SegmentComparisonInput {
  segmentIds: string[];
  metricNames: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface AnalyticsQueryInput {
  name: string;
  description?: string;
  sql: string;
  dimensions: string[];
  measures: string[];
  parameters?: string;
  limit?: number;
}

export interface ETLPipelineInput {
  name: string;
  description?: string;
  sourceType: string;
  sourceConfig: string;
  transformConfig: string;
  destinationConfig: string;
  schedule?: string;
  isActive?: boolean;
}

export interface PredictiveModelTrainingInput {
  modelName: string;
  modelType: string;
  features: string[];
  targetVariable: string;
  trainingConfig?: string;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
}

export interface AnalyticsConfigurationInput {
  dataRetentionPeriod: string;
  aggregationLevel: string;
  enabledMetrics: string[];
  customSettings?: string;
  enableRealTimeProcessing?: boolean;
  enablePredictiveAnalytics?: boolean;
}

// Hook Return Types
export interface UseAnalyticsResult {
  // Metrics
  metrics: Metric[];
  kpis: KPI[];
  trends: Trend[];
  
  // Loading states
  metricsLoading: boolean;
  kpisLoading: boolean;
  trendsLoading: boolean;
  
  // Error states
  metricsError?: Error;
  kpisError?: Error;
  trendsError?: Error;
  
  // Actions
  getMetrics: (filter?: MetricsFilter) => Promise<Metric[]>;
  getKPIs: (filter?: KPIFilter) => Promise<KPI[]>;
  getTrends: (filter?: TrendFilter) => Promise<Trend[]>;
  trackEvent: (eventName: string, eventData: any) => Promise<void>;
  initializeAnalytics: (config: any) => Promise<void>;
  
  // Real-time subscriptions
  subscribeToMetrics: () => void;
  unsubscribeFromMetrics: () => void;
}

export interface UseDashboardsResult {
  // Data
  dashboards: Dashboard[];
  currentDashboard?: Dashboard;
  widgetData: Record<string, WidgetData>;
  
  // Loading states
  dashboardsLoading: boolean;
  dashboardLoading: boolean;
  widgetLoading: Record<string, boolean>;
  
  // Error states
  dashboardsError?: Error;
  dashboardError?: Error;
  widgetError?: Error;
  
  // Actions
  getDashboard: (dashboardId: string) => Promise<Dashboard>;
  createDashboard: (name: string, description?: string) => Promise<Dashboard>;
  getWidgetData: (widgetId: string) => Promise<WidgetData>;
  
  // Real-time subscriptions
  subscribeToDashboard: (dashboardId: string) => void;
  unsubscribeFromDashboard: (dashboardId: string) => void;
}

export interface UseReportsResult {
  // Data
  reports: Report[];
  currentReport?: Report;
  executions: ReportExecution[];
  scheduledReports: ScheduledReport[];
  
  // Loading states
  reportsLoading: boolean;
  reportLoading: boolean;
  executionLoading: boolean;
  
  // Error states
  reportsError?: Error;
  reportError?: Error;
  executionError?: Error;
  
  // Actions
  getReports: () => Promise<Report[]>;
  getReport: (reportId: string) => Promise<Report>;
  createReport: (input: CreateReportInput) => Promise<Report>;
  updateReport: (reportId: string, input: UpdateReportInput) => Promise<Report>;
  deleteReport: (reportId: string) => Promise<boolean>;
  executeReport: (input: ExecuteReportInput) => Promise<ReportExecution>;
  scheduleReport: (input: ScheduleReportInput) => Promise<ScheduledReport>;
  unscheduleReport: (reportId: string) => Promise<boolean>;
  exportReport: (reportId: string, format: string) => Promise<string>;
  
  // Batch operations
  createReports: (inputs: CreateReportInput[]) => Promise<Report[]>;
  executeReports: (reportIds: string[]) => Promise<ReportExecution[]>;
}

export interface UsePredictiveAnalyticsResult {
  // Data
  forecasts: Forecast[];
  anomalies: Anomaly[];
  churnPredictions: ChurnPrediction[];
  priceOptimizations: PriceOptimization[];
  inventoryOptimizations: InventoryOptimization[];
  
  // Loading states
  forecastLoading: boolean;
  anomalyLoading: boolean;
  churnLoading: boolean;
  pricingLoading: boolean;
  inventoryLoading: boolean;
  
  // Error states
  forecastError?: Error;
  anomalyError?: Error;
  churnError?: Error;
  pricingError?: Error;
  inventoryError?: Error;
  
  // Actions
  getForecast: (metricName: string, periods: number, productId?: string, locationId?: string) => Promise<Forecast[]>;
  detectAnomalies: (metricName: string, threshold?: number) => Promise<Anomaly[]>;
  generateDemandForecast: (productId: string, locationId: string, forecastHorizon: number) => Promise<Forecast>;
  predictCustomerChurn: (customerId?: string) => Promise<any>;
  optimizeProductPricing: (productId: string, locationId?: string) => Promise<any>;
  optimizeInventoryLevels: (productId: string, locationId: string) => Promise<any>;
}

export interface UseComparativeAnalysisResult {
  // Data
  timePeriodComparisons: ComparisonResult[];
  locationComparisons: LocationComparison[];
  segmentComparisons: SegmentComparison[];
  
  // Loading states
  timePeriodLoading: boolean;
  locationLoading: boolean;
  segmentLoading: boolean;
  
  // Error states
  timePeriodError?: Error;
  locationError?: Error;
  segmentError?: Error;
  
  // Actions
  compareTimePeriods: (input: TimePeriodComparisonInput) => Promise<ComparisonResult[]>;
  compareLocations: (input: LocationComparisonInput) => Promise<LocationComparison[]>;
  compareSegments: (input: SegmentComparisonInput) => Promise<SegmentComparison[]>;
}

export interface UseDataWarehouseResult {
  // Data
  dataCubes: DataCube[];
  warehouseStats?: WarehouseStatistics;
  queryResults: Record<string, any>;
  
  // Loading states
  cubesLoading: boolean;
  statsLoading: boolean;
  queryLoading: boolean;
  
  // Error states
  cubesError?: Error;
  statsError?: Error;
  queryError?: Error;
  
  // Actions
  getDataCubes: () => Promise<DataCube[]>;
  getDataCube: (cubeName: string) => Promise<DataCube>;
  queryWarehouse: (query: string) => Promise<any>;
  getWarehouseStatistics: () => Promise<any>;
  testWarehouseConnection: () => Promise<boolean>;
  createTenantSchema: (schemaConfig: string) => Promise<string>;
  optimizeWarehouse: (optimizationConfig?: string) => Promise<string>;
  createPartitions: (partitionConfig: string) => Promise<string>;
}

export interface UseETLResult {
  // Data
  pipelines: ETLPipeline[];
  pipelineStatus: Record<string, any>;
  jobResults: ETLJobResult[];
  
  // Loading states
  pipelinesLoading: boolean;
  statusLoading: boolean;
  executionLoading: boolean;
  
  // Error states
  pipelinesError?: Error;
  statusError?: Error;
  executionError?: Error;
  
  // Actions
  getPipelines: () => Promise<any>;
  getPipelineStatus: (pipelineId: string) => Promise<any>;
  getPipelineLastRun: (pipelineId: string) => Promise<any>;
  setupETLPipelines: (config: string) => Promise<string>;
  executePipeline: (pipelineId: string, parameters?: string) => Promise<string>;
  reconfigurePipelines: (config: string) => Promise<string>;
  createPipeline: (pipelineConfig: string) => Promise<string>;
  deletePipeline: (pipelineId: string) => Promise<boolean>;
  
  // Real-time subscriptions
  subscribeToPipelineStatus: (pipelineId?: string) => void;
  subscribeToPipelineExecution: (pipelineId?: string) => void;
  unsubscribeFromPipeline: () => void;
}