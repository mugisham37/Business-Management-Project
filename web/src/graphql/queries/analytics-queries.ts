import { gql } from '@apollo/client';

// ============================================================================
// ANALYTICS QUERIES - Complete coverage of backend analytics endpoints
// ============================================================================

// Core Analytics Queries
export const GET_METRICS = gql`
  query GetMetrics($filter: MetricsFilterInput) {
    getMetrics(filter: $filter) {
      id
      name
      description
      value
      unit
      category
      timestamp
      dimensions {
        name
        value
      }
    }
  }
`;

export const GET_KPIS = gql`
  query GetKPIs($filter: KPIFilterInput) {
    getKPIs(filter: $filter) {
      id
      name
      description
      currentValue
      targetValue
      previousValue
      changePercentage
      status
      period
      updatedAt
    }
  }
`;

export const GET_TRENDS = gql`
  query GetTrends($filter: TrendFilterInput) {
    getTrends(filter: $filter) {
      id
      metricName
      dataPoints {
        timestamp
        value
        label
      }
      direction
      slope
      startDate
      endDate
    }
  }
`;

export const GET_ANALYTICS_HEALTH = gql`
  query GetAnalyticsHealth {
    getAnalyticsHealth
  }
`;

export const GET_AVAILABLE_FIELDS = gql`
  query GetAvailableFields {
    getAvailableFields
  }
`;

export const EXECUTE_ANALYTICS_QUERY = gql`
  query ExecuteAnalyticsQuery($queryName: String!, $parameters: String) {
    executeAnalyticsQuery(queryName: $queryName, parameters: $parameters)
  }
`;

// Dashboard Queries
export const GET_DASHBOARD = gql`
  query GetDashboard($dashboardId: ID!) {
    getDashboard(dashboardId: $dashboardId) {
      id
      tenantId
      name
      description
      widgets {
        id
        title
        type
        data
        x
        y
        width
        height
      }
      isPublic
      createdAt
      updatedAt
      createdBy
      version
    }
  }
`;

export const GET_WIDGET_DATA = gql`
  query GetWidgetData($widgetId: ID!) {
    getWidgetData(widgetId: $widgetId) {
      widgetId
      data
      updatedAt
      fromCache
    }
  }
`;

// Reporting Queries
export const GET_REPORT = gql`
  query GetReport($reportId: ID!) {
    getReport(reportId: $reportId)
  }
`;

export const GET_REPORTS = gql`
  query GetReports {
    reports {
      id
      tenantId
      name
      description
      reportType
      status
      metrics
      dimensions
      schedule
      createdAt
      updatedAt
      createdBy
      version
    }
  }
`;

export const GET_REPORT_HISTORY = gql`
  query GetReportHistory($reportId: ID!) {
    getReportHistory(reportId: $reportId)
  }
`;

export const GET_REPORT_EXECUTION = gql`
  query GetReportExecution($executionId: ID!) {
    getReportExecution(executionId: $executionId) {
      id
      reportId
      status
      jobId
      startedAt
      completedAt
      error
      result
    }
  }
`;

export const EXECUTE_REPORT = gql`
  query ExecuteReport($input: ExecuteReportInput!) {
    executeReport(input: $input) {
      id
      reportId
      status
      jobId
      startedAt
      completedAt
      error
      result
    }
  }
`;

// Predictive Analytics Queries
export const GET_FORECAST = gql`
  query GetForecast(
    $metricName: String!
    $periods: Float!
    $productId: String
    $locationId: String
  ) {
    getForecast(
      metricName: $metricName
      periods: $periods
      productId: $productId
      locationId: $locationId
    ) {
      id
      metricName
      predictions {
        timestamp
        value
        lowerBound
        upperBound
      }
      confidence
      model
    }
  }
`;

export const DETECT_ANOMALIES = gql`
  query DetectAnomalies($metricName: String!, $threshold: Float) {
    detectAnomalies(metricName: $metricName, threshold: $threshold) {
      id
      metricName
      timestamp
      actualValue
      expectedValue
      deviationScore
      severity
    }
  }
`;

export const GENERATE_DEMAND_FORECAST = gql`
  query GenerateDemandForecast(
    $productId: String!
    $locationId: String!
    $forecastHorizon: Float!
  ) {
    generateDemandForecast(
      productId: $productId
      locationId: $locationId
      forecastHorizon: $forecastHorizon
    ) {
      id
      metricName
      predictions {
        timestamp
        value
        lowerBound
        upperBound
      }
      confidence
      model
    }
  }
`;

export const PREDICT_CUSTOMER_CHURN = gql`
  query PredictCustomerChurn($customerId: String) {
    predictCustomerChurn(customerId: $customerId)
  }
`;

export const OPTIMIZE_PRODUCT_PRICING = gql`
  query OptimizeProductPricing($productId: String!, $locationId: String) {
    optimizeProductPricing(productId: $productId, locationId: $locationId)
  }
`;

export const OPTIMIZE_INVENTORY_LEVELS = gql`
  query OptimizeInventoryLevels($productId: String!, $locationId: String!) {
    optimizeInventoryLevels(productId: $productId, locationId: $locationId)
  }
`;

// Data Warehouse Queries
export const QUERY_WAREHOUSE = gql`
  query QueryWarehouse($query: String!) {
    queryWarehouse(query: $query)
  }
`;

export const GET_DATA_CUBE = gql`
  query GetDataCube($cubeName: String!) {
    getDataCube(cubeName: $cubeName) {
      id
      name
      dimensions
      measures
      data
    }
  }
`;

export const GET_DATA_CUBES = gql`
  query GetDataCubes {
    getDataCubes {
      id
      name
      dimensions
      measures
      data
    }
  }
`;

export const GET_WAREHOUSE_STATISTICS = gql`
  query GetWarehouseStatistics {
    getWarehouseStatistics
  }
`;

export const TEST_WAREHOUSE_CONNECTION = gql`
  query TestWarehouseConnection {
    testWarehouseConnection
  }
`;

// ETL Queries
export const GET_PIPELINES = gql`
  query GetPipelines {
    getPipelines
  }
`;

export const GET_PIPELINE_STATUS = gql`
  query GetPipelineStatus($pipelineId: String!) {
    getPipelineStatus(pipelineId: $pipelineId)
  }
`;

export const GET_PIPELINE_LAST_RUN = gql`
  query GetPipelineLastRun($pipelineId: String!) {
    getPipelineLastRun(pipelineId: $pipelineId)
  }
`;

// Comparative Analysis Queries
export const COMPARE_TIME_PERIODS = gql`
  query CompareTimePeriods($input: TimePeriodComparisonInput!) {
    compareTimePeriods(input: $input) {
      id
      comparisonType
      metricName
      currentValue
      comparisonValue
      variance
      percentageChange
      currentLabel
      comparisonLabel
      context
    }
  }
`;

export const COMPARE_LOCATIONS = gql`
  query CompareLocations($input: LocationComparisonInput!) {
    compareLocations(input: $input) {
      locationId
      locationName
      metrics {
        name
        value
        unit
      }
      rank
    }
  }
`;

export const COMPARE_SEGMENTS = gql`
  query CompareSegments($input: SegmentComparisonInput!) {
    compareSegments(input: $input) {
      segmentId
      segmentName
      metrics {
        name
        value
        unit
      }
      size
    }
  }
`;

// Fragment definitions for reusability
export const METRIC_FRAGMENT = gql`
  fragment MetricFragment on Metric {
    id
    name
    description
    value
    unit
    category
    timestamp
    dimensions {
      name
      value
    }
  }
`;

export const KPI_FRAGMENT = gql`
  fragment KPIFragment on KPI {
    id
    name
    description
    currentValue
    targetValue
    previousValue
    changePercentage
    status
    period
    updatedAt
  }
`;

export const TREND_FRAGMENT = gql`
  fragment TrendFragment on Trend {
    id
    metricName
    dataPoints {
      timestamp
      value
      label
    }
    direction
    slope
    startDate
    endDate
  }
`;

export const DASHBOARD_FRAGMENT = gql`
  fragment DashboardFragment on Dashboard {
    id
    tenantId
    name
    description
    widgets {
      id
      title
      type
      data
      x
      y
      width
      height
    }
    isPublic
    createdAt
    updatedAt
    createdBy
    version
  }
`;

export const REPORT_FRAGMENT = gql`
  fragment ReportFragment on Report {
    id
    tenantId
    name
    description
    reportType
    status
    metrics
    dimensions
    schedule
    createdAt
    updatedAt
    createdBy
    version
  }
`;

export const FORECAST_FRAGMENT = gql`
  fragment ForecastFragment on Forecast {
    id
    metricName
    predictions {
      timestamp
      value
      lowerBound
      upperBound
    }
    confidence
    model
  }
`;

export const ANOMALY_FRAGMENT = gql`
  fragment AnomalyFragment on Anomaly {
    id
    metricName
    timestamp
    actualValue
    expectedValue
    deviationScore
    severity
  }
`;

export const DATA_CUBE_FRAGMENT = gql`
  fragment DataCubeFragment on DataCube {
    id
    name
    dimensions
    measures
    data
  }
`;

export const COMPARISON_RESULT_FRAGMENT = gql`
  fragment ComparisonResultFragment on ComparisonResult {
    id
    comparisonType
    metricName
    currentValue
    comparisonValue
    variance
    percentageChange
    currentLabel
    comparisonLabel
    context
  }
`;