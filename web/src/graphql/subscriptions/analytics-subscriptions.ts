import { gql } from '@apollo/client';

// ============================================================================
// ANALYTICS SUBSCRIPTIONS - Real-time analytics updates
// ============================================================================

// Core Analytics Subscriptions
export const METRICS_UPDATED = gql`
  subscription MetricsUpdated {
    metricsUpdated {
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

// ETL Pipeline Subscriptions
export const PIPELINE_STATUS_CHANGED = gql`
  subscription PipelineStatusChanged($pipelineId: String) {
    pipelineStatusChanged(pipelineId: $pipelineId)
  }
`;

export const PIPELINE_EXECUTED = gql`
  subscription PipelineExecuted($pipelineId: String) {
    pipelineExecuted(pipelineId: $pipelineId)
  }
`;

// Real-time Analytics Updates (from existing realtime module)
export const ANALYTICS_UPDATED = gql`
  subscription AnalyticsUpdated {
    analyticsUpdated
  }
`;

// Dashboard Updates
export const DASHBOARD_UPDATED = gql`
  subscription DashboardUpdated($dashboardId: ID!) {
    dashboardUpdated(dashboardId: $dashboardId) {
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

export const WIDGET_DATA_UPDATED = gql`
  subscription WidgetDataUpdated($widgetId: ID!) {
    widgetDataUpdated(widgetId: $widgetId) {
      widgetId
      data
      updatedAt
      fromCache
    }
  }
`;

// Report Execution Updates
export const REPORT_EXECUTION_UPDATED = gql`
  subscription ReportExecutionUpdated($executionId: ID!) {
    reportExecutionUpdated(executionId: $executionId) {
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

// Anomaly Detection Alerts
export const ANOMALY_DETECTED = gql`
  subscription AnomalyDetected($metricName: String) {
    anomalyDetected(metricName: $metricName) {
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

// Forecast Updates
export const FORECAST_UPDATED = gql`
  subscription ForecastUpdated($metricName: String) {
    forecastUpdated(metricName: $metricName) {
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

// Data Warehouse Events
export const WAREHOUSE_OPTIMIZED = gql`
  subscription WarehouseOptimized {
    warehouseOptimized {
      tenantId
      optimizationId
      status
      startedAt
      completedAt
      improvements {
        metric
        beforeValue
        afterValue
        improvementPercentage
      }
    }
  }
`;

export const SCHEMA_CREATED = gql`
  subscription SchemaCreated {
    schemaCreated {
      tenantId
      schemaName
      createdAt
      tables
      status
    }
  }
`;

// KPI Threshold Alerts
export const KPI_THRESHOLD_EXCEEDED = gql`
  subscription KPIThresholdExceeded($kpiName: String) {
    kpiThresholdExceeded(kpiName: $kpiName) {
      id
      name
      currentValue
      targetValue
      thresholdType
      severity
      timestamp
      message
    }
  }
`;

// Custom Report Alerts
export const REPORT_READY = gql`
  subscription ReportReady($reportId: ID) {
    reportReady(reportId: $reportId) {
      id
      reportId
      status
      downloadUrl
      generatedAt
      format
      size
    }
  }
`;

export const SCHEDULED_REPORT_EXECUTED = gql`
  subscription ScheduledReportExecuted($reportId: ID) {
    scheduledReportExecuted(reportId: $reportId) {
      id
      reportId
      executionId
      status
      scheduledAt
      executedAt
      nextRunAt
    }
  }
`;

// Data Quality Alerts
export const DATA_QUALITY_ISSUE = gql`
  subscription DataQualityIssue {
    dataQualityIssue {
      id
      issueType
      severity
      description
      affectedTables
      affectedRecords
      detectedAt
      suggestedActions
    }
  }
`;

// Performance Monitoring
export const QUERY_PERFORMANCE_ALERT = gql`
  subscription QueryPerformanceAlert {
    queryPerformanceAlert {
      id
      queryName
      executionTime
      threshold
      severity
      timestamp
      optimizationSuggestions
    }
  }
`;

// Cache Events
export const CACHE_INVALIDATED = gql`
  subscription CacheInvalidated($cacheKey: String) {
    cacheInvalidated(cacheKey: $cacheKey) {
      cacheKey
      reason
      timestamp
      affectedQueries
    }
  }
`;

// Predictive Model Updates
export const MODEL_TRAINED = gql`
  subscription ModelTrained($modelName: String) {
    modelTrained(modelName: $modelName) {
      id
      name
      modelType
      accuracy
      trainingCompletedAt
      status
      metrics {
        name
        value
      }
    }
  }
`;

export const PREDICTION_UPDATED = gql`
  subscription PredictionUpdated($modelName: String, $entityId: String) {
    predictionUpdated(modelName: $modelName, entityId: $entityId) {
      id
      modelName
      entityId
      prediction
      confidence
      updatedAt
      factors {
        name
        impact
        value
      }
    }
  }
`;

// System Health Monitoring
export const ANALYTICS_HEALTH_CHANGED = gql`
  subscription AnalyticsHealthChanged {
    analyticsHealthChanged {
      tenantId
      component
      status
      timestamp
      metrics {
        name
        value
        status
      }
      issues {
        severity
        message
        component
      }
    }
  }
`;

// Export subscription types for TypeScript
export interface MetricsUpdatedSubscription {
  metricsUpdated: {
    id: string;
    name: string;
    description?: string;
    value: number;
    unit: string;
    category: string;
    timestamp: Date;
    dimensions?: Array<{
      name: string;
      value: string;
    }>;
  };
}

export interface PipelineStatusChangedSubscription {
  pipelineStatusChanged: string;
}

export interface PipelineExecutedSubscription {
  pipelineExecuted: string;
}

export interface AnalyticsUpdatedSubscription {
  analyticsUpdated: string;
}

export interface AnomalyDetectedSubscription {
  anomalyDetected: {
    id: string;
    metricName: string;
    timestamp: Date;
    actualValue: number;
    expectedValue: number;
    deviationScore: number;
    severity: string;
  };
}

export interface KPIThresholdExceededSubscription {
  kpiThresholdExceeded: {
    id: string;
    name: string;
    currentValue: number;
    targetValue: number;
    thresholdType: string;
    severity: string;
    timestamp: Date;
    message: string;
  };
}

export interface ReportReadySubscription {
  reportReady: {
    id: string;
    reportId: string;
    status: string;
    downloadUrl?: string;
    generatedAt: Date;
    format: string;
    size?: number;
  };
}